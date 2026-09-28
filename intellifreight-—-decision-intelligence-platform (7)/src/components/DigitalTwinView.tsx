import React, { useState } from 'react';
import {
  Compass,
  Play,
  RotateCcw,
  Sliders,
  Wind,
  Fuel,
  Clock,
  Ship,
  Anchor,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  TrendingDown,
} from 'lucide-react';
import { CharteringAnalysisResponse } from '../types';
import { simulateDigitalTwinVoyage } from '../engines/digitalTwinEngine';

interface DigitalTwinViewProps {
  analysis: CharteringAnalysisResponse;
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({ analysis }) => {
  const { recommendedVessel, originPort, destinationPort, route, voyageCost } = analysis;

  // Interactive Twin parameters
  const [speedKnots, setSpeedKnots] = useState<number>(recommendedVessel.speedKnots);
  const [vlsfoPriceUsd, setVlsfoPriceUsd] = useState<number>(612.5);
  const [congestionDeltaDays, setCongestionDeltaDays] = useState<number>(0);
  const [weatherFactor, setWeatherFactor] = useState<number>(1.0);
  const [activeStageIdx, setActiveStageIdx] = useState<number>(3); // 0-indexed stage selection

  // Run dynamic simulation
  const sim = simulateDigitalTwinVoyage({
    vessel: recommendedVessel,
    originPort,
    destinationPort,
    route,
    cargoQuantityTonnes: voyageCost.cargoQuantityTonnes,
    speedKnots,
    vlsfoPriceUsd,
    congestionDeltaDays,
    weatherSeverityFactor: weatherFactor,
    handlingRateMultiplier: 1.0,
  });

  const activeStage = sim.stages[activeStageIdx] || sim.stages[0];

  const handleReset = () => {
    setSpeedKnots(recommendedVessel.speedKnots);
    setVlsfoPriceUsd(612.5);
    setCongestionDeltaDays(0);
    setWeatherFactor(1.0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                <Compass className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Interactive Maritime Voyage Digital Twin Simulator
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Physics-grounded simulation tracking each leg of {recommendedVessel.name}'s journey across 12 distinct stages from {originPort.name} to {destinationPort.name}.
            </p>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Simulation Parameters</span>
          </button>
        </div>

        {/* Live Simulator Controls (Speed, Bunker, Congestion, Weather sliders) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 p-4 rounded-xl bg-slate-950 border border-slate-800">
          {/* Speed Slider */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Ship className="w-3.5 h-3.5 text-cyan-400" />
                <span>Transit Speed</span>
              </span>
              <span className="font-mono text-cyan-400">{speedKnots.toFixed(1)} kts</span>
            </div>
            <input
              type="range"
              min="10.0"
              max="15.0"
              step="0.5"
              value={speedKnots}
              onChange={(e) => setSpeedKnots(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Eco (11.0 kts)</span>
              <span>Design (13.5 kts)</span>
            </div>
          </div>

          {/* VLSFO Bunker Price */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5 text-amber-400" />
                <span>VLSFO Bunker Price</span>
              </span>
              <span className="font-mono text-amber-400">${vlsfoPriceUsd}/t</span>
            </div>
            <input
              type="range"
              min="450"
              max="850"
              step="10"
              value={vlsfoPriceUsd}
              onChange={(e) => setVlsfoPriceUsd(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>$450/t (Soft)</span>
              <span>$850/t (High Spike)</span>
            </div>
          </div>

          {/* Port Congestion Shock */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-red-400" />
                <span>Congestion Delta</span>
              </span>
              <span className="font-mono text-red-400">
                {congestionDeltaDays >= 0 ? `+${congestionDeltaDays}` : congestionDeltaDays} days
              </span>
            </div>
            <input
              type="range"
              min="-2"
              max="6"
              step="1"
              value={congestionDeltaDays}
              onChange={(e) => setCongestionDeltaDays(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-400"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>-2d (Fast Pilot)</span>
              <span>+6d (Severe Queue)</span>
            </div>
          </div>

          {/* Weather Factor */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-purple-400" />
                <span>Bay of Bengal Weather</span>
              </span>
              <span className="font-mono text-purple-400">
                {weatherFactor === 1.0 ? 'Nominal (1.0x)' : weatherFactor > 1.0 ? `Monsoon (${weatherFactor}x)` : 'Calm'}
              </span>
            </div>
            <input
              type="range"
              min="0.9"
              max="1.5"
              step="0.1"
              value={weatherFactor}
              onChange={(e) => setWeatherFactor(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Calm</span>
              <span>Cyclone Warning (1.5x)</span>
            </div>
          </div>
        </div>

        {/* Dynamic Twin Metrics Output Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Simulated Duration</div>
            <div className="text-xl font-bold font-mono text-white mt-0.5">{sim.totalVoyageDays.toFixed(1)} Days</div>
            <div className="text-[10px] text-slate-400">{sim.totalSeaDays.toFixed(1)}d sea • {sim.totalPortDays.toFixed(1)}d port</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Bunker Burn</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">{sim.totalVlsfoTonnes.toFixed(1)} MT</div>
            <div className="text-[10px] text-slate-400">+{sim.totalMgoTonnes.toFixed(1)} MT MGO aux</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">CO2 Emissions</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{sim.totalCo2Tonnes.toFixed(1)} MT</div>
            <div className="text-[10px] text-slate-400">EEOI: {sim.eeoiScore} g/t-nm</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Demurrage / Delay</div>
            <div className="text-xl font-bold font-mono text-red-400 mt-0.5">{(sim.congestionDelayHours / 24).toFixed(1)} Days</div>
            <div className="text-[10px] text-slate-400">{sim.congestionDelayHours} hrs queue</div>
          </div>

          <div className="p-3 rounded-xl bg-blue-950/80 border border-blue-800">
            <div className="text-[10px] text-blue-300 uppercase font-bold">Total Twin Cost</div>
            <div className="text-xl font-bold font-mono text-cyan-300 mt-0.5">${sim.totalCostUsd.toLocaleString()}</div>
            <div className="text-[10px] text-blue-200">${(sim.totalCostUsd / voyageCost.cargoQuantityTonnes).toFixed(2)} / tonne</div>
          </div>
        </div>
      </div>

      {/* 12-Stage Visual Progress Ribbon */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Interactive 12-Stage Voyage Timeline</span>
          </span>
          <span className="text-xs text-slate-400 font-normal">
            Click any stage to inspect physics, fuel, and telemetry
          </span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {sim.stages.map((stg, idx) => {
            const isSelected = idx === activeStageIdx;
            return (
              <button
                key={stg.id}
                onClick={() => setActiveStageIdx(idx)}
                className={`p-3 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'bg-blue-950 border-cyan-400 shadow-md shadow-blue-950 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-1">
                  <span className={isSelected ? 'text-cyan-400' : 'text-slate-400'}>
                    Stage {idx + 1}
                  </span>
                  <span className="font-mono text-slate-400">{(stg.durationHours / 24).toFixed(1)}d</span>
                </div>
                <div className="text-xs font-semibold truncate">{stg.name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  {stg.fuelBurnTonnes.toFixed(1)}t fuel • {stg.co2EmittedTonnes.toFixed(0)}t CO2
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Stage Detail Inspector */}
        <div className="mt-5 p-5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-2">
            <div className="text-[10px] uppercase font-bold text-cyan-400">Selected Stage Telemetry</div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <span>{activeStage.name}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {activeStage.status}
              </span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {activeStage.details}
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Duration / Time in Stage:</span>
              <span className="font-mono font-bold text-white">{activeStage.durationHours} Hours ({(activeStage.durationHours / 24).toFixed(2)} Days)</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Fuel Consumed:</span>
              <span className="font-mono font-bold text-amber-400">{activeStage.fuelBurnTonnes.toFixed(1)} MT</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Cumulative Days Elapsed:</span>
              <span className="font-mono font-bold text-cyan-300">{activeStage.cumulativeDays.toFixed(1)} Days</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">CO2 Released:</span>
              <span className="font-mono font-bold text-emerald-400">{activeStage.co2EmittedTonnes.toFixed(1)} Tonnes</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Location Area:</span>
              <span className="font-mono font-bold text-white">{activeStage.locationName}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Operational Risk Factors:</span>
              <span className="font-semibold text-amber-400 truncate max-w-[150px]">
                {activeStage.riskFactors.join(', ') || 'Nominal'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
