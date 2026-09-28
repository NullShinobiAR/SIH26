import fs from 'fs';
import path from 'path';
import { RealMarketObservationRecord } from '../types';

export interface IRealObservationRepository {
  save(record: RealMarketObservationRecord): Promise<void>;
  getAll(): Promise<RealMarketObservationRecord[]>;
  getByCode(symbolOrCode: string): Promise<RealMarketObservationRecord[]>;
  getLatest(symbolOrCode: string): Promise<RealMarketObservationRecord | null>;
  getLatestObservations(limit?: number): Promise<RealMarketObservationRecord[]>;
  getObservationCount(): Promise<number>;
  getStorageType(): 'DISK_FILE' | 'MEMORY';
  getDiagnostic(): Promise<{
    totalCount: number;
    verifiedObservationCount: number;
    storageType: 'DISK_FILE' | 'MEMORY';
    storageFilePath: string | null;
    uniqueInstruments: string[];
    providers: string[];
    latestObservations: RealMarketObservationRecord[];
    oldestObservationTime: string | null;
    newestObservationTime: string | null;
  }>;
  getComparison(
    symbolOrCode: string,
    currentObservedAt: string
  ): Promise<{ previous: number | null; change7d: number | null; change30d: number | null }>;
  hasSufficientHistoricalObservations(symbolOrCode: string, minRequiredObservations?: number): Promise<{
    hasSufficient: boolean;
    currentCount: number;
    requiredCount: number;
    reason: string;
  }>;
  clear(): Promise<void>;
}

/**
 * Computes a deterministic deduplication key for market observations.
 * Form: provider::symbolOrCode::observedAt
 */
export function computeObservationDedupeKey(record: {
  provider?: string;
  symbolOrCode?: string;
  observedAt: string;
}): string {
  const provider = (record.provider || 'UNKNOWN').trim().toLowerCase();
  const instrument = (record.symbolOrCode || '').trim().toUpperCase();
  const dateObj = new Date(record.observedAt);
  const observedAt = isNaN(dateObj.getTime()) ? String(record.observedAt).trim() : dateObj.toISOString();
  return `${provider}::${instrument}::${observedAt}`;
}

/**
 * DurableRealObservationRepository:
 * Durable local storage for genuine timestamped external market observations.
 * Retains previously persisted observations across backend restarts via a JSON store.
 * Strictly enforces anti-synthetic policy: rejects SIMULATED, STALE, DERIVED, or ASSUMPTION records.
 * Deduplicates records using deterministic (provider + instrument + observedAt) keys.
 */
export class DurableRealObservationRepository implements IRealObservationRepository {
  protected records: RealMarketObservationRecord[] = [];
  protected storageFilePath: string | null = null;

  constructor(
    initialRecords: RealMarketObservationRecord[] = [],
    storageFilePath?: string | null
  ) {
    if (storageFilePath === undefined) {
      this.storageFilePath = path.join(process.cwd(), 'data', 'real_observations_store.json');
    } else {
      this.storageFilePath = storageFilePath;
    }

    if (this.storageFilePath) {
      this.loadFromDisk();
    }

    if (initialRecords && initialRecords.length > 0) {
      for (const rec of initialRecords) {
        if (rec.dataStatus === 'REAL' && rec.synthetic !== true) {
          const dedupeKey = computeObservationDedupeKey(rec);
          const idx = this.records.findIndex((r) => computeObservationDedupeKey(r) === dedupeKey);
          const cleaned: RealMarketObservationRecord = { ...rec, synthetic: false };
          if (idx >= 0) {
            this.records[idx] = cleaned;
          } else {
            this.records.unshift(cleaned);
          }
        }
      }
      if (this.storageFilePath) {
        this.persistToDisk();
      }
    }
  }

