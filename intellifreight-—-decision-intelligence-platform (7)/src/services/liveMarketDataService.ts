import {
  MarketObservation,
  DataProvenanceType,
  ProviderFeedStatus,
  RealMarketObservationRecord,
  LiveMarketIntelligenceSummary,
  BalticExchangeTestDiagnostic,
  RouteFreightObservationRecord,
  IRouteFreightObservationRepository,
} from '../types';
import { IRealObservationRepository, globalRealObservationRepository } from '../data/realObservationRepository';
import { globalRouteFreightObservationRepository } from '../data/routeFreightObservationRepository';
import { getBalticRouteSpec, isValidBalticRoute, BALTIC_ROUTE_SPECIFICATIONS } from '../data/balticRoutes';

export interface MarketIndexDataProvider {
  id: string;
  name: string;
  providerType: 'REST_API' | 'COMMERCIAL_FEED' | 'SIMULATED';
  getFeedStatus(): ProviderFeedStatus;
  fetchBalticDryIndex(): Promise<MarketObservation<number>>;
  fetchBalticCapesizeIndex(): Promise<MarketObservation<number>>;
}

export interface LiveBunkerDataProvider {
  id: string;
  name: string;
  providerType: 'REST_API' | 'COMMERCIAL_FEED' | 'SIMULATED';
  getFeedStatus(): ProviderFeedStatus;
  fetchVlsfoBenchmark(port?: string): Promise<MarketObservation<number>>;
}

export interface BalticRouteDataProvider {
  id: string;
  name: string;
  providerType: 'REST_API' | 'COMMERCIAL_FEED' | 'SIMULATED';
  getFeedStatus(): ProviderFeedStatus;
  fetchRouteAssessment(routeCode: string): Promise<MarketObservation<number>>;
}

export interface LiveMarketDataServiceOptions {
  oilPriceApiKey?: string;
  balticExchangeApiKey?: string;
  freshnessWindowMs?: number; // default 24 hours (86,400,000 ms)
  timeoutMs?: number; // default 5000 ms
  fetchFn?: typeof fetch;
  repository?: IRealObservationRepository;
  routeRepository?: IRouteFreightObservationRepository;
}


/**
 * LiveMarketDataService:
 * Real market data integration layer for freight indices, bunker benchmarks, and route assessments.
 * Strictly adheres to Data Provenance Governance:
 * - REAL: Authentically retrieved from external provider within freshness window.
 * - STALE: Authentically retrieved but timestamp is outside freshness window.
 * - UNAVAILABLE: Provider not reachable, missing key, or bad payload (NEVER fabricated).
 * - ZERO SILENT FALLBACK: If live API fails, returns UNAVAILABLE/STALE, NEVER simulated proxies.
 */
export class LiveMarketDataService implements MarketIndexDataProvider, LiveBunkerDataProvider, BalticRouteDataProvider {
  id = 'live-market-data-service';
  name = 'Real External Market Data Integration Engine';
  providerType: 'REST_API' = 'REST_API';

  private oilPriceApiKey?: string;
  private balticExchangeApiKey?: string;
  private freshnessWindowMs: number;
  private timeoutMs: number;
  private fetchFn: typeof fetch;
  private repository: IRealObservationRepository;
  private routeRepository: IRouteFreightObservationRepository;

  // Cached observations for immediate access
  private cachedBdi: MarketObservation<number> | null = null;
  private cachedBci: MarketObservation<number> | null = null;
  private cachedVlsfo: MarketObservation<number> | null = null;

  constructor(options: LiveMarketDataServiceOptions = {}) {
    this.oilPriceApiKey = options.oilPriceApiKey ?? process.env.OILPRICE_API_KEY;
    this.balticExchangeApiKey = options.balticExchangeApiKey ?? process.env.BALTIC_EXCHANGE_API_KEY;
    this.freshnessWindowMs = options.freshnessWindowMs ?? 24 * 60 * 60 * 1000; // 24 hours
    this.timeoutMs = options.timeoutMs ?? 5000; // 5s timeout
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.repository = options.repository ?? globalRealObservationRepository;
    this.routeRepository = options.routeRepository ?? globalRouteFreightObservationRepository;
  }

