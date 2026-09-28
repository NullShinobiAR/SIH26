import {
  CharteringAnalysisRequest,
  CharteringAnalysisResponse,
  Port,
  Route,
  Vessel,
  DecisionRecord,
  DecisionAuditTrail,
} from '../types';
import { PORTS, VESSELS, ROUTES, MARKET_INDICES } from '../data/maritimeData';
import { evaluateVesselFeasibility } from '../engines/feasibilityEngine';
import { runFreightForecast } from '../engines/forecastingEngine';
import { calculateComprehensiveRisk } from '../engines/riskEngine';
import { calculateVoyageCosts } from '../engines/voyageCostEngine';
import { optimizeContracts } from '../engines/contractOptimizer';
import { evaluateAlternativePorts } from '../engines/alternativePortEngine';
import { simulateDigitalTwinVoyage } from '../engines/digitalTwinEngine';
import { generateExplanation } from '../engines/explainabilityEngine';
import { calculateEsgOptions } from '../engines/esgEngine';

export function runCompleteCharteringPipeline(
  request: CharteringAnalysisRequest
): CharteringAnalysisResponse {
  // 1. Resolve Origin & Destination Ports
  const originPort = PORTS.find((p) => p.id === request.originPortId) || PORTS.find((p) => p.id === 'au-hpt')!;
  const destinationPort = PORTS.find((p) => p.id === request.destinationPortId) || PORTS.find((p) => p.id === 'in-dhm')!;

  // 2. Resolve Route (or synthesize distance if custom)
  let route = ROUTES.find(
    (r) => r.originPortId === originPort.id && r.destinationPortId === destinationPort.id
  );
  if (!route) {
    // Approximate sea distance based on geographic delta
    const dLat = destinationPort.latitude - originPort.latitude;
    const dLng = destinationPort.longitude - originPort.longitude;
    const estDistance = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 60 + 1500);
    route = {
      id: `rt-${originPort.id}-${destinationPort.id}`,
      originPortId: originPort.id,
      destinationPortId: destinationPort.id,
      originName: originPort.name,
      destinationName: destinationPort.name,
      distanceNm: Math.max(2200, estDistance),
      typicalSeaDaysPanamax: Number((Math.max(2200, estDistance) / (13.0 * 24)).toFixed(1)),
      canalChokePoints: ['Malacca / Sunda'],
      piracyRisk: 'NONE',
      weatherRiskRating: 3.5,
    };
  }

  // 3. Deterministic Feasibility Validation for All Candidate Vessels
  const vesselFeasibilities = VESSELS.map((v) =>
    evaluateVesselFeasibility(v, originPort, destinationPort, request.cargoQuantityTonnes)
  );

  // Filter feasible vessels
  const feasibleVessels = vesselFeasibilities.filter((vf) => vf.isFeasible);

  // Pick best vessel: prioritize OPTIMAL grade or matching capacity closest to 100%
  let recommendedVesselResult = feasibleVessels.find((vf) => vf.recommendationGrade === 'OPTIMAL');
  if (!recommendedVesselResult && feasibleVessels.length > 0) {
    recommendedVesselResult = feasibleVessels[0];
  }
  // Fallback to Panamax if none feasible (with clear warning in response)
  const recommendedVessel = recommendedVesselResult
    ? recommendedVesselResult.vessel
    : VESSELS.find((v) => v.vesselClass === 'Panamax')!;

  // 4. Freight Forecasting Engine
  const freightForecast = runFreightForecast(route.id, recommendedVessel.vesselClass, 'Ensemble');

  // 5. Comprehensive Risk Assessment
  const riskAssessment = calculateComprehensiveRisk(
    freightForecast,
    originPort,
    destinationPort,
    route,
    recommendedVessel
  );

  // 6. Voyage Cost Engine
  const voyageCost = calculateVoyageCosts(
    recommendedVessel,
    originPort,
    destinationPort,
    route,
    freightForecast.currentRateUsdPerTonne,
    request.cargoQuantityTonnes,
    request.numberOfVoyages,
    MARKET_INDICES,
    request.includeCarbonCost
  );

  // 7. Contract Optimization Engine (Spot vs Short-term vs Medium-term vs COA)
  const contractOptimization = optimizeContracts(
    request.cargoQuantityTonnes,
    request.numberOfVoyages,
    freightForecast,
    voyageCost,
    riskAssessment,
    request.optimizationPreference
  );

  const { contractOptions, recommendedContract, marketEntryTiming } = contractOptimization;

  // 8. Alternative Route / Port Optimiser
  const alternativePorts = evaluateAlternativePorts(
    destinationPort.id,
    route.distanceNm,
    freightForecast.currentRateUsdPerTonne,
    recommendedVessel
  );

  // 9. Digital Twin Simulation
  const digitalTwin = simulateDigitalTwinVoyage({
    vessel: recommendedVessel,
    originPort,
    destinationPort,
    route,
    cargoQuantityTonnes: request.cargoQuantityTonnes,
    speedKnots: recommendedVessel.speedKnots,
    vlsfoPriceUsd: MARKET_INDICES.vlsfoSingaporeUsd,
    congestionDeltaDays: 0,
    weatherSeverityFactor: 1.05,
    handlingRateMultiplier: 1.0,
  });

  // 10. Explainable AI Attribution
  const explanation = generateExplanation(
    recommendedContract,
    contractOptions,
    freightForecast,
    recommendedVessel,
    vesselFeasibilities,
    originPort,
    destinationPort,
    request.numberOfVoyages,
    request.cargoQuantityTonnes,
    riskAssessment,
    voyageCost,
    request.optimizationPreference
  );

  // 11. ESG Summary
  const esgOptions = calculateEsgOptions(
    recommendedVessel,
    route,
    request.cargoQuantityTonnes,
    MARKET_INDICES.vlsfoSingaporeUsd
  );

  const decisionId = `dec-${Date.now().toString(36).toUpperCase()}`;

  const auditTrail: DecisionAuditTrail = {
    decisionId,
    timestamp: new Date().toISOString(),
    userRequirement: {
      commodity: request.commodity,
      cargoQuantityTonnes: request.cargoQuantityTonnes,
      numberOfVoyages: request.numberOfVoyages,
      originPort: originPort.name,
      destinationPort: destinationPort.name,
      optimizationPreference: request.optimizationPreference,
    },
    marketSnapshot: {
      bdi: MARKET_INDICES.bdi,
      bpi: MARKET_INDICES.bpi,
      vlsfoSingaporeUsd: MARKET_INDICES.vlsfoSingaporeUsd,
      spotRateUsdPerTonne: freightForecast.currentRateUsdPerTonne,
      provenance: 'SIMULATED',
      providerNote: 'Calibrated Historical Benchmark (DEMO / SIMULATED — NOT LIVE)',
    },
    feasibilityCheckPassed: vesselFeasibilities.some((vf) => vf.isFeasible),
    recommendedVesselClass: recommendedVessel.vesselClass,
    contractEligibilityApplied: {
      spotEligible: !!contractOptions.find((c) => c.strategy === 'spot')?.isEligible,
      shortTermEligible: !!contractOptions.find((c) => c.strategy === 'short_term')?.isEligible,
      mediumTermEligible: !!contractOptions.find((c) => c.strategy === 'medium_term')?.isEligible,
      coaEligible: !!contractOptions.find((c) => c.strategy === 'coa')?.isEligible,
    },
    competingStrategies: contractOptions.map((c) => ({
      strategy: c.strategy,
      title: c.title,
      nominalCostPerTonne: c.costPerTonneUsd,
      totalCostUsd: c.totalExpectedCostUsd,
      riskAdjustedCostPerTonne: c.riskAdjustedCostPerTonne,
      optimizationScore: c.optimizationScore,
      isEligible: c.isEligible,
      exclusionReason: c.ineligibilityReason,
    })),
    selectedStrategy: recommendedContract.strategy,
    optimizationObjective: request.optimizationPreference,
    mathematicalJustification: explanation.summary,
    provenanceStatus: 'SIMULATED',
  };

  return {
    request,
    originPort,
    destinationPort,
    route,
    freightForecast,
    riskAssessment,
    vesselFeasibilities,
    recommendedVessel,
    voyageCost,
    contractOptions,
    recommendedContract,
    marketEntryTiming,
    alternativePorts,
    digitalTwin,
    explanation,
    esgSummary: {
      totalCo2Tonnes: esgOptions.balanced.totalCo2Tonnes * request.numberOfVoyages,
      co2PerTonneCoal: esgOptions.balanced.co2KgPerTonneCargo,
      eeoiRating: esgOptions.balanced.eeoiRating,
      carbonCostUsd: esgOptions.balanced.carbonTaxCostUsd * request.numberOfVoyages,
      greenAlternativeReductionPct: esgOptions.green.co2ReductionPctVsMaxSpeed,
    },
    decisionId,
    generatedAt: new Date().toISOString(),
    auditTrail,
  };
}

