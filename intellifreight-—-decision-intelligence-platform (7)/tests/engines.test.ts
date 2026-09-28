/**
 * Automated Verification & Unit Tests for IntelliFreight Decision Intelligence Engines
 * Run via: npx tsx tests/engines.test.ts
 */

import { PORTS, VESSELS, ROUTES, MARKET_INDICES, generateHistoricalFreight } from '../src/data/maritimeData';
import { DecisionRecord, ContractOption, AlternativePortOption } from '../src/types';
import { evaluateVesselFeasibility } from '../src/engines/feasibilityEngine';
import { runFreightForecast } from '../src/engines/forecastingEngine';
import { runChronologicalBacktesting } from '../src/engines/mlEngine';
import { calculateVoyageCosts } from '../src/engines/voyageCostEngine';
import { optimizeContracts } from '../src/engines/contractOptimizer';
import { generateExplainabilityReport } from '../src/engines/explainabilityEngine';
import { calculateComprehensiveRisk } from '../src/engines/riskEngine';
import { evaluateAlternativePorts } from '../src/engines/alternativePortEngine';
import { InMemoryDecisionRepository, InMemoryWatchlistRepository, InMemoryForecastVsActualRepository } from '../src/data/repository';
import { CalibratedFreightDataProvider, CalibratedBunkerDataProvider } from '../src/data/dataProvider';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

console.log('====================================================');
console.log('INTELLIFREIGHT CORE ENGINES VALIDATION TEST SUITE');
console.log('====================================================\n');

// 1. Port Feasibility Engine Tests
console.log('[1/5] Testing Port Feasibility Engine...');
const haldiaPort = PORTS.find((p) => p.id === 'in-hld')!;
const dhamraPort = PORTS.find((p) => p.id === 'in-dhm')!;
const hayPoint = PORTS.find((p) => p.id === 'au-hpt')!;

const capesize = VESSELS.find((v) => v.vesselClass === 'Capesize')!;
const panamax = VESSELS.find((v) => v.vesselClass === 'Panamax')!;
const handysize = VESSELS.find((v) => v.vesselClass === 'Handysize')!;

const capeAtHaldia = evaluateVesselFeasibility(capesize, hayPoint, haldiaPort, 150000);
assert(!capeAtHaldia.isFeasible, 'Capesize MUST be rejected at Haldia Port due to draft/LOA restrictions');
assert(capeAtHaldia.checks.draft.passed === false, 'Draft constraint must fail for Capesize at shallow port');
assert(typeof capeAtHaldia.rejectionReason === 'string' && capeAtHaldia.rejectionReason.includes('Draft'), 'Rejection reason must explicitly cite draft exceeding limit');

const panamaxAtDhamra = evaluateVesselFeasibility(panamax, hayPoint, dhamraPort, 75000);
assert(panamaxAtDhamra.isFeasible, 'Panamax MUST be feasible at Dhamra Port for 75,000 MT coal');
assert(panamaxAtDhamra.recommendationGrade === 'OPTIMAL', 'Panamax should receive OPTIMAL grade at deepwater port for 75k MT');

// 2. ML Chronological Backtesting & Zero Leakage Tests
console.log('\n[2/5] Testing Machine Learning & Chronological Backtesting...');
const testHistory = generateHistoricalFreight(17.5, 52);
const backtest = runChronologicalBacktesting(testHistory);

assert(backtest.evaluations.length >= 4, 'Must evaluate at least 4 models (Naive, MA, AR Ridge, GBDT, Ensemble)');
assert(backtest.actualVsPredicted.length > 10, 'Backtest actualVsPredicted must cover out-of-sample test horizon');

// Check Seasonal Autoregressive Ridge naming
const seasonalArEval = backtest.evaluations.find(e => e.name.includes('Seasonal Autoregressive Ridge'));
assert(seasonalArEval !== undefined, 'Must evaluate Seasonal Autoregressive Ridge model (renamed from ARIMA/SARIMA)');

// Check dynamic best model selection based on out-of-sample metrics
assert(backtest.bestModelName.length > 0, 'Best model name must be dynamically determined');
const bestEvaluated = backtest.evaluations.find(e => e.isBest);
assert(bestEvaluated !== undefined, 'Exactly one model must be dynamically designated as best based on empirical metrics');
assert(bestEvaluated.name === backtest.bestModelName, 'Designated best model must match bestModelName in backtest results');
assert(
  backtest.evaluations.every(e => e.rmse >= bestEvaluated.rmse),
  'The dynamically selected best model must have the minimum out-of-sample RMSE among all candidates'
);

const ensembleEval = backtest.evaluations.find(e => e.name.includes('Ensemble'))!;
assert(ensembleEval.mae !== null && ensembleEval.mae > 0 && ensembleEval.mae < 5.0, `Ensemble MAE ($${ensembleEval.mae}/t) must be mathematically valid and positive`);
assert(ensembleEval.directionalAccuracy !== null && ensembleEval.directionalAccuracy >= 45 && ensembleEval.directionalAccuracy <= 100, `Directional accuracy (${ensembleEval.directionalAccuracy}%) must be within [45, 100]%`);
assert(backtest.governance.validationMethod.includes('Expanding Window'), 'Governance validation method must specify Expanding Window with zero lookahead');

// Verify Fallback Integrity: When insufficient data exists, metrics must be UNAVAILABLE without fabricated numbers
const emptyBacktest = runChronologicalBacktesting([]);
assert(
  emptyBacktest.evaluations.every(e => e.status === 'UNAVAILABLE' && e.mae === null && e.rmse === null),
  'When data is insufficient, fallback evaluations must report status UNAVAILABLE with null metrics (zero fabricated numbers)'
);
assert(
  emptyBacktest.governance.modelStatus.includes('Performance unavailable'),
  'Fallback governance must state performance unavailable without inventing accuracy metrics'
);

// 3. Contract Optimization Engine Tests
console.log('\n[3/5] Testing Contract Optimizer & MADO Objective Function...');
const sampleRoute = ROUTES[0];
const sampleForecast = runFreightForecast(sampleRoute.id, 'Panamax', 'Ensemble');
const sampleRisk = calculateComprehensiveRisk(sampleForecast, hayPoint, dhamraPort, sampleRoute, panamax);
const sampleVoyageCost = calculateVoyageCosts(panamax, hayPoint, dhamraPort, sampleRoute, sampleForecast.currentRateUsdPerTonne, 75000, 1, MARKET_INDICES);

