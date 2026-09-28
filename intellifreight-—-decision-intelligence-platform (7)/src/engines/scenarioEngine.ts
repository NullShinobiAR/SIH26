import {
  ScenarioInput,
  ScenarioResult,
  CharteringAnalysisResponse,
} from '../types';
import { optimizeContracts } from './contractOptimizer';
import { calculateVoyageCosts } from './voyageCostEngine';
import { runFreightForecast } from './forecastingEngine';
import { calculateComprehensiveRisk } from './riskEngine';
import { MARKET_INDICES } from '../data/maritimeData';

export function runScenarioAnalysis(
  baseResponse: CharteringAnalysisResponse,
  scenarioInput: ScenarioInput
): ScenarioResult {
  const {
    freightRateChangePct,
    bunkerPriceChangePct,
    portCongestionDeltaDays,
    cargoQuantityChangePct,
    weatherSeverityMultiplier,
  } = scenarioInput;

  const baseReq = baseResponse.request;
  const baseCost = baseResponse.voyageCost;
  const baseContract = baseResponse.recommendedContract;

  // Recalculate parameters with shocks
  const scenarioCargoQty = Math.round(baseReq.cargoQuantityTonnes * (1 + cargoQuantityChangePct / 100));

  // Adjusted market indices
  const adjustedIndices = {
    ...MARKET_INDICES,
    vlsfoSingaporeUsd: Number((MARKET_INDICES.vlsfoSingaporeUsd * (1 + bunkerPriceChangePct / 100)).toFixed(1)),
  };

  // Adjusted forecast
  const baseForecast = baseResponse.freightForecast;
  const adjustedCurrentRate = Number((baseForecast.currentRateUsdPerTonne * (1 + freightRateChangePct / 100)).toFixed(2));
  const adjustedForecast = {
    ...baseForecast,
    currentRateUsdPerTonne: adjustedCurrentRate,
    forecast4Weeks: Number((baseForecast.forecast4Weeks * (1 + freightRateChangePct / 100)).toFixed(2)),
    forecast8Weeks: Number((baseForecast.forecast8Weeks * (1 + freightRateChangePct / 100)).toFixed(2)),
    trend: freightRateChangePct > 5 ? ('STRONG_BULLISH' as const) : freightRateChangePct < -5 ? ('BEARISH' as const) : baseForecast.trend,
  };

  // Adjusted destination port with congestion delta
  const adjustedDestPort = {
    ...baseResponse.destinationPort,
    averageWaitingDays: Math.max(0.5, Number((baseResponse.destinationPort.averageWaitingDays + portCongestionDeltaDays).toFixed(1))),
    congestionScore: Math.min(100, Math.max(10, Math.round(baseResponse.destinationPort.congestionScore + portCongestionDeltaDays * 12))),
  };

  // Recalculate voyage costs
  const scenarioVoyageCost = calculateVoyageCosts(
    baseResponse.recommendedVessel,
    baseResponse.originPort,
    adjustedDestPort,
    baseResponse.route,
    adjustedForecast.forecast4Weeks,
    scenarioCargoQty,
    baseReq.numberOfVoyages,
    adjustedIndices,
    baseReq.includeCarbonCost
  );

  // Recalculate risk
  const scenarioRisk = calculateComprehensiveRisk(
    adjustedForecast,
    baseResponse.originPort,
    adjustedDestPort,
    baseResponse.route,
    baseResponse.recommendedVessel
  );

  // Recalculate contract optimization
  const scenarioOptimization = optimizeContracts(
    scenarioCargoQty,
    baseReq.numberOfVoyages,
    adjustedForecast,
    scenarioVoyageCost,
    scenarioRisk,
    baseReq.optimizationPreference
  );

  const scenarioContract = scenarioOptimization.recommendedContract;

  // Comparison metrics
  const baseTotalUsd = baseContract.totalExpectedCostUsd;
  const scenarioTotalUsd = scenarioContract.totalExpectedCostUsd;
  const costDeltaUsd = scenarioTotalUsd - baseTotalUsd;
  const costDeltaPct = Number(((costDeltaUsd / baseTotalUsd) * 100).toFixed(1));

  const baseCostPerTonne = baseContract.costPerTonneUsd;
  const scenarioCostPerTonne = scenarioContract.costPerTonneUsd;

  const strategyChanged = baseContract.strategy !== scenarioContract.strategy;

  const keyInsights: string[] = [];
  if (freightRateChangePct > 0) {
    keyInsights.push(`Freight increase (+${freightRateChangePct}%) expands multi-voyage savings over spot by $${Math.abs(costDeltaUsd).toLocaleString()}.`);
  } else if (freightRateChangePct < 0) {
    keyInsights.push(`Freight softening (${freightRateChangePct}%) narrows multi-voyage discount; spot fixtures become more economically viable.`);
  }

  if (bunkerPriceChangePct !== 0) {
    keyInsights.push(`Bunker price shock (${bunkerPriceChangePct > 0 ? '+' : ''}${bunkerPriceChangePct}%) alters voyage fuel bill by $${Math.round((scenarioVoyageCost.totalBunkerCost - baseCost.totalBunkerCost) * baseReq.numberOfVoyages).toLocaleString()}.`);
  }

  if (portCongestionDeltaDays > 0) {
    keyInsights.push(`Added ${portCongestionDeltaDays} days port delay accrues additional demurrage exposure of $${Math.round((scenarioVoyageCost.expectedDelayCost - baseCost.expectedDelayCost) * baseReq.numberOfVoyages).toLocaleString()}.`);
  }

  if (strategyChanged) {
    keyInsights.push(`CRITICAL PIVOT: Optimal strategy shifts from ${baseContract.title} to ${scenarioContract.title}.`);
  } else {
    keyInsights.push(`Optimal strategy remains robust: ${scenarioContract.title} maintains top risk-adjusted rank.`);
  }

  return {
    scenarioName: 'Custom Parameter Sensitivity Shock',
    baseCostUsd: baseTotalUsd,
    scenarioCostUsd: scenarioTotalUsd,
    costDeltaUsd,
    costDeltaPct,
    baseCostPerTonne,
    scenarioCostPerTonne,
    baseRecommendedStrategy: baseContract.strategy,
    scenarioRecommendedStrategy: scenarioContract.strategy,
    strategyChanged,
    riskScoreDelta: scenarioRisk.overallScore - baseResponse.riskAssessment.overallScore,
    keyInsights,
  };
}
