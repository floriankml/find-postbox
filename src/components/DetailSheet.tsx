import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { formatCollectionTimes, nextCollection, todaysCollections } from '../lib/collectionTimes'
import {
  communityEnabled,
  fetchSummaries,
  FIELD_LABELS,
  mergeShipping,
  REPORT_KINDS,
  STATUS_LABELS,
  type ReportKind,
  type ReportSummary,
} from '../lib/community'
import { operatorName } from '../lib/filters'
import { distanceMeters, formatDistance, walkingMinutes } from '../lib/geo'
import { reverseGeocode } from '../lib/geocode'
import { ageInDays, boxTypeLabel, colourCss, colourLabel, formatDate, mountingLabel } from '../lib/labels'
import { osmEditUrl, osmUrl } from '../lib/osm'
import { operatorRule } from '../lib/shipping'
import type { LatLon, Postbox } from '../lib/types'
import { AlertIcon, CloseIcon, EditIcon, ExternalIcon, InfoIcon } from './Icons'
import { NavigateButton } from './NavigateButton'
import { ShippingBadge } from './ShippingBadge'

const ReportDialog = lazy(() => import('./ReportDialog').then((m) => ({ default: m.ReportDialog })))

interface Props {
  box: Postbox
  user: LatLon | null
  isNearest: boolean
  /** Fallback reference (e.g. searched place) when the own position is unknown. */
  fallbackRef?: { point: LatLon; label: string } | null
  onClose: () => void
}

const Unknown = ({ children }: { children: ReactNode }) => (
  <span className="italic text-slate-500 dark:text-slate-400">{children}</span>
)

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{title}</h3>
      {children}
    </section>
  )
}

const CHECK_KIND = {
  collection_times: 'Leerungszeiten geprüft',
  general: 'Angaben geprüft',
  survey: 'Vor Ort erfasst',
  last_edit: 'Zuletzt bearbeitet',
} as const

