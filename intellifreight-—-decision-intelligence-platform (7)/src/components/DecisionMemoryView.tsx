import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  AlertTriangle,
  Database,
  Tag,
} from 'lucide-react';
import { DecisionRecord } from '../types';

interface DecisionMemoryViewProps {
  decisions: DecisionRecord[];
  onUpdateActualOutcome: (decisionId: string, actualRate: number, actualCost: number) => void;
}

export const DecisionMemoryView: React.FC<DecisionMemoryViewProps> = ({
  decisions,
  onUpdateActualOutcome,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actualRateInput, setActualRateInput] = useState<string>('17.10');
  const [actualCostInput, setActualCostInput] = useState<string>('1230000');

  const safeDecisions = Array.isArray(decisions) ? decisions : [];

  const getForecastRate = (d: DecisionRecord): number | null => {
    if (typeof d.predictedRateUsdPerTonne === 'number' && !isNaN(d.predictedRateUsdPerTonne)) {
      return d.predictedRateUsdPerTonne;
    }
    if (typeof d.expectedRateUsdPerTonne === 'number' && !isNaN(d.expectedRateUsdPerTonne)) {
      return d.expectedRateUsdPerTonne;
    }
    return null;
  };

  const getActualRate = (d: DecisionRecord): number | null => {
    if (!d.actualOutcome) return null;
    if (typeof d.actualOutcome.actualRateAchievedUsd === 'number' && !isNaN(d.actualOutcome.actualRateAchievedUsd)) {
      return d.actualOutcome.actualRateAchievedUsd;
    }
    if (typeof d.actualOutcome.actualRateUsdPerTonne === 'number' && !isNaN(d.actualOutcome.actualRateUsdPerTonne)) {
      return d.actualOutcome.actualRateUsdPerTonne;
    }
    return null;
  };

  const getRateVariance = (d: DecisionRecord): number | null => {
    if (!d.actualOutcome) return null;
    if (typeof d.actualOutcome.rateVariancePct === 'number' && !isNaN(d.actualOutcome.rateVariancePct)) {
      return d.actualOutcome.rateVariancePct;
    }
    if (typeof d.actualOutcome.variancePct === 'number' && !isNaN(d.actualOutcome.variancePct)) {
      return d.actualOutcome.variancePct;
    }
    return null;
  };

  const getCargoVolume = (d: DecisionRecord): number | null => {
    if (typeof d.cargoQuantityTonnes === 'number' && !isNaN(d.cargoQuantityTonnes)) {
      return d.cargoQuantityTonnes;
    }
    if (typeof d.volumeTonnes === 'number' && !isNaN(d.volumeTonnes)) {
      return d.volumeTonnes;
    }
    return null;
  };

  const isRecordSimulated = (d: DecisionRecord): boolean => {
    if (d.isSimulated === true) return true;
    if (d.provenance === 'SIMULATED' || d.dataStatus === 'SIMULATED') return true;
    if (d.auditTrail?.provenanceStatus === 'SIMULATED') return true;
    if (typeof d.id === 'string' && (
      d.id.startsWith('dec-2026-0') ||
      d.id.startsWith('dec-2026-03') ||
      d.id.startsWith('dec-2026-05') ||
      d.id.startsWith('dec-2026-07') ||
      d.id.startsWith('dec-2026-08') ||
      d.id.includes('benchmark') ||
      d.id.includes('simulated')
    )) {
      return true;
    }
    return false;
  };

  const simulatedCount = safeDecisions.filter(isRecordSimulated).length;
  const liveCount = safeDecisions.length - simulatedCount;

  const handleSaveActual = (id: string) => {
    const rate = parseFloat(actualRateInput);
    const cost = parseFloat(actualCostInput);
    if (!isNaN(rate) && !isNaN(cost)) {
      onUpdateActualOutcome(id, rate, cost);
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800/40">
                <History className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Decision Memory & Outcome Performance Tracker
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Immutable institutional audit trail of chartering decisions. Distinguishes active live decisions from historical simulated benchmarks used for algorithmic calibration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs px-3 py-1.5 rounded-xl bg-purple-950/70 border border-purple-800/50 text-purple-300">
              Simulated Benchmarks: <strong className="text-white font-mono">{simulatedCount}</strong>
            </div>
            <div className="text-xs px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-800/50 text-emerald-300">
              Live Decisions: <strong className="text-white font-mono">{liveCount}</strong>
            </div>
            <div className="text-xs px-3 py-1.5 rounded-xl bg-blue-950 border border-blue-800 text-blue-300">
              Total Logged: <strong className="text-white font-mono">{safeDecisions.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Decisions Audit Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Date & Fixture ID</th>
                <th className="py-2.5 px-3">Data Provenance</th>
                <th className="py-2.5 px-3">Cargo & Route</th>
                <th className="py-2.5 px-3">Recommended Strategy</th>
                <th className="py-2.5 px-3">Vessel & Timing</th>
                <th className="py-2.5 px-3 text-right">Forecast Rate</th>
                <th className="py-2.5 px-3 text-right">Actual Rate</th>
                <th className="py-2.5 px-3 text-right">Variance</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {safeDecisions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 italic">
                    No chartering decisions recorded yet. Run a contract analysis or add a fixture to populate Decision Memory.
                  </td>
                </tr>
              ) : (
                safeDecisions.map((d) => {
                  const hasActual = !!d.actualOutcome;
                  const isEditing = editingId === d.id;
                  const isSimulated = isRecordSimulated(d);

                  const forecastRate = getForecastRate(d);
                  const actualRate = getActualRate(d);
                  const variance = getRateVariance(d);
                  const volume = getCargoVolume(d);

                  const dateDisplay = d.timestamp && typeof d.timestamp === 'string'
                    ? d.timestamp.substring(0, 10)
                    : 'N/A';

                  const confidenceDisplay = typeof (d.confidenceScorePct ?? d.confidencePct) === 'number'
                    ? `${d.confidenceScorePct ?? d.confidencePct}%`
                    : 'N/A';

                  const riskDisplay = d.riskLevel
                    ? d.riskLevel
                    : typeof d.riskScore === 'number'
                    ? d.riskScore > 60
                      ? 'HIGH'
                      : d.riskScore > 30
                      ? 'MEDIUM'
                      : 'LOW'
                    : 'N/A';

                  return (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3">
                        <div className="font-mono text-white font-semibold">{dateDisplay}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{d.id || 'N/A'}</div>
                      </td>

                      <td className="py-3 px-3">
                        {isSimulated ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/50">
                            SIMULATED BENCHMARK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                            LIVE PERSISTED
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">
                          {d.commodity || 'Coal'} ({volume !== null ? `${(volume / 1000).toFixed(0)}k MT` : 'Volume N/A'})
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {d.originPort || 'Origin'} → {d.destinationPort || 'Destination'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-cyan-300">{d.recommendedStrategy || 'N/A'}</div>
                        <div className="text-[10px] text-slate-400">
                          Risk: {riskDisplay} • Conf: {confidenceDisplay}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-slate-200">{d.recommendedVesselClass || d.recommendedVessel || 'Panamax'}</div>
                        <div className="text-[10px] text-emerald-400">{d.entryTiming || d.marketEntryTiming || 'Prompt'}</div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                        {forecastRate !== null ? (
                          `$${forecastRate.toFixed(2)}/t`
                        ) : (
                          <span className="text-slate-500 font-normal italic">Unavailable</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <span>$</span>
                            <input
                              type="number"
                              step="0.1"
                              value={actualRateInput}
                              onChange={(e) => setActualRateInput(e.target.value)}
                              className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white"
                            />
                          </div>
                        ) : actualRate !== null ? (
                          <span className="font-bold text-white font-mono">
                            ${actualRate.toFixed(2)}/t
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Pending</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono">
                        {variance !== null ? (
                          <span
                            className={`font-semibold ${
                              variance <= 0
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {variance > 0 ? '+' : ''}
                            {variance.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            (d.status || (hasActual ? 'COMPLETED' : 'ANALYZED')) === 'COMPLETED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : (d.status || 'ANALYZED') === 'FIXTURE_EXECUTED' || (d.status || 'ANALYZED') === 'EXECUTED'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {d.status || (hasActual ? 'COMPLETED' : 'ANALYZED')}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSaveActual(d.id)}
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : !hasActual ? (
                          <button
                            onClick={() => {
                              setEditingId(d.id);
                              setActualRateInput(forecastRate !== null ? forecastRate.toFixed(2) : '17.00');
                            }}
                            className="px-2 py-1 rounded bg-blue-900/60 hover:bg-blue-800 text-blue-300 text-[11px] font-medium"
                          >
                            Record Fixture
                          </button>
                        ) : (
                          <span className="text-emerald-400 text-[10px] flex items-center justify-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verified</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
