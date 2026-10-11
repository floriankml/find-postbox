import { ageInDays } from './labels'
import { distanceMeters } from './geo'
import type { LatLon, Postbox, ShippingStatus, BBox } from './types'
import { bboxContains } from './geo'

export interface Filters {
  /** Radius in metres around the reference point, or null = current map view. */
  radius: number | null
  shipping: 'all' | Exclude<ShippingStatus, 'unknown'>
  operator: string
  open24: boolean
  hasCollectionTimes: boolean
  recentlyChecked: boolean
}

export const DEFAULT_FILTERS: Filters = {
  radius: null,
  shipping: 'all',
  operator: '',
  open24: false,
  hasCollectionTimes: false,
  recentlyChecked: false,
}

export const RECENT_DAYS = 2 * 365

export const RADIUS_OPTIONS = [500, 1000, 3000, 5000]

export function operatorName(p: Postbox): string | undefined {
  return p.operator ?? p.brand
}

export function isRecentlyChecked(p: Postbox, now = Date.now()): boolean {
  return !!p.lastChecked && ageInDays(p.lastChecked.date, now) <= RECENT_DAYS
}

export interface ResultItem {
  box: Postbox
  distance: number
}

export function applyFilters(
  boxes: Iterable<Postbox>,
  f: Filters,
  ref: LatLon,
  view: BBox | null,
): ResultItem[] {
  const out: ResultItem[] = []
  for (const box of boxes) {
    const distance = distanceMeters(ref, box)
    if (f.radius !== null) {
      if (distance > f.radius) continue
    } else if (view && !bboxContains(view, box)) continue
    if (f.shipping !== 'all' && box.shipping.status !== f.shipping) continue
    if (f.operator && operatorName(box) !== f.operator) continue
    if (f.open24 && !(box.access.kind === '24/7' || box.access.kind === 'outdoor')) continue
    if (f.hasCollectionTimes && !box.collectionTimes) continue
    if (f.recentlyChecked && !isRecentlyChecked(box)) continue
    out.push({ box, distance })
  }
  out.sort((a, b) => a.distance - b.distance)
  return out
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.shipping !== 'all' ? 1 : 0) +
    (f.operator ? 1 : 0) +
    (f.open24 ? 1 : 0) +
    (f.hasCollectionTimes ? 1 : 0) +
    (f.recentlyChecked ? 1 : 0)
  )
}

/** Most common operators among loaded boxes (for the filter dropdown). */
export function topOperators(boxes: Iterable<Postbox>, limit = 30): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const b of boxes) {
    const n = operatorName(b)
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
