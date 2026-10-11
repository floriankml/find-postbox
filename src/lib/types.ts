/** Geographic point in WGS84. */
export interface LatLon {
  lat: number
  lon: number
}

/** Axis-aligned bounding box (south, west, north, east). */
export interface BBox {
  south: number
  west: number
  north: number
  east: number
}

/**
 * Shipping capability of a post box.
 * - `international`: an explicit data source confirms international mail is accepted
 * - `national`: an explicit data source says only domestic mail is accepted
 * - `unknown`: no reliable information
 */
export type ShippingStatus = 'international' | 'national' | 'unknown'

/** How reliable a piece of information is. */
export type Evidence =
  /** Structured tag in OpenStreetMap (community-mapped, not official). */
  | 'osm_tag'
  /** Free text (description/note/inscription) in OpenStreetMap. */
  | 'osm_text'
  /** Confirmed by several matching community reports in this app. */
  | 'community_confirmed'
  /** No evidence. */
  | 'none'

export interface ShippingInfo {
  status: ShippingStatus
  evidence: Evidence
  /** Human readable explanation (German) of where the status comes from. */
  reason: string
  /** Raw text snippets from the data source that support the status. */
  quotes: string[]
  /** Additional hints that never change `status` (e.g. several apertures). */
  hints: string[]
}

export type AccessKind = '24/7' | 'outdoor' | 'restricted' | 'unknown'

export interface AccessInfo {
  kind: AccessKind
  label: string
  /** Opening hours of the surrounding building, if mapped. */
  openingHours?: string
  indoor?: boolean
  level?: string
}

export interface CheckDate {
  /** ISO date string (YYYY-MM-DD or full ISO). */
  date: string
  /** What the date means. */
  kind: 'collection_times' | 'general' | 'survey' | 'last_edit'
}

/** Identifier of the data provider. Allows adding national postal data sources later. */
export type SourceId = 'osm'

export interface Postbox {
  /** Globally unique id, e.g. "osm:node/123". */
  id: string
  source: SourceId
  /** Id inside the source, e.g. "node/123". */
  sourceRef: string
  lat: number
  lon: number
  /** Raw tags/attributes from the source, kept for transparency. */
  tags: Record<string, string>
  name?: string
  ref?: string
  address?: string
  operator?: string
  brand?: string
  /** Type of box as mapped (pillar, wall, lamp, …). */
  boxType?: string
  colour?: string
  collectionTimes?: string
  /** Signed collection times differ from actual ones in some places (e.g. UK). */
  collectionTimesSigned?: string
  apertures?: number
  inscription?: string
  shipping: ShippingInfo
  access: AccessInfo
  lastChecked?: CheckDate
  lastEdit?: string
  /** Unix ms when the record was fetched from the source. */
  fetchedAt: number
}

/** A provider of post box data. New national sources implement this. */
export interface PostboxProvider {
  id: SourceId
  name: string
  attribution: string
  fetchBBox(bbox: BBox, signal?: AbortSignal): Promise<Postbox[]>
}
