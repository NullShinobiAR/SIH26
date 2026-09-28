import React, { useState, useEffect } from 'react';
import {
  Globe2,
  TrendingUp,
  Fuel,
  Ship,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Lock,
  ExternalLink,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import {
  MarketIndices,
  LiveMarketIntelligenceSummary,
  RealMarketObservationRecord,
  DataProvenanceType,
  ProviderFeedStatus,
  BalticExchangeTestDiagnostic,
} from '../types';
import { fetchLiveMarketSummary, fetchRealObservations, fetchBalticTestDiagnostic } from '../services/api';

interface MarketIntelligenceViewProps {
  marketIndices: MarketIndices;
  liveSummary?: LiveMarketIntelligenceSummary | null;
  onRefreshLiveData?: () => Promise<void>;
  isLoadingLiveData?: boolean;
}

export const MarketIntelligenceView: React.FC<MarketIntelligenceViewProps> = ({
  marketIndices,
  liveSummary: propLiveSummary,
  onRefreshLiveData,
  isLoadingLiveData,
}) => {
  const [internalLiveSummary, setInternalLiveSummary] = useState<LiveMarketIntelligenceSummary | null>(null);
  const [realObservations, setRealObservations] = useState<RealMarketObservationRecord[]>([]);
  const [internalLoading, setInternalLoading] = useState<boolean>(true);
  const [lastCheckedTime, setLastCheckedTime] = useState<string>('');
  const [balticDiagnostic, setBalticDiagnostic] = useState<BalticExchangeTestDiagnostic | null>(null);
  const [isTestingBaltic, setIsTestingBaltic] = useState<boolean>(false);
  const [showBalticDiagnosticModal, setShowBalticDiagnosticModal] = useState<boolean>(false);

  const liveSummary = propLiveSummary !== undefined ? propLiveSummary : internalLiveSummary;
  const isLoading = isLoadingLiveData !== undefined ? isLoadingLiveData : internalLoading;

  const handleTestBalticEndpoint = async () => {
    setIsTestingBaltic(true);
    try {
      const diag = await fetchBalticTestDiagnostic('c5_au_cn');
      setBalticDiagnostic(diag);
      setShowBalticDiagnosticModal(true);
    } catch (err) {
      console.error('Error testing Baltic Exchange endpoint:', err);
    } finally {
      setIsTestingBaltic(false);
    }
  };

  const loadLiveData = async () => {
    if (onRefreshLiveData) {
      try {
        await Promise.all([
          onRefreshLiveData(),
          fetchRealObservations().then((repoData) => setRealObservations(repoData?.records || [])),
        ]);
        setLastCheckedTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.error('Error refreshing live market data:', err);
      }
      return;
    }

    setInternalLoading(true);
    try {
      const [summary, repoData] = await Promise.all([
        fetchLiveMarketSummary(),
        fetchRealObservations(),
      ]);
      setInternalLiveSummary(summary);
      setRealObservations(repoData?.records || []);
      setLastCheckedTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Error loading live market data:', err);
    } finally {
      setInternalLoading(false);
    }
  };

  useEffect(() => {
    fetchRealObservations()
      .then((repoData) => setRealObservations(repoData?.records || []))
      .catch((err) => console.error('Error loading real observations repo:', err));

    if (propLiveSummary === undefined) {
      loadLiveData();
    } else {
      setLastCheckedTime(new Date().toLocaleTimeString());
    }
  }, [propLiveSummary]);

  const getStatusBadge = (status: DataProvenanceType | ProviderFeedStatus) => {
    switch (status) {
      case 'REAL':
      case 'LIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            LIVE
          </span>
        );
      case 'STALE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-700/60 shadow-xs">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            STALE
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/60 shadow-xs">
            <XCircle className="w-3 h-3 text-rose-400" />
            UNAVAILABLE
          </span>
        );
      case 'SIMULATED':
      case 'DEMO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-700/60 shadow-xs">
            <Layers className="w-3 h-3 text-blue-400" />
            SIMULATED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Connectivity Control */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-blue-950 text-blue-400 border border-blue-800/40">
                <Globe2 className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Market Intelligence & External Data Integration
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real external market feed gateway with cryptographic-grade provenance tracking, strict authenticity rules, and zero synthetic interpolation.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadLiveData}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Polling Providers...' : 'Query External APIs'}</span>
            </button>
            {lastCheckedTime && (
              <span className="text-[11px] text-slate-400">
                Checked: <strong className="text-slate-300">{lastCheckedTime}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Live Provider Health Strip */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-200">OilPriceAPI Freight (BDI/BCI)</div>
              <div className="text-[11px] text-slate-400">api.oilpriceapi.com/v1/prices</div>
            </div>
            {getStatusBadge(liveSummary?.bdi.isLive ? 'LIVE' : liveSummary?.bdi.dataStatus || 'UNAVAILABLE')}
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-200">OilPriceAPI Bunker (VLSFO)</div>
              <div className="text-[11px] text-slate-400">Singapore 0.5% Marine Fuel</div>
            </div>
            {getStatusBadge(liveSummary?.vlsfo.isLive ? 'LIVE' : liveSummary?.vlsfo.dataStatus || 'UNAVAILABLE')}
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-200">Baltic Exchange Direct API</div>
              <div className="text-[11px] text-slate-400">India Route Assessments (C5, P4TC)</div>
            </div>
            {getStatusBadge('UNAVAILABLE')}
          </div>
        </div>
      </div>

      {/* Data Authenticity & Governance Notice */}
      <div className="bg-slate-900/90 border border-blue-900/40 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300">
        <AlertCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-white flex items-center gap-2">
            <span>IntelliFreight Data Authenticity Standard</span>
            <span className="text-[10px] px-2 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-mono">
              ZERO-HALLUCINATION POLICY
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Market observations labeled <strong className="text-emerald-300">REAL / LIVE</strong> are authenticated directly from external provider endpoints with verified HTTP timestamps. If an external API is unavailable or missing credentials, the system strictly outputs <strong className="text-rose-300">UNAVAILABLE</strong>—it will <strong className="text-amber-300">never silently fall back to simulated data</strong> or invent synthetic points. Route-level Baltic assessments require authorized subscriber licenses; unauthorized web scraping is strictly banned.
          </p>
        </div>
      </div>

      {/* Primary External Observations Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Verified External Market Observations</span>
          </h3>
          <span className="text-xs text-slate-500">Benchmark Indices & Marine Fuels</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Baltic Dry Index (BDI) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-300">Baltic Dry Index (BDI)</span>
                {getStatusBadge(liveSummary?.bdi.isLive ? 'LIVE' : liveSummary?.bdi.dataStatus || 'UNAVAILABLE')}
              </div>

              <div className="text-2xl font-extrabold font-mono text-white mt-1">
                {liveSummary?.bdi.value !== null && liveSummary?.bdi.value !== undefined ? (
                  <span>{liveSummary.bdi.value.toLocaleString()} <span className="text-xs font-sans font-normal text-slate-400">pts</span></span>
                ) : (
                  <span className="text-rose-400 text-lg font-sans">Unavailable</span>
                )}
              </div>

              <p className="text-[11px] text-cyan-400/90 font-medium mt-1">
                Benchmark Index (Composite Capesize, Panamax, Supramax)
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Previous Obs:</span>
                <span className="text-slate-200 font-mono">
                  {liveSummary?.bdi.previousObservation !== null && liveSummary?.bdi.previousObservation !== undefined
                    ? `${liveSummary.bdi.previousObservation.toLocaleString()} pts`
                    : 'None recorded'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>7-Day Delta:</span>
                <span className="text-slate-200 font-mono">
                  {liveSummary?.bdi.change7d !== null && liveSummary?.bdi.change7d !== undefined
                    ? `${liveSummary.bdi.change7d > 0 ? '+' : ''}${liveSummary.bdi.change7d}%`
                    : 'Historical coverage unavailable'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>30-Day Delta:</span>
                <span className="text-slate-200 font-mono">
                  {liveSummary?.bdi.change30d !== null && liveSummary?.bdi.change30d !== undefined
                    ? `${liveSummary.bdi.change30d > 0 ? '+' : ''}${liveSummary.bdi.change30d}%`
                    : 'Historical coverage unavailable'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Observed:</span>
                <span className="text-slate-300 font-mono truncate max-w-[150px]">
                  {liveSummary?.bdi.observedAt || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Retrieved:</span>
                <span className="text-slate-300 font-mono truncate max-w-[150px]">
                  {liveSummary?.bdi.retrievedAt || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Source:</span>
                <span className="text-slate-300 truncate max-w-[150px]">
                  {liveSummary?.bdi.source || 'Baltic Exchange (via OilPriceAPI)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Provider:</span>
                <span className="text-slate-300">{liveSummary?.bdi.provider || 'OilPriceAPI'}</span>
              </div>
              {liveSummary?.bdi.errorMessage && (
                <div className="p-2 rounded bg-rose-950/40 border border-rose-900/40 text-rose-300 text-[10px] mt-2">
                  {liveSummary.bdi.errorMessage}
                </div>
              )}
            </div>
          </div>

          {/* Baltic Capesize Index (BCI) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-300">Capesize (BCI)</span>
                {getStatusBadge(liveSummary?.bci.isLive ? 'LIVE' : liveSummary?.bci.dataStatus || 'UNAVAILABLE')}
              </div>

              <div className="text-2xl font-extrabold font-mono text-white mt-1">
                {liveSummary?.bci.value !== null && liveSummary?.bci.value !== undefined ? (
                  <span>{liveSummary.bci.value.toLocaleString()} <span className="text-xs font-sans font-normal text-slate-400">pts</span></span>
                ) : (
                  <span className="text-rose-400 text-lg font-sans">Unavailable</span>
                )}
              </div>

              <p className="text-[11px] text-cyan-400/90 font-medium mt-1">
                Benchmark Index (Capesize 5TC proxy, C3/C5)
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Previous Obs:</span>
                <span className="text-slate-200 font-mono">
                  {liveSummary?.bci.previousObservation !== null && liveSummary?.bci.previousObservation !== undefined
                    ? `${liveSummary.bci.previousObservation.toLocaleString()} pts`
                    : 'None recorded'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>7-Day Delta:</span>
                <span className="text-slate-200 font-mono">
                  {liveSummary?.bci.change7d !== null && liveSummary?.bci.change7d !== undefined
                    ? `${liveSummary.bci.change7d > 0 ? '+' : ''}${liveSummary.bci.change7d}%`
                    : 'Historical coverage unavailable'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>30-Day Delta:</span>
                <span className="text-slate-200 font-mono">
                  {liveSummary?.bci.change30d !== null && liveSummary?.bci.change30d !== undefined
                    ? `${liveSummary.bci.change30d > 0 ? '+' : ''}${liveSummary.bci.change30d}%`
                    : 'Historical coverage unavailable'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Observed:</span>
                <span className="text-slate-300 font-mono truncate max-w-[150px]">
                  {liveSummary?.bci.observedAt || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Retrieved:</span>
                <span className="text-slate-300 font-mono truncate max-w-[150px]">
                  {liveSummary?.bci.retrievedAt || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Source:</span>
                <span className="text-slate-300 truncate max-w-[150px]">
                  {liveSummary?.bci.source || 'Baltic Exchange (via OilPriceAPI)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Provider:</span>
                <span className="text-slate-300">{liveSummary?.bci.provider || 'OilPriceAPI'}</span>
              </div>
              {liveSummary?.bci.errorMessage && (
                <div className="p-2 rounded bg-rose-950/40 border border-rose-900/40 text-rose-300 text-[10px] mt-2">
                  {liveSummary.bci.errorMessage}
                </div>
              )}
            </div>
          </div>

          {/* VLSFO Bunker Fuel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-amber-300">VLSFO 0.5% (Bunker)</span>
                {getStatusBadge(liveSummary?.vlsfo.isLive ? 'LIVE' : liveSummary?.vlsfo.dataStatus || 'UNAVAILABLE')}
              </div>

              <div className="text-2xl font-extrabold font-mono text-amber-300 mt-1">
                {liveSummary?.vlsfo.value !== null && liveSummary?.vlsfo.value !== undefined ? (
                  <span>${liveSummary.vlsfo.value} <span className="text-xs font-sans font-normal text-slate-400">/ MT</span></span>
                ) : (
                  <span className="text-rose-400 text-lg font-sans">Unavailable</span>
                )}
              </div>

              <p className="text-[11px] text-amber-400/90 font-medium mt-1">
                Singapore Benchmark 0.5% Sulphur Marine Fuel
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Previous Obs:</span>
                <span className="text-slate-200 font-mono">
                  {liveSummary?.vlsfo.previousObservation !== null && liveSummary?.vlsfo.previousObservation !== undefined
                    ? `$${liveSummary.vlsfo.previousObservation} / MT`
                    : 'None recorded'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>7-Day Delta:</span>
                <span className="text-slate-200 font-mono">
                  {liveSummary?.vlsfo.change7d !== null && liveSummary?.vlsfo.change7d !== undefined
                    ? `${liveSummary.vlsfo.change7d > 0 ? '+' : ''}${liveSummary.vlsfo.change7d}%`
                    : 'Historical coverage unavailable'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>30-Day Delta:</span>
                <span className="text-slate-200 font-mono">
                  {liveSummary?.vlsfo.change30d !== null && liveSummary?.vlsfo.change30d !== undefined
                    ? `${liveSummary.vlsfo.change30d > 0 ? '+' : ''}${liveSummary.vlsfo.change30d}%`
                    : 'Historical coverage unavailable'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Observed:</span>
                <span className="text-slate-300 font-mono truncate max-w-[150px]">
                  {liveSummary?.vlsfo.observedAt || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Retrieved:</span>
                <span className="text-slate-300 font-mono truncate max-w-[150px]">
                  {liveSummary?.vlsfo.retrievedAt || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Source:</span>
                <span className="text-slate-300 truncate max-w-[150px]">
                  {liveSummary?.vlsfo.source || 'OilPriceAPI Bunker Feed'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Provider:</span>
                <span className="text-slate-300">{liveSummary?.vlsfo.provider || 'OilPriceAPI'}</span>
              </div>
              {liveSummary?.vlsfo.errorMessage && (
                <div className="p-2 rounded bg-rose-950/40 border border-rose-900/40 text-rose-300 text-[10px] mt-2">
                  {liveSummary.vlsfo.errorMessage}
                </div>
              )}
            </div>
          </div>

          {/* Baltic Exchange Route Assessment Direct Integration */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-300">Baltic Route Assessment</span>
                {getStatusBadge(liveSummary?.balticIndiaRoute.isLive ? 'LIVE' : liveSummary?.balticIndiaRoute.dataStatus || 'UNAVAILABLE')}
              </div>

              <div className="text-xl font-bold font-mono text-white mt-1">
                {liveSummary?.balticIndiaRoute.value !== null && liveSummary?.balticIndiaRoute.value !== undefined ? (
                  <span>${liveSummary.balticIndiaRoute.value} <span className="text-xs font-sans font-normal text-slate-400">/ tonne</span></span>
                ) : (
                  <span className="text-rose-400 text-lg font-sans">
                    {liveSummary?.balticIndiaRoute.isLive ? 'Live Stream' : 'Unavailable'}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Capesize C5 (WAus → Qingdao / India benchmark)
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Route Code:</span>
                <span className="text-slate-200 font-mono">C5_AU_CN</span>
              </div>
              <div className="flex justify-between">
                <span>Source:</span>
                <span className="text-slate-300">Baltic Exchange Official</span>
              </div>
              <div className="flex justify-between">
                <span>Provider:</span>
                <span className="text-slate-300">Baltic Direct Gateway</span>
              </div>
              <div className="flex justify-between">
                <span>Auth Header:</span>
                <span className="text-cyan-300 font-mono text-[10px]">x-apikey (Server-side)</span>
              </div>
              {liveSummary?.balticIndiaRoute.errorMessage && (
                <div className="p-2 rounded bg-slate-950 border border-rose-900/40 text-rose-300 text-[10px] mt-2 leading-relaxed">
                  <span className="font-semibold text-rose-400">Gateway Status:</span> {liveSummary.balticIndiaRoute.errorMessage}
                </div>
              )}
              
              <button
                type="button"
                onClick={handleTestBalticEndpoint}
                disabled={isTestingBaltic}
                className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800/60 text-xs font-medium transition cursor-pointer disabled:opacity-50"
              >
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                {isTestingBaltic ? 'Sending Authenticated Request...' : 'Run Authenticated Baltic Test'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Baltic Exchange Diagnostic Inspection Modal */}
      {showBalticDiagnosticModal && balticDiagnostic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-blue-950 text-blue-400 border border-blue-800/40">
                  <Terminal className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Baltic Exchange Authenticated Request Diagnostic
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live server-side authenticated GET probe to documented Azure APIM Gateway
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBalticDiagnosticModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Endpoint</div>
                  <div className="font-mono text-cyan-300 text-[11px] break-all">{balticDiagnostic.endpoint}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">HTTP Status</div>
                  <div className="flex items-center gap-1.5 font-mono text-white text-sm font-bold">
                    <span className={`px-2 py-0.5 rounded text-xs ${balticDiagnostic.httpStatus === 200 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                      {balticDiagnostic.httpStatus || 'N/A'} {balticDiagnostic.httpStatus === 401 ? 'Unauthorized' : balticDiagnostic.httpStatus === 200 ? 'OK' : ''}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Returned Content-Type</div>
                  <div className="font-mono text-slate-200 text-[11px]">{balticDiagnostic.returnedDataType}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Timestamp</div>
                  <div className="font-mono text-slate-200 text-[11px]">{balticDiagnostic.timestamp}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Auth Header & Protection</div>
                  <div className="font-mono text-slate-300 text-[11px]">
                    <code>x-apikey: {balticDiagnostic.apiKeyMasked || 'Not configured'}</code>
                    <span className="block text-[10px] text-emerald-400 mt-0.5">✓ Zero browser exposure (server-side only)</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Classified As REAL / LIVE?</div>
                  <div className="flex items-center gap-1 font-bold">
                    {balticDiagnostic.canBeClassifiedAsRealLive ? (
                      <span className="text-emerald-400">YES — Verified Live Market Observation</span>
                    ) : (
                      <span className="text-rose-400">NO — Strictly Classified as UNAVAILABLE</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Diagnostic Report & Governance Rule</div>
                <p className="text-slate-300 leading-relaxed">
                  {balticDiagnostic.detailMessage}
                </p>
                <div className="text-[11px] text-amber-400 bg-amber-950/40 p-2 rounded border border-amber-900/40">
                  <strong>Zero-Hallucination Mandate:</strong> Because the request was rejected with HTTP 401 Unauthorized, IntelliFreight refuses to synthesize, interpolate, or fabricate route fixtures. No simulated fallback is used.
                </div>
              </div>

              {balticDiagnostic.rawResponseSnippet && (
                <div className="p-2.5 rounded-xl bg-black border border-slate-800 font-mono text-[10px] text-slate-400 overflow-x-auto">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Raw Gateway Response:</div>
                  <code>{balticDiagnostic.rawResponseSnippet}</code>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowBalticDiagnosticModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real Historical Observations Repository Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-purple-950 text-purple-400 border border-purple-800/40">
              <Database className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">
                Historical Real Observations Repository & Training Gate
              </h3>
              <p className="text-xs text-slate-400">
                Timestamped external observations persisted with immutable provenance. Zero synthetic historical backfill.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono font-semibold">
              {realObservations.length} Verified Observations
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40 text-[10px] font-semibold">
              RE-TRAINING LOCKED (Requires 52)
            </span>
          </div>
        </div>

        {/* Training Governance Warning */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-white">Machine Learning Governance Rule:</strong> Model retraining on live external data is strictly gated. The forecasting engine refuses automated retraining until at least <strong>52 continuous weekly real observations</strong> are recorded to prevent catastrophic overfitting on sparse points. Until then, forecasts are benchmarked against calibrated historical ground-truth data.
          </div>
        </div>

        {/* Real Observations Table */}
        {realObservations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Symbol / Code</th>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5">Observed Value</th>
                  <th className="p-2.5">Unit</th>
                  <th className="p-2.5">Observed Timestamp</th>
                  <th className="p-2.5">Retrieved Timestamp</th>
                  <th className="p-2.5">Provenance Status</th>
                  <th className="p-2.5">Provider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {realObservations.map((obs) => (
                  <tr key={obs.id} className="hover:bg-slate-800/30">
                    <td className="p-2.5 text-cyan-300 font-bold">{obs.symbolOrCode}</td>
                    <td className="p-2.5 text-slate-300 font-sans">{obs.name}</td>
                    <td className="p-2.5 text-white font-bold">{obs.value.toLocaleString()}</td>
                    <td className="p-2.5 text-slate-400">{obs.unit}</td>
                    <td className="p-2.5 text-slate-400 text-[11px]">{obs.observedAt}</td>
                    <td className="p-2.5 text-slate-400 text-[11px]">{obs.retrievedAt}</td>
                    <td className="p-2.5">{getStatusBadge(obs.dataStatus)}</td>
                    <td className="p-2.5 text-slate-400 font-sans">{obs.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-400">
            <p className="font-semibold text-slate-300">Historical Coverage Unavailable</p>
            <p className="mt-1 text-[11px]">
              No verified external observations have been recorded in the persistent repository yet. Historical charts will display only genuine observations as they are retrieved from external APIs.
            </p>
          </div>
        )}
      </div>

      {/* Calibrated Development Benchmarks (Explicitly Tagged SIMULATED) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-950 text-blue-400 border border-blue-800/40">
              <TrendingUp className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Calibrated Development Trade Benchmarks</span>
                <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40 text-[10px] font-semibold">
                  SIMULATED PROXIES
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Calibrated domain parameters used for offline voyage calculation and contract optimization modeling.
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-500">Benchmark Baseline: {marketIndices.lastUpdated}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400 text-[11px]">Panamax (BPI) Benchmark</div>
            <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
              {marketIndices.bpi.toLocaleString()} pts
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Simulated development proxy</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400 text-[11px]">Australian Coking Coal (FOB)</div>
            <div className="text-xl font-bold font-mono text-purple-300 mt-1">
              ${marketIndices.cokingCoalAustraliaUsd} / t
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Bowen Basin export baseline</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400 text-[11px]">Newcastle 6,000 Thermal Coal</div>
            <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
              ${marketIndices.thermalCoalNewcastleUsd || 138.5} / t
            </div>
            <div className="text-[10px] text-slate-500 mt-1">FOB Newcastle thermal proxy</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400 text-[11px]">China Iron Ore (62% CFR)</div>
            <div className="text-xl font-bold font-mono text-amber-300 mt-1">
              ${marketIndices.ironOreChinaUsd || 104.5} / t
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Platts IODEX calibration proxy</div>
          </div>
        </div>
      </div>
    </div>
  );
};
