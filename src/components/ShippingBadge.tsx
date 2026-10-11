import type { ShippingInfo } from '../lib/types'
import { GlobeIcon, HelpIcon, HomeIcon } from './Icons'

export const SHIPPING_TEXT = {
  international: 'Ausland bestätigt',
  national: 'Nur Inland bestätigt',
  unknown: 'Versand unklar',
} as const

export const SHIPPING_LONG = {
  international: 'Internationaler Versand bestätigt',
  national: 'Nur nationaler Versand bestätigt',
  unknown: 'Versandmöglichkeiten unklar',
} as const

const STYLES = {
  international:
    'bg-emerald-100 text-emerald-900 ring-emerald-600/30 dark:bg-emerald-900/50 dark:text-emerald-100 dark:ring-emerald-400/30',
  national: 'bg-amber-100 text-amber-900 ring-amber-600/30 dark:bg-amber-900/50 dark:text-amber-100 dark:ring-amber-400/30',
  unknown: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-400/20',
} as const

export function ShippingBadge({ shipping, size = 'sm' }: { shipping: ShippingInfo; size?: 'sm' | 'md' }) {
  const Icon = shipping.status === 'international' ? GlobeIcon : shipping.status === 'national' ? HomeIcon : HelpIcon
  const text = size === 'md' ? SHIPPING_LONG[shipping.status] : SHIPPING_TEXT[shipping.status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset ${STYLES[shipping.status]} ${
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <Icon width={size === 'md' ? 16 : 13} height={size === 'md' ? 16 : 13} />
      {text}
      {shipping.evidence === 'community_confirmed' && <span className="font-normal opacity-80">(Community)</span>}
    </span>
  )
}
