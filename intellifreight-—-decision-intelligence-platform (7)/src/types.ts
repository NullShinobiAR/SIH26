export type VesselClass = 'Handysize' | 'Supramax' | 'Panamax' | 'Capesize';

export type CommodityType = 'Coking Coal' | 'Thermal Coal' | 'PCI Coal' | 'Iron Ore' | 'Bauxite';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DataProvenanceType = 'REAL' | 'DERIVED' | 'SIMULATED' | 'ASSUMPTION' | 'UNAVAILABLE' | 'STALE';

export type DataSourceType = DataProvenanceType | 'REAL DATA' | 'DERIVED DATA' | 'SIMULATED DATA' | 'DATA UNAVAILABLE';

export type ProviderFeedStatus = 'LIVE' | 'STALE' | 'UNAVAILABLE' | 'DEMO';

export interface MarketObservation<T = number> {
  value: T | null;
  unit: string;
  source: string;
  sourceUrl?: string;
  observedAt: string;
  retrievedAt: string;
  dataStatus: DataProvenanceType;
  provenance?: DataProvenanceType;
  provider: string;
  confidence?: number;
  isLive: boolean;
  previousObservation?: number | null;
  change7d?: number | null;
  change30d?: number | null;
  errorMessage?: string;
}

export type OptimizationPreference = 'lowest_cost' | 'balanced' | 'lowest_risk' | 'green';

export interface Port {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  maxLoa: number; // meters
  maxBeam: number; // meters
  maxDraft: number; // meters
  berthLength: number; // meters
  cargoHandlingRateTpd: number; // tonnes per day
  cargoTypes: CommodityType[];
  tidalRestrictions: string;
  averageWaitingDays: number;
  portChargesBaseUsd: number; // Port disbursement account base
  operationalNotes: string;
  congestionScore: number; // 0-100
  waitingVesselsCount: number;
}

export interface Vessel {
  id: string;
  name: string;
  vesselClass: VesselClass;
  dwt: number; // metric tonnes
  loa: number; // meters
  beam: number; // meters
  draft: number; // meters
  speedKnots: number; // economic sailing speed
  fuelConsumptionSeaTpd: number; // tonnes VLSFO / day at sea
  fuelConsumptionPortTpd: number; // tonnes MGO / day in port
  cargoCapacityTonnes: number; // typical coal payload capacity
  dailyHireRateUsd: number; // current spot time-charter rate equivalent
  availabilityStatus: 'AVAILABLE' | 'PROMPT' | 'EN_ROUTE' | 'COMMITTED';
  currentPosition: {
    lat: number;
    lng: number;
    area: string;
  };
  yearBuilt: number;
  flag: string;
}

export interface Route {
  id: string;
  originPortId: string;
  destinationPortId: string;
  originName: string;
  destinationName: string;
  distanceNm: number;
  typicalSeaDaysPanamax: number;
  canalChokePoints: string[];
  piracyRisk: 'NONE' | 'LOW' | 'MEDIUM';
  weatherRiskRating: number; // 1-10
}

export interface MarketIndices {
  bdi: number; // Baltic Dry Index
  bdiChangePct: number;
  bci: number; // Capesize
  bpi: number; // Panamax
  bsi: number; // Supramax
  bhsi: number; // Handysize
  vlsfoSingaporeUsd: number; // $/tonne
  vlsfoFujairahUsd: number;
  mgoSingaporeUsd: number;
  newcastleCoalUsd: number; // $/tonne FOB
  api4CoalUsd: number; // Richards Bay
  api5CoalUsd: number; // 5500 kcal
  cokingCoalAustraliaUsd: number; // Premium Hard Coking Coal
  exchangeRateUsdInr: number;
  lastUpdated: string;
}

export interface FreightHistoryPoint {
  date: string;
  rateUsdPerTonne: number;
  vlsfoPrice: number;
  bdi: number;
  volumeTonnes: number;
}

export interface ModelMetric {
  mae: number | null;
  rmse: number | null;
  mape: number | null;
  directionalAccuracyPct: number | null;
  trainingObservations?: number;
  testObservations?: number;
  validationMethod?: string;
}