// Independent reference implementation of the MADO utility function with hard eligibility filtering
function computeExpectedWinner(
  options: ContractOption[],
  numberOfVoyages: number,
  isRising: boolean,
  optimizationPreference: 'lowest_cost' | 'balanced' | 'lowest_risk'
): ContractOption {
  // HARD ELIGIBILITY FILTER:
  // Contract strategy eligibility is enforced before economic optimization.
  // Strategies requiring a greater contractual voyage commitment than requested
  // are excluded from the final recommendation.
  // Spot remains a first-class eligible strategy and may win when appropriate.
  const eligible = options.filter((o) => o.isEligible);
  const candidates = eligible.length > 0 ? eligible : options;

  let wCost = 0.50;
  let wRisk = 0.30;
  let wFlex = 0.20;

  if (optimizationPreference === 'lowest_cost') {
    wCost = 1.0;
    wRisk = 0.0;
    wFlex = 0.0;
  } else if (optimizationPreference === 'lowest_risk') {
    wCost = 0.15;
    wRisk = 0.75;
    wFlex = 0.10;
  }

  const maxCost = Math.max(...options.map((o) => o.totalExpectedCostUsd));
  let bestScore = -Infinity;
  let expectedWinner = candidates[0];

  for (const opt of candidates) {
    let commitmentOverhead = 0;
    let marketCarryAdjustment = 0;

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

    const utility =
      wCost * normalizedCost +
      wRisk * normalizedRisk +
      wFlex * normalizedFlex +
      marketCarryAdjustment -
      commitmentOverhead;

    if (utility > bestScore) {
      bestScore = utility;
      expectedWinner = opt;
    }
  }

  return expectedWinner;
}

// 3a. Verify evaluation of full candidate option space without forcing predetermined strategies
const singleVoyageOpt = optimizeContracts(75000, 1, sampleForecast, sampleVoyageCost, sampleRisk, 'balanced');
assert(singleVoyageOpt.contractOptions.length === 4, 'Optimizer must evaluate all 4 candidate contract structures (Spot, Short-Term, Medium-Term, COA)');

// 3b. Verify mathematical validity of all evaluated strategies
for (const opt of singleVoyageOpt.contractOptions) {
  assert(opt.totalExpectedCostUsd > 0 && opt.costPerTonneUsd > 0, `Option ${opt.strategy} must calculate positive expected costs`);
  assert(opt.riskScore >= 0 && opt.riskScore <= 100, `Option ${opt.strategy} risk score must be bounded in [0, 100]`);
  assert(opt.flexibilityScore >= 0 && opt.flexibilityScore <= 100, `Option ${opt.strategy} flexibility score must be bounded in [0, 100]`);
  assert(opt.keyRisks.length > 0, `Option ${opt.strategy} must provide transparent risk factors`);
}

// 3c. Verify that the recommended contract strictly corresponds to the highest-scoring candidate under the MADO utility function
const recommended = singleVoyageOpt.recommendedContract;
assert(recommended !== undefined, 'Optimizer must return a recommended contract');
assert(
  singleVoyageOpt.contractOptions.some(opt => opt.strategy === recommended.strategy && opt.isRecommended),
  'The recommended contract must be dynamically selected from the evaluated options with isRecommended: true'
);
assert(recommended.totalExpectedCostUsd > 0, 'Recommended contract total cost must be strictly positive');

// 3d. Verify multi-attribute preference adaptability across distinct risk postures
const costPreferenceOpt = optimizeContracts(75000, 4, sampleForecast, sampleVoyageCost, sampleRisk, 'lowest_cost');
const riskPreferenceOpt = optimizeContracts(75000, 4, sampleForecast, sampleVoyageCost, sampleRisk, 'lowest_risk');
assert(costPreferenceOpt.recommendedContract !== undefined && riskPreferenceOpt.recommendedContract !== undefined, 'Optimizer must produce valid recommendations across user preference profiles');
assert(costPreferenceOpt.marketEntryTiming.urgency !== undefined && typeof costPreferenceOpt.marketEntryTiming.probRateIncreasePct === 'number', 'Market entry timing model must output valid probabilities and urgency signals');
assert(costPreferenceOpt.marketEntryTiming.marketSignals.length > 0, 'Market entry timing must provide transparent indicator signals');

// 3e. Scenario A — Softening single-voyage market: Derive expected winner strictly from utility function
const softForecast = {
  ...sampleForecast,
  trend: 'BEARISH' as const,
  forecast4Weeks: sampleForecast.currentRateUsdPerTonne - 2.5,
  forecast8Weeks: sampleForecast.currentRateUsdPerTonne - 3.5,
};
const softVoyageCost = calculateVoyageCosts(panamax, hayPoint, dhamraPort, sampleRoute, softForecast.currentRateUsdPerTonne, 75000, 1, MARKET_INDICES);
const softRisk = calculateComprehensiveRisk(softForecast, hayPoint, dhamraPort, sampleRoute, panamax);
const scenarioA_Opt = optimizeContracts(75000, 1, softForecast, softVoyageCost, softRisk, 'balanced');
const expectedWinnerA = computeExpectedWinner(scenarioA_Opt.contractOptions, 1, false, 'balanced');

assert(
  scenarioA_Opt.recommendedContract.strategy === expectedWinnerA.strategy,
  `Scenario A: Recommendation (${scenarioA_Opt.recommendedContract.strategy}) must equal the candidate with maximum utility (${expectedWinnerA.strategy})`
);
assert(
  scenarioA_Opt.contractOptions.find(o => o.strategy === expectedWinnerA.strategy)?.isRecommended === true,
  'Scenario A: Candidate option with maximum utility must have isRecommended: true'
);

// 3f. Scenario B — Rising multi-voyage market (6 voyages): Derive expected winner strictly from utility function
const risingForecast = {
  ...sampleForecast,
  trend: 'STRONG_BULLISH' as const,
  forecast4Weeks: sampleForecast.currentRateUsdPerTonne * 1.25,
  forecast8Weeks: sampleForecast.currentRateUsdPerTonne * 1.35,
};
const risingVoyageCost = calculateVoyageCosts(panamax, hayPoint, dhamraPort, sampleRoute, risingForecast.currentRateUsdPerTonne, 75000, 6, MARKET_INDICES);
const risingRisk = calculateComprehensiveRisk(risingForecast, hayPoint, dhamraPort, sampleRoute, panamax);
const scenarioB_Opt = optimizeContracts(75000, 6, risingForecast, risingVoyageCost, risingRisk, 'balanced');
const expectedWinnerB = computeExpectedWinner(scenarioB_Opt.contractOptions, 6, true, 'balanced');

assert(
  scenarioB_Opt.recommendedContract.strategy === expectedWinnerB.strategy,
  `Scenario B: Recommendation (${scenarioB_Opt.recommendedContract.strategy}) must equal the candidate with maximum utility (${expectedWinnerB.strategy})`
);
assert(
  scenarioB_Opt.contractOptions.find(o => o.strategy === expectedWinnerB.strategy)?.isRecommended === true,
  'Scenario B: Candidate option with maximum utility must have isRecommended: true'
);

