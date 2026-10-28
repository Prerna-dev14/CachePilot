import { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Cpu,
  Zap,
  Activity,
  Layers,
  Search,
  RefreshCw,
  Clock,
  Coins,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  Sliders,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type {
  ClassifyQueryResponse,
  RequestLedgerEntry,
  RequestLedgerDetail,
  MetricsSummary,
} from '../types/api';

interface RoutingLedgerStudioProps {
  selectedTenant: string;
}

const SAMPLE_QUERIES = [
  {
    label: 'Direct Lookup',
    query: 'What is the default data retention period?',
    type: 'small',
  },
  {
    label: 'Comparative Tradeoffs',
    query: 'Compare the tradeoffs between Redis exact caching and pgvector semantic retrieval.',
    type: 'large',
  },
  {
    label: 'Analytical Root Cause',
    query: 'Why did the cluster latency spike? Explain the rationale and root cause step by step.',
    type: 'large',
  },
  {
    label: 'Quantitative Math',
    query: 'Calculate the total sum and percentage ratio of quarterly capital expenditures.',
    type: 'large',
  },
];

export const RoutingLedgerStudio = ({ selectedTenant }: RoutingLedgerStudioProps) => {
  // Classifier Simulator State
  const [testQuery, setTestQuery] = useState('Compare the tradeoffs between Redis exact caching and pgvector semantic retrieval.');
  const [contextTokens, setContextTokens] = useState<number>(250);
  const [classifyResult, setClassifyResult] = useState<ClassifyQueryResponse | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Ledger & Metrics State
  const [ledgerEntries, setLedgerEntries] = useState<RequestLedgerEntry[]>([]);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [requestDetail, setRequestDetail] = useState<RequestLedgerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Evaluate query complexity
  const handleEvaluate = useCallback(async (queryToEval?: string) => {
    const q = queryToEval || testQuery;
    if (!q.trim()) return;
    setEvaluating(true);
    setEvalError(null);
    try {
      const res = await apiClient.classifyQuery({
        query: q,
        context_token_estimate: contextTokens,
        tenant_id: selectedTenant,
      });
      setClassifyResult(res.data);
    } catch (err: unknown) {
      setEvalError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  }, [testQuery, contextTokens, selectedTenant]);

  // Load ledger and metrics summary
  const loadLedgerData = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const [ledgerRes, metricsRes] = await Promise.all([
        apiClient.listLedgerRequests(selectedTenant, 50),
        apiClient.getMetricsSummary(),
      ]);
      setLedgerEntries(ledgerRes.data);
      setMetrics(metricsRes.data);
    } catch {
      setLedgerEntries([]);
      setMetrics({
        total_requests: 0,
        cache_hits: 0,
        cache_hit_rate: 0,
        estimated_total_cost_usd: 0,
        p50_latency_ms: 0,
        p95_latency_ms: 0,
        model_distribution: {},
      });
    } finally {
      setLoadingLedger(false);
    }
  }, [selectedTenant]);

  // Drilldown into request detail
  const handleSelectRequest = async (requestId: string) => {
    setSelectedRequestId(requestId);
    setLoadingDetail(true);
    try {
      const res = await apiClient.getLedgerRequestDetail(requestId);
      setRequestDetail(res.data);
    } catch {
      setRequestDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    handleEvaluate();
    loadLedgerData();
  }, [handleEvaluate, loadLedgerData]);

  const threshold = classifyResult?.threshold ?? 0.65;
  const score = classifyResult?.complexity_score ?? 0;
  const isLarge = (classifyResult?.selected_tier === 'large');

  return (
    <div className="space-y-6">
      {/* Top Banner with Billing Warning */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              Cost-Aware Model Router & Usage Ledger
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Phase 4 Active
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Deterministic complexity scoring, multi-tier routing policy, and telemetry audit ledger.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
          <Coins className="w-4 h-4 shrink-0" />
          <span>non-authoritative billing estimate (is_authoritative_billing: false)</span>
        </div>
      </div>

      {/* Metrics Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Total Requests
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            {metrics?.total_requests ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {metrics?.cache_hits ?? 0} cached hits
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            Cache Hit Rate
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {((metrics?.cache_hit_rate ?? 0) * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Avoids model invocation
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            Estimated Cost
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            ${(metrics?.estimated_total_cost_usd ?? 0).toFixed(5)}
          </div>
          <div className="text-[11px] text-amber-400/70 mt-0.5">
            Estimated USD
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            Latency Profile
          </div>
          <div className="text-2xl font-bold text-purple-300 font-mono">
            {metrics?.p50_latency_ms?.toFixed(0) ?? 0}
            <span className="text-xs font-normal text-slate-500 ml-1">ms (p50)</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
            p95: {metrics?.p95_latency_ms?.toFixed(0) ?? 0}ms
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 col-span-2 md:col-span-1">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            Model Distribution
          </div>
          <div className="text-xs text-slate-300 font-mono space-y-0.5 mt-1">
            <div className="flex justify-between">
              <span className="text-emerald-400">mock-fast-small:</span>
              <span>{metrics?.model_distribution?.['mock-fast-small'] ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-400">mock-reasoning:</span>
              <span>{metrics?.model_distribution?.['mock-reasoning-large'] ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Grid: Complexity Simulator & Routing Policy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Complexity Classification Simulator (7 cols) */}
        <div className="lg:col-span-7 space-y-4 p-5 rounded-xl bg-slate-900/40 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-slate-200">Query Complexity Simulator</h3>
            </div>
            <span className="text-xs text-slate-400">Policy Threshold: <strong className="text-slate-200 font-mono">{threshold}</strong></span>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUERIES.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTestQuery(item.query);
                  handleEvaluate(item.query);
                }}
                className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                  testQuery === item.query
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-medium'
                    : 'bg-slate-800/40 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Input text */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Inspect Routing for Query:</label>
            <textarea
              rows={2}
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Type any test query to simulate complexity routing..."
              className="w-full text-xs p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors font-mono resize-none"
            />
          </div>

          {/* Context Token Estimate Slider */}
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-slate-950/40 border border-slate-800/60">
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-slate-300">Context Token Estimate</div>
              <div className="text-[11px] text-slate-500">Heavier context adds complexity pressure</div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="2000"
                step="50"
                value={contextTokens}
                onChange={(e) => setContextTokens(Number(e.target.value))}
                className="w-32 accent-indigo-500 cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-slate-300 w-12 text-right">
                {contextTokens}t
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => handleEvaluate()}
              disabled={evaluating || !testQuery.trim()}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {evaluating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  Evaluate Complexity
                </>
              )}
            </button>
          </div>

          {evalError && (
            <div className="p-3 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{evalError}</span>
            </div>
          )}

          {/* Classification Result Meter & Signals */}
          {classifyResult && (
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Normalized Complexity Score:</span>
                <span className="font-mono font-bold text-sm text-slate-100">
                  {score.toFixed(3)}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / 1.0 (Threshold: {threshold})
                  </span>
                </span>
              </div>

              {/* Progress Bar with Threshold Marker */}
              <div className="relative w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isLarge ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, score * 100))}%` }}
                />
                {/* Threshold vertical line indicator */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 shadow-[0_0_8px_#fbbf24]"
                  style={{ left: `${threshold * 100}%` }}
                  title={`Threshold: ${threshold}`}
                />
              </div>

              {/* Selected Route & Reason Badge */}
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Cpu className={`w-5 h-5 ${isLarge ? 'text-purple-400' : 'text-emerald-400'}`} />
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      Selected Route: <span className="font-mono text-indigo-400">{classifyResult.selected_model}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Tier: {classifyResult.selected_tier.toUpperCase()} | Reason: {classifyResult.reason_code}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-md font-mono border ${
                    isLarge
                      ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {isLarge ? 'REASONING_REQUIRED' : 'LOW_COMPLEXITY_DIRECT'}
                </span>
              </div>

              {/* Detected Signals List */}
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-slate-400">Triggered Analysis Signals:</div>
                <div className="flex flex-wrap gap-1.5">
                  {classifyResult.detected_signals.map((sig, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                      {sig}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Routing Policy & Rate Card (5 cols) */}
        <div className="lg:col-span-5 space-y-4 p-5 rounded-xl bg-slate-900/40 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200">Cost-Aware Rate Card</h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Requests under the threshold (<span className="text-emerald-400 font-mono">&lt; {threshold}</span>) are routed to the small model to maximize cost efficiency. Complex reasoning triggers select the larger model.
          </p>

          <div className="space-y-3">
            {/* Small model card */}
            <div className="p-3 rounded-lg bg-slate-950/50 border border-emerald-500/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-300 font-mono">mock-fast-small</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                  Tier: SMALL
                </span>
              </div>
              <div className="grid grid-cols-2 text-xs text-slate-400 font-mono pt-1">
                <div>Input: <strong className="text-slate-200">$0.0000005</strong> / tok</div>
                <div>Output: <strong className="text-slate-200">$0.0000015</strong> / tok</div>
              </div>
              <div className="text-[11px] text-slate-500">
                Direct lookups, short questions, and factual queries.
              </div>
            </div>

            {/* Large model card */}
            <div className="p-3 rounded-lg bg-slate-950/50 border border-purple-500/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="text-xs font-semibold text-purple-300 font-mono">mock-reasoning-large</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono border border-purple-500/20">
                  Tier: LARGE
                </span>
              </div>
              <div className="grid grid-cols-2 text-xs text-slate-400 font-mono pt-1">
                <div>Input: <strong className="text-slate-200">$0.0000050</strong> / tok</div>
                <div>Output: <strong className="text-slate-200">$0.0000150</strong> / tok</div>
              </div>
              <div className="text-[11px] text-slate-500">
                Comparative analysis, multi-step deductions, and arithmetic calculations.
              </div>
            </div>

            {/* Deterministic Fallback card */}
            <div className="p-3 rounded-lg bg-slate-950/50 border border-amber-500/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Deterministic Fallback
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20">
                  FALLBACK_RETRY
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                If the fast small model fails or times out, the pipeline automatically recovers by re-invoking the reasoning large model with reason code <code className="text-amber-300">FALLBACK_RETRY</code>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Usage Ledger Table */}
      <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Per-Request Telemetry & Usage Ledger
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {ledgerEntries.length} entries
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadLedgerData}
              disabled={loadingLedger}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLedger ? 'animate-spin' : ''}`} />
              Refresh Ledger
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Request ID</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Query</th>
                <th className="py-2.5 px-3">Cache</th>
                <th className="py-2.5 px-3">Route Tier</th>
                <th className="py-2.5 px-3 text-right">Tokens</th>
                <th className="py-2.5 px-3 text-right">Est. Cost (USD)</th>
                <th className="py-2.5 px-3 text-right">Latency</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500">
                    No ledger entries recorded yet. Execute queries in the RAG Studio or test complexity above.
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => handleSelectRequest(entry.request_id)}
                  >
                    <td className="py-2.5 px-3 text-indigo-400 font-bold truncate max-w-[120px]">
                      {entry.request_id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 font-sans max-w-[200px] truncate" title={entry.query_text}>
                      {entry.query_text}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          entry.cache_status === 'hit_exact'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : entry.cache_status === 'hit_semantic'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : entry.cache_status === 'bypass'
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {entry.cache_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            entry.route === 'large'
                              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                              : entry.route === 'cache'
                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {entry.route}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {entry.route_reason}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {entry.total_tokens}{' '}
                      <span className="text-[10px] text-slate-500">({entry.prompt_tokens}+{entry.completion_tokens})</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-400 font-bold">
                      ${entry.estimated_cost_usd.toFixed(6)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {entry.latency_total_ms.toFixed(0)}ms
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRequest(entry.request_id);
                        }}
                        className="text-xs px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drilldown Diagnostics Modal */}
      {selectedRequestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-100">
                  Request Diagnostics & Telemetry
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRequestId(null);
                  setRequestDetail(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="py-12 flex justify-center items-center text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading diagnostics...</span>
              </div>
            ) : requestDetail ? (
              <div className="space-y-4 text-xs">
                {/* Non-Authoritative Warning Banner */}
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-2">
                  <Coins className="w-4 h-4 shrink-0" />
                  <span>
                    Non-authoritative cost estimate: Calculated via token usage rates. Not for formal customer billing.
                  </span>
                </div>

                {/* Primary Meta Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-[11px] text-slate-500">Request ID</div>
                    <div className="font-mono font-bold text-indigo-400 mt-0.5 truncate">
                      {requestDetail.ledger_entry.request_id}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-[11px] text-slate-500">Tenant / Scope</div>
                    <div className="font-mono text-slate-300 mt-0.5">
                      {requestDetail.ledger_entry.tenant_id} / {requestDetail.ledger_entry.security_scope}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-[11px] text-slate-500">Cache Status</div>
                    <div className="font-mono text-emerald-400 mt-0.5">
                      {requestDetail.ledger_entry.cache_status}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-[11px] text-slate-500">Est. Total Cost</div>
                    <div className="font-mono text-amber-400 font-bold mt-0.5">
                      ${requestDetail.ledger_entry.estimated_cost_usd.toFixed(6)}
                    </div>
                  </div>
                </div>

                {/* Query details */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="text-slate-400 font-medium">Query Text:</div>
                  <p className="text-slate-200 font-mono text-[11px] bg-slate-900 p-2 rounded border border-slate-800">
                    {requestDetail.ledger_entry.query_text}
                  </p>
                </div>

                {/* Latency Waterfall Breakdown */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-slate-400 font-medium flex items-center justify-between">
                    <span>Latency Waterfall (Total: {requestDetail.ledger_entry.latency_total_ms.toFixed(1)}ms):</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-300">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                      <div className="text-slate-500 text-[10px]">Cache Lookup</div>
                      <div className="text-blue-400 font-bold">{requestDetail.ledger_entry.latency_cache_ms.toFixed(1)}ms</div>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                      <div className="text-slate-500 text-[10px]">Retrieval (pgvector)</div>
                      <div className="text-cyan-400 font-bold">{requestDetail.ledger_entry.latency_retrieval_ms.toFixed(1)}ms</div>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                      <div className="text-slate-500 text-[10px]">LLM Generation</div>
                      <div className="text-purple-400 font-bold">{requestDetail.ledger_entry.latency_generation_ms.toFixed(1)}ms</div>
                    </div>
                  </div>
                </div>

                {/* Model Usage Audit Records */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-slate-400 font-medium">
                    Model Invocation Records ({requestDetail.model_usages.length}):
                  </div>
                  {requestDetail.model_usages.length === 0 ? (
                    <p className="text-slate-500 italic py-2">
                      No model invocation required (served directly from cache or direct bypass).
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {requestDetail.model_usages.map((usage) => (
                        <div
                          key={usage.id}
                          className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-indigo-400 font-bold">{usage.model_name}</span>
                            <span className="text-slate-400">{usage.provider_name}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-slate-400 pt-1">
                            <div>Tokens: {usage.total_tokens} ({usage.prompt_tokens} in / {usage.completion_tokens} out)</div>
                            <div>Latency: {usage.latency_ms.toFixed(1)}ms</div>
                            <div className="text-right text-amber-400 font-bold">Cost: ${usage.estimated_cost_usd.toFixed(6)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center py-6 text-slate-500">Record not found.</p>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedRequestId(null);
                  setRequestDetail(null);
                }}
                className="px-4 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
