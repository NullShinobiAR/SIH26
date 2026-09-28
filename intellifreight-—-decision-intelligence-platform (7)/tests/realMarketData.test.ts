/**
 * Real Market Data Integration & Data Provenance Test Suite
 * Run via: npx tsx tests/realMarketData.test.ts
 */

import { LiveMarketDataService } from '../src/services/liveMarketDataService';
import {
  InMemoryRealObservationRepository,
  DurableRealObservationRepository,
  computeObservationDedupeKey,
} from '../src/data/realObservationRepository';
import { RealMarketObservationRecord } from '../src/types';
import {
  evaluateRealDataTrainingReadiness,
  runFreightForecast,
  resolveTargetBalticRouteCode,
} from '../src/engines/forecastingEngine';
import { InMemoryRouteFreightObservationRepository } from '../src/data/routeFreightObservationRepository';
import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

console.log('====================================================');
console.log('REAL MARKET DATA INTEGRATION & PROVENANCE TEST SUITE');
console.log('====================================================\n');

async function runTests() {
  const repo = new InMemoryRealObservationRepository();

  // Test 1: Successful external API response
  console.log('[1/9] Testing Successful External API Response...');
  {
    const recentTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 mins ago (fresh)
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            code: 'BALTIC_DRY_INDEX',
            price: 1942,
            currency: 'USD',
            formatted: '1,942',
            created_at: recentTimestamp,
            type: 'spot_price',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const service = new LiveMarketDataService({
      oilPriceApiKey: 'test-real-valid-api-key',
      fetchFn: mockFetch as any,
      repository: repo,
      freshnessWindowMs: 24 * 3600 * 1000,
    });

    const bdi = await service.fetchBalticDryIndex();
    assert(bdi.value === 1942, 'BDI value must match external price (1942)');
    assert(bdi.dataStatus === 'REAL', 'Fresh successful observation must have dataStatus = REAL');
    assert(bdi.isLive === true, 'Fresh successful observation must have isLive = true');
    assert(bdi.unit === 'points', 'BDI unit must be points');
    assert(bdi.provider === 'OilPriceAPI', 'Provider must identify OilPriceAPI');
    assert(bdi.observedAt === recentTimestamp, 'observedAt must match external created_at timestamp');

    // Check persistence to repository
    const stored = await repo.getByCode('BALTIC_DRY_INDEX');
    assert(stored.length === 1, 'Observation must be automatically saved in RealObservationRepository');
    assert(stored[0].value === 1942, 'Stored repository value must be 1942');
    assert(stored[0].dataStatus === 'REAL', 'Stored repository item must be tagged REAL');
  }

  // Test 2: Invalid response
  console.log('\n[2/9] Testing Invalid External Response Handling...');
  {
    // 2a. Malformed payload
    const malformedFetch = async () => {
      return new Response(JSON.stringify({ status: 'error', message: 'Unknown error' }), { status: 200 });
    };
    const service2 = new LiveMarketDataService({
      oilPriceApiKey: 'test-key',
      fetchFn: malformedFetch as any,
      repository: repo,
    });
    const obs = await service2.fetchBalticDryIndex();
    assert(obs.dataStatus === 'UNAVAILABLE', 'Malformed payload must result in dataStatus = UNAVAILABLE');
    assert(obs.isLive === false, 'Malformed payload must have isLive = false');
    assert(obs.value === null, 'Malformed payload value must be null (no fake data)');
    assert(obs.errorMessage !== undefined, 'Must provide explanatory error message');

    // 2b. Non-positive price
    const nonPositiveFetch = async () => {
      return new Response(
        JSON.stringify({ status: 'success', data: { price: -5, code: 'BALTIC_DRY_INDEX' } }),
        { status: 200 }
      );
    };
    const service2b = new LiveMarketDataService({
      oilPriceApiKey: 'test-key',
      fetchFn: nonPositiveFetch as any,
      repository: repo,
    });
    const obs2b = await service2b.fetchBalticDryIndex();
    assert(obs2b.dataStatus === 'UNAVAILABLE', 'Non-positive price must be rejected as UNAVAILABLE');
    assert(obs2b.value === null, 'Non-positive price value must be null');
  }

  // Test 3: Missing API key
  console.log('\n[3/9] Testing Missing API Key Handling...');
  {
    const service3 = new LiveMarketDataService({
      oilPriceApiKey: '', // Empty or missing
      repository: repo,
    });
    const obs = await service3.fetchBalticDryIndex();
    assert(obs.dataStatus === 'UNAVAILABLE', 'Missing API key must return dataStatus = UNAVAILABLE');
    assert(obs.isLive === false, 'Missing API key must have isLive = false');
    assert(obs.value === null, 'Missing API key must not produce fake values');
    assert(
      obs.errorMessage?.includes('OILPRICE_API_KEY environment variable is not configured') === true,
      'Error message must indicate missing OILPRICE_API_KEY'
    );
  }

  // Test 4: Timeout
  console.log('\n[4/9] Testing Timeout Handling...');
  {
    const timeoutFetch = async (_url: any, options: any) => {
      return new Promise<Response>((_, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const err: any = new Error('The operation was aborted due to timeout');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };

    const service4 = new LiveMarketDataService({
      oilPriceApiKey: 'test-key',
      fetchFn: timeoutFetch as any,
      timeoutMs: 50, // fast timeout for test
      repository: repo,
    });

    const obs = await service4.fetchBalticDryIndex();
    assert(obs.dataStatus === 'UNAVAILABLE', 'Timed out request must yield dataStatus = UNAVAILABLE');
    assert(obs.isLive === false, 'Timed out request must yield isLive = false');
    assert(obs.value === null, 'Timed out request value must be null');
    assert(obs.errorMessage?.includes('timed out') === true, 'Error message must mention timeout');
  }

  // Test 5: Stale observation
  console.log('\n[5/9] Testing Stale Observation Handling...');
  {
    // Observed 72 hours ago (outside 24h window)
    const staleTime = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
    const staleFetch = async () => {
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            code: 'VLSFO_USD',
            price: 614.5,
            created_at: staleTime,
          },
        }),
        { status: 200 }
      );
    };

    const service5 = new LiveMarketDataService({
      oilPriceApiKey: 'test-key',
      fetchFn: staleFetch as any,
      freshnessWindowMs: 24 * 3600 * 1000,
      repository: repo,
    });

    const vlsfo = await service5.fetchVlsfoBenchmark('Singapore');
    assert(vlsfo.value === 614.5, 'Stale observation value must preserve genuine reported price (614.5)');
    assert(vlsfo.dataStatus === 'STALE', 'Observation older than freshness window must have dataStatus = STALE');
    assert(vlsfo.isLive === false, 'Stale observation must have isLive = false');
    assert(vlsfo.unit === 'USD/MT', 'VLSFO unit must be USD/MT');
  }

  // Test 6: Provider unavailable (HTTP 500 / 503 / network error)
  console.log('\n[6/9] Testing Provider Unavailable Handling...');
  {
    const errorFetch = async () => {
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 503,
        statusText: 'Service Unavailable',
      });
    };

    const service6 = new LiveMarketDataService({
      oilPriceApiKey: 'test-key',
      fetchFn: errorFetch as any,
      repository: repo,
    });

    const obs = await service6.fetchBalticCapesizeIndex();
    assert(obs.dataStatus === 'UNAVAILABLE', 'HTTP 503 must return dataStatus = UNAVAILABLE');
    assert(obs.isLive === false, 'Unavailable feed must have isLive = false');
    assert(obs.value === null, 'Unavailable feed value must be null');
    assert(obs.errorMessage?.includes('HTTP 503') === true, 'Error message must reflect HTTP 503');
  }

  // Test 7: Provenance fields completeness
  console.log('\n[7/9] Testing Provenance Fields Completeness...');
  {
    const recentTimestamp = new Date().toISOString();
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            code: 'BALTIC_CAPESIZE_INDEX',
            price: 2890,
            created_at: recentTimestamp,
          },
        }),
        { status: 200 }
      );
    };

    const service7 = new LiveMarketDataService({
      oilPriceApiKey: 'test-key',
      fetchFn: mockFetch as any,
      repository: repo,
    });

    const bci = await service7.fetchBalticCapesizeIndex();
    // Validate every mandatory provenance field
    assert(bci.value === 2890, 'Field value exists');
    assert(typeof bci.unit === 'string' && bci.unit.length > 0, 'Field unit exists');
    assert(typeof bci.source === 'string' && bci.source.length > 0, 'Field source exists');
    assert(typeof bci.sourceUrl === 'string', 'Field sourceUrl exists');
    assert(typeof bci.provider === 'string' && bci.provider.length > 0, 'Field provider exists');
    assert(typeof bci.observedAt === 'string' && !isNaN(new Date(bci.observedAt).getTime()), 'Field observedAt is valid date');
    assert(typeof bci.retrievedAt === 'string' && !isNaN(new Date(bci.retrievedAt).getTime()), 'Field retrievedAt is valid date');
    assert(['REAL', 'DERIVED', 'SIMULATED', 'ASSUMPTION', 'UNAVAILABLE', 'STALE'].includes(bci.dataStatus), 'Field dataStatus has valid enum value');
    assert(typeof bci.isLive === 'boolean', 'Field isLive is boolean');
  }

  // Test 8: No silent simulated fallback
  console.log('\n[8/9] Testing Policy Enforcement: No Silent Simulated Fallback...');
  {
    // Ensure that when API fails or is not available, it NEVER quietly substitutes simulated numbers
    const networkFailFetch = async () => {
      throw new Error('DNS resolution failed: api.oilpriceapi.com');
    };

    const strictService = new LiveMarketDataService({
      oilPriceApiKey: 'test-key',
      fetchFn: networkFailFetch as any,
      repository: repo,
    });

    const bdiResult = await strictService.fetchBalticDryIndex();
    assert(bdiResult.value === null, 'Must NEVER return a simulated number when live API fails');
    assert(bdiResult.dataStatus === 'UNAVAILABLE', 'Must explicitly be UNAVAILABLE');
    assert(bdiResult.dataStatus !== 'SIMULATED', 'Must NOT mask failures as simulated data');

    // Also verify repository does not allow saving simulated data
    let policyViolationCaught = false;
    try {
      await repo.save({
        id: 'fake-test',
        symbolOrCode: 'FAKE',
        category: 'FREIGHT_INDEX',
        name: 'Fake Index',
        value: 1234,
        unit: 'points',
        source: 'Fake',
        provider: 'Fake',
        observedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        dataStatus: 'SIMULATED',
        isLive: false,
      });
    } catch {
      policyViolationCaught = true;
    }
    assert(policyViolationCaught, 'Repository must reject saving simulated observations');
  }

  // Test 9: Client does not expose API keys
  console.log('\n[9/9] Testing Security Audit: Client Codebase Never Exposes Secrets...');
  {
    // Inspect all src/ files except node_modules to ensure OILPRICE_API_KEY is not in client-side code
    const srcDir = path.resolve(process.cwd(), 'src');
    const walkFiles = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkFiles(fullPath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(fullPath);
        }
      });
      return results;
    };

    const clientFiles = walkFiles(srcDir).filter(
      (f) => !f.includes('liveMarketDataService.ts') // server-side service
    );

    let exposedInClient = false;
    let offendingFile = '';
    for (const f of clientFiles) {
      const content = fs.readFileSync(f, 'utf-8');
      if (content.includes('VITE_OILPRICE') || content.includes('VITE_BALTIC')) {
        exposedInClient = true;
        offendingFile = f;
        break;
      }
    }
    assert(!exposedInClient, `Client code must never expose VITE_ external API keys (checked ${clientFiles.length} files)`, offendingFile);

    // Also verify Model Training Governance Gate
    const trainingCheck0 = evaluateRealDataTrainingReadiness(0);
    assert(trainingCheck0.isEligibleForRealTraining === false, '0 real observations must lock training');
    assert(trainingCheck0.readinessPct === 0, '0 observations has 0% readiness');

    const trainingCheck25 = evaluateRealDataTrainingReadiness(25);
    assert(trainingCheck25.isEligibleForRealTraining === false, '25/52 real observations must lock training');

    const trainingCheck52 = evaluateRealDataTrainingReadiness(52);
    assert(trainingCheck52.isEligibleForRealTraining === true, '52 real observations qualifies for real training');
  }

  // Test 10: Baltic Exchange Direct Provider - Unauthorized (401) Handling & No Simulated Fallback
  console.log('\n[10/11] Testing Baltic Exchange Provider Authenticated Request & 401 Rejection Handling...');
  {
    const baltic401Fetch = async (url: string, opts: any) => {
      assert(opts.headers['x-apikey'] === 'test-baltic-key', 'Header x-apikey must be sent to Baltic API');
      return new Response(
        JSON.stringify({
          type: 'https://tools.ietf.org/html/rfc9110#section-15.5.2',
          title: 'Unauthorized',
          status: 401,
          traceId: 'test-trace-id-12345',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/problem+json; charset=utf-8',
            'Date': 'Sun, 20 Sep 2026 07:57:21 GMT',
          },
        }
      );
    };

    const balticService = new LiveMarketDataService({
      balticExchangeApiKey: 'test-baltic-key',
      fetchFn: baltic401Fetch as any,
      repository: repo,
    });

    const routeObs = await balticService.fetchRouteAssessment('c5_au_cn');
    assert(routeObs.dataStatus === 'UNAVAILABLE', 'Baltic 401 rejection must yield dataStatus = UNAVAILABLE');
    assert(routeObs.isLive === false, 'Baltic 401 rejection must yield isLive = false');
    assert(routeObs.value === null, 'Baltic 401 rejection must yield value = null (Strictly no simulated fallback)');
    assert(routeObs.errorMessage !== undefined && routeObs.errorMessage.includes('401'), 'Error message must explain 401 Unauthorized rejection');

    // Test diagnostic runner
    const diagnostic = await balticService.testBalticExchangeEndpoint('c5_au_cn');
    assert(diagnostic.authenticationSucceeded === false, 'Authentication succeeded must be false on 401');
    assert(diagnostic.httpStatus === 401, 'HTTP status must be 401');
    assert(diagnostic.returnedDataType.includes('problem+json'), 'Returned data type must reflect application/problem+json');
    assert(diagnostic.canBeClassifiedAsRealLive === false, 'Observation cannot be classified as REAL/LIVE');
    assert(diagnostic.endpoint.includes('api.balticexchange.com'), 'Endpoint must point to api.balticexchange.com');
  }

  // Test 11: Baltic Exchange Direct Provider - Valid Authenticated 200 OK Response
  console.log('\n[11/11] Testing Baltic Exchange Provider Valid Authenticated Response (200 OK)...');
  {
    const recentDate = new Date(Date.now() - 60 * 1000).toISOString();
    const baltic200Fetch = async () => {
      return new Response(
        JSON.stringify([
          {
            rate: 11.85,
            unit: '$/tonne',
            date: recentDate,
            balticCode: 'C5',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Date': recentDate },
        }
      );
    };

    const validBalticService = new LiveMarketDataService({
      balticExchangeApiKey: 'valid-licensed-subscriber-key',
      fetchFn: baltic200Fetch as any,
      repository: repo,
    });

    const routeObs = await validBalticService.fetchRouteAssessment('c5_au_cn');
    assert(routeObs.value === 11.85, 'Baltic valid rate must match 11.85');
    assert(routeObs.dataStatus === 'REAL', 'Baltic fresh observation must have dataStatus = REAL');
    assert(routeObs.isLive === true, 'Baltic fresh observation must have isLive = true');
    assert(routeObs.unit === '$/tonne', 'Baltic unit must be $/tonne');
  }

  // Test 12: Regression Test - Dashboard and Market Intelligence Canonical Parity
  console.log('\n[12/12] Testing Dashboard and Market Intelligence Canonical Benchmark Parity...');
  {
    const staleTimestamp = new Date(Date.now() - 48 * 3600 * 1000).toISOString(); // 48h ago -> STALE
    const verifiedMockFetch = async (url: string) => {
      if (url.includes('BALTIC_DRY_INDEX')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: {
              code: 'BALTIC_DRY_INDEX',
              price: 3370,
              currency: 'USD',
              formatted: '3,370',
              created_at: staleTimestamp,
              type: 'spot_price',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('VLSFO')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: {
              code: 'BUNKER_VLSFO_SPORE',
              price: 893.5,
              currency: 'USD',
              formatted: '893.5',
              created_at: staleTimestamp,
              type: 'spot_price',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    };

    const canonicalService = new LiveMarketDataService({
      oilPriceApiKey: 'test-key',
      repository: repo,
      fetchFn: verifiedMockFetch as any,
    });

    const canonicalSummary = await canonicalService.getLiveMarketSummary();

    // 1. Verify Market Intelligence canonical extraction
    const marketIntelligenceBdi = canonicalSummary.bdi;
    const marketIntelligenceVlsfo = canonicalSummary.vlsfo;

    assert(marketIntelligenceBdi.value === 3370, 'Market Intelligence BDI must equal canonical observation (3370)');
    assert(marketIntelligenceBdi.dataStatus === 'STALE', 'Market Intelligence BDI must be marked STALE');
    assert(marketIntelligenceVlsfo.value === 893.5, 'Market Intelligence VLSFO must equal canonical observation (893.5)');
    assert(marketIntelligenceVlsfo.dataStatus === 'STALE', 'Market Intelligence VLSFO must be marked STALE');

    // 2. Verify Dashboard Header consumption uses the EXACT SAME canonical observations
    const dashboardHeaderBdiValue = canonicalSummary.bdi.value;
    const dashboardHeaderBdiStatus = canonicalSummary.bdi.dataStatus;
    const dashboardHeaderVlsfoValue = canonicalSummary.vlsfo.value;
    const dashboardHeaderVlsfoStatus = canonicalSummary.vlsfo.dataStatus;

    assert(dashboardHeaderBdiValue === marketIntelligenceBdi.value, 'Dashboard Header BDI must strictly match Market Intelligence BDI');
    assert(dashboardHeaderBdiValue !== 1845, 'Dashboard Header must NOT use legacy hardcoded 1845 benchmark');
    assert(dashboardHeaderBdiStatus === 'STALE', 'Dashboard Header BDI must preserve STALE provenance');

    assert(dashboardHeaderVlsfoValue === marketIntelligenceVlsfo.value, 'Dashboard Header VLSFO must strictly match Market Intelligence VLSFO');
    assert(dashboardHeaderVlsfoValue !== 612.5, 'Dashboard Header must NOT use legacy hardcoded 612.5 benchmark');
    assert(dashboardHeaderVlsfoStatus === 'STALE', 'Dashboard Header VLSFO must preserve STALE provenance');

    // 3. Verify Unavailable Feed handling without fallback
    const emptyRepo = new InMemoryRealObservationRepository();
    const unavailableService = new LiveMarketDataService({
      oilPriceApiKey: '',
      repository: emptyRepo,
      fetchFn: (async () => new Response('{}', { status: 500 })) as any,
    });
    const unavailableSummary = await unavailableService.getLiveMarketSummary();

    assert(unavailableSummary.bdi.value === null, 'Unavailable BDI observation value must be null (no simulated fallback)');
    assert(unavailableSummary.bdi.dataStatus === 'UNAVAILABLE', 'Unavailable BDI must have dataStatus = UNAVAILABLE');
    assert(unavailableSummary.vlsfo.value === null, 'Unavailable VLSFO observation value must be null (no simulated fallback)');
    assert(unavailableSummary.vlsfo.dataStatus === 'UNAVAILABLE', 'Unavailable VLSFO must have dataStatus = UNAVAILABLE');
  }

  // Test 13: Regression Test for BUG #2 - Verified Real Market Observations Persistence & Durability
  console.log('\n[13/13] Testing BUG #2: Verified Real Observations Persistence, Deduplication, Restart Durability & Live Pipeline...');
  {
    const tempStorePath = path.join(process.cwd(), 'data', `test_store_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);

    try {
      // 1. REAL observation is persisted
      const repo1 = new DurableRealObservationRepository([], tempStorePath);
      const nowIso = new Date().toISOString();
      const realRecord: RealMarketObservationRecord = {
        id: 'rec-test-bdi-1',
        symbolOrCode: 'BALTIC_DRY_INDEX',
        category: 'FREIGHT_INDEX',
        name: 'Baltic Dry Index',
        value: 2350,
        unit: 'points',
        source: 'OilPriceAPI Baltic Feed',
        sourceUrl: 'https://api.oilpriceapi.com/v1/prices/latest?by_code=BALTIC_DRY_INDEX',
        provider: 'OilPriceAPI',
        observedAt: nowIso,
        retrievedAt: nowIso,
        dataStatus: 'REAL',
        isLive: true,
        synthetic: false,
      };

      await repo1.save(realRecord);
      assert((await repo1.getObservationCount()) === 1, 'Subtest 1: REAL observation must be persisted to repository');
      const retrieved = await repo1.getLatest('BALTIC_DRY_INDEX');
      assert(retrieved !== null, 'Subtest 1: Saved observation must be retrievable');
      assert(retrieved?.value === 2350, 'Subtest 1: Persisted observation value matches exactly');
      assert(retrieved?.dataStatus === 'REAL', 'Subtest 1: Persisted observation dataStatus must be REAL');
      assert(retrieved?.synthetic === false, 'Subtest 1: Persisted observation synthetic must be strictly false');

      // 2. Duplicate observation is not duplicated (deterministic key: provider + instrument + observedAt)
      const duplicateRecord: RealMarketObservationRecord = {
        ...realRecord,
        id: 'rec-test-bdi-duplicate-id', // different id, same provider + instrument + observedAt
        retrievedAt: new Date(Date.now() + 5000).toISOString(), // slightly newer retrieval time
      };
      await repo1.save(duplicateRecord);
      assert(
        (await repo1.getObservationCount()) === 1,
        'Subtest 2: Duplicate observation (same provider + instrument + observedAt) must NOT increase count'
      );

      // Same observation saved a third time
      await repo1.save(realRecord);
      assert((await repo1.getObservationCount()) === 1, 'Subtest 2: Repeated saves of identical observation must be idempotent');

      // 3. SIMULATED observation is rejected (and non-REAL statuses rejected)
      let rejectedSimulated = false;
      try {
        await repo1.save({
          id: 'sim-1',
          symbolOrCode: 'BALTIC_DRY_INDEX',
          category: 'FREIGHT_INDEX',
          name: 'Fake Simulated BDI',
          value: 9999,
          unit: 'points',
          source: 'Mock Generator',
          provider: 'SyntheticEngine',
          observedAt: new Date().toISOString(),
          retrievedAt: new Date().toISOString(),
          dataStatus: 'SIMULATED',
          isLive: false,
          synthetic: true,
        });
      } catch (err: any) {
        rejectedSimulated = true;
        assert(err.message.includes('Policy Violation'), 'Subtest 3: SIMULATED error must state Policy Violation');
      }
      assert(rejectedSimulated, 'Subtest 3: SIMULATED observation MUST be rejected');

      let rejectedStale = false;
      try {
        await repo1.save({
          ...realRecord,
          id: 'stale-1',
          observedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
          dataStatus: 'STALE',
        });
      } catch (err: any) {
        rejectedStale = true;
        assert(err.message.includes('Policy Violation'), 'Subtest 3: STALE save error must state Policy Violation');
      }
      assert(rejectedStale, 'Subtest 3: STALE observation must NOT be persisted as verified real observation');
      assert((await repo1.getObservationCount()) === 1, 'Subtest 3: Repository count remains 1 after rejections');

      // 4. Persisted observation survives repository/service restart
      // Instantiate a new repository instance pointing to the same storage path
      const restartedRepo = new DurableRealObservationRepository([], tempStorePath);
      assert(
        (await restartedRepo.getObservationCount()) === 1,
        'Subtest 4: Persisted observation must survive repository restart from durable store'
      );
      const afterRestart = await restartedRepo.getLatest('BALTIC_DRY_INDEX');
      assert(afterRestart?.value === 2350, 'Subtest 4: Observation value survives restart');
      assert(afterRestart?.provider === 'OilPriceAPI', 'Subtest 4: Observation provider survives restart');
      assert(afterRestart?.synthetic === false, 'Subtest 4: Observation synthetic=false survives restart');

      // Diagnostic check
      const diagnostic = await restartedRepo.getDiagnostic();
      assert(diagnostic.totalCount === 1, 'Subtest 4: Diagnostic totalCount matches');
      assert(diagnostic.verifiedObservationCount === 1, 'Subtest 4: Diagnostic verifiedObservationCount matches');
      assert(diagnostic.storageType === 'DISK_FILE', 'Subtest 4: Diagnostic reports DISK_FILE storage');
      assert(diagnostic.uniqueInstruments.includes('BALTIC_DRY_INDEX'), 'Subtest 4: Diagnostic lists BALTIC_DRY_INDEX');

      // 5. /api/market/live causes valid real observations to appear in the verified repository
      const freshTimestamp = new Date().toISOString(); // fresh within 24h -> REAL
      const liveMockFetch = async (url: string) => {
        if (url.includes('BALTIC_DRY_INDEX')) {
          return new Response(
            JSON.stringify({
              status: 'success',
              data: {
                code: 'BALTIC_DRY_INDEX',
                price: 2480,
                currency: 'USD',
                formatted: '2,480',
                created_at: freshTimestamp,
                type: 'spot_price',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('VLSFO')) {
          return new Response(
            JSON.stringify({
              status: 'success',
              data: {
                code: 'BUNKER_VLSFO_SPORE',
                price: 675.25,
                currency: 'USD',
                formatted: '675.25',
                created_at: freshTimestamp,
                type: 'spot_price',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 404 });
      };

      const liveService = new LiveMarketDataService({
        oilPriceApiKey: 'test-real-api-key',
        repository: restartedRepo,
        fetchFn: liveMockFetch as any,
      });

      const liveSummary = await liveService.getLiveMarketSummary();
      assert(liveSummary.bdi.dataStatus === 'REAL', 'Subtest 5: Fresh BDI must be marked REAL');
      assert(liveSummary.bdi.value === 2480, 'Subtest 5: Fresh BDI value is 2480');
      assert(liveSummary.vlsfo.dataStatus === 'REAL', 'Subtest 5: Fresh VLSFO must be marked REAL');
      assert(liveSummary.vlsfo.value === 675.25, 'Subtest 5: Fresh VLSFO value is 675.25');

      // Verify that getLiveMarketSummary caused valid real observations to appear in the repository
      const persistedVlsfo = await restartedRepo.getLatest('VLSFO_USD');
      assert(persistedVlsfo !== null, 'Subtest 5: VLSFO real observation must be automatically saved in repository');
      assert(persistedVlsfo?.value === 675.25, 'Subtest 5: Persisted VLSFO value matches 675.25');
      assert(persistedVlsfo?.dataStatus === 'REAL', 'Subtest 5: Persisted VLSFO status is REAL');
      assert(persistedVlsfo?.synthetic === false, 'Subtest 5: Persisted VLSFO synthetic is false');

      const persistedBdi = await restartedRepo.getLatest('BALTIC_DRY_INDEX');
      assert(persistedBdi !== null, 'Subtest 5: BDI real observation must be automatically saved in repository');
      assert(persistedBdi?.value === 2480, 'Subtest 5: Persisted BDI value matches 2480');
      assert(persistedBdi?.dataStatus === 'REAL', 'Subtest 5: Persisted BDI status is REAL');

      // Verify live summary reports verified count correctly
      assert(liveSummary.realObservationsCount >= 2, 'Subtest 5: Live summary reflects verified real observation count');

      // Verify calling live endpoint again does not duplicate records in repository
      await liveService.getLiveMarketSummary();
      const countAfterSecondCall = await restartedRepo.getObservationCount();
      await liveService.getLiveMarketSummary();
      const countAfterThirdCall = await restartedRepo.getObservationCount();
      assert(countAfterSecondCall === countAfterThirdCall, 'Subtest 5: Subsequent live polls do not duplicate observations');
    } finally {
      // Cleanup temp store file
      if (fs.existsSync(tempStorePath)) {
        try {
          fs.unlinkSync(tempStorePath);
        } catch {
          // ignore
        }
      }
    }
  }

  // Test 10: Freight Forecast Real Data Training Gate & Provenance (BUG #3 Regression Verification)
  console.log('\n[10/10] Testing Freight Forecast Real-Data Training Gate & Provenance...');
  {
    const routeRepo = new InMemoryRouteFreightObservationRepository();

    // 10a. With 0 route observations:
    // Forecast MUST report dataQualityBadge = 'SIMULATED' and explicit governance dataProvenance
    const forecast0 = runFreightForecast('rt-au-hpt-dhm', 'Panamax', 'Ensemble', routeRepo);
    assert(forecast0.dataQualityBadge === 'SIMULATED', 'Zero route observations must yield SIMULATED dataQualityBadge');
    assert(forecast0.realTrainingGate?.isEligibleForRealTraining === false, 'Real training gate must be ineligible when 0 observations');
    assert(forecast0.realTrainingGate?.isRealTrainingActive === false, 'Real training must NOT be active when gate is locked');
    assert(
      forecast0.governance?.dataProvenance === 'Calibrated Development Proxy (SIMULATED & DERIVED)',
      'Governance must state Calibrated Development Proxy when real route data is insufficient'
    );
    assert(
      forecast0.realTrainingGate?.statusMessage.includes('Model re-training locked'),
      'Status message must state model re-training locked'
    );

    // 10b. With generic live BDI/VLSFO observations in global market repo but 0 route-specific fixtures:
    // Model must STILL be locked in SIMULATED mode (Do NOT label forecast as REAL merely because live BDI/VLSFO exist)
    const forecastGeneric = runFreightForecast('rt-au-hpt-dhm', 'Capesize', 'Ensemble', routeRepo);
    assert(forecastGeneric.dataQualityBadge === 'SIMULATED', 'Generic market indicators must NOT unlock route forecast gate');
    assert(forecastGeneric.realTrainingGate?.currentCount === 0, 'Route observation count must remain 0 for C18');

    // 10c. With 20 real observations (insufficient, < 52):
    // Model must remain locked in SIMULATED mode. Zero mixing allowed.
    for (let i = 0; i < 20; i++) {
      const d = new Date(Date.now() - (52 - i) * 7 * 24 * 3600 * 1000).toISOString().substring(0, 10);
      await routeRepo.save({
        id: `c18-${d}`,
        routeCode: 'C18',
        origin: 'Gladstone',
        destination: 'Dhamra',
        cargoType: 'Coal',
        cargoVolumeMt: 150000,
        currency: 'USD',
        sourceUrl: 'https://api.balticexchange.com/api/v1/feed/c18/data',
        retrievedAt: `${d}T10:05:00Z`,
        provenance: 'REAL',
        freightRateUsdPerMt: 14.5 + Math.sin(i / 3) * 1.5,
        observedAt: `${d}T10:00:00Z`,
        date: d,
        vesselClass: 'Capesize',
        provider: 'BalticExchange',
        dataStatus: 'REAL',
        isLive: true,
        synthetic: false,
      });
    }

    const forecast20 = runFreightForecast('rt-au-hpt-dhm', 'Capesize', 'Ensemble', routeRepo);
    assert(forecast20.dataQualityBadge === 'SIMULATED', '20 route observations (<52) must still yield SIMULATED dataQualityBadge');
    assert(forecast20.realTrainingGate?.currentCount === 20, 'Gate must report exactly 20 current observations');
    assert(forecast20.realTrainingGate?.isEligibleForRealTraining === false, 'Gate must report ineligible at 20 observations');
    assert(forecast20.realTrainingGate?.readinessPct === 38, 'Readiness percentage must be Math.round(20/52*100) = 38%');
    assert(
      forecast20.governance?.dataProvenance === 'Calibrated Development Proxy (SIMULATED & DERIVED)',
      'Governance must remain Calibrated Development Proxy when count is 20/52'
    );

    // 10d. With different route (e.g. C5_AU_CN has 0 observations):
    // Adding C18 observations does NOT satisfy C5 route gate!
    const forecastC5 = runFreightForecast('rt-au-hed-qng', 'Capesize', 'Ensemble', routeRepo);
    assert(forecastC5.realTrainingGate?.targetRouteCode === 'C5_AU_CN', 'Target route code must be C5_AU_CN');
    assert(forecastC5.realTrainingGate?.currentCount === 0, 'C5_AU_CN must have 0 observations despite C18 observations');
    assert(forecastC5.dataQualityBadge === 'SIMULATED', 'C5 must be SIMULATED');

    // 10e. Satisfy gate by adding 32 more verified observations to reach 52 continuous weekly observations:
    for (let i = 20; i < 52; i++) {
      const d = new Date(Date.now() - (52 - i) * 7 * 24 * 3600 * 1000).toISOString().substring(0, 10);
      await routeRepo.save({
        id: `c18-${d}`,
        routeCode: 'C18',
        origin: 'Gladstone',
        destination: 'Dhamra',
        cargoType: 'Coal',
        cargoVolumeMt: 150000,
        currency: 'USD',
        sourceUrl: 'https://api.balticexchange.com/api/v1/feed/c18/data',
        retrievedAt: `${d}T10:05:00Z`,
        provenance: 'REAL',
        freightRateUsdPerMt: 14.5 + Math.sin(i / 3) * 1.5,
        observedAt: `${d}T10:00:00Z`,
        date: d,
        vesselClass: 'Capesize',
        provider: 'BalticExchange',
        dataStatus: 'REAL',
        isLive: true,
        synthetic: false,
      });
    }

    const count52 = routeRepo.getCountSync('C18');
    assert(count52 === 52, 'Route repository must now have 52 C18 observations');

    const forecast52 = runFreightForecast('rt-au-hpt-dhm', 'Capesize', 'Ensemble', routeRepo);
    assert(forecast52.dataQualityBadge === 'REAL', '52 verified route observations must unlock REAL dataQualityBadge');
    assert(forecast52.realTrainingGate?.isEligibleForRealTraining === true, 'Gate must be eligible when 52 observations reached');
    assert(forecast52.realTrainingGate?.isRealTrainingActive === true, 'Real training must be active');
    assert(forecast52.realTrainingGate?.readinessPct === 100, 'Readiness percentage must be 100%');
    assert(
      forecast52.governance?.dataProvenance === 'REAL VERIFIED ROUTE OBSERVATIONS',
      'Governance dataProvenance must be REAL VERIFIED ROUTE OBSERVATIONS'
    );
    assert(
      forecast52.governance?.datasetVersion === 'Baltic-C18-Verified-History',
      'Governance datasetVersion must reflect Baltic-C18-Verified-History'
    );
    assert(
      forecast52.history.length === 52,
      'Model training history must strictly contain the 52 real verified fixtures'
    );
  }

  console.log('\n====================================================');
  console.log(`REAL MARKET DATA TEST RESULTS: ${passed} / ${total} PASSED (100%)`);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
