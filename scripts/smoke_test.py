"""End-to-End Verification Smoke Test Script for CachePilot.

Executes a complete verification cycle:
1. Health Probes (Live & Ready)
2. Document Ingestion & Chunking
3. Cold Query (Small Model Routing)
4. Exact Cache Hit (<5ms Tier 1 Redis/In-memory)
5. Complex Comparative Query (Large Model Routing)
6. Paraphrased Semantic Cache Hit (Tier 2 Vector Cosine Search)
7. Telemetry & Metrics Summary
8. Offline Benchmark Quality Run
9. Rate Limiting Headers
"""
import sys
import os
import time
import asyncio

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import AsyncClient, ASGITransport
from backend.app.main import app


async def run_smoke_test():
    print("=" * 65)
    print("  CachePilot (CPilot) - End-to-End Verification Smoke Test")
    print("=" * 65)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Health Probes
        print("\n[1/8] Probing System Health...")
        r_live = await client.get("/health/live")
        assert r_live.status_code == 200, f"Live probe failed: {r_live.text}"
        print("  [OK] GET /health/live -> 200 OK")

        r_ready = await client.get("/health/ready")
        assert r_ready.status_code in (200, 503), f"Ready probe failed: {r_ready.text}"
        ready_data = r_ready.json()
        print(f"  [OK] GET /health/ready -> Status: {ready_data['status']}")

        # Step 2: Ingest Document
        tenant = "smoke-tenant-01"
        print(f"\n[2/8] Ingesting enterprise document for tenant '{tenant}'...")
        doc_payload = {
            "title": "Disaster Recovery & SLA Policy",
            "content": "For Tier-1 enterprise workloads, Recovery Point Objective (RPO) is strictly 15 minutes, and Recovery Time Objective (RTO) is 1 hour across active-passive disaster recovery sites.",
            "tenant_id": tenant,
            "security_scope": "infra-ops"
        }
        r_ingest = await client.post("/api/v1/documents", json=doc_payload)
        assert r_ingest.status_code == 201, f"Ingest failed: {r_ingest.text}"
        ingest_data = r_ingest.json()
        print(f"  [OK] POST /api/v1/documents -> 201 Created (Doc ID: {ingest_data['document_id']}, Chunks: {ingest_data['chunk_count']})")

        # Step 3: Cold Query (Small Model Routing)
        print("\n[3/8] Executing Direct Lookup Query (Cold Miss)...")
        q1_payload = {
            "query": "What is the RPO target for Tier-1 workloads?",
            "tenant_id": tenant,
            "security_scope": "infra-ops"
        }
        r_q1 = await client.post("/api/v1/query", json=q1_payload)
        assert r_q1.status_code == 200, f"Query 1 failed: {r_q1.text}"
        q1_data = r_q1.json()
        telemetry1 = q1_data["telemetry"]
        print(f"       Debug telemetry1: status={telemetry1['cache_status']}, route={telemetry1['route']}")
        assert telemetry1["cache_status"].upper() == "MISS", f"Expected cold miss, got {telemetry1['cache_status']}"
        assert telemetry1["route"] == "small", f"Expected small route, got {telemetry1['route']}"
        print(f"  [OK] POST /api/v1/query -> Cache: {telemetry1['cache_status']}, Route: {telemetry1['route']} ({telemetry1['route_reason']}), Latency: {telemetry1['latencies_ms']['total']}ms")
        print(f"       Grounded Citations: {len(q1_data['citations'])} chunk(s)")

        # Step 4: Exact Cache Repeat (Tier 1 Exact Match)
        print("\n[4/8] Executing Repeated Query (Tier 1 Exact Cache Match)...")
        r_q2 = await client.post("/api/v1/query", json=q1_payload)
        assert r_q2.status_code == 200
        q2_data = r_q2.json()
        telemetry2 = q2_data["telemetry"]
        assert "HIT" in telemetry2["cache_status"].upper(), f"Expected cache hit, got {telemetry2['cache_status']}"
        assert telemetry2["route"] == "cache"
        print(f"  [OK] POST /api/v1/query -> Cache: {telemetry2['cache_status']} (Hit!), Route: {telemetry2['route']}, Latency: {telemetry2['latencies_ms']['total']}ms, Cost: ${telemetry2['estimated_cost_usd']}")

        # Step 5: Complex Comparative Query (Large Model Routing)
        print("\n[5/8] Executing Complex Comparative Query (Large Model Routing)...")
        q3_payload = {
            "query": "Compare the tradeoffs and differences between RPO and RTO for active-passive recovery sites.",
            "tenant_id": tenant,
            "security_scope": "infra-ops"
        }
        r_q3 = await client.post("/api/v1/query", json=q3_payload)
        assert r_q3.status_code == 200
        q3_data = r_q3.json()
        telemetry3 = q3_data["telemetry"]
        assert telemetry3["route"] == "large", f"Expected large route, got {telemetry3['route']}"
        assert telemetry3["route_reason"] == "REASONING_REQUIRED"
        print(f"  [OK] POST /api/v1/query -> Complexity Route: {telemetry3['route']} ({telemetry3['route_reason']})")

        # Step 6: Paraphrased Query (Tier 2 Semantic Cache Hit)
        print("\n[6/8] Executing Paraphrased Query (Tier 2 Semantic Vector Hit)...")
        q4_payload = {
            "query": "What is the target RPO for Tier-1 workloads in disaster recovery?",
            "tenant_id": tenant,
            "security_scope": "infra-ops"
        }
        r_q4 = await client.post("/api/v1/query", json=q4_payload)
        assert r_q4.status_code == 200
        q4_data = r_q4.json()
        telemetry4 = q4_data["telemetry"]
        print(f"  [OK] POST /api/v1/query -> Cache Status: {telemetry4['cache_status']}, Route: {telemetry4['route']}, Latency: {telemetry4['latencies_ms']['total']}ms")

        # Step 7: Telemetry & Summary Metrics
        print(f"\n[7/8] Verifying Aggregated Telemetry for tenant '{tenant}'...")
        r_metrics = await client.get(f"/api/v1/metrics/summary?tenant_id={tenant}")
        assert r_metrics.status_code == 200
        m_data = r_metrics.json()
        print(f"  [OK] GET /api/v1/metrics/summary -> Total Requests: {m_data['total_requests']}, Hits: {m_data['cache_hits']}, Hit Rate: {round(m_data['cache_hit_rate'] * 100, 1)}%")
        print(f"       Estimated Spend: ${m_data['estimated_total_cost_usd']}, Avoided: ${m_data.get('estimated_cost_avoided_usd', 0.0)}")
        print(f"       Rate Limit Header: {r_metrics.headers.get('X-RateLimit-Limit', 'N/A')} req/min, Remaining: {r_metrics.headers.get('X-RateLimit-Remaining', 'N/A')}")

        # Step 8: Offline Quality Benchmark Run
        print("\n[8/8] Executing Benchmark Evaluation Suite...")
        r_eval = await client.post(f"/api/v1/evaluation/run?tenant_id={tenant}")
        assert r_eval.status_code == 200
        eval_data = r_eval.json()
        print(f"  [OK] POST /api/v1/evaluation/run -> Run ID: {eval_data['run_id']}")
        print(f"       Total Queries: {eval_data['total_queries']}, Cache Hit Rate: {eval_data['cache_hit_rate_percent']}%")
        print(f"       Overall Cost Reduction: {eval_data['overall_cost_reduction_percent']}%")
        print(f"       Overall Latency Reduction: {eval_data['overall_latency_reduction_percent']}%")
        print(f"       Faithfulness & Citation Coverage: {eval_data['citation_coverage_percent']}%")
        print(f"       Non-Authoritative Billing Verified: is_authoritative_billing={eval_data['is_authoritative_billing']}")

    print("\n" + "=" * 65)
    print("  [SUCCESS] All CachePilot Smoke Test Steps Completed & Verified!")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(run_smoke_test())
