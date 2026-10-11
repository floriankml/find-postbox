import { describe, expect, it } from 'vitest'
import { appleMapsUrl, detectPlatform, geoUri, googleMapsUrl, navigationTargets } from './navigation'

const dest = { lat: 52.521911, lon: 13.3867588 }

describe('navigation links', () => {
  it('builds a Google Maps directions URL with exact coordinates', () => {
    const u = new URL(googleMapsUrl(dest))
    expect(u.hostname).toBe('www.google.com')
    expect(u.searchParams.get('api')).toBe('1')
    expect(u.searchParams.get('destination')).toBe('52.521911,13.386759')
    expect(u.searchParams.get('travelmode')).toBe('walking')
  })

  it('builds Apple Maps and geo URIs', () => {
    expect(new URL(appleMapsUrl(dest)).searchParams.get('daddr')).toBe('52.521911,13.386759')
    expect(geoUri(dest)).toMatch(/^geo:52\.521911,13\.386759\?q=/)
  })

  it('offers platform specific choices', () => {
    expect(navigationTargets(dest, null, 'android').map((t) => t.id)).toEqual(['google', 'geo', 'osm'])
    expect(navigationTargets(dest, null, 'ios').map((t) => t.id)).toEqual(['google', 'apple', 'osm'])
  })

  it('detects platforms', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android')
  })
})