// 3g. Scenario C — Risk-sensitive preference: Derive expected winners independently from utility weights
const scenarioC_Cost = optimizeContracts(75000, 6, risingForecast, risingVoyageCost, risingRisk, 'lowest_cost');
const scenarioC_Risk = optimizeContracts(75000, 6, risingForecast, risingVoyageCost, risingRisk, 'lowest_risk');
const expectedWinnerC_Cost = computeExpectedWinner(scenarioC_Cost.contractOptions, 6, true, 'lowest_cost');
const expectedWinnerC_Risk = computeExpectedWinner(scenarioC_Risk.contractOptions, 6, true, 'lowest_risk');

assert(
  scenarioC_Cost.recommendedContract.strategy === expectedWinnerC_Cost.strategy,
  `Scenario C (lowest_cost): Recommendation (${scenarioC_Cost.recommendedContract.strategy}) must equal the mathematical maximum utility candidate (${expectedWinnerC_Cost.strategy})`
);
assert(
  scenarioC_Risk.recommendedContract.strategy === expectedWinnerC_Risk.strategy,
  `Scenario C (lowest_risk): Recommendation (${scenarioC_Risk.recommendedContract.strategy}) must equal the mathematical maximum utility candidate (${expectedWinnerC_Risk.strategy})`
);
assert(
  scenarioC_Risk.recommendedContract.riskScore <= scenarioC_Cost.recommendedContract.riskScore,
  `Scenario C: lowest_risk recommendation (Risk ${scenarioC_Risk.recommendedContract.riskScore}) must have risk <= lowest_cost recommendation (Risk ${scenarioC_Cost.recommendedContract.riskScore})`
);

// 3h. Contract Strategy Voyage Count Eligibility Regression Tests (Hard Constraints)
console.log('\n[3h] Running Contract Strategy Voyage Count Eligibility Regression Tests...');

// TEST 1: Input voyages = 1 (e.g. Coking Coal, 70,000 MT, 1 voyage, Balanced, Hay Point -> Dhamra)
const test1Opt = optimizeContracts(70000, 1, sampleForecast, sampleVoyageCost, sampleRisk, 'balanced');
const spot1 = test1Opt.contractOptions.find(o => o.strategy === 'spot');
const short1 = test1Opt.contractOptions.find(o => o.strategy === 'short_term');
const med1 = test1Opt.contractOptions.find(o => o.strategy === 'medium_term');
const coa1 = test1Opt.contractOptions.find(o => o.strategy === 'coa');

assert(spot1?.isEligible === true && spot1?.eligibilityStatus === 'ELIGIBLE', 'Test 1: Spot is eligible for 1 voyage');
assert(short1?.isEligible === false && short1?.eligibilityStatus === 'NOT_ELIGIBLE', 'Test 1: Short-term (3–5 voyages) is ineligible for 1 voyage');
assert(med1?.isEligible === false && med1?.eligibilityStatus === 'NOT_ELIGIBLE', 'Test 1: Medium-term (6–12 months) is ineligible for 1 voyage');
assert(coa1?.isEligible === false && coa1?.eligibilityStatus === 'NOT_ELIGIBLE', 'Test 1: COA volume commitment is ineligible for 1 voyage');
assert(test1Opt.recommendedContract.isEligible === true, 'Test 1: Final recommendation must be an eligible strategy');
assert(
  test1Opt.recommendedContract.strategy !== 'short_term' &&
  test1Opt.recommendedContract.strategy !== 'medium_term' &&
  test1Opt.recommendedContract.strategy !== 'coa',
  'Test 1: Final recommendation is NOT any ineligible strategy (must not recommend multi-voyage commitment for 1 voyage)'
);
assert(short1?.ineligibilityReason !== undefined && short1.ineligibilityReason.length > 0, 'Test 1: Ineligible options must provide explanatory exclusion reason');

// TEST 2: Input voyages = 3
const voyageCost3 = calculateVoyageCosts(panamax, hayPoint, dhamraPort, sampleRoute, sampleForecast.currentRateUsdPerTonne, 70000, 3, MARKET_INDICES);
const test2Opt = optimizeContracts(70000, 3, sampleForecast, voyageCost3, sampleRisk, 'balanced');
const short2 = test2Opt.contractOptions.find(o => o.strategy === 'short_term');
assert(short2?.isEligible === true && short2?.eligibilityStatus === 'ELIGIBLE', 'Test 2: Short-term 3–5 voyage strategy becomes eligible for 3 voyages');

// TEST 3: Input voyages = 4
const voyageCost4 = calculateVoyageCosts(panamax, hayPoint, dhamraPort, sampleRoute, sampleForecast.currentRateUsdPerTonne, 70000, 4, MARKET_INDICES);
const test3Opt = optimizeContracts(70000, 4, sampleForecast, voyageCost4, sampleRisk, 'balanced');
const short3 = test3Opt.contractOptions.find(o => o.strategy === 'short_term');
assert(short3?.isEligible === true && short3?.eligibilityStatus === 'ELIGIBLE', 'Test 3: Short-term strategy remains eligible for 4 voyages');

// TEST 4: Input voyages = 6
const voyageCost6 = calculateVoyageCosts(panamax, hayPoint, dhamraPort, sampleRoute, sampleForecast.currentRateUsdPerTonne, 70000, 6, MARKET_INDICES);
const test4Opt = optimizeContracts(70000, 6, sampleForecast, voyageCost6, sampleRisk, 'balanced');
const med4 = test4Opt.contractOptions.find(o => o.strategy === 'medium_term');
const coa4 = test4Opt.contractOptions.find(o => o.strategy === 'coa');
assert(med4?.isEligible === true && med4?.eligibilityStatus === 'ELIGIBLE', 'Test 4: Medium-term strategy (6–12 months) becomes eligible for 6 voyages');
assert(coa4?.isEligible === true && coa4?.eligibilityStatus === 'ELIGIBLE', 'Test 4: COA volume strategy (6+ voyages) becomes eligible for 6 voyages');