export interface BacktestPredictionPoint {
  date: string;
  actualRate: number;
  predictedRate: number;
  lowerBound90: number;
  upperBound90: number;
  error: number;
}

export interface ModelEvaluation {
  name: string;
  type:
    | 'Statistical Baseline'
    | 'Classical Time-Series'
    | 'Regularized Linear Time-Series'
    | 'ML Model (Tree Ensemble)'
    | 'Production Candidate'
    | 'Production Candidate (Inverse-RMSE Weighted)';
  mae: number | null;
  rmse: number | null;
  mape: number | null;
  directionalAccuracy: number | null;
  color: string;
  validation: string;
  isBest?: boolean;
  status?: 'AVAILABLE' | 'UNAVAILABLE';
  reason?: string;
}

export interface ModelGovernance {
  modelVersion: string;
  trainingDate: string;
  datasetVersion: string;
  featureCount: number;
  featuresList: { name: string; type: string; provenance: DataProvenanceType }[];
  trainingObservations: number;
  testObservations: number;
  validationMethod: string;
  dataProvenance: string;
  modelStatus: string;
  evaluatedMetrics: {
    mae: number | null;
    rmse: number | null;
    mape: number | null;
    directionalAccuracyPct: number | null;
  };
}

export interface ForecastPoint {
  date: string;
  predictedRate: number;
  lowerBound95: number;
  upperBound95: number;
  lowerBound80: number;
  upperBound80: number;
}

export interface ForecastConfidenceBreakdown {
  scorePct: number;
  errorScore: number;
  horizonScore: number;
  volatilityScore: number;
  modelAgreementScore: number;
  methodologyNote: string;
}

export interface FreightForecastResult {
  routeId: string;
  vesselClass: VesselClass;
  currentRateUsdPerTonne: number;
  forecast2Weeks: number;
  forecast4Weeks: number;
  forecast8Weeks: number;
  forecast12Weeks: number;
  expectedChangePct4Weeks: number;
  volatilityAnnualizedPct: number;
  trend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  confidenceScorePct: number;
  confidenceBreakdown?: ForecastConfidenceBreakdown;
  dataQualityBadge: DataSourceType;
  selectedModel: 'Naive' | 'Moving Average' | 'Seasonal Autoregressive Ridge' | 'GBDT Regression' | 'Ensemble';
  modelMetrics: ModelMetric;
  allModelsEvaluations?: ModelEvaluation[];
  backtestHistory?: BacktestPredictionPoint[];
  governance?: ModelGovernance;
  realTrainingGate?: {
    isEligibleForRealTraining: boolean;
    currentCount: number;
    minimumRequiredCount: number;
    readinessPct: number;
    statusMessage: string;
    targetRouteCode: string;
    isRealTrainingActive: boolean;
  };
  history: FreightHistoryPoint[];
  forecastSeries: ForecastPoint[];
}

export interface FeasibilityCheckDetail {
  passed: boolean;
  value: number | string;
  limit: number | string;
  unit?: string;
  margin?: number;
}

export interface VesselFeasibilityResult {
  vessel: Vessel;
  isFeasible: boolean;
  checks: {
    loa: FeasibilityCheckDetail;
    beam: FeasibilityCheckDetail;
    draft: FeasibilityCheckDetail;
    berthLength: FeasibilityCheckDetail;
    cargoCompatibility: { passed: boolean; note: string };
    capacityMatch: { passed: boolean; loadPct: number };
  };
  rejectionReason?: string;
  recommendationGrade: 'OPTIMAL' | 'COMPATIBLE' | 'SUB-OPTIMAL' | 'REJECTED';
}

export interface VoyageCostBreakdown {
  cargoQuantityTonnes: number;
  voyagesCount: number;
  seaDays: number;
  portDays: number;
  waitingDays: number;
  totalDurationDays: number;
  
  // Cost items ($USD)
  freightCost: number; // Base freight = rate * quantity
  bunkerSeaCost: number;
  bunkerPortCost: number;
  totalBunkerCost: number;
  portDisbursementCost: number;
  expectedDelayCost: number; // Demurrage exposure
  expectedIdleCost: number; // Repositioning / ballast risk
  carbonCost: number; // ETS / IMO decarbonization fee
  otherVoyageCost: number; // Insurance, canal, fresh water
  
