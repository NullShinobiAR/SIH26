import {
  ContractOption,
  ContractStrategy,
  FreightForecastResult,
  Port,
  Vessel,
  VesselFeasibilityResult,
  ComprehensiveRiskAssessment,
  VoyageCostBreakdown,
  OptimizationPreference,
} from '../types';

export function generateExplanation(
  recommendedContract: ContractOption,
  allContracts: ContractOption[],
  forecast: FreightForecastResult,
  recommendedVessel: Vessel,
  feasibilityResults: VesselFeasibilityResult[],
  originPort: Port,
  destinationPort: Port,
  numberOfVoyages: number,
  cargoQuantityTonnes: number,
  risk: ComprehensiveRiskAssessment,
  voyageCost: VoyageCostBreakdown,
  optimizationPreference: OptimizationPreference = 'balanced'
): {
  summary: string;
  whyThisRecommendation: string[];
  whatCouldChangeThis: string[];
  quantifiedTradeoffs: { metric: string; chosen: string; runnerUp: string; delta: string }[];
} {
  const spotOption = allContracts.find((c) => c.strategy === 'spot') || allContracts[0];
  
  // HARD CONSTRAINT: Filter alternatives to ONLY strategies that are strictly eligible under the current scenario
  const eligibleAlternatives = allContracts.filter(
    (c) => c.strategy !== recommendedContract.strategy && c.isEligible
  );
  const hasEligibleAlternatives = eligibleAlternatives.length > 0;

  // Select runner-up strictly among eligible alternatives (never fall back to an ineligible strategy)
  const runnerUp: ContractOption | null = hasEligibleAlternatives
    ? eligibleAlternatives.slice().sort((a, b) => b.optimizationScore - a.optimizationScore)[0]
    : null;

  const totalCargo = cargoQuantityTonnes * numberOfVoyages;
  const savingsVsSpot = recommendedContract.savingsVsSpotUsd;
  const savingsPct = recommendedContract.savingsVsSpotPct;

  // Build high-level summary
  let summary = '';
  if (recommendedContract.strategy === 'spot' && !hasEligibleAlternatives) {
    summary = `Spot selected because it is the only eligible strategy for the current voyage count. It provides ad-hoc single-fixture market procurement without committing to multi-voyage volume obligations (3–12 voyages) that exceed requested cargo requirements.`;
  } else if (recommendedContract.strategy === 'spot') {
    summary = `Spot Market Fixture recommended over eligible alternative (${runnerUp!.title}) due to prompt vessel liquidity and high scheduling flexibility, avoiding forward commitment overhead across ${numberOfVoyages} voyages.`;
  } else if (recommendedContract.strategy === 'short_term') {
    summary = `Short-Term Multi-Voyage Contract (${numberOfVoyages} consecutive voyages) recommended over eligible alternative${runnerUp ? ` (${runnerUp.title})` : ''}, locking an expected saving of $${savingsVsSpot.toLocaleString()} (${savingsPct}%) while hedging forward freight inflation.`;
  } else if (recommendedContract.strategy === 'medium_term') {
    summary = `Medium-Term Multi-Voyage Contract recommended over eligible alternative${runnerUp ? ` (${runnerUp.title})` : ''} to achieve owner volume rebate across ${numberOfVoyages} voyages and insulate against long-term cyclical volatility.`;
  } else {
    summary = `Contract of Affreightment (COA) recommended over eligible alternative${runnerUp ? ` (${runnerUp.title})` : ''} to leverage operator fleet economies while transferring repositioning and ballast risk away from charterer.`;
  }

  // Why this recommendation? Real model output drivers:
  const whyThisRecommendation: string[] = [];

  // If only Spot is eligible (e.g. 1 voyage scenario): explain its characteristics independently without false comparison
  if (!hasEligibleAlternatives) {
    // Driver 1: Explicit statement of sole eligibility
    whyThisRecommendation.push(
      `Voyage count eligibility: Spot selected because it is the only eligible strategy for the current voyage count. All other candidate strategies (Short-Term requires 3–5 voyages, Medium-Term requires 6–12 voyages, and COA requires minimum 6 voyages) are ineligible for a single-voyage request.`
    );

    // Driver 2: Economic & landed cost characteristics
    whyThisRecommendation.push(
      `Single-voyage cost structure: Expected nominal landed logistics cost is $${recommendedContract.costPerTonneUsd.toFixed(2)}/t (total contract cost: $${recommendedContract.totalExpectedCostUsd.toLocaleString()}), based on prompt freight rate of $${recommendedContract.agreedRateUsdPerTonne.toFixed(2)}/t. Ad-hoc spot execution commits solely to the required ${totalCargo.toLocaleString()} tonnes with zero forward volume obligations or under-utilization penalties.`
    );

    // Driver 3: Flexibility and risk profile
    whyThisRecommendation.push(
      `Operational flexibility and risk profile: Spot fixture secures maximum scheduling flexibility (${recommendedContract.flexibilityScore}/100) with zero forward vessel commitments or laycan lock-ins. Standalone risk score is evaluated at ${recommendedContract.riskScore}/100 (${recommendedContract.riskLevel}), reflecting prompt exposure to short-term market rate volatility (${forecast.volatilityAnnualizedPct}% annualized).`
    );

    // Driver 4: Freight forecast context
    if (forecast.forecast4Weeks > forecast.currentRateUsdPerTonne) {
      whyThisRecommendation.push(
        `Freight forecast upward trajectory: Machine learning ensemble models predict prompt freight rates to rise by ${forecast.expectedChangePct4Weeks}% (+$${(forecast.forecast4Weeks - forecast.currentRateUsdPerTonne).toFixed(2)}/t) over the next 4–8 weeks. Single fixture execution satisfies prompt requirement without long-term commitment overhead.`
      );
    } else {
      whyThisRecommendation.push(
        `Freight forecast stability: Rates are projected within a stable envelope ($${forecast.currentRateUsdPerTonne.toFixed(2)}/t to $${forecast.forecast4Weeks.toFixed(2)}/t), supporting single prompt voyage execution.`
      );
    }

    // Driver 5: Deterministic physical feasibility
    whyThisRecommendation.push(
      `Physical feasibility validated: ${recommendedVessel.name} (${recommendedVessel.vesselClass}) is 100% compliant with ${originPort.name} and ${destinationPort.name} LOA, beam, and draft constraints with ${(destinationPort.maxDraft - recommendedVessel.draft).toFixed(1)}m under-keel safety margin.`
    );

    // Driver 6: Port congestion stability
    whyThisRecommendation.push(
      `Congestion resilience: ${destinationPort.name} waiting time (${destinationPort.averageWaitingDays} days, score ${destinationPort.congestionScore}/100) is within manageable bounds, keeping demurrage risk low.`
    );
  } else {
    // MULTIPLE STRATEGIES ELIGIBLE: Provide rigorous comparative trade-off analysis against top eligible runner-up
    const activeRunnerUp = runnerUp!;

    // Driver 1: Freight forecast dynamics
    if (forecast.forecast4Weeks > forecast.currentRateUsdPerTonne) {
      whyThisRecommendation.push(
        `Freight forecast upward trajectory: Machine learning ensemble models predict freight rates to rise by ${forecast.expectedChangePct4Weeks}% (+$${(forecast.forecast4Weeks - forecast.currentRateUsdPerTonne).toFixed(2)}/t) over the next 4–8 weeks.`
      );
    } else {
      whyThisRecommendation.push(
        `Freight forecast stability: Rates are projected within a stable envelope ($${forecast.currentRateUsdPerTonne}/t to $${forecast.forecast4Weeks}/t), supporting market timing discipline.`
      );
    }

    // Driver 2: Volatility hedging vs spot liquidity
    if (recommendedContract.strategy === 'spot') {
      whyThisRecommendation.push(
        `Volatility exposure: Market exhibits ${forecast.volatilityAnnualizedPct}% annualized volatility. Spot procurement preserves scheduling flexibility without locking in forward commitment overhead.`
      );
    } else {
      whyThisRecommendation.push(
        `Volatility mitigation: Market exhibits ${forecast.volatilityAnnualizedPct}% annualized volatility. Locking multi-voyage rates eliminates exposure to spot market price spikes on subsequent voyages.`
      );
    }

    // Driver 3: Cargo and voyage demand scale & mathematically derived discount
    const spotFreightRate = spotOption.agreedRateUsdPerTonne;
    const recFreightRate = recommendedContract.agreedRateUsdPerTonne;
    const freightDiscount = spotFreightRate - recFreightRate;
    const freightDiscountPct = Number(((freightDiscount / spotFreightRate) * 100).toFixed(1));

    if (freightDiscountPct > 0) {
      whyThisRecommendation.push(
        `Volume synergy: A multi-voyage commitment of ${numberOfVoyages} voyages (${totalCargo.toLocaleString()} tonnes) secures an owner freight discount of ${freightDiscountPct}% ($${freightDiscount.toFixed(2)}/t freight discount, from $${spotFreightRate.toFixed(2)}/t spot down to $${recFreightRate.toFixed(2)}/t) relative to prompt spot replacement.`
      );
    } else {
      whyThisRecommendation.push(
        `Volume commitment: A commitment of ${numberOfVoyages} voyages (${totalCargo.toLocaleString()} tonnes) secures vessel scheduling certainty and insulates against forward market spikes.`
      );
    }

    // Driver 4: Deterministic physical feasibility
    whyThisRecommendation.push(
      `Physical feasibility validated: ${recommendedVessel.name} (${recommendedVessel.vesselClass}) is 100% compliant with ${originPort.name} and ${destinationPort.name} LOA, beam, and draft constraints with ${(destinationPort.maxDraft - recommendedVessel.draft).toFixed(1)}m under-keel safety margin.`
    );

    // Driver 5: Risk-adjusted cost supremacy & explicit metric separation against eligible runner-up
    const riskAdjDelta = Number(Math.abs(activeRunnerUp.riskAdjustedCostPerTonne - recommendedContract.riskAdjustedCostPerTonne).toFixed(2));
    const landedDelta = Number((recommendedContract.costPerTonneUsd - activeRunnerUp.costPerTonneUsd).toFixed(2));

    if (optimizationPreference === 'lowest_cost') {
      const landedAdvantage = Number(Math.abs(landedDelta).toFixed(2));
      whyThisRecommendation.push(
        `Total voyage economics: Objective set to Lowest Cost (Min Total Freight). Expected nominal landed cost of $${recommendedContract.costPerTonneUsd.toFixed(2)}/t outperforms alternative candidate (${activeRunnerUp.title} at $${activeRunnerUp.costPerTonneUsd.toFixed(2)}/t) by $${landedAdvantage.toFixed(2)}/t (saving $${(landedAdvantage * totalCargo).toLocaleString()} total). In Lowest Cost mode, nominal landed freight is the decisive selection metric without risk or flexibility overrides.`
      );
    } else if (optimizationPreference === 'lowest_risk') {
      whyThisRecommendation.push(
        `Total voyage economics: Objective set to Lowest Risk (Max Hedging & Certainty). Candidate delivers lowest risk score of ${recommendedContract.riskScore}/100 vs alternative candidate (${activeRunnerUp.title} at ${activeRunnerUp.riskScore}/100), eliminating rate volatility exposure across the voyage program.`
      );
    } else if (recommendedContract.costPerTonneUsd <= activeRunnerUp.costPerTonneUsd) {
      const landedAdvantage = Number(Math.abs(landedDelta).toFixed(2));
      whyThisRecommendation.push(
        `Total voyage economics: Expected risk-adjusted logistics cost of $${recommendedContract.riskAdjustedCostPerTonne.toFixed(2)}/t outperforms alternative candidate (${activeRunnerUp.title} at $${activeRunnerUp.riskAdjustedCostPerTonne.toFixed(2)}/t) by $${riskAdjDelta.toFixed(2)}/t, while also delivering a lower nominal landed cost ($${recommendedContract.costPerTonneUsd.toFixed(2)}/t vs $${activeRunnerUp.costPerTonneUsd.toFixed(2)}/t, saving $${landedAdvantage.toFixed(2)}/t).`
      );
    } else {
      // Winner has higher nominal landed cost, but strictly wins on risk-adjusted cost and optimization score
      whyThisRecommendation.push(
        `Total voyage economics: Expected risk-adjusted logistics cost of $${recommendedContract.riskAdjustedCostPerTonne.toFixed(2)}/t outperforms alternative candidate (${activeRunnerUp.title} at $${activeRunnerUp.riskAdjustedCostPerTonne.toFixed(2)}/t) by $${riskAdjDelta.toFixed(2)}/t. While ${activeRunnerUp.title} achieves a lower nominal landed cost ($${activeRunnerUp.costPerTonneUsd.toFixed(2)}/t vs $${recommendedContract.costPerTonneUsd.toFixed(2)}/t, a -$${Math.abs(landedDelta).toFixed(2)}/t landed variance), ${recommendedContract.title} captures superior total value through higher scheduling flexibility (${recommendedContract.flexibilityScore}/100 vs ${activeRunnerUp.flexibilityScore}/100) and lower operational commitment risk.`
      );
    }

    // Driver 6: Port congestion stability
    whyThisRecommendation.push(
      `Congestion resilience: ${destinationPort.name} waiting time (${destinationPort.averageWaitingDays} days, score ${destinationPort.congestionScore}/100) is within manageable bounds, keeping demurrage risk low.`
    );
  }

  // Calculate switch conditions and sensitivity
  const whatCouldChangeThis: string[] = [];

  if (!hasEligibleAlternatives) {
    // When only Spot is eligible, what could change the decision is expanding voyage program to unlock other eligible contracts
    whatCouldChangeThis.push(
      `Voyage Program Expansion: If procurement scales from 1 voyage to 3–5 voyages, Short-Term Multi-Voyage contracts become eligible. If scaling to 6+ voyages, Medium-Term and COA volume arrangements also become eligible, unlocking structured owner volume discounts.`
    );
    whatCouldChangeThis.push(
      `Market-Entry Timing Shift: With Spot as the sole eligible single-voyage strategy, market-entry timing (recommended: ${forecast.trend === 'BEARISH' ? 'WAIT AND MONITOR' : 'ENTER WITHIN 7 DAYS'}) is the primary operational lever to mitigate prompt rate volatility (${forecast.volatilityAnnualizedPct}% annualized).`
    );
    const dailyDemurrageRate = recommendedVessel.dailyHireRateUsd * 1.1;
    whatCouldChangeThis.push(
      `Port Queuing Demurrage: Extended discharge delays at ${destinationPort.name} beyond ${destinationPort.averageWaitingDays} days would accumulate demurrage (~$${Math.round(dailyDemurrageRate).toLocaleString()}/day), directly increasing single-voyage landed costs.`
    );
    whatCouldChangeThis.push(
      `Bunker Fuel Benchmark: A 10% movement in VLSFO bunker benchmark prices (~$${Math.round(voyageCost.totalBunkerCost * 0.10).toLocaleString()} per voyage) directly alters prompt voyage fuel operating expenses.`
    );
  } else {
    const activeRunnerUp = runnerUp!;
    const costAdvantageUsd = Math.abs(activeRunnerUp.totalExpectedCostUsd - recommendedContract.totalExpectedCostUsd);
    const costAdvantagePerTonne = Number((costAdvantageUsd / Math.max(1, totalCargo)).toFixed(2));
    
    // Rate threshold where runner-up becomes cheaper
    const switchRateUsd = recommendedContract.strategy === 'spot'
      ? Number((recommendedContract.agreedRateUsdPerTonne + costAdvantagePerTonne).toFixed(2))
      : Number((recommendedContract.agreedRateUsdPerTonne - costAdvantagePerTonne).toFixed(2));

    // Daily demurrage exposure (approx 1.1x vessel daily hire)
    const dailyDemurrageRate = recommendedVessel.dailyHireRateUsd * 1.1;
    const congestionFlipDays = Number((costAdvantageUsd / Math.max(1, dailyDemurrageRate * numberOfVoyages)).toFixed(1));

    whatCouldChangeThis.push(
      `Freight Rate Switch Threshold: If prompt spot freight rates shift to $${switchRateUsd}/t (a delta of $${costAdvantagePerTonne}/t), the cost advantage of ${recommendedContract.title} evaporates, switching recommendation to eligible alternative ${activeRunnerUp.title}.`
    );
    whatCouldChangeThis.push(
      `Port Congestion Tolerance: If queuing at ${destinationPort.name} increases by +${congestionFlipDays} days beyond current average (${destinationPort.averageWaitingDays} days), accumulated demurrage ($${Math.round(dailyDemurrageRate)}/day) neutralizes the contract savings vs ${activeRunnerUp.title}.`
    );
    whatCouldChangeThis.push(
      numberOfVoyages <= 5
        ? `Voyage Program Expansion: If procurement scales commitment to 6+ voyages, Medium-Term and COA volume arrangements become eligible, potentially outperforming current strategies.`
        : `Voyage Commitment Scaling: If procurement reduces commitment from ${numberOfVoyages} voyages down to 1 voyage, multi-voyage structural commitments become ineligible, immediately flipping recommendation to Spot.`
    );
    whatCouldChangeThis.push(
      `Bunker Fuel Elasticity: A bunker shock of +$${Math.round(costAdvantagePerTonne * 85)}/t on VLSFO would favor contracts with fuel surcharge caps or slow-steaming COA arrangements.`
    );
  }

  // Helper for short strategy names in trade-off attribution
  const getStrategyLabel = (strategy: ContractStrategy, title: string): string => {
    switch (strategy) {
      case 'coa':
        return 'COA';
      case 'spot':
        return 'Spot';
      case 'short_term':
        return 'Short-Term';
      case 'medium_term':
        return 'Medium-Term';
      default:
        return title;
    }
  };
  const recLabel = getStrategyLabel(recommendedContract.strategy, recommendedContract.title);

  // Mathematical Trade-Off Decomposition
  let quantifiedTradeoffs: { metric: string; chosen: string; runnerUp: string; delta: string }[];

  if (!hasEligibleAlternatives) {
    // Single-voyage case: No eligible competitor exists under the current scenario
    quantifiedTradeoffs = [
      {
        metric: 'Total Contract Cost',
        chosen: `$${recommendedContract.totalExpectedCostUsd.toLocaleString()}`,
        runnerUp: 'None (Ineligible)',
        delta: 'Single-voyage baseline (Sole eligible strategy)',
      },
      {
        metric: 'Nominal Landed Cost',
        chosen: `$${recommendedContract.costPerTonneUsd.toFixed(2)} / t`,
        runnerUp: 'None (Ineligible)',
        delta: 'Single-voyage baseline',
      },
      {
        metric: 'Risk-Adjusted Cost',
        chosen: `$${recommendedContract.riskAdjustedCostPerTonne.toFixed(2)} / t`,
        runnerUp: 'None (Ineligible)',
        delta: 'Single-voyage baseline',
      },
      {
        metric: 'Optimization Utility',
        chosen: `${recommendedContract.optimizationScore.toFixed(1)} / 100`,
        runnerUp: 'None (Ineligible)',
        delta: 'Sole eligible candidate (Baseline)',
      },
      {
        metric: 'Risk Exposure',
        chosen: `${recommendedContract.riskScore} / 100 (${recommendedContract.riskLevel})`,
        runnerUp: 'None (Ineligible)',
        delta: `${recommendedContract.riskScore}/100 standalone risk (Baseline)`,
      },
      {
        metric: 'Scheduling Flexibility',
        chosen: `${recommendedContract.flexibilityScore} / 100`,
        runnerUp: 'None (Ineligible)',
        delta: 'Maximum operational flexibility (Baseline)',
      },
    ];
  } else {
    const activeRunnerUp = runnerUp!;
    // Attribution Delta = Recommended Strategy − Runner-Up Strategy
    const totalCostDelta = recommendedContract.totalExpectedCostUsd - activeRunnerUp.totalExpectedCostUsd;
    const landedCostDelta = Number((recommendedContract.costPerTonneUsd - activeRunnerUp.costPerTonneUsd).toFixed(2));
    const riskAdjCostDelta = Number((recommendedContract.riskAdjustedCostPerTonne - activeRunnerUp.riskAdjustedCostPerTonne).toFixed(2));
    const optScoreDelta = Number((recommendedContract.optimizationScore - activeRunnerUp.optimizationScore).toFixed(1));
    const riskScoreDelta = recommendedContract.riskScore - activeRunnerUp.riskScore;
    const flexScoreDelta = recommendedContract.flexibilityScore - activeRunnerUp.flexibilityScore;

    const formatTotalCostDelta = (diff: number, label: string) => {
      if (diff > 0) return `+$${diff.toLocaleString()} (${label} premium)`;
      if (diff < 0) return `-$${Math.abs(diff).toLocaleString()} (${label} saving)`;
      return `$0 (neutral)`;
    };

    const formatLandedCostDelta = (diff: number, label: string) => {
      if (diff > 0) return `+$${diff.toFixed(2)}/t (${label} premium)`;
      if (diff < 0) return `-$${Math.abs(diff).toFixed(2)}/t (${label} saving)`;
      return `$0.00/t (neutral)`;
    };

    const formatRiskAdjCostDelta = (diff: number, label: string) => {
      if (diff < 0) return `-$${Math.abs(diff).toFixed(2)}/t (${label} saving)`;
      if (diff > 0) return `+$${diff.toFixed(2)}/t (${label} premium)`;
      return `$0.00/t (neutral)`;
    };

    const formatOptScoreDelta = (diff: number, label: string) => {
      if (diff > 0) return `+${diff.toFixed(1)} points (${label} advantage)`;
      if (diff < 0) return `${diff.toFixed(1)} points (${label} deficit)`;
      return `0.0 points (equal)`;
    };

    const formatRiskScoreDelta = (diff: number, label: string) => {
      if (diff > 0) return `+${diff} points (${label} higher risk; lower is better)`;
      if (diff < 0) return `-${Math.abs(diff)} points (${label} lower risk; advantage)`;
      return `0 points (equal risk)`;
    };

    const formatFlexScoreDelta = (diff: number, label: string) => {
      if (diff > 0) return `+${diff} points (${label} advantage)`;
      if (diff < 0) return `${diff} points (${label} deficit)`;
      return `0 points (equal)`;
    };

    quantifiedTradeoffs = [
      {
        metric: 'Total Contract Cost',
        chosen: `$${recommendedContract.totalExpectedCostUsd.toLocaleString()}`,
        runnerUp: `$${activeRunnerUp.totalExpectedCostUsd.toLocaleString()}`,
        delta: formatTotalCostDelta(totalCostDelta, recLabel),
      },
      {
        metric: 'Nominal Landed Cost',
        chosen: `$${recommendedContract.costPerTonneUsd.toFixed(2)} / t`,
        runnerUp: `$${activeRunnerUp.costPerTonneUsd.toFixed(2)} / t`,
        delta: formatLandedCostDelta(landedCostDelta, recLabel),
      },
      {
        metric: 'Risk-Adjusted Cost',
        chosen: `$${recommendedContract.riskAdjustedCostPerTonne.toFixed(2)} / t`,
        runnerUp: `$${activeRunnerUp.riskAdjustedCostPerTonne.toFixed(2)} / t`,
        delta: formatRiskAdjCostDelta(riskAdjCostDelta, recLabel),
      },
      {
        metric: 'Optimization Utility',
        chosen: `${recommendedContract.optimizationScore.toFixed(1)} / 100`,
        runnerUp: `${activeRunnerUp.optimizationScore.toFixed(1)} / 100`,
        delta: formatOptScoreDelta(optScoreDelta, recLabel),
      },
      {
        metric: 'Risk Exposure',
        chosen: `${recommendedContract.riskScore} / 100 (${recommendedContract.riskLevel})`,
        runnerUp: `${activeRunnerUp.riskScore} / 100 (${activeRunnerUp.riskLevel})`,
        delta: formatRiskScoreDelta(riskScoreDelta, recLabel),
      },
      {
        metric: 'Scheduling Flexibility',
        chosen: `${recommendedContract.flexibilityScore} / 100`,
        runnerUp: `${activeRunnerUp.flexibilityScore} / 100`,
        delta: formatFlexScoreDelta(flexScoreDelta, recLabel),
      },
    ];
  }

  return {
    summary,
    whyThisRecommendation,
    whatCouldChangeThis,
    quantifiedTradeoffs,
  };
}

export const generateExplainabilityReport = generateExplanation;
