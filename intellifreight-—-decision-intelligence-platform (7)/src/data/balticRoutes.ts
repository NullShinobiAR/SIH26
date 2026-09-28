/**
 * Official Baltic Exchange Route Specifications
 * Strictly aligned with official Baltic Exchange index and route definitions.
 * ZERO synthetic observations: Specifications provide schema, vessel class,
 * loading terms, and feed endpoints for genuine market ingestion.
 */

import { BalticRouteSpecification } from '../types';

export const BALTIC_ROUTE_SPECIFICATIONS: Record<'C18' | 'P9' | 'C5_AU_CN', BalticRouteSpecification> = {
  C18: {
    routeCode: 'C18',
    feedId: 'c18',
    title: 'Gladstone to Dhamra (Capesize Coal)',
    origin: 'Gladstone',
    destination: 'Dhamra',
    originPortId: 'au-gld',
    destinationPortId: 'in-dhm',
    vesselClass: 'Capesize',
    cargoType: 'Coal',
    cargoVolumeMt: 150000,
    cargoTolerancePct: 10,
    terms: 'Free in and out, trimmed',
    loadingTerms: 'Scale load, 12 hours turn time',
    dischargeTerms: '40,000 MT/day SHINC, 24 hours turn time',
    turnTimeHours: { load: 12, discharge: 24 },
    maxVesselAgeYears: 15,
    commissionPct: 5.0,
    currency: 'USD',
    rateUnit: 'USD/MT',
    trialStartDate: '2026-01-19',
    livePublicationDate: '2026-02-09',
    endpointUrl: 'https://api.balticexchange.com/api/v1/feed/c18/data',
  },
  P9: {
    routeCode: 'P9',
    feedId: 'p9',
    title: 'Gladstone to Dhamra (Panamax Coal)',
    origin: 'Gladstone',
    destination: 'Dhamra',
    originPortId: 'au-gld',
    destinationPortId: 'in-dhm',
    vesselClass: 'Panamax',
    cargoType: 'Coal',
    cargoVolumeMt: 80000,
    cargoTolerancePct: 10,
    terms: 'Free in and out, trimmed',
    loadingTerms: 'Scale load, 12 hours turn time',
    dischargeTerms: '40,000 MT/day SHINC, 24 hours turn time',
    turnTimeHours: { load: 12, discharge: 24 },
    maxVesselAgeYears: 15,
    commissionPct: 5.0,
    currency: 'USD',
    rateUnit: 'USD/MT',
    trialStartDate: '2026-01-19',
    livePublicationDate: '2026-02-09',
    endpointUrl: 'https://api.balticexchange.com/api/v1/feed/p9/data',
  },
  C5_AU_CN: {
    routeCode: 'C5_AU_CN',
    feedId: 'c5_au_cn',
    title: 'Western Australia to Qingdao (Capesize Iron Ore)',
    origin: 'Port Hedland / Dampier',
    destination: 'Qingdao',
    originPortId: 'au-phd',
    destinationPortId: 'cn-qnd',
    vesselClass: 'Capesize',
    cargoType: 'Iron Ore',
    cargoVolumeMt: 160000,
    cargoTolerancePct: 10,
    terms: 'Free in and out, trimmed',
    loadingTerms: 'Scale load, 12 hours turn time',
    dischargeTerms: '30,000 MT/day SHINC',
    turnTimeHours: { load: 12, discharge: 24 },
    maxVesselAgeYears: 15,
    commissionPct: 3.75,
    currency: 'USD',
    rateUnit: 'USD/MT',
    trialStartDate: '2010-01-01',
    livePublicationDate: '2010-01-01',
    endpointUrl: 'https://api.balticexchange.com/api/v1/feed/c5_au_cn/data',
  },
};

export function getBalticRouteSpec(routeCode: string): BalticRouteSpecification | null {
  if (!routeCode) return null;
  const normalized = routeCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (normalized === 'C18' || normalized === 'C18_AU_IN') return BALTIC_ROUTE_SPECIFICATIONS.C18;
  if (normalized === 'P9' || normalized === 'P9_AU_IN') return BALTIC_ROUTE_SPECIFICATIONS.P9;
  if (normalized === 'C5' || normalized === 'C5_AU_CN') return BALTIC_ROUTE_SPECIFICATIONS.C5_AU_CN;
  return null;
}

export function isValidBalticRoute(routeCode: string): boolean {
  return getBalticRouteSpec(routeCode) !== null;
}