  async save(record: RealMarketObservationRecord): Promise<void> {
    // Rule 1: Strict policy check - reject SIMULATED or synthetic=true
    if (record.synthetic === true || record.dataStatus === 'SIMULATED') {
      throw new Error('Policy Violation: Simulated data cannot be persisted to RealObservationRepository.');
    }
    // Rule 2: Do not persist STALE, SIMULATED, DERIVED, or ASSUMPTION observations as verified-real observations
    if (record.dataStatus !== 'REAL') {
      throw new Error(
        `Policy Violation: Cannot persist observation with dataStatus '${record.dataStatus}'. Only verified REAL observations can be persisted to RealObservationRepository.`
      );
    }
    // Rule 3: Valid positive numeric value
    if (typeof record.value !== 'number' || isNaN(record.value) || record.value <= 0) {
      throw new Error('Validation Error: Observation value must be a positive number.');
    }
    // Rule 4: Timestamp validation
    if (!record.observedAt || isNaN(new Date(record.observedAt).getTime())) {
      throw new Error('Validation Error: Observation must have a valid ISO observedAt timestamp.');
    }
    // Rule 5: Symbol validation
    if (!record.symbolOrCode || typeof record.symbolOrCode !== 'string' || !record.symbolOrCode.trim()) {
      throw new Error('Validation Error: Observation must have a non-empty symbolOrCode.');
    }

    const dedupeKey = computeObservationDedupeKey(record);
    const existingIndex = this.records.findIndex((r) => computeObservationDedupeKey(r) === dedupeKey);
    const deterministicId = `real-${(record.provider || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_')}-${record.symbolOrCode.toLowerCase().replace(/[^a-z0-9_]/g, '_')}-${new Date(record.observedAt).getTime()}`;

    const cleanedRecord: RealMarketObservationRecord = {
      ...record,
      id: record.id || deterministicId,
      synthetic: false,
      dataStatus: 'REAL',
    };

    if (existingIndex >= 0) {
      // Deduplicate: update existing record in-place without creating a duplicate or increasing count
      this.records[existingIndex] = {
        ...this.records[existingIndex],
        ...cleanedRecord,
        id: this.records[existingIndex].id,
      };
    } else {
      this.records.unshift(cleanedRecord);
    }

    this.persistToDisk();
  }

  async getAll(): Promise<RealMarketObservationRecord[]> {
    return [...this.records];
  }

  async getByCode(symbolOrCode: string): Promise<RealMarketObservationRecord[]> {
    return this.records
      .filter((r) => r.symbolOrCode.toUpperCase() === symbolOrCode.toUpperCase())
      .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
  }

  async getLatest(symbolOrCode: string): Promise<RealMarketObservationRecord | null> {
    const list = await this.getByCode(symbolOrCode);
    return list.length > 0 ? { ...list[0] } : null;
  }

  async getLatestObservations(limit = 20): Promise<RealMarketObservationRecord[]> {
    return [...this.records]
      .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
      .slice(0, limit);
  }

  async getObservationCount(): Promise<number> {
    return this.records.length;
  }

  getStorageType(): 'DISK_FILE' | 'MEMORY' {
    return this.storageFilePath ? 'DISK_FILE' : 'MEMORY';
  }

  async getDiagnostic(): Promise<{
    totalCount: number;
    verifiedObservationCount: number;
    storageType: 'DISK_FILE' | 'MEMORY';
    storageFilePath: string | null;
    uniqueInstruments: string[];
    providers: string[];
    latestObservations: RealMarketObservationRecord[];
    oldestObservationTime: string | null;
    newestObservationTime: string | null;
  }> {
    const records = await this.getAll();
    const count = records.length;
    const latest = await this.getLatestObservations(10);
    const instruments = Array.from(new Set(records.map((r) => r.symbolOrCode)));
    const providers = Array.from(new Set(records.map((r) => r.provider)));
    const times = records.map((r) => new Date(r.observedAt).getTime()).filter((t) => !isNaN(t));

    return {
      totalCount: count,
      verifiedObservationCount: count,
      storageType: this.storageFilePath ? 'DISK_FILE' : 'MEMORY',
      storageFilePath: this.storageFilePath,
      uniqueInstruments: instruments,
      providers,
      latestObservations: latest,
      oldestObservationTime: times.length > 0 ? new Date(Math.min(...times)).toISOString() : null,
      newestObservationTime: times.length > 0 ? new Date(Math.max(...times)).toISOString() : null,
    };
  }

