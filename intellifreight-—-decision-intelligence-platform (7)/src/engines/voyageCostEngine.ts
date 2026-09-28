import {
  Port,
  Route,
  Vessel,
  VoyageCostBreakdown,
  MarketIndices,
} from '../types';

export function calculateVoyageCosts(
  vessel: Vessel,
  originPort: Port,
  destinationPort: Port,
  route: Route,
  freightRateUsdPerTonne: number,
  cargoQuantityTonnes: number,
  numberOfVoyages: number,
  marketIndices: MarketIndices,
  includeCarbonCost: boolean = true
): VoyageCostBreakdown {
  // 1. Sailing Duration (sea days)
  const distance = route.distanceNm;
  const speed = vessel.speedKnots;
  const seaDays = Number((distance / (speed * 24)).toFixed(1));

  // 2. Port Duration (loading + discharging days)
  const loadPortDays = Number((cargoQuantityTonnes / originPort.cargoHandlingRateTpd).toFixed(1)) + 0.8; // line up & customs
  const dischargePortDays = Number((cargoQuantityTonnes / destinationPort.cargoHandlingRateTpd).toFixed(1)) + 0.8;
  const portDays = Number((loadPortDays + dischargePortDays).toFixed(1));

  // 3. Waiting & Congestion Days (demurrage exposure)
  const waitingDays = Number((originPort.averageWaitingDays * 0.5 + destinationPort.averageWaitingDays).toFixed(1));

  // Total duration in days per single voyage
  const totalDurationDays = Number((seaDays + portDays + waitingDays).toFixed(1));

  // 4. Fuel Consumptions
  const vlsfoSeaConsumed = seaDays * vessel.fuelConsumptionSeaTpd;
  const vlsfoPortConsumed = (portDays + waitingDays) * 1.0; // auxiliary boiler
  const mgoPortConsumed = (portDays + waitingDays) * vessel.fuelConsumptionPortTpd;

  const totalVlsfoTonnes = Number((vlsfoSeaConsumed + vlsfoPortConsumed).toFixed(1));
  const totalMgoTonnes = Number(mgoPortConsumed.toFixed(1));

  // 5. Fuel Costs
  const bunkerSeaCost = Math.round(vlsfoSeaConsumed * marketIndices.vlsfoSingaporeUsd);
  const bunkerPortCost = Math.round(vlsfoPortConsumed * marketIndices.vlsfoSingaporeUsd + mgoPortConsumed * marketIndices.mgoSingaporeUsd);
  const totalBunkerCost = bunkerSeaCost + bunkerPortCost;

  // 6. Base Freight Cost
  const freightCost = Math.round(freightRateUsdPerTonne * cargoQuantityTonnes);

  // 7. Port Disbursement Accounts (PDA) for Origin + Destination (scaled by vessel DWT ratio)
  const dwtScaleFactor = Math.sqrt(vessel.dwt / 75000);
  const portDisbursementCost = Math.round(
    (originPort.portChargesBaseUsd * 0.85 + destinationPort.portChargesBaseUsd * 0.95) * dwtScaleFactor
  );

  // 8. Expected Delay Cost (Demurrage / waiting time cost)
  // Daily demurrage typically matches daily charter rate + 10% ($15k - $30k/day)
  const demurrageRateDaily = vessel.dailyHireRateUsd * 1.1;
  const expectedDelayCost = Math.round(waitingDays * demurrageRateDaily);

  // 9. Expected Idle Cost (Ballast repositioning risk factor: 4-7% of voyage hire)
  const expectedIdleCost = Math.round((vessel.dailyHireRateUsd * totalDurationDays) * 0.055);

  // 10. Canal & Passage Tariffs (Suez/Panama/Straits) + Agency + Hull Insurance
  let canalToll = 0;
  const hasSuez = route.canalChokePoints.some((cp) => cp.toLowerCase().includes('suez'));
  const hasPanama = route.canalChokePoints.some((cp) => cp.toLowerCase().includes('panama'));
  if (hasSuez) canalToll += 280000; // Typical laden bulk carrier Suez toll
  if (hasPanama) canalToll += 220000; // Typical Neo-Panamax toll
  const agencyAndInsurance = 22000;
  const otherVoyageCost = Math.round(canalToll + agencyAndInsurance);

  // 11. Carbon Cost (IMO / EU ETS proxy: $75/t CO2)
  // Factor: 3.114 tonnes CO2 per tonne VLSFO, 3.206 per tonne MGO
  const co2EmissionsTonnes = Number((totalVlsfoTonnes * 3.114 + totalMgoTonnes * 3.206).toFixed(1));
  const carbonTaxRateUsdPerTonne = 65; // Carbon offset / regulatory shadow price
  const carbonCost = includeCarbonCost ? Math.round(co2EmissionsTonnes * carbonTaxRateUsdPerTonne) : 0;

  // Total single voyage cost
  const totalVoyageCostUsd =
    freightCost +
    totalBunkerCost +
    portDisbursementCost +
    expectedDelayCost +
    expectedIdleCost +
    otherVoyageCost +
    carbonCost;

  // Total for full arrangement (multi-voyage)
  const totalContractCostUsd = totalVoyageCostUsd * numberOfVoyages;
  const costPerTonneUsd = Number((totalVoyageCostUsd / cargoQuantityTonnes).toFixed(2));
  const co2PerTonneCargo = Number(((co2EmissionsTonnes * 1000) / cargoQuantityTonnes).toFixed(1)); // kg CO2 / t

  return {
    cargoQuantityTonnes,
    voyagesCount: numberOfVoyages,
    seaDays,
    portDays,
    waitingDays,
    totalDurationDays,
    freightCost,
    bunkerSeaCost,
    bunkerPortCost,
    totalBunkerCost,
    portDisbursementCost,
    expectedDelayCost,
    expectedIdleCost,
    carbonCost,
    otherVoyageCost,
    totalVoyageCostUsd,
    totalContractCostUsd,
    costPerTonneUsd,
    vlsfoConsumedTonnes: totalVlsfoTonnes,
    mgoConsumedTonnes: totalMgoTonnes,
    co2EmissionsTonnes,
    co2PerTonneCargo,
  };
}