  totalVoyageCostUsd: number;
  totalContractCostUsd: number; // for multi-voyages
  costPerTonneUsd: number;
  
  // Consumption & emissions
  vlsfoConsumedTonnes: number;
  mgoConsumedTonnes: number;
  co2EmissionsTonnes: number;
  co2PerTonneCargo: number; // kg CO2 / tonne
}

export type ContractStrategy = 'spot' | 'short_term' | 'medium_term' | 'coa';

export interface ContractOption {
  strategy: ContractStrategy;
  title: string;
  subtitle: string;
  horizonWeeks: number;
  voyagesAllocated: number;
  agreedRateUsdPerTonne: number;
  totalExpectedCostUsd: number;
  costPerTonneUsd: number;
  landedCostPerTonne: number; // Nominal landed cost per tonne ($/t)
  riskAdjustedCostPerTonne: number; // Actuarially sound risk-adjusted cost per tonne ($/t)
  riskAdjustedTotalCostUsd: number; // Total risk-adjusted logistics cost ($)
  optimizationScore: number; // Multi-attribute optimization utility score (0-100)
  savingsVsSpotUsd: number;
  savingsVsSpotPct: number;
  freightDiscountVsSpotPct: number; // Freight rate discount vs spot freight rate (%)
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  flexibilityScore: number; // 0-100
  volatilityProtectionScore: number; // 0-100
  isRecommended: boolean;
  whyRecommended?: string[];
  keyRisks: string[];
  isEligible: boolean;
  eligibilityStatus: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  ineligibilityReason?: string;
  minVoyagesRequired: number;
  maxVoyagesAllowed?: number;
}

export interface MarketEntryTiming {
  action: 'ENTER NOW' | 'ENTER WITHIN 7 DAYS' | 'WAIT AND MONITOR' | 'REASSESS IN 2 WEEKS';
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  probRateIncreasePct: number;
  probRateDecreasePct: number;
  optimalWindowDays: string;
  drivers: string[];
  marketSignals: {
    indicator: string;
    signal: 'bullish' | 'bearish' | 'neutral';
    comment: string;
  }[];
}

export interface RiskDimension {
  name: string;
  score: number; // 0-100
  level: RiskLevel;
  factors: string[];
  weight: number;
  summary?: string;
  mitigation?: string;
}

export interface ComprehensiveRiskAssessment {
  overallScore: number; // 0-100
  overallLevel: RiskLevel;
  marketRisk: RiskDimension;
  portRisk: RiskDimension;
  portCongestionRisk?: RiskDimension;
  weatherRisk: RiskDimension;
  operationalRisk: RiskDimension;
  contractLockInRisk?: RiskDimension;
  counterpartyRisk?: RiskDimension;
  mitigationActions: string[];
}

export interface DigitalTwinStage {
  id: number;
  name: string;
  phase: 'LOAD_PORT' | 'TRANSIT' | 'DISCHARGE_PORT' | 'TURNAROUND';
  locationName: string;
  coordinates: [number, number];
  durationHours: number;
  cumulativeDays: number;
  fuelBurnTonnes: number;
  co2EmittedTonnes: number;
  riskFactors: string[];
  status: 'COMPLETED' | 'IN_PROGRESS' | 'SCHEDULED';
  details: string;
}

export interface DigitalTwinSimulation {
  stages: DigitalTwinStage[];
  totalSeaDays: number;
  totalPortDays: number;
  totalWaitingDays: number;
  totalVoyageDays: number;
  totalVlsfoTonnes: number;
  totalMgoTonnes: number;
  totalCo2Tonnes: number;
  totalCostUsd: number;
  eeoiScore: number; // Energy Efficiency Operational Indicator
  weatherDisruptionHours: number;
  congestionDelayHours: number;
  berthTurnaroundHours: number;
}

