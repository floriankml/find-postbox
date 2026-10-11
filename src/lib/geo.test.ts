import { describe, expect, it } from 'vitest'
import { setLang } from '../i18n'
import { applyFilters, DEFAULT_FILTERS } from './filters'
import { bboxOfTiles, distanceMeters, formatDistance, tileRangeForBBox, tilesInRange } from './geo'
import { normalizeOsmElement } from './osm'

describe('geo', () => {
  it('computes distances', () => {
    const d = distanceMeters({ lat: 52.52, lon: 13.4 }, { lat: 52.53, lon: 13.4 })
    expect(d).toBeGreaterThan(1100)
    expect(d).toBeLessThan(1120)
    expect(formatDistance(437)).toBe('440 m')
    setLang('de')
    expect(formatDistance(1530)).toBe('1,5 km')
    setLang('en')
    expect(formatDistance(1530)).toBe('1.5 km')
  })

  it('covers a bbox with tiles and back', () => {
    const tiles = tilesInRange(tileRangeForBBox({ south: 52.51, west: 13.37, north: 52.53, east: 13.41 }))
    const b = bboxOfTiles(tiles)
    expect(b.south).toBeLessThanOrEqual(52.51)
    expect(b.north).toBeGreaterThanOrEqual(52.53)
    expect(b.west).toBeLessThanOrEqual(13.37)
    expect(b.east).toBeGreaterThanOrEqual(13.41)
  })
})

describe('filters', () => {
  const mk = (id: number, lat: number, tags: Record<string, string> = {}) =>
    normalizeOsmElement({ type: 'node', id, lat, lon: 13.4, tags: { amenity: 'post_box', ...tags } })!
  const boxes = [mk(1, 52.53), mk(2, 52.521, { international: 'yes', collection_times: 'Mo-Fr 17:00' }), mk(3, 52.6)]
  const ref = { lat: 52.52, lon: 13.4 }

  it('sorts by distance and applies radius', () => {
    const r = applyFilters(boxes, { ...DEFAULT_FILTERS, radius: 3000 }, ref, null)
    expect(r.map((x) => x.box.id)).toEqual(['osm:node/2', 'osm:node/1'])
  })

  it('filters by shipping and collection times', () => {
    expect(applyFilters(boxes, { ...DEFAULT_FILTERS, shipping: 'international' }, ref, null)).toHaveLength(1)
    expect(applyFilters(boxes, { ...DEFAULT_FILTERS, hasCollectionTimes: true }, ref, null)).toHaveLength(1)
  })
})
