import React from 'react';
import {
  FileCheck2,
  Clock,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Calendar,
  Layers,
} from 'lucide-react';
import { CharteringAnalysisResponse } from '../types';

interface ContractOptimizerViewProps {
  analysis: CharteringAnalysisResponse;
}

export const ContractOptimizerView: React.FC<ContractOptimizerViewProps> = ({
  analysis,
}) => {
  const {
    contractOptions,
    recommendedContract,
    marketEntryTiming,
    freightForecast,
    explanation,
    request,
  } = analysis;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-blue-950 text-blue-400 border border-blue-800/40">
                <FileCheck2 className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Multi-Strategy Contract Optimizer & Market-Entry Timing Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Objective mathematical evaluation balancing expected logistics costs, freight volatility hedging, scheduling flexibility, and port demurrage risk. Spot remains an uncompromised first-class option.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3.5 py-2 rounded-xl bg-blue-950/80 border border-blue-800 text-right">
              <div className="text-[10px] text-blue-300 uppercase font-bold">Optimization Mode</div>
              <div className="text-xs font-bold text-white uppercase">{request.optimizationPreference.replace('_', ' ')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Market Entry Timing Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/50 border border-indigo-700/50 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-lg">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                Recommended Market-Entry Timing Window
              </div>
              <h3 className="text-2xl font-extrabold text-white">
                {marketEntryTiming.action}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
              <div className="text-[10px] text-slate-400 uppercase">Optimal Window</div>
              <div className="text-sm font-bold font-mono text-cyan-400">{marketEntryTiming.optimalWindowDays}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
              <div className="text-[10px] text-slate-400 uppercase">Rate Surge Prob</div>
              <div className="text-sm font-bold font-mono text-emerald-400">
                {marketEntryTiming.probRateIncreasePct}%
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
              <div className="text-[10px] text-slate-400 uppercase">Rate Drop Prob</div>
              <div className="text-sm font-bold font-mono text-slate-400">
                {marketEntryTiming.probRateDecreasePct}%
              </div>
            </div>
          </div>
        </div>

        {/* Drivers of Timing Recommendation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Key Timing Drivers:
            </div>
            {marketEntryTiming.drivers.map((drv, idx) => (
              <div key={idx} className="text-xs text-slate-200 flex items-start gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>{drv}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Maritime Signals:
            </div>
            {marketEntryTiming.marketSignals.map((sig, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
                <div>
                  <span className="font-semibold text-white">{sig.indicator}</span>
                  <div className="text-[11px] text-slate-400">{sig.comment}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  sig.signal === 'bullish'
                    ? 'bg-red-950 text-red-300 border border-red-800'
                    : sig.signal === 'bearish'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {sig.signal}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contract Cards Comparison (4 Strategies Side-by-Side) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {contractOptions.map((opt) => {
          const isRec = opt.isRecommended;

          return (
            <div
              key={opt.strategy}
              className={`rounded-2xl p-5 border flex flex-col justify-between transition-all shadow-xl relative overflow-hidden ${
                isRec
                  ? 'bg-gradient-to-b from-blue-950/70 to-slate-900 border-2 border-blue-500 shadow-blue-950/50'
                  : !opt.isEligible
                  ? 'bg-slate-950/80 border-slate-800/70 opacity-90'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              {isRec && (
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-lg tracking-wider">
                  OPTIMAL SELECTION
                </div>
              )}
              {!opt.isEligible && (
                <div className="absolute top-0 right-0 bg-amber-950/90 text-amber-300 border-b border-l border-amber-800/80 text-[10px] font-bold uppercase px-2.5 py-1 rounded-bl-lg tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>NOT ELIGIBLE</span>
                </div>
              )}

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Strategy {opt.strategy === 'spot' ? '1' : opt.strategy === 'short_term' ? '2' : opt.strategy === 'medium_term' ? '3' : '4'}
                </div>
                <h3 className="text-base font-bold text-white mt-1">{opt.title}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{opt.subtitle}</p>

                {!opt.isEligible && (
                  <div className="my-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 uppercase tracking-wide">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Not eligible for requested voyage count</span>
                    </div>
                    <div className="text-[11px] text-amber-300/90 mt-1 leading-relaxed">
                      {opt.ineligibilityReason}
                    </div>
                  </div>
                )}

                <div className="my-4 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Freight Rate:</span>
                    <span className="text-lg font-bold font-mono text-white">
                      ${opt.agreedRateUsdPerTonne.toFixed(2)}
                      <span className="text-xs text-slate-400 font-sans font-normal ml-1">/ t</span>
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Total Contract:</span>
                    <span className="text-sm font-bold font-mono text-cyan-300">
                      ${opt.totalExpectedCostUsd.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Landed Cost / t:</span>
                    <span className="text-xs font-bold font-mono text-white">
                      ${opt.costPerTonneUsd.toFixed(2)}/t
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Risk-Adjusted Cost:</span>
                    <span className="text-xs font-bold font-mono text-amber-300">
                      ${opt.riskAdjustedCostPerTonne.toFixed(2)}/t
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Optimization Score:</span>
                    <span className="text-xs font-bold font-mono text-cyan-300">
                      {opt.optimizationScore.toFixed(1)} / 100
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline pt-1 border-t border-slate-800">
                    <span className="text-xs text-slate-400">Savings vs Spot:</span>
                    <span className="text-xs font-bold font-mono">
                      {opt.savingsVsSpotPct > 0 ? (
                        <span className="text-emerald-400">+{opt.savingsVsSpotPct}% (${opt.savingsVsSpotUsd.toLocaleString()})</span>
                      ) : (
                        <span className="text-slate-500">Benchmark ($0)</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Scorecards */}
                <div className="space-y-1.5 text-xs text-slate-300 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Risk Exposure:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      opt.riskScore < 40 ? 'bg-emerald-950 text-emerald-400' : opt.riskScore < 60 ? 'bg-amber-950 text-amber-400' : 'bg-red-950 text-red-400'
                    }`}>
                      {opt.riskLevel} ({opt.riskScore}/100)
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Scheduling Flexibility:</span>
                    <span className="font-mono text-white">{opt.flexibilityScore}/100</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Volatility Hedging:</span>
                    <span className="font-mono text-white">{opt.volatilityProtectionScore}/100</span>
                  </div>
                </div>

                {/* Pros / Cons list */}
                <div className="space-y-2 text-[11px]">
                  <div>
                    <span className="font-bold text-slate-300 block mb-1">Key Advantages:</span>
                    {opt.whyRecommended?.slice(0, 2).map((item, i) => (
                      <div key={i} className="text-slate-300 flex items-start gap-1.5 mb-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <span className="font-bold text-slate-400 block mb-1">Risk Exposure:</span>
                    {opt.keyRisks.slice(0, 2).map((risk, i) => (
                      <div key={i} className="text-slate-400 flex items-start gap-1.5 mb-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                        <span>{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-center">
                {isRec ? (
                  <div className="w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-900/50">
                    OPTIMAL SELECTION
                  </div>
                ) : !opt.isEligible ? (
                  <div className="w-full py-2 rounded-lg bg-amber-950/30 text-amber-400/90 border border-amber-900/40 text-xs font-semibold">
                    NOT ELIGIBLE ({opt.minVoyagesRequired}+ VOYAGES)
                  </div>
                ) : (
                  <div className="w-full py-2 rounded-lg bg-slate-800/80 text-slate-400 text-xs font-semibold">
                    ALTERNATIVE CANDIDATE
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Explainable AI: Trade-Off Analysis */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          <span>Explainable AI (XAI) Attribution & Mathematical Trade-Offs</span>
        </h3>
        {(() => {
          const hasEligibleAlternatives = contractOptions.filter(
            (o) => o.strategy !== recommendedContract.strategy && o.isEligible
          ).length > 0;

          return (
            <>
              <p className="text-xs text-slate-400">
                {hasEligibleAlternatives
                  ? `Decomposing why the algorithm selected ${recommendedContract.title} over alternatives. Real model weights and quantified deltas:`
                  : `Decomposing why the algorithm selected ${recommendedContract.title} under the requested voyage count. Single-voyage baseline evaluation:`}
              </p>

              {!hasEligibleAlternatives && (
                <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-blue-200 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white">Single-Voyage Eligibility Constraint: </span>
                    Spot selected because it is the only eligible strategy for the current voyage count. All other candidate contract structures require multi-voyage volume commitments (3–12 voyages) and are strictly excluded from recommendation.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Why this recommendation was selected:
                  </h4>
                  <div className="space-y-2 text-xs text-slate-300">
                    {explanation.whyThisRecommendation.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-cyan-400 font-bold font-mono shrink-0">{idx + 1}.</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    What market conditions could change this decision?
                  </h4>
                  <div className="space-y-2 text-xs text-slate-300">
                    {explanation.whatCouldChangeThis.map((trigger, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{trigger}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quantified Trade-Off Analysis Table */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    {hasEligibleAlternatives ? 'Mathematical Trade-Off Decomposition' : 'Single-Voyage Strategy Baseline Profile'}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {hasEligibleAlternatives
                      ? 'Attribution Delta = Recommended Strategy − Runner-Up Strategy'
                      : 'Single-voyage baseline evaluation (No eligible multi-voyage alternatives)'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 px-3 font-semibold">Decision Metric</th>
                        <th className="py-2 px-3 font-semibold text-cyan-300">Recommended ({recommendedContract.title})</th>
                        <th className="py-2 px-3 font-semibold text-slate-300">
                          {hasEligibleAlternatives ? 'Runner-Up Alternative' : 'Alternative Candidates'}
                        </th>
                        <th className="py-2 px-3 font-semibold text-right">
                          {hasEligibleAlternatives ? 'Attribution Delta' : 'Evaluation Baseline'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 font-mono">
                      {explanation.quantifiedTradeoffs.map((item, idx) => {
                        const isAdvantage = item.delta.includes('saving') || item.delta.includes('advantage');
                        const isCaution = item.delta.includes('higher risk') || item.delta.includes('premium');
                        const isBaseline = item.delta.includes('baseline') || item.delta.includes('Sole eligible');
                        const deltaColorClass = isAdvantage
                          ? 'text-emerald-400'
                          : isCaution
                          ? 'text-amber-300'
                          : isBaseline
                          ? 'text-cyan-400'
                          : 'text-slate-300';

                        return (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="py-2 px-3 font-sans text-slate-300">{item.metric}</td>
                            <td className="py-2 px-3 text-cyan-300 font-bold">{item.chosen}</td>
                            <td className="py-2 px-3 text-slate-400">{item.runnerUp}</td>
                            <td className={`py-2 px-3 text-right font-bold ${deltaColorClass}`}>{item.delta}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};