export interface AlternativePortOption {
  port: Port;
  portId: string;
  portName: string;
  draftLimit: number;
  expectedWaitingDays: number;
  oceanFreightRateUsd: number;
  portChargesUsd: number;
  demurrageRiskUsd: number;
  inlandRailFreightUsd: number;
  totalLandedCostPerTonneUsd: number;
  deltaVsSelectedPortUsd: number;
  recommendationReason: string;
  seaDistanceNm: number;
  seaDays: number;
  freightRateUsdPerTonne: number;
  voyageCostPerTonneUsd: number;
  inlandRailFreightToPlantUsd: number; // e.g. to Odisha/Jharkhand/WB steel cluster
  congestionDelayDays: number;
  riskScore: number;
  isFeasible: boolean;
  savingsVsPrimaryPerTonne: number;
  recommendationNote: string;
}

export interface ScenarioInput {
  freightRateChangePct: number; // e.g. +10, -10
  bunkerPriceChangePct: number; // e.g. +20, -20
  portCongestionDeltaDays: number; // e.g. +2
  cargoQuantityChangePct: number; // e.g. +20
  weatherSeverityMultiplier: number; // 1.0 = normal, 1.5 = severe
  vesselAvailabilityDropPct: number;
  destinationPortOverride?: string;
}

export interface ScenarioResult {
  scenarioName: string;
  baseCostUsd: number;
  scenarioCostUsd: number;
  costDeltaUsd: number;
  costDeltaPct: number;
  baseCostPerTonne: number;
  scenarioCostPerTonne: number;
  baseRecommendedStrategy: ContractStrategy;
  scenarioRecommendedStrategy: ContractStrategy;
  strategyChanged: boolean;
  riskScoreDelta: number;
  keyInsights: string[];
}

export interface DecisionRecord {
  id: string;
  timestamp: string;
  commodity: CommodityType;
  cargoQuantityTonnes: number;
  volumeTonnes?: number;
  originPort: string;
  destinationPort: string;
  numberOfVoyages: number;
  recommendedStrategy: ContractStrategy;
  recommendedVesselClass: VesselClass;
  recommendedVessel?: string;
  expectedRateUsdPerTonne: number;
  expectedTotalCostUsd: number;
  expectedCostPerTonne: number;
  predictedRateUsdPerTonne?: number;
  predictedTotalCostUsd?: number;
  savingsVsSpotPct: number;
  riskScore: number;
  riskLevel?: RiskLevel;
  confidenceScorePct: number;
  confidencePct?: number;
  entryTiming: string;
  marketEntryTiming?: string;
  status?: 'ANALYZED' | 'FIXTURE_EXECUTED' | 'CANCELLED' | 'COMPLETED' | 'IN_TRANSIT';
  requestSnapshot?: CharteringAnalysisRequest;
  auditTrail?: DecisionAuditTrail;
  provenance?: DataProvenanceType;
  dataStatus?: DataProvenanceType;
  isSimulated?: boolean;
  actualOutcome?: {
    contractClosedDate?: string;
    actualRateUsdPerTonne?: number;
    actualTotalCostUsd?: number;
    actualRateAchievedUsd?: number;
    actualCostAchievedUsd?: number;
    actualDelayDays?: number;
    varianceUsd?: number;
    variancePct?: number;
    rateVariancePct?: number;
    costVariancePct?: number;
    recordedAt?: string;
    postVoyageReview?: string;
  };
}

export interface DatasetMeta {
  id: string;
  name: string;
  description: string;
  category: 'Freight Market' | 'Bunker Fuel' | 'Commodities' | 'Port Intelligence' | 'Vessel Tracking' | 'Macroeconomics';
  source: string;
  sourceType: DataProvenanceType;
  connectionStatus: 'CONNECTED' | 'NOT_CONNECTED_DEMO';
  connectionNote: string;
  frequency: 'Real-time' | 'Daily' | 'Weekly' | 'Monthly' | 'Static Reference';
  lastUpdated: string;
  recordCount: number;
  type: DataSourceType;
  qualityScore: number; // 0-100
  completenessPct: number;
  coveragePeriod: string;
  dateRange: string;
  variables: string[];
  schema: string[];
  dataQualityStatus: 'VERIFIED_REAL' | 'CALCULATED_DERIVED' | 'SYNTHETIC_DEMO' | 'CONFIGURED_ASSUMPTION';
  usedForMl: boolean;
  usedForOptimization: boolean;
  isDemoData: boolean;
}

