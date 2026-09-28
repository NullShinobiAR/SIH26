import React, { useState } from 'react';
import {
  MapPin,
  Train,
  Ship,
  Anchor,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Navigation,
} from 'lucide-react';
import { CharteringAnalysisResponse } from '../types';
import { MaritimeCorridorMap } from './MaritimeCorridorMap';

interface RouteOptimizerViewProps {
  analysis: CharteringAnalysisResponse;
}

export const RouteOptimizerView: React.FC<RouteOptimizerViewProps> = ({ analysis }) => {
  const { originPort, alternativePorts, destinationPort, recommendedVessel, voyageCost } = analysis;
  const [selectedPortId, setSelectedPortId] = useState<string>(destinationPort?.id || 'in-dhm');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                <MapPin className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Indian East Coast Port Arbitrage & Total Landed Cost Comparison
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Evaluating port congestion, draft restrictions, rail freight to inland steel mills (Kalinganagar / Rourkela / Jamshedpur), and lighterage expenses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
              Origin: <span className="font-semibold text-white">{originPort.name.split(' ')[0]}</span>
            </div>
            <div className="text-xs px-3 py-1.5 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-semibold">
              Primary Target: {destinationPort.name}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Geographic Maritime Corridor Map */}
      <MaritimeCorridorMap
        originPort={originPort}
        destinationPort={destinationPort}
        alternativePorts={alternativePorts}
        recommendedVessel={recommendedVessel}
        selectedPortId={selectedPortId}
        onSelectPort={(id) => setSelectedPortId(id)}
      />

      {/* Alternative Ports Comparison Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-white">
            East Coast Bulk Terminals: Ocean-to-Gate Economic Ranking
          </h3>
          <span className="text-[11px] text-slate-400">
            Click any row or map marker to compare route & landed cost metrics
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Port Terminal</th>
                <th className="py-2.5 px-3">Permissible Draft</th>
                <th className="py-2.5 px-3 text-center">Avg Queue</th>
                <th className="py-2.5 px-3 text-right">Ocean Freight</th>
                <th className="py-2.5 px-3 text-right">Port PDA</th>
                <th className="py-2.5 px-3 text-right">Demurrage Exp</th>
                <th className="py-2.5 px-3 text-right">Inland Rail Freight</th>
                <th className="py-2.5 px-3 text-right">Landed Cost / t</th>
                <th className="py-2.5 px-3 text-right">Cost Delta vs Target</th>
                <th className="py-2.5 px-3">Strategic Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {alternativePorts.map((alt, index) => {
                const portId = alt.portId || alt.port?.id;
                const isSelected = portId === selectedPortId;
                const isTarget = portId && destinationPort?.id ? portId === destinationPort.id : false;
                const draftLimit = typeof alt.draftLimit === 'number'
                  ? alt.draftLimit
                  : typeof alt.port?.maxDraft === 'number'
                  ? alt.port.maxDraft
                  : null;
                const isDraftViolated = draftLimit !== null && typeof recommendedVessel?.draft === 'number'
                  ? recommendedVessel.draft > draftLimit
                  : false;

                const portName = alt.portName || alt.port?.name;
                const expectedWaiting = typeof alt.expectedWaitingDays === 'number'
                  ? alt.expectedWaitingDays
                  : typeof alt.congestionDelayDays === 'number'
                  ? alt.congestionDelayDays
                  : typeof alt.port?.averageWaitingDays === 'number'
                  ? alt.port.averageWaitingDays
                  : null;

                const oceanFreight = typeof alt.oceanFreightRateUsd === 'number'
                  ? alt.oceanFreightRateUsd
                  : typeof alt.freightRateUsdPerTonne === 'number'
                  ? alt.freightRateUsdPerTonne
                  : null;

                const portCharges = typeof alt.portChargesUsd === 'number'
                  ? alt.portChargesUsd
                  : null;

                const demurrageRisk = typeof alt.demurrageRiskUsd === 'number'
                  ? alt.demurrageRiskUsd
                  : null;

                const inlandRail = typeof alt.inlandRailFreightUsd === 'number'
                  ? alt.inlandRailFreightUsd
                  : typeof alt.inlandRailFreightToPlantUsd === 'number'
                  ? alt.inlandRailFreightToPlantUsd
                  : null;

                const totalLandedCost = typeof alt.totalLandedCostPerTonneUsd === 'number'
                  ? alt.totalLandedCostPerTonneUsd
                  : null;

                const deltaVsSelected = typeof alt.deltaVsSelectedPortUsd === 'number'
                  ? alt.deltaVsSelectedPortUsd
                  : typeof alt.savingsVsPrimaryPerTonne === 'number'
                  ? -alt.savingsVsPrimaryPerTonne
                  : null;

                const recommendation = alt.recommendationReason || alt.recommendationNote || 'Strategic evaluation pending.';

                return (
                  <tr
                    key={portId || `alt-port-${index}`}
                    onClick={() => portId && setSelectedPortId(portId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-950/40 ring-1 ring-amber-500/50 font-semibold text-white'
                        : isTarget
                        ? 'bg-cyan-950/30 text-white hover:bg-cyan-950/50'
                        : isDraftViolated
                        ? 'bg-red-950/10 text-slate-400 hover:bg-slate-800/40'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold flex items-center gap-1.5">
                        <span className={isSelected ? 'text-amber-300' : isTarget ? 'text-cyan-300' : 'text-white'}>
                          {portName || <span className="text-slate-500 italic">Port Name Unavailable</span>}
                        </span>
                        {isTarget && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-600 text-[9px] text-white font-bold">
                            TARGET
                          </span>
                        )}
                        {isSelected && !isTarget && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-600 text-[9px] text-white font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {portId ? (
                          portId.toUpperCase()
                        ) : (
                          <span className="text-slate-500 italic">Port ID Unavailable</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      {draftLimit !== null ? (
                        <span className={isDraftViolated ? 'text-red-400 font-bold' : 'text-slate-200'}>
                          {draftLimit}m
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Unavailable</span>
                      )}
                      {isDraftViolated && (
                        <div className="text-[10px] text-red-400">Exceeds draft!</div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center font-mono">
                      {expectedWaiting !== null ? (
                        <span className={expectedWaiting > 3 ? 'text-amber-400' : 'text-emerald-400'}>
                          {expectedWaiting} days
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Unavailable</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono">
                      {oceanFreight !== null ? `$${oceanFreight.toFixed(2)}/t` : <span className="text-slate-500 italic">Unavailable</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {portCharges !== null ? `$${portCharges.toFixed(2)}/t` : <span className="text-slate-500 italic">Unavailable</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {demurrageRisk !== null ? `$${demurrageRisk.toFixed(2)}/t` : <span className="text-slate-500 italic">Unavailable</span>}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-indigo-300">
                      {inlandRail !== null ? `$${inlandRail.toFixed(2)}/t` : <span className="text-slate-500 italic">Unavailable</span>}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-white text-sm">
                      {totalLandedCost !== null ? `$${totalLandedCost.toFixed(2)}/t` : <span className="text-slate-500 italic">Unavailable</span>}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-semibold">
                      {deltaVsSelected === null ? (
                        <span className="text-slate-500 italic">Unavailable</span>
                      ) : deltaVsSelected === 0 ? (
                        <span className="text-slate-500">Baseline</span>
                      ) : deltaVsSelected < 0 ? (
                        <span className="text-emerald-400">-${Math.abs(deltaVsSelected).toFixed(2)}/t</span>
                      ) : (
                        <span className="text-red-400">+${deltaVsSelected.toFixed(2)}/t</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-xs">
                      {isDraftViolated ? (
                        <span className="text-red-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Draft restricted for {recommendedVessel?.vesselClass || 'vessel'}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">{recommendation}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Arbitrage Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
          <div className="font-bold text-cyan-400 flex items-center gap-1.5">
            <Train className="w-4 h-4" />
            <span>Inland Rail Freight Dynamics (FOIS)</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Dhamra and Paradip offer shortest Indian Railways rake lead-time to Odisha/Jharkhand steel hubs (Kalinganagar, Angul, Jamshedpur) compared to southern ports.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
          <div className="font-bold text-amber-400 flex items-center gap-1.5">
            <Anchor className="w-4 h-4" />
            <span>Anchorage Demurrage Buffers</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Paradip often suffers heavy monsoon coal congestion (12-16 waiting bulkers). Dhamra’s dedicated private deep-water berths frequently save $70,000+ in vessel waiting time.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
          <div className="font-bold text-purple-400 flex items-center gap-1.5">
            <Ship className="w-4 h-4" />
            <span>Transhipment / Lighterage at Sagar</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            For Haldia-bound parcels, deep-draft vessels must discharge 20,000–30,000 MT at Sandheads / Sagar anchorage to meet the 8.5m Hooghly river draft limitation.
          </p>
        </div>
      </div>
    </div>
  );
};