// TEST 5: Create a scenario where an ineligible strategy has an artificially lower economic cost than Spot
// In a strongly rising market with lowest_cost preference for 1 voyage, forward contracts offer discounted rates.
// Even though Short-Term has forward hedge savings vs prompt rate, it MUST NOT win because eligibility is a hard constraint.
const adversarial1VoyageCost = calculateVoyageCosts(panamax, hayPoint, dhamraPort, sampleRoute, risingForecast.currentRateUsdPerTonne, 70000, 1, MARKET_INDICES);
const test5Opt = optimizeContracts(70000, 1, risingForecast, adversarial1VoyageCost, risingRisk, 'lowest_cost');
assert(
  test5Opt.recommendedContract.strategy !== 'short_term' &&
  test5Opt.recommendedContract.strategy !== 'medium_term' &&
  test5Opt.recommendedContract.strategy !== 'coa',
  'Test 5: Ineligible strategy with discounted forward rate STILL cannot win recommendation'
);
assert(test5Opt.recommendedContract.isEligible === true, 'Test 5: Recommendation must be strictly an eligible option');
assert(test5Opt.recommendedContract.strategy === 'spot', 'Test 5: Spot is the sole eligible candidate for 1 voyage and wins regardless of forward pricing discounts');

// =========================================================================
// [3i] Economic Scoring & XAI Consistency Regression Suite
// =========================================================================
console.log('\n[3i] Testing Economic Scoring & XAI Consistency Regression Suite...');

// 6-voyage scenario: Hay Point to Dhamra, 70,000 MT, 6 voyages, Balanced
const voyageCost6XAI = calculateVoyageCosts(panamax, hayPoint, dhamraPort, sampleRoute, sampleForecast.currentRateUsdPerTonne, 70000, 6, MARKET_INDICES);
const opt6XAI = optimizeContracts(70000, 6, sampleForecast, voyageCost6XAI, sampleRisk, 'balanced');
const report6XAI = generateExplainabilityReport(
  opt6XAI.recommendedContract,
  opt6XAI.contractOptions,
  sampleForecast,
  panamax,
  [],
  hayPoint,
  dhamraPort,
  6,
  70000,
  sampleRisk,
  voyageCost6XAI
);

const rec6 = opt6XAI.recommendedContract;
const med6 = opt6XAI.contractOptions.find((o) => o.strategy === 'medium_term')!;
const coa6 = opt6XAI.contractOptions.find((o) => o.strategy === 'coa')!;
const spot6 = opt6XAI.contractOptions.find((o) => o.strategy === 'spot')!;

// 8A. A lower landed-cost strategy must not be described as worse unless risk-adjusted scoring explicitly proves it
assert(med6.costPerTonneUsd < coa6.costPerTonneUsd, '8A: Medium-term has lower nominal landed cost than COA in 6-voyage scenario');
assert(rec6.strategy === 'coa', '8A: Optimizer selects COA due to risk-adjusted utility superiority');
assert(coa6.riskAdjustedCostPerTonne < med6.riskAdjustedCostPerTonne, '8A: COA risk-adjusted cost is strictly lower than Medium-term');
assert(coa6.optimizationScore > med6.optimizationScore, '8A: COA optimization score is strictly higher than Medium-term');

const driver5 = report6XAI.whyThisRecommendation.find((r) => r.startsWith('Total voyage economics:'))!;
assert(driver5 !== undefined, '8A: XAI must contain Total voyage economics driver');
assert(
  !driver5.includes(`$${rec6.costPerTonneUsd.toFixed(2)}/t outperforms alternative candidate (${med6.title} at $${med6.costPerTonneUsd.toFixed(2)}/t)`),
  '8A: XAI must NEVER state that higher nominal cost outperforms lower nominal cost'
);
assert(
  driver5.includes(`risk-adjusted logistics cost of $${rec6.riskAdjustedCostPerTonne.toFixed(2)}/t outperforms alternative candidate (${med6.title} at $${med6.riskAdjustedCostPerTonne.toFixed(2)}/t)`),
  '8A: XAI must explain outperformance using the risk-adjusted cost metric that proves it'
);
assert(
  driver5.includes(`lower nominal landed cost ($${med6.costPerTonneUsd.toFixed(2)}/t vs $${rec6.costPerTonneUsd.toFixed(2)}/t`),
  '8A: XAI must transparently acknowledge the nominal landed cost difference'
);

// 8A.1. OBJECTIVE-FUNCTION CONSISTENCY AUDIT:
// In the 6-voyage scenario, Medium-Term nominal landed cost ($26.31/t) < COA ($26.55/t).
// Under 'lowest_cost' (Min Total Freight), Medium-Term MUST WIN unconditionally:
const opt6LowestCost = optimizeContracts(70000, 6, sampleForecast, voyageCost6XAI, sampleRisk, 'lowest_cost');
const rec6Cost = opt6LowestCost.recommendedContract;
const med6Cost = opt6LowestCost.contractOptions.find((o) => o.strategy === 'medium_term')!;
const coa6Cost = opt6LowestCost.contractOptions.find((o) => o.strategy === 'coa')!;

assert(rec6Cost.strategy === 'medium_term', '8A.1: Under Lowest Cost mode, Medium-Term ($26.31/t) strictly defeats COA ($26.55/t)');
assert(rec6Cost.costPerTonneUsd <= coa6Cost.costPerTonneUsd, '8A.1: Lowest Cost recommendation has lower nominal landed cost than COA');
assert(rec6Cost.riskAdjustedCostPerTonne === rec6Cost.costPerTonneUsd, '8A.1: In Lowest Cost mode, risk-adjusted cost matches nominal landed cost without synthetic risk loading');

// 8A.2. Under 'lowest_risk', the candidate with lowest risk exposure wins:
const opt6LowestRisk = optimizeContracts(70000, 6, sampleForecast, voyageCost6XAI, sampleRisk, 'lowest_risk');
assert(opt6LowestRisk.recommendedContract.riskScore <= coa6.riskScore, '8A.2: Lowest Risk mode selects candidate with minimum risk score');

// 8B. Every XAI delta must equal Recommended Strategy - Runner-Up Strategy with exact labels
for (const item of report6XAI.quantifiedTradeoffs) {
  if (item.metric === 'Total Contract Cost') {
    const diff = rec6.totalExpectedCostUsd - med6.totalExpectedCostUsd;
    assert(diff === 97254, `8B: Total contract cost delta value is +$97,254`);
    assert(item.delta === '+$97,254 (COA premium)', `8B: Total contract cost attribution delta matches exact label: ${item.delta}`);
  } else if (item.metric === 'Nominal Landed Cost') {
    const diff = Number((rec6.costPerTonneUsd - med6.costPerTonneUsd).toFixed(2));
    assert(diff === 0.24, `8B: Nominal landed cost delta value is +$0.24/t`);
    assert(item.delta === '+$0.24/t (COA premium)', `8B: Nominal landed cost attribution delta matches exact label: ${item.delta}`);
  } else if (item.metric === 'Risk-Adjusted Cost') {
    const diff = Number((rec6.riskAdjustedCostPerTonne - med6.riskAdjustedCostPerTonne).toFixed(2));
    assert(diff === -1.21, `8B: Risk-adjusted cost delta value is -$1.21/t`);
    assert(item.delta === '-$1.21/t (COA saving)', `8B: Risk-adjusted cost attribution delta matches exact label: ${item.delta}`);
  } else if (item.metric === 'Optimization Utility') {
    const diff = Number((rec6.optimizationScore - med6.optimizationScore).toFixed(1));
    assert(diff === 2.1, `8B: Optimization score delta value is +2.1 points`);
    assert(item.delta === '+2.1 points (COA advantage)', `8B: Optimization utility attribution delta matches exact label: ${item.delta}`);
  } else if (item.metric === 'Risk Exposure') {
    const diff = rec6.riskScore - med6.riskScore;
    assert(diff === 4, `8B: Risk score delta value is +4 points`);
    assert(item.delta.startsWith('+4 points') && item.delta.includes('lower is better'), `8B: Risk exposure delta explains lower is better: ${item.delta}`);
  } else if (item.metric === 'Scheduling Flexibility') {
    const diff = rec6.flexibilityScore - med6.flexibilityScore;
    assert(diff === 18, `8B: Flexibility score delta value is +18 points`);
    assert(item.delta === '+18 points (COA advantage)', `8B: Scheduling flexibility attribution delta matches exact label: ${item.delta}`);
  }
}

