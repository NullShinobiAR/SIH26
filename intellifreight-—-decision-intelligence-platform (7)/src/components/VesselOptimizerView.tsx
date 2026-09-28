import React from 'react';
import {
  Ship,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Anchor,
  Maximize2,
  Ruler,
  Compass,
  ArrowRight,
} from 'lucide-react';
import {
  VesselFeasibilityResult,
  Port,
  Vessel,
  CharteringAnalysisResponse,
} from '../types';

interface VesselOptimizerViewProps {
  analysis: CharteringAnalysisResponse;
  onSelectVessel?: (vessel: Vessel) => void;
}

export const VesselOptimizerView: React.FC<VesselOptimizerViewProps> = ({
  analysis,
}) => {
  const { vesselFeasibilities, originPort, destinationPort, recommendedVessel } = analysis;

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-blue-950 text-blue-400 border border-blue-800/40">
                <Ship className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Vessel Optimizer & Deterministic Feasibility Validation
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Evaluating dry bulk vessel classes against hard physical port limits: LOA, beam, draft, berth length, and handling capability at{' '}
              <span className="text-white font-semibold">{originPort.name}</span> and{' '}
              <span className="text-emerald-400 font-semibold">{destinationPort.name}</span>.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-medium">
              Deterministic Rules Engine
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-950 border border-blue-800 text-blue-300 font-medium">
              Zero Physical Violations Allowed
            </span>
          </div>
        </div>

        {/* Port Restrictions Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-4 border-t border-slate-800">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 uppercase font-bold">Origin: {originPort.name}</div>
              <div className="text-xs text-slate-300 mt-1 flex items-center gap-3">
                <span>Max Draft: <strong className="text-white font-mono">{originPort.maxDraft}m</strong></span>
                <span>Max LOA: <strong className="text-white font-mono">{originPort.maxLoa}m</strong></span>
                <span>Max Beam: <strong className="text-white font-mono">{originPort.maxBeam}m</strong></span>
              </div>
            </div>
            <Anchor className="w-5 h-5 text-blue-400 shrink-0" />
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 uppercase font-bold">Destination: {destinationPort.name}</div>
              <div className="text-xs text-slate-300 mt-1 flex items-center gap-3">
                <span>Max Draft: <strong className="text-emerald-400 font-mono">{destinationPort.maxDraft}m</strong></span>
                <span>Max LOA: <strong className="text-emerald-400 font-mono">{destinationPort.maxLoa}m</strong></span>
                <span>Max Beam: <strong className="text-emerald-400 font-mono">{destinationPort.maxBeam}m</strong></span>
              </div>
            </div>
            <Anchor className="w-5 h-5 text-emerald-400 shrink-0" />
          </div>
        </div>
      </div>

      {/* Candidate Vessel Feasibility Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {vesselFeasibilities.map((vf) => {
          const v = vf.vessel;
          const isRec = v.id === recommendedVessel.id;
          const isFeasible = vf.isFeasible;

          return (
            <div
              key={v.id}
              className={`rounded-2xl p-5 border transition-all shadow-xl ${
                isRec
                  ? 'bg-blue-950/40 border-blue-500 shadow-blue-950/40'
                  : isFeasible
                  ? 'bg-slate-900 border-slate-700 hover:border-slate-600'
                  : 'bg-slate-900/60 border-red-900/40 opacity-85'
              }`}
            >
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{v.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                      {v.vesselClass}
                    </span>
                    {isRec && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    DWT: <strong className="text-slate-200">{v.dwt.toLocaleString()} MT</strong> • Flag: {v.flag} • Built: {v.yearBuilt}
                  </div>
                </div>

                <div>
                  {isFeasible ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-700/60 text-emerald-400 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>FEASIBLE</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border border-red-700/60 text-red-400 text-xs font-bold">
                      <XCircle className="w-4 h-4" />
                      <span>REJECTED</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Constraint Checks Grid */}
              <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                {/* Draft check */}
                <div className={`p-2.5 rounded-lg border ${
                  vf.checks.draft.passed ? 'bg-slate-950/70 border-slate-800' : 'bg-red-950/30 border-red-800/60'
                }`}>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Draft Margin</div>
                  <div className="text-sm font-bold font-mono mt-0.5 text-white">
                    {vf.checks.draft.value}m
                    <span className="text-[10px] text-slate-400 font-normal ml-1">/ {vf.checks.draft.limit}m</span>
                  </div>
                  <div className={`text-[10px] mt-1 font-semibold ${
                    vf.checks.draft.passed ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {vf.checks.draft.passed ? `+${vf.checks.draft.margin}m clearance` : `Exceeds by ${Math.abs(vf.checks.draft.margin || 0)}m`}
                  </div>
                </div>

                {/* LOA check */}
                <div className={`p-2.5 rounded-lg border ${
                  vf.checks.loa.passed ? 'bg-slate-950/70 border-slate-800' : 'bg-red-950/30 border-red-800/60'
                }`}>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Length (LOA)</div>
                  <div className="text-sm font-bold font-mono mt-0.5 text-white">
                    {vf.checks.loa.value}m
                    <span className="text-[10px] text-slate-400 font-normal ml-1">/ {vf.checks.loa.limit}m</span>
                  </div>
                  <div className={`text-[10px] mt-1 font-semibold ${
                    vf.checks.loa.passed ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {vf.checks.loa.passed ? `+${vf.checks.loa.margin}m margin` : `Exceeds limit`}
                  </div>
                </div>

                {/* Capacity Match */}
                <div className="p-2.5 rounded-lg border bg-slate-950/70 border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Cargo Intake Match</div>
                  <div className="text-sm font-bold font-mono mt-0.5 text-cyan-300">
                    {vf.checks.capacityMatch.loadPct}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {vf.checks.capacityMatch.loadPct > 105 ? 'Under-sized (Multiple holds)' : vf.checks.capacityMatch.loadPct < 70 ? 'Deadfreight risk' : 'Optimal parcel'}
                  </div>
                </div>
              </div>

              {/* Rejection / Pass explanation message */}
              <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs">
                {!isFeasible ? (
                  <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl text-red-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-red-300">Rejection Cause: </span>
                      {vf.rejectionReason}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-emerald-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-300">Operational Feasibility Confirmed: </span>
                      Vessel satisfies all port physical and tidal parameters. Economic speed: {v.speedKnots} kts, Sea fuel: {v.fuelConsumptionSeaTpd} t/day.
                    </div>
                  </div>
                )}
              </div>

              {/* Operational & Hire economics */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400 px-1">
                <div>
                  Daily Hire: <strong className="text-white font-mono">${v.dailyHireRateUsd.toLocaleString()}/day</strong>
                </div>
                <div>
                  Current Status:{' '}
                  <span className={`font-semibold ${v.availabilityStatus === 'AVAILABLE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {v.availabilityStatus} ({v.currentPosition.area})
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
