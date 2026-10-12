import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { communityEnabled, CommunityError, reportKindKey, submitReport, type ReportKind } from '../lib/community'
import { osmEditUrl, osmNoteUrl } from '../lib/osm'
import type { LatLon, Postbox } from '../lib/types'
import { CheckIcon, CloseIcon, ExternalIcon, SpinnerIcon } from './Icons'

interface Props {
  kind: ReportKind
  box: Postbox | null
  location: LatLon
  onClose: () => void
}

const input =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base dark:border-slate-700 dark:bg-slate-800'

export function ReportDialog({ kind, box, location, onClose }: Props) {
  const title = t(reportKindKey(kind))
  const [field, setField] = useState(kind === 'colour_inscription' ? 'colour' : kind === 'correction' ? 'operator' : '')
  const [value, setValue] = useState(kind === 'shipping' ? 'international' : (kind === 'collection_times' ? box?.collectionTimes : '') ?? '')
  const [comment, setComment] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | { error: string }>('idle')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [onClose])

  const resolvedField =
    kind === 'shipping' ? 'shipping' : kind === 'collection_times' ? 'collection_times' : kind === 'removed' || kind === 'missing' ? 'exists' : field
  const resolvedValue = kind === 'removed' ? 'no' : kind === 'missing' ? 'yes' : value

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (honeypot) return setState('done') // bots fill hidden fields
    if (!['removed', 'missing'].includes(kind) && !resolvedValue.trim()) {
      setState({ error: t('report.err.value') })
      return
    }
    setState('sending')
    try {
      await submitReport({
        kind,
        postboxId: box?.id ?? null,
        location,
        field: resolvedField,
        value: resolvedValue,
        comment,
      })
      setState('done')
    } catch (err) {
      setState({ error: t(err instanceof CommunityError ? err.key : 'report.err.generic') })
    }
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-slate-950/40 md:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="pb-safe max-h-[90dvh] w-full overflow-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-md md:rounded-3xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="report-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={t('close')}
          >
            <CloseIcon />
          </button>
        </div>

        {!communityEnabled ? (
          <div className="space-y-3 text-sm">
            <p className="rounded-xl bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
              <strong>{t('report.prepared')}</strong> {t('report.preparedText')}
            </p>
            <p>{t('report.improveOsm')}</p>
            <ul className="space-y-2">
              {box && kind !== 'missing' && (
                <li>
                  <a className="inline-flex items-center gap-1 text-brand-700 underline dark:text-brand-500" href={osmEditUrl(box)} target="_blank" rel="noopener noreferrer">
                    {t('report.editOsm')} <ExternalIcon width={14} height={14} />
                  </a>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{t('report.accountNeeded')}</span>
                </li>
              )}
              <li>
                <a className="inline-flex items-center gap-1 text-brand-700 underline dark:text-brand-500" href={osmNoteUrl(location.lat, location.lon)} target="_blank" rel="noopener noreferrer">
                  {t('report.osmNote')} <ExternalIcon width={14} height={14} />
                </a>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {t('report.osmNoteHint')}
                </span>
              </li>
            </ul>
          </div>
        ) : state === 'done' ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
              <CheckIcon className="mt-0.5 shrink-0" width={18} height={18} />
              {t('report.thanks')}
            </p>
            <button type="button" className="h-12 w-full rounded-xl bg-brand-700 font-semibold text-white" onClick={onClose}>
              {t('close')}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 text-sm">
            {kind === 'shipping' && (
              <fieldset>
                <legend className="mb-2 font-medium">{t('report.whatSays')}</legend>
                {[
                  ['international', t('report.optIntl')],
                  ['national', t('report.optNational')],
                ].map(([v, l]) => (
                  <label key={v} className="flex min-h-11 items-center gap-3">
                    <input type="radio" name="ship" className="h-5 w-5 accent-brand-700" checked={value === v} onChange={() => setValue(v)} />
                    {l}
                  </label>
                ))}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('report.onlyRead')}</p>
              </fieldset>
            )}
            {kind === 'collection_times' && (
              <label className="block">
                <span className="mb-1 block font-medium">{t('detail.sec.collection')}</span>
                <input className={input} value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('report.timesPlaceholder')} maxLength={300} />
              </label>
            )}
            {kind === 'colour_inscription' && (
              <>
                <label className="block">
                  <span className="mb-1 block font-medium">{t('report.whatAdd')}</span>
                  <select className={input} value={field} onChange={(e) => setField(e.target.value)}>
                    <option value="colour">{t('detail.colour')}</option>
                    <option value="inscription">{t('detail.inscription')}</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block font-medium">{field === 'colour' ? t('detail.colour') : t('report.inscriptionVerbatim')}</span>
                  <input className={input} value={value} onChange={(e) => setValue(e.target.value)} maxLength={300} />
                </label>
              </>
            )}
            {kind === 'correction' && (
              <>
                <label className="block">
                  <span className="mb-1 block font-medium">{t('report.whichField')}</span>
                  <select className={input} value={field} onChange={(e) => setField(e.target.value)}>
                    <option value="operator">{t('filter.operator')}</option>
                    <option value="other">{t('report.field.other')}</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block font-medium">{t('report.correctValue')}</span>
                  <input className={input} value={value} onChange={(e) => setValue(e.target.value)} maxLength={300} />
                </label>
              </>
            )}
            {kind === 'removed' && <p>{t('report.removedText')}</p>}
            {kind === 'missing' && (
              <p>
                {t('report.missingText', { pos: `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}` })}
              </p>
            )}
            <label className="block">
              <span className="mb-1 block font-medium">{t('report.comment')}</span>
              <textarea className={input} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
            </label>
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              aria-hidden="true"
            />
            {typeof state === 'object' && <p className="text-red-700 dark:text-red-400" role="alert">{state.error}</p>}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('report.privacy')}
            </p>
            <button
              type="submit"
              disabled={state === 'sending'}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 font-semibold text-white disabled:opacity-60"
            >
              {state === 'sending' && <SpinnerIcon />}
              {t('report.send')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
