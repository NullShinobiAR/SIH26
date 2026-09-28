/**
 * Baltic Route Ingestion & Route Freight Observation Repository Test Suite
 * Covers:
 * 1. Valid real observation (C18 and P9)
 * 2. Missing value rejection
 * 3. Wrong route rejection
 * 4. Synthetic observation rejection (anti-synthetic policy)
 * 5. Stale observation handling (outside 24h freshness window)
 * 6. 401 provider response handling (UNAVAILABLE and no value)
 *
 * Run via: npx tsx tests/balticRouteIngestion.test.ts
 */

import { InMemoryRouteFreightObservationRepository } from '../src/data/routeFreightObservationRepository';
import {
  LiveMarketDataService,
  ingestBalticHistoricalFeedPayload,
} from '../src/services/liveMarketDataService';
import { BALTIC_ROUTE_SPECIFICATIONS, getBalticRouteSpec } from '../src/data/balticRoutes';
import { RouteFreightObservationRecord } from '../src/types';

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
console.log('BALTIC ROUTE ASSESSMENT INGESTION & REPOSITORY TESTS');
console.log('====================================================\n');

async function runTests() {
  const repo = new InMemoryRouteFreightObservationRepository();

  // Test 1: Official route definitions for C18 and P9
  console.log('[1/7] Testing Official Route Specifications for C18 and P9...');
  {
    const c18 = getBalticRouteSpec('C18');
    assert(c18 !== null, 'C18 route spec retrieved');
    assert(c18!.origin === 'Gladstone', 'C18 origin is Gladstone');
    assert(c18!.destination === 'Dhamra', 'C18 destination is Dhamra');
    assert(c18!.vesselClass === 'Capesize', 'C18 vesselClass is Capesize');
    assert(c18!.cargoVolumeMt === 150000, 'C18 cargo volume is 150,000 MT');
    assert(c18!.cargoType === 'Coal', 'C18 cargo type is Coal');
    assert(c18!.rateUnit === 'USD/MT', 'C18 rate unit is USD/MT');

    const p9 = getBalticRouteSpec('P9');
    assert(p9 !== null, 'P9 route spec retrieved');
    assert(p9!.origin === 'Gladstone', 'P9 origin is Gladstone');
    assert(p9!.destination === 'Dhamra', 'P9 destination is Dhamra');
    assert(p9!.vesselClass === 'Panamax', 'P9 vesselClass is Panamax');
    assert(p9!.cargoVolumeMt === 80000, 'P9 cargo volume is 80,000 MT');
    assert(p9!.cargoType === 'Coal', 'P9 cargo type is Coal');
    assert(p9!.rateUnit === 'USD/MT', 'P9 rate unit is USD/MT');
  }

  // Test 2: Valid real observation saving and retrieval
  console.log('\n[2/7] Testing Valid Real Observation Saving and Retrieval...');
  {
    const freshObservedAt = new Date(Date.now() - 2 * 3600 * 1000).toISOString(); // 2 hours ago
    const validC18Record: RouteFreightObservationRecord = {
      date: freshObservedAt.slice(0, 10),
      provider: 'Baltic Exchange',
      routeCode: 'C18',
      origin: 'Gladstone',
      destination: 'Dhamra',
      vesselClass: 'Capesize',
      cargoType: 'Coal',
      cargoVolumeMt: 150000,
      freightRateUsdPerMt: 13.85,
      currency: 'USD',
      sourceUrl: 'https://api.balticexchange.com/api/v1/feed/c18/data',
      observedAt: freshObservedAt,
      retrievedAt: new Date().toISOString(),
      dataStatus: 'REAL',
      isLive: true,
      synthetic: false,
      provenance: 'REAL',
    };

    await repo.save(validC18Record);
    const count = await repo.getCount('C18');
    assert(count === 1, 'C18 valid record persisted');

    const latest = await repo.getLatestByRoute('C18');
    assert(latest !== null, 'Latest C18 record retrieved');
    assert(latest!.freightRateUsdPerMt === 13.85, 'Freight rate USD/MT matches');
    assert(latest!.synthetic === false, 'Synthetic flag is false');
    assert(latest!.dataStatus === 'REAL', 'Data status is REAL');
    assert(latest!.isLive === true, 'isLive is true');
  }

  // Test 3: Missing value rejection
  console.log('\n[3/7] Testing Missing Value Rejection...');
  {
    let errorThrown = false;
    try {
      const invalidRecord: RouteFreightObservationRecord = {
        date: '2026-09-20',
        provider: 'Baltic Exchange',
        routeCode: 'C18',
        origin: 'Gladstone',
        destination: 'Dhamra',
        vesselClass: 'Capesize',
        cargoType: 'Coal',
        cargoVolumeMt: 150000,
        freightRateUsdPerMt: null as any, // Missing rate
        currency: 'USD',
        sourceUrl: 'https://api.balticexchange.com/api/v1/feed/c18/data',
        observedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        dataStatus: 'REAL',
        isLive: true,
        synthetic: false,
        provenance: 'REAL',
      };
      await repo.save(invalidRecord);
    } catch (err: any) {
      errorThrown = true;
      assert(
        err.message.includes('Validation Error') || err.message.includes('positive numeric'),
        'Missing freightRateUsdPerMt properly rejected with error'
      );
    }
    assert(errorThrown, 'Repository threw error on null freight rate for REAL status');

    // Also test ingestion payload with missing rate
    const ingestionResult = ingestBalticHistoricalFeedPayload(
      [{ date: '2026-09-18', rate: null }],
      'P9'
    );
    assert(ingestionResult.ingested.length === 0, 'No records ingested with missing rate');
    assert(ingestionResult.rejected.length === 1, 'Record with missing rate added to rejected list');
  }

  // Test 4: Wrong route rejection
  console.log('\n[4/7] Testing Wrong Route Rejection...');
  {
    let errorThrown = false;
    try {
      const wrongRouteRecord: RouteFreightObservationRecord = {
        date: '2026-09-20',
        provider: 'Baltic Exchange',
        routeCode: 'UNKNOWN_INVALID_ROUTE_XYZ',
        origin: 'Unknown',
        destination: 'Unknown',
        vesselClass: 'Capesize',
        cargoType: 'Coal',
        cargoVolumeMt: 150000,
        freightRateUsdPerMt: 14.5,
        currency: 'USD',
        sourceUrl: 'https://api.balticexchange.com',
        observedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        dataStatus: 'REAL',
        isLive: true,
        synthetic: false,
        provenance: 'REAL',
      };
      await repo.save(wrongRouteRecord);
    } catch (err: any) {
      errorThrown = true;
      assert(
        err.message.includes('Unsupported or invalid Baltic route code'),
        'Unsupported route code correctly rejected'
      );
    }
    assert(errorThrown, 'Repository threw on invalid route code');

    // Test ingestion with wrong route
    let ingestErrorThrown = false;
    try {
      ingestBalticHistoricalFeedPayload([{ date: '2026-09-18', rate: 12.5 }], 'INVALID_ROUTE');
    } catch (err: any) {
      ingestErrorThrown = true;
      assert(
        err.message.includes('Unsupported or invalid Baltic route code'),
        'Ingestion rejected invalid route code'
      );
    }
    assert(ingestErrorThrown, 'Ingestion threw on invalid route code');
  }

  // Test 5: Synthetic observation rejection (Anti-Synthetic Policy)
  console.log('\n[5/7] Testing Synthetic Observation Rejection...');
  {
    let syntheticErrorThrown = false;
    try {
      const syntheticRecord: RouteFreightObservationRecord = {
        date: '2026-09-20',
        provider: 'Baltic Exchange',
        routeCode: 'P9',
        origin: 'Gladstone',
        destination: 'Dhamra',
        vesselClass: 'Panamax',
        cargoType: 'Coal',
        cargoVolumeMt: 80000,
        freightRateUsdPerMt: 15.2,
        currency: 'USD',
        sourceUrl: 'https://api.balticexchange.com/api/v1/feed/p9/data',
        observedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        dataStatus: 'REAL',
        isLive: true,
        synthetic: true, // STRICT POLICY VIOLATION
        provenance: 'REAL',
      };
      await repo.save(syntheticRecord);
    } catch (err: any) {
      syntheticErrorThrown = true;
      assert(
        err.message.includes('Policy Violation') && err.message.includes('synthetic=true'),
        'Synthetic=true rejected by policy check'
      );
    }
    assert(syntheticErrorThrown, 'Repository strictly rejected synthetic=true observation');

    // Also test ingestion filter rejecting synthetic: true items
    const rawPayloadWithSynthetic = [
      { date: '2026-09-18', rate: 14.1, synthetic: true },
      { date: '2026-09-19', rate: 14.3, synthetic: false },
    ];
    const ingestResult = ingestBalticHistoricalFeedPayload(rawPayloadWithSynthetic, 'C18');
    assert(ingestResult.ingested.length === 1, 'Only non-synthetic record was ingested');
    assert(ingestResult.rejected.length === 1, 'Synthetic record was rejected');
    assert(
      ingestResult.rejected[0].reason.includes('synthetic=true'),
      'Rejection reason mentions synthetic policy'
    );
  }

  // Test 6: Stale observation handling (outside 24h window)
  console.log('\n[6/7] Testing Stale Observation Handling...');
  {
    const oldTimestamp = new Date(Date.now() - 48 * 3600 * 1000).toISOString(); // 48 hours ago
    const stalePayload = [
      {
        date: oldTimestamp.slice(0, 10),
        rate: 13.9,
        observedAt: oldTimestamp,
      },
    ];

    const staleIngest = ingestBalticHistoricalFeedPayload(stalePayload, 'C18');
    assert(staleIngest.ingested.length === 1, 'Stale record ingested successfully');
    const rec = staleIngest.ingested[0];
    assert(rec.dataStatus === 'STALE', 'Data status is correctly evaluated as STALE');
    assert(rec.isLive === false, 'isLive is false for observation older than 24h');
    assert(rec.synthetic === false, 'synthetic remains strictly false (genuine value preserved)');
    assert(rec.freightRateUsdPerMt === 13.9, 'Genuine observed rate preserved without fallback');

    // Save stale record to repo to ensure it is accepted
    await repo.save(rec);
    const c18Records = await repo.getByRoute('C18');
    const foundStale = c18Records.find((r) => r.dataStatus === 'STALE');
    assert(foundStale !== undefined, 'Stale observation persisted in repository');
  }

  // Test 7: HTTP 401 provider response handling (UNAVAILABLE and no value)
  console.log('\n[7/7] Testing 401 Provider Response Handling...');
  {
    const mock401Fetch = async () => {
      return new Response(
        JSON.stringify({
          type: 'https://tools.ietf.org/html/rfc9110#section-15.5.2',
          title: 'Unauthorized',
          status: 401,
          detail: 'Access denied due to invalid subscription key.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/problem+json' } }
      );
    };

    const service = new LiveMarketDataService({
      balticExchangeApiKey: 'invalid-or-unentitled-key',
      fetchFn: mock401Fetch as any,
      routeRepository: repo,
    });

    // 7a: fetchRouteAssessment on 401
    const obsC18 = await service.fetchRouteAssessment('C18');
    assert(obsC18.value === null, 'Value is null on 401 response');
    assert(obsC18.dataStatus === 'UNAVAILABLE', 'dataStatus is UNAVAILABLE on 401');
    assert(obsC18.isLive === false, 'isLive is false on 401');
    assert(
      obsC18.errorMessage?.includes('401') || obsC18.errorMessage?.includes('Unauthorized'),
      'Error message documents HTTP 401 rejection'
    );

    // 7b: fetchBalticHistoricalRouteAssessments on 401 with from/to parameters
    const histResult = await service.fetchBalticHistoricalRouteAssessments(
      'P9',
      '2026-01-01',
      '2026-02-01'
    );
    assert(histResult.status === 'UNAUTHORIZED', 'Historical query returns UNAUTHORIZED on 401');
    assert(histResult.httpStatus === 401, 'httpStatus is 401');
    assert(histResult.observations.length === 0, 'Zero observations returned on 401');
    assert(
      histResult.errorMessage?.includes('401'),
      'Historical error message explains 401 unauthorized'
    );
  }

  console.log('\n====================================================');
  console.log(`ALL TESTS PASSED: ${passed}/${total}`);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
