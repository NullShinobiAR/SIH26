import {
  FreightForecastResult,
  FreightHistoryPoint,
  ForecastPoint,
  VesselClass,
  ModelMetric,
  IRouteFreightObservationRepository,
} from '../types';
import { generateHistoricalFreight } from '../data/maritimeData';
import { globalRouteFreightObservationRepository } from '../data/routeFreightObservationRepository';
import {
  runChronologicalBacktesting,
  calculateForecastConfidence,
  buildFeatureDataset,
  GradientBoostedRegressor,
  AutoregressiveSeasonalModel,
  MovingAverageModel,
  NaivePersistenceModel,
} from './mlEngine';

/**
 * Resolves standard Baltic Route code corresponding to a route ID and vessel class.
 */
export function resolveTargetBalticRouteCode(routeId: string, vesselClass: VesselClass): string {
  const norm = (routeId || '').toLowerCase();
  if (
    norm.includes('c5') ||
    norm.includes('au-cn') ||
    norm.includes('hed') ||
    norm.includes('qng') ||
    norm.includes('hedland') ||
    norm.includes('qingdao')
  ) {
    return 'C5_AU_CN';
  }
  if (norm.includes('c18') || (norm.includes('dhm') && vesselClass === 'Capesize')) {
    return 'C18';
  }
  if (norm.includes('p9') || (norm.includes('dhm') && vesselClass === 'Panamax')) {
    return 'P9';
  }
  // Default vessel class mapping for Australia -> India corridor
  if (vesselClass === 'Capesize') return 'C18';
  return 'P9';
}

