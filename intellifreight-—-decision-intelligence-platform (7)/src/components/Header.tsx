import React from 'react';
import { Ship, TrendingUp, AlertTriangle, Activity, LogOut, User as UserIcon } from 'lucide-react';
import { MarketIndices, LiveMarketIntelligenceSummary, DataProvenanceType } from '../types';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  marketIndices: MarketIndices;
  liveMarketSummary?: LiveMarketIntelligenceSummary | null;
  activeView: string;
  onRunDemo: () => void;
  isAnalyzing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  marketIndices,
  liveMarketSummary,
  activeView,
  onRunDemo,
  isAnalyzing,
}) => {
  const { currentUser, logout } = useAuth();
  const bdiObs = liveMarketSummary?.bdi;
  const bciObs = liveMarketSummary?.bci;
  const vlsfoObs = liveMarketSummary?.vlsfo;

  const renderMetricTag = (dataStatus?: DataProvenanceType, isLive?: boolean) => {
    if (!dataStatus || dataStatus === 'UNAVAILABLE') {
      return (
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60 font-semibold font-mono">
          UNAVAILABLE
        </span>
      );
    }
    if (dataStatus === 'REAL' && isLive) {
      return (
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-semibold font-mono">
          LIVE
        </span>
      );
    }
    if (dataStatus === 'STALE') {
      return (
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 font-semibold font-mono">
          STALE
        </span>
      );
    }
    if (dataStatus === 'SIMULATED' || (dataStatus as string) === 'PROXY') {
      return (
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950/80 text-blue-300 border border-blue-700/60 font-semibold font-mono">
          PROXY
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-semibold font-mono">
        {dataStatus}
      </span>
    );
  };

  const getFeedAggregate = () => {
    if (!liveMarketSummary) {
      return {
        label: 'FEED UNAVAILABLE',
        badgeClass: 'bg-rose-950/70 border-rose-800/50 text-rose-300',
        icon: <AlertTriangle className="w-3 h-3 text-rose-400" />,
      };
    }
    const isAnyLive = bdiObs?.isLive || bciObs?.isLive || vlsfoObs?.isLive;
    if (isAnyLive) {
      return {
        label: 'REAL DATA',
        badgeClass: 'bg-emerald-950/70 border-emerald-700/50 text-emerald-300',
        icon: <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />,
      };
    }
    const isAnyStale = bdiObs?.dataStatus === 'STALE' || bciObs?.dataStatus === 'STALE' || vlsfoObs?.dataStatus === 'STALE';
    if (isAnyStale) {
      return {
        label: 'STALE DATA',
        badgeClass: 'bg-amber-950/70 border-amber-700/50 text-amber-300',
        icon: <AlertTriangle className="w-3 h-3 text-amber-400" />,
      };
    }
    return {
      label: 'DATA UNAVAILABLE',
      badgeClass: 'bg-rose-950/70 border-rose-800/50 text-rose-300',
      icon: <AlertTriangle className="w-3 h-3 text-rose-400" />,
    };
  };

  const feedAggregate = getFeedAggregate();
  const feedTimestamp = bdiObs?.observedAt || vlsfoObs?.observedAt;

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40 text-slate-100">
      {/* Top utility row: Ticker and data badges */}
      <div className="px-4 lg:px-8 py-1.5 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap scrollbar-none">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>MARKET BENCHMARKS:</span>
          </div>

          {/* Baltic Dry Index (BDI) - Canonical Observation */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">BDI:</span>
            {bdiObs && bdiObs.value !== null && bdiObs.value !== undefined ? (
              <span className="font-semibold text-emerald-400 font-mono">
                {bdiObs.value.toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">pts</span>
              </span>
            ) : (
              <span className="font-medium text-rose-400 italic">Unavailable</span>
            )}
            {renderMetricTag(bdiObs?.dataStatus, bdiObs?.isLive)}
            {bdiObs?.change7d !== null && bdiObs?.change7d !== undefined && (
              <span className="text-[10px] text-emerald-500 font-mono">
                {bdiObs.change7d > 0 ? '+' : ''}{bdiObs.change7d}%
              </span>
            )}
          </div>

          <span className="text-slate-700">|</span>

          {/* Baltic Capesize Index (BCI) - Canonical Observation */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">BCI (Cape):</span>
            {bciObs && bciObs.value !== null && bciObs.value !== undefined ? (
              <span className="font-semibold text-slate-200 font-mono">
                {bciObs.value.toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">pts</span>
              </span>
            ) : (
              <span className="font-medium text-rose-400 italic">Unavailable</span>
            )}
            {renderMetricTag(bciObs?.dataStatus, bciObs?.isLive)}
          </div>

          <span className="text-slate-700">|</span>

          {/* BPI (Panamax) - Calibrated Proxy Baseline */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">BPI (Panamax):</span>
            <span className="font-semibold text-cyan-300 font-mono">{marketIndices.bpi.toLocaleString()} pts</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              PROXY
            </span>
          </div>

          <span className="text-slate-700">|</span>

          {/* VLSFO Bunker Fuel - Canonical Observation */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">VLSFO Spore:</span>
            {vlsfoObs && vlsfoObs.value !== null && vlsfoObs.value !== undefined ? (
              <span className="font-semibold text-amber-300 font-mono">
                ${vlsfoObs.value} <span className="text-[10px] font-sans font-normal text-slate-400">/ MT</span>
              </span>
            ) : (
              <span className="font-medium text-rose-400 italic">Unavailable</span>
            )}
            {renderMetricTag(vlsfoObs?.dataStatus, vlsfoObs?.isLive)}
          </div>

          <span className="text-slate-700">|</span>

          {/* Coking Coal - Commodity Proxy Baseline */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Coking Coal (Aus FOB):</span>
            <span className="font-semibold text-purple-300 font-mono">${marketIndices.cokingCoalAustraliaUsd}/t</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              PROXY
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold tracking-wide ${feedAggregate.badgeClass}`}>
            {feedAggregate.icon}
            <span>{feedAggregate.label}</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-700/50 text-cyan-300 font-semibold tracking-wide">
            <span>DERIVED INTELLIGENCE</span>
          </div>
          <span className="text-slate-500 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline">
            Feed updated: {feedTimestamp || 'Unavailable'}
          </span>
        </div>
      </div>

      {/* Main Brand Bar */}
      <div className="px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-cyan-950/50 border border-cyan-500/30">
            <Ship className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                IntelliFreight
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/40">
                  v3.2 Maritime Core
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 hidden md:block">
              Intelligent Freight Forecasting & Vessel Chartering Decision Platform • <span className="text-cyan-400 font-medium">Predict. Validate. Calculate. Optimise. Simulate. Recommend.</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-run-demo-scenario"
            onClick={onRunDemo}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-950 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <TrendingUp className="w-4 h-4" />
            <span>{isAnalyzing ? 'Optimising Pipeline...' : 'Run 70k MT Coal Demo'}</span>
          </button>

          {/* Authenticated User Status & Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-3 pl-2 sm:pl-3 border-l border-slate-800">
              <div className="flex items-center gap-2">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Operator'}
                    className="w-8 h-8 rounded-full border border-cyan-500/40 object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-300 font-semibold text-xs">
                    {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                  </div>
                )}
                <div className="hidden xl:block text-left">
                  <div className="text-xs font-semibold text-white leading-tight truncate max-w-[140px]">
                    {currentUser.displayName || 'Authorized Operator'}
                  </div>
                  <div className="text-[10px] text-cyan-400 font-medium">
                    Chartering Lead
                  </div>
                </div>
              </div>

              <button
                id="btn-header-signout"
                onClick={logout}
                title="Sign out of IntelliFreight"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-800 hover:border-rose-800/60 text-slate-300 text-xs font-medium transition active:scale-95 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
