import { isValidLatLon } from './geo'
import { detectShipping } from './shipping'
import type { AccessInfo, BBox, CheckDate, Postbox, PostboxProvider } from './types'

export interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
  timestamp?: string
}

const DEFAULT_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

export function overpassEndpoints(): string[] {
  const env = import.meta.env?.VITE_OVERPASS_ENDPOINTS as string | undefined
  const list = env
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return list && list.length > 0 ? list : DEFAULT_ENDPOINTS
}

export function buildQuery(b: BBox): string {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`
  // `out center meta` returns the last edit timestamp; ways/relations get a centre point.
  // Disused/removed boxes use other keys (disused:amenity) and are therefore not returned.
  return `[out:json][timeout:25][maxsize:33554432];nwr["amenity"="post_box"](${bbox});out center meta qt 5000;`
}

function accessInfo(tags: Record<string, string>): AccessInfo {
  const oh = tags.opening_hours
  const indoor = tags.indoor === 'yes' || tags['post_box:location'] === 'indoor' || tags.location === 'indoor'
  const level = tags.level
  const access = tags.access?.toLowerCase()
  if (oh && /^24\/7$/.test(oh.trim())) return { kind: '24/7', openingHours: oh, indoor, level }
  if (access === 'private' || access === 'no' || access === 'customers' || access === 'employees' || access === 'residents') {
    return { kind: 'restricted', reason: access, openingHours: oh, indoor, level }
  }
  if (indoor || oh) {
    return { kind: 'restricted', reason: oh ? 'opening_hours' : 'indoor', openingHours: oh, indoor, level }
  }
  const outdoorType = ['pillar', 'wall', 'lamp', 'drive_through'].includes(tags['post_box:type'] ?? '')
  if (tags.indoor === 'no' || outdoorType) return { kind: 'outdoor', indoor: false, level }
  return { kind: 'unknown', level }
}

function latestCheckDate(tags: Record<string, string>): CheckDate | undefined {
  const candidates: CheckDate[] = []
  const add = (k: string, kind: CheckDate['kind']) => {
    const v = tags[k]?.trim()
    if (v && /^\d{4}(-\d{2}(-\d{2})?)?/.test(v)) candidates.push({ date: v.slice(0, 10), kind })
  }
  add('check_date:collection_times', 'collection_times')
  add('check_date', 'general')
  add('survey:date', 'survey')
  add('survey_date', 'survey')
  candidates.sort((a, b) => b.date.localeCompare(a.date))
  return candidates[0]
}

function formatAddress(tags: Record<string, string>): string | undefined {
  const street = [tags['addr:street'] ?? tags['addr:place'], tags['addr:housenumber']].filter(Boolean).join(' ')
  const city = [tags['addr:postcode'] ?? tags.postal_code, tags['addr:city']].filter(Boolean).join(' ')
  // A postcode alone is not an address – then the UI falls back to ref / reverse geocoding.
  if (!street) return undefined
  return [street, city].filter(Boolean).join(', ')
}

/** Convert one Overpass element into our model. Returns null for unusable records. */
export function normalizeOsmElement(el: OverpassElement, fetchedAt = Date.now()): Postbox | null {
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (!isValidLatLon(lat, lon)) return null
  const tags = el.tags ?? {}
  if (tags.amenity !== 'post_box') return null
  const apertures = Number.parseInt(tags['post_box:apertures'] ?? '', 10)
  const sourceRef = `${el.type}/${el.id}`
  return {
    id: `osm:${sourceRef}`,
    source: 'osm',
    sourceRef,
    lat: lat as number,
    lon: lon as number,
    tags,
    name: tags.name || undefined,
    ref: tags.ref || undefined,
    address: formatAddress(tags),
    operator: tags.operator || undefined,
    brand: tags.brand || undefined,
    boxType: tags['post_box:type'] || undefined,
    colour: tags.colour || tags['post_box:colour'] || undefined,
    collectionTimes: tags.collection_times || undefined,
    collectionTimesSigned: tags['collection_times:signed'] || undefined,
    apertures: Number.isFinite(apertures) ? apertures : undefined,
    inscription: tags.inscription || tags['post_box:inscription'] || undefined,
    shipping: detectShipping(tags),
    access: accessInfo(tags),
    lastChecked: latestCheckDate(tags),
    lastEdit: el.timestamp,
    fetchedAt,
  }
}

/** `message` is for developers; the UI shows a translated text based on `kind`. */
export class DataSourceError extends Error {
  readonly kind: 'rate_limit' | 'timeout' | 'network' | 'server' | 'too_large'
  constructor(kind: DataSourceError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

/** Remember which endpoint worked last to avoid hammering a failing one. */
let preferredEndpoint = 0

async function fetchOverpass(query: string, signal?: AbortSignal): Promise<OverpassElement[]> {
  const endpoints = overpassEndpoints()
  let lastError: DataSourceError = new DataSourceError('network', 'No Overpass server reachable')
  // Two rounds over all endpoints; public Overpass servers are often briefly overloaded.
  for (let i = 0; i < endpoints.length * 2; i++) {
    if (i === endpoints.length) await new Promise((r) => setTimeout(r, 2000))
    if (signal?.aborted) throw signal.reason
    const idx = (preferredEndpoint + i) % endpoints.length
    const url = `${endpoints[idx]}?data=${encodeURIComponent(query)}`
    const timeout = AbortSignal.timeout(35000)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
    try {
      // GET avoids a CORS preflight; Overpass supports it for short queries.
      const res = await fetch(url, { signal: combined })
      if (res.status === 429) {
        lastError = new DataSourceError('rate_limit', 'Rate limited (HTTP 429)')
        continue
      }
      if (res.status === 504) {
        lastError = new DataSourceError('timeout', 'Timeout')
        continue
      }
      if (!res.ok) {
        lastError = new DataSourceError('server', `HTTP ${res.status}`)
        continue
      }
      const json = (await res.json()) as { elements?: OverpassElement[]; remark?: string }
      if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) {
        lastError = new DataSourceError(
          /memory/i.test(json.remark) ? 'too_large' : 'timeout',
          json.remark,
        )
        continue
      }
      preferredEndpoint = idx
      return json.elements ?? []
    } catch (e) {
      if (signal?.aborted) throw e
      lastError =
        e instanceof DOMException && e.name === 'TimeoutError'
          ? new DataSourceError('timeout', 'Timeout')
          : new DataSourceError('network', 'Network error')
    }
  }
  throw lastError
}

export const osmProvider: PostboxProvider = {
  id: 'osm',
  name: 'OpenStreetMap',
  attribution: '© OpenStreetMap-Mitwirkende (ODbL)',
  async fetchBBox(bbox, signal) {
    const elements = await fetchOverpass(buildQuery(bbox), signal)
    const now = Date.now()
    const out: Postbox[] = []
    for (const el of elements) {
      const p = normalizeOsmElement(el, now)
      if (p) out.push(p)
    }
    return out
  },
}

export function osmUrl(p: Postbox): string {
  return `https://www.openstreetmap.org/${p.sourceRef}`
}

export function osmEditUrl(p: Postbox): string {
  const [type, id] = p.sourceRef.split('/')
  return `https://www.openstreetmap.org/edit?${type}=${id}#map=19/${p.lat}/${p.lon}`
}

export function osmNoteUrl(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/note/new#map=19/${lat.toFixed(6)}/${lon.toFixed(6)}`
}
