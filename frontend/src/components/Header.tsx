import { Cpu, ShieldCheck, Terminal } from 'lucide-react';

interface HeaderProps {
  isLive: boolean;
  isReady: boolean;
  correlationId: string;
  selectedTenant: string;
  onTenantChange: (tenant: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isLive,
  isReady,
  correlationId,
  selectedTenant,
  onTenantChange
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-white tracking-tight">CachePilot</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-mono">
                Phase 0/1 Verified
              </span>
            </div>
            <p className="text-xs text-slate-400">Semantic Caching & Cost-Aware Routing RAG</p>
          </div>
        </div>

        {/* Right status & tenant controls */}
        <div className="flex items-center space-x-4">
          {/* Tenant Selector */}
          <div className="hidden sm:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Tenant Scope:</span>
            <select
              value={selectedTenant}
              onChange={(e) => onTenantChange(e.target.value)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="tenant-default" className="bg-slate-900">tenant-default</option>
              <option value="tenant-finance" className="bg-slate-900">tenant-finance (Isolated)</option>
              <option value="tenant-healthcare" className="bg-slate-900">tenant-healthcare (HIPAA)</option>
            </select>
          </div>

          {/* Trace Correlation Badge */}
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800/40 border border-slate-700/40 text-xs font-mono text-slate-400">
            <Terminal className="w-3.5 h-3.5 text-brand-400" />
            <span className="truncate max-w-[120px]" title={correlationId}>
              {correlationId || 'no-trace'}
            </span>
          </div>

          {/* Live & Ready Pulses */}
          <div className="flex items-center space-x-3 bg-slate-850 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300">Live</span>
            </div>
            <div className="w-px h-3 bg-slate-700" />
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-slate-300">Ready</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
