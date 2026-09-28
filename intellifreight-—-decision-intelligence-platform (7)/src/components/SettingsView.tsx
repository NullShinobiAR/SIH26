import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  DollarSign,
  Server,
  RefreshCw,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [costWeight, setCostWeight] = useState<number>(0.5);
  const [riskWeight, setRiskWeight] = useState<number>(0.3);
  const [greenWeight, setGreenWeight] = useState<number>(0.2);
  const [saved, setSaved] = useState<boolean>(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-slate-800 text-slate-300">
            <Settings className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-white">System Configuration & Optimizer Calibration</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tune objective loss functions, operational demurrage thresholds, and external API gateways.
            </p>
          </div>
        </div>
      </div>

      {/* Optimizer Weights */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-blue-400" />
          <span>Multi-Attribute Decision Optimization (MADO) Weight Vectors</span>
        </h3>
        <p className="text-xs text-slate-400">
          Set the relative importance of direct freight expenses, market uncertainty penalties, and carbon emissions in contract strategy selection.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span>Cost Minimization Weight</span>
              <span className="font-mono text-cyan-400">{(costWeight * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={costWeight}
              onChange={(e) => setCostWeight(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span>Risk Hedging Weight</span>
              <span className="font-mono text-amber-400">{(riskWeight * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={riskWeight}
              onChange={(e) => setRiskWeight(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span>Green / Carbon Penalty Weight</span>
              <span className="font-mono text-emerald-400">{(greenWeight * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.5"
              step="0.05"
              value={greenWeight}
              onChange={(e) => setGreenWeight(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Calibration Saved!</span>
              </>
            ) : (
              <span>Save Weights</span>
            )}
          </button>
        </div>
      </div>

      {/* Backend API Endpoints & Health */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-400" />
          <span>Active Backend API Services</span>
        </h3>

        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
            <div>
              <span className="font-mono font-bold text-white">POST /api/chartering/run</span>
              <div className="text-slate-400 text-[11px]">Full 10-stage analysis coordinator pipeline</div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold">200 OK</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
            <div>
              <span className="font-mono font-bold text-white">GET /api/freight/forecast</span>
              <div className="text-slate-400 text-[11px]">Ensemble, GBDT, Seasonal Autoregressive Ridge time-series predictions</div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold">200 OK</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
            <div>
              <span className="font-mono font-bold text-white">POST /api/digital-twin/simulate</span>
              <div className="text-slate-400 text-[11px]">12-stage vessel voyage physics simulator</div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold">200 OK</span>
          </div>
        </div>
      </div>
    </div>
  );
};
