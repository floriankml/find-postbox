import { t } from '../i18n'
import type { LatLon } from './types'

export type Platform = 'ios' | 'android' | 'other'

export function detectPlatform(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): Platform {
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  // iPadOS 13+ reports as Mac; detect touch.
  if (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

export interface NavTarget {
  id: 'google' | 'apple' | 'geo' | 'osm'
  label: string
  url: string
  /** Shown as the primary button. */
  primary?: boolean
}

const fmt = (n: number) => n.toFixed(6)

/**
 * Google Maps "Maps URLs" (https://developers.google.com/maps/documentation/urls/get-started)
 * are universal links: they open the Google Maps app on Android/iOS if installed,
 * otherwise the website. No API key required.
 */
export function googleMapsUrl(dest: LatLon, origin?: LatLon | null): string {
  const p = new URLSearchParams({ api: '1', destination: `${fmt(dest.lat)},${fmt(dest.lon)}`, travelmode: 'walking' })
  if (origin) p.set('origin', `${fmt(origin.lat)},${fmt(origin.lon)}`)
  return `https://www.google.com/maps/dir/?${p}`
}

/** Apple Maps URL – opens the Maps app on iOS/macOS, a web map elsewhere. */
export function appleMapsUrl(dest: LatLon, label = t('postbox')): string {
  const p = new URLSearchParams({ daddr: `${fmt(dest.lat)},${fmt(dest.lon)}`, dirflg: 'w', q: label })
  return `https://maps.apple.com/?${p}`
}

/** RFC 5870 geo URI – Android shows an app chooser (OsmAnd, Organic Maps, Google Maps, …). */
export function geoUri(dest: LatLon, label = t('postbox')): string {
  return `geo:${fmt(dest.lat)},${fmt(dest.lon)}?q=${fmt(dest.lat)},${fmt(dest.lon)}(${encodeURIComponent(label)})`
}

/** Universal web fallback that works without any app. */
export function osmDirectionsUrl(dest: LatLon, origin?: LatLon | null): string {
  const from = origin ? `${fmt(origin.lat)},${fmt(origin.lon)}` : ''
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${encodeURIComponent(from)}%3B${fmt(dest.lat)}%2C${fmt(dest.lon)}#map=18/${fmt(dest.lat)}/${fmt(dest.lon)}`
}

export function navigationTargets(dest: LatLon, origin: LatLon | null, platform: Platform = detectPlatform()): NavTarget[] {
  const google: NavTarget = { id: 'google', label: 'Google Maps', url: googleMapsUrl(dest, origin) }
  const apple: NavTarget = { id: 'apple', label: t('nav.apple'), url: appleMapsUrl(dest) }
  const geo: NavTarget = { id: 'geo', label: t('nav.geo'), url: geoUri(dest) }
  const osm: NavTarget = { id: 'osm', label: t('nav.osm'), url: osmDirectionsUrl(dest, origin) }
  switch (platform) {
    case 'android':
      return [{ ...google, primary: true }, geo, osm]
    case 'ios':
      return [{ ...google, primary: true }, apple, osm]
    default:
      return [{ ...google, primary: true }, apple, osm]
  }
}