export function DetailSheet({ box, user, isNearest, fallbackRef, onClose }: Props) {
  const [summaries, setSummaries] = useState<ReportSummary[]>([])
  const [communityError, setCommunityError] = useState(false)
  const [revAddress, setRevAddress] = useState<string | null | 'loading' | 'error'>(null)
  const [report, setReport] = useState<ReportKind | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [box.id])

  useEffect(() => {
    const ac = new AbortController()
    setSummaries([])
    setCommunityError(false)
    if (communityEnabled)
      fetchSummaries(box.id, ac.signal)
        .then(setSummaries)
        .catch(() => !ac.signal.aborted && setCommunityError(true))
    return () => ac.abort()
  }, [box.id])

  // Approximate address via reverse geocoding, only if OSM has none.
  useEffect(() => {
    setRevAddress(null)
    if (box.address) return
    const ac = new AbortController()
    const t = setTimeout(() => {
      setRevAddress('loading')
      reverseGeocode(box, ac.signal)
        .then((a) => !ac.signal.aborted && setRevAddress(a))
        .catch(() => !ac.signal.aborted && setRevAddress('error'))
    }, 300)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [box])

  const shipping = mergeShipping(box.shipping, summaries)
  const rule = operatorRule(box.tags)
  const distance = user ? distanceMeters(user, box) : null
  const swatch = box.colour ? colourCss(box.colour.split(';')[0]) : null
  const today = box.collectionTimes ? todaysCollections(box.collectionTimes) : null
  const next = box.collectionTimes ? nextCollection(box.collectionTimes) : null
  const checkedAge = box.lastChecked ? ageInDays(box.lastChecked.date) : Infinity
  const needsLabelCheck = shipping.evidence !== 'osm_tag' && shipping.evidence !== 'community_confirmed'

  return (
    <article aria-labelledby="detail-title" className="pb-safe">
      <header className="sticky top-0 z-10 flex items-start gap-3 bg-white/95 px-4 pt-3 pb-2 backdrop-blur dark:bg-slate-950/95">
        <div className="min-w-0 flex-1">
          {isNearest && (
            <span className="mb-1 inline-block rounded bg-yellow-300 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-yellow-950">
              Nächster Briefkasten
            </span>
          )}
          <h2 id="detail-title" ref={headingRef} tabIndex={-1} className="text-lg leading-tight font-semibold outline-none">
            Briefkasten{operatorName(box) ? ` · ${operatorName(box)}` : ''}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {distance !== null ? (
              <>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatDistance(distance)}</span> von dir ·
                ca. {walkingMinutes(distance)} Min. zu Fuß
              </>
            ) : fallbackRef ? (
              <>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatDistance(distanceMeters(fallbackRef.point, box))}</span>{' '}
                {fallbackRef.label} · Standort nicht freigegeben
              </>
            ) : (
              'Entfernung: Standort nicht freigegeben'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          aria-label="Details schließen"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="px-4 pt-1 pb-3">
        <NavigateButton dest={box} origin={user} />
      </div>

      <Section title="Versand ins Ausland?">
        <div className="py-1">
          <ShippingBadge shipping={shipping} size="md" />
        </div>
        <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300">{shipping.reason}</p>
        {shipping.quotes.length > 0 && shipping.evidence === 'osm_text' && (
          <blockquote className="mt-1.5 border-l-2 border-slate-300 pl-3 text-sm text-slate-600 italic dark:border-slate-700 dark:text-slate-400">
            „{shipping.quotes[0]}“
          </blockquote>
        )}
        {shipping.hints.map((h) => (
          <p key={h} className="mt-2 flex gap-2 text-sm text-slate-700 dark:text-slate-300">
            <InfoIcon className="mt-0.5 shrink-0 text-brand-600" width={16} height={16} />
            {h}
          </p>
        ))}
        {rule && (
          <div className="mt-2 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-900">
            <div className="font-medium">Allgemeiner Hinweis zum Betreiber</div>
            <p className="mt-0.5 text-slate-700 dark:text-slate-300">{rule}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gilt allgemein – für diesen Briefkasten nicht einzeln bestätigt.</p>
          </div>
        )}
        {needsLabelCheck && (
          <p className="mt-2 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
            Bitte Beschriftung am Briefkasten prüfen.
          </p>
        )}
      </Section>

      <Section title="Aussehen">
        <dl>
          <Row label="Farbe">
            {box.colour ? (
              <span className="inline-flex items-center gap-2">
                {swatch && <span className="h-4 w-4 rounded-full ring-1 ring-slate-900/20" style={{ background: swatch }} />}
                {colourLabel(box.colour)}
              </span>
            ) : (
              <Unknown>Farbe nicht bekannt</Unknown>
            )}
          </Row>
          <Row label="Beschriftung">{box.inscription ?? <Unknown>Beschriftung nicht erfasst</Unknown>}</Row>
          <Row label="Bauart">
            {box.boxType ? boxTypeLabel(box.boxType) : <Unknown>Nicht bekannt</Unknown>}
            {box.tags['post_box:mounting'] && <> · {mountingLabel(box.tags['post_box:mounting'])}</>}
          </Row>
          {box.apertures !== undefined && <Row label="Einwurfschlitze">{box.apertures}</Row>}
          {box.tags['post_box:design'] && <Row label="Design">{box.tags['post_box:design']}</Row>}
          {box.tags.royal_cypher && <Row label="Monogramm">{box.tags.royal_cypher}</Row>}
        </dl>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Die Farbe allein ist kein Nachweis für die Versandart – sie unterscheidet sich je nach Land und Postdienst.
        </p>
      </Section>

      <Section title="Leerung">
        {box.collectionTimes ? (
          <>
            {next && (
              <p className="mb-1 text-sm">
                Nächste Leerung: <strong>{next.label}</strong>
                {today && today.length === 0 && <span className="text-slate-600 dark:text-slate-400"> (heute keine)</span>}
              </p>
            )}
            <ul className="text-sm">
              {formatCollectionTimes(box.collectionTimes).map((l) => (
                <li key={l} className="py-0.5">
                  {l}
                </li>
              ))}
            </ul>
            {box.collectionTimesSigned && box.collectionTimesSigned !== box.collectionTimes && (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Am Kasten angeschrieben: {formatCollectionTimes(box.collectionTimesSigned).join('; ')}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              „Nächste Leerung“ wird mit der Uhrzeit deines Geräts berechnet. Feiertage und kurzfristige Änderungen sind nicht berücksichtigt.
            </p>
          </>
        ) : (
          <p className="text-sm">
            <Unknown>Leerungszeiten nicht bekannt</Unknown>
          </p>
        )}
      </Section>

      <Section title="Zugang">
        <dl>
          <Row label="Zugänglich">
            {box.access.kind === 'unknown' ? <Unknown>{box.access.label}</Unknown> : box.access.label}
          </Row>
          {box.access.openingHours && <Row label="Öffnungszeiten">{box.access.openingHours}</Row>}
          {box.access.level && <Row label="Etage">{box.access.level}</Row>}
          {box.tags.wheelchair && (
            <Row label="Rollstuhl">{{ yes: 'Ja', no: 'Nein', limited: 'Eingeschränkt' }[box.tags.wheelchair] ?? box.tags.wheelchair}</Row>
          )}
          {box.tags.drive_through === 'yes' && <Row label="Drive-through">Ja</Row>}
        </dl>
      </Section>

      <Section title="Standort">
        <dl>
          <Row label="Adresse">
            {box.address ? (
              box.address
            ) : revAddress === 'loading' ? (
              <Unknown>Wird ermittelt…</Unknown>
            ) : typeof revAddress === 'string' && revAddress !== 'error' ? (
              <>
                {revAddress}
                <span className="block text-xs text-slate-500 dark:text-slate-400">ungefähr, ermittelt über Nominatim</span>
              </>
            ) : (
              <Unknown>Keine Adresse hinterlegt</Unknown>
            )}
          </Row>
          {box.ref && <Row label="Kennung/Ort">{box.ref}</Row>}
          {box.name && <Row label="Name">{box.name}</Row>}
          {box.tags.description && <Row label="Beschreibung">{box.tags.description}</Row>}
          <Row label="Koordinaten">
            <span className="tabular-nums">
              {box.lat.toFixed(6)}, {box.lon.toFixed(6)}
            </span>
          </Row>
        </dl>
      </Section>

      <Section title="Datenstand & Quelle">
        <dl>
          <Row label="Überprüft">
            {box.lastChecked ? (
              <>
                {formatDate(box.lastChecked.date)} <span className="text-slate-600 dark:text-slate-400">({CHECK_KIND[box.lastChecked.kind]})</span>
                {checkedAge > 3 * 365 && (
                  <span className="block text-xs text-amber-700 dark:text-amber-300">Älter als 3 Jahre – evtl. veraltet</span>
                )}
              </>
            ) : (
              <Unknown>Kein Prüfdatum hinterlegt</Unknown>
            )}
          </Row>
          {box.lastEdit && <Row label="Letzte Änderung">{formatDate(box.lastEdit)} (in OpenStreetMap)</Row>}
          <Row label="Quelle">
            <a href={osmUrl(box)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 underline dark:text-brand-500">
              OpenStreetMap {box.sourceRef} <ExternalIcon width={14} height={14} />
            </a>
            <span className="block text-xs text-slate-500 dark:text-slate-400">© OpenStreetMap-Mitwirkende, ODbL. Keine offizielle Auskunft des Postdienstleisters.</span>
          </Row>
          <Row label="Geladen">{new Date(box.fetchedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</Row>
        </dl>
        <details className="mt-1 text-sm">
          <summary className="cursor-pointer py-1 text-brand-700 dark:text-brand-500">Alle Rohdaten anzeigen</summary>
          <table className="mt-1 w-full text-xs">
            <tbody>
              {Object.entries(box.tags)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-100 dark:border-slate-800">
                    <th className="py-1 pr-2 text-left align-top font-mono font-normal text-slate-600 dark:text-slate-400">{k}</th>
                    <td className="py-1 font-mono break-all">{v}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      </Section>

      <Section title="Community">
        {communityEnabled ? (
          summaries.length > 0 ? (
            <ul className="mb-2 space-y-1.5 text-sm">
              {summaries.map((s) => (
                <li key={`${s.field}:${s.value}`} className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-900">
                  <span className="font-medium">{FIELD_LABELS[s.field] ?? s.field}:</span> {s.value || '–'}{' '}
                  <span
                    className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      s.status === 'confirmed'
                        ? 'bg-emerald-200 text-emerald-950'
                        : s.status === 'conflicting'
                          ? 'bg-red-200 text-red-950'
                          : 'bg-slate-300 text-slate-900'
                    }`}
                  >
                    {STATUS_LABELS[s.status]}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {s.devices} Meldung{s.devices === 1 ? '' : 'en'} · zuletzt {formatDate(s.lastReport)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
              {communityError ? 'Community-Hinweise konnten nicht geladen werden.' : 'Noch keine Community-Hinweise.'}
            </p>
          )
        ) : (
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
            Community-Beiträge sind in dieser Installation noch nicht aktiviert (vorbereitete Funktion). Du kannst Daten direkt in
            OpenStreetMap verbessern – davon profitieren alle Apps.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {REPORT_KINDS.filter((k) => k.needsBox).map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => setReport(k.kind)}
              className="h-9 rounded-full px-3 text-sm ring-1 ring-slate-300 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-900"
            >
              {k.label}
            </button>
          ))}
        </div>
        <a
          href={osmEditUrl(box)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-700 underline dark:text-brand-500"
        >
          <EditIcon width={16} height={16} /> In OpenStreetMap bearbeiten
        </a>
      </Section>

      {report && (
        <Suspense fallback={null}>
          <ReportDialog kind={report} box={box} location={box} onClose={() => setReport(null)} />
        </Suspense>
      )}
    </article>
  )
}
