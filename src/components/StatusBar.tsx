import type { LoadState } from '../lib/store'
import { AlertIcon, InfoIcon, RetryIcon, SpinnerIcon } from './Icons'

interface Props {
  state: LoadState
  tooFar: boolean
  online: boolean
  stale: boolean
  oldestFetch: number | null
  geoMessage: string | null
  onRetry: () => void
  onLocate: () => void
  onDismissGeo: () => void
}

const pill =
  'pointer-events-auto flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm shadow-lg ring-1 ring-slate-900/10 dark:ring-white/10'

/** Compact status messages: loading, errors, offline, zoom hint. */
export function StatusBar({ state, tooFar, online, stale, oldestFetch, geoMessage, onRetry, onLocate, onDismissGeo }: Props) {
  const msgs: React.ReactNode[] = []
  const since = oldestFetch ? new Date(oldestFetch).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : null

  if (geoMessage)
    msgs.push(
      <div key="geo" className={`${pill} bg-white dark:bg-slate-900`} role="status">
        <InfoIcon className="shrink-0 text-brand-600" width={18} height={18} />
        <span className="flex-1">{geoMessage}</span>
        <button type="button" className="px-1 font-medium text-brand-700 dark:text-brand-500" onClick={onDismissGeo}>
          OK
        </button>
      </div>,
    )

  if (!online)
    msgs.push(
      <div key="off" className={`${pill} bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900`} role="status">
        <AlertIcon className="shrink-0" width={18} height={18} />
        Offline{since ? ` – gespeicherte Daten (Stand ${since}), evtl. veraltet` : ' – keine gespeicherten Daten für diesen Bereich'}
      </div>,
    )
  else if (stale && since && state.status !== 'loading')
    msgs.push(
      <div key="stale" className={`${pill} bg-white dark:bg-slate-900`} role="status">
        <InfoIcon className="shrink-0 text-amber-600" width={18} height={18} />
        Teilweise ältere Daten (Stand {since})
      </div>,
    )

  if (tooFar)
    msgs.push(
      <div key="far" className={`${pill} bg-white dark:bg-slate-900`} role="status">
        <InfoIcon className="shrink-0 text-brand-600" width={18} height={18} />
        <span className="flex-1">Näher heranzoomen, Ort suchen oder</span>
        <button type="button" className="font-semibold text-brand-700 underline dark:text-brand-500" onClick={onLocate}>
          Standort nutzen
        </button>
      </div>,
    )
  else if (state.status === 'loading')
    msgs.push(
      <div key="load" className={`${pill} bg-white dark:bg-slate-900`} role="status" aria-live="polite">
        <SpinnerIcon className="shrink-0 text-brand-600" width={18} height={18} />
        Briefkästen werden geladen…
      </div>,
    )
  else if (state.status === 'zoom_in')
    msgs.push(
      <div key="zoom" className={`${pill} bg-white dark:bg-slate-900`} role="status">
        <InfoIcon className="shrink-0 text-brand-600" width={18} height={18} />
        Bereich zu groß – bitte näher heranzoomen oder Umkreis verkleinern.
      </div>,
    )
  else if (state.status === 'error')
    msgs.push(
      <div key="err" className={`${pill} bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50`} role="alert">
        <AlertIcon className="shrink-0" width={18} height={18} />
        <span className="flex-1">
          {state.message}
          {state.hasStaleData ? ' Zeige zwischengespeicherte Daten.' : ''}
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/70 px-2 py-1 font-medium dark:bg-white/10"
        >
          <RetryIcon width={16} height={16} /> Erneut
        </button>
      </div>,
    )
  else if (state.status === 'ready' && state.partial)
    msgs.push(
      <div key="part" className={`${pill} bg-white dark:bg-slate-900`} role="status">
        <InfoIcon className="shrink-0 text-amber-600" width={18} height={18} />
        Sehr viele Treffer – nur ein Teil wird angezeigt. Bitte näher heranzoomen.
      </div>,
    )

  if (msgs.length === 0) return null
  return <div className="pointer-events-none flex flex-col items-stretch gap-2">{msgs}</div>
}
