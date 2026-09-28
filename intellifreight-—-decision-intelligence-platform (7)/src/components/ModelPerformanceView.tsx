import React, { useState } from 'react';
import {
  BarChart3,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Award,
  CheckCircle2,
  LineChart as LineChartIcon,
  Database,
  Cpu,
  Layers,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
  LineChart,
  Line,
  Area,
  ComposedChart,
} from 'recharts';
import { FreightForecastResult } from '../types';
import { runFreightForecast } from '../engines/forecastingEngine';

interface ModelPerformanceViewProps {
  forecast?: FreightForecastResult;
}

export const ModelPerformanceView: React.FC<ModelPerformanceViewProps> = ({ forecast: initialForecast }) => {
  const [selectedRoute, setSelectedRoute] = useState<'rt-australia-east-coast' | 'rt-indonesia-west-coast' | 'rt-us-east-coast'>('rt-australia-east-coast');

  // Compute live from genuine chronological backtesting if not passed
  const activeForecast = initialForecast || runFreightForecast(selectedRoute, 'Panamax');
  const models = activeForecast.allModelsEvaluations || [];
  const backtestHistory = activeForecast.backtestHistory || [];
  const governance = activeForecast.governance;
  const confidence = activeForecast.confidenceBreakdown;

  // Best model based on backtest
  const bestModel = models.find((m) => m.isBest) || models[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-blue-950 text-blue-400 border border-blue-800/40">
                <BarChart3 className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                ML Pipeline Diagnostics & Chronological Backtesting
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Rigorous expanding-window out-of-sample validation. Metrics are strictly computed from genuine backtesting — zero hard-coded or fabricated accuracy metrics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-blue-950/80 border border-blue-700/60 text-blue-300 text-xs font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Expanding-Window Backtesting
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-semibold">
              Zero Lookahead Leakage
            </span>
          </div>
        </div>
      </div>

      {/* Performance Unavailable Notice if applicable */}
      {governance?.modelStatus?.includes('Performance unavailable') && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-4 text-amber-200 text-xs flex items-center gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-semibold text-amber-300 block">Performance unavailable — insufficient valid observations for backtesting.</span>
            <span className="text-[11px] text-amber-400/80">
              Chronological backtesting requires sufficient continuous historical observations. No synthetic or fabricated metrics are displayed.
            </span>
          </div>
        </div>
      )}

      {/* Real-Data Training Gate & Dataset Provenance Status */}
      <div className={`border rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 ${
        activeForecast.dataQualityBadge === 'REAL'
          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
          : 'bg-amber-950/30 border-amber-800/60 text-amber-200'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`p-2 rounded-xl border ${
            activeForecast.dataQualityBadge === 'REAL'
              ? 'bg-emerald-900/60 text-emerald-400 border-emerald-700/50'
              : 'bg-amber-900/60 text-amber-400 border-amber-700/50'
          }`}>
            {activeForecast.dataQualityBadge === 'REAL' ? <ShieldCheck className="w-5 h-5" /> : <Database className="w-5 h-5" />}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                activeForecast.dataQualityBadge === 'REAL'
                  ? 'bg-emerald-900 text-emerald-200 border-emerald-700/60'
                  : 'bg-amber-900 text-amber-200 border-amber-700/60'
              }`}>
                {activeForecast.dataQualityBadge === 'REAL' ? 'REAL VERIFIED ROUTE TRAINING' : 'CALIBRATED DEVELOPMENT PROXY'}
              </span>
              <span className="text-xs font-semibold">
                Provenance: {governance?.dataProvenance || 'Calibrated Development Proxy (SIMULATED & DERIVED)'}
              </span>
            </div>
            <p className="text-xs opacity-80 mt-1">
              {activeForecast.dataQualityBadge === 'REAL'
                ? `Training gate passed. Active model trained strictly on 52+ continuous verified route fixtures for route ${activeForecast.realTrainingGate?.targetRouteCode || 'C18 / P9'}.`
                : `REAL ROUTE TRAINING: UNAVAILABLE — insufficient verified historical observations (${activeForecast.realTrainingGate?.currentCount ?? 0}/52 collected). Current forecast and performance backtesting are based on calibrated development/proxy data.`}
            </p>
          </div>
        </div>
        <div className="text-right font-mono text-xs">
          <span className="font-semibold block">
            {activeForecast.dataQualityBadge === 'REAL' ? 'REAL ROUTE TRAINING ACTIVE' : 'GATE: 52 WEEKS REQUIRED'}
          </span>
          <span className="text-[11px] opacity-70">
            {activeForecast.realTrainingGate ? `${activeForecast.realTrainingGate.currentCount}/${activeForecast.realTrainingGate.minimumRequiredCount} Weeks Verified` : 'Development Proxy'}
          </span>
        </div>
      </div>

      {/* Model Governance Card (New Mandatory Section) */}
      {governance && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-950 text-purple-400 border border-purple-800/40">
                <Cpu className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-white">Model Governance & Lineage</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-purple-300 border border-purple-800/30 text-xs font-mono">
              {governance.modelVersion}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Training Date</span>
              <span className="text-xs font-semibold text-white font-mono">{governance.trainingDate}</span>
            </div>
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Dataset Version</span>
              <span className="text-xs font-semibold text-slate-200 font-mono truncate block" title={governance.datasetVersion}>
                {governance.datasetVersion}
              </span>
            </div>
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Train Observations</span>
              <span className="text-xs font-semibold text-cyan-400 font-mono">{governance.trainingObservations} weeks</span>
            </div>
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Test Observations</span>
              <span className="text-xs font-semibold text-emerald-400 font-mono">{governance.testObservations} out-of-sample</span>
            </div>
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Validation Method</span>
              <span className="text-xs font-semibold text-amber-300 truncate block" title={governance.validationMethod}>
                Expanding Window
              </span>
            </div>
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Data Provenance</span>
              <span className="text-xs font-semibold text-amber-400 font-mono">{governance.dataProvenance}</span>
            </div>
          </div>

          {/* Feature Engineering Pipeline Catalog */}
          <div className="mt-4 pt-3 border-t border-slate-800/70">
            <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Engineered Features Pipeline ({governance.featureCount} Active Inputs)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {governance.featuresList.map((f, idx) => (
                <div key={idx} className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 text-[11px]">
                  <div className="font-mono text-slate-200 font-medium truncate" title={f.name}>{f.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-slate-400 truncate">{f.type}</span>
                    <span className={`text-[8px] font-bold px-1 rounded ${
                      f.provenance === 'REAL' ? 'bg-emerald-950 text-emerald-300' :
                      f.provenance === 'DERIVED' ? 'bg-blue-950 text-blue-300' :
                      'bg-amber-950 text-amber-300'
                    }`}>
                      {f.provenance}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actual vs Predicted Out-of-Sample Backtest Chart (New Mandatory Section) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                <LineChartIcon className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-white">
                Actual vs Predicted Out-of-Sample Backtest
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical actual freight rate vs model prediction with 90% empirical prediction interval during test period
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-white">
              <span className="w-3 h-0.5 bg-white inline-block"></span>
              Actual Spot Rate
            </span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-3 h-0.5 bg-blue-400 inline-block"></span>
              Ensemble Model Prediction
            </span>
            <span className="flex items-center gap-1.5 text-blue-900">
              <span className="w-3 h-2 bg-blue-500/20 border border-blue-500/40 inline-block rounded-xs"></span>
              90% Interval
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={backtestHistory} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} stroke="#64748b" tick={{ fontSize: 10 }} unit="$" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                formatter={(val: any, name: string) => [`$${Number(val).toFixed(2)}/t`, name]}
              />
              <Area
                type="monotone"
                dataKey="upperBound90"
                stroke="none"
                fill="#3b82f6"
                fillOpacity={0.15}
                name="90% Upper Bound"
              />
              <Area
                type="monotone"
                dataKey="lowerBound90"
                stroke="none"
                fill="#0f172a"
                fillOpacity={1}
                name="90% Lower Bound"
              />
              <Line
                type="monotone"
                dataKey="actualRate"
                stroke="#f8fafc"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f8fafc' }}
                name="Historical Actual Freight"
              />
              <Line
                type="monotone"
                dataKey="predictedRate"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#3b82f6' }}
                name="Model Backtest Prediction"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Accuracy & Error Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Directional Accuracy Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-base font-bold text-white mb-1">
            Directional Trend Accuracy (%)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Out-of-sample percentage of periods correctly predicting upward vs downward freight movement
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={models} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" domain={[40, 100]} stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
                <YAxis dataKey="name" type="category" stroke="#64748b" tick={{ fontSize: 10 }} width={120} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Directional Accuracy']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="directionalAccuracy" radius={[0, 4, 4, 0]}>
                  {models.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MAE & RMSE Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-base font-bold text-white mb-1">
            Error Metrics: MAE vs RMSE ($/Tonne)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Mean Absolute Error and Root Mean Square Error computed via expanding window backtest
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={models} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 9 }} interval={0} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="$" />
                <Tooltip
                  formatter={(val: any, name: string) => [`$${val}/t`, name.toUpperCase()]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="mae" fill="#3b82f6" name="MAE ($/t)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rmse" fill="#f59e0b" name="RMSE ($/t)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Model Benchmark Performance Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-base font-bold text-white mb-1">
          Candidate Models Out-of-Sample Scorecard
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          All values dynamically computed from historical expanding-window cross-validation over the test horizon.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Model Architecture</th>
                <th className="py-2.5 px-3">Classification</th>
                <th className="py-2.5 px-3 text-right">MAE ($/t)</th>
                <th className="py-2.5 px-3 text-right">RMSE ($/t)</th>
                <th className="py-2.5 px-3 text-right">MAPE (%)</th>
                <th className="py-2.5 px-3 text-right">Directional Acc</th>
                <th className="py-2.5 px-3">Validation Methodology</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {models.map((m, idx) => (
                <tr key={idx} className={m.isBest ? 'bg-blue-950/30 font-semibold text-white' : 'hover:bg-slate-800/30'}>
                  <td className="py-2.5 px-3 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }}></span>
                    <span>{m.name}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{m.type}</td>
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
                    {m.isBest ? (
                      activeForecast.dataQualityBadge === 'REAL' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800/50">
                          PRODUCTION BEST (REAL DATA)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-bold border border-amber-800/50">
                          BEST ON DEVELOPMENT DATA
                        </span>
                      )
                    ) : (
                      <span className="text-slate-500 text-[10px]">Benchmark</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forecast Confidence Breakdown Section */}
      {confidence && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Grounded Forecast Confidence Quantification</h3>
                <p className="text-xs text-slate-400">Confidence is calculated directly from measurable factors, not arbitrary numbers.</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold text-emerald-400">{confidence.scorePct}%</span>
              <span className="text-[10px] text-slate-400 block">Composite Confidence</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400">Error Factor (MAPE)</span>
                <span className="font-bold text-cyan-400">{confidence.errorScore}/100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${confidence.errorScore}%` }}></div>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Inversely proportional to backtest MAPE</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400">Horizon Uncertainty</span>
                <span className="font-bold text-blue-400">{confidence.horizonScore}/100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${confidence.horizonScore}%` }}></div>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Decays deterministically with lead time</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400">Market Volatility Factor</span>
                <span className="font-bold text-amber-400">{confidence.volatilityScore}/100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${confidence.volatilityScore}%` }}></div>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Penalized during high volatility regimes</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400">Model Consensus</span>
                <span className="font-bold text-emerald-400">{confidence.modelAgreementScore}/100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${confidence.modelAgreementScore}%` }}></div>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Higher when GBDT, AR, and MA agree</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>{confidence.methodologyNote}</span>
          </div>
        </div>
      )}
    </div>
  );
};