export function createDecisionRecordFromResponse(
  resp: CharteringAnalysisResponse
): DecisionRecord {
  return {
    id: resp.decisionId,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
    commodity: resp.request.commodity,
    cargoQuantityTonnes: resp.request.cargoQuantityTonnes,
    originPort: resp.originPort.name,
    destinationPort: resp.destinationPort.name,
    numberOfVoyages: resp.request.numberOfVoyages,
    recommendedStrategy: resp.recommendedContract.strategy,
    recommendedVesselClass: resp.recommendedVessel.vesselClass,
    expectedRateUsdPerTonne: resp.recommendedContract.agreedRateUsdPerTonne,
    expectedTotalCostUsd: resp.recommendedContract.totalExpectedCostUsd,
    expectedCostPerTonne: resp.recommendedContract.costPerTonneUsd,
    predictedRateUsdPerTonne: resp.recommendedContract.agreedRateUsdPerTonne,
    predictedTotalCostUsd: resp.recommendedContract.totalExpectedCostUsd,
    savingsVsSpotPct: resp.recommendedContract.savingsVsSpotPct,
    riskScore: resp.riskAssessment.overallScore,
    confidenceScorePct: resp.freightForecast.confidenceScorePct,
    entryTiming: resp.marketEntryTiming.action,
    requestSnapshot: resp.request,
    auditTrail: resp.auditTrail,
  };
}
