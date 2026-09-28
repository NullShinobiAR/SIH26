/**
 * Route Freight Observation Repository
 * Durable in-memory storage for verified external route-specific freight fixtures.
 *
 * GOVERNANCE RULES:
 * 1. Zero synthetic insertion: Never pre-populates or generates artificial observations for C18 or P9.
 * 2. Strict rejection of synthetic observations: Any record with synthetic=true or
 *    dataStatus='SIMULATED' is immediately rejected.
 * 3. Validation against official route specifications: Records must match verified routes.
 * 4. Missing value checks: Positive numeric rate required for REAL observations.
 */

import { RouteFreightObservationRecord, IRouteFreightObservationRepository } from '../types';
import { isValidBalticRoute } from './balticRoutes';

export class InMemoryRouteFreightObservationRepository implements IRouteFreightObservationRepository {
  private records: RouteFreightObservationRecord[] = [];

  constructor(initialRecords: RouteFreightObservationRecord[] = []) {
    // Only accept verified records passed in; never fabricate
    for (const rec of initialRecords) {
      this.validateRecord(rec);
      this.records.push({ ...rec });
    }
  }

  /**
   * Validates integrity and anti-synthetic policy for an observation.
   * Throws Error on any violation.
   */
  public validateRecord(record: RouteFreightObservationRecord): void {
    if (!record) {
      throw new Error('Validation Error: Observation record is null or undefined.');
    }

    // Rule 1: Reject synthetic records
    if (record.synthetic === true) {
      throw new Error(
        `Policy Violation: Cannot persist synthetic observation for route ${record.routeCode}. Verified-real repository strictly rejects synthetic=true.`
      );
    }

    if (record.dataStatus === 'SIMULATED' || record.provenance === 'SIMULATED') {
      throw new Error(
        `Policy Violation: Cannot persist record with dataStatus/provenance SIMULATED for route ${record.routeCode}.`
      );
    }

    // Rule 2: Validate route code
    if (!record.routeCode || !isValidBalticRoute(record.routeCode)) {
      throw new Error(
        `Validation Error: Unsupported or invalid Baltic route code '${record.routeCode}'. Must be a verified Baltic route (e.g. C18, P9, C5_AU_CN).`
      );
    }

    // Rule 3: Validate freight rate for REAL observations
    if (record.dataStatus === 'REAL') {
      if (
        record.freightRateUsdPerMt === null ||
        record.freightRateUsdPerMt === undefined ||
        isNaN(record.freightRateUsdPerMt) ||
        record.freightRateUsdPerMt <= 0
      ) {
        throw new Error(
          `Validation Error: Real observation for route ${record.routeCode} must contain a positive numeric freightRateUsdPerMt. Received: ${record.freightRateUsdPerMt}`
        );
      }
    }

    // Rule 4: Validate dates
    if (!record.date || record.date.trim() === '') {
      throw new Error(`Validation Error: Record date is required (YYYY-MM-DD).`);
    }

    if (!record.observedAt || isNaN(Date.parse(record.observedAt))) {
      throw new Error(`Validation Error: Invalid observedAt timestamp '${record.observedAt}'.`);
    }
  }

  async save(record: RouteFreightObservationRecord): Promise<void> {
    this.validateRecord(record);

    const cleanRoute = record.routeCode.toUpperCase();
    const id = record.id || `${cleanRoute}-${record.date}-${record.observedAt}`;

    const normalizedRecord: RouteFreightObservationRecord = {
      ...record,
      id,
      routeCode: cleanRoute,
    };

    // Deduplicate by routeCode and date
    const existingIndex = this.records.findIndex(
      (r) => r.routeCode === cleanRoute && (r.id === id || r.date === record.date)
    );

    if (existingIndex >= 0) {
      this.records[existingIndex] = normalizedRecord;
    } else {
      this.records.unshift(normalizedRecord);
    }
    this.syncToStorage();
  }

  async saveBatch(
    records: RouteFreightObservationRecord[]
  ): Promise<{ savedCount: number; rejectedCount: number }> {
    let savedCount = 0;
    let rejectedCount = 0;

    for (const rec of records) {
      try {
        await this.save(rec);
        savedCount++;
      } catch {
        rejectedCount++;
      }
    }

    return { savedCount, rejectedCount };
  }

  async getAll(): Promise<RouteFreightObservationRecord[]> {
    return [...this.records];
  }

  async getByRoute(routeCode: string): Promise<RouteFreightObservationRecord[]> {
    if (!routeCode) return [];
    const clean = routeCode.toUpperCase();
    return this.records
      .filter((r) => r.routeCode === clean)
      .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
  }

  async getLatestByRoute(routeCode: string): Promise<RouteFreightObservationRecord | null> {
    const list = await this.getByRoute(routeCode);
    return list.length > 0 ? { ...list[0] } : null;
  }

  async getCount(routeCode?: string): Promise<number> {
    if (!routeCode) return this.records.length;
    const clean = routeCode.toUpperCase();
    return this.records.filter((r) => r.routeCode === clean).length;
  }

  /**
   * Synchronous helper for forecasting engine and real-time gate evaluation
   */
  getRecordsSync(routeCode?: string): RouteFreightObservationRecord[] {
    if (!routeCode) return [...this.records];
    const clean = routeCode.toUpperCase();
    return this.records
      .filter((r) => r.routeCode === clean)
      .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
  }

  getCountSync(routeCode?: string): number {
    if (!routeCode) return this.records.length;
    const clean = routeCode.toUpperCase();
    return this.records.filter((r) => r.routeCode === clean).length;
  }

  async getDateRange(
    routeCode: string,
    fromDate?: string,
    toDate?: string
  ): Promise<RouteFreightObservationRecord[]> {
    const list = await this.getByRoute(routeCode);
    if (!fromDate && !toDate) return list;

    const fromTime = fromDate ? new Date(fromDate).getTime() : -Infinity;
    const toTime = toDate ? new Date(toDate).getTime() : Infinity;

    return list.filter((r) => {
      const recTime = new Date(r.date).getTime();
      return recTime >= fromTime && recTime <= toTime;
    });
  }

  /**
   * Clears in-memory records (used in test isolation).
   */
  public clear(): void {
    this.records = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem('intellifreight_route_freight_observations');
      } catch {
        // storage guard
      }
    }
  }

  private syncToStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          'intellifreight_route_freight_observations',
          JSON.stringify(this.records)
        );
      } catch {
        // Quota guard
      }
    }
  }
}

export const globalRouteFreightObservationRepository = new InMemoryRouteFreightObservationRepository();
