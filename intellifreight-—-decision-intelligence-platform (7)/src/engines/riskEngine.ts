import {
  ComprehensiveRiskAssessment,
  Port,
  Route,
  Vessel,
  FreightForecastResult,
  RiskLevel,
} from '../types';

export function calculateComprehensiveRisk(
  forecast: FreightForecastResult,
  originPort: Port,
  destinationPort: Port,
  route: Route,
  vessel: Vessel
): ComprehensiveRiskAssessment {
  // 1. Market Risk (Weight: 30%)
  const volFactor = Math.min(100, forecast.volatilityAnnualizedPct * 2.2);
  const trendUncertainty = Math.abs(forecast.expectedChangePct4Weeks) * 1.5;
  const marketScore = Math.min(100, Math.round(volFactor * 0.6 + trendUncertainty * 0.4));
  const marketLevel = getRiskLevel(marketScore);
  const marketFactors = [
    `Annualized freight volatility at ${forecast.volatilityAnnualizedPct}%`,
    `4-week forward freight trend: ${forecast.trend.replace('_', ' ')} (${forecast.expectedChangePct4Weeks > 0 ? '+' : ''}${forecast.expectedChangePct4Weeks}%)`,
    `Prediction 95% confidence interval width: ±$${((forecast.forecastSeries[3]?.upperBound95 - forecast.forecastSeries[3]?.lowerBound95) / 2 || 2.5).toFixed(2)}/t`,
  ];

  // 2. Port Risk (Weight: 30%)
  const destCongestion = destinationPort.congestionScore;
  const destWaiting = destinationPort.averageWaitingDays * 12; // e.g. 2 days = 24
  const portScore = Math.min(100, Math.round(destCongestion * 0.65 + destWaiting * 0.35));
  const portLevel = getRiskLevel(portScore);
  const portFactors = [
    `${destinationPort.name} current congestion index: ${destinationPort.congestionScore}/100`,
    `Current queue: ${destinationPort.waitingVesselsCount} vessels at anchor (${destinationPort.averageWaitingDays} days estimated wait)`,
    `Tidal restriction: ${destinationPort.tidalRestrictions}`,
  ];

  // 3. Weather & Route Risk (Weight: 20%)
  const weatherScore = Math.min(100, Math.round(route.weatherRiskRating * 9.5));
  const weatherLevel = getRiskLevel(weatherScore);
  const weatherFactors = [
    `Bay of Bengal / Indian Ocean navigation sector rating: ${route.weatherRiskRating}/10`,
    `Choke point transits: ${route.canalChokePoints.join(', ')}`,
    `Monsoon wave swell factor: Seasonal moderate swell expected`,
  ];

  // 4. Operational Risk (Weight: 20%)
  const draftMargin = destinationPort.maxDraft - vessel.draft;
  let draftRisk = 15;
  if (draftMargin < 0.5) draftRisk = 85;
  else if (draftMargin < 1.0) draftRisk = 55;
  else if (draftMargin < 2.0) draftRisk = 30;

  const operationalScore = Math.min(100, Math.round(draftRisk * 0.7 + (vessel.dwt > 150000 ? 25 : 10)));
  const operationalLevel = getRiskLevel(operationalScore);
  const operationalFactors = [
    `Draft clearance under keel: ${draftMargin.toFixed(1)}m at ${destinationPort.name}`,
    `Daily discharge capability: ${destinationPort.cargoHandlingRateTpd.toLocaleString()} tonnes/day`,
    `Vessel age: ${2026 - vessel.yearBuilt} years (${vessel.flag} flag)`,
  ];

  // Weighted overall risk score (0-100)
  const overallScore = Math.round(
    marketScore * 0.30 +
    portScore * 0.30 +
    weatherScore * 0.20 +
    operationalScore * 0.20
  );
  const overallLevel = getRiskLevel(overallScore);

  // Mitigation actions
  const mitigationActions: string[] = [];
  if (marketScore > 45) {
    mitigationActions.push(
      'Hedge forward freight exposure by locking a 3–6 voyage short-term contract to cap upside volatility.'
    );
  }
  if (portScore > 50) {
    mitigationActions.push(
      `Incorporate a 72-hour reversible laytime clause or pre-clearance berthing protocol at ${destinationPort.name} to avoid demurrage spikes.`
    );
  }
  if (operationalScore > 50) {
    mitigationActions.push(
      `Plan arrival during high spring tide window at ${destinationPort.name} or ensure dual-berth draft compliance.`
    );
  }
  if (mitigationActions.length === 0) {
    mitigationActions.push(
      'Standard voyage charter terms with standard laytime and demurrage benchmarks are sufficient.'
    );
  }

  const portDimension = {
    name: 'Port Congestion & Demurrage Exposure',
    score: portScore,
    level: portLevel,
    factors: portFactors,
    weight: 0.30,
    summary: `Congestion risk at ${destinationPort.name} evaluated at ${portScore}/100 with an average waiting queue of ${destinationPort.averageWaitingDays} days across ${destinationPort.waitingVesselsCount} vessels.`,
    mitigation: portScore > 50
      ? `Incorporate a 72-hour reversible laytime clause or pre-clearance berthing protocol at ${destinationPort.name} to mitigate demurrage.`
      : 'Standard laytime and demurrage terms ($24,000/day benchmark) provide adequate coverage.',
  };

  const contractLockInScore = Math.min(100, Math.round(marketScore * 0.45 + 18));
  const counterpartyScore = Math.min(100, Math.round(vessel.yearBuilt < 2012 ? 38 : 18));

  return {
    overallScore,
    overallLevel,
    marketRisk: {
      name: 'Freight Rate Volatility & Market Risk',
      score: marketScore,
      level: marketLevel,
      factors: marketFactors,
      weight: 0.30,
      summary: `Market freight risk evaluated at ${marketScore}/100 (${marketLevel}) with ${forecast.volatilityAnnualizedPct}% annualized volatility and forward 4-week trend of ${forecast.expectedChangePct4Weeks > 0 ? '+' : ''}${forecast.expectedChangePct4Weeks}%.`,
      mitigation: marketScore > 45
        ? 'Lock in a fixed-rate medium-term contract or COA to insulate landed cost against upward rate surges.'
        : 'Maintain spot or short-term chartering flexibility while monitoring Baltic indices weekly.',
    },
    portRisk: portDimension,
    portCongestionRisk: portDimension,
    weatherRisk: {
      name: 'Weather, Cyclone & Sea State Risk',
      score: weatherScore,
      level: weatherLevel,
      factors: weatherFactors,
      weight: 0.20,
      summary: `Ocean passage weather risk scored at ${weatherScore}/100 based on sector rating (${route.weatherRiskRating}/10) along ${route.originName} to ${route.destinationName}.`,
      mitigation: weatherScore > 45
        ? 'Contract professional weather routing services (e.g. StormGeo/AWT) to optimize speed and route deviation windows.'
        : 'Standard seasonal navigation margins are sufficient with standard bunker reserve allocations.',
    },
    operationalRisk: {
      name: 'Operational & Physical Feasibility Risk',
      score: operationalScore,
      level: operationalLevel,
      factors: operationalFactors,
      weight: 0.20,
      summary: `Operational feasibility scored at ${operationalScore}/100 with ${draftMargin.toFixed(1)}m under-keel clearance and handling capability at ${destinationPort.cargoHandlingRateTpd.toLocaleString()} MT/day.`,
      mitigation: operationalScore > 50
        ? `Schedule arrival during high spring tide at ${destinationPort.name} or confirm dual-berth draft compatibility prior to loading.`
        : 'Operational berth compatibility and discharging throughput satisfy standard turnaround requirements.',
    },
    contractLockInRisk: {
      name: 'Contract Lock-In & Inflexibility Risk',
      score: contractLockInScore,
      level: getRiskLevel(contractLockInScore),
      factors: [
        'Contract duration commitment vs spot liquidity opportunity cost',
        'Bunker price fluctuation exposure without index-linked adjustment',
        'Laycan window renegotiation penalties within standard charter parties',
      ],
      weight: 0.10,
      summary: 'Evaluates the financial exposure of fixing capacity in a volatile market versus remaining unhedged on spot.',
      mitigation: 'Include standard BIMCO bunker adjustment clauses and negotiated laycan ±5-day rescheduling flexibility.',
    },
    counterpartyRisk: {
      name: 'Counterparty & Shipowner Performance Risk',
      score: counterpartyScore,
      level: getRiskLevel(counterpartyScore),
      factors: [
        `Vessel specifications: ${vessel.vesselClass} (${vessel.flag} flag)`,
        `Vessel built: ${vessel.yearBuilt} (${2026 - vessel.yearBuilt} years old)`,
        'RightShip safety rating verification and international P&I club membership',
      ],
      weight: 0.10,
      summary: 'Assesses shipowner operational reliability, vessel age, technical maintenance history, and vetting standards.',
      mitigation: 'Mandate minimum RightShip 4-star safety score and first-tier International Group P&I Club coverage.',
    },
    mitigationActions,
  };
}

function getRiskLevel(score: number): RiskLevel {
  if (score < 30) return 'LOW';
  if (score < 55) return 'MEDIUM';
  if (score < 75) return 'HIGH';
  return 'CRITICAL';
}
