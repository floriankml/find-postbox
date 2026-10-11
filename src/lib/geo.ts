import type { BBox, LatLon } from './types'

const R = 6371008.8

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatDistance(m: number): string {
  if (!Number.isFinite(m)) return ''
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`
  if (m < 10000) return `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`
  return `${Math.round(m / 1000).toLocaleString('de-DE')} km`
}

/** Rough walking time at 4.8 km/h. */
export function walkingMinutes(m: number): number {
  return Math.max(1, Math.round(m / 80))
}

export function isValidLatLon(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  )
}

/** Size of a cache tile in degrees. ~2 km in mid latitudes. */
export const TILE_DEG = 0.02

export function tileKey(x: number, y: number): string {
  return `${x}:${y}`
}

export interface TileRange {
  x0: number
  x1: number
  y0: number
  y1: number
}

export function tileRangeForBBox(b: BBox): TileRange {
  return {
    x0: Math.floor(b.west / TILE_DEG),
    x1: Math.floor(b.east / TILE_DEG),
    y0: Math.floor(b.south / TILE_DEG),
    y1: Math.floor(b.north / TILE_DEG),
  }
}

export function tilesInRange(r: TileRange): string[] {
  const keys: string[] = []
  for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) keys.push(tileKey(x, y))
  return keys
}

export function tileOfPoint(p: LatLon): string {
  return tileKey(Math.floor(p.lon / TILE_DEG), Math.floor(p.lat / TILE_DEG))
}

export function parseTileKey(k: string): { x: number; y: number } {
  const [x, y] = k.split(':').map(Number)
  return { x, y }
}

/** Bounding box that exactly covers the given tiles. */
export function bboxOfTiles(keys: string[]): BBox {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity
  for (const k of keys) {
    const { x, y } = parseTileKey(k)
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  // Round to avoid float noise like 13.379999999 in the Overpass query.
  const r = (n: number) => Math.round(n * 1e6) / 1e6
  return {
    south: r(y0 * TILE_DEG),
    west: r(x0 * TILE_DEG),
    north: r((y1 + 1) * TILE_DEG),
    east: r((x1 + 1) * TILE_DEG),
  }
}

/** Bounding box of a circle (used for radius filters). */
export function bboxAround(c: LatLon, radiusM: number): BBox {
  const dLat = radiusM / 111320
  const dLon = radiusM / (111320 * Math.max(0.01, Math.cos((c.lat * Math.PI) / 180)))
  return { south: c.lat - dLat, north: c.lat + dLat, west: c.lon - dLon, east: c.lon + dLon }
}

export function bboxContains(b: BBox, p: LatLon): boolean {
  return p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east
}
