import { createStore, get, set, keys, delMany, getMany } from 'idb-keyval'
import { bboxOfTiles, tileOfPoint, tileRangeForBBox, tilesInRange } from './geo'
import { DataSourceError, osmProvider } from './osm'
import type { BBox, Postbox, PostboxProvider } from './types'

/** Data younger than this is not re-fetched. */
export const FRESH_MS = 24 * 60 * 60 * 1000
/** Persisted data older than this is dropped. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
/** Larger viewports must be zoomed in first (protects the Overpass service). */
export const MAX_TILES = 160
const MAX_PERSISTED_TILES = 400
const CACHE_VERSION = 1

interface TileEntry {
  v: number
  fetchedAt: number
  boxes: Postbox[]
}

export type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; partial: boolean }
  | { status: 'zoom_in' }
  | { status: 'error'; message: string; kind: DataSourceError['kind']; hasStaleData: boolean }

export interface StoreSnapshot {
  boxes: Map<string, Postbox>
  state: LoadState
  /** Oldest fetch time of data currently shown (for "Stand: …"). */
  oldestFetch: number | null
  /** True if some shown data is older than FRESH_MS (e.g. offline). */
  stale: boolean
  version: number
}

let idbStore: ReturnType<typeof createStore> | null = null
function db() {
  if (typeof indexedDB === 'undefined') return null
  try {
    idbStore ??= createStore('postbox-finder', 'tiles')
    return idbStore
  } catch {
    return null
  }
}

export class PostboxStore {
  private tiles = new Map<string, TileEntry>()
  private snapshot: StoreSnapshot = {
    boxes: new Map(),
    state: { status: 'idle' },
    oldestFetch: null,
    stale: false,
    version: 0,
  }
  private listeners = new Set<() => void>()
  private inFlight: Promise<void> | null = null
  private pending: BBox | null = null
  private lastRequested: BBox | null = null
  private provider: PostboxProvider

  constructor(provider: PostboxProvider = osmProvider) {
    this.provider = provider
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = () => this.snapshot

  private emit(patch: Partial<StoreSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch, version: this.snapshot.version + 1 }
    this.listeners.forEach((l) => l())
  }

  private rebuild(state: LoadState) {
    const boxes = new Map<string, Postbox>()
    let oldest: number | null = null
    let stale = false
    const now = Date.now()
    for (const t of this.tiles.values()) {
      for (const b of t.boxes) boxes.set(b.id, b)
      oldest = oldest === null ? t.fetchedAt : Math.min(oldest, t.fetchedAt)
      if (now - t.fetchedAt > FRESH_MS) stale = true
    }
    this.emit({ boxes, state, oldestFetch: oldest, stale })
  }

  /**
   * Make sure data for the viewport is loaded. Calls are coalesced: while a
   * request runs, only the most recent viewport is remembered and loaded next.
   */
  ensureViewport(bbox: BBox): Promise<void> {
    this.lastRequested = bbox
    if (this.inFlight) {
      this.pending = bbox
      return this.inFlight
    }
    this.inFlight = this.load(bbox).finally(() => {
      this.inFlight = null
      const next = this.pending
      this.pending = null
      if (next) void this.ensureViewport(next)
    })
    return this.inFlight
  }

  /** Retry the last viewport after an error, ignoring nothing but fresh tiles. */
  retry(): Promise<void> {
    return this.lastRequested ? this.ensureViewport(this.lastRequested) : Promise.resolve()
  }

  private async load(bbox: BBox): Promise<void> {
    const range = tileRangeForBBox(bbox)
    const needed = tilesInRange(range)
    if (needed.length > MAX_TILES) {
      this.rebuild({ status: 'zoom_in' })
      return
    }
    const now = Date.now()
    let missing = needed.filter((k) => !this.tiles.has(k) || now - this.tiles.get(k)!.fetchedAt > FRESH_MS)
    if (missing.length === 0) {
      this.rebuild({ status: 'ready', partial: false })
      return
    }

    // 1. Persistent cache (IndexedDB)
    const store = db()
    if (store) {
      try {
        const entries = await getMany<TileEntry | undefined>(missing, store)
        entries.forEach((e, i) => {
          if (e && e.v === CACHE_VERSION && now - e.fetchedAt < MAX_AGE_MS) {
            const cur = this.tiles.get(missing[i])
            if (!cur || cur.fetchedAt < e.fetchedAt) this.tiles.set(missing[i], e)
          }
        })
        missing = missing.filter((k) => !this.tiles.has(k) || now - this.tiles.get(k)!.fetchedAt > FRESH_MS)
      } catch {
        /* storage unavailable – ignore */
      }
    }
    if (missing.length === 0) {
      this.rebuild({ status: 'ready', partial: false })
      return
    }

    this.rebuild({ status: 'loading' })

    // 2. Network: one query for the bounding box of all missing tiles.
    const queryBox = bboxOfTiles(missing)
    try {
      const boxes = await this.provider.fetchBBox(queryBox)
      const fetchedAt = Date.now()
      const byTile = new Map<string, Postbox[]>()
      for (const k of tilesInRange(tileRangeForBBox(queryBox))) byTile.set(k, [])
      for (const b of boxes) {
        const k = tileOfPoint(b)
        byTile.get(k)?.push(b)
      }
      // Truncated result (output limit) → mark as partial and don't persist.
      const partial = boxes.length >= 5000
      for (const [k, list] of byTile) {
        const entry: TileEntry = { v: CACHE_VERSION, fetchedAt, boxes: list }
        this.tiles.set(k, entry)
        if (store && !partial) void set(k, entry, store).catch(() => {})
      }
      if (store) void this.prune(store)
      this.rebuild({ status: 'ready', partial })
    } catch (e) {
      const err = e instanceof DataSourceError ? e : new DataSourceError('network', 'Der Datendienst ist nicht erreichbar.')
      const hasStaleData = needed.some((k) => this.tiles.has(k))
      this.rebuild({ status: 'error', message: err.message, kind: err.kind, hasStaleData })
    }
  }

  private pruning = false
  private async prune(store: NonNullable<ReturnType<typeof db>>) {
    if (this.pruning) return
    this.pruning = true
    try {
      const all = (await keys(store)) as string[]
      if (all.length <= MAX_PERSISTED_TILES) return
      const entries = await getMany<TileEntry | undefined>(all, store)
      const sorted = all
        .map((k, i) => ({ k, t: entries[i]?.fetchedAt ?? 0 }))
        .sort((a, b) => a.t - b.t)
      await delMany(
        sorted.slice(0, all.length - MAX_PERSISTED_TILES).map((s) => s.k),
        store,
      )
    } catch {
      /* ignore */
    } finally {
      this.pruning = false
    }
  }
}

export const postboxStore = new PostboxStore()

/** Small key/value cache for geocoding results etc. */
const kvStore = () => {
  if (typeof indexedDB === 'undefined') return null
  try {
    return createStore('postbox-finder-kv', 'kv')
  } catch {
    return null
  }
}
let kv: ReturnType<typeof createStore> | null | undefined
export async function kvGet<T>(key: string, maxAgeMs: number): Promise<T | undefined> {
  kv ??= kvStore()
  if (!kv) return undefined
  try {
    const e = await get<{ t: number; v: T }>(key, kv)
    if (e && Date.now() - e.t < maxAgeMs) return e.v
  } catch {
    /* ignore */
  }
  return undefined
}
export async function kvSet<T>(key: string, value: T): Promise<void> {
  kv ??= kvStore()
  if (!kv) return
  try {
    await set(key, { t: Date.now(), v: value }, kv)
  } catch {
    /* ignore */
  }
}
