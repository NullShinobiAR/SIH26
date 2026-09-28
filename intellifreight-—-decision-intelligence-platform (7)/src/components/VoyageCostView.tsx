import React from 'react';
import {
  Calculator,
  DollarSign,
  Fuel,
  Clock,
  Anchor,
  Leaf,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { CharteringAnalysisResponse } from '../types';

interface VoyageCostViewProps {
  analysis: CharteringAnalysisResponse;
}

export const VoyageCostView: React.FC<VoyageCostViewProps> = ({ analysis }) => {
  const { voyageCost, recommendedVessel, originPort, destinationPort, request } = analysis;

  const costBreakdownItems = [
    {
      category: 'Pure Ocean Freight',
      cost: voyageCost.freightCost,
      perTonne: Number((voyageCost.freightCost / voyageCost.cargoQuantityTonnes).toFixed(2)),
      pct: Number(((voyageCost.freightCost / voyageCost.totalVoyageCostUsd) * 100).toFixed(1)),
      color: '#3b82f6',
      description: `Agreed freight rate: $${(voyageCost.freightCost / voyageCost.cargoQuantityTonnes).toFixed(2)}/t × ${voyageCost.cargoQuantityTonnes.toLocaleString()} MT`,
    },
    {
      category: 'Bunker Sea Propulsion (VLSFO)',
      cost: voyageCost.bunkerSeaCost,
      perTonne: Number((voyageCost.bunkerSeaCost / voyageCost.cargoQuantityTonnes).toFixed(2)),
      pct: Number(((voyageCost.bunkerSeaCost / voyageCost.totalVoyageCostUsd) * 100).toFixed(1)),
      color: '#f59e0b',
      description: `${voyageCost.seaDays} sea days × ${recommendedVessel.fuelConsumptionSeaTpd} t/day @ $612.5/t VLSFO`,
    },
    {
      category: 'Bunker Port Auxiliary (MGO/VLSFO)',
      cost: voyageCost.bunkerPortCost,
      perTonne: Number((voyageCost.bunkerPortCost / voyageCost.cargoQuantityTonnes).toFixed(2)),
      pct: Number(((voyageCost.bunkerPortCost / voyageCost.totalVoyageCostUsd) * 100).toFixed(1)),
      color: '#fbbf24',
      description: `${voyageCost.portDays + voyageCost.waitingDays} port/waiting days × auxiliary generators & boiler`,
    },
    {
      category: 'Port Disbursement Accounts (PDA)',
      cost: voyageCost.portDisbursementCost,
      perTonne: Number((voyageCost.portDisbursementCost / voyageCost.cargoQuantityTonnes).toFixed(2)),
      pct: Number(((voyageCost.portDisbursementCost / voyageCost.totalVoyageCostUsd) * 100).toFixed(1)),
      color: '#8b5cf6',
      description: `Harbour dues, pilotage, tugs, berth hire at ${originPort.name} and ${destinationPort.name}`,
    },
    {
      category: 'Congestion & Demurrage Exposure',
      cost: voyageCost.expectedDelayCost,
      perTonne: Number((voyageCost.expectedDelayCost / voyageCost.cargoQuantityTonnes).toFixed(2)),
      pct: Number(((voyageCost.expectedDelayCost / voyageCost.totalVoyageCostUsd) * 100).toFixed(1)),
      color: '#ef4444',
      description: `${voyageCost.waitingDays} days expected anchorage queue × $${Math.round(recommendedVessel.dailyHireRateUsd * 1.1).toLocaleString()}/day demurrage`,
    },
    {
      category: 'Ballast Repositioning & Idle Risk',
      cost: voyageCost.expectedIdleCost,
      perTonne: Number((voyageCost.expectedIdleCost / voyageCost.cargoQuantityTonnes).toFixed(2)),
      pct: Number(((voyageCost.expectedIdleCost / voyageCost.totalVoyageCostUsd) * 100).toFixed(1)),
      color: '#ec4899',
      description: 'Deadheading buffer allowance for repositioning back into international charter pool',
    },
    {
      category: 'Canal, Insurance & Agency Fees',
      cost: voyageCost.otherVoyageCost,
      perTonne: Number((voyageCost.otherVoyageCost / voyageCost.cargoQuantityTonnes).toFixed(2)),
      pct: Number(((voyageCost.otherVoyageCost / voyageCost.totalVoyageCostUsd) * 100).toFixed(1)),
      color: '#6366f1',
      description: 'Straits passage, hull war risk insurance, protective agent disbursements',
    },
    {
      category: 'IMO Carbon Cost / ETS',
      cost: voyageCost.carbonCost,
      perTonne: Number((voyageCost.carbonCost / voyageCost.cargoQuantityTonnes).toFixed(2)),
      pct: Number(((voyageCost.carbonCost / voyageCost.totalVoyageCostUsd) * 100).toFixed(1)),
      color: '#10b981',
      description: `${voyageCost.co2EmissionsTonnes} tonnes CO2 emitted @ $65/tonne shadow carbon tax`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800/40">
                <Calculator className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Comprehensive Voyage Cost Engine (True Total Logistics Cost)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Never optimize freight rate alone. Total Voyage Cost models base freight, bunker burn, port PDAs, demurrage exposure, and carbon tax.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-right">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Single Voyage Cost</div>
              <div className="text-xl font-bold font-mono text-white">
                ${voyageCost.totalVoyageCostUsd.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-blue-950 border border-blue-800 rounded-xl text-right">
              <div className="text-[10px] text-blue-300 uppercase font-bold">Total {request.numberOfVoyages}x Voyages</div>
              <div className="text-xl font-bold font-mono text-cyan-300">
                ${voyageCost.totalContractCostUsd.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Waterfall & Breakdown Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table of Detailed Components */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-base font-bold text-white mb-3">
            Itemized Voyage Cost Breakdown (Per Voyage: {voyageCost.cargoQuantityTonnes.toLocaleString()} MT)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Cost Component</th>
                  <th className="py-2.5 px-3 text-right">Amount (USD)</th>
                  <th className="py-2.5 px-3 text-right">Cost / Tonne</th>
                  <th className="py-2.5 px-3 text-right">Share (%)</th>
                  <th className="py-2.5 px-3">Calculation Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {costBreakdownItems.map((item) => (
                  <tr key={item.category} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-white">{item.category}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      ${item.cost.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-cyan-300">
                      ${item.perTonne.toFixed(2)}/t
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-400">
                      {item.pct}%
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400">
                      {item.description}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 font-bold text-white bg-slate-950/80">
                  <td className="py-3 px-3">Total Expected Single Voyage Cost</td>
                  <td className="py-3 px-3 text-right font-mono text-cyan-400">
                    ${voyageCost.totalVoyageCostUsd.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-cyan-400">
                    ${voyageCost.costPerTonneUsd.toFixed(2)}/t
                  </td>
                  <td className="py-3 px-3 text-right font-mono">100.0%</td>
                  <td className="py-3 px-3 text-xs text-slate-400">
                    Full arrangement ({request.numberOfVoyages}x): ${voyageCost.totalContractCostUsd.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Cost Distribution Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Expense Share</h3>
            <p className="text-xs text-slate-400 mb-4">Relative cost percentage distribution</p>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costBreakdownItems}
                    dataKey="cost"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {costBreakdownItems.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Cost']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 text-xs pt-4 border-t border-slate-800">
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Total Bunker Burn:</span>
              <span className="font-mono font-bold text-white">{voyageCost.vlsfoConsumedTonnes} MT VLSFO + {voyageCost.mgoConsumedTonnes} MT MGO</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Total CO2 Emitted:</span>
              <span className="font-mono font-bold text-emerald-400">{voyageCost.co2EmissionsTonnes} MT CO2 ({voyageCost.co2PerTonneCargo} kg/t cargo)</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Total Voyage Duration:</span>
              <span className="font-mono font-bold text-white">{voyageCost.totalDurationDays} Days ({voyageCost.seaDays}d sea / {voyageCost.portDays + voyageCost.waitingDays}d port)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
