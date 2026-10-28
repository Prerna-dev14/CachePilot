import { Database, Server, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import type { HealthLiveResponse, HealthReadyResponse } from '../types/api';

interface SystemHealthCardProps {
  liveData: HealthLiveResponse | null;
  readyData: HealthReadyResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  latencyMs: number;
}

export const SystemHealthCard: React.FC<SystemHealthCardProps> = ({
  liveData,
  readyData,
  loading,
  error,
  onRefresh,
  latencyMs
}) => {
  const dbStatus = readyData?.dependencies?.database;
  const redisStatus = readyData?.dependencies?.redis;

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800/80 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-white">System Infrastructure & Health Probes</h2>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Phase 1 Exit Gate
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time readiness validation for PostgreSQL (pgvector), Redis cache storage, and provider adapters.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : 'text-slate-400'}`} />
          <span>{loading ? 'Probing...' : 'Refresh Health'}</span>
          <span className="text-[10px] text-slate-400 font-mono">({latencyMs}ms)</span>
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <div>
            <span className="font-semibold">Backend Unreachable or Initializing:</span> {error}
            <div className="text-[11px] text-rose-400/80 mt-1">
              Ensure FastAPI backend is running via <code className="bg-rose-950/60 px-1 py-0.5 rounded">uvicorn backend.app.main:app</code>.
            </div>
          </div>
        </div>
      )}

      {/* Grid of health probe indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {/* Process Liveness */}
        <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Server className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-slate-200">Process Liveness</span>
            </div>
            {liveData?.status === 'healthy' ? (
              <span className="flex items-center space-x-1 text-xs text-emerald-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>200 OK</span>
              </span>
            ) : (
              <span className="text-xs text-amber-400 font-mono">Offline</span>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex justify-between font-mono">
            <span>Service: {liveData?.service || 'cachepilot'}</span>
            <span>v{liveData?.version || '1.0.0'}</span>
          </div>
        </div>

        {/* PostgreSQL + pgvector */}
        <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium text-slate-200">PostgreSQL</span>
                <span className="block text-[11px] text-slate-400">pgvector enabled</span>
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-mono border ${
              dbStatus?.status === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {dbStatus?.status || 'awaiting'}
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex justify-between font-mono">
            <span>Schema: 10 tables</span>
            <span>Latency: {dbStatus?.latency_ms !== undefined ? `${dbStatus.latency_ms}ms` : '—'}</span>
          </div>
        </div>

        {/* Redis Storage */}
        <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium text-slate-200">Cache Storage</span>
                <span className="block text-[11px] text-slate-400">Exact Match & TTL</span>
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-mono border ${
              redisStatus?.status === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            }`}>
              {redisStatus?.status === 'fallback_in_memory' ? 'In-Memory Fallback' : (redisStatus?.status || 'awaiting')}
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex justify-between font-mono">
            <span>Mode: {redisStatus?.mode || 'local'}</span>
            <span>Latency: {redisStatus?.latency_ms !== undefined ? `${redisStatus.latency_ms}ms` : '—'}</span>
          </div>
        </div>
      </div>

      {/* Safe Diagnostics Config Box */}
      {readyData?.config_summary && (
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Safe Configuration Diagnostics (Non-Sensitive)</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">No raw secrets or credentials exposed</span>
          </div>
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Default LLM</span>
              <span className="text-brand-300">{String(readyData.config_summary.default_llm_provider)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Embedding Model</span>
              <span className="text-brand-300">{String(readyData.config_summary.embedding_model_name)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Default Threshold</span>
              <span className="text-emerald-300">{String(readyData.config_summary.cache_similarity_threshold)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Corpus Version</span>
              <span className="text-indigo-300">{String(readyData.config_summary.corpus_version)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
