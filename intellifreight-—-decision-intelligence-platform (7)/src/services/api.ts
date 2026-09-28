import {
  CharteringAnalysisRequest,
  CharteringAnalysisResponse,
  Port,
  Vessel,
  MarketIndices,
  DatasetMeta,
  DecisionRecord,
  ScenarioInput,
  ScenarioResult,
  LiveMarketIntelligenceSummary,
  RealMarketObservationRecord,
  BalticExchangeTestDiagnostic,
} from '../types';
import { runCompleteCharteringPipeline } from './pipelineCoordinator';
import { PORTS, VESSELS, MARKET_INDICES, DATASETS_CATALOGUE, INITIAL_DECISION_MEMORY } from '../data/maritimeData';
import { runScenarioAnalysis } from '../engines/scenarioEngine';

export async function fetchCharteringAnalysis(
  request: CharteringAnalysisRequest
): Promise<CharteringAnalysisResponse> {
  try {
    const res = await fetch('/api/chartering/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('API call failed, running local pipeline engine fallback:', e);
  }
  // Local fallback
  return runCompleteCharteringPipeline(request);
}

export async function fetchPorts(): Promise<Port[]> {
  try {
    const res = await fetch('/api/ports');
    if (res.ok) return await res.json();
  } catch (e) {
    // fallback
  }
  return PORTS;
}

export async function fetchVessels(): Promise<Vessel[]> {
  try {
    const res = await fetch('/api/vessels');
    if (res.ok) return await res.json();
  } catch (e) {
    // fallback
  }
  return VESSELS;
}

export async function fetchMarketIndices(): Promise<MarketIndices> {
  try {
    const res = await fetch('/api/market');
    if (res.ok) return await res.json();
  } catch (e) {
    // fallback
  }
  return MARKET_INDICES;
}

export async function fetchLiveMarketSummary(): Promise<LiveMarketIntelligenceSummary | null> {
  try {
    const res = await fetch('/api/market/live');
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Unable to reach /api/market/live feed endpoint:', e);
  }
  return null;
}

export async function fetchRealObservations(code?: string): Promise<{
  totalCount: number;
  verifiedObservationCount?: number;
  records: RealMarketObservationRecord[];
  latestObservations?: RealMarketObservationRecord[];
}> {
  try {
    const url = code ? `/api/market/real-observations?code=${encodeURIComponent(code)}` : '/api/market/real-observations';
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Unable to reach /api/market/real-observations:', e);
  }
  return { totalCount: 0, verifiedObservationCount: 0, records: [] };
}

export async function fetchRealObservationsDiagnostic(): Promise<{
  totalCount: number;
  verifiedObservationCount: number;
  storageType: string;
  storageFilePath: string | null;
  uniqueInstruments: string[];
  providers: string[];
  latestObservations: RealMarketObservationRecord[];
  oldestObservationTime: string | null;
  newestObservationTime: string | null;
} | null> {
  try {
    const res = await fetch('/api/market/real-observations/diagnostic');
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Unable to reach /api/market/real-observations/diagnostic:', e);
  }
  return null;
}

export async function fetchBalticTestDiagnostic(route?: string): Promise<BalticExchangeTestDiagnostic | null> {
  try {
    const url = route ? `/api/market/baltic/test?route=${encodeURIComponent(route)}` : '/api/market/baltic/test';
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Unable to reach /api/market/baltic/test:', e);
  }
  return null;
}

export async function fetchDatasets(): Promise<DatasetMeta[]> {
  try {
    const res = await fetch('/api/datasets');
    if (res.ok) return await res.json();
  } catch (e) {
    // fallback
  }
  return DATASETS_CATALOGUE;
}

export async function fetchDecisions(): Promise<DecisionRecord[]> {
  try {
    const res = await fetch('/api/decisions');
    if (res.ok) return await res.json();
  } catch (e) {
    // fallback
  }
  return INITIAL_DECISION_MEMORY;
}

export async function runScenarioApi(
  baseResponse: CharteringAnalysisResponse,
  scenarioInput: ScenarioInput
): Promise<ScenarioResult> {
  try {
    const res = await fetch('/api/scenarios/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseRequest: baseResponse.request,
        scenarioInput,
      }),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    // fallback
  }
  return runScenarioAnalysis(baseResponse, scenarioInput);
}
