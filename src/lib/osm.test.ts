import { describe, expect, it } from 'vitest'
import { buildQuery, normalizeOsmElement } from './osm'

describe('normalizeOsmElement', () => {
  it('normalises a typical Deutsche Post box', () => {
    const p = normalizeOsmElement({
      type: 'node',
      id: 332272201,
      lat: 52.521911,
      lon: 13.3867588,
      timestamp: '2026-01-30T10:00:00Z',
      tags: {
        amenity: 'post_box',
        operator: 'Deutsche Post',
        collection_times: 'Mo-Fr 17:45; Sa 16:30',
        'check_date:collection_times': '2026-01-30',
        ref: 'Schiffbauerdamm 3, 10117 Berlin',
        'post_box:type': 'pillar',
      },
    })!
    expect(p.id).toBe('osm:node/332272201')
    expect(p.operator).toBe('Deutsche Post')
    expect(p.colour).toBeUndefined()
    expect(p.shipping.status).toBe('unknown')
    expect(p.access.kind).toBe('outdoor')
    expect(p.lastChecked).toEqual({ date: '2026-01-30', kind: 'collection_times' })
  })

  it('uses the centre for ways and rejects broken records', () => {
    expect(normalizeOsmElement({ type: 'way', id: 1, center: { lat: 1, lon: 2 }, tags: { amenity: 'post_box' } })?.lat).toBe(1)
    expect(normalizeOsmElement({ type: 'node', id: 2, tags: { amenity: 'post_box' } })).toBeNull()
    expect(normalizeOsmElement({ type: 'node', id: 3, lat: 999, lon: 0, tags: { amenity: 'post_box' } })).toBeNull()
    expect(normalizeOsmElement({ type: 'node', id: 4, lat: 1, lon: 1, tags: { amenity: 'bench' } })).toBeNull()
  })

  it('detects indoor boxes', () => {
    const p = normalizeOsmElement({ type: 'node', id: 5, lat: 1, lon: 1, tags: { amenity: 'post_box', indoor: 'yes', opening_hours: 'Mo-Sa 08:00-20:00' } })!
    expect(p.access.kind).toBe('restricted')
    expect(p.access.openingHours).toBe('Mo-Sa 08:00-20:00')
  })

  it('builds a bbox query', () => {
    expect(buildQuery({ south: 1, west: 2, north: 3, east: 4 })).toContain('(1,2,3,4)')
  })
})
