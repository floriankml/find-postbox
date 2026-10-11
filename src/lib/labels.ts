/** German labels for common OSM values. Unknown values are shown verbatim. */

const COLOURS: Record<string, string> = {
  yellow: 'Gelb',
  red: 'Rot',
  blue: 'Blau',
  green: 'Grün',
  orange: 'Orange',
  black: 'Schwarz',
  white: 'Weiß',
  grey: 'Grau',
  gray: 'Grau',
  silver: 'Silber',
  brown: 'Braun',
  purple: 'Lila',
  gold: 'Gold',
  beige: 'Beige',
  pink: 'Rosa',
  darkgreen: 'Dunkelgrün',
  darkblue: 'Dunkelblau',
  darkred: 'Dunkelrot',
  lightblue: 'Hellblau',
}

/** CSS colour for a swatch, or null if the value is not a recognisable colour. */
export function colourCss(value: string): string | null {
  const v = value.trim().toLowerCase()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return v
  if (v in COLOURS) return v === 'gold' ? '#d4af37' : v
  return null
}

/** Translate `colour` – may contain several values separated by ";". */
export function colourLabel(value: string): string {
  return value
    .split(';')
    .map((c) => {
      const v = c.trim().toLowerCase()
      return COLOURS[v] ?? c.trim()
    })
    .join(' / ')
}

const BOX_TYPES: Record<string, string> = {
  pillar: 'Säulenbriefkasten (freistehend)',
  wall: 'Wandbriefkasten',
  lamp: 'Mastbriefkasten',
  meter: 'Kasten für freigemachte Geschäftspost',
  parcel_locker: 'Paketkasten',
  parcel: 'Paketkasten',
  drive_through: 'Drive-through-Briefkasten',
  community: 'Gemeinschaftsbriefkasten',
  indoor: 'Briefkasten im Gebäude',
  box: 'Briefkasten',
  oval: 'Ovaler Säulenbriefkasten',
  sack: 'Sammelbehälter',
}

export function boxTypeLabel(value: string): string {
  return BOX_TYPES[value.trim().toLowerCase()] ?? value
}

const MOUNTING: Record<string, string> = {
  wall: 'an einer Wand',
  pole: 'an einem Mast',
  post: 'an einem Pfosten',
  ground: 'am Boden',
  fence: 'an einem Zaun',
}

export function mountingLabel(value: string): string {
  return MOUNTING[value.trim().toLowerCase()] ?? value
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  // Dates like "2023-05" or "2023" should stay coarse.
  if (/^\d{4}$/.test(iso)) return iso
  if (/^\d{4}-\d{2}$/.test(iso)) return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ageInDays(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? Infinity : (now - t) / 86400000
}