  getFeedStatus(): ProviderFeedStatus {
    if (!this.oilPriceApiKey) {
      return 'UNAVAILABLE';
    }
    if (this.cachedBdi?.dataStatus === 'REAL' || this.cachedVlsfo?.dataStatus === 'REAL') {
      return 'LIVE';
    }
    if (this.cachedBdi?.dataStatus === 'STALE' || this.cachedVlsfo?.dataStatus === 'STALE') {
      return 'STALE';
    }
    return 'UNAVAILABLE';
  }

  /**
   * Evaluates freshness and assigns exact provenance
   */
  private evaluateFreshness(observedAtIso: string): { dataStatus: DataProvenanceType; isLive: boolean } {
    const observedTime = new Date(observedAtIso).getTime();
    if (isNaN(observedTime)) {
      return { dataStatus: 'UNAVAILABLE', isLive: false };
    }

    const now = Date.now();
    // Allow up to 5 minutes future clock skew
    if (observedTime > now + 5 * 60 * 1000) {
      return { dataStatus: 'UNAVAILABLE', isLive: false };
    }

    const ageMs = now - observedTime;
    if (ageMs <= this.freshnessWindowMs) {
      return { dataStatus: 'REAL', isLive: true };
    } else {
      return { dataStatus: 'STALE', isLive: false };
    }
  }

  /**
   * Generic OilPriceAPI caller with validation, error handling, timeout, and provenance logging
   */
  private async fetchOilPriceApiPrice(
    code: string,
    expectedUnit: string,
    sourceDisplayName: string,
    category: 'FREIGHT_INDEX' | 'BUNKER_FUEL' | 'COMMODITY',
    indexName: string
  ): Promise<MarketObservation<number>> {
    const retrievedAt = new Date().toISOString();

    // 1. Missing API Key check
    if (!this.oilPriceApiKey || this.oilPriceApiKey.trim() === '') {
      return {
        value: null,
        unit: expectedUnit,
        source: sourceDisplayName,
        sourceUrl: 'https://api.oilpriceapi.com/v1/prices/latest',
        provider: 'OilPriceAPI',
        observedAt: retrievedAt,
        retrievedAt,
        dataStatus: 'UNAVAILABLE',
        isLive: false,
        errorMessage: 'OILPRICE_API_KEY environment variable is not configured. External observation unavailable.',
        confidence: 0,
      };
    }

    const url = `https://api.oilpriceapi.com/v1/prices/latest?by_code=${encodeURIComponent(code)}`;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${this.oilPriceApiKey.trim()}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        return {
          value: null,
          unit: expectedUnit,
          source: sourceDisplayName,
          sourceUrl: url,
          provider: 'OilPriceAPI',
          observedAt: retrievedAt,
          retrievedAt,
          dataStatus: 'UNAVAILABLE',
          isLive: false,
          errorMessage: `Provider returned HTTP ${response.status} (${response.statusText || 'Error'}).`,
          confidence: 0,
        };
      }

      const payload = await response.json();

      // 2. Validate payload schema
      if (!payload || payload.status !== 'success' || !payload.data || typeof payload.data.price !== 'number') {
        return {
          value: null,
          unit: expectedUnit,
          source: sourceDisplayName,
          sourceUrl: url,
          provider: 'OilPriceAPI',
          observedAt: retrievedAt,
          retrievedAt,
          dataStatus: 'UNAVAILABLE',
          isLive: false,
          errorMessage: 'Malformed payload: missing expected numeric price in provider response.',
          confidence: 0,
        };
      }

      const numericValue = Number(payload.data.price);
      if (isNaN(numericValue) || numericValue <= 0) {
        return {
          value: null,
          unit: expectedUnit,
          source: sourceDisplayName,
          sourceUrl: url,
          provider: 'OilPriceAPI',
          observedAt: retrievedAt,
          retrievedAt,
          dataStatus: 'UNAVAILABLE',
          isLive: false,
          errorMessage: `Invalid price observation: received non-positive value (${numericValue}).`,
          confidence: 0,
        };
      }

      // 3. Timestamp validation
      const rawCreatedAt = payload.data.created_at;
      const observedAt = rawCreatedAt ? new Date(rawCreatedAt).toISOString() : retrievedAt;
      if (isNaN(new Date(observedAt).getTime())) {
        return {
          value: null,
          unit: expectedUnit,
          source: sourceDisplayName,
          sourceUrl: url,
          provider: 'OilPriceAPI',
          observedAt: retrievedAt,
          retrievedAt,
          dataStatus: 'UNAVAILABLE',
          isLive: false,
          errorMessage: 'Invalid timestamp format received from provider.',
          confidence: 0,
        };
      }