  /**
   * Computes authentic comparisons strictly from empirical saved observations.
   * If past observations do not exist in the repository, returns null (never fabricates comparisons).
   */
  async getComparison(
    symbolOrCode: string,
    currentObservedAt: string
  ): Promise<{ previous: number | null; change7d: number | null; change30d: number | null }> {
    const history = await this.getByCode(symbolOrCode);
    const currentTime = new Date(currentObservedAt).getTime();

    // Past observations strictly before the current one
    const pastRecords = history.filter((r) => new Date(r.observedAt).getTime() < currentTime);

    if (pastRecords.length === 0) {
      return { previous: null, change7d: null, change30d: null };
    }

    const previous = pastRecords[0].value;

    // 7-day observation (target timestamp ~ 7 days prior: 7 * 86400 * 1000)
    const sevenDaysAgoTime = currentTime - 7 * 86400 * 1000;
    const thirtyDaysAgoTime = currentTime - 30 * 86400 * 1000;

    // Find observation closest to 7 days ago (within a 3-day window)
    const sevenDayRecord = pastRecords.find(
      (r) => Math.abs(new Date(r.observedAt).getTime() - sevenDaysAgoTime) < 3 * 86400 * 1000
    );

    // Find observation closest to 30 days ago (within a 7-day window)
    const thirtyDayRecord = pastRecords.find(
      (r) => Math.abs(new Date(r.observedAt).getTime() - thirtyDaysAgoTime) < 7 * 86400 * 1000
    );

    return {
      previous,
      change7d: sevenDayRecord ? Number(((pastRecords[0].value - sevenDayRecord.value) / sevenDayRecord.value * 100).toFixed(2)) : null,
      change30d: thirtyDayRecord ? Number(((pastRecords[0].value - thirtyDayRecord.value) / thirtyDayRecord.value * 100).toFixed(2)) : null,
    };
  }

  async hasSufficientHistoricalObservations(
    symbolOrCode: string,
    minRequiredObservations = 52
  ): Promise<{
    hasSufficient: boolean;
    currentCount: number;
    requiredCount: number;
    reason: string;
  }> {
    const series = await this.getByCode(symbolOrCode);
    const count = series.length;
    if (count < minRequiredObservations) {
      return {
        hasSufficient: false,
        currentCount: count,
        requiredCount: minRequiredObservations,
        reason: `Insufficient real historical data: ${count}/${minRequiredObservations} observations collected. Automated model retraining blocked to avoid overfitting on sparse observations.`,
      };
    }
    return {
      hasSufficient: true,
      currentCount: count,
      requiredCount: minRequiredObservations,
      reason: `Sufficient real historical coverage: ${count} verified observations available.`,
    };
  }

  async clear(): Promise<void> {
    this.records = [];
    if (this.storageFilePath && fs.existsSync(this.storageFilePath)) {
      try {
        fs.unlinkSync(this.storageFilePath);
      } catch {
        // ignore
      }
    }
  }

  protected loadFromDisk(): void {
    if (!this.storageFilePath) return;
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const content = fs.readFileSync(this.storageFilePath, 'utf-8');
        if (content && content.trim()) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (
                item &&
                item.dataStatus === 'REAL' &&
                item.synthetic !== true &&
                typeof item.value === 'number' &&
                item.value > 0
              ) {
                const key = computeObservationDedupeKey(item);
                const exists = this.records.some((r) => computeObservationDedupeKey(r) === key);
                if (!exists) {
                  this.records.push({ ...item, synthetic: false });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load real observations from disk:', err);
    }
  }

  protected persistToDisk(): void {
    if (!this.storageFilePath) {
      this.syncToBrowserStorage();
      return;
    }
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.storageFilePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.records, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.storageFilePath);
    } catch {
      try {
        fs.writeFileSync(this.storageFilePath, JSON.stringify(this.records, null, 2), 'utf-8');
      } catch (err) {
        console.warn('Failed to persist real observations to disk:', err);
      }
    }
  }

  private syncToBrowserStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('intellifreight_real_observations', JSON.stringify(this.records));
      } catch {
        // Storage quota guard
      }
    }
  }
}

/**
 * InMemoryRealObservationRepository:
 * Backward-compatible class defaulting to in-memory mode for unit tests
 * or optionally accepting a custom durable storageFilePath.
 */
export class InMemoryRealObservationRepository extends DurableRealObservationRepository {
  constructor(initialRecords: RealMarketObservationRecord[] = [], storageFilePath: string | null = null) {
    super(initialRecords, storageFilePath);
  }
}

export { DurableRealObservationRepository as RealObservationRepository };

export const globalRealObservationRepository = new DurableRealObservationRepository();

