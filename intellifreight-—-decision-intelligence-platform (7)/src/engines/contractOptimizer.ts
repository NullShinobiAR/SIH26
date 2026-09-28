import {
  ContractOption,
  ContractStrategy,
  FreightForecastResult,
  MarketEntryTiming,
  OptimizationPreference,
  ComprehensiveRiskAssessment,
  VoyageCostBreakdown,
} from '../types';

/**
 * CONTRACT STRATEGY DEFINITIONS & ELIGIBILITY CONSTRAINTS
 *
 * Contract strategy eligibility is enforced before economic optimization.
 * Strategies requiring a greater contractual voyage commitment than requested
 * are excluded from the final recommendation.
 *
 * Spot remains a first-class eligible strategy and may win when appropriate.
 */
export interface StrategyDefinition {
  strategy: ContractStrategy;
  title: string;
  subtitle: string;
  minVoyages: number;
  maxVoyages?: number;
  horizonWeeks: number;
  commitmentDescription: string;
}

export const CONTRACT_STRATEGY_DEFINITIONS: Record<ContractStrategy, StrategyDefinition> = {
  spot: {
    strategy: 'spot',
    title: 'Repeated Spot Fixtures',
    subtitle: 'Fixture-by-fixture ad-hoc market procurement',
    minVoyages: 1,
    maxVoyages: undefined,
    horizonWeeks: 2,
    commitmentDescription: 'Single fixture / ad-hoc procurement (1+ voyages)',
  },
  short_term: {
    strategy: 'short_term',
    title: 'Short-Term Multi-Voyage (3–5 Consecutive Voyages)',
    subtitle: 'Fixed-rate consecutive voyage charter (3–4 months)',
    minVoyages: 3,
    maxVoyages: 5,
    horizonWeeks: 14,
    commitmentDescription: '3–5 consecutive voyages',
  },
  medium_term: {
    strategy: 'medium_term',
    title: 'Medium-Term Multi-Voyage (6–12 Months)',
    subtitle: 'Structured medium-term consecutive charter',
    minVoyages: 6,
    maxVoyages: 12,
    horizonWeeks: 32,
    commitmentDescription: '6–12 consecutive voyages (6–12 months commitment)',
  },
  coa: {
    strategy: 'coa',
    title: 'Contract of Affreightment (COA)',
    subtitle: 'Tonnage-based volume contract without vessel naming',
    minVoyages: 6,
    maxVoyages: undefined,
    horizonWeeks: 26,
    commitmentDescription: 'multi-voyage volume commitment (minimum 6 voyages for COA offtake)',
  },
};

export function evaluateStrategyEligibility(
  strategy: ContractStrategy,
  numberOfVoyages: number
): {
  isEligible: boolean;
  eligibilityStatus: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  ineligibilityReason?: string;
  minVoyagesRequired: number;
  maxVoyagesAllowed?: number;
} {
  const def = CONTRACT_STRATEGY_DEFINITIONS[strategy];
  if (!def) {
    return {
      isEligible: true,
      eligibilityStatus: 'ELIGIBLE',
      minVoyagesRequired: 1,
    };
  }

  if (numberOfVoyages < def.minVoyages) {
    let reason = `Strategy requires ${def.commitmentDescription}; request contains ${numberOfVoyages} voyage${numberOfVoyages > 1 ? 's' : ''}.`;
    if (strategy === 'short_term') {
      reason = `Strategy requires 3–5 consecutive voyages; request contains ${numberOfVoyages} voyage${numberOfVoyages > 1 ? 's' : ''}.`;
    } else if (strategy === 'medium_term') {
      reason = `Strategy requires a minimum 6-voyage commitment (6–12 consecutive voyages); request contains ${numberOfVoyages} voyage${numberOfVoyages > 1 ? 's' : ''}.`;
    } else if (strategy === 'coa') {
      reason = `Strategy requires multi-voyage volume commitment (minimum 6 voyages for COA offtake); request contains ${numberOfVoyages} voyage${numberOfVoyages > 1 ? 's' : ''}.`;
    }
    return {
      isEligible: false,
      eligibilityStatus: 'NOT_ELIGIBLE',
      ineligibilityReason: reason,
      minVoyagesRequired: def.minVoyages,
      maxVoyagesAllowed: def.maxVoyages,
    };
  }

  if (def.maxVoyages !== undefined && numberOfVoyages > def.maxVoyages) {
    const reason = `Strategy is structured for ${def.commitmentDescription}; request contains ${numberOfVoyages} voyages (requires medium-term commitment or COA volume arrangement).`;
    return {
      isEligible: false,
      eligibilityStatus: 'NOT_ELIGIBLE',
      ineligibilityReason: reason,
      minVoyagesRequired: def.minVoyages,
      maxVoyagesAllowed: def.maxVoyages,
    };
  }

  return {
    isEligible: true,
    eligibilityStatus: 'ELIGIBLE',
    minVoyagesRequired: def.minVoyages,
    maxVoyagesAllowed: def.maxVoyages,
  };
}

