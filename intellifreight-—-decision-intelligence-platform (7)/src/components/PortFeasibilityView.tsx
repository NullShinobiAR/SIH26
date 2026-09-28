import React, { useState } from 'react';
import {
  Anchor,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Compass,
  Ship,
  Info,
} from 'lucide-react';
import { PORTS, VESSELS } from '../data/maritimeData';
import { Port, VesselClass } from '../types';

export const PortFeasibilityView: React.FC = () => {
  const indianPorts = PORTS.filter((p) => p.country === 'India');
  const [selectedPortId, setSelectedPortId] = useState<string>('in-dhm');

  const selectedPort = indianPorts.find((p) => p.id === selectedPortId) || indianPorts[0];

  const vesselClasses: VesselClass[] = ['Handysize', 'Supramax', 'Panamax', 'Capesize'];

  // Check compatibility of each class at this port
  const classChecks = vesselClasses.map((vc) => {
    const repVessel = VESSELS.find((v) => v.vesselClass === vc)!;
    const draftPassed = repVessel.draft <= selectedPort.maxDraft;
    const loaPassed = repVessel.loa <= selectedPort.maxLoa;
    const isPassed = draftPassed && loaPassed;

    const reasons: string[] = [];
    if (!draftPassed) {
      reasons.push(
        `Draft ${repVessel.draft}m exceeds port permissible draft limit of ${selectedPort.maxDraft}m`
      );
    }
    if (!loaPassed) {
      reasons.push(
        `LOA ${repVessel.loa}m exceeds max permitted LOA of ${selectedPort.maxLoa}m`
      );
    }

    return {
      vesselClass: vc,
      representativeVessel: repVessel,
      isPassed,
      draftPassed,
      loaPassed,
      reasons,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                <Anchor className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Port Infrastructure & Berth Constraints Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic verification of all major Indian East Coast bulk terminals. Physical limits act as strict non-negotiable boundaries.
            </p>
          </div>
        </div>

        {/* Port Selector Pills */}
        <div className="flex items-center gap-2 mt-5 overflow-x-auto pb-1 scrollbar-none">
          {indianPorts.map((port) => (
            <button
              key={port.id}
              onClick={() => setSelectedPortId(port.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedPort.id === port.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {port.name}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Port Deep Dive Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Port Specifications Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-lg font-bold text-white">{selectedPort.name}</h3>
              <p className="text-xs text-slate-400">{selectedPort.country} East Coast Gateway</p>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-slate-800 text-[11px] font-mono text-cyan-400">
              {selectedPort.latitude.toFixed(2)}°N, {selectedPort.longitude.toFixed(2)}°E
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Maximum Permissible Draft:</span>
              <span className="font-bold text-base font-mono text-cyan-400">{selectedPort.maxDraft} m</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Maximum Permitted LOA:</span>
              <span className="font-bold text-base font-mono text-white">{selectedPort.maxLoa} m</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Maximum Permitted Beam:</span>
              <span className="font-bold text-base font-mono text-white">{selectedPort.maxBeam} m</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Coal Discharge Handling Rate:</span>
              <span className="font-bold text-base font-mono text-emerald-400">
                {selectedPort.cargoHandlingRateTpd.toLocaleString()} MT / day
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Average Anchorage Waiting:</span>
              <span className="font-bold text-base font-mono text-amber-400">
                {selectedPort.averageWaitingDays} days ({selectedPort.waitingVesselsCount} vessels)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Base Port PDA Charges:</span>
              <span className="font-bold text-base font-mono text-slate-200">
                ${selectedPort.portChargesBaseUsd.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>Tidal & Operational Directives</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {selectedPort.tidalRestrictions}
            </p>
            <p className="text-slate-400 text-[11px] leading-relaxed pt-1">
              {selectedPort.operationalNotes}
            </p>
          </div>
        </div>

        {/* Right 2-Cols: Vessel Compatibility Matrix at this Port */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ship className="w-4 h-4 text-cyan-400" />
                <span>Dry Bulk Class Feasibility at {selectedPort.name}</span>
              </h3>
              <p className="text-xs text-slate-400">
                Physical constraint solver results for Handysize, Supramax, Panamax, and Capesize.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {classChecks.map((chk) => (
              <div
                key={chk.vesselClass}
                className={`p-4 rounded-xl border transition-all ${
                  chk.isPassed
                    ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    : 'bg-red-950/20 border-red-900/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    <span>{chk.vesselClass}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({chk.representativeVessel.dwt.toLocaleString()} DWT)
                    </span>
                  </div>
                  {chk.isPassed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-800">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>COMPATIBLE</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950 text-red-400 text-[10px] font-bold border border-red-800">
                      <XCircle className="w-3 h-3" />
                      <span>INCOMPATIBLE</span>
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vessel Draft vs Port Max:</span>
                    <span className={`font-mono font-semibold ${chk.draftPassed ? 'text-emerald-400' : 'text-red-400'}`}>
                      {chk.representativeVessel.draft}m vs {selectedPort.maxDraft}m
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Vessel LOA vs Port Max:</span>
                    <span className={`font-mono font-semibold ${chk.loaPassed ? 'text-emerald-400' : 'text-red-400'}`}>
                      {chk.representativeVessel.loa}m vs {selectedPort.maxLoa}m
                    </span>
                  </div>
                </div>

                {/* Incompatible reason or approval note */}
                <div className="mt-3 pt-2 border-t border-slate-800 text-[11px]">
                  {!chk.isPassed ? (
                    <div className="text-red-300 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span>{chk.reasons.join('. ')}</span>
                    </div>
                  ) : (
                    <div className="text-emerald-300 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        Safe under-keel clearance: +{(selectedPort.maxDraft - chk.representativeVessel.draft).toFixed(1)}m. Turnaround ~
                        {(chk.representativeVessel.cargoCapacityTonnes / selectedPort.cargoHandlingRateTpd).toFixed(1)} days.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