      // 4. Freshness evaluation
      const { dataStatus, isLive } = this.evaluateFreshness(observedAt);

      // 5. Query empirical comparisons from repository (Zero fabrication)
      const comparison = await this.repository.getComparison(code, observedAt);

      const observation: MarketObservation<number> = {
        value: numericValue,
        unit: expectedUnit,
        source: sourceDisplayName,
        sourceUrl: url,
        provider: 'OilPriceAPI',
        observedAt,
        retrievedAt,
        dataStatus,
        isLive,
        confidence: dataStatus === 'REAL' ? 99 : 80,
        previousObservation: comparison.previous,
        change7d: comparison.change7d,
        change30d: comparison.change30d,
      };

      // 6. Save verified observation to historical repository strictly if status is REAL
      if (dataStatus === 'REAL') {
        const record: RealMarketObservationRecord = {
          id: `rec-${code}-${new Date(observedAt).getTime()}`,
          symbolOrCode: code,
          category,
          name: indexName,
          value: numericValue,
          unit: expectedUnit,
          source: sourceDisplayName,
          sourceUrl: url,
          provider: 'OilPriceAPI',
          observedAt,
          retrievedAt,
          dataStatus,
          isLive,
          synthetic: false,
          rawPayloadSnippet: JSON.stringify(payload.data).slice(0, 200),
        };

        await this.repository.save(record);
      }

