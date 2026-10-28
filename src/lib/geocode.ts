import { getLang, t } from '../i18n'
import { kvGet, kvSet } from './store'
import type { BBox, LatLon } from './types'

export interface Place {
  id: string
  label: string
  detail?: string
  lat: number
  lon: number
  bbox?: BBox
  source: 'photon' | 'nominatim' | 'coordinates'
}

const CACHE_MS = 7 * 24 * 60 * 60 * 1000
const memCache = new Map<string, Place[]>()

/** Parse "52.52, 13.40" style input. */
export function parseCoordinates(q: string): Place | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(q)
  if (!m) return null
  const lat = Number(m[1])
  const lon = Number(m[2])
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { id: `coord:${lat},${lon}`, label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, detail: t('search.coordinates'), lat, lon, source: 'coordinates' }
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_type?: string
    osm_id?: number
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    district?: string
    state?: string
    country?: string
    extent?: [number, number, number, number]
    type?: string
  }
}

function photonLabel(p: PhotonFeature['properties']): { label: string; detail: string } {
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const label = p.name || street || p.postcode || p.city || t('search.unnamed')
  const parts = [p.name && street ? street : null, [p.postcode, p.city].filter(Boolean).join(' '), p.state, p.country]
  const detail = parts.filter((x) => x && x !== label).join(', ')
  return { label, detail }
}

async function photon(q: string, near: LatLon | null, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q, limit: '6', lang: getLang() })
  if (near) {
    params.set('lat', near.lat.toFixed(3))
    params.set('lon', near.lon.toFixed(3))
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal })
  if (!res.ok) throw new Error(`Photon ${res.status}`)
  const json = (await res.json()) as { features: PhotonFeature[] }
  return json.features.map((f, i) => {
    const [lon, lat] = f.geometry.coordinates
    const { label, detail } = photonLabel(f.properties)
    const e = f.properties.extent
    return {
      id: `photon:${f.properties.osm_type}${f.properties.osm_id ?? i}`,
      label,
      detail,
      lat,
      lon,
      bbox: e ? { west: e[0], north: e[1], east: e[2], south: e[3] } : undefined,
      source: 'photon' as const,
    }
  })
}

interface NominatimResult {
  place_id: number
  lat: string
  lon: string
  name?: string
  display_name: string
  boundingbox?: [string, string, string, string]
}

/** Nominatim usage policy: max 1 request/s, no autocomplete → only used on explicit submit. */
let lastNominatim = 0
async function nominatimThrottle() {
  const wait = lastNominatim + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastNominatim = Date.now()
}

async function nominatim(q: string, signal?: AbortSignal): Promise<Place[]> {
  await nominatimThrottle()
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', 'accept-language': getLang() })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const json = (await res.json()) as NominatimResult[]
  return json.map((r) => {
    const [label, ...rest] = r.display_name.split(', ')
    const bb = r.boundingbox
    return {
      id: `nominatim:${r.place_id}`,
      label: r.name || label,
      detail: rest.join(', '),
      lat: Number(r.lat),
      lon: Number(r.lon),
      bbox: bb ? { south: Number(bb[0]), north: Number(bb[1]), west: Number(bb[2]), east: Number(bb[3]) } : undefined,
      source: 'nominatim' as const,
    }
  })
}

/**
 * Search places. `explicit` = user pressed Enter (allows the Nominatim fallback,
 * which must not be used for search-as-you-type).
 */
export async function searchPlaces(
  q: string,
  opts: { near: LatLon | null; explicit: boolean; signal?: AbortSignal },
): Promise<Place[]> {
  const query = q.trim()
  const coord = parseCoordinates(query)
  if (coord) return [coord]
  if (query.length < 3) return []
  const key = `geo:${getLang()}:${query.toLowerCase()}`
  const cached = memCache.get(key) ?? (await kvGet<Place[]>(key, CACHE_MS))
  if (cached && cached.length > 0) return cached
  let results: Place[] = []
  let photonFailed = false
  try {
    results = await photon(query, opts.near, opts.signal)
  } catch (e) {
    if (opts.signal?.aborted) throw e
    photonFailed = true
  }
  if (results.length === 0 && opts.explicit) {
    results = await nominatim(query, opts.signal)
  } else if (photonFailed) {
    throw new Error('Geocoding unavailable')
  }
  if (results.length > 0) {
    memCache.set(key, results)
    void kvSet(key, results)
  }
  return results
}

const reverseCache = new Map<string, string | null>()

/** Approximate address for a point (on demand, cached, throttled). */
export async function reverseGeocode(p: LatLon, signal?: AbortSignal): Promise<string | null> {
  const key = `rev:${getLang()}:${p.lat.toFixed(5)},${p.lon.toFixed(5)}`
  if (reverseCache.has(key)) return reverseCache.get(key)!
  const cached = await kvGet<string | null>(key, CACHE_MS * 4)
  if (cached !== undefined) return cached
  await nominatimThrottle()
  const params = new URLSearchParams({
    lat: String(p.lat),
    lon: String(p.lon),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
    'accept-language': getLang(),
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { signal })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const json = (await res.json()) as {
    address?: Record<string, string>
    display_name?: string
  }
  const a = json.address ?? {}
  const street = [a.road ?? a.pedestrian ?? a.footway ?? a.square, a.house_number].filter(Boolean).join(' ')
  const city = [a.postcode, a.city ?? a.town ?? a.village ?? a.municipality].filter(Boolean).join(' ')
  const label = [street, city].filter(Boolean).join(', ') || json.display_name || null
  reverseCache.set(key, label)
  void kvSet(key, label)
  return label
}