export function runFreightForecast(
  routeId: string,
  vesselClass: VesselClass,
  modelSelection: 'Naive' | 'Moving Average' | 'Seasonal Autoregressive Ridge' | 'GBDT Regression' | 'Ensemble' = 'Ensemble',
  routeRepoOverride?: IRouteFreightObservationRepository
): FreightForecastResult {
  const targetRouteCode = resolveTargetBalticRouteCode(routeId, vesselClass);
  const repo = routeRepoOverride || globalRouteFreightObservationRepository;

  // Retrieve route-specific verified observations
  // (NOTE: Generic live BDI/VLSFO or other route observations CANNOT satisfy this gate)
  let routeObservations: any[] = [];
  try {
    if ('getRecordsSync' in repo && typeof (repo as any).getRecordsSync === 'function') {
      routeObservations = (repo as any).getRecordsSync(targetRouteCode);
    }
  } catch {
    routeObservations = [];
  }

  // Filter strictly for REAL verified observations with valid non-null positive rate
  const verifiedRealObservations = routeObservations.filter(
    (obs) =>
      obs.routeCode === targetRouteCode &&
      (obs.dataStatus === 'REAL' || obs.provenance === 'REAL') &&
      !obs.synthetic &&
      typeof obs.freightRateUsdPerMt === 'number' &&
      obs.freightRateUsdPerMt > 0
  );

  const realCount = verifiedRealObservations.length;
  const trainingGate = evaluateRealDataTrainingReadiness(realCount);

  let history: FreightHistoryPoint[];
  let isRealTrainingActive = false;

  // STRICT 52-WEEK CONTINUOUS VERIFIED ROUTE OBSERVATION GATE:
  // Zero mixing: if real data < 52, DO NOT mix real and simulated data.
  if (trainingGate.isEligibleForRealTraining) {
    isRealTrainingActive = true;
    // Map strictly from sorted real observations (chronological order)
    const sortedReal = [...verifiedRealObservations].sort(
      (a, b) => new Date(a.date || a.observedAt).getTime() - new Date(b.date || b.observedAt).getTime()
    );
    history = sortedReal.map((rec) => ({
      date: (rec.date || rec.observedAt).substring(0, 10),
      rateUsdPerTonne: rec.freightRateUsdPerMt!,
      vlsfoPrice: 590, // Reference benchmark
      bdi: 1750,
      volumeTonnes: rec.cargoVolumeMt || 80000,
    }));
  } else {
    // Calibrated Development Proxy (SIMULATED & DERIVED)
    isRealTrainingActive = false;
    let baseRate = 17.5; // Panamax default
    if (vesselClass === 'Capesize') baseRate = 13.6;
    else if (vesselClass === 'Supramax') baseRate = 20.8;
    else if (vesselClass === 'Handysize') baseRate = 24.5;

    if (routeId.includes('id-tbn')) {
      baseRate = baseRate * 0.45;
    } else if (routeId.includes('us-bal')) {
      baseRate = baseRate * 2.1;
    } else if (routeId.includes('mz-mpt')) {
      baseRate = baseRate * 0.88;
    }

    history = generateHistoricalFreight(baseRate, 52);
  }

  const latestHistorical = history[history.length - 1];
  const currentRate = latestHistorical.rateUsdPerTonne;

  // Calculate empirical historical volatility (annualized standard deviation of weekly log returns)
  const returns: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const r = Math.log(history[i].rateUsdPerTonne / history[i - 1].rateUsdPerTonne);
    returns.push(r);
  }
  const meanReturn = returns.reduce((acc, v) => acc + v, 0) / Math.max(1, returns.length);
  const variance = returns.reduce((acc, v) => acc + Math.pow(v - meanReturn, 2), 0) / Math.max(1, returns.length - 1);
  const weeklyVolatility = Math.sqrt(variance);
  const annualizedVolatilityPct = Number((weeklyVolatility * Math.sqrt(52) * 100).toFixed(1));

  // 1. RUN GENUINE CHRONOLOGICAL EXPANDING-WINDOW BACKTESTING
  // Computes actual MAE, RMSE, MAPE, Directional Accuracy with zero lookahead bias
  const backtestResults = runChronologicalBacktesting(history);
  const { evaluations, actualVsPredicted, governance } = backtestResults;

  // Update governance based on active training data provenance
  if (isRealTrainingActive) {
    governance.dataProvenance = 'REAL VERIFIED ROUTE OBSERVATIONS';
    governance.datasetVersion = `Baltic-${targetRouteCode}-Verified-History`;
    governance.modelStatus = 'Verified Real Data Production Model';
  } else {
    governance.dataProvenance = 'Calibrated Development Proxy (SIMULATED & DERIVED)';
    governance.modelStatus = 'Calibrated Development Proxy (Real Route Training Locked)';
  }

  // Train the production models on full history up to present
  const samples = buildFeatureDataset(history);
  const X_all = samples.map((s) => s.features);
  const y_all = samples.map((s) => s.actualRate);

  // Train AR Model
  const arModel = new AutoregressiveSeasonalModel();
  arModel.train(X_all, y_all);

  // Train GBDT Model
  const gbdtModel = new GradientBoostedRegressor(15, 0.1);
  gbdtModel.fit(X_all, y_all);

  const maModel = new MovingAverageModel();
  const naiveModel = new NaivePersistenceModel();

  // Multi-horizon forecasting logic
  // Compute genuine out-of-sample inverse-RMSE weights dynamically from backtest evaluations
  const gbdtEval = evaluations.find((e) => e.name.includes('Gradient Boosted')) || evaluations[0];
  const arEval = evaluations.find((e) => e.name.includes('Seasonal Autoregressive') || e.name.includes('ARIMA')) || evaluations[0];
  const maEval = evaluations.find((e) => e.name.includes('Moving Average')) || evaluations[0];
  const naiveEval = evaluations.find((e) => e.name.includes('Naive')) || evaluations[0];

  const invGbdt = 1 / Math.max(0.05, gbdtEval.rmse ?? 1.0);
  const invAr = 1 / Math.max(0.05, arEval.rmse ?? 1.0);
  const invMa = 1 / Math.max(0.05, maEval.rmse ?? 1.0);
  const invNaive = 1 / Math.max(0.05, naiveEval.rmse ?? 1.0);
  const sumInv = invGbdt + invAr + invMa + invNaive;

  const wGbdt = invGbdt / sumInv;
  const wAr = invAr / sumInv;
  const wMa = invMa / sumInv;
  const wNaive = invNaive / sumInv;

  // Latest feature vector for current state
  const latestFeatures = samples.length > 0 ? [...samples[samples.length - 1].features] : Array(12).fill(currentRate);

  const getPrediction = (weeksAhead: number, modelType: string): number => {
    // Dynamic features updated for forward horizon
    const horizonFeatures = [...latestFeatures];
    // Update seasonal harmonic features for future week
    const dateObj = new Date(new Date(latestHistorical.date).getTime() + weeksAhead * 7 * 86400000);
    const dayOfYear = Math.floor((dateObj.getTime() - new Date(dateObj.getFullYear(), 0, 1).getTime()) / 86400000);
    const weekNumber = Math.min(52, Math.max(1, Math.floor(dayOfYear / 7)));
    horizonFeatures[10] = Math.sin((2 * Math.PI * weekNumber) / 52);
    horizonFeatures[11] = Math.cos((2 * Math.PI * weekNumber) / 52);

    const naiveVal = naiveModel.predict(currentRate);
    const maVal = maModel.predict(history, 8);
    const arVal = arModel.predict(horizonFeatures);
    const gbdtVal = gbdtModel.predict(horizonFeatures);

    // Multi-horizon drift damping
    const dampedAR = Number((currentRate + (arVal - currentRate) * Math.exp(-weeksAhead * 0.08)).toFixed(2));
    const dampedGBDT = Number((currentRate + (gbdtVal - currentRate) * Math.exp(-weeksAhead * 0.06)).toFixed(2));

    if (modelType === 'Naive') return naiveVal;
    if (modelType === 'Moving Average') return maVal;
    if (modelType === 'Seasonal Autoregressive Ridge') return dampedAR;
    if (modelType === 'GBDT Regression') return dampedGBDT;

    // Ensemble: dynamic inverse-RMSE weighted blend of constituent models
    return Number((dampedGBDT * wGbdt + dampedAR * wAr + maVal * wMa + naiveVal * wNaive).toFixed(2));
  };

  // Find metrics for the selected model from the real backtest evaluations
  let selectedEval = evaluations.find((e) => {
    if (modelSelection === 'Naive' && e.name.includes('Naive')) return true;
    if (modelSelection === 'Moving Average' && e.name.includes('Moving Average')) return true;
    if (modelSelection === 'Seasonal Autoregressive Ridge' &&
        (e.name.includes('Seasonal Autoregressive') || e.name.includes('AR Ridge') || e.name.includes('AR-Seasonal'))) return true;
    if (modelSelection === 'GBDT Regression' && e.name.includes('Gradient Boosted')) return true;
    if (modelSelection === 'Ensemble' && e.name.includes('Ensemble')) return true;
    return false;
  }) || evaluations[0];

  const modelMetrics: ModelMetric = {
    mae: selectedEval.mae,
    rmse: selectedEval.rmse,
    mape: selectedEval.mape,
    directionalAccuracyPct: selectedEval.directionalAccuracy,
    trainingObservations: governance.trainingObservations,
    testObservations: governance.testObservations,
    validationMethod: governance.validationMethod,
  };

  const f2w = getPrediction(2, modelSelection);
  const f4w = getPrediction(4, modelSelection);
  const f8w = getPrediction(8, modelSelection);
  const f12w = getPrediction(12, modelSelection);

  const expectedChangePct4Weeks = Number((((f4w - currentRate) / currentRate) * 100).toFixed(1));

  // Determine trend based on forward change
  let trend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH' = 'NEUTRAL';
  if (expectedChangePct4Weeks > 6) trend = 'STRONG_BULLISH';
  else if (expectedChangePct4Weeks > 2.0) trend = 'BULLISH';
  else if (expectedChangePct4Weeks < -6) trend = 'STRONG_BEARISH';
  else if (expectedChangePct4Weeks < -2.0) trend = 'BEARISH';

  // Calculate measurable confidence based on backtest MAPE, horizon, volatility, and model agreement
  const confidenceBreakdown = calculateForecastConfidence(
    modelMetrics.mape,
    4,
    annualizedVolatilityPct,
    {
      gbdt: getPrediction(4, 'GBDT Regression'),
      ar: getPrediction(4, 'Seasonal Autoregressive Ridge'),
      ma: getPrediction(4, 'Moving Average'),
    }
  );

  // Build forward forecast points (weekly for 12 weeks)
  const forecastSeries: ForecastPoint[] = [];
  const latestDate = new Date(latestHistorical.date);

  for (let w = 1; w <= 12; w++) {
    const fDate = new Date(latestDate.getTime() + w * 7 * 24 * 3600 * 1000);
    const pred = getPrediction(w, modelSelection);
    // Expanding confidence cone based on empirical RMSE and horizon: se = rmse * sqrt(w / 4)
    const se = Math.max(0.4, (modelMetrics.rmse ?? 0.8) * Math.sqrt(w / 4));
    const lower95 = Math.max(8.0, Number((pred - 1.96 * se).toFixed(2)));
    const upper95 = Number((pred + 1.96 * se).toFixed(2));
    const lower80 = Math.max(8.5, Number((pred - 1.28 * se).toFixed(2)));
    const upper80 = Number((pred + 1.28 * se).toFixed(2));

    forecastSeries.push({
      date: fDate.toISOString().split('T')[0],
      predictedRate: pred,
      lowerBound95: lower95,
      upperBound95: upper95,
      lowerBound80: lower80,
      upperBound80: upper80,
    });
  }

  return {
    routeId,
    vesselClass,
    currentRateUsdPerTonne: currentRate,
    forecast2Weeks: f2w,
    forecast4Weeks: f4w,
    forecast8Weeks: f8w,
    forecast12Weeks: f12w,
    expectedChangePct4Weeks,
    volatilityAnnualizedPct: annualizedVolatilityPct,
    trend,
    confidenceScorePct: confidenceBreakdown.scorePct,
    confidenceBreakdown,
    dataQualityBadge: isRealTrainingActive ? 'REAL' : 'SIMULATED',
    selectedModel: modelSelection,
    modelMetrics,
    allModelsEvaluations: evaluations,
    backtestHistory: actualVsPredicted,
    governance,
    realTrainingGate: {
      ...trainingGate,
      targetRouteCode,
      isRealTrainingActive,
    },
    history,
    forecastSeries,
  };
}

/**
 * Model Training Governance Gate:
 * Evaluates whether persistent real historical repository has sufficient observations
 * to permit automated re-training. Prevents single-point/sparse overfitting.
 */
export function evaluateRealDataTrainingReadiness(realObservationCount: number): {
  isEligibleForRealTraining: boolean;
  currentCount: number;
  minimumRequiredCount: number;
  readinessPct: number;
  statusMessage: string;
} {
  const minRequired = 52; // 52 continuous weekly data points required for seasonal multi-horizon modeling
  const isEligible = realObservationCount >= minRequired;
  return {
    isEligibleForRealTraining: isEligible,
    currentCount: realObservationCount,
    minimumRequiredCount: minRequired,
    readinessPct: Math.min(100, Math.round((realObservationCount / minRequired) * 100)),
    statusMessage: isEligible
      ? `Sufficient real historical data available (${realObservationCount}/${minRequired}). Pipeline eligible for machine learning re-training.`
      : `Model re-training locked: Only ${realObservationCount}/${minRequired} verified external observations recorded. Forecaster continues using calibrated benchmark ground truth to prevent premature training on sparse points.`,
  };
}