      return observation;
    } catch (err: any) {
      clearTimeout(timeoutHandle);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted');
      return {
        value: null,
        unit: expectedUnit,
        source: sourceDisplayName,
        sourceUrl: url,
        provider: 'OilPriceAPI',
        observedAt: retrievedAt,
        retrievedAt,
        dataStatus: 'UNAVAILABLE',
        isLive: false,
        errorMessage: isTimeout
          ? `Connection timed out after ${this.timeoutMs}ms.`
          : `Network/connection failure: ${err.message || 'Unknown error'}.`,
        confidence: 0,
      };
    }
  }

  // A) Baltic Dry Index (BDI)
  async fetchBalticDryIndex(): Promise<MarketObservation<number>> {
    const obs = await this.fetchOilPriceApiPrice(
      'BALTIC_DRY_INDEX',
      'points',
      'Baltic Exchange (Benchmark Index via OilPriceAPI)',
      'FREIGHT_INDEX',
      'Baltic Dry Index (BDI)'
    );
    this.cachedBdi = obs;
    return obs;
  }

  // Baltic Capesize Index (BCI)
  async fetchBalticCapesizeIndex(): Promise<MarketObservation<number>> {
    const obs = await this.fetchOilPriceApiPrice(
      'BALTIC_CAPESIZE_INDEX',
      'points',
      'Baltic Exchange (Capesize Index via OilPriceAPI)',
      'FREIGHT_INDEX',
      'Baltic Capesize Index (BCI)'
    );
    this.cachedBci = obs;
    return obs;
  }

  // B) Very Low Sulphur Fuel Oil (VLSFO)
  async fetchVlsfoBenchmark(port = 'Singapore'): Promise<MarketObservation<number>> {
    const obs = await this.fetchOilPriceApiPrice(
      'VLSFO_USD',
      'USD/MT',
      `${port} Marine Fuel VLSFO 0.5% (via OilPriceAPI)`,
      'BUNKER_FUEL',
      `${port} VLSFO Bunker Fuel`
    );
    this.cachedVlsfo = obs;
    return obs;
  }

  // C) Baltic Exchange Route Assessments (Direct authenticated subscriber API)
  async fetchRouteAssessment(routeCode: string): Promise<MarketObservation<number>> {
    const retrievedAt = new Date().toISOString();
    const routeSpec = getBalticRouteSpec(routeCode);
    const cleanRouteCode = routeSpec ? routeSpec.routeCode : (routeCode || 'C5_AU_CN').toUpperCase();
    const feedId = routeSpec ? routeSpec.feedId : cleanRouteCode.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const endpointUrl = `https://api.balticexchange.com/api/v1/feed/${encodeURIComponent(feedId)}/data`;

    // Strictly enforce authorized licensing: Never scrape, never bypass, never label simulated as real
    if (!this.balticExchangeApiKey || this.balticExchangeApiKey.trim() === '') {
      return {
        value: null,
        unit: '$/tonne',
        source: `Baltic Exchange Official Route Assessment (${cleanRouteCode})`,
        sourceUrl: 'https://www.balticexchange.com/en/data-services/market-data.html',
        provider: 'Baltic Exchange Direct API',
        observedAt: retrievedAt,
        retrievedAt,
        dataStatus: 'UNAVAILABLE',
        isLive: false,
        errorMessage: `Authorized Baltic Exchange API credentials ('BALTIC_EXCHANGE_API_KEY') required for route ${cleanRouteCode}. Web scraping or unauthorized licensing bypass is strictly prohibited. Zero simulated fallback applied.`,
        confidence: 0,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(endpointUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-apikey': this.balticExchangeApiKey.trim(),
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status >= 200 && res.status < 300) {
        const json = await res.json();
        let observedValue: number | null = null;
        let observedDateStr = retrievedAt;

        if (Array.isArray(json) && json.length > 0) {
          const latest = json[0];
          observedValue = typeof latest.rate === 'number' ? latest.rate : typeof latest.value === 'number' ? latest.value : typeof latest.price === 'number' ? latest.price : null;
          observedDateStr = latest.date || latest.timestamp || latest.createdOn || retrievedAt;
        } else if (json && typeof json === 'object') {
          observedValue = typeof json.rate === 'number' ? json.rate : typeof json.value === 'number' ? json.value : typeof json.price === 'number' ? json.price : null;
          observedDateStr = json.date || json.timestamp || json.createdOn || retrievedAt;
        }

        if (observedValue !== null && !isNaN(observedValue)) {
          const { dataStatus, isLive } = this.evaluateFreshness(observedDateStr);
          const obs: MarketObservation<number> = {
            value: observedValue,
            unit: '$/tonne',
            source: `Baltic Exchange Route Assessment (${cleanRouteCode})`,
            sourceUrl: endpointUrl,
            provider: 'Baltic Exchange Direct API',
            observedAt: observedDateStr,
            retrievedAt,
            dataStatus,
            isLive,
            confidence: dataStatus === 'REAL' ? 1.0 : 0.7,
          };

          if (dataStatus === 'REAL') {
            const record: RealMarketObservationRecord = {
              id: `baltic-${cleanRouteCode}-${observedDateStr}`,
              symbolOrCode: cleanRouteCode,
              category: 'ROUTE_ASSESSMENT',
              name: `Baltic Exchange ${cleanRouteCode}`,
              value: observedValue,
              unit: '$/tonne',
              source: `Baltic Exchange Route Assessment (${cleanRouteCode})`,
              sourceUrl: endpointUrl,
              provider: 'Baltic Exchange Direct API',
              observedAt: observedDateStr,
              retrievedAt,
              dataStatus,
              isLive,
              synthetic: false,
              rawPayloadSnippet: JSON.stringify(json).slice(0, 500),
            };
            await this.repository.save(record);

            // Persist to route freight repository with full voyage specifications
            const dateOnly = String(observedDateStr).slice(0, 10);
            const routeRecord: RouteFreightObservationRecord = {
              id: `baltic-route-${cleanRouteCode}-${observedDateStr}`,
              date: dateOnly,
              provider: 'Baltic Exchange',
              routeCode: routeSpec ? routeSpec.routeCode : cleanRouteCode,
              origin: routeSpec ? routeSpec.origin : 'Gladstone',
              destination: routeSpec ? routeSpec.destination : 'Dhamra',
              vesselClass: routeSpec ? routeSpec.vesselClass : 'Capesize',
              cargoType: routeSpec ? routeSpec.cargoType : 'Coal',
              cargoVolumeMt: routeSpec ? routeSpec.cargoVolumeMt : 150000,
              freightRateUsdPerMt: observedValue,
              currency: routeSpec ? routeSpec.currency : 'USD',
              sourceUrl: endpointUrl,
              observedAt: observedDateStr,
              retrievedAt,
              dataStatus,
              isLive,
              synthetic: false,
              provenance: dataStatus,
              rawPayloadSnippet: JSON.stringify(json).slice(0, 500),
            };
            await this.routeRepository.save(routeRecord);
          }
          return obs;
        }

        return {
          value: null,
          unit: '$/tonne',
          source: `Baltic Exchange Route Assessment (${cleanRouteCode})`,
          sourceUrl: endpointUrl,
          provider: 'Baltic Exchange Direct API',
          observedAt: retrievedAt,
          retrievedAt,
          dataStatus: 'UNAVAILABLE',
          isLive: false,
          errorMessage: 'Baltic Exchange returned an empty or unparseable assessment rate payload.',
          confidence: 0,
        };
      }

      // Explicit HTTP failure handling (401 Unauthorized, 403 Forbidden, 404, etc.)
      if (res.status === 401 || res.status === 403) {
        const problem = await res.json().catch(() => null);
        const title = problem?.title || problem?.detail || (res.status === 401 ? 'Unauthorized' : 'Forbidden');
        return {
          value: null,
          unit: '$/tonne',
          source: `Baltic Exchange Route Assessment (${cleanRouteCode})`,
          sourceUrl: endpointUrl,
          provider: 'Baltic Exchange Direct API',
          observedAt: retrievedAt,
          retrievedAt,
          dataStatus: 'UNAVAILABLE',
          isLive: false,
          errorMessage: `Baltic Exchange API rejected authentication (HTTP ${res.status}: ${title}). The configured BALTIC_EXCHANGE_API_KEY was rejected by api.balticexchange.com. In accordance with zero-hallucination policy, no simulated data fallback is applied.`,
          confidence: 0,
        };
      }

      return {
        value: null,
        unit: '$/tonne',
        source: `Baltic Exchange Route Assessment (${cleanRouteCode})`,
        sourceUrl: endpointUrl,
        provider: 'Baltic Exchange Direct API',
        observedAt: retrievedAt,
        retrievedAt,
        dataStatus: 'UNAVAILABLE',
        isLive: false,
        errorMessage: `Baltic Exchange API responded with HTTP ${res.status}. Data is unavailable; zero simulated fallback applied.`,
        confidence: 0,
      };
    } catch (err: any) {
      clearTimeout(timer);
      return {
        value: null,
        unit: '$/tonne',
        source: `Baltic Exchange Route Assessment (${cleanRouteCode})`,
        sourceUrl: endpointUrl,
        provider: 'Baltic Exchange Direct API',
        observedAt: retrievedAt,
        retrievedAt,
        dataStatus: 'UNAVAILABLE',
        isLive: false,
        errorMessage: `Baltic Exchange connection error: ${err.message || 'Request failed'}. Zero simulated fallback applied.`,
        confidence: 0,
      };
    }
  }

  /**
   * Historical Route Assessment Fetching:
   * Queries Baltic Exchange feed endpoint using documented 'from' and 'to' date parameters.
   * Format: GET /api/v1/feed/{feed_id}/data?from={fromDate}&to={toDate}
   */
  async fetchBalticHistoricalRouteAssessments(
    routeCode: string,
    fromDate?: string,
    toDate?: string
  ): Promise<{
    observations: RouteFreightObservationRecord[];
    status: 'SUCCESS' | 'UNAVAILABLE' | 'UNAUTHORIZED' | 'ERROR';
    httpStatus: number;
    errorMessage?: string;
  }> {
    const routeSpec = getBalticRouteSpec(routeCode);
    const cleanRouteCode = routeSpec ? routeSpec.routeCode : (routeCode || 'C18').toUpperCase();
    const feedId = routeSpec ? routeSpec.feedId : cleanRouteCode.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    let endpointUrl = `https://api.balticexchange.com/api/v1/feed/${encodeURIComponent(feedId)}/data`;
    const params: string[] = [];
    if (fromDate) params.push(`from=${encodeURIComponent(fromDate)}`);
    if (toDate) params.push(`to=${encodeURIComponent(toDate)}`);
    if (params.length > 0) {
      endpointUrl += `?${params.join('&')}`;
    }

    if (!this.balticExchangeApiKey || this.balticExchangeApiKey.trim() === '') {
      return {
        observations: [],
        status: 'UNAVAILABLE',
        httpStatus: 0,
        errorMessage: `Missing BALTIC_EXCHANGE_API_KEY. Authentication required for route ${cleanRouteCode}.`,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(endpointUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-apikey': this.balticExchangeApiKey.trim(),
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 401 || res.status === 403) {
        return {
          observations: [],
          status: 'UNAUTHORIZED',
          httpStatus: res.status,
          errorMessage: `Baltic Exchange returned HTTP ${res.status} Unauthorized/Forbidden. Credential unentitled for route ${cleanRouteCode}.`,
        };
      }

      if (res.status >= 200 && res.status < 300) {
        const json = await res.json();
        const ingestion = ingestBalticHistoricalFeedPayload(json, cleanRouteCode, {
          sourceUrl: endpointUrl,
        });

        // Persist valid ingested records
        for (const rec of ingestion.ingested) {
          await this.routeRepository.save(rec);
        }

        return {
          observations: ingestion.ingested,
          status: 'SUCCESS',
          httpStatus: res.status,
        };
      }

      return {
        observations: [],
        status: 'ERROR',
        httpStatus: res.status,
        errorMessage: `Baltic Exchange returned HTTP ${res.status}. Zero simulated fallback applied.`,
      };
    } catch (err: any) {
      clearTimeout(timer);
      return {
        observations: [],
        status: 'ERROR',
        httpStatus: 0,
        errorMessage: `Network error contacting Baltic Exchange API: ${err.message}`,
      };
    }
  }

  /**
   * Diagnostic test request directly against documented Baltic Exchange endpoint
   * Performs an authenticated GET request with 'x-apikey' header and returns complete diagnostic provenance
   */
  async testBalticExchangeEndpoint(routeCode = 'c5_au_cn'): Promise<BalticExchangeTestDiagnostic> {
    const cleanCode = (routeCode || 'c5_au_cn').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const endpointUrl = `https://api.balticexchange.com/api/v1/feed/${cleanCode}/data`;
    const retrievedAt = new Date().toISOString();

    const hasKey = !!(this.balticExchangeApiKey && this.balticExchangeApiKey.trim() !== '');
    const maskedKey = hasKey
      ? `${this.balticExchangeApiKey!.slice(0, 4)}...${this.balticExchangeApiKey!.slice(-4)}`
      : undefined;

    if (!hasKey) {
      const obs = await this.fetchRouteAssessment(routeCode);
      return {
        endpoint: endpointUrl,
        authenticationSucceeded: false,
        httpStatus: 0,
        returnedDataType: 'none',
        timestamp: retrievedAt,
        source: 'Baltic Exchange Market Data API (api.balticexchange.com)',
        provider: 'Baltic Exchange Direct API',
        dataStatus: 'UNAVAILABLE',
        isLive: false,
        canBeClassifiedAsRealLive: false,
        detailMessage: 'No BALTIC_EXCHANGE_API_KEY configured in server-side environment. Authenticated request aborted to prevent unauthorized access.',
        hasApiKeyConfigured: false,
        observation: obs,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(endpointUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-apikey': this.balticExchangeApiKey!.trim(),
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      const contentType = res.headers.get('content-type') || 'application/problem+json';
      const dateHeader = res.headers.get('date') || retrievedAt;
      const rawText = await res.text();
      const rawSnippet = rawText.slice(0, 500);

      const authSucceeded = res.status >= 200 && res.status < 300;
      const obs = await this.fetchRouteAssessment(routeCode);

      let detailMessage = '';
      if (authSucceeded) {
        detailMessage = `Authentication succeeded (HTTP ${res.status} OK). Data received from Baltic Exchange feed '${cleanCode}'.`;
      } else if (res.status === 401) {
        detailMessage = `Authentication rejected (HTTP 401 Unauthorized). Header 'x-apikey' was transmitted to Baltic Exchange Azure API Management Gateway, but the credential was rejected. Under strict data governance, no simulated data fallback is permitted.`;
      } else if (res.status === 403) {
        detailMessage = `Access forbidden (HTTP 403 Forbidden). The provided subscriber key does not have entitlement permissions for feed '${cleanCode}'.`;
      } else {
        detailMessage = `Baltic Exchange API responded with HTTP ${res.status}. Data is unavailable; zero simulated fallback applied.`;
      }

      return {
        endpoint: endpointUrl,
        authenticationSucceeded: authSucceeded,
        httpStatus: res.status,
        returnedDataType: contentType,
        timestamp: dateHeader,
        source: 'Baltic Exchange Market Data API (api.balticexchange.com)',
        provider: 'Baltic Exchange Direct API',
        dataStatus: obs.dataStatus,
        isLive: obs.isLive,
        canBeClassifiedAsRealLive: obs.dataStatus === 'REAL' && obs.isLive,
        rawResponseSnippet: rawSnippet,
        detailMessage,
        hasApiKeyConfigured: true,
        apiKeyMasked: maskedKey,
        observation: obs,
      };
    } catch (err: any) {
      clearTimeout(timer);
      const obs = await this.fetchRouteAssessment(routeCode);
      return {
        endpoint: endpointUrl,
        authenticationSucceeded: false,
        httpStatus: 0,
        returnedDataType: 'error',
        timestamp: retrievedAt,
        source: 'Baltic Exchange Market Data API (api.balticexchange.com)',
        provider: 'Baltic Exchange Direct API',
        dataStatus: 'UNAVAILABLE',
        isLive: false,
        canBeClassifiedAsRealLive: false,
        detailMessage: `Network or timeout error contacting Baltic Exchange endpoint: ${err.message}`,
        hasApiKeyConfigured: true,
        apiKeyMasked: maskedKey,
        observation: obs,
      };
    }
  }

  /**
   * Aggregates complete live market intelligence summary
   */
  async getLiveMarketSummary(): Promise<LiveMarketIntelligenceSummary> {
    const [bdi, bci, vlsfo, balticIndiaRoute] = await Promise.all([
      this.fetchBalticDryIndex(),
      this.fetchBalticCapesizeIndex(),
      this.fetchVlsfoBenchmark('Singapore'),
      this.fetchRouteAssessment('C5_AU_CN'),
    ]);

    const realCount = await this.repository.getObservationCount();
    const hasSufficient = realCount >= 52;

    const providerStatuses = [
      {
        providerId: 'oilprice-freight',
        providerName: 'OilPriceAPI Dry Bulk Freight Indices',
        endpoint: 'https://api.oilpriceapi.com/v1/prices/latest?by_code=BALTIC_DRY_INDEX',
        feedStatus: bdi.dataStatus === 'REAL' ? ('LIVE' as ProviderFeedStatus) : bdi.dataStatus === 'STALE' ? ('STALE' as ProviderFeedStatus) : ('UNAVAILABLE' as ProviderFeedStatus),
        hasApiKey: !!this.oilPriceApiKey,
        lastObservationTime: bdi.observedAt,
        statusDetail: bdi.dataStatus === 'REAL' ? 'Connected & streaming fresh benchmark index' : bdi.errorMessage || 'Feed unavailable',
      },
      {
        providerId: 'oilprice-bunker',
        providerName: 'OilPriceAPI Global Bunker Benchmarks',
        endpoint: 'https://api.oilpriceapi.com/v1/prices/latest?by_code=VLSFO_USD',
        feedStatus: vlsfo.dataStatus === 'REAL' ? ('LIVE' as ProviderFeedStatus) : vlsfo.dataStatus === 'STALE' ? ('STALE' as ProviderFeedStatus) : ('UNAVAILABLE' as ProviderFeedStatus),
        hasApiKey: !!this.oilPriceApiKey,
        lastObservationTime: vlsfo.observedAt,
        statusDetail: vlsfo.dataStatus === 'REAL' ? 'Connected & streaming fresh VLSFO' : vlsfo.errorMessage || 'Feed unavailable',
      },
      {
        providerId: 'baltic-exchange-direct',
        providerName: 'Baltic Exchange Direct Route Assessments (India Lanes)',
        endpoint: 'https://api.balticexchange.com/api/v1/feed/c5_au_cn/data',
        feedStatus: balticIndiaRoute.dataStatus === 'REAL' ? ('LIVE' as ProviderFeedStatus) : balticIndiaRoute.dataStatus === 'STALE' ? ('STALE' as ProviderFeedStatus) : ('UNAVAILABLE' as ProviderFeedStatus),
        hasApiKey: !!this.balticExchangeApiKey,
        lastObservationTime: balticIndiaRoute.observedAt,
        statusDetail: balticIndiaRoute.dataStatus === 'REAL'
          ? 'Connected & streaming authorized Baltic route assessments'
          : balticIndiaRoute.errorMessage || (this.balticExchangeApiKey ? 'Key configured; subscriber license rejected' : 'Subscriber license required (No scraping permitted)'),
      },
    ];

    return {
      bdi,
      bci,
      vlsfo,
      balticIndiaRoute,
      providerStatuses,
      realObservationsCount: realCount,
      historicalCoverageStatus: hasSufficient ? 'SUFFICIENT_FOR_TRAINING' : realCount > 0 ? 'PARTIAL' : 'UNAVAILABLE',
    };
  }
}

export const globalLiveMarketDataService = new LiveMarketDataService();

export interface BalticHistoricalIngestionResult {
  routeCode: string;
  totalParsed: number;
  ingested: RouteFreightObservationRecord[];
  rejected: { record: any; reason: string }[];
}

/**
 * Genuine Baltic Historical Feed Payload Ingestion:
 * Safely parses authenticated historical payload from Baltic Exchange Market Data API.
 * Enforces strict anti-synthetic governance: Rejects any synthetic or simulated records.
 */
export function ingestBalticHistoricalFeedPayload(
  payload: any,
  routeCode: string,
  options?: { sourceUrl?: string; retrievedAt?: string }
): BalticHistoricalIngestionResult {
  const routeSpec = getBalticRouteSpec(routeCode);
  if (!routeSpec) {
    throw new Error(
      `Validation Error: Unsupported or invalid Baltic route code '${routeCode}'. Must match official Baltic specifications (e.g. C18, P9, C5_AU_CN).`
    );
  }

  const retrievedAt = options?.retrievedAt || new Date().toISOString();
  const sourceUrl = options?.sourceUrl || routeSpec.endpointUrl;

  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.items)
    ? payload.items
    : payload && typeof payload === 'object'
    ? [payload]
    : [];

  const ingested: RouteFreightObservationRecord[] = [];
  const rejected: { record: any; reason: string }[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') {
      rejected.push({ record: item, reason: 'Invalid record item: not an object' });
      continue;
    }

    // Rule 1: Strict Anti-Synthetic policy rejection
    if (item.synthetic === true || item.dataStatus === 'SIMULATED' || item.provenance === 'SIMULATED') {
      rejected.push({
        record: item,
        reason: 'Policy Violation: Cannot persist synthetic observation. Verified-real repository strictly rejects synthetic=true.',
      });
      continue;
    }

    // Rule 2: Rate value validation
    const rate = typeof item.freightRateUsdPerMt === 'number'
      ? item.freightRateUsdPerMt
      : typeof item.rate === 'number'
      ? item.rate
      : typeof item.value === 'number'
      ? item.value
      : typeof item.price === 'number'
      ? item.price
      : null;

    if (rate === null || isNaN(rate) || rate <= 0) {
      rejected.push({
        record: item,
        reason: 'Validation Error: Missing or non-positive freightRateUsdPerMt.',
      });
      continue;
    }

    // Rule 3: Date validation
    const rawDate = item.date || item.observedAt || item.timestamp || item.createdOn;
    if (!rawDate) {
      rejected.push({
        record: item,
        reason: 'Validation Error: Missing observation date/timestamp.',
      });
      continue;
    }

    const dateStr = String(rawDate).slice(0, 10);
    const observedAt = String(rawDate).includes('T') ? String(rawDate) : `${dateStr}T12:00:00.000Z`;

    const now = Date.now();
    const observedTimestamp = new Date(observedAt).getTime();
    const ageMs = Math.abs(now - observedTimestamp);
    const isLive = ageMs <= 24 * 60 * 60 * 1000;
    const dataStatus: DataProvenanceType = isLive ? 'REAL' : 'STALE';

    const record: RouteFreightObservationRecord = {
      id: `baltic-hist-${routeSpec.routeCode}-${dateStr}-${observedAt}`,
      date: dateStr,
      provider: 'Baltic Exchange',
      routeCode: routeSpec.routeCode,
      origin: routeSpec.origin,
      destination: routeSpec.destination,
      vesselClass: routeSpec.vesselClass,
      cargoType: routeSpec.cargoType,
      cargoVolumeMt: routeSpec.cargoVolumeMt,
      freightRateUsdPerMt: Number(rate.toFixed(3)),
      currency: routeSpec.currency,
      sourceUrl,
      observedAt,
      retrievedAt,
      dataStatus,
      isLive,
      synthetic: false,
      provenance: dataStatus,
      rawPayloadSnippet: JSON.stringify(item).slice(0, 250),
    };

    ingested.push(record);
  }

  return {
    routeCode: routeSpec.routeCode,
    totalParsed: rawList.length,
    ingested,
    rejected,
  };
}

