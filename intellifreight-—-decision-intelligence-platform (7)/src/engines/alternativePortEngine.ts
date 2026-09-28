import { Port, AlternativePortOption, Vessel } from '../types';
import { PORTS } from '../data/maritimeData';

export function evaluateAlternativePorts(
  primaryDestinationId: string,
  originDistanceBaseNm: number,
  baseFreightRateUsdPerTonne: number,
  vessel: Vessel
): AlternativePortOption[] {
  const indianPorts = PORTS.filter((p) => p.country === 'India');

  // Inland rail freight cost estimates from East Coast ports to Odisha/Jharkhand Steel Hub (Kalinganagar/Angul/Jamshedpur cluster)
  const inlandRailFreightMap: Record<string, number> = {
    'in-dhm': 8.5, // Closest rail transit to Kalinganagar/Dhamra corridor
    'in-prt': 9.2, // Established railway siding directly to Odisha plants
    'in-gpl': 14.5, // Longer rake transit distance
    'in-ggv': 18.0, // Best for Vizag plant; higher rail freight to interior Odisha/Jharkhand
    'in-vtg': 18.5, // Best for coastal Vizag plant
    'in-hld': 11.0, // Good for West Bengal/Durgapur; high river port delays
    'in-sgr': 13.5, // Requires barging + handling
  };

  const results: AlternativePortOption[] = indianPorts.map((port) => {
    // Physical feasibility
    const draftFeasible = vessel.draft <= port.maxDraft;
    const loaFeasible = vessel.loa <= port.maxLoa;
    const isFeasible = draftFeasible && loaFeasible;

    // Relative distance differential from Hay Point / Australia
    const distanceDelta = port.id === 'in-dhm' ? 0 : port.id === 'in-prt' ? 50 : port.id === 'in-vtg' ? -90 : port.id === 'in-ggv' ? -95 : port.id === 'in-hld' ? 170 : 80;
    const seaDistance = originDistanceBaseNm + distanceDelta;
    const seaDays = Number((seaDistance / (vessel.speedKnots * 24)).toFixed(1));

    // Freight rate adjustment (distance & port risk premium)
    const freightAdjust = port.id === 'in-hld' ? 3.5 : (distanceDelta / 5000) * 0.4;
    const freightRate = Number((baseFreightRateUsdPerTonne + freightAdjust).toFixed(2));

    // Port costs per tonne
    const portCostPerTonne = port.portChargesBaseUsd / vessel.cargoCapacityTonnes;
    // Congestion demurrage cost per tonne
    const delayCostPerTonne = (port.averageWaitingDays * vessel.dailyHireRateUsd * 1.1) / vessel.cargoCapacityTonnes;
    const voyageCostPerTonne = Number((freightRate + portCostPerTonne + delayCostPerTonne).toFixed(2));

    const inlandRail = inlandRailFreightMap[port.id] || 12.0;
    const totalLandedCostPerTonne = Number((voyageCostPerTonne + inlandRail).toFixed(2));

    const primaryOption = indianPorts.find((p) => p.id === primaryDestinationId);
    const primaryInland = inlandRailFreightMap[primaryDestinationId] || 9.0;
    const primaryBaselineLanded = baseFreightRateUsdPerTonne + (primaryOption ? (primaryOption.portChargesBaseUsd + primaryOption.averageWaitingDays * vessel.dailyHireRateUsd * 1.1) / vessel.cargoCapacityTonnes : 2.5) + primaryInland;

    const savingsVsPrimary = Number((primaryBaselineLanded - totalLandedCostPerTonne).toFixed(2));

    let recommendationNote = '';
    if (!isFeasible) {
      recommendationNote = `Infeasible: Vessel draft ${vessel.draft.toFixed(1)}m exceeds port limit of ${port.maxDraft.toFixed(1)}m.`;
    } else if (port.id === primaryDestinationId) {
      recommendationNote = 'Primary selected destination port.';
    } else if (savingsVsPrimary > 1.0) {
      recommendationNote = `Attractive alternative: Saves $${savingsVsPrimary.toFixed(2)}/t total landed cost due to lower congestion and quick berth turnaround.`;
    } else if (port.congestionScore > 65) {
      recommendationNote = `Not recommended: High port congestion (${port.waitingVesselsCount} vessels waiting) elevates demurrage risk.`;
    } else {
      recommendationNote = 'Feasible backup port. Higher inland rail tariff offsets sea freight parity.';
    }

    const deltaVsSelectedPortUsd = Number((-savingsVsPrimary).toFixed(2));
    const portChargesUsd = Number(portCostPerTonne.toFixed(2));
    const demurrageRiskUsd = Number(delayCostPerTonne.toFixed(2));

    return {
      port,
      portId: port.id,
      portName: port.name,
      draftLimit: port.maxDraft,
      expectedWaitingDays: port.averageWaitingDays,
      oceanFreightRateUsd: freightRate,
      portChargesUsd,
      demurrageRiskUsd,
      inlandRailFreightUsd: inlandRail,
      totalLandedCostPerTonneUsd: totalLandedCostPerTonne,
      deltaVsSelectedPortUsd,
      recommendationReason: recommendationNote,
      seaDistanceNm: seaDistance,
      seaDays,
      freightRateUsdPerTonne: freightRate,
      voyageCostPerTonneUsd: voyageCostPerTonne,
      inlandRailFreightToPlantUsd: inlandRail,
      congestionDelayDays: port.averageWaitingDays,
      riskScore: port.congestionScore,
      isFeasible,
      savingsVsPrimaryPerTonne: savingsVsPrimary,
      recommendationNote,
    };
  });

  // Sort feasible ports by lowest total landed cost first
  return results.sort((a, b) => {
    if (a.isFeasible && !b.isFeasible) return -1;
    if (!a.isFeasible && b.isFeasible) return 1;
    return a.totalLandedCostPerTonneUsd - b.totalLandedCostPerTonneUsd;
  });
}