export interface DataQualityReport {
  overallScore: number;
  completenessScore: number;
  freshnessScore: number;
  sourceReliabilityScore: number;
  coverageScore: number;
  provenanceBreakdown: {
    realCount: number;
    derivedCount: number;
    simulatedCount: number;
    assumptionCount: number;
  };
  evaluationSummary: string;
}

export interface CharteringAnalysisRequest {
  commodity: CommodityType;
  cargoQuantityTonnes: number;
  numberOfVoyages: number;
  originPortId: string;
  destinationPortId: string;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  contractHorizonPreference: 'flexible' | 'spot' | 'short_term' | 'medium_term';
  optimizationPreference: OptimizationPreference;
  includeCarbonCost: boolean;
}

export interface CharteringAnalysisResponse {
  request: CharteringAnalysisRequest;
  originPort: Port;
  destinationPort: Port;
  route: Route;
  freightForecast: FreightForecastResult;
  riskAssessment: ComprehensiveRiskAssessment;
  vesselFeasibilities: VesselFeasibilityResult[];
  recommendedVessel: Vessel;
  voyageCost: VoyageCostBreakdown;
  contractOptions: ContractOption[];
  recommendedContract: ContractOption;
  marketEntryTiming: MarketEntryTiming;
  alternativePorts: AlternativePortOption[];
  digitalTwin: DigitalTwinSimulation;
  explanation: {
    summary: string;
    whyThisRecommendation: string[];
    whatCouldChangeThis: string[];
    quantifiedTradeoffs: { metric: string; chosen: string; runnerUp: string; delta: string }[];
  };
  esgSummary: {
    totalCo2Tonnes: number;
    co2PerTonneCoal: number;
    eeoiRating: 'A' | 'B' | 'C' | 'D';
    carbonCostUsd: number;
    greenAlternativeReductionPct: number;
  };
  decisionId: string;
  generatedAt: string;
  auditTrail?: DecisionAuditTrail;
}

export interface DecisionAuditTrail {
  decisionId: string;
  timestamp: string;
  userRequirement: {
    commodity: CommodityType;
    cargoQuantityTonnes: number;
    numberOfVoyages: number;
    originPort: string;
    destinationPort: string;
    optimizationPreference: OptimizationPreference;
  };
  marketSnapshot: {
    bdi: number;
    bpi: number;
    vlsfoSingaporeUsd: number;
    spotRateUsdPerTonne: number;
    provenance: DataProvenanceType;
    providerNote: string;
  };
  feasibilityCheckPassed: boolean;
  recommendedVesselClass: VesselClass;
  contractEligibilityApplied: {
    spotEligible: boolean;
    shortTermEligible: boolean;
    mediumTermEligible: boolean;
    coaEligible: boolean;
  };
  competingStrategies: {
    strategy: ContractStrategy;
    title: string;
    nominalCostPerTonne: number;
    totalCostUsd: number;
    riskAdjustedCostPerTonne: number;
    optimizationScore: number;
    isEligible: boolean;
    exclusionReason?: string;
  }[];
  selectedStrategy: ContractStrategy;
  optimizationObjective: OptimizationPreference;
  mathematicalJustification: string;
  provenanceStatus: DataProvenanceType;
}

export interface MarketWatchlistItem {
  id: string;
  originPortName: string;
  originPortId: string;
  destinationPortName: string;
  destinationPortId: string;
  vesselClass: VesselClass;
  currentRateUsdPerTonne: number;
  previousRateUsdPerTonne: number;
  change7dPct: number;
  change30dPct: number;
  lastUpdated: string;
  source: string;
  status: DataProvenanceType;
  feedStatus: ProviderFeedStatus;
  alertActive?: boolean;
}

export interface ForecastVsActualRecord {
  id: string;
  forecastGeneratedAt: string;
  targetDate: string;
  routeId: string;
  routeName: string;
  vesselClass: VesselClass;
  horizonWeeks: number;
  predictedRateUsdPerTonne: number;
  actualObservedRateUsdPerTonne: number | null;
  absoluteErrorUsd: number | null;
  percentageError: number | null;
  directionalCorrectness: boolean | null;
  dataSource: string;
  dataStatus: DataProvenanceType;
  reviewNotes?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'Chartering Manager' | 'Freight Analyst' | 'Risk Officer' | 'Executive';
  organization: string;
  isGuest: boolean;
  authProvider: 'google' | 'guest';
}