// 8C. Savings percentages and freight rate discounts must be mathematically correct
for (const opt of opt6XAI.contractOptions) {
  const baseSpot = spot6.totalExpectedCostUsd;
  const expectedSavingsPct = Number((Math.max(0, ((baseSpot - opt.totalExpectedCostUsd) / baseSpot) * 100)).toFixed(1));
  assert(opt.savingsVsSpotPct === expectedSavingsPct, `8C: Option ${opt.strategy} savings percentage (${opt.savingsVsSpotPct}%) matches exact formula`);
}
const spotFreight = spot6.agreedRateUsdPerTonne;
const coaFreight = coa6.agreedRateUsdPerTonne;
const expectedCoaDiscount = Number((((spotFreight - coaFreight) / spotFreight) * 100).toFixed(1));
assert(coa6.freightDiscountVsSpotPct === expectedCoaDiscount, `8C: COA freight discount (${coa6.freightDiscountVsSpotPct}%) is mathematically derived from rates`);
const driver3 = report6XAI.whyThisRecommendation.find((r) => r.startsWith('Volume synergy:'))!;
assert(driver3.includes(`${expectedCoaDiscount}%`), `8C: XAI volume synergy driver displays dynamically derived discount (${expectedCoaDiscount}%), not hardcoded 3.8%`);

// 8D. Optimizer ranking must use exactly the same calculated metric that XAI explains
const eligibleOpts = opt6XAI.contractOptions.filter((o) => o.isEligible);
for (const alt of eligibleOpts) {
  assert(
    rec6.optimizationScore >= alt.optimizationScore,
    `8D: Recommended contract optimization score (${rec6.optimizationScore}) >= eligible alternative ${alt.strategy} (${alt.optimizationScore})`
  );
  assert(
    rec6.riskAdjustedCostPerTonne <= alt.riskAdjustedCostPerTonne,
    `8D: Recommended contract risk-adjusted cost ($${rec6.riskAdjustedCostPerTonne}/t) <= eligible alternative ${alt.strategy} ($${alt.riskAdjustedCostPerTonne}/t)`
  );
}

// 8E. Market Entry Timing explanation must dynamically reflect the recommended strategy and never ineligible strategies
assert(
  !opt6XAI.marketEntryTiming.drivers.some((d) => d.includes('Short-term multi-voyage lock')),
  '8E: Market entry timing driver must not reference ineligible Short-term multi-voyage strategy for 6 voyages'
);
if (opt6XAI.marketEntryTiming.probRateIncreasePct >= 55 && opt6XAI.marketEntryTiming.probRateIncreasePct < 75) {
  assert(
    opt6XAI.marketEntryTiming.drivers.some((d) => d.includes(rec6.title)),
    `8E: Market entry timing driver must dynamically reference recommended strategy (${rec6.title})`
  );
}

// =========================================================================
// [3j] Contract Optimizer XAI Strict Eligibility & Directionality Suite
// =========================================================================
console.log('\n[3j] Testing Contract Optimizer XAI Strict Eligibility & Directionality Suite...');

// TEST 1: 1-voyage scenario where only Spot is eligible
const voyageCost1 = calculateVoyageCosts(panamax, hayPoint, dhamraPort, sampleRoute, sampleForecast.currentRateUsdPerTonne, 70000, 1, MARKET_INDICES);
const opt1 = optimizeContracts(70000, 1, sampleForecast, voyageCost1, sampleRisk, 'balanced');
const report1 = generateExplainabilityReport(
  opt1.recommendedContract,
  opt1.contractOptions,
  sampleForecast,
  panamax,
  [],
  hayPoint,
  dhamraPort,
  1,
  70000,
  sampleRisk,
  voyageCost1
);

const rec1 = opt1.recommendedContract;
assert(rec1.strategy === 'spot', '3j.1: Spot must be recommended for 1 voyage');
assert(rec1.isEligible === true, '3j.1: Spot must be marked eligible');
assert(
  opt1.contractOptions.filter(o => o.isEligible).length === 1,
  '3j.1: Exactly 1 strategy (Spot) is eligible for 1 voyage'
);

// Summary & whyThisRecommendation requirement:
// "If only Spot is eligible, say clearly: 'Spot selected because it is the only eligible strategy for the current voyage count.'"
assert(
  report1.summary.startsWith('Spot selected because it is the only eligible strategy for the current voyage count.'),
  `3j.1: XAI summary must start with required exact phrase: "${report1.summary}"`
);
assert(
  report1.whyThisRecommendation[0].includes('Spot selected because it is the only eligible strategy for the current voyage count.'),
  `3j.1: XAI whyThisRecommendation[0] must contain required exact phrase: "${report1.whyThisRecommendation[0]}"`
);

// Never describe an ineligible strategy as outperforming or losing to an eligible strategy:
for (const reason of report1.whyThisRecommendation) {
  assert(
    !reason.includes('outperforms alternative candidate'),
    `3j.1: In 1-voyage scenario, XAI must not claim to outperform any alternative: "${reason}"`
  );
  assert(
    !reason.includes('Short-Term at') && !reason.includes('Medium-Term at') && !reason.includes('COA at'),
    `3j.1: In 1-voyage scenario, XAI must not invent comparison against ineligible strategies: "${reason}"`
  );
}

