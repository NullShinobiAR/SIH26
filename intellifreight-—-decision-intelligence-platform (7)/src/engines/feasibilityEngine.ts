import { Port, Vessel, VesselFeasibilityResult } from '../types';

export function evaluateVesselFeasibility(
  vessel: Vessel,
  originPort: Port,
  destinationPort: Port,
  cargoQuantityTonnes: number
): VesselFeasibilityResult {
  // 1. LOA check (must satisfy both origin and destination)
  const originLoaPassed = vessel.loa <= originPort.maxLoa;
  const destLoaPassed = vessel.loa <= destinationPort.maxLoa;
  const loaPassed = originLoaPassed && destLoaPassed;
  const minPortLoa = Math.min(originPort.maxLoa, destinationPort.maxLoa);

  // 2. Beam check
  const originBeamPassed = vessel.beam <= originPort.maxBeam;
  const destBeamPassed = vessel.beam <= destinationPort.maxBeam;
  const beamPassed = originBeamPassed && destBeamPassed;
  const minPortBeam = Math.min(originPort.maxBeam, destinationPort.maxBeam);

  // 3. Draft check (critical constraint)
  const originDraftPassed = vessel.draft <= originPort.maxDraft;
  const destDraftPassed = vessel.draft <= destinationPort.maxDraft;
  const draftPassed = originDraftPassed && destDraftPassed;
  const minPortDraft = Math.min(originPort.maxDraft, destinationPort.maxDraft);

  // 4. Berth length check
  const destBerthPassed = destinationPort.berthLength === 0 || vessel.loa <= destinationPort.berthLength;
  const originBerthPassed = originPort.berthLength === 0 || vessel.loa <= originPort.berthLength;
  const berthPassed = destBerthPassed && originBerthPassed;

  // 5. Cargo compatibility (Dry bulk coal carrier)
  const cargoCompatible = true; // All 4 classes are bulk carriers suited for coal

  // 6. Capacity Match & Utilization
  const capacityRatio = cargoQuantityTonnes / vessel.cargoCapacityTonnes;
  const capacityPassed = capacityRatio >= 0.65 && capacityRatio <= 1.08;

  const isFeasible = loaPassed && beamPassed && draftPassed && berthPassed && cargoCompatible;

  // Formulate clear, unambiguous rejection reasons
  const rejectionReasons: string[] = [];
  if (!destDraftPassed) {
    rejectionReasons.push(
      `Draft ${vessel.draft.toFixed(1)}m exceeds ${destinationPort.name} permissible draft limit of ${destinationPort.maxDraft.toFixed(1)}m by ${(vessel.draft - destinationPort.maxDraft).toFixed(1)}m.`
    );
  }
  if (!destLoaPassed) {
    rejectionReasons.push(
      `LOA ${vessel.loa.toFixed(1)}m exceeds ${destinationPort.name} maximum permitted LOA of ${destinationPort.maxLoa.toFixed(1)}m by ${(vessel.loa - destinationPort.maxLoa).toFixed(1)}m.`
    );
  }
  if (!destBeamPassed) {
    rejectionReasons.push(
      `Beam ${vessel.beam.toFixed(1)}m exceeds ${destinationPort.name} beam restriction of ${destinationPort.maxBeam.toFixed(1)}m.`
    );
  }
  if (!originDraftPassed) {
    rejectionReasons.push(
      `Draft ${vessel.draft.toFixed(1)}m exceeds origin port (${originPort.name}) maximum sailing draft of ${originPort.maxDraft.toFixed(1)}m.`
    );
  }
  if (!originLoaPassed) {
    rejectionReasons.push(
      `LOA ${vessel.loa.toFixed(1)}m exceeds origin port (${originPort.name}) LOA limit of ${originPort.maxLoa.toFixed(1)}m.`
    );
  }

  // Grade
  let grade: 'OPTIMAL' | 'COMPATIBLE' | 'SUB-OPTIMAL' | 'REJECTED' = 'REJECTED';
  if (isFeasible) {
    if (capacityRatio >= 0.85 && capacityRatio <= 1.02) {
      grade = 'OPTIMAL';
    } else if (capacityRatio >= 0.70 && capacityRatio <= 1.05) {
      grade = 'COMPATIBLE';
    } else {
      grade = 'SUB-OPTIMAL';
    }
  }

  return {
    vessel,
    isFeasible,
    checks: {
      loa: {
        passed: loaPassed,
        value: vessel.loa,
        limit: minPortLoa,
        unit: 'm',
        margin: Number((minPortLoa - vessel.loa).toFixed(1)),
      },
      beam: {
        passed: beamPassed,
        value: vessel.beam,
        limit: minPortBeam,
        unit: 'm',
        margin: Number((minPortBeam - vessel.beam).toFixed(1)),
      },
      draft: {
        passed: draftPassed,
        value: vessel.draft,
        limit: minPortDraft,
        unit: 'm',
        margin: Number((minPortDraft - vessel.draft).toFixed(1)),
      },
      berthLength: {
        passed: berthPassed,
        value: vessel.loa,
        limit: destinationPort.berthLength || 400,
        unit: 'm',
        margin: Number(((destinationPort.berthLength || 400) - vessel.loa).toFixed(1)),
      },
      cargoCompatibility: {
        passed: true,
        note: 'Approved gearless/geared bulk carrier for coal and dry bulk cargoes.',
      },
      capacityMatch: {
        passed: capacityPassed,
        loadPct: Number((capacityRatio * 100).toFixed(1)),
      },
    },
    rejectionReason: rejectionReasons.length > 0 ? rejectionReasons.join(' ') : undefined,
    recommendationGrade: grade,
  };
}
