/**
 * Community contributions (optional backend).
 *
 * Storage is ONLY active if VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are
 * configured (see supabase/schema.sql). Without them, the UI explains that
 * saving is not available and links to OpenStreetMap instead – nothing is
 * pretended to be saved.
 */
import type { MessageKey } from '../i18n'
import type { LatLon, ShippingInfo } from './types'

export type ReportKind =
  | 'correction'
  | 'missing'
  | 'removed'
  | 'collection_times'
  | 'colour_inscription'
  | 'shipping'

export type VerificationStatus = 'unverified' | 'confirmed' | 'conflicting'

export interface ReportInput {
  kind: ReportKind
  postboxId: string | null
  location: LatLon
  field: string
  value: string | null
  comment: string | null
}

export interface ReportSummary {
  postboxId: string | null
  field: string
  value: string
  devices: number
  lastReport: string
  status: VerificationStatus
}

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const communityEnabled = Boolean(URL_ && KEY)

export const REPORT_KINDS: { kind: ReportKind; needsBox: boolean }[] = [
  { kind: 'shipping', needsBox: true },
  { kind: 'collection_times', needsBox: true },
  { kind: 'colour_inscription', needsBox: true },
  { kind: 'correction', needsBox: true },
  { kind: 'removed', needsBox: true },
  { kind: 'missing', needsBox: false },
]

export const reportKindKey = (k: ReportKind) => `report.kind.${k}` as MessageKey
export const fieldKey = (f: string) => `report.field.${f}`
export const statusKey = (s: VerificationStatus) => `report.status.${s}` as MessageKey

function clientId(): string {
  try {
    let id = localStorage.getItem('pf-client-id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('pf-client-id', id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function headers(): HeadersInit {
  return { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
}

/** `message` is a translation key. */
export class CommunityError extends Error {
  constructor(readonly key: MessageKey) {
    super(key)
  }
}

export async function submitReport(r: ReportInput): Promise<void> {
  if (!communityEnabled) throw new CommunityError('report.err.disabled')
  const body = {
    kind: r.kind,
    postbox_id: r.postboxId,
    location: `SRID=4326;POINT(${r.location.lon} ${r.location.lat})`,
    field: r.field,
    value: r.value?.trim().slice(0, 300) || null,
    comment: r.comment?.trim().slice(0, 1000) || null,
    client_id: clientId(),
  }
  const res = await fetch(`${URL_}/rest/v1/postbox_reports`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (text.includes('rate_limited')) throw new CommunityError('report.err.rateLimited')
    if (text.includes('duplicate')) throw new CommunityError('report.err.duplicate')
    throw new CommunityError('report.err.generic')
  }
}

export async function fetchSummaries(postboxId: string, signal?: AbortSignal): Promise<ReportSummary[]> {
  if (!communityEnabled) return []
  const params = new URLSearchParams({ postbox_id: `eq.${postboxId}`, select: '*' })
  const res = await fetch(`${URL_}/rest/v1/postbox_report_summary?${params}`, { headers: headers(), signal })
  if (!res.ok) throw new CommunityError('community.loadError')
  const rows = (await res.json()) as {
    postbox_id: string | null
    field: string
    value: string
    devices: number
    last_report: string
    status: VerificationStatus
  }[]
  return rows.map((r) => ({
    postboxId: r.postbox_id,
    field: r.field,
    value: r.value,
    devices: r.devices,
    lastReport: r.last_report,
    status: r.status,
  }))
}

/**
 * Combine source data with community data. Community data only changes the
 * shipping status if it is `confirmed` and the source has no information.
 */
export function mergeShipping(base: ShippingInfo, summaries: ReportSummary[]): ShippingInfo {
  if (base.status !== 'unknown') return base
  const confirmed = summaries.find((s) => s.field === 'shipping' && s.status === 'confirmed')
  if (!confirmed || (confirmed.value !== 'international' && confirmed.value !== 'national')) return base
  return {
    ...base,
    status: confirmed.value,
    evidence: 'community_confirmed',
    reason: { key: 'ship.reason.community', params: { n: confirmed.devices } },
  }
}
