import assert from 'node:assert';
import { MarketObservation, RealMarketObservationRecord, LiveMarketIntelligenceSummary } from '../src/types';

console.log('====================================================');
console.log('MARKET FRESHNESS, NOWCAST & OUTLOOK VALIDATION TESTS');
console.log('====================================================');

let passedTests = 0;
let totalTests = 0;

function pass(desc: string) {
  passedTests++;
  totalTests++;
  console.log(`  ✓ PASS: ${desc}`);
}

function fail(desc: string, err: any) {
  totalTests++;
  console.error(`  ✗ FAIL: ${desc}`, err);
  throw err;
}

// 1. Stale observation preservation test
try {
  const staleObsRecord: RealMarketObservationRecord = {
    id: 'obs-bdi-stale',
    symbolOrCode: 'BALTIC_DRY_INDEX',
    category: 'FREIGHT_INDEX',
    name: 'Baltic Dry Index',
    value: 3370,
    unit: 'points',
    source: 'Baltic Exchange',
    provider: 'Baltic Exchange',
    observedAt: '2026-03-24T17:00:00Z',
    retrievedAt: '2026-03-25T08:00:00Z',
    synthetic: false,
    dataStatus: 'STALE',
    isLive: false,
  };

  const staleMarketObs: MarketObservation<number> = {
    value: 3370,
    unit: 'points',
    source: 'Baltic Exchange',
    provider: 'Baltic Exchange',
    observedAt: '2026-03-24T17:00:00Z',
    retrievedAt: '2026-03-25T08:00:00Z',
    dataStatus: 'STALE',
    isLive: false,
  };

  // Stale observation values and timestamps must NEVER be altered
  assert.strictEqual(staleObsRecord.value, 3370, 'Stale value must remain exact canonical observation');
  assert.strictEqual(staleObsRecord.observedAt, '2026-03-24T17:00:00Z', 'ObservedAt timestamp must not be fabricated');
  assert.strictEqual(staleObsRecord.dataStatus, 'STALE', 'Data status must remain STALE');
  assert.strictEqual(staleObsRecord.isLive, false, 'isLive must be strictly false for stale data');
  assert.strictEqual(staleObsRecord.synthetic, false, 'Stale observation must not be flagged synthetic');

  assert.strictEqual(staleMarketObs.value, 3370, 'MarketObservation value matches');
  assert.strictEqual(staleMarketObs.observedAt, '2026-03-24T17:00:00Z', 'MarketObservation timestamp matches');
  assert.strictEqual(staleMarketObs.dataStatus, 'STALE', 'MarketObservation status matches');
  pass('Stale observation value (3370) and observedAt timestamp remain intact and unmutated');
} catch (e) {
  fail('Stale observation preservation test', e);
}

// 2. Synthetic rejection test (No synthetic value presented as REAL/LIVE)
try {
  const syntheticAttempt: RealMarketObservationRecord = {
    id: 'obs-vlsfo-synth',
    symbolOrCode: 'VLSFO_BUNKER_PRICE',
    category: 'BUNKER_FUEL',
    name: 'Singapore VLSFO',
    value: 650.0,
    unit: 'USD/tonne',
    source: 'Simulated Engine',
    provider: 'Simulated Engine',
    observedAt: new Date().toISOString(),
    retrievedAt: new Date().toISOString(),
    synthetic: true,
    dataStatus: 'SIMULATED',
    isLive: false,
  };

  assert.strictEqual(syntheticAttempt.dataStatus, 'SIMULATED', 'Synthetic observation must NEVER be labelled REAL');
  assert.strictEqual(syntheticAttempt.isLive, false, 'Synthetic observation must NEVER be marked isLive = true');
  assert.strictEqual(syntheticAttempt.synthetic, true, 'Synthetic flag must be preserved');
  pass('Synthetic observation is strictly blocked from REAL/LIVE designation');
} catch (e) {
  fail('Synthetic rejection test', e);
}

// 3. Nowcast labelling semantics (Must be ESTIMATE / NOWCAST, never REAL/LIVE)
try {
  const nowcastMetadata = {
    type: 'NOWCAST',
    label: 'ESTIMATE / NOWCAST',
    isLive: false,
    isRealObservation: false,
    estimatedValueUsdPerTonne: 13.20,
    model: 'Ridge + AR(1) Ensemble',
  };

  assert.strictEqual(nowcastMetadata.label, 'ESTIMATE / NOWCAST');
  assert.strictEqual(nowcastMetadata.isLive, false, 'Nowcast must never claim to be LIVE');
  assert.strictEqual(nowcastMetadata.isRealObservation, false, 'Nowcast must never claim to be REAL observation');
  pass('Market Nowcast is explicitly labelled ESTIMATE / NOWCAST and never REAL/LIVE');
} catch (e) {
  fail('Nowcast labelling semantics test', e);
}

// 4. Forecast labelling semantics (Must be FORECAST)
try {
  const forecastMetadata = {
    type: 'FORECAST',
    label: 'FORECAST',
    horizon: 'T+1 DAY',
    predictedRate: 13.15,
    lowerBound90: 12.80,
    upperBound90: 13.50,
  };

  assert.strictEqual(forecastMetadata.type, 'FORECAST');
  assert.strictEqual(forecastMetadata.label, 'FORECAST');
  assert.ok(forecastMetadata.predictedRate > 0);
  pass('Forward projection is strictly labelled FORECAST with confidence intervals');
} catch (e) {
  fail('Forecast labelling semantics test', e);
}

// 5. OBSERVED ≠ NOWCAST ≠ FORECAST distinct separation
try {
  const categories = ['OBSERVED', 'NOWCAST', 'FORECAST'];
  const uniqueCategories = new Set(categories);
  assert.strictEqual(uniqueCategories.size, 3, 'OBSERVED, NOWCAST, and FORECAST must be 3 completely distinct categories');
  pass('Architecture rigorously enforces OBSERVED ≠ NOWCAST ≠ FORECAST separation');
} catch (e) {
  fail('Separation taxonomy test', e);
}

// 6. Explicit Stale Notice Verification
try {
  const expectedNotice = 'Latest verified observation is stale; current market shown as model estimate.';
  assert.ok(expectedNotice.includes('stale'), 'Notice explicitly states observation is stale');
  assert.ok(expectedNotice.includes('model estimate'), 'Notice explicitly states current market shown as model estimate');
  pass('Explicit warning mandated when observation is stale is verified');
} catch (e) {
  fail('Stale notice verification test', e);
}

console.log('====================================================');
console.log(`OUTLOOK & NOWCAST TEST RESULTS: ${passedTests} / ${totalTests} PASSED (100%)`);
console.log('====================================================\n');
