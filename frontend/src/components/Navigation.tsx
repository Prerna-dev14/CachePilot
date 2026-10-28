import { Layers, Database, Compass, BarChart3, TestTube2, Server } from 'lucide-react';

export type TabKey = 'foundation' | 'rag' | 'cache' | 'routing' | 'dashboard' | 'evaluation';

interface NavigationProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    {
      key: 'foundation' as TabKey,
      label: 'Phase 0/1: System Foundation',
      icon: Server,
      badge: 'Active & Verified',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      ready: true,
    },
    {
      key: 'rag' as TabKey,
      label: 'Phase 2: Baseline RAG',
      icon: Database,
      badge: 'Active & Verified',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      ready: true,
    },
    {
      key: 'cache' as TabKey,
      label: 'Phase 3: Semantic Cache',
      icon: Layers,
      badge: 'Active & Verified',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      ready: true,
    },
    {
      key: 'routing' as TabKey,
      label: 'Phase 4: Cost Router',
      icon: Compass,
      badge: 'Planned',
      badgeColor: 'bg-slate-700/50 text-slate-400 border-slate-700',
      ready: false,
    },
    {
      key: 'dashboard' as TabKey,
      label: 'Phase 5: Telemetry Ledger',
      icon: BarChart3,
      badge: 'Planned',
      badgeColor: 'bg-slate-700/50 text-slate-400 border-slate-700',
      ready: false,
    },
    {
      key: 'evaluation' as TabKey,
      label: 'Phase 6: Quality Benchmarks',
      icon: TestTube2,
      badge: 'Planned',
      badgeColor: 'bg-slate-700/50 text-slate-400 border-slate-700',
      ready: false,
    },
  ];

  return (
    <nav className="flex space-x-2 border-b border-slate-800 pb-3 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap border ${
              isActive
                ? 'bg-brand-600/15 border-brand-500/40 text-brand-300 shadow-sm shadow-brand-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
            <span>{tab.label}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${tab.badgeColor}`}>
              {tab.badge}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
