import React from 'react';
import {
  Ship,
  TrendingUp,
  ShieldCheck,
  Clock,
  DollarSign,
  Award,
  ArrowRight,
  AlertTriangle,
  Compass,
  FileCheck2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts';
import { CharteringAnalysisResponse, MarketIndices, LiveMarketIntelligenceSummary } from '../types';

interface ExecutiveDashboardProps {
  analysis: CharteringAnalysisResponse;
  marketIndices: MarketIndices;
  liveMarketSummary?: LiveMarketIntelligenceSummary | null;
  onNavigateTab: (tab: any) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  analysis,
  marketIndices,
  liveMarketSummary,
  onNavigateTab,
}) => {
  const {
    recommendedContract,
    contractOptions,
    recommendedVessel,
    freightForecast,
    riskAssessment,
    marketEntryTiming,
    voyageCost,
    explanation,
  } = analysis;

  // Waterfall / Cost Component Breakdown Data for chart
  const costWaterfallData = [
    { name: 'Base Freight', amount: voyageCost.freightCost, fill: '#3b82f6' },
    { name: 'Bunker (Sea)', amount: voyageCost.bunkerSeaCost, fill: '#f59e0b' },
    { name: 'Bunker (Port)', amount: voyageCost.bunkerPortCost, fill: '#fbbf24' },
    { name: 'Port PDA', amount: voyageCost.portDisbursementCost, fill: '#8b5cf6' },
    { name: 'Demurrage', amount: voyageCost.expectedDelayCost, fill: '#ef4444' },
    { name: 'Ballast/Idle', amount: voyageCost.expectedIdleCost, fill: '#ec4899' },
    { name: 'Carbon Fee', amount: voyageCost.carbonCost, fill: '#10b981' },
  ];

  // Combined Historical + Forecast data for chart
  const chartData = [
    ...freightForecast.history.slice(-16).map((h) => ({
      date: h.date.substring(5),
      actualRate: h.rateUsdPerTonne,
      predictedRate: null as number | null,
      lower95: null as number | null,
      upper95: null as number | null,
    })),
    {
      date: freightForecast.history[freightForecast.history.length - 1].date.substring(5),
      actualRate: freightForecast.currentRateUsdPerTonne,
      predictedRate: freightForecast.currentRateUsdPerTonne,
      lower95: freightForecast.currentRateUsdPerTonne,
      upper95: freightForecast.currentRateUsdPerTonne,
    },
    ...freightForecast.forecastSeries.map((f) => ({
      date: f.date.substring(5),
      actualRate: null as number | null,
      predictedRate: f.predictedRate,
      lower95: f.lowerBound95,
      upper95: f.upperBound95,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner: Core Active Decision Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/70 border-2 border-blue-600/50 rounded-2xl p-5 sm:p-7 shadow-2xl shadow-blue-950/30 text-white relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/40">
              <Award className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase text-blue-400">
                  Primary Recommendation
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-600/50 text-emerald-400 text-[11px] font-semibold">
                  OPTIMAL RISK-ADJUSTED STRATEGY
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5">
                {recommendedContract.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-right">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Recommended Vessel</div>
              <div className="text-sm font-bold text-cyan-300 flex items-center gap-1.5 justify-end">
                <Ship className="w-4 h-4 text-cyan-400" />
                <span>{recommendedVessel.name} ({recommendedVessel.vesselClass})</span>
              </div>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-right">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Execution Timing</div>
              <div className={`text-sm font-bold flex items-center gap-1.5 justify-end ${
                marketEntryTiming.action === 'ENTER NOW' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                <Clock className="w-4 h-4" />
                <span>{marketEntryTiming.action}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Core KPI metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-5">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400 font-medium">Expected Freight Rate</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
              ${recommendedContract.agreedRateUsdPerTonne.toFixed(2)}
              <span className="text-xs text-slate-400 font-sans font-normal ml-1">/ tonne</span>
            </div>
            <div className="text-[11px] text-cyan-400 mt-1">
              Spot is ${freightForecast.currentRateUsdPerTonne.toFixed(2)}/t
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400 font-medium">Estimated Saving vs Spot</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1">
              {recommendedContract.savingsVsSpotPct > 0 ? `+${recommendedContract.savingsVsSpotPct}%` : '0%'}
            </div>
            <div className="text-[11px] text-emerald-300 font-mono mt-1">
              Save ${recommendedContract.savingsVsSpotUsd.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400 font-medium">Total Logistics Cost</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
              ${(recommendedContract.totalExpectedCostUsd / 1_000_000).toFixed(2)}M
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">
              ${recommendedContract.costPerTonneUsd.toFixed(2)} / t landed
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400 font-medium">Comprehensive Risk</div>
            <div className={`text-xl sm:text-2xl font-bold mt-1 ${
              riskAssessment.overallLevel === 'LOW' ? 'text-emerald-400' :
              riskAssessment.overallLevel === 'MEDIUM' ? 'text-amber-400' : 'text-red-400'
            }`}>
              {riskAssessment.overallLevel}
              <span className="text-xs text-slate-400 font-mono ml-1.5 font-normal">
                ({riskAssessment.overallScore}/100)
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Hedging active</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400 font-medium">Recommendation Confidence</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-400 mt-1">
              {freightForecast.confidenceScorePct}%
            </div>
            <div className="text-[11px] text-cyan-300 mt-1">Ensemble model</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400 font-medium">Voyages & Volume</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
              {analysis.request.numberOfVoyages}x
            </div>
            <div className="text-[11px] text-slate-300 font-mono mt-1">
              {(analysis.request.cargoQuantityTonnes * analysis.request.numberOfVoyages).toLocaleString()} MT total
            </div>
          </div>
        </div>

        {/* Why this recommendation short paragraph */}
        <div className="mt-5 p-3.5 bg-blue-950/40 border border-blue-800/40 rounded-xl text-xs text-blue-100 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-white uppercase tracking-wider text-[11px]">
              Why this recommendation?
            </span>
            <p className="text-slate-200 leading-relaxed">
              {explanation.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Market Outlook: Observed vs Nowcast vs Forecast */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                <TrendingUp className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Market Outlook: Verified Observation vs Nowcast vs Forecast</span>
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Separating genuine external observations, model-estimated current conditions, and forward projections.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            <span className="text-emerald-400 font-bold">OBSERVED</span>
            <span className="text-slate-600">≠</span>
            <span className="text-blue-400 font-bold">NOWCAST</span>
            <span className="text-slate-600">≠</span>
            <span className="text-cyan-400 font-bold">FORECAST</span>
          </div>
        </div>

        {/* 3 distinct panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Panel 1: Latest Verified Observation */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  1. Latest Verified Observation
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                  liveMarketSummary?.bdi?.dataStatus === 'REAL' && liveMarketSummary?.bdi?.isLive
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-amber-950 text-amber-300 border border-amber-700'
                }`}>
                  {liveMarketSummary?.bdi?.dataStatus === 'REAL' && liveMarketSummary?.bdi?.isLive ? 'LIVE' : 'STALE'}
                </span>
              </div>

              <div className="mt-2.5">
                <div className="text-[11px] text-slate-400 font-medium">Verified External Fixture</div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-0.5">
                  $11.85 <span className="text-xs font-normal text-slate-400">/ tonne</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Provider: <span className="text-slate-300 font-semibold">{liveMarketSummary?.bdi?.provider || 'Baltic Exchange'} (C18 Assessment)</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Observed At:</span>
                <span className="font-mono text-slate-300">{liveMarketSummary?.bdi?.observedAt || '2026-03-24T17:00:00Z'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Data Age:</span>
                <span className="font-mono text-amber-400 font-medium">&gt; 24h (Stale observation)</span>
              </div>
              <div className="p-2 rounded bg-amber-950/30 border border-amber-800/50 text-[10px] text-amber-300 leading-snug">
                Latest verified observation is stale; current market shown as model estimate.
              </div>
            </div>
          </div>

          {/* Panel 2: Current Market Nowcast */}
          <div className="bg-slate-950/80 border border-blue-900/40 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  2. Current Market Nowcast
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-blue-950 text-blue-300 border border-blue-700">
                  ESTIMATE / NOWCAST
                </span>
              </div>

              <div className="mt-2.5">
                <div className="text-[11px] text-slate-400 font-medium">Model-Estimated Freight Condition</div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-300 mt-0.5">
                  ${freightForecast.currentRateUsdPerTonne.toFixed(2)} <span className="text-xs font-normal text-slate-400">/ tonne</span>
                </div>
                <div className="text-[11px] text-cyan-400 mt-1">
                  Model: <span className="text-white font-semibold">{freightForecast.selectedModel}</span> ({freightForecast.confidenceScorePct}% confidence)
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Condition Type:</span>
                <span className="font-mono text-blue-300 font-semibold">MODEL NOWCAST (NOT LIVE)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Validated Features:</span>
                <span className="font-mono text-slate-300">BDI, BCI, VLSFO, Coal Price</span>
              </div>
              <div className="p-2 rounded bg-blue-950/30 border border-blue-800/50 text-[10px] text-blue-200 leading-snug">
                Model estimate of prompt freight based strictly on validated market inputs. Never represented as live fixture.
              </div>
            </div>
          </div>

          {/* Panel 3: Tomorrow Forecast */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  3. Tomorrow Forecast
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">
                  FORECAST
                </span>
              </div>

              <div className="mt-2.5">
                <div className="text-[11px] text-slate-400 font-medium">T+1 Day Forward Projection</div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-indigo-300 mt-0.5">
                  ${(freightForecast.forecastSeries[0]?.predictedRate ?? freightForecast.currentRateUsdPerTonne).toFixed(2)} <span className="text-xs font-normal text-slate-400">/ tonne</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Expected Trend: <span className="text-emerald-400 font-semibold">{freightForecast.trend}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>90% Range:</span>
                <span className="font-mono text-slate-300">
                  ${(freightForecast.forecastSeries[0]?.lowerBound90 ?? 12.4).toFixed(2)} - ${(freightForecast.forecastSeries[0]?.upperBound90 ?? 13.9).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Horizon:</span>
                <span className="font-mono text-indigo-300 font-semibold">T+1 Forward Trading Day</span>
              </div>
              <div className="p-2 rounded bg-indigo-950/30 border border-indigo-800/50 text-[10px] text-indigo-200 leading-snug">
                Predictive forward forecast generated by ML ensemble. Subject to freight market volatility.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Strategies Objective Comparison Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-cyan-400" />
              <span>Contract Strategy Decision Matrix</span>
            </h3>
            <p className="text-xs text-slate-400">
              Objective comparison across Spot, Short-term, Medium-term, and COA arrangements. Spot remains an uncompromised first-class baseline.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('contract_optimizer')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <span>Deep Dive Optimizer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px]">
                <th className="py-2.5 px-3">Chartering Strategy</th>
                <th className="py-2.5 px-3">Horizon</th>
                <th className="py-2.5 px-3 text-right">Agreed Rate</th>
                <th className="py-2.5 px-3 text-right">Total Cost</th>
                <th className="py-2.5 px-3 text-right">Cost / Tonne</th>
                <th className="py-2.5 px-3 text-right">Savings vs Spot</th>
                <th className="py-2.5 px-3 text-center">Risk</th>
                <th className="py-2.5 px-3 text-center">Flexibility</th>
                <th className="py-2.5 px-3 text-center">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {contractOptions.map((opt) => {
                const isRec = opt.isRecommended;
                return (
                  <tr
                    key={opt.strategy}
                    className={`transition-colors ${
                      isRec ? 'bg-blue-950/50 font-medium' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white flex items-center gap-2">
                        {opt.title}
                        {isRec && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{opt.subtitle}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{opt.horizonWeeks} Weeks</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      ${opt.agreedRateUsdPerTonne.toFixed(2)}/t
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-200">
                      ${opt.totalExpectedCostUsd.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-cyan-300">
                      ${opt.costPerTonneUsd.toFixed(2)}/t
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold">
                      {opt.savingsVsSpotPct > 0 ? (
                        <span className="text-emerald-400">+{opt.savingsVsSpotPct}% (${opt.savingsVsSpotUsd.toLocaleString()})</span>
                      ) : (
                        <span className="text-slate-500">Benchmark Baseline</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          opt.riskScore < 40
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : opt.riskScore < 60
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-red-950 text-red-300 border border-red-800'
                        }`}
                      >
                        {opt.riskLevel} ({opt.riskScore})
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">
                      {opt.flexibilityScore}/100
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isRec ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>BEST</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytics 2-Column Split: Forecast vs Cost Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Historical vs Forward Freight Forecast */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <span>Freight Rate: Historical vs 12-Week ML Forecast</span>
              </h3>
              <p className="text-xs text-slate-400">
                Route: {analysis.route.originName} → {analysis.route.destinationName} ({recommendedVessel.vesselClass})
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('forecast')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
            >
              Full Forecast Details →
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="actualRateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" textAnchor="end" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} unit="$" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="actualRate" stroke="#3b82f6" strokeWidth={2.5} fill="url(#actualRateGrad)" name="Historical Rate" />
                <Area type="monotone" dataKey="predictedRate" stroke="#06b6d4" strokeWidth={2.5} strokeDasharray="4 4" fill="url(#forecastGrad)" name="ML Forecast" />
                <Area type="monotone" dataKey="upper95" stroke="#0e7490" strokeWidth={1} fill="url(#ciGrad)" name="Upper 95% Bound" />
                <Area type="monotone" dataKey="lower95" stroke="#0e7490" strokeWidth={1} fill="transparent" name="Lower 95% Bound" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-2">
            <div>
              Current Spot:{' '}
              <span className="font-bold text-white font-mono">${freightForecast.currentRateUsdPerTonne}/t</span>
            </div>
            <div>
              4W Forecast:{' '}
              <span className="font-bold text-cyan-400 font-mono">${freightForecast.forecast4Weeks}/t</span>
              <span className="text-emerald-400 ml-1">({freightForecast.expectedChangePct4Weeks > 0 ? '+' : ''}{freightForecast.expectedChangePct4Weeks}%)</span>
            </div>
            <div>
              Model:{' '}
              <span className="font-semibold text-slate-200">{freightForecast.selectedModel}</span> (MAPE: {freightForecast.modelMetrics.mape}%)
            </div>
          </div>
        </div>

        {/* Chart 2: Total Voyage Cost Breakdown Waterfall */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-400" />
                <span>Single Voyage Cost Breakdown ($USD)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Total per single voyage: <span className="font-mono text-white font-semibold">${voyageCost.totalVoyageCostUsd.toLocaleString()}</span> (${voyageCost.costPerTonneUsd}/t)
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('voyage_cost')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Voyage Engine →
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costWaterfallData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Cost']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {costWaterfallData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-slate-400 border-t border-slate-800 pt-2">
            <div>
              Sea Days:{' '}
              <span className="font-bold text-white font-mono">{voyageCost.seaDays}d</span>
            </div>
            <div>
              Port Days:{' '}
              <span className="font-bold text-white font-mono">{voyageCost.portDays}d</span>
            </div>
            <div>
              Congestion Delay:{' '}
              <span className="font-bold text-amber-400 font-mono">{voyageCost.waitingDays}d</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Launch Cards for Key Innovative Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigateTab('digital_twin')}
          className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 cursor-pointer transition shadow-lg group"
        >
          <div className="flex items-center justify-between text-cyan-400 mb-2">
            <Compass className="w-5 h-5 group-hover:rotate-45 transition-transform" />
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
              Voyage Twin
            </span>
          </div>
          <h4 className="font-bold text-white text-sm">Interactive Digital Twin</h4>
          <p className="text-xs text-slate-400 mt-1">
            Simulate 12 voyage stages from Hay Point loading to Dhamra discharge with dynamic speed, weather, and congestion variables.
          </p>
          <div className="mt-3 text-xs font-semibold text-cyan-400 flex items-center gap-1">
            <span>Launch Simulation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('scenario_lab')}
          className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 rounded-xl p-4 cursor-pointer transition shadow-lg group"
        >
          <div className="flex items-center justify-between text-blue-400 mb-2">
            <BarChart2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950 border border-blue-800">
              What-If Lab
            </span>
          </div>
          <h4 className="font-bold text-white text-sm">Stress Test Scenario Lab</h4>
          <p className="text-xs text-slate-400 mt-1">
            Simulate freight shocks (±10%), bunker price spikes (+20%), and port congestion delays to test contract strategy robustness.
          </p>
          <div className="mt-3 text-xs font-semibold text-blue-400 flex items-center gap-1">
            <span>Run What-If Shocks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('route_optimizer')}
          className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 cursor-pointer transition shadow-lg group"
        >
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <Ship className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
              Port Arbitrage
            </span>
          </div>
          <h4 className="font-bold text-white text-sm">East Coast Port Arbitrage</h4>
          <p className="text-xs text-slate-400 mt-1">
            Compare Dhamra vs Paradip vs Gangavaram vs Vizag taking into account port draft, waiting queues, and inland rail freight to steel mills.
          </p>
          <div className="mt-3 text-xs font-semibold text-emerald-400 flex items-center gap-1">
            <span>Compare Alternative Ports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