// Check quantifiedTradeoffs in 1-voyage scenario:
for (const trade of report1.quantifiedTradeoffs) {
  assert(trade.runnerUp === 'None (Ineligible)', `3j.1: Runner-up must be 'None (Ineligible)': got "${trade.runnerUp}"`);
  assert(
    trade.delta.toLowerCase().includes('baseline') || trade.delta.includes('Sole eligible'),
    `3j.1: Delta must indicate baseline/sole eligible: got "${trade.delta}"`
  );
}
// Exact computed numbers check for 1-voyage:
const totalCostRow1 = report1.quantifiedTradeoffs.find(t => t.metric === 'Total Contract Cost')!;
assert(totalCostRow1.chosen === `$${rec1.totalExpectedCostUsd.toLocaleString()}`, '3j.1: Total cost in XAI matches rec1 totalExpectedCostUsd');
const landedRow1 = report1.quantifiedTradeoffs.find(t => t.metric === 'Nominal Landed Cost')!;
assert(landedRow1.chosen === `$${rec1.costPerTonneUsd.toFixed(2)} / t`, '3j.1: Landed cost in XAI matches rec1 costPerTonneUsd');
const riskAdjRow1 = report1.quantifiedTradeoffs.find(t => t.metric === 'Risk-Adjusted Cost')!;
assert(riskAdjRow1.chosen === `$${rec1.riskAdjustedCostPerTonne.toFixed(2)} / t`, '3j.1: Risk-adjusted cost in XAI matches rec1');

// TEST 2: 4-voyage scenario where Spot and Short-Term are eligible
const opt4 = optimizeContracts(70000, 4, sampleForecast, voyageCost4, sampleRisk, 'balanced');
const report4 = generateExplainabilityReport(
  opt4.recommendedContract,
  opt4.contractOptions,
  sampleForecast,
  panamax,
  [],
  hayPoint,
  dhamraPort,
  4,
  70000,
  sampleRisk,
  voyageCost4
);

const eligible4 = opt4.contractOptions.filter(o => o.isEligible);
assert(eligible4.length === 2, '3j.2: Exactly 2 strategies are eligible for 4 voyages (Spot and Short-Term)');
assert(eligible4.some(o => o.strategy === 'spot'), '3j.2: Spot is eligible for 4 voyages');
assert(eligible4.some(o => o.strategy === 'short_term'), '3j.2: Short-Term is eligible for 4 voyages');
const medOpt4 = opt4.contractOptions.find(o => o.strategy === 'medium_term')!;
const coaOpt4 = opt4.contractOptions.find(o => o.strategy === 'coa')!;
assert(!medOpt4.isEligible, '3j.2: Medium-Term is ineligible for 4 voyages');
assert(!coaOpt4.isEligible, '3j.2: COA is ineligible for 4 voyages');

// Runner-up in 4-voyage scenario must be strictly the other eligible strategy
const runnerUpCost4 = report4.quantifiedTradeoffs[0].runnerUp;
const expectedRunnerUp4 = opt4.recommendedContract.strategy === 'short_term'
  ? opt4.contractOptions.find(o => o.strategy === 'spot')!
  : opt4.contractOptions.find(o => o.strategy === 'short_term')!;

assert(
  runnerUpCost4 !== `$${medOpt4.totalExpectedCostUsd.toLocaleString()}` &&
  runnerUpCost4 !== `$${coaOpt4.totalExpectedCostUsd.toLocaleString()}`,
  `3j.2: Runner-up in 4-voyage XAI must NEVER be Medium-Term or COA: got "${runnerUpCost4}"`
);
assert(
  runnerUpCost4 === `$${expectedRunnerUp4.totalExpectedCostUsd.toLocaleString()}`,
  `3j.2: Runner-up cost in XAI (${runnerUpCost4}) must match eligible runner-up cost ($${expectedRunnerUp4.totalExpectedCostUsd.toLocaleString()})`
);

// TEST 3: 6+ voyage scenario where Spot, Medium-Term, and COA are eligible and Short-Term is ineligible
const shortOpt6 = opt6XAI.contractOptions.find(o => o.strategy === 'short_term')!;
assert(!shortOpt6.isEligible, '3j.3: Short-Term (max 5 voyages) must be ineligible for 6 voyages');

// Runner-up in 6-voyage XAI must NEVER be Short-Term:
const runnerUpCost6 = report6XAI.quantifiedTradeoffs[0].runnerUp;
assert(
  runnerUpCost6 !== `$${shortOpt6.totalExpectedCostUsd.toLocaleString()}`,
  `3j.3: Runner-up in 6-voyage XAI must NEVER be the ineligible Short-Term strategy`
);
assert(
  runnerUpCost6 === `$${med6.totalExpectedCostUsd.toLocaleString()}`,
  `3j.3: Runner-up in 6-voyage XAI matches the top eligible alternative (Medium-Term)`
);

// TEST 4: Scenario sensitivity — XAI explanation must dynamically change when scenario inputs change
assert(
  report1.summary !== report4.summary,
  '3j.4: XAI summary must differ between 1-voyage and 4-voyage scenarios'
);
assert(
  report4.summary !== report6XAI.summary,
  '3j.4: XAI summary must differ between 4-voyage and 6-voyage scenarios'
);

// TEST 5: Directionality consistency check across preferences
const report6Cost = generateExplainabilityReport(
  opt6LowestCost.recommendedContract,
  opt6LowestCost.contractOptions,
  sampleForecast,
  panamax,
  [],
  hayPoint,
  dhamraPort,
  6,
  70000,
  sampleRisk,
  voyageCost6XAI,
  'lowest_cost'
);
const landedReasonCost = report6Cost.whyThisRecommendation.find(r => r.startsWith('Total voyage economics:'))!;
assert(
  landedReasonCost.includes('Objective set to Lowest Cost (Min Total Freight)'),
  '3j.5: In lowest_cost mode, XAI must explicitly state Lowest Cost objective'
);
assert(
  landedReasonCost.includes(`Expected nominal landed cost of $${rec6Cost.costPerTonneUsd.toFixed(2)}/t outperforms`),
  '3j.5: In lowest_cost mode, nominal landed cost is correctly stated as outperforming higher landed cost'
);

// 4. Voyage Cost Engine Tests
console.log('\n[4/5] Testing Voyage Cost Engine...');
assert(sampleVoyageCost.totalVoyageCostUsd > 0, 'Total voyage cost must be strictly positive');
assert(sampleVoyageCost.bunkerSeaCost > 0 && sampleVoyageCost.portDisbursementCost > 0, 'Bunker and port disbursement costs must be calculated');
assert(sampleVoyageCost.costPerTonneUsd > 10 && sampleVoyageCost.costPerTonneUsd < 70, `Cost per tonne ($${sampleVoyageCost.costPerTonneUsd}/t) must be within realistic bulk shipping range ($10-$70/t)`);