export function optimizeContracts(
  cargoQuantityTonnes: number,
  numberOfVoyages: number,
  forecast: FreightForecastResult,
  baseVoyageCost: VoyageCostBreakdown,
  riskAssessment: ComprehensiveRiskAssessment,
  optimizationPreference: OptimizationPreference = 'balanced'
): {
  contractOptions: ContractOption[];
  recommendedContract: ContractOption;
  marketEntryTiming: MarketEntryTiming;
} {
  const currentSpotRate = forecast.currentRateUsdPerTonne;
  const forward4wRate = forecast.forecast4Weeks;
  const forward8wRate = forecast.forecast8Weeks;
  const trend = forecast.trend;
  const isRising = forward4wRate > currentSpotRate;
  const rateExpectedDelta = forward4wRate - currentSpotRate;
  const volatility = forecast.volatilityAnnualizedPct;

  // Single voyage spot calculation
  // Spot exposes each subsequent voyage to forward price escalation or relief
  let spotBlendedRate = currentSpotRate;
  if (numberOfVoyages > 1) {
    // Expected cost across sequential spot fixtures with forward drift
    const spotSeries = [
      currentSpotRate,
      currentSpotRate + rateExpectedDelta * 0.5,
      currentSpotRate + rateExpectedDelta * 0.9,
      currentSpotRate + (forward8wRate - currentSpotRate) * 0.8,
    ];
    let sum = 0;
    for (let i = 0; i < numberOfVoyages; i++) {
      sum += spotSeries[Math.min(i, spotSeries.length - 1)];
    }
    spotBlendedRate = Number((sum / numberOfVoyages).toFixed(2));
  }

  // Contract Strategy 1: Spot (Single fixtures)
  const spotRate = spotBlendedRate;
  const spotTotalCost = Math.round(spotRate * cargoQuantityTonnes * numberOfVoyages + (baseVoyageCost.totalVoyageCostUsd - baseVoyageCost.freightCost) * numberOfVoyages);
  const spotPerTonne = Number((spotTotalCost / (cargoQuantityTonnes * numberOfVoyages)).toFixed(2));
  const spotRiskScore = Math.min(95, Math.round(riskAssessment.overallScore * 1.15 + (isRising ? 18 : 0)));

  // Contract Strategy 2: Short-term Multi-Voyage (3-5 voyages or 2-4 months)
  // Shipowners discount 2.5% - 4.5% off rising forward spot in exchange for guaranteed consecutive employment
  const shortTermDiscountPct = isRising ? 0.038 : 0.015;
  const shortTermRate = Number((Math.min(currentSpotRate, forward4wRate) * (1 - shortTermDiscountPct) + currentSpotRate * 0.4 * 0.1).toFixed(2));
  const shortTermTotalCost = Math.round(shortTermRate * cargoQuantityTonnes * numberOfVoyages + (baseVoyageCost.totalVoyageCostUsd - baseVoyageCost.freightCost) * numberOfVoyages * 0.96);
  const shortTermPerTonne = Number((shortTermTotalCost / (cargoQuantityTonnes * numberOfVoyages)).toFixed(2));
  const shortTermRiskScore = Math.round(riskAssessment.overallScore * 0.72);

  // Contract Strategy 3: Medium-term Multi-Voyage (6-12 voyages or 6-12 months)
  // Locks vessel for prolonged period; lower rate if market is high, but commits volume
  const mediumTermDiscountPct = isRising ? 0.055 : -0.02; // if market is falling, owner wants premium or charterer loses if rates collapse
  const mediumTermRate = Number((((currentSpotRate + forward8wRate) / 2) * (1 - mediumTermDiscountPct)).toFixed(2));
  const mediumTermTotalCost = Math.round(mediumTermRate * cargoQuantityTonnes * numberOfVoyages + (baseVoyageCost.totalVoyageCostUsd - baseVoyageCost.freightCost) * numberOfVoyages * 0.93);
  const mediumTermPerTonne = Number((mediumTermTotalCost / (cargoQuantityTonnes * numberOfVoyages)).toFixed(2));
  const mediumTermRiskScore = Math.round(riskAssessment.overallScore * 0.48); // Lowest operational volatility: named vessel, locked schedule, zero substitution risk

  // Contract Strategy 4: COA (Contract of Affreightment - Structured Arrangement)
  // Freight operator commits volume tonnage; no vessel naming; highest scheduling flexibility
  const coaRate = Number(((shortTermRate + mediumTermRate) / 2 * 0.98).toFixed(2));
  const coaTotalCost = Math.round(coaRate * cargoQuantityTonnes * numberOfVoyages + (baseVoyageCost.totalVoyageCostUsd - baseVoyageCost.freightCost) * numberOfVoyages * 0.94);
  const coaPerTonne = Number((coaTotalCost / (cargoQuantityTonnes * numberOfVoyages)).toFixed(2));
  const coaRiskScore = Math.round(riskAssessment.overallScore * 0.62); // Low rate risk, but operator holds vessel substitution rights

  const baseSpotTotal = spotTotalCost;

  // Build options with deterministic eligibility metadata
  const options: ContractOption[] = [
    {
      strategy: 'spot',
      title: CONTRACT_STRATEGY_DEFINITIONS.spot.title,
      subtitle: CONTRACT_STRATEGY_DEFINITIONS.spot.subtitle,
      horizonWeeks: CONTRACT_STRATEGY_DEFINITIONS.spot.horizonWeeks,
      voyagesAllocated: numberOfVoyages,
      agreedRateUsdPerTonne: spotRate,
      totalExpectedCostUsd: spotTotalCost,
      costPerTonneUsd: spotPerTonne,
      landedCostPerTonne: spotPerTonne,
      riskAdjustedCostPerTonne: spotPerTonne,
      riskAdjustedTotalCostUsd: spotTotalCost,
      optimizationScore: 0,
      savingsVsSpotUsd: 0,
      savingsVsSpotPct: 0,
      freightDiscountVsSpotPct: 0,
      riskLevel: spotRiskScore > 65 ? 'HIGH' : spotRiskScore > 40 ? 'MEDIUM' : 'LOW',
      riskScore: spotRiskScore,
      flexibilityScore: 95, // Maximum operational flexibility
      volatilityProtectionScore: 10,
      isRecommended: false,
      ...evaluateStrategyEligibility('spot', numberOfVoyages),
      keyRisks: [
        'Full exposure to spot market freight price surges',
        'Vessel availability bottleneck in prompt loading window',
        'Demurrage risk accumulation during uncoordinated port calls',
      ],
      whyRecommended: [
        'Ideal if freight market is entering a severe cyclical downturn',
        'No long-term minimum cargo commitment',
      ],
    },
    {
      strategy: 'short_term',
      title: CONTRACT_STRATEGY_DEFINITIONS.short_term.title,
      subtitle: CONTRACT_STRATEGY_DEFINITIONS.short_term.subtitle,
      horizonWeeks: CONTRACT_STRATEGY_DEFINITIONS.short_term.horizonWeeks,
      voyagesAllocated: numberOfVoyages,
      agreedRateUsdPerTonne: shortTermRate,
      totalExpectedCostUsd: shortTermTotalCost,
      costPerTonneUsd: shortTermPerTonne,
      landedCostPerTonne: shortTermPerTonne,
      riskAdjustedCostPerTonne: shortTermPerTonne,
      riskAdjustedTotalCostUsd: shortTermTotalCost,
      optimizationScore: 0,
      savingsVsSpotUsd: Math.max(0, baseSpotTotal - shortTermTotalCost),
      savingsVsSpotPct: Number((Math.max(0, ((baseSpotTotal - shortTermTotalCost) / baseSpotTotal) * 100)).toFixed(1)),
      freightDiscountVsSpotPct: 0,
      riskLevel: shortTermRiskScore > 65 ? 'HIGH' : shortTermRiskScore > 40 ? 'MEDIUM' : 'LOW',
      riskScore: shortTermRiskScore,
      flexibilityScore: 78,
      volatilityProtectionScore: 82,
      isRecommended: false,
      ...evaluateStrategyEligibility('short_term', numberOfVoyages),
      keyRisks: [
        'Committed laycan schedule requires strict coal railhead coordination',
        'Opportunity cost if freight unexpectedly collapses',
      ],
      whyRecommended: [
        'Hedges against forecast 4–8 week freight rate inflation',
        'Guarantees vessel arrival window at load port (Hay Point)',
        'Significantly dampens demurrage risk via dedicated tonnage rotation',
      ],
    },
    {
      strategy: 'medium_term',
      title: CONTRACT_STRATEGY_DEFINITIONS.medium_term.title,
      subtitle: CONTRACT_STRATEGY_DEFINITIONS.medium_term.subtitle,
      horizonWeeks: CONTRACT_STRATEGY_DEFINITIONS.medium_term.horizonWeeks,
      voyagesAllocated: numberOfVoyages,
      agreedRateUsdPerTonne: mediumTermRate,
      totalExpectedCostUsd: mediumTermTotalCost,
      costPerTonneUsd: mediumTermPerTonne,
      landedCostPerTonne: mediumTermPerTonne,
      riskAdjustedCostPerTonne: mediumTermPerTonne,
      riskAdjustedTotalCostUsd: mediumTermTotalCost,
      optimizationScore: 0,
      savingsVsSpotUsd: Math.max(0, baseSpotTotal - mediumTermTotalCost),
      savingsVsSpotPct: Number((Math.max(0, ((baseSpotTotal - mediumTermTotalCost) / baseSpotTotal) * 100)).toFixed(1)),
      freightDiscountVsSpotPct: 0,
      riskLevel: mediumTermRiskScore > 65 ? 'HIGH' : mediumTermRiskScore > 40 ? 'MEDIUM' : 'LOW',
      riskScore: mediumTermRiskScore,
      flexibilityScore: 60,
      volatilityProtectionScore: 94,
      isRecommended: false,
      ...evaluateStrategyEligibility('medium_term', numberOfVoyages),
      keyRisks: [
        'Rigid schedule with take-or-pay / deadfreight liability if steel demand drops',
        'Locked rate may exceed spot if global dry bulk enters surplus',
      ],
      whyRecommended: [
        'Maximum freight rate certainty for plant budget planning',
        'Substantial owner discount for guaranteed 6+ month vessel employment',
      ],
    },
    {
      strategy: 'coa',
      title: CONTRACT_STRATEGY_DEFINITIONS.coa.title,
      subtitle: CONTRACT_STRATEGY_DEFINITIONS.coa.subtitle,
      horizonWeeks: CONTRACT_STRATEGY_DEFINITIONS.coa.horizonWeeks,
      voyagesAllocated: numberOfVoyages,
      agreedRateUsdPerTonne: coaRate,
      totalExpectedCostUsd: coaTotalCost,
      costPerTonneUsd: coaPerTonne,
      landedCostPerTonne: coaPerTonne,
      riskAdjustedCostPerTonne: coaPerTonne,
      riskAdjustedTotalCostUsd: coaTotalCost,
      optimizationScore: 0,
      savingsVsSpotUsd: Math.max(0, baseSpotTotal - coaTotalCost),
      savingsVsSpotPct: Number((Math.max(0, ((baseSpotTotal - coaTotalCost) / baseSpotTotal) * 100)).toFixed(1)),
      freightDiscountVsSpotPct: 0,
      riskLevel: coaRiskScore > 65 ? 'HIGH' : coaRiskScore > 40 ? 'MEDIUM' : 'LOW',
      riskScore: coaRiskScore,
      flexibilityScore: 78,
      volatilityProtectionScore: 85,
      isRecommended: false,
      ...evaluateStrategyEligibility('coa', numberOfVoyages),
      keyRisks: [
        'Operator has right to substitute vessels, requiring continuous port feasibility validation',
        'Complex demurrage reconciliation across pooled vessels',
      ],
      whyRecommended: [
        'Optimal blend of volume discount and scheduling flexibility',
        'Operator bears repositioning and ballast risk',
      ],
    },
  ];

  // =========================================================================
  // HARD ELIGIBILITY FILTER (Pre-Scoring Constraint)
  // =========================================================================
  // Contract strategy eligibility is enforced before economic optimization.
  // Strategies requiring a greater contractual voyage commitment than requested
  // are excluded from the final recommendation.
  // Spot remains a first-class eligible strategy and may win when appropriate.
  const eligibleCandidates = options.filter((opt) => opt.isEligible);
  const candidates = eligibleCandidates.length > 0 ? eligibleCandidates : options;

  // Mathematical Multi-Attribute Decision Optimization (MADO)
  // Utility Maximization: Max [ w_cost * S_cost + w_risk * S_risk + w_flex * S_flex + Delta_carry - Omega_commitment ]
  let wCost = 0.50;
  let wRisk = 0.30;
  let wFlex = 0.20;

  if (optimizationPreference === 'lowest_cost') {
    // Pure cost minimization: 100% nominal landed cost weighting; zero risk/flex loading overrides
    wCost = 1.0;
    wRisk = 0.0;
    wFlex = 0.0;
  } else if (optimizationPreference === 'lowest_risk') {
    wCost = 0.15;
    wRisk = 0.75;
    wFlex = 0.10;
  } else if (optimizationPreference === 'green') {
    wCost = 0.30;
    wRisk = 0.20;
    wFlex = 0.50;
  }

  const totalCargo = cargoQuantityTonnes * numberOfVoyages;
  const maxCost = Math.max(...options.map((o) => o.totalExpectedCostUsd));
  const cScale = (maxCost * 1.08) / totalCargo;
  const lambda = cScale / Math.max(0.1, wCost);

  let bestScore = -Infinity;
  let optimalStrategy: ContractStrategy = candidates[0].strategy;

  options.forEach((opt) => {
    let commitmentOverhead = 0;
    let marketCarryAdjustment = 0;

    // In lowest_cost mode, no commitment or carry penalties can override the pure landed cost metric
    if (optimizationPreference !== 'lowest_cost') {
      if (numberOfVoyages < 2) {
        if (opt.strategy === 'medium_term') commitmentOverhead = 0.15;
        else if (opt.strategy === 'coa') commitmentOverhead = 0.20;
      } else if (numberOfVoyages >= 4) {
        if (opt.strategy === 'spot' && isRising) commitmentOverhead = 0.10;
      }

      if (!isRising) {
        if (opt.strategy === 'spot') marketCarryAdjustment = 0.10;
        else if (opt.strategy === 'medium_term') marketCarryAdjustment = -0.05;
      } else {
        if (opt.strategy === 'short_term' || opt.strategy === 'coa' || opt.strategy === 'medium_term') marketCarryAdjustment = 0.08;
      }
    }

    const normalizedCost = 1 - opt.totalExpectedCostUsd / (maxCost * 1.08);
    const normalizedRisk = 1 - opt.riskScore / 100;
    const normalizedFlex = opt.flexibilityScore / 100;

    const score =
      wCost * normalizedCost +
      wRisk * normalizedRisk +
      wFlex * normalizedFlex +
      marketCarryAdjustment -
      commitmentOverhead;

    let riskAdjustedCost: number;
    let riskAdjustedTotal: number;

    if (optimizationPreference === 'lowest_cost') {
      // In Lowest Cost mode, the reported cost is purely nominal landed cost without synthetic risk loading
      riskAdjustedCost = opt.costPerTonneUsd;
      riskAdjustedTotal = opt.totalExpectedCostUsd;
    } else {
      // Mathematical dual: Actuarially sound risk-adjusted logistics cost per tonne ($/t)
      // Directly derived from the MADO objective weights to maintain 100% ranking consistency:
      const riskLoading = lambda * wRisk * (opt.riskScore / 100);
      const flexLoading = lambda * wFlex * ((100 - opt.flexibilityScore) / 100);
      const carryBenefit = lambda * marketCarryAdjustment;
      const commitPenalty = lambda * commitmentOverhead;

      riskAdjustedCost = Number(
        (opt.costPerTonneUsd + riskLoading + flexLoading - carryBenefit + commitPenalty).toFixed(2)
      );
      riskAdjustedTotal = Math.round(riskAdjustedCost * totalCargo);
    }

    opt.landedCostPerTonne = opt.costPerTonneUsd;
    opt.riskAdjustedCostPerTonne = riskAdjustedCost;
    opt.riskAdjustedTotalCostUsd = riskAdjustedTotal;
    opt.optimizationScore = Number((score * 100).toFixed(1));
    opt.freightDiscountVsSpotPct = Number(
      (((spotRate - opt.agreedRateUsdPerTonne) / spotRate) * 100).toFixed(1)
    );

    // Only eligible candidates can be selected for final recommendation
    if (opt.isEligible && score > bestScore) {
      bestScore = score;
      optimalStrategy = opt.strategy;
    }
  });

  // Ensure ONLY the winning eligible candidate has isRecommended: true
  options.forEach((opt) => {
    opt.isRecommended = opt.strategy === optimalStrategy && opt.isEligible;
  });

  const recommendedContract =
    options.find((opt) => opt.strategy === optimalStrategy && opt.isEligible) || candidates[0];

  // Market Entry Timing Engine
  const probIncrease = Math.min(88, Math.max(15, Math.round(50 + (rateExpectedDelta / currentSpotRate) * 120 + (volatility * 0.4))));
  const probDecrease = 100 - probIncrease;

  let timingAction: 'ENTER NOW' | 'ENTER WITHIN 7 DAYS' | 'WAIT AND MONITOR' | 'REASSESS IN 2 WEEKS' = 'ENTER WITHIN 7 DAYS';
  let urgency: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  let optimalWindowDays = '3 to 7 Days';
  const drivers: string[] = [];

  if (probIncrease >= 75) {
    timingAction = 'ENTER NOW';
    urgency = 'HIGH';
    optimalWindowDays = 'Prompt (1–3 Days)';
    drivers.push(`High upward momentum: 4-week forecast projects rate increase of ${forecast.expectedChangePct4Weeks}%`);
    drivers.push(`BDI Dry Bulk sentiment is firmly bullish (+${forecast.volatilityAnnualizedPct}% annualized volatility)`);
    drivers.push(`[SIMULATED MARKET SIGNAL] Prompt tonnage availability in Queensland/Australia bulk loading terminals is tightening`);
  } else if (probIncrease >= 55) {
    timingAction = 'ENTER WITHIN 7 DAYS';
    urgency = 'MEDIUM';
    optimalWindowDays = '3 to 7 Days';
    drivers.push(`Moderate upward trend: Expected rate increase of $${rateExpectedDelta.toFixed(2)}/t over 4 weeks`);
    const recStrategyName = recommendedContract.title;
    drivers.push(
      recommendedContract.strategy === 'spot'
        ? `Prompt market execution locks current rate before anticipated seasonal restocking push`
        : `${recStrategyName} structure secures favorable terms before seasonal restocking push`
    );
    drivers.push(`[DEMO BENCHMARK — NOT LIVE] Singapore VLSFO bunker fuel spread benchmark proxy steady at $${forecast.currentRateUsdPerTonne > 20 ? 'elevated' : 'balanced'} levels`);
  } else if (probDecrease >= 65) {
    timingAction = 'WAIT AND MONITOR';
    urgency = 'LOW';
    optimalWindowDays = '10 to 14 Days';
    drivers.push(`Market easing expected: Forward freight curves indicate rate softening of ${Math.abs(forecast.expectedChangePct4Weeks)}%`);
    drivers.push(`[SIMULATED MARKET SIGNAL] Modeled ballast tonnage accumulation in Indian Ocean eases chartering pressure`);
  } else {
    timingAction = 'REASSESS IN 2 WEEKS';
    urgency = 'LOW';
    optimalWindowDays = '14 to 21 Days';
    drivers.push(`Range-bound market dynamics: Volatility within normal bands`);
    drivers.push(`[SIMULATED BENCHMARK] Recommend monitoring freight indices before fixing multi-voyage arrangements`);
  }

  const marketSignals: MarketEntryTiming['marketSignals'] = [
    {
      indicator: 'BDI Momentum (Modeled Proxy)',
      signal: isRising ? 'bullish' : 'bearish',
      comment: isRising
        ? '[SIMULATED MARKET SIGNAL] Modeled dry-bulk inquiry expansion in Asia-Pacific trades'
        : '[SIMULATED MARKET SIGNAL] Range-bound inquiry and steady vessel supply',
    },
    {
      indicator: 'Singapore VLSFO Bunker Trend (Benchmark)',
      signal: 'neutral',
      comment: '[DEMO BENCHMARK — NOT LIVE] Singapore marine fuel benchmark proxy steady at $612/t',
    },
    {
      indicator: 'Queensland Coal Terminal Lineups (Simulated)',
      signal: 'bullish',
      comment: '[SIMULATED QUEUE] Modeled Hay Point & Dalrymple Bay queue expansion adding turnaround buffer',
    },
    {
      indicator: 'East Coast India Discharge Conditions (Seasonal Model)',
      signal: 'neutral',
      comment: '[SIMULATED SEASONAL MODEL] Post-monsoon discharge productivity following historical seasonal distribution',
    },
  ];

  return {
    contractOptions: options,
    recommendedContract,
    marketEntryTiming: {
      action: timingAction,
      urgency,
      probRateIncreasePct: probIncrease,
      probRateDecreasePct: probDecrease,
      optimalWindowDays,
      drivers,
      marketSignals,
    },
  };
}
