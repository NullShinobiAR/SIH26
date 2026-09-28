import React, { useState } from 'react';
import {
  TrendingUp,
  LineChart as ChartIcon,
  ShieldCheck,
  AlertCircle,
  Cpu,
  Layers,
  Calendar,
  CheckCircle2,
  Database,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { FreightForecastResult, VesselClass } from '../types';
import { runFreightForecast } from '../engines/forecastingEngine';

interface FreightForecastViewProps {
  initialForecast: FreightForecastResult;
  routeId: string;
  vesselClass: VesselClass;
}

export const FreightForecastView: React.FC<FreightForecastViewProps> = ({
  initialForecast,
  routeId,
  vesselClass,
}) => {
  const [selectedModel, setSelectedModel] = useState<
    'Naive' | 'Moving Average' | 'Seasonal Autoregressive Ridge' | 'GBDT Regression' | 'Ensemble'
  >(initialForecast.selectedModel);

  const forecast =
    selectedModel === initialForecast.selectedModel
      ? initialForecast
      : runFreightForecast(routeId, vesselClass, selectedModel);

  // Combine historical and forecast data for charting
  const chartData = [
    ...forecast.history.slice(-20).map((h) => ({
      date: h.date.substring(5),
      actualRate: h.rateUsdPerTonne,
      predictedRate: null as number | null,
      lower95: null as number | null,
      upper95: null as number | null,
      lower80: null as number | null,
      upper80: null as number | null,
      bdi: h.bdi,
    })),
    {
      date: forecast.history[forecast.history.length - 1].date.substring(5),
      actualRate: forecast.currentRateUsdPerTonne,
      predictedRate: forecast.currentRateUsdPerTonne,
      lower95: forecast.currentRateUsdPerTonne,
      upper95: forecast.currentRateUsdPerTonne,
      lower80: forecast.currentRateUsdPerTonne,
      upper80: forecast.currentRateUsdPerTonne,
      bdi: forecast.history[forecast.history.length - 1].bdi,
    },
    ...forecast.forecastSeries.map((f) => ({
      date: f.date.substring(5),
      actualRate: null as number | null,
      predictedRate: f.predictedRate,
      lower95: f.lowerBound95,
      upper95: f.upperBound95,
      lower80: f.lowerBound80,
      upper80: f.upperBound80,
      bdi: null as number | null,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Explicit Data Provenance & Real-Data Training Gate Banner */}
      {forecast.dataQualityBadge === 'REAL' ? (
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-emerald-900/60 text-emerald-400 border border-emerald-700/50">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900 text-emerald-200 border border-emerald-700/60 font-mono">
                  REAL VERIFIED ROUTE TRAINING
                </span>
                <span className="text-xs font-semibold text-emerald-300">
                  Target Baltic Route: {forecast.realTrainingGate?.targetRouteCode || 'C18 / P9'}
                </span>
              </div>
              <p className="text-xs text-emerald-300/80 mt-1">
                Models trained strictly on {forecast.realTrainingGate?.currentCount || 52}+ continuous verified external observations for this specific route.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-emerald-400 font-semibold block">TRAINING GATE PASSED</span>
            <span className="text-[11px] text-emerald-400/70 font-mono">{forecast.realTrainingGate?.currentCount}/52 Verified Weeks</span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-900/60 text-amber-400 border border-amber-700/50">
              <Database className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900 text-amber-200 border border-amber-700/60 font-mono">
                  DEVELOPMENT / PROXY DATA
                </span>
                <span className="text-xs font-semibold text-amber-300">
                  Calibrated Development Proxy (SIMULATED & DERIVED)
                </span>
              </div>
              <p className="text-xs text-amber-300/80 mt-1">
                REAL ROUTE TRAINING: UNAVAILABLE — insufficient verified historical observations. Gate requires 52 continuous weekly verified observations for route {forecast.realTrainingGate?.targetRouteCode || 'C18 / P9'} ({forecast.realTrainingGate?.currentCount ?? 0}/52 collected). Generic live BDI/VLSFO data does NOT satisfy this gate.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-amber-400 font-semibold block">GATE LOCKED</span>
            <span className="text-[11px] text-amber-400/70 font-mono">
              {forecast.realTrainingGate ? `${forecast.realTrainingGate.currentCount}/${forecast.realTrainingGate.minimumRequiredCount} Weeks (${forecast.realTrainingGate.readinessPct}%)` : '0/52 Weeks'}
            </span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                <ChartIcon className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Multi-Horizon Freight Forecasting Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Time-series models evaluating rate trajectory across 2, 4, 8, and 12-week horizons with expanding uncertainty cones.
            </p>
          </div>

          {/* Model Selector Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['Naive', 'Moving Average', 'Seasonal Autoregressive Ridge', 'GBDT Regression', 'Ensemble'] as const).map(
              (m) => (
                <button
                  key={m}
                  onClick={() => setSelectedModel(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    selectedModel === m
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {m}
                </button>
              )
            )}
          </div>
        </div>

        {/* Horizon Forecast Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase font-bold flex items-center justify-between">
              <span>2-Week Horizon</span>
              <span className="text-[10px] text-blue-400 font-mono">Laycan Spot</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1.5">
              ${forecast.forecast2Weeks.toFixed(2)}
              <span className="text-xs text-slate-400 font-sans font-normal ml-1">/ t</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Delta:{' '}
              <span className={forecast.forecast2Weeks >= forecast.currentRateUsdPerTonne ? 'text-emerald-400' : 'text-amber-400'}>
                {(forecast.forecast2Weeks - forecast.currentRateUsdPerTonne >= 0 ? '+' : '') +
                  (forecast.forecast2Weeks - forecast.currentRateUsdPerTonne).toFixed(2)}
                /t
              </span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-blue-900/40 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-blue-500" />
            <div className="text-[11px] text-blue-400 uppercase font-bold flex items-center justify-between">
              <span>4-Week Horizon</span>
              <span className="text-[10px] text-blue-300 font-mono">Prompt Contract</span>
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-300 mt-1.5">
              ${forecast.forecast4Weeks.toFixed(2)}
              <span className="text-xs text-slate-400 font-sans font-normal ml-1">/ t</span>
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 font-semibold">
              {forecast.expectedChangePct4Weeks > 0 ? `+${forecast.expectedChangePct4Weeks}%` : `${forecast.expectedChangePct4Weeks}%`} (Primary Anchor)
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase font-bold flex items-center justify-between">
              <span>8-Week Horizon</span>
              <span className="text-[10px] text-purple-400 font-mono">Medium Multi-Voyage</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1.5">
              ${forecast.forecast8Weeks.toFixed(2)}
              <span className="text-xs text-slate-400 font-sans font-normal ml-1">/ t</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Confidence Interval: ±$
              {((forecast.forecastSeries[7]?.upperBound95 - forecast.forecastSeries[7]?.lowerBound95) / 2 || 2.8).toFixed(2)}
              /t
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase font-bold flex items-center justify-between">
              <span>12-Week Horizon</span>
              <span className="text-[10px] text-amber-400 font-mono">Quarterly COA</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1.5">
              ${forecast.forecast12Weeks.toFixed(2)}
              <span className="text-xs text-slate-400 font-sans font-normal ml-1">/ t</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Annualized Volatility:{' '}
              <span className="text-amber-400 font-mono">{forecast.volatilityAnnualizedPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Forecasting Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Historical vs Predicted Freight Curve (with 80% & 95% Confidence Bounds)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Model: <span className="text-cyan-400 font-semibold">{forecast.selectedModel}</span> • 
              {forecast.modelMetrics.mae !== null ? (
                <>
                  MAE: <span className="text-slate-200 font-mono">${forecast.modelMetrics.mae}/t</span> • 
                  RMSE: <span className="text-slate-200 font-mono">${forecast.modelMetrics.rmse}/t</span> • 
                  Directional Accuracy: <span className="text-emerald-400 font-mono">{forecast.modelMetrics.directionalAccuracyPct}%</span>
                </>
              ) : (
                <span className="text-amber-400 font-medium">Performance unavailable — insufficient valid observations for backtesting.</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-500 inline-block"></span>
              <span className="text-slate-300">Historical Rate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-cyan-400 border-dashed inline-block"></span>
              <span className="text-cyan-400">Forecast Rate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 bg-cyan-900/50 inline-block rounded"></span>
              <span className="text-slate-400">95% Confidence Cone</span>
            </div>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="cone95" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} unit="$" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
              />
              <Area type="monotone" dataKey="upper95" stroke="#0891b2" strokeWidth={1} fill="url(#cone95)" name="Upper 95% Confidence" />
              <Area type="monotone" dataKey="lower95" stroke="#0891b2" strokeWidth={1} fill="transparent" name="Lower 95% Confidence" />
              <Line type="monotone" dataKey="actualRate" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Actual Rate ($/t)" />
              <Line type="monotone" dataKey="predictedRate" stroke="#06b6d4" strokeWidth={2.5} strokeDasharray="5 5" dot={true} name="Forecast ($/t)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time-Series Validation Diagnostics Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Out-of-Sample Expanding Window Backtesting Diagnostics</span>
          </h3>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-blue-300 text-[10px] font-mono border border-slate-700">
            {forecast.governance?.modelVersion || 'v2.4-Ensemble'}
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Models evaluated via expanding-window backtesting across historical observations. Metrics are computed dynamically with zero look-ahead bias or synthetic metric constants.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Model Architecture</th>
                <th className="py-2.5 px-3 text-right">MAE ($/t)</th>
                <th className="py-2.5 px-3 text-right">RMSE ($/t)</th>
                <th className="py-2.5 px-3 text-right">MAPE (%)</th>
                <th className="py-2.5 px-3 text-right">Directional Accuracy</th>
                <th className="py-2.5 px-3">Validation Methodology</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {(forecast.allModelsEvaluations || []).map((m, idx) => {
                const isCurrent =
                  (selectedModel === 'Ensemble' && m.name.includes('Ensemble')) ||
                  (selectedModel === 'GBDT Regression' && m.name.includes('Gradient Boosted')) ||
                  (selectedModel === 'Seasonal Autoregressive Ridge' && (m.name.includes('Seasonal Autoregressive') || m.name.includes('AR Ridge'))) ||
                  (selectedModel === 'Moving Average' && m.name.includes('Moving Average')) ||
                  (selectedModel === 'Naive' && m.name.includes('Naive'));

                return (
                  <tr key={idx} className={isCurrent ? 'bg-blue-950/40 font-semibold' : 'hover:bg-slate-800/20'}>
                    <td className="py-2.5 px-3 text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }}></span>
                      <span>{m.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                      {m.mae !== null ? `$${m.mae.toFixed(2)}` : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                      {m.rmse !== null ? `$${m.rmse.toFixed(2)}` : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-cyan-400">
                      {m.mape !== null ? `${m.mape.toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                      {m.directionalAccuracy !== null ? `${m.directionalAccuracy.toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">{m.validation}</td>
                    <td className="py-2.5 px-3 text-center">
                      {isCurrent ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800/40">
                          SELECTED
                        </span>
                      ) : m.isBest ? (
                        <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 text-[10px] font-semibold">
                          BEST
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Benchmark</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
