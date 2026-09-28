import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Sliders,
  Calendar,
  Anchor,
  Ship,
  Sparkles,
  ChevronDown,
  Fuel,
} from 'lucide-react';
import {
  CharteringAnalysisRequest,
  CommodityType,
  OptimizationPreference,
  Port,
} from '../types';

interface CharteringAnalysisFormProps {
  ports: Port[];
  initialRequest: CharteringAnalysisRequest;
  onRunAnalysis: (request: CharteringAnalysisRequest) => void;
  isAnalyzing: boolean;
}

export const CharteringAnalysisForm: React.FC<CharteringAnalysisFormProps> = ({
  ports,
  initialRequest,
  onRunAnalysis,
  isAnalyzing,
}) => {
  const [commodity, setCommodity] = useState<CommodityType>(initialRequest.commodity);
  const [cargoQuantityTonnes, setCargoQuantityTonnes] = useState<number>(initialRequest.cargoQuantityTonnes);
  const [numberOfVoyages, setNumberOfVoyages] = useState<number>(initialRequest.numberOfVoyages);
  const [originPortId, setOriginPortId] = useState<string>(initialRequest.originPortId);
  const [destinationPortId, setDestinationPortId] = useState<string>(initialRequest.destinationPortId);
  const [deliveryWindowStart, setDeliveryWindowStart] = useState<string>(initialRequest.deliveryWindowStart);
  const [deliveryWindowEnd, setDeliveryWindowEnd] = useState<string>(initialRequest.deliveryWindowEnd);
  const [contractHorizonPreference, setContractHorizonPreference] = useState<'flexible' | 'spot' | 'short_term' | 'medium_term'>(
    initialRequest.contractHorizonPreference
  );
  const [optimizationPreference, setOptimizationPreference] = useState<OptimizationPreference>(
    initialRequest.optimizationPreference
  );
  const [includeCarbonCost, setIncludeCarbonCost] = useState<boolean>(initialRequest.includeCarbonCost);

  const originPorts = ports.filter((p) => p.country !== 'India');
  const destinationPorts = ports.filter((p) => p.country === 'India');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRunAnalysis({
      commodity,
      cargoQuantityTonnes: Number(cargoQuantityTonnes),
      numberOfVoyages: Number(numberOfVoyages),
      originPortId,
      destinationPortId,
      deliveryWindowStart,
      deliveryWindowEnd,
      contractHorizonPreference,
      optimizationPreference,
      includeCarbonCost,
    });
  };

  const handleResetToDemo = () => {
    setCommodity('Coking Coal');
    setCargoQuantityTonnes(70000);
    setNumberOfVoyages(4);
    setOriginPortId('au-hpt');
    setDestinationPortId('in-dhm');
    setDeliveryWindowStart('2026-10-01');
    setDeliveryWindowEnd('2026-12-31');
    setContractHorizonPreference('flexible');
    setOptimizationPreference('balanced');
    setIncludeCarbonCost(true);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-4 sm:p-6 text-slate-200">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-950/80 border border-blue-800/40 text-blue-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Chartering Analysis & Decision Parameters</h2>
            <p className="text-xs text-slate-400">
              Configure bulk cargo shipment requirement to run deterministic feasibility, freight forecasting, and contract optimization.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetToDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Demo Preset</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Commodity */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Commodity
            </label>
            <select
              id="input-commodity"
              value={commodity}
              onChange={(e) => setCommodity(e.target.value as CommodityType)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Coking Coal">Coking Coal (Bowen Basin Met)</option>
              <option value="Thermal Coal">Thermal Coal (Steam Coal)</option>
              <option value="PCI Coal">PCI Coal (Pulverized Injection)</option>
              <option value="Iron Ore">Iron Ore (Fines/Lumps)</option>
              <option value="Bauxite">Bauxite (Refractory Grade)</option>
            </select>
          </div>

          {/* Cargo Quantity */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Cargo Qty per Voyage (MT)
            </label>
            <div className="relative">
              <input
                id="input-cargo-quantity"
                type="number"
                min="20000"
                max="200000"
                step="1000"
                value={cargoQuantityTonnes}
                onChange={(e) => setCargoQuantityTonnes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">Tonnes</span>
            </div>
          </div>

          {/* Number of Voyages */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Arrangement Voyages Count
            </label>
            <div className="flex items-center gap-2">
              <input
                id="input-number-voyages"
                type="number"
                min="1"
                max="16"
                value={numberOfVoyages}
                onChange={(e) => setNumberOfVoyages(Math.max(1, Number(e.target.value)))}
                className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <div className="flex-1 text-[11px] text-slate-400">
                Total:{' '}
                <span className="text-cyan-400 font-semibold font-mono">
                  {(cargoQuantityTonnes * numberOfVoyages).toLocaleString()} MT
                </span>{' '}
                contract volume
              </div>
            </div>
          </div>

          {/* Optimization Preference */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Objective Function
            </label>
            <select
              id="input-optimization-preference"
              value={optimizationPreference}
              onChange={(e) => setOptimizationPreference(e.target.value as OptimizationPreference)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="balanced">Balanced (Cost + Market Risk)</option>
              <option value="lowest_cost">Lowest Cost (Min Total Freight)</option>
              <option value="lowest_risk">Lowest Risk (Max Hedging/Certainty)</option>
              <option value="green">Greener Option (Decarbonization / EEOI)</option>
            </select>
          </div>
        </div>

        {/* Origin & Destination Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Origin Port */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Anchor className="w-3.5 h-3.5 text-blue-400" />
              <span>Loading Origin Port</span>
            </label>
            <select
              id="select-origin-port"
              value={originPortId}
              onChange={(e) => setOriginPortId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {originPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.country}) - Max Draft {p.maxDraft}m
                </option>
              ))}
            </select>
          </div>

          {/* Destination Port */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5 text-emerald-400" />
              <span>Indian East Coast Destination</span>
            </label>
            <select
              id="select-destination-port"
              value={destinationPortId}
              onChange={(e) => setDestinationPortId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {destinationPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} - Draft {p.maxDraft}m • {p.waitingVesselsCount} waiting
                </option>
              ))}
            </select>
          </div>

          {/* Laycan / Delivery Window */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Laycan Window Start</span>
            </label>
            <input
              type="date"
              value={deliveryWindowStart}
              onChange={(e) => setDeliveryWindowStart(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Contract Horizon Preference */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Horizon Constraint
            </label>
            <select
              value={contractHorizonPreference}
              onChange={(e) => setContractHorizonPreference(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="flexible">Objective Comparison (Spot vs Multi-Voyage)</option>
              <option value="spot">Constrain to Spot Fixtures</option>
              <option value="short_term">Prefer Short-Term (3–5 Voyages)</option>
              <option value="medium_term">Prefer Medium-Term (6–12 Voyages)</option>
            </select>
          </div>
        </div>

        {/* Action button row */}
        <div className="pt-3 flex flex-wrap items-center justify-between border-t border-slate-800/80 gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeCarbonCost}
              onChange={(e) => setIncludeCarbonCost(e.target.checked)}
              className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 bg-slate-950"
            />
            <span className="flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5 text-emerald-400" />
              <span>Include IMO Carbon Tax / ETS Shadow Price ($65/t CO2)</span>
            </span>
          </label>

          <button
            id="btn-run-chartering-analysis"
            type="submit"
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-sm shadow-lg shadow-blue-950/60 transition active:scale-98 disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isAnalyzing ? 'Executing Intelligence Pipeline...' : 'RUN CHARTERING ANALYSIS'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
