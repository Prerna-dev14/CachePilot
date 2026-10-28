import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Upload,
  Send,
  Sparkles,
  Database,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  Cpu,
  Layers,
  Search,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type {
  DocumentSummary,
  DocumentIngestRequest,
  QueryRequest,
  QueryResponse,
} from '../types/api';

interface RAGStudioProps {
  selectedTenant: string;
}

export const RAGStudio = ({ selectedTenant }: RAGStudioProps) => {
  // Document Ingestion State
  const [docTitle, setDocTitle] = useState('');
  const [docScope, setDocScope] = useState('default');
  const [docContent, setDocContent] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  // Ingested Documents List State
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Query Execution State
  const [queryText, setQueryText] = useState('');
  const [topK, setTopK] = useState(3);
  const [bypassCache, setBypassCache] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [queryResponse, setQueryResponse] = useState<QueryResponse | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Fetch documents for the active tenant
  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await apiClient.listDocuments(selectedTenant);
      setDocuments(res.data);
    } catch {
      // Gracefully handle offline or network error
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Handle Ingest Submit
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) return;

    setIngesting(true);
    setIngestSuccess(null);
    setIngestError(null);

    const payload: DocumentIngestRequest = {
      title: docTitle.trim(),
      content: docContent.trim(),
      tenant_id: selectedTenant,
      security_scope: docScope,
      metadata: { source: 'rag_studio_ui' }
    };

    try {
      const res = await apiClient.ingestDocument(payload);
      setIngestSuccess(`Document ingested successfully: ${res.data.title} (${res.data.chunk_count} chunks, ID: ${res.data.document_id})`);
      setDocTitle('');
      setDocContent('');
      await loadDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ingestion failed';
      setIngestError(msg);
    } finally {
      setIngesting(false);
    }
  };

  // Preset Template Loader
  const loadPreset = (preset: 'security' | 'retention' | 'routing') => {
    if (preset === 'security') {
      setDocTitle('CachePilot Scope & Security Isolation Policy');
      setDocScope('default');
      setDocContent(
        'CachePilot enforces strict multi-tenant isolation across all vector indices and semantic cache storage. ' +
        'Each cache key and chunk embedding is partitioned by tenant identifier and authorization scope. ' +
        'A query originating from Tenant A can never retrieve or reuse cached answer entries generated for Tenant B, ' +
        'even when questions are semantically identical. Authorization boundary validation occurs at the query gateway before candidate vector retrieval.'
      );
    } else if (preset === 'retention') {
      setDocTitle('Enterprise Data Retention & Invalidation Guidelines');
      setDocScope('default');
      setDocContent(
        'All cached query responses are bound to a default Time-To-Live (TTL) of 24 hours. ' +
        'When underlying document corpora are updated or re-indexed, the corpus version increments automatically from v1.0.0 to subsequent semantic tags. ' +
        'Any change in corpus version, prompt template version, or embedding model immediately invalidates previous cache entries, ' +
        'preventing stale or outdated facts from being served to downstream consumers.'
      );
    } else {
      setDocTitle('Cost-Aware Model Routing Protocol');
      setDocScope('default');
      setDocContent(
        'The CachePilot intelligent routing engine classifies incoming queries by syntactical complexity, reasoning depth, and required context size. ' +
        'Simple factual queries and direct document lookup requests are routed to the small model (mock-fast-small) with route reason code LOW_COMPLEXITY_DIRECT. ' +
        'Complex multi-step reasoning queries requiring syntheses across documents are routed to the large frontier model (mock-reasoning-large) under code REASONING_REQUIRED. ' +
        'In the event of small model timeout or failure, the gateway executes deterministic fallback to the large model.'
      );
    }
  };

  // Handle Query Submit
  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;

    setQuerying(true);
    setQueryError(null);

    const payload: QueryRequest = {
      query: queryText.trim(),
      tenant_id: selectedTenant,
      security_scope: docScope,
      top_k: topK,
      bypass_cache: bypassCache,
    };

    try {
      const res = await apiClient.executeQuery(payload);
      setQueryResponse(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Query execution failed';
      setQueryError(msg);
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Studio Banner */}
      <div className="bg-gradient-to-r from-brand-900/40 via-slate-900/60 to-indigo-950/40 border border-brand-500/20 rounded-2xl p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                <Database className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Phase 2: Baseline RAG Pipeline</h2>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                Active Slice
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-2 max-w-2xl leading-relaxed">
              Ingest enterprise documents, chunk text with bounded overlap, generate 1536-dimensional embeddings, and execute grounded queries with citation attribution and latency telemetry.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <span className="text-xs text-slate-400 font-mono">Active Tenant:</span>
            <span className="text-xs font-mono text-brand-300 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-lg shadow-inner">
              {selectedTenant}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Ingestion & Corpus Explorer (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Document Ingestion Form */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Upload className="w-4 h-4 text-brand-400" />
                <span>Ingest Knowledge Document</span>
              </h3>
              <div className="flex items-center space-x-1">
                <span className="text-[10px] text-slate-400">Presets:</span>
                <button
                  type="button"
                  onClick={() => loadPreset('security')}
                  className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-700 transition"
                >
                  Security
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset('retention')}
                  className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-700 transition"
                >
                  Retention
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset('routing')}
                  className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-700 transition"
                >
                  Routing
                </button>
              </div>
            </div>

            <form onSubmit={handleIngest} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Financial Report or Security Policy"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 transition placeholder:text-slate-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Security Scope</label>
                <select
                  value={docScope}
                  onChange={(e) => setDocScope(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 transition cursor-pointer"
                >
                  <option value="default">default (Standard Tenant Scope)</option>
                  <option value="confidential">confidential (Isolated Boundary)</option>
                  <option value="restricted">restricted (Executive Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Content Body</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Paste raw text or documentation here. It will be chunked into overlapping segments with vector embeddings..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-brand-500 transition placeholder:text-slate-600 font-mono leading-relaxed"
                />
              </div>

              {ingestSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{ingestSuccess}</span>
                </div>
              )}

              {ingestError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{ingestError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={ingesting || !docTitle.trim() || !docContent.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs shadow-lg shadow-brand-500/20 flex items-center justify-center space-x-2 transition active:scale-98 disabled:opacity-50"
              >
                <Upload className={`w-3.5 h-3.5 ${ingesting ? 'animate-bounce' : ''}`} />
                <span>{ingesting ? 'Chunking & Embedding...' : 'Ingest to Corpus'}</span>
              </button>
            </form>
          </div>

          {/* Ingested Documents List Table */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Corpus Documents</span>
              </h3>
              <span className="text-xs font-mono text-slate-400 bg-slate-850 px-2 py-0.5 rounded-md border border-slate-800">
                {documents.length} in {selectedTenant}
              </span>
            </div>

            <div className="mt-3 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {loadingDocs ? (
                <div className="text-center py-6 text-xs text-slate-400">Loading corpus...</div>
              ) : documents.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No documents in scope. Ingest one above or run seed script.
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.document_id}
                    className="p-3 rounded-xl bg-slate-850 border border-slate-800/80 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-semibold text-xs text-slate-200 line-clamp-1">{doc.title}</span>
                      <span className="text-[10px] font-mono text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20 flex-shrink-0 ml-2">
                        {doc.chunk_count} {doc.chunk_count === 1 ? 'chunk' : 'chunks'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>ID: {doc.document_id}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{doc.security_scope}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Grounded Query Console & Citations (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Query Console Form */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Search className="w-4 h-4 text-emerald-400" />
                <span>Grounded RAG Query Console</span>
              </h3>
              <div className="flex items-center space-x-3 text-xs">
                <label className="flex items-center space-x-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={bypassCache}
                    onChange={(e) => setBypassCache(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Bypass Cache</span>
                </label>
              </div>
            </div>

            <form onSubmit={handleQuery} className="mt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">User Question</label>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-400">Top-K Chunks: {topK}</span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={topK}
                      onChange={(e) => setTopK(Number(e.target.value))}
                      className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                    />
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="Ask a question grounded in the ingested documents..."
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-brand-500 transition placeholder:text-slate-600 font-sans"
                  />
                  <button
                    type="submit"
                    disabled={querying || !queryText.trim()}
                    className="absolute right-2.5 bottom-2.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium flex items-center space-x-1.5 shadow-md shadow-brand-500/20 disabled:opacity-40 transition active:scale-95"
                  >
                    <Send className={`w-3.5 h-3.5 ${querying ? 'animate-pulse' : ''}`} />
                    <span>{querying ? 'Generating...' : 'Run Query'}</span>
                  </button>
                </div>
              </div>

              {/* Sample Question Shortcuts */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-mono">Sample Questions:</span>
                <button
                  type="button"
                  onClick={() => setQueryText('How are stale cache entries handled when documents change?')}
                  className="text-[10px] px-2.5 py-1 rounded-md bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 transition"
                >
                  Stale Cache Invalidation
                </button>
                <button
                  type="button"
                  onClick={() => setQueryText('What is the CachePilot multi-tenant security policy?')}
                  className="text-[10px] px-2.5 py-1 rounded-md bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 transition"
                >
                  Tenant Security Boundary
                </button>
                <button
                  type="button"
                  onClick={() => setQueryText('How does the cost-aware model routing engine classify queries?')}
                  className="text-[10px] px-2.5 py-1 rounded-md bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 transition"
                >
                  Cost Routing Protocol
                </button>
              </div>
            </form>

            {queryError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{queryError}</span>
              </div>
            )}
          </div>

          {/* Query Response & Grounded Answer */}
          {queryResponse && (
            <div className="space-y-4">
              {/* Grounded Answer Card */}
              <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-brand-400" />
                    <span className="text-xs font-semibold text-white">Grounded Answer</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Trace: {queryResponse.request_id}
                  </span>
                </div>

                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-sans">
                  {queryResponse.answer}
                </div>

                {/* Telemetry Indicator Strip */}
                <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Cache Status</span>
                    <span className="text-amber-400 font-semibold">{queryResponse.telemetry.cache_status}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase flex items-center space-x-1">
                      <Cpu className="w-3 h-3 text-indigo-400" />
                      <span>Route</span>
                    </span>
                    <span className="text-indigo-300 font-semibold">{queryResponse.telemetry.route}</span>
                    <span className="block text-[9px] text-slate-400 truncate mt-0.5">{queryResponse.telemetry.route_reason}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase flex items-center space-x-1">
                      <Coins className="w-3 h-3 text-emerald-400" />
                      <span>Est. Cost</span>
                    </span>
                    <span className="text-emerald-400 font-semibold">${queryResponse.telemetry.estimated_cost_usd.toFixed(6)}</span>
                    <span className="block text-[9px] text-slate-400 mt-0.5">Non-authoritative</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-brand-400" />
                      <span>Latencies</span>
                    </span>
                    <span className="text-brand-300 font-semibold">{queryResponse.telemetry.latencies_ms.total}ms</span>
                    <span className="block text-[9px] text-slate-400 mt-0.5">
                      R: {queryResponse.telemetry.latencies_ms.retrieval}ms | G: {queryResponse.telemetry.latencies_ms.generation}ms
                    </span>
                  </div>
                </div>
              </div>

              {/* Retrieved Chunks & Citations */}
              <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="text-xs font-semibold text-white flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>Evidence Citations ({queryResponse.citations.length} Chunks Retrieved)</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">pgvector Cosine Match</span>
                </div>

                <div className="mt-4 space-y-3">
                  {queryResponse.citations.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">No matching evidence chunks found.</div>
                  ) : (
                    queryResponse.citations.map((c, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-brand-300 line-clamp-1">{c.document_title || c.document_id}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Similarity: {(c.score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-slate-300 font-mono text-[11px] leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                          "{c.text_snippet}"
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>Chunk ID: {c.chunk_id}</span>
                          <span>Doc ID: {c.document_id}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