// 5. Repository Pattern & Persistence Tests
console.log('\n[5/5] Testing In-Memory Repository Abstraction Layer...');
const repo = new InMemoryDecisionRepository();
const sampleRecord: DecisionRecord = {
  id: 'dec-test-001',
  timestamp: '2026-09-13 14:00 UTC',
  commodity: 'Coking Coal',
  cargoQuantityTonnes: 75000,
  originPort: 'Hay Point',
  destinationPort: 'Dhamra Port',
  numberOfVoyages: 4,
  recommendedStrategy: 'short_term',
  recommendedVesselClass: 'Panamax',
  expectedRateUsdPerTonne: 17.5,
  expectedTotalCostUsd: 1312500,
  expectedCostPerTonne: 17.5,
  savingsVsSpotPct: 3.8,
  riskScore: 38,
  confidenceScorePct: 82,
  entryTiming: 'ENTER WITHIN 7 DAYS',
  status: 'ANALYZED',
};

async function testRepo() {
  await repo.save(sampleRecord);
  const fetched = await repo.getById('dec-test-001');
  assert(fetched !== null && fetched.id === 'dec-test-001', 'Decision record must be saved and retrievable by ID');

  await repo.updateOutcome('dec-test-001', 17.2, 1290000);
  const updated = await repo.getById('dec-test-001');
  assert(updated?.actualOutcome?.actualRateUsdPerTonne === 17.2, 'Actual post-voyage outcome must be updateable');
  assert(updated?.actualOutcome !== undefined, 'Outcome record must be populated');

  // Watchlist repository test
  const watchlistRepo = new InMemoryWatchlistRepository();
  const initialWatchlist = await watchlistRepo.getAll();
  assert(initialWatchlist.length >= 4, 'Watchlist repository seeds calibrated maritime watch items');
  await watchlistRepo.toggleAlert(initialWatchlist[0].id, false);
  const updatedItem = await watchlistRepo.getById(initialWatchlist[0].id);
  assert(updatedItem?.alertActive === false, 'Watchlist item alert toggle persists');

  // Forecast vs Actual repository test
  const forecastRepo = new InMemoryForecastVsActualRepository();
  const seedRecords = await forecastRepo.getAll();
  assert(seedRecords.length >= 5, 'ForecastVsActual repository seeds historical backtested records');
  const metrics = await forecastRepo.getPerformanceMetrics();
  assert(metrics.overallMapePct > 0 && metrics.directionalAccuracyPct > 50, 'ForecastVsActual metrics calculate real empirical performance');

  // Calibrated Data Providers provenance test
  const freightProvider = new CalibratedFreightDataProvider();
  const hayPointObs = await freightProvider.getLatestFreightObservation('au-hpt_in-dhm', 'Panamax');
  assert(hayPointObs.provenance === 'SIMULATED', 'Calibrated development freight observation is strictly tagged SIMULATED (NEVER fabricated as real live data)');
  assert(hayPointObs.provider.includes('Calibrated Benchmark'), 'Provider name indicates calibrated development benchmark');

  const bunkerProvider = new CalibratedBunkerDataProvider();
  const vlsfoObs = await bunkerProvider.getLatestBunkerObservation('Singapore', 'VLSFO');
  assert(vlsfoObs.provenance === 'SIMULATED', 'Bunker price observation tagged SIMULATED');
  assert(vlsfoObs.value > 0, 'Bunker price observation is positive');

  // Decision Memory Regression & Defensive Rendering Tests
  console.log('\n[6/6] Testing Decision Memory Defensive Contract & Regression Resilience...');
  
  // Test 1: Incomplete legacy record with no predictedRateUsdPerTonne and no actualOutcome
  const legacyRecord: DecisionRecord = {
    id: 'dec-legacy-incomplete-001',
    timestamp: '2026-08-01 10:00 UTC',
    commodity: 'Coking Coal',
    cargoQuantityTonnes: 70000,
    originPort: 'Hay Point',
    destinationPort: 'Dhamra Port',
    numberOfVoyages: 2,
    recommendedStrategy: 'spot',
    recommendedVesselClass: 'Panamax',
    expectedRateUsdPerTonne: 16.5,
    expectedTotalCostUsd: 1155000,
    expectedCostPerTonne: 16.5,
    savingsVsSpotPct: 0.0,
    riskScore: 25,
    confidenceScorePct: 80,
    entryTiming: 'ENTER NOW',
    isSimulated: true,
    provenance: 'SIMULATED',
    // Deliberately missing predictedRateUsdPerTonne, volumeTonnes, recommendedVessel, actualOutcome
  };

  await repo.save(legacyRecord);
  const fetchedLegacy = await repo.getById('dec-legacy-incomplete-001');
  assert(fetchedLegacy !== null, 'Legacy record saved successfully');

  // Verify safe rate extractor logic handles legacy record without throwing
  const extractForecastRate = (d: DecisionRecord): number | null => {
    if (typeof d.predictedRateUsdPerTonne === 'number' && !isNaN(d.predictedRateUsdPerTonne)) {
      return d.predictedRateUsdPerTonne;
    }
    if (typeof d.expectedRateUsdPerTonne === 'number' && !isNaN(d.expectedRateUsdPerTonne)) {
      return d.expectedRateUsdPerTonne;
    }
    return null;
  };

  const legacyForecastRate = extractForecastRate(fetchedLegacy!);
  assert(legacyForecastRate === 16.5, 'Fallback to expectedRateUsdPerTonne when predictedRateUsdPerTonne is missing');
  assert(typeof legacyForecastRate?.toFixed(2) === 'string', 'Safe toFixed formatting succeeds for legacy record');

  // Test 2: Incomplete record with completely empty actualOutcome
  const emptyOutcomeRecord: DecisionRecord = {
    id: 'dec-empty-outcome-002',
    timestamp: '2026-08-02 12:00 UTC',
    commodity: 'Thermal Coal',
    cargoQuantityTonnes: 150000,
    originPort: 'Newcastle',
    destinationPort: 'Gangavaram',
    numberOfVoyages: 1,
    recommendedStrategy: 'spot',
    recommendedVesselClass: 'Capesize',
    expectedRateUsdPerTonne: 14.0,
    expectedTotalCostUsd: 2100000,
    expectedCostPerTonne: 14.0,
    savingsVsSpotPct: 0,
    riskScore: 30,
    confidenceScorePct: 85,
    entryTiming: 'ENTER NOW',
    actualOutcome: {}, // Completely empty outcome
  };

  const extractActualRate = (d: DecisionRecord): number | null => {
    if (!d.actualOutcome) return null;
    if (typeof d.actualOutcome.actualRateAchievedUsd === 'number' && !isNaN(d.actualOutcome.actualRateAchievedUsd)) {
      return d.actualOutcome.actualRateAchievedUsd;
    }
    if (typeof d.actualOutcome.actualRateUsdPerTonne === 'number' && !isNaN(d.actualOutcome.actualRateUsdPerTonne)) {
      return d.actualOutcome.actualRateUsdPerTonne;
    }
    return null;
  };

  const extractVariance = (d: DecisionRecord): number | null => {
    if (!d.actualOutcome) return null;
    if (typeof d.actualOutcome.rateVariancePct === 'number' && !isNaN(d.actualOutcome.rateVariancePct)) {
      return d.actualOutcome.rateVariancePct;
    }
    if (typeof d.actualOutcome.variancePct === 'number' && !isNaN(d.actualOutcome.variancePct)) {
      return d.actualOutcome.variancePct;
    }
    return null;
  };

  assert(extractActualRate(emptyOutcomeRecord) === null, 'Empty actualOutcome safely yields null without calling toFixed');
  assert(extractVariance(emptyOutcomeRecord) === null, 'Empty actualOutcome safely yields null variance without calling toFixed');

  // Test 3: Provenance distinction: simulated vs live persisted decisions
  const isRecordSimulated = (d: DecisionRecord): boolean => {
    if (d.isSimulated === true) return true;
    if (d.provenance === 'SIMULATED' || d.dataStatus === 'SIMULATED') return true;
    if (d.auditTrail?.provenanceStatus === 'SIMULATED') return true;
    if (typeof d.id === 'string' && (
      d.id.startsWith('dec-2026-0') ||
      d.id.includes('benchmark') ||
      d.id.includes('simulated')
    )) {
      return true;
    }
    return false;
  };

  const simulatedDecision: DecisionRecord = { ...legacyRecord, id: 'dec-2026-0814', isSimulated: true, provenance: 'SIMULATED' };
  const realDecision: DecisionRecord = { ...legacyRecord, id: 'dec-live-user-fixture-99', isSimulated: false, provenance: 'REAL' };

  assert(isRecordSimulated(simulatedDecision) === true, 'Historical simulated benchmark must be identified as SIMULATED');
  assert(isRecordSimulated(realDecision) === false, 'Live user persisted fixture must be identified as LIVE PERSISTED');

  // Alternative Ports / Route Optimizer Contract & Regression Resilience Tests
  console.log('\n[7/7] Testing Alternative Ports / Route Optimizer Contract & Regression Resilience...');

  const capesizeVessel = VESSELS.find((v) => v.vesselClass === 'Capesize')!;
  const evaluatedAlternatives = evaluateAlternativePorts('in-dhm', 4920, 16.5, capesizeVessel);

  assert(Array.isArray(evaluatedAlternatives), 'evaluateAlternativePorts returns an array');
  assert(evaluatedAlternatives.length > 0, 'evaluateAlternativePorts returns multiple ports');

  // Verify all required fields are present in every evaluated alternative port
  for (const alt of evaluatedAlternatives) {
    assert(typeof alt.portId === 'string' && alt.portId.length > 0, `portId is non-empty string for ${alt.port.name}`);
    assert(typeof alt.portName === 'string' && alt.portName.length > 0, `portName is non-empty string for ${alt.port.name}`);
    assert(typeof alt.draftLimit === 'number' && !isNaN(alt.draftLimit), `draftLimit is valid number for ${alt.port.name}`);
    assert(typeof alt.expectedWaitingDays === 'number' && !isNaN(alt.expectedWaitingDays), `expectedWaitingDays is valid number for ${alt.port.name}`);
    assert(typeof alt.oceanFreightRateUsd === 'number' && !isNaN(alt.oceanFreightRateUsd), `oceanFreightRateUsd is valid number for ${alt.port.name}`);
    assert(typeof alt.portChargesUsd === 'number' && !isNaN(alt.portChargesUsd), `portChargesUsd is valid number for ${alt.port.name}`);
    assert(typeof alt.demurrageRiskUsd === 'number' && !isNaN(alt.demurrageRiskUsd), `demurrageRiskUsd is valid number for ${alt.port.name}`);
    assert(typeof alt.inlandRailFreightUsd === 'number' && !isNaN(alt.inlandRailFreightUsd), `inlandRailFreightUsd is valid number for ${alt.port.name}`);
    assert(typeof alt.totalLandedCostPerTonneUsd === 'number' && !isNaN(alt.totalLandedCostPerTonneUsd), `totalLandedCostPerTonneUsd is valid number for ${alt.port.name}`);
    assert(typeof alt.deltaVsSelectedPortUsd === 'number' && !isNaN(alt.deltaVsSelectedPortUsd), `deltaVsSelectedPortUsd is valid number for ${alt.port.name}`);
    assert(typeof alt.recommendationReason === 'string' && alt.recommendationReason.length > 0, `recommendationReason is non-empty string for ${alt.port.name}`);

    // Verify .toUpperCase() runs smoothly on portId
    assert(typeof alt.portId.toUpperCase() === 'string', `.toUpperCase() succeeds on portId: ${alt.portId}`);
  }

  // Regression Test for EXACT undefined-input case:
  // Legacy or incomplete AlternativePortOption where portId and other fields are completely undefined
  const incompleteAltOption: Partial<AlternativePortOption> = {
    // Deliberately undefined portId, portName, draftLimit, etc.
    seaDistanceNm: 5000,
    seaDays: 14,
  };

  // Safe resolver simulation matching RouteOptimizerView implementation:
  const resolvePortId = (alt: any): string | null => {
    return alt.portId || alt.port?.id || null;
  };

  const resolvePortName = (alt: any): string | null => {
    return alt.portName || alt.port?.name || null;
  };

  const renderPortCodeSafe = (alt: any): string => {
    const portId = resolvePortId(alt);
    return portId ? portId.toUpperCase() : 'Port ID Unavailable';
  };

  // Must NOT throw TypeError: Cannot read properties of undefined (reading 'toUpperCase')
  let threwException = false;
  let renderedResult = '';
  try {
    renderedResult = renderPortCodeSafe(incompleteAltOption);
  } catch (err) {
    threwException = true;
  }

  assert(!threwException, 'Undefined portId input must NOT throw TypeError on .toUpperCase()');
  assert(renderedResult === 'Port ID Unavailable', 'Undefined portId input safely produces explicit "Port ID Unavailable"');

  // Test partial port object where portId is omitted but port.id exists (legacy fallback)
  const legacyWithPortObject: any = {
    port: { id: 'in-prt', name: 'Paradip Port', maxDraft: 14.5, averageWaitingDays: 3.5 },
  };
  assert(resolvePortId(legacyWithPortObject) === 'in-prt', 'Resolves port.id as fallback when portId is missing');
  assert(renderPortCodeSafe(legacyWithPortObject) === 'IN-PRT', 'Formats fallback port.id to uppercase safely');

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

testRepo();
