import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import type { TabKey } from './components/Navigation';
import { SystemHealthCard } from './components/SystemHealthCard';
import { PhaseShell } from './components/PhaseShell';
import { RAGStudio } from './components/RAGStudio';
import { apiClient } from './services/apiClient';
import type { HealthLiveResponse, HealthReadyResponse } from './types/api';
import { FileText, BookOpen } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('foundation');
  const [selectedTenant, setSelectedTenant] = useState<string>('tenant-default');
  const [liveData, setLiveData] = useState<HealthLiveResponse | null>(null);
  const [readyData, setReadyData] = useState<HealthReadyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [correlationId, setCorrelationId] = useState<string>('');

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [liveRes, readyRes] = await Promise.all([
        apiClient.getHealthLive(),
        apiClient.getHealthReady()
      ]);
      setLiveData(liveRes.data);
      setReadyData(readyRes.data);
      setCorrelationId(readyRes.requestId);
      setLatencyMs(Math.max(liveRes.latencyMs, readyRes.latencyMs));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reach CachePilot backend';
      setError(msg);
      // Graceful local status representation
      setLiveData({
        status: 'standby',
        service: 'cachepilot',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
      setReadyData({
        status: 'degraded',
        dependencies: {
          database: { status: 'unhealthy', error: 'Postgres not running or connecting' },
          redis: { status: 'fallback_in_memory', mode: 'in_memory' }
        },
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const isLive = liveData?.status === 'healthy';
  const isReady = readyData?.status === 'ready';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Header */}
      <Header
        isLive={isLive}
        isReady={isReady}
        correlationId={correlationId}
        selectedTenant={selectedTenant}
        onTenantChange={setSelectedTenant}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs */}
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* System Health Probe Summary (Always observable on top of shell) */}
        <SystemHealthCard
          liveData={liveData}
          readyData={readyData}
          loading={loading}
          error={error}
          onRefresh={fetchHealth}
          latencyMs={latencyMs}
        />

        {/* Phase-specific vertical view */}
        {activeTab === 'rag' ? (
          <RAGStudio selectedTenant={selectedTenant} />
        ) : (
          <PhaseShell activeTab={activeTab} selectedTenant={selectedTenant} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-300">CachePilot (CPilot)</span>
            <span>—</span>
            <span>Semantic Caching & Cost-Aware Routing Gateway</span>
          </div>

          <div className="flex items-center space-x-6">
            <span className="flex items-center space-x-1 hover:text-slate-200 transition cursor-pointer">
              <FileText className="w-3.5 h-3.5 text-brand-400" />
              <span>docs/architecture/ADR-001</span>
            </span>
            <span className="flex items-center space-x-1 hover:text-slate-200 transition cursor-pointer">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>docs/threat-model</span>
            </span>
            <span className="text-slate-400">
              Version 1.0.0 (Phase 0/1)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
