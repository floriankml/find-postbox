import { useEffect, useRef, useState } from 'react'
import { communityEnabled, CommunityError, REPORT_KINDS, submitReport, type ReportKind } from '../lib/community'
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
  const title = REPORT_KINDS.find((k) => k.kind === kind)?.label ?? 'Hinweis'
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
      setState({ error: 'Bitte einen Wert angeben.' })
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
      setState({ error: err instanceof CommunityError ? err.message : 'Beitrag konnte nicht gesendet werden.' })
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
            aria-label="Schließen"
          >
            <CloseIcon />
          </button>
        </div>

        {!communityEnabled ? (
          <div className="space-y-3 text-sm">
            <p className="rounded-xl bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
              <strong>Vorbereitete Funktion:</strong> In dieser Installation ist noch kein Backend für Community-Beiträge
              eingerichtet. Es wird nichts gespeichert.
            </p>
            <p>So kannst du die Daten trotzdem verbessern – direkt in OpenStreetMap, der Quelle dieser App:</p>
            <ul className="space-y-2">
              {box && kind !== 'missing' && (
                <li>
                  <a className="inline-flex items-center gap-1 text-brand-700 underline dark:text-brand-500" href={osmEditUrl(box)} target="_blank" rel="noopener noreferrer">
                    Briefkasten in OpenStreetMap bearbeiten <ExternalIcon width={14} height={14} />
                  </a>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Kostenloses OSM-Konto nötig.</span>
                </li>
              )}
              <li>
                <a className="inline-flex items-center gap-1 text-brand-700 underline dark:text-brand-500" href={osmNoteUrl(location.lat, location.lon)} target="_blank" rel="noopener noreferrer">
                  Hinweis (Notiz) für OSM-Mapper hinterlassen <ExternalIcon width={14} height={14} />
                </a>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Ohne Konto möglich. Beschreibe z. B. „Briefkasten fehlt“ oder „Leerung Mo–Fr 17:00“.
                </span>
              </li>
            </ul>
          </div>
        ) : state === 'done' ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
              <CheckIcon className="mt-0.5 shrink-0" width={18} height={18} />
              Danke! Dein Hinweis wurde gespeichert und erscheint als „Ungeprüft“, bis weitere Personen ihn bestätigen.
            </p>
            <button type="button" className="h-12 w-full rounded-xl bg-brand-700 font-semibold text-white" onClick={onClose}>
              Schließen
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 text-sm">
            {kind === 'shipping' && (
              <fieldset>
                <legend className="mb-2 font-medium">Was steht am Briefkasten?</legend>
                {[
                  ['international', 'Auch Auslandspost / internationale Postkarten'],
                  ['national', 'Nur Inlandspost'],
                ].map(([v, l]) => (
                  <label key={v} className="flex min-h-11 items-center gap-3">
                    <input type="radio" name="ship" className="h-5 w-5 accent-brand-700" checked={value === v} onChange={() => setValue(v)} />
                    {l}
                  </label>
                ))}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Bitte nur angeben, was du am Kasten gelesen hast – nicht anhand der Farbe.</p>
              </fieldset>
            )}
            {kind === 'collection_times' && (
              <label className="block">
                <span className="mb-1 block font-medium">Leerungszeiten</span>
                <input className={input} value={value} onChange={(e) => setValue(e.target.value)} placeholder="z. B. Mo-Fr 17:45; Sa 12:00" maxLength={300} />
              </label>
            )}
            {kind === 'colour_inscription' && (
              <>
                <label className="block">
                  <span className="mb-1 block font-medium">Was möchtest du ergänzen?</span>
                  <select className={input} value={field} onChange={(e) => setField(e.target.value)}>
                    <option value="colour">Farbe</option>
                    <option value="inscription">Beschriftung</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block font-medium">{field === 'colour' ? 'Farbe' : 'Beschriftung (Wortlaut)'}</span>
                  <input className={input} value={value} onChange={(e) => setValue(e.target.value)} maxLength={300} />
                </label>
              </>
            )}
            {kind === 'correction' && (
              <>
                <label className="block">
                  <span className="mb-1 block font-medium">Welche Angabe?</span>
                  <select className={input} value={field} onChange={(e) => setField(e.target.value)}>
                    <option value="operator">Betreiber</option>
                    <option value="other">Sonstiges</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block font-medium">Richtige Angabe</span>
                  <input className={input} value={value} onChange={(e) => setValue(e.target.value)} maxLength={300} />
                </label>
              </>
            )}
            {kind === 'removed' && <p>Der Briefkasten existiert an dieser Stelle nicht mehr.</p>}
            {kind === 'missing' && (
              <p>
                Neuer Briefkasten an Position {location.lat.toFixed(5)}, {location.lon.toFixed(5)} (Kartenmitte). Verschiebe die Karte vorher
                so, dass die Mitte genau auf dem Briefkasten liegt.
              </p>
            )}
            <label className="block">
              <span className="mb-1 block font-medium">Kommentar (optional)</span>
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
              Es werden keine personenbezogenen Daten gespeichert – nur dein Hinweis, die Position und eine zufällige Geräte-Kennung
              (für Mehrfachbestätigungen). Hinweise werden nicht als Fakten angezeigt, solange sie nicht bestätigt sind.
            </p>
            <button
              type="submit"
              disabled={state === 'sending'}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 font-semibold text-white disabled:opacity-60"
            >
              {state === 'sending' && <SpinnerIcon />}
              Hinweis senden
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