export interface RealMarketObservationRecord {
  id: string;
  symbolOrCode: string;
  category: 'FREIGHT_INDEX' | 'BUNKER_FUEL' | 'COMMODITY' | 'ROUTE_ASSESSMENT';
  name: string;
  value: number;
  unit: string;
  source: string;
  sourceUrl?: string;
  provider: string;
  observedAt: string;
  retrievedAt: string;
  dataStatus: DataProvenanceType;
  isLive: boolean;
  synthetic?: boolean;
  rawPayloadSnippet?: string;
}

export interface LiveMarketIntelligenceSummary {
  bdi: MarketObservation<number>;
  bci: MarketObservation<number>;
  vlsfo: MarketObservation<number>;
  balticIndiaRoute: MarketObservation<number>;
  providerStatuses: {
    providerId: string;
    providerName: string;
    endpoint: string;
    feedStatus: ProviderFeedStatus;
    hasApiKey: boolean;
    lastObservationTime?: string;
    statusDetail: string;
  }[];
  realObservationsCount: number;
  historicalCoverageStatus: 'UNAVAILABLE' | 'PARTIAL' | 'SUFFICIENT_FOR_TRAINING';
}

export interface BalticExchangeTestDiagnostic {
  endpoint: string;
  authenticationSucceeded: boolean;
  httpStatus: number;
  returnedDataType: string;
  timestamp: string;
  source: string;
  provider: string;
  dataStatus: DataProvenanceType;
  isLive: boolean;
  canBeClassifiedAsRealLive: boolean;
  rawResponseSnippet?: string;
  detailMessage: string;
  hasApiKeyConfigured: boolean;
  apiKeyMasked?: string;
  observation: MarketObservation<number>;
}

export interface RouteFreightObservationRecord {
  id?: string;
  date: string; // YYYY-MM-DD
  provider: string; // e.g. "Baltic Exchange Direct API"
  routeCode: string; // e.g. "C18", "P9", "C5_AU_CN"
  origin: string; // e.g. "Gladstone"
  destination: string; // e.g. "Dhamra"
  vesselClass: VesselClass; // "Capesize" | "Panamax"
  cargoType: string; // e.g. "Coal"
  cargoVolumeMt: number; // e.g. 150000 or 80000
  freightRateUsdPerMt: number | null; // USD/MT route fixture assessment
  currency: string; // "USD"
  sourceUrl: string;
  observedAt: string; // ISO 8601
  retrievedAt: string; // ISO 8601
  dataStatus: DataProvenanceType; // 'REAL' | 'STALE' | 'UNAVAILABLE' | 'SIMULATED'
  isLive: boolean;
  synthetic: boolean;
  provenance: DataProvenanceType;
  errorMessage?: string;
  rawPayloadSnippet?: string;
}

export interface BalticRouteSpecification {
  routeCode: 'C18' | 'P9' | 'C5_AU_CN';
  feedId: string;
  title: string;
  origin: string;
  destination: string;
  originPortId: string;
  destinationPortId: string;
  vesselClass: VesselClass;
  cargoType: string;
  cargoVolumeMt: number;
  cargoTolerancePct: number;
  terms: string;
  loadingTerms: string;
  dischargeTerms: string;
  turnTimeHours: { load: number; discharge: number };
  maxVesselAgeYears: number;
  commissionPct: number;
  currency: string;
  rateUnit: string;
  trialStartDate: string;
  livePublicationDate: string;
  endpointUrl: string;
}

export interface IRouteFreightObservationRepository {
  save(record: RouteFreightObservationRecord): Promise<void>;
  saveBatch(records: RouteFreightObservationRecord[]): Promise<{ savedCount: number; rejectedCount: number }>;
  getAll(): Promise<RouteFreightObservationRecord[]>;
  getByRoute(routeCode: string): Promise<RouteFreightObservationRecord[]>;
  getLatestByRoute(routeCode: string): Promise<RouteFreightObservationRecord | null>;
  getCount(routeCode?: string): Promise<number>;
  getDateRange(routeCode: string, fromDate?: string, toDate?: string): Promise<RouteFreightObservationRecord[]>;
}


