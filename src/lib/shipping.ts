import type { Msg, MessageKey } from '../i18n'
import type { ShippingInfo } from './types'

/**
 * Detects whether a post box accepts international mail – ONLY from explicit
 * data. Colour is never used: e.g. a yellow box means different things in
 * different countries, and many countries use one box for all destinations.
 *
 * OpenStreetMap has no established tag for this, so we look at:
 *  1. a small set of explicit structured keys that are used in the wild
 *  2. free text in description/note/inscription (weaker evidence)
 */

const STRUCTURED_KEYS = [
  'post_box:destination',
  'post_box:international',
  'post:destination',
  'post:international',
  'mail:international',
  'international',
  'destination',
] as const

const TEXT_KEY_RE = /^(description|note|inscription|post_box:inscription|post_box:description)(:[a-z_-]+)?$/

const INTL_WORDS =
  'international(?:e|en|er)?|internacional|internazionale|abroad|overseas|foreign|all destinations|ausland(?:spost)?|étranger|etranger|estero|extranjero|exterior|buitenland|utland|zagranica|zahraničí|国際|國際|国际|해외|外国'
const NAT_ONLY_RE =
  /\b(domestic only|only domestic|national only|inland only|nur inland(?:spost)?|nur für (?:das )?inland|uniquement (?:pour la )?france|solo nazionale|solo nacional|nur deutschland)\b|国内のみ|国内専用/i
const NEG_INTL_RE = new RegExp(
  `\\b(no|not|kein(?:e)?|nicht|pas|non|sin|senza)\\b[^.;]{0,20}(?:${INTL_WORDS})`,
  'i',
)
const INTL_RE = new RegExp(`(?:\\b|^)(?:${INTL_WORDS})`, 'i')
// Free text must also talk about mail – "Internationales Handelszentrum" is not evidence.
const MAIL_CONTEXT_RE =
  /auslandspost|abroad|overseas|all destinations|post|mail|letter|brief|karte|card|sendung|courrier|lettre|correo|carta|posta|lettera|郵便|邮|우편/i
const DOMESTIC_VALUE_RE = /^(domestic|national|inland|local|city|regional|metro|country|inländisch|inland(?:spost)?)$/i

function classifyValue(key: string, value: string): 'international' | 'national' | null {
  const v = value.trim().toLowerCase()
  if (key.endsWith('international')) {
    if (v === 'yes' || v === 'only') return 'international'
    if (v === 'no') return 'national'
    return null
  }
  // destination-like keys may contain several values separated by ";"
  const parts = v.split(';').map((p) => p.trim())
  if (parts.some((p) => INTL_RE.test(p))) return 'international'
  if (parts.length > 0 && parts.every((p) => DOMESTIC_VALUE_RE.test(p))) return 'national'
  return null
}

export function detectShipping(tags: Record<string, string>): ShippingInfo {
  const hints: Msg[] = []

  const apertures = Number.parseInt(tags['post_box:apertures'] ?? '', 10)
  if (Number.isFinite(apertures) && apertures >= 2) {
    hints.push({ key: 'ship.hint.apertures', params: { n: apertures } })
  }

  // 1. Structured tags
  for (const key of STRUCTURED_KEYS) {
    const value = tags[key]
    if (!value) continue
    // `destination` is mostly used on roads; on post boxes it sometimes holds a
    // city name ("Local mail only") – we only accept recognisable values.
    const cls = classifyValue(key, value)
    if (cls) {
      return {
        status: cls,
        evidence: 'osm_tag',
        reason: {
          key: cls === 'international' ? 'ship.reason.tagIntl' : 'ship.reason.tagNational',
          params: { tag: `${key}=${value}` },
        },
        quotes: [`${key}=${value}`],
        hints,
      }
    }
    hints.push({ key: 'ship.hint.unclearTag', params: { tag: `${key}=${value}` } })
  }

  // 2. Free text
  const texts = Object.entries(tags).filter(([k]) => TEXT_KEY_RE.test(k))
  for (const [k, text] of texts) {
    if (NAT_ONLY_RE.test(text) || NEG_INTL_RE.test(text)) {
      return {
        status: 'national',
        evidence: 'osm_text',
        reason: { key: 'ship.reason.textNational', params: { key: k } },
        quotes: [text],
        hints,
      }
    }
  }
  for (const [k, text] of texts) {
    if (INTL_RE.test(text) && MAIL_CONTEXT_RE.test(text)) {
      return {
        status: 'international',
        evidence: 'osm_text',
        reason: { key: 'ship.reason.textIntl', params: { key: k } },
        quotes: [text],
        hints,
      }
    }
  }

  return {
    status: 'unknown',
    evidence: 'none',
    reason: { key: 'ship.reason.none' },
    quotes: [],
    hints,
  }
}

export interface OperatorRule {
  match: { wikidata?: string[]; name?: RegExp }
  /** General rule for the operator – NEVER shown as confirmed for a single box. */
  text: MessageKey
}

/**
 * General, well-known operator rules. Shown as "Allgemeiner Hinweis" only and
 * never used to set a box to "international bestätigt".
 * Keep this list conservative; add entries only with a public source.
 */
export const OPERATOR_RULES: OperatorRule[] = [
  {
    match: { wikidata: ['Q157645'], name: /^deutsche post\b/i },
    text: 'rule.deutschePost',
  },
  {
    match: { wikidata: ['Q638098'], name: /^royal mail\b/i },
    text: 'rule.royalMail',
  },
  {
    match: { wikidata: ['Q373724'], name: /^la poste$/i },
    text: 'rule.laPoste',
  },
  {
    match: { wikidata: ['Q668687'], name: /^(united states postal service|usps)$/i },
    text: 'rule.usps',
  },
  {
    match: { wikidata: ['Q1032001'], name: /^(canada post|postes canada)/i },
    text: 'rule.canadaPost',
  },
  {
    match: { wikidata: ['Q11509260'], name: /日本郵便|japan post/i },
    text: 'rule.japanPost',
  },
  {
    match: { name: /中華郵政|chunghwa post/i },
    text: 'rule.chunghwaPost',
  },
]

export function operatorRule(tags: Record<string, string>): MessageKey | null {
  const wd = [tags['operator:wikidata'], tags['brand:wikidata']].filter(Boolean)
  const names = [tags.operator, tags.brand, tags['operator:en']].filter(Boolean) as string[]
  for (const rule of OPERATOR_RULES) {
    if (rule.match.wikidata?.some((id) => wd.includes(id))) return rule.text
    if (rule.match.name && names.some((n) => rule.match.name!.test(n))) return rule.text
  }
  return null
}
