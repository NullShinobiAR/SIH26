import { Vessel, Route } from '../types';

export interface EsgOptimizationResult {
  mode: 'Cost First' | 'Balanced' | 'Green';
  speedKnots: number;
  seaDays: number;
  vlsfoTonnes: number;
  mgoTonnes: number;
  totalCo2Tonnes: number;
  co2KgPerTonneCargo: number;
  eeoiScore: number;
  eeoiRating: 'A' | 'B' | 'C' | 'D';
  bunkerCostUsd: number;
  carbonTaxCostUsd: number;
  charterHireCostUsd: number;
  totalVoyageEcoCostUsd: number;
  co2ReductionPctVsMaxSpeed: number;
  savingsVsCostFirstUsd: number;
}

export function calculateEsgOptions(
  vessel: Vessel,
  route: Route,
  cargoQuantityTonnes: number,
  vlsfoPriceUsd: number,
  carbonPricePerTonneUsd: number = 65
): {
  costFirst: EsgOptimizationResult;
  balanced: EsgOptimizationResult;
  green: EsgOptimizationResult;
} {
  // Speed modes:
  // Cost first: typical full commercial speed (13.5 kts)
  // Balanced: moderate eco-speed (12.2 kts)
  // Green: Super eco slow-steaming (11.0 kts) + hull bio-clean/weather routing factor

  const runMode = (
    mode: 'Cost First' | 'Balanced' | 'Green',
    speed: number,
    weatherFactor: number
  ): EsgOptimizationResult => {
    const seaDays = Number((route.distanceNm / (speed * 24)).toFixed(1));
    const portDays = 5.2; // combined
    const totalDays = Number((seaDays + portDays).toFixed(1));

    // Cubic fuel law
    const speedRatio = speed / 13.0;
    const dailySeaFuel = vessel.fuelConsumptionSeaTpd * Math.pow(speedRatio, 2.8) * weatherFactor;
    const vlsfoTonnes = Number((seaDays * dailySeaFuel).toFixed(1));
    const mgoTonnes = Number((portDays * vessel.fuelConsumptionPortTpd).toFixed(1));

    const totalCo2Tonnes = Number((vlsfoTonnes * 3.114 + mgoTonnes * 3.206).toFixed(1));
    const co2KgPerTonneCargo = Number(((totalCo2Tonnes * 1000) / cargoQuantityTonnes).toFixed(1));

    // EEOI (grams CO2 / tonne-nautical mile)
    const eeoiScore = Number(((totalCo2Tonnes * 1_000_000) / (cargoQuantityTonnes * route.distanceNm)).toFixed(2));

    let eeoiRating: 'A' | 'B' | 'C' | 'D' = 'B';
    if (eeoiScore < 4.2) eeoiRating = 'A';
    else if (eeoiScore < 5.8) eeoiRating = 'B';
    else if (eeoiScore < 7.5) eeoiRating = 'C';
    else eeoiRating = 'D';

    const bunkerCostUsd = Math.round(vlsfoTonnes * vlsfoPriceUsd + mgoTonnes * 800);
    const carbonTaxCostUsd = Math.round(totalCo2Tonnes * carbonPricePerTonneUsd);
    const charterHireCostUsd = Math.round(totalDays * vessel.dailyHireRateUsd);
    const totalVoyageEcoCostUsd = bunkerCostUsd + carbonTaxCostUsd + charterHireCostUsd;

    return {
      mode,
      speedKnots: speed,
      seaDays,
      vlsfoTonnes,
      mgoTonnes,
      totalCo2Tonnes,
      co2KgPerTonneCargo,
      eeoiScore,
      eeoiRating,
      bunkerCostUsd,
      carbonTaxCostUsd,
      charterHireCostUsd,
      totalVoyageEcoCostUsd,
      co2ReductionPctVsMaxSpeed: 0, // computed below
      savingsVsCostFirstUsd: 0,
    };
  };

  const costFirst = runMode('Cost First', 13.5, 1.0);
  const balanced = runMode('Balanced', 12.2, 0.96);
  const green = runMode('Green', 11.0, 0.92);

  // Compute deltas vs Cost First
  balanced.co2ReductionPctVsMaxSpeed = Number(
    (((costFirst.totalCo2Tonnes - balanced.totalCo2Tonnes) / costFirst.totalCo2Tonnes) * 100).toFixed(1)
  );
  balanced.savingsVsCostFirstUsd = costFirst.totalVoyageEcoCostUsd - balanced.totalVoyageEcoCostUsd;

  green.co2ReductionPctVsMaxSpeed = Number(
    (((costFirst.totalCo2Tonnes - green.totalCo2Tonnes) / costFirst.totalCo2Tonnes) * 100).toFixed(1)
  );
  green.savingsVsCostFirstUsd = costFirst.totalVoyageEcoCostUsd - green.totalVoyageEcoCostUsd;

  return { costFirst, balanced, green };
}
