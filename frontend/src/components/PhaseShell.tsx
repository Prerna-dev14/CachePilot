import { ShieldAlert, Cpu, ArrowRight, Code2, KeyRound, Sparkles } from 'lucide-react';
import type { TabKey } from './Navigation';

interface PhaseShellProps {
  activeTab: TabKey;
  selectedTenant: string;
}

export const PhaseShell: React.FC<PhaseShellProps> = ({ activeTab, selectedTenant }) => {
  if (activeTab === 'foundation') {
    return (
      <div className="space-y-6">
        {/* Foundation Architecture Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Scope-Aware Semantic Cache Key Specification */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Scope-Aware Cache Key Formula</h3>
                <p className="text-xs text-slate-400">Deterministic multi-tenant cache partition</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              In accordance with <span className="text-brand-300 font-mono">CachePilot_Master_Specification.docx</span>, cache entries are strictly scoped to prevent cross-tenant and cross-scope data leakage:
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-300 space-y-1.5 overflow-x-auto">
              <div className="text-emerald-400 font-medium">// Hash Key Generation Pipeline</div>
              <div>cache_key = SHA256(</div>
              <div className="pl-4 text-brand-300">tenant_id: "{selectedTenant}" + ":" +</div>
              <div className="pl-4 text-brand-300">security_scope: "public" + ":" +</div>
              <div className="pl-4 text-indigo-300">normalize_query(query) + ":" +</div>
              <div className="pl-4 text-slate-400">embedding_model_version: "mock-embedding-v1" + ":" +</div>
              <div className="pl-4 text-slate-400">corpus_version: "v1.0.0" + ":" +</div>
              <div className="pl-4 text-slate-400">prompt_version: "v1.0.0" + ":" +</div>
              <div className="pl-4 text-slate-400">hash(generation_settings)</div>
              <div>)</div>
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-3">
              <span>Similarity candidate retrieval: Cosine distance bounded by tenant scope</span>
              <span className="text-brand-400 font-mono">Threshold: 0.88</span>
            </div>
          </div>

          {/* Card 2: Cost-Aware Routing & Non-Authoritative Ledger */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Model Routing & Cost Safeguards</h3>
                <p className="text-xs text-slate-400">Complexity classification with reason codes</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Queries are classified prior to LLM invocation to balance quality and inference cost with an explicit reason trail:
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-850 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200">Small Model Path</span>
                  <p className="text-[11px] text-slate-400">mock-fast-small (e.g. lightweight model for direct QA)</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px]">
                  LOW_COMPLEXITY_DIRECT
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-850 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200">Large Model Path</span>
                  <p className="text-[11px] text-slate-400">mock-reasoning-large (deep multi-step reasoning)</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono text-[10px]">
                  REASONING_REQUIRED
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-850 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200">Deterministic Fallback</span>
                  <p className="text-[11px] text-slate-400">Automatic escalation if small provider errors or times out</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[10px]">
                  FALLBACK_RETRY
                </span>
              </div>
            </div>

            <div className="mt-4 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>Strict Rule: Estimated costs are labeled non-authoritative; no fictional savings invented.</span>
            </div>
          </div>
        </div>

        {/* Phase 0/1 Verified Deliverables */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <h3 className="text-base font-semibold text-white flex items-center space-x-2">
              <Code2 className="w-5 h-5 text-brand-400" />
              <span>Phase 0 & 1 Verification Summary</span>
            </h3>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              13/13 Pytest Suite Passing
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-mono">1. Architecture Decisions</span>
              <p className="text-slate-200 mt-1 font-medium">ADR-001 & Threat Model</p>
              <span className="text-[11px] text-slate-400 block mt-1">Written to docs/architecture and docs/threat-model.</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-mono">2. Configuration Validation</span>
              <p className="text-slate-200 mt-1 font-medium">Pydantic Settings & Masks</p>
              <span className="text-[11px] text-slate-400 block mt-1">Fails safely on invalid config; secrets masked.</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-mono">3. Health & Readiness</span>
              <p className="text-slate-200 mt-1 font-medium">/health/live & /health/ready</p>
              <span className="text-[11px] text-slate-400 block mt-1">Live process probe + deep dependency health checks.</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-mono">4. Provider Adapters</span>
              <p className="text-slate-200 mt-1 font-medium">Deterministic CI Mocks</p>
              <span className="text-[11px] text-slate-400 block mt-1">MockLLM & MockEmbedding with unit-norm vectors.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Placeholder views for subsequent phases
  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-8 shadow-xl backdrop-blur text-center max-w-2xl mx-auto my-12">
      <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Phase Sequenced for Review</h3>
      <p className="text-sm text-slate-400 mb-6 leading-relaxed">
        Per the project guidelines, CachePilot is built in controlled phases without one giant unreviewed change.
        Phase 0 (Architecture & Design) and Phase 1 (Backend Foundation & Frontend Shell) are complete and tested.
      </p>

      <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 text-left text-xs space-y-2 mb-6">
        <div className="font-semibold text-slate-300">Next Phase on Approval: Phase 2 — Baseline RAG Pipeline</div>
        <ul className="list-disc list-inside text-slate-400 space-y-1">
          <li>Document ingestion endpoint (<code className="text-brand-300">POST /api/v1/documents</code>)</li>
          <li>Chunking and deterministic 1536-dimensional vector embedding computation</li>
          <li>Grounded generation with citations and source references</li>
          <li>End-to-end query workflow answering questions with verified evidence</li>
        </ul>
      </div>

      <div className="inline-flex items-center space-x-2 text-xs font-medium text-brand-400 bg-brand-500/10 border border-brand-500/20 px-3.5 py-2 rounded-xl">
        <span>Awaiting user review of Phase 0/1 report before expanding scope</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </div>
  );
};
