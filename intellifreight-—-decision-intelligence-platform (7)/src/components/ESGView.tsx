import React, { useState } from 'react';
import {
  Leaf,
  Fuel,
  TrendingDown,
  ShieldCheck,
  Award,
  Zap,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { CharteringAnalysisResponse } from '../types';
import { calculateEsgOptions, EsgOptimizationResult } from '../engines/esgEngine';

interface ESGViewProps {
  analysis: CharteringAnalysisResponse;
}

export const ESGView: React.FC<ESGViewProps> = ({ analysis }) => {
  const { recommendedVessel, route, voyageCost } = analysis;
  const [shadowCarbonPrice, setShadowCarbonPrice] = useState<number>(65);

  const esgResults = calculateEsgOptions(
    recommendedVessel,
    route,
    voyageCost.cargoQuantityTonnes,
    612.5,
    shadowCarbonPrice
  );

  const esgOptions: EsgOptimizationResult[] = [
    esgResults.costFirst,
    esgResults.balanced,
    esgResults.green,
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                <Leaf className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                ESG & Decarbonisation Intelligence Module (IMO GHG / EEOI / CII)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Evaluate voyage carbon intensity, IMO EEOI operational benchmarks, CII rating bands, and carbon shadow tax trade-offs.
            </p>
          </div>

          {/* Shadow Carbon Price Slider */}
          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">Carbon Shadow Price:</span>
            <input
              type="range"
              min="20"
              max="150"
              step="5"
              value={shadowCarbonPrice}
              onChange={(e) => setShadowCarbonPrice(parseInt(e.target.value, 10))}
              className="w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <span className="text-xs font-mono font-bold text-emerald-400">${shadowCarbonPrice} / t CO2</span>
          </div>
        </div>
      </div>

      {/* Primary ESG Cards: Cost-First vs Balanced vs Green Speed Mode */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {esgOptions.map((opt) => (
          <div
            key={opt.mode}
            className={`rounded-2xl p-5 border shadow-xl flex flex-col justify-between ${
              opt.mode === 'Balanced'
                ? 'bg-gradient-to-b from-blue-950/60 to-slate-900 border-2 border-emerald-500/60'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-slate-950 text-emerald-400">
                    <Zap className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-bold text-white">{opt.mode} Mode</h3>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 uppercase">EEOI Rating:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                      opt.eeoiRating === 'A'
                        ? 'bg-emerald-950 text-emerald-400'
                        : opt.eeoiRating === 'B'
                        ? 'bg-cyan-950 text-cyan-400'
                        : opt.eeoiRating === 'C'
                        ? 'bg-amber-950 text-amber-400'
                        : 'bg-red-950 text-red-400'
                    }`}
                  >
                    Grade {opt.eeoiRating}
                  </span>
                </div>
              </div>

              {/* Speed & Transit metrics */}
              <div className="my-4 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Transit Speed:</span>
                  <span className="font-mono font-bold text-white">{opt.speedKnots} Knots</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Sea Passage Days:</span>
                  <span className="font-mono text-slate-200">{opt.seaDays} Days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Bunker Consumed:</span>
                  <span className="font-mono font-bold text-amber-400">{opt.vlsfoTonnes} MT VLSFO</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total CO2 Emitted:</span>
                  <span className="font-mono font-bold text-emerald-400">{opt.totalCo2Tonnes} MT</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">EEOI Metric:</span>
                  <span className="font-mono text-cyan-300 font-semibold">{opt.eeoiScore} gCO2/t-nm</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Emissions / Tonne:</span>
                  <span className="font-mono font-bold text-white">{opt.co2KgPerTonneCargo} kg CO2 / t</span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Bunker Fuel Expense:</span>
                  <span className="font-mono font-bold text-white">${opt.bunkerCostUsd.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Carbon Shadow Tax (@${shadowCarbonPrice}/t):</span>
                  <span className="font-mono text-emerald-400">${opt.carbonTaxCostUsd.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Net Carbon-Adjusted Cost:</span>
              <span className="font-mono font-bold text-base text-white">
                ${opt.totalVoyageEcoCostUsd.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* IMO Decarbonization Trajectory Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="font-bold text-emerald-400 flex items-center gap-1.5">
            <Award className="w-4 h-4" />
            <span>IMO 2030 / 2050 GHG Strategy Alignment</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            International Maritime Organization mandates a 40% carbon intensity reduction by 2030. Steaming at 12.2 knots instead of 13.5 knots saves significant bunker fuel and reduces gross CO2 output with negligible inventory holding cost impacts.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="font-bold text-cyan-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>EU ETS & Global Scope 3 Disclosures</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Indian steel conglomerates (Tata Steel, JSW, SAIL) reporting under BRSR (Business Responsibility and Sustainability Reporting) track Scope 3 raw material ocean freight. IntelliFreight auto-generates auditable voyage emissions certificates.
          </p>
        </div>
      </div>
    </div>
  );
};
