import React from 'react';
import {
  LayoutDashboard,
  LineChart,
  Ship,
  Anchor,
  Calculator,
  Compass,
  FileCheck2,
  SlidersHorizontal,
  ShieldAlert,
  MapPin,
  Leaf,
  History,
  Database,
  BarChart3,
  Settings,
  Globe2,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ViewTab =
  | 'executive'
  | 'market'
  | 'forecast'
  | 'vessels'
  | 'feasibility'
  | 'voyage_cost'
  | 'contract_optimizer'
  | 'digital_twin'
  | 'scenario_lab'
  | 'risk_centre'
  | 'route_optimizer'
  | 'esg'
  | 'decision_memory'
  | 'data_centre'
  | 'model_performance'
  | 'settings';

interface NavigationProps {
  currentView: ViewTab;
  onSelectView: (view: ViewTab) => void;
  hasActiveResult: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onSelectView,
  hasActiveResult,
}) => {
  const { currentUser, logout } = useAuth();
  const navItems: { id: ViewTab; label: string; icon: any; badge?: string; group: string }[] = [
    // Decision & Core Group
    { id: 'executive', label: 'Executive Dashboard', icon: LayoutDashboard, group: 'Decisions' },
    { id: 'contract_optimizer', label: 'Contract Optimizer', icon: FileCheck2, badge: 'CORE', group: 'Decisions' },
    { id: 'forecast', label: 'Freight Forecast', icon: LineChart, group: 'Decisions' },
    { id: 'voyage_cost', label: 'Voyage Cost Engine', icon: Calculator, group: 'Decisions' },

    // Physical Feasibility & Fleet
    { id: 'vessels', label: 'Vessel Optimizer', icon: Ship, group: 'Fleet & Ports' },
    { id: 'feasibility', label: 'Port Feasibility', icon: Anchor, group: 'Fleet & Ports' },
    { id: 'route_optimizer', label: 'Alternative Ports', icon: MapPin, group: 'Fleet & Ports' },
    { id: 'risk_centre', label: 'Risk Centre', icon: ShieldAlert, group: 'Fleet & Ports' },

    // Simulation & Advanced Innovation
    { id: 'digital_twin', label: 'Digital Twin', icon: Compass, badge: 'SIM', group: 'Innovation' },
    { id: 'scenario_lab', label: 'Scenario Lab (What-If)', icon: SlidersHorizontal, group: 'Innovation' },
    { id: 'esg', label: 'ESG / Carbon', icon: Leaf, group: 'Innovation' },
    { id: 'market', label: 'Market Intelligence', icon: Globe2, group: 'Innovation' },

    // Governance & Data
    { id: 'decision_memory', label: 'Decision Memory', icon: History, group: 'Intelligence' },
    { id: 'data_centre', label: 'Data Centre', icon: Database, group: 'Intelligence' },
    { id: 'model_performance', label: 'Model Performance', icon: BarChart3, group: 'Intelligence' },
    { id: 'settings', label: 'Settings & APIs', icon: Settings, group: 'Intelligence' },
  ];

  return (
    <nav className="bg-slate-900/90 border-r border-slate-800 w-64 shrink-0 flex flex-col justify-between overflow-y-auto scrollbar-thin text-slate-300">
      <div className="p-3 space-y-4">
        {/* Navigation Categories */}
        {['Decisions', 'Fleet & Ports', 'Innovation', 'Intelligence'].map((group) => {
          const items = navItems.filter((i) => i.group === group);
          return (
            <div key={group} className="space-y-1">
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {group}
              </div>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-item-${item.id}`}
                    onClick={() => onSelectView(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-900/40'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isActive
                            ? 'bg-blue-800 text-blue-100'
                            : 'bg-slate-800 text-cyan-400 border border-cyan-800/40'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* System Status footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400 space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Optimization Engine:</span>
          <span className="text-emerald-400 font-mono font-medium">READY</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Time-Series ML:</span>
          <span className="text-cyan-400 font-mono font-medium">Ensemble 83.6%</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Rules Constraint:</span>
          <span className="text-indigo-400 font-mono font-medium">Deterministic</span>
        </div>

        {currentUser && (
          <div className="pt-2 mt-2 border-t border-slate-800/80">
            <button
              id="btn-nav-signout"
              onClick={logout}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/50 text-xs transition cursor-pointer"
            >
              <span className="truncate text-[11px] font-medium">
                {currentUser.displayName || 'Authorized Operator'}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-rose-400 font-semibold">
                <LogOut className="w-3 h-3" />
                Sign Out
              </span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
