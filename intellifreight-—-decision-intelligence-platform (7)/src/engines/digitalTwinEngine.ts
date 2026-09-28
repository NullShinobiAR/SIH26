import {
  Port,
  Route,
  Vessel,
  DigitalTwinSimulation,
  DigitalTwinStage,
} from '../types';

export interface DigitalTwinParams {
  vessel: Vessel;
  originPort: Port;
  destinationPort: Port;
  route: Route;
  cargoQuantityTonnes: number;
  speedKnots: number;
  vlsfoPriceUsd: number;
  congestionDeltaDays: number;
  weatherSeverityFactor: number; // 1.0 = normal, 1.5 = rough sea
  handlingRateMultiplier: number; // 1.0 = normal
}

export function simulateDigitalTwinVoyage(params: DigitalTwinParams): DigitalTwinSimulation {
  const {
    vessel,
    originPort,
    destinationPort,
    route,
    cargoQuantityTonnes,
    speedKnots,
    vlsfoPriceUsd,
    congestionDeltaDays,
    weatherSeverityFactor,
    handlingRateMultiplier,
  } = params;

  // 1. Loading Stage (Stage 1 & 2)
  const actualLoadRate = originPort.cargoHandlingRateTpd * handlingRateMultiplier;
  const loadingHours = Math.round((cargoQuantityTonnes / actualLoadRate) * 24 + 12);
  const loadingFuelMgo = Number(((loadingHours / 24) * vessel.fuelConsumptionPortTpd).toFixed(1));

  // 2. Sailing & Weather (Stage 3, 4, 5, 6)
  const baseSailingHours = (route.distanceNm / speedKnots);
  const weatherDisruptionHours = Math.round(
    (weatherSeverityFactor - 1.0) * 36 + (route.weatherRiskRating > 3 ? 18 : 6)
  );
  const totalSailingHours = Math.round(baseSailingHours + weatherDisruptionHours);
  const totalSeaDays = Number((totalSailingHours / 24).toFixed(1));

  // Cubic fuel law: Consumption ~ (Speed / DesignSpeed)^3
  const speedRatio = speedKnots / 13.0;
  const effectiveDailySeaFuel = vessel.fuelConsumptionSeaTpd * Math.pow(speedRatio, 2.8) * weatherSeverityFactor;
  const seaVlsfoConsumed = Number((totalSeaDays * effectiveDailySeaFuel).toFixed(1));

  // 3. Port Arrival, Congestion & Discharge (Stage 7, 8, 9, 10)
  const baseWaitingDays = destinationPort.averageWaitingDays + congestionDeltaDays;
  const waitingHours = Math.round(Math.max(6, baseWaitingDays * 24));
  const waitingFuelMgo = Number(((waitingHours / 24) * vessel.fuelConsumptionPortTpd).toFixed(1));

  const actualDischargeRate = destinationPort.cargoHandlingRateTpd * handlingRateMultiplier;
  const berthingAndPilotHours = 8;
  const dischargeHours = Math.round((cargoQuantityTonnes / actualDischargeRate) * 24);
  const dischargeFuelMgo = Number(((dischargeHours / 24) * vessel.fuelConsumptionPortTpd).toFixed(1));

  // 4. Turnaround & Next-voyage readiness (Stage 11, 12)
  const deballastAndInspectionHours = 14;
  const nextVoyageBunkerAndCrewHours = 10;
  const turnaroundFuel = Number(((24 / 24) * vessel.fuelConsumptionPortTpd).toFixed(1));

  // Aggregate stats
  const totalPortHours = loadingHours + waitingHours + berthingAndPilotHours + dischargeHours + deballastAndInspectionHours + nextVoyageBunkerAndCrewHours;
  const totalPortDays = Number((totalPortHours / 24).toFixed(1));
  const totalWaitingDays = Number((waitingHours / 24).toFixed(1));
  const totalVoyageDays = Number((totalSeaDays + totalPortDays).toFixed(1));

  const totalVlsfoTonnes = seaVlsfoConsumed;
  const totalMgoTonnes = Number((loadingFuelMgo + waitingFuelMgo + dischargeFuelMgo + turnaroundFuel).toFixed(1));
  const totalCo2Tonnes = Number((totalVlsfoTonnes * 3.114 + totalMgoTonnes * 3.206).toFixed(1));

  // Cost calculation
  const bunkerCost = totalVlsfoTonnes * vlsfoPriceUsd + totalMgoTonnes * 800;
  const charterCost = totalVoyageDays * vessel.dailyHireRateUsd;
  const portPdaCost = originPort.portChargesBaseUsd + destinationPort.portChargesBaseUsd;
  const totalCostUsd = Math.round(bunkerCost + charterCost + portPdaCost + 30000);

  // EEOI = (Total CO2 in grams) / (Cargo in tonnes * Distance in nautical miles)
  const eeoiScore = Number(((totalCo2Tonnes * 1_000_000) / (cargoQuantityTonnes * route.distanceNm)).toFixed(2));

  // Build 12 stages
  let currentCumDays = 0;
  const addDays = (hours: number) => {
    currentCumDays = Number((currentCumDays + hours / 24).toFixed(1));
    return currentCumDays;
  };

  const stages: DigitalTwinStage[] = [
    {
      id: 1,
      name: 'Cargo Loading & Trim',
      phase: 'LOAD_PORT',
      locationName: originPort.name,
      coordinates: [originPort.latitude, originPort.longitude],
      durationHours: loadingHours - 12,
      cumulativeDays: addDays(loadingHours - 12),
      fuelBurnTonnes: Number((loadingFuelMgo * 0.7).toFixed(1)),
      co2EmittedTonnes: Number((loadingFuelMgo * 0.7 * 3.2).toFixed(1)),
      riskFactors: ['Conveyor breakdown', 'Moisture limits for coal loading'],
      status: 'COMPLETED',
      details: `Loading ${cargoQuantityTonnes.toLocaleString()} tonnes at ${actualLoadRate.toLocaleString()} t/day rate.`,
    },
    {
      id: 2,
      name: 'Vessel Clearance & Departure',
      phase: 'LOAD_PORT',
      locationName: originPort.name,
      coordinates: [originPort.latitude + 0.1, originPort.longitude + 0.2],
      durationHours: 12,
      cumulativeDays: addDays(12),
      fuelBurnTonnes: Number((loadingFuelMgo * 0.3).toFixed(1)),
      co2EmittedTonnes: Number((loadingFuelMgo * 0.3 * 3.2).toFixed(1)),
      riskFactors: ['Tidal sailing window', 'Customs outward clearance'],
      status: 'COMPLETED',
      details: `Draft trimmed to ${vessel.draft}m. High water tidal departure initiated.`,
    },
    {
      id: 3,
      name: 'Deep Sea Sailing (Leg 1 - Coral Sea / Indo Passage)',
      phase: 'TRANSIT',
      locationName: 'Torres / Lombok Strait Corridor',
      coordinates: [-10.5, 125.0],
      durationHours: Math.round(totalSailingHours * 0.4),
      cumulativeDays: addDays(Math.round(totalSailingHours * 0.4)),
      fuelBurnTonnes: Number((totalVlsfoTonnes * 0.4).toFixed(1)),
      co2EmittedTonnes: Number((totalVlsfoTonnes * 0.4 * 3.114).toFixed(1)),
      riskFactors: ['Strait pilotage', 'Vessel traffic separation'],
      status: 'IN_PROGRESS',
      details: `Cruising at ${speedKnots.toFixed(1)} kts economic speed. Fuel burn steady at ${effectiveDailySeaFuel.toFixed(1)} t/day.`,
    },
    {
      id: 4,
      name: 'En-Route Weather & Hydrodynamic Optimization',
      phase: 'TRANSIT',
      locationName: 'Equatorial Indian Ocean Basin',
      coordinates: [1.2, 95.0],
      durationHours: Math.round(totalSailingHours * 0.35),
      cumulativeDays: addDays(Math.round(totalSailingHours * 0.35)),
      fuelBurnTonnes: Number((totalVlsfoTonnes * 0.35).toFixed(1)),
      co2EmittedTonnes: Number((totalVlsfoTonnes * 0.35 * 3.114).toFixed(1)),
      riskFactors: weatherDisruptionHours > 20 ? ['Tropical depression / heavy swell', 'Speed loss 1.2 kts'] : ['Mild monsoon swells'],
      status: 'SCHEDULED',
      details: `Dynamic weather routing engaged. Adjusted heading to minimize wave encounter frequency.`,
    },
    {
      id: 5,
      name: 'Approach & Bay of Bengal Inbound',
      phase: 'TRANSIT',
      locationName: 'Bay of Bengal Shipping Lane',
      coordinates: [15.0, 86.0],
      durationHours: Math.round(totalSailingHours * 0.25),
      cumulativeDays: addDays(Math.round(totalSailingHours * 0.25)),
      fuelBurnTonnes: Number((totalVlsfoTonnes * 0.25).toFixed(1)),
      co2EmittedTonnes: Number((totalVlsfoTonnes * 0.25 * 3.114).toFixed(1)),
      riskFactors: ['Coastal fishing traffic', 'VTMS reporting compliance'],
      status: 'SCHEDULED',
      details: `Vessel speed trimmed for just-in-time pilot window to reduce anchor waiting.`,
    },
    {
      id: 6,
      name: 'Notice of Readiness (NOR) Tendered',
      phase: 'DISCHARGE_PORT',
      locationName: `${destinationPort.name} Outer Anchorage`,
      coordinates: [destinationPort.latitude - 0.2, destinationPort.longitude - 0.2],
      durationHours: 6,
      cumulativeDays: addDays(6),
      fuelBurnTonnes: 1.2,
      co2EmittedTonnes: 3.8,
      riskFactors: ['NOR acceptance disputes', 'Laytime clock trigger'],
      status: 'SCHEDULED',
      details: 'NOR tendered to charterer agents. Laytime clock starts as per charter party clause.',
    },
    {
      id: 7,
      name: 'Anchorage Waiting & Congestion Hold',
      phase: 'DISCHARGE_PORT',
      locationName: `${destinationPort.name} Fairway`,
      coordinates: [destinationPort.latitude - 0.1, destinationPort.longitude - 0.1],
      durationHours: waitingHours,
      cumulativeDays: addDays(waitingHours),
      fuelBurnTonnes: waitingFuelMgo,
      co2EmittedTonnes: Number((waitingFuelMgo * 3.2).toFixed(1)),
      riskFactors: ['Demurrage accrual', 'Pre-berth inspection delays'],
      status: 'SCHEDULED',
      details: `Vessel queued behind ${destinationPort.waitingVesselsCount} bulk carriers. Waiting duration: ${(waitingHours / 24).toFixed(1)} days.`,
    },
    {
      id: 8,
      name: 'Pilot Boarding & Berthing Manoeuvre',
      phase: 'DISCHARGE_PORT',
      locationName: `${destinationPort.name} Coal Berth`,
      coordinates: [destinationPort.latitude, destinationPort.longitude],
      durationHours: berthingAndPilotHours,
      cumulativeDays: addDays(berthingAndPilotHours),
      fuelBurnTonnes: 1.5,
      co2EmittedTonnes: 4.8,
      riskFactors: ['Tug availability', 'Draft clearance verification at channel'],
      status: 'SCHEDULED',
      details: `Berthing alongside mechanized deep-water coal berth with 2 harbour tugs assisting.`,
    },
    {
      id: 9,
      name: 'Mechanized Grab Cargo Discharge',
      phase: 'DISCHARGE_PORT',
      locationName: `${destinationPort.name} Coal Terminal`,
      coordinates: [destinationPort.latitude, destinationPort.longitude],
      durationHours: dischargeHours,
      cumulativeDays: addDays(dischargeHours),
      fuelBurnTonnes: dischargeFuelMgo,
      co2EmittedTonnes: Number((dischargeFuelMgo * 3.2).toFixed(1)),
      riskFactors: ['Rain delays', 'Conveyor/stacker-reclaimer maintenance'],
      status: 'SCHEDULED',
      details: `High-speed discharge into hopper and rail car silos at ${actualDischargeRate.toLocaleString()} t/day.`,
    },
    {
      id: 10,
      name: 'Hold Inspection & Customs Release',
      phase: 'DISCHARGE_PORT',
      locationName: destinationPort.name,
      coordinates: [destinationPort.latitude, destinationPort.longitude],
      durationHours: 6,
      cumulativeDays: addDays(6),
      fuelBurnTonnes: 0.8,
      co2EmittedTonnes: 2.5,
      riskFactors: ['Hold washing standard compliance', 'Cleanliness certificate'],
      status: 'SCHEDULED',
      details: 'Independent surveyor hold cleanliness inspection completed for grain/clean cargo readiness.',
    },
    {
      id: 11,
      name: 'Deballasting & Outward Pilotage',
      phase: 'TURNAROUND',
      locationName: `${destinationPort.name} Outbound Channel`,
      coordinates: [destinationPort.latitude + 0.1, destinationPort.longitude + 0.1],
      durationHours: 12,
      cumulativeDays: addDays(12),
      fuelBurnTonnes: 1.4,
      co2EmittedTonnes: 4.5,
      riskFactors: ['Ballast water management system (BWMS) logging'],
      status: 'SCHEDULED',
      details: 'Vessel clears port limits under ballast condition. Port log finalized.',
    },
    {
      id: 12,
      name: 'Next-Voyage Readiness / Ballast Repositioning',
      phase: 'TURNAROUND',
      locationName: 'Bay of Bengal Open Waters',
      coordinates: [18.0, 85.5],
      durationHours: 12,
      cumulativeDays: addDays(12),
      fuelBurnTonnes: turnaroundFuel,
      co2EmittedTonnes: Number((turnaroundFuel * 3.2).toFixed(1)),
      riskFactors: ['Deadheading idle risk', 'Prompt market cargo matching'],
      status: 'SCHEDULED',
      details: `Vessel 100% prepared for subsequent voyage commitment (Voyage #2 of multi-voyage contract).`,
    },
  ];

  return {
    stages,
    totalSeaDays,
    totalPortDays,
    totalWaitingDays,
    totalVoyageDays,
    totalVlsfoTonnes,
    totalMgoTonnes,
    totalCo2Tonnes,
    totalCostUsd,
    eeoiScore,
    weatherDisruptionHours,
    congestionDelayHours: waitingHours,
    berthTurnaroundHours: berthingAndPilotHours + dischargeHours + 18,
  };
}
