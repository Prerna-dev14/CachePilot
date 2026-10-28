import { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Sparkles,
  Zap,
  Trash2,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Coins,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { CacheEntrySchema, CacheMetrics } from '../types/api';

interface SemanticCacheExplorerProps {
  selectedTenant: string;
}

export const SemanticCacheExplorer = ({ selectedTenant }: SemanticCacheExplorerProps) => {
  const [entries, setEntries] = useState<CacheEntrySchema[]>([]);
  const [metrics, setMetrics] = useState<CacheMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [invalidating, setInvalidating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [simThreshold, setSimThreshold] = useState<number>(0.88);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const loadCacheData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, metricsRes] = await Promise.all([
        apiClient.getCacheEntries(selectedTenant),
        apiClient.getCacheMetrics(),
      ]);
      setEntries(entriesRes.data);
      setMetrics(metricsRes.data);
    } catch {
      setEntries([]);
      setMetrics({
        total_entries: 0,
        exact_hit_count: 0,
        semantic_hit_count: 0,
        miss_count: 0,
        bypass_count: 0,
        hit_rate_percentage: 0.0,
        estimated_cost_avoided_usd: 0.0,
        is_authoritative_billing: false,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    loadCacheData();
  }, [loadCacheData]);

  const handleInvalidateAll = async () => {
    setInvalidating(true);
    setStatusMessage(null);
    try {
      const res = await apiClient.invalidateCache({ tenant_id: selectedTenant });
      setStatusMessage(`Successfully invalidated ${res.data.invalidated_count} entries for ${selectedTenant}.`);
      await loadCacheData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalidation failed';
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setInvalidating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-brand-950/50 border border-indigo-500/20 rounded-2xl p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Layers className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Phase 3: Scope-Aware Semantic Cache</h2>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                Active & Verified
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-2 max-w-2xl leading-relaxed">
              Dual-tier caching architecture: Tier 1 exact-match hash lookup in Redis/In-Memory + Tier 2 cosine similarity candidate search in pgvector. Bounded by tenant security scope, TTL expiry, and corpus version tags.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadCacheData}
              disabled={loading}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : 'text-slate-400'}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleInvalidateAll}
              disabled={invalidating}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-medium transition active:scale-95 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{invalidating ? 'Purging...' : 'Purge Tenant Cache'}</span>
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs flex items-center space-x-3 border ${
          statusMessage.startsWith('Error')
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        }`}>
          {statusMessage.startsWith('Error') ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hit Rate */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl backdrop-blur flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Cache Hit Rate</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono">
              {metrics ? `${metrics.hit_rate_percentage.toFixed(1)}%` : '0.0%'}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {metrics ? `${metrics.exact_hit_count + metrics.semantic_hit_count} hits / ${metrics.exact_hit_count + metrics.semantic_hit_count + metrics.miss_count} queries` : '—'}
            </span>
          </div>
        </div>

        {/* Dual Tier Breakdown */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl backdrop-blur flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Dual-Tier Matches</span>
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-4">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Exact (Tier 1)</span>
              <span className="text-xl font-bold text-indigo-300 font-mono">{metrics?.exact_hit_count || 0}</span>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Semantic (Tier 2)</span>
              <span className="text-xl font-bold text-emerald-300 font-mono">{metrics?.semantic_hit_count || 0}</span>
            </div>
          </div>
        </div>

        {/* Cost Avoided */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl backdrop-blur flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Estimated Cost Avoided</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              ${metrics ? metrics.estimated_cost_avoided_usd.toFixed(6) : '0.000000'}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Non-authoritative estimate based on model token rates
            </span>
          </div>
        </div>

        {/* Active Cached Items */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl backdrop-blur flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Cached Entries</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono">
              {entries.length}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block font-mono">
              Scoped to {selectedTenant}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Simulator & Formula (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Threshold Simulator Card */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Similarity Threshold Simulator</h3>
                <p className="text-[11px] text-slate-400">Cosine threshold ($\tau$) sensitivity tuning</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-300">Target Threshold:</span>
                  <span className="text-xs font-mono font-bold text-brand-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                    $\tau$ = {simThreshold.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.99"
                  step="0.01"
                  value={simThreshold}
                  onChange={(e) => setSimThreshold(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>0.50 (Permissive)</span>
                  <span className="text-brand-300 font-semibold">0.88 (Default Safe)</span>
                  <span>0.99 (Strict)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-850 text-xs space-y-2">
                <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-brand-400" />
                  <span>Threshold Risk & Precision Analysis:</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {simThreshold >= 0.90 ? (
                    <span className="text-emerald-300">
                      <strong>Ultra-Conservative:</strong> Only queries with near-identical phrasing trigger semantic reuse. Minimizes hallucination risk, but yields a lower cache hit rate.
                    </span>
                  ) : simThreshold >= 0.82 ? (
                    <span className="text-brand-300">
                      <strong>CachePilot Production Default (0.88):</strong> Optimal equilibrium. Effectively absorbs natural user paraphrasing while strictly guarding semantic boundaries.
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      <strong>Aggressive Mode:</strong> High reuse rate, but carries risk of returning subtly divergent answers for nuance-heavy questions.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Cryptographic Key Formula Card */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center space-x-3 mb-3 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Scope & Freshness Partition</h3>
                <p className="text-[11px] text-slate-400">Guaranteed cross-tenant safety</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
              CachePilot ensures cached entries are never reused across incompatible authorization scopes or outdated corpus versions:
            </p>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 font-mono text-[11px] text-slate-300 space-y-1 overflow-x-auto">
              <div className="text-emerald-400">// Cache Key SHA-256 Factors</div>
              <div>1. tenant_id: <span className="text-brand-300">{selectedTenant}</span></div>
              <div>2. security_scope: <span className="text-brand-300">default</span></div>
              <div>3. normalized_query: <span className="text-slate-400">canonical_tokens</span></div>
              <div>4. corpus_version: <span className="text-indigo-300">v1.0.0</span></div>
              <div>5. prompt_version: <span className="text-indigo-300">v1.0.0</span></div>
              <div>6. ttl_seconds: <span className="text-amber-300">86400 (24h)</span></div>
            </div>
          </div>
        </div>

        {/* Right Column: Cached Question-Answer Entries Table (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-brand-400" />
                  <span>Scoped Cache Entries ({entries.length})</span>
                </h3>
                <span className="text-[11px] text-slate-400">Real-time cache state for {selectedTenant}</span>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-850 px-2.5 py-1 rounded-lg border border-slate-800">
                Corpus: v1.0.0
              </span>
            </div>

            <div className="mt-4 space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center py-12 text-xs text-slate-400">Inspecting cache storage...</div>
              ) : entries.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  No cached entries found in this scope. Run queries in the RAG Studio to populate the semantic cache.
                </div>
              ) : (
                entries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-semibold text-xs text-slate-200">"{entry.query_text}"</span>
                          <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                            Normalized: {entry.normalized_query}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20 whitespace-nowrap">
                          {entry.hit_count} {entry.hit_count === 1 ? 'Hit' : 'Hits'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-850">
                        <span>Key: {entry.cache_key.substring(0, 14)}...</span>
                        <span>Scope: {entry.security_scope}</span>
                        <button
                          onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                          className="text-brand-400 hover:text-brand-300 underline font-sans"
                        >
                          {isExpanded ? 'Hide Answer' : 'View Answer & Citations'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-850 space-y-2 text-xs">
                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 leading-relaxed font-sans">
                            <span className="font-semibold text-slate-200 block mb-1">Stored Grounded Answer:</span>
                            {entry.response_text}
                          </div>
                          {entry.citations.length > 0 && (
                            <div className="text-[11px] text-slate-400">
                              <span className="font-medium text-slate-300">Citations: </span>
                              {entry.citations.map((c) => c.document_title || c.document_id).join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
