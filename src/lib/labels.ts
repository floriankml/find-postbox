import { getLocale, tOptional } from '../i18n'

/** Translated labels for common OSM values. Unknown values are shown verbatim. */

const CSS_COLOURS = new Set([
  'yellow', 'red', 'blue', 'green', 'orange', 'black', 'white', 'grey', 'gray', 'silver', 'brown',
  'purple', 'gold', 'beige', 'pink', 'darkgreen', 'darkblue', 'darkred', 'lightblue',
])

/** CSS colour for a swatch, or null if the value is not a recognisable colour. */
export function colourCss(value: string): string | null {
  const v = value.trim().toLowerCase()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return v
  if (CSS_COLOURS.has(v)) return v === 'gold' ? '#d4af37' : v
  return null
}

/** Translate `colour` – may contain several values separated by ";". */
export function colourLabel(value: string): string {
  return value
    .split(';')
    .map((c) => tOptional(`colour.${c.trim().toLowerCase()}`) ?? c.trim())
    .join(' / ')
}

export function boxTypeLabel(value: string): string {
  return tOptional(`boxType.${value.trim().toLowerCase()}`) ?? value
}

export function mountingLabel(value: string): string {
  return tOptional(`mounting.${value.trim().toLowerCase()}`) ?? value
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  // Dates like "2023-05" or "2023" should stay coarse.
  if (/^\d{4}$/.test(iso)) return iso
  if (/^\d{4}-\d{2}$/.test(iso)) return d.toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' })
  return d.toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(getLocale(), { dateStyle: 'short', timeStyle: 'short' })
}

export function ageInDays(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? Infinity : (now - t) / 86400000
}
