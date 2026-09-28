import React, { useState } from 'react';
import {
  FlaskConical,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Sliders,
  DollarSign,
  Fuel,
  Ship,
  Clock,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  CharteringAnalysisResponse,
  ScenarioInput,
  ScenarioResult,
} from '../types';
import { runScenarioAnalysis } from '../engines/scenarioEngine';

interface ScenarioLabViewProps {
  analysis: CharteringAnalysisResponse;
}

export const ScenarioLabView: React.FC<ScenarioLabViewProps> = ({ analysis }) => {
  // Scenario inputs
  const [freightShockPct, setFreightShockPct] = useState<number>(15);
  const [bunkerShockPct, setBunkerShockPct] = useState<number>(20);
  const [congestionDeltaDays, setCongestionDeltaDays] = useState<number>(3);
  const [cargoQtyChangePct, setCargoQtyChangePct] = useState<number>(0);
  const [weatherMultiplier, setWeatherMultiplier] = useState<number>(1.2);

  const scenarioInput: ScenarioInput = {
    freightRateChangePct: freightShockPct,
    bunkerPriceChangePct: bunkerShockPct,
    portCongestionDeltaDays: congestionDeltaDays,
    cargoQuantityChangePct: cargoQtyChangePct,
    weatherSeverityMultiplier: weatherMultiplier,
    vesselAvailabilityDropPct: 0,
  };

  const result: ScenarioResult = runScenarioAnalysis(analysis, scenarioInput);

  const handleReset = () => {
    setFreightShockPct(0);
    setBunkerShockPct(0);
    setCongestionDeltaDays(0);
    setCargoQtyChangePct(0);
    setWeatherMultiplier(1.0);
  };

  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'oil_spike':
        setFreightShockPct(10);
        setBunkerShockPct(35);
        setCongestionDeltaDays(0);
        setCargoQtyChangePct(0);
        setWeatherMultiplier(1.0);
        break;
      case 'monsoon_delays':
        setFreightShockPct(5);
        setBunkerShockPct(5);
        setCongestionDeltaDays(5);
        setCargoQtyChangePct(0);
        setWeatherMultiplier(1.4);
        break;
      case 'freight_crash':
        setFreightShockPct(-25);
        setBunkerShockPct(-15);
        setCongestionDeltaDays(-1);
        setCargoQtyChangePct(0);
        setWeatherMultiplier(1.0);
        break;
      case 'demand_boom':
        setFreightShockPct(30);
        setBunkerShockPct(15);
        setCongestionDeltaDays(4);
        setCargoQtyChangePct(20);
        setWeatherMultiplier(1.1);
        break;
      default:
        handleReset();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-purple-950 text-purple-400 border border-purple-800/40">
                <FlaskConical className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Scenario Stress Lab & Sensitivity Sandbox
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Stress-test contract recommendations against macroeconomic market shocks, severe weather disruptions, and bunker surges.
            </p>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Shocks</span>
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800">
          <span className="text-xs text-slate-400 font-semibold">Stress Presets:</span>
          <button
            onClick={() => applyPreset('oil_spike')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
          >
            Bunker Spike (+35%)
          </button>
          <button
            onClick={() => applyPreset('monsoon_delays')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
          >
            Monsoon Congestion (+5d delay)
          </button>
          <button
            onClick={() => applyPreset('freight_crash')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
          >
            Market Bearish Slump (-25%)
          </button>
          <button
            onClick={() => applyPreset('demand_boom')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
          >
            Steel Mill Supercycle (+30% freight)
          </button>
        </div>
      </div>

      {/* Interactive Controls & Scenario Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>Stress Test Parameters</span>
          </h3>

          {/* Freight Rate Shock */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>Freight Rate Shock</span>
              </span>
              <span className="font-mono text-cyan-400">
                {freightShockPct > 0 ? `+${freightShockPct}%` : `${freightShockPct}%`}
              </span>
            </div>
            <input
              type="range"
              min="-40"
              max="60"
              step="5"
              value={freightShockPct}
              onChange={(e) => setFreightShockPct(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>-40% (Crash)</span>
              <span>Baseline</span>
              <span>+60% (Spike)</span>
            </div>
          </div>

          {/* Bunker Price Shock */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5 text-amber-400" />
                <span>Bunker Fuel Price Shock</span>
              </span>
              <span className="font-mono text-amber-400">
                {bunkerShockPct > 0 ? `+${bunkerShockPct}%` : `${bunkerShockPct}%`}
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="50"
              step="5"
              value={bunkerShockPct}
              onChange={(e) => setBunkerShockPct(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>-30%</span>
              <span>Baseline</span>
              <span>+50% (OPEC Cut)</span>
            </div>
          </div>

          {/* Port Congestion Delta */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-red-400" />
                <span>Destination Port Congestion</span>
              </span>
              <span className="font-mono text-red-400">
                {congestionDeltaDays >= 0 ? `+${congestionDeltaDays}` : congestionDeltaDays} Days
              </span>
            </div>
            <input
              type="range"
              min="-2"
              max="8"
              step="1"
              value={congestionDeltaDays}
              onChange={(e) => setCongestionDeltaDays(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>-2d (Fast Pilot)</span>
              <span>+8d (Cyclone Queue)</span>
            </div>
          </div>

          {/* Weather Severity Multiplier */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1">
                <Ship className="w-3.5 h-3.5 text-indigo-400" />
                <span>Weather Severity Factor</span>
              </span>
              <span className="font-mono text-indigo-400">{weatherMultiplier.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="1.6"
              step="0.1"
              value={weatherMultiplier}
              onChange={(e) => setWeatherMultiplier(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
            />
          </div>
        </div>

        {/* Results Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Comparison Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Stressed Contract Economics</h3>
                <div className="text-xs text-slate-400">Total multi-voyage program impact</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 uppercase font-semibold">Strategy Stability:</span>
                <div
                  className={`text-sm font-bold uppercase ${
                    result.strategyChanged ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {result.strategyChanged ? 'STRATEGY FLIPPED' : 'RECOMMENDATION ROBUST'}
                </div>
              </div>
            </div>

            {/* Financial Delta Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Base Plan Expected Cost</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  ${result.baseCostUsd.toLocaleString()}
                </div>
                <div className="text-xs font-mono text-slate-400 mt-0.5">
                  ${result.baseCostPerTonne.toFixed(2)} / tonne
                </div>
                <div className="text-[11px] text-cyan-300 font-semibold mt-2">
                  Strategy: {result.baseRecommendedStrategy.toUpperCase()}
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  result.costDeltaUsd > 0
                    ? 'bg-red-950/20 border-red-800/40'
                    : 'bg-emerald-950/20 border-emerald-800/40'
                }`}
              >
                <div className="text-xs text-slate-400">Stressed Scenario Cost</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  ${result.scenarioCostUsd.toLocaleString()}
                </div>
                <div className="text-xs font-mono text-slate-400 mt-0.5">
                  ${result.scenarioCostPerTonne.toFixed(2)} / tonne
                </div>
                <div className="text-[11px] font-semibold mt-2 flex items-center gap-1">
                  <span>Strategy:</span>
                  <span className={result.strategyChanged ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                    {result.scenarioRecommendedStrategy.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Delta Banner */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Cost Variance vs Base:</span>
              <span
                className={`text-sm font-mono font-bold ${
                  result.costDeltaUsd > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {result.costDeltaUsd > 0 ? '+' : ''}${result.costDeltaUsd.toLocaleString()} ({result.costDeltaPct > 0 ? '+' : ''}{result.costDeltaPct}%)
              </span>
            </div>

            {/* Strategic Insights */}
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Automated Sensitivity Insights:
              </div>
              <div className="space-y-1.5">
                {result.keyInsights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
