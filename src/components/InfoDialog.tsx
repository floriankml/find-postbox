import { useEffect, useRef } from 'react'
import { communityEnabled } from '../lib/community'
import type { ThemePref } from '../hooks/useTheme'
import { AutoThemeIcon, CloseIcon, MoonIcon, SunIcon } from './Icons'
import { MARKER_COLOURS } from './MapView'

export function InfoDialog({ onClose, theme, onCycleTheme }: { onClose: () => void; theme: ThemePref; onCycleTheme: () => void }) {
  const ThemeIcon = theme === 'dark' ? MoonIcon : theme === 'light' ? SunIcon : AutoThemeIcon
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [onClose])

  const dot = (c: string) => <span className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ background: c }} />

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-slate-950/40 md:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
        className="pb-safe max-h-[90dvh] w-full overflow-auto rounded-t-3xl bg-white p-5 text-sm leading-relaxed shadow-2xl md:max-w-lg md:rounded-3xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 id="info-title" className="text-lg font-semibold">
            Über Postbox Finder
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Schließen"
          >
            <CloseIcon />
          </button>
        </div>

        <button
          type="button"
          onClick={onCycleTheme}
          className="mt-1 flex h-11 w-full items-center justify-between rounded-xl px-3 ring-1 ring-slate-300 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
        >
          <span className="inline-flex items-center gap-2">
            <ThemeIcon width={18} height={18} /> Darstellung
          </span>
          <span className="text-slate-600 dark:text-slate-400">
            {theme === 'dark' ? 'Dunkel' : theme === 'light' ? 'Hell' : 'Wie System'}
          </span>
        </button>

        <h3 className="mt-4 font-semibold">Legende der Marker</h3>
        <ul className="mt-1 space-y-1">
          <li className="flex items-center gap-2">{dot(MARKER_COLOURS.international)} Internationaler Versand bestätigt</li>
          <li className="flex items-center gap-2">{dot(MARKER_COLOURS.national)} Nur nationaler Versand bestätigt</li>
          <li className="flex items-center gap-2">{dot(MARKER_COLOURS.unknown)} Versandmöglichkeiten unklar</li>
          <li className="flex items-center gap-2">{dot('#facc15')} Gelber Punkt: nächstgelegener Briefkasten</li>
        </ul>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Die Markerfarbe zeigt den Versandstatus – nicht die Farbe des Briefkastens. Die tatsächliche Farbe steht in der
          Detailansicht.
        </p>

        <h3 className="mt-4 font-semibold">Woher kommen die Daten?</h3>
        <p>
          Briefkästen stammen aus <a className="text-brand-700 underline dark:text-brand-500" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>{' '}
          (Objekte mit <code>amenity=post_box</code>), abgefragt über die Overpass API. Die Daten werden von Freiwilligen gepflegt und sind
          je nach Region unterschiedlich vollständig. Ortssuche: Photon (komoot) und Nominatim. Lizenz: ODbL – © OpenStreetMap-Mitwirkende.
        </p>
        <p className="mt-2">
          <strong>Keine offizielle Auskunft:</strong> Die Angaben stammen nicht von den Postgesellschaften. Leerungszeiten und
          Versandmöglichkeiten bitte im Zweifel am Briefkasten prüfen.
        </p>

        <h3 className="mt-4 font-semibold">Wie wird „Auslandsversand“ erkannt?</h3>
        <p>
          Nur wenn es ausdrücklich in den Daten steht (z. B. ein entsprechender Eintrag oder Beschreibungstext in OpenStreetMap){communityEnabled ? ' oder mehrere Nutzer:innen es unabhängig bestätigt haben' : ''}.
          Die Farbe eines Briefkastens wird nie als Nachweis verwendet. Allgemeine Regeln mancher Postdienste werden separat als
          „Allgemeiner Hinweis“ angezeigt.
        </p>

        <h3 className="mt-4 font-semibold">Datenschutz</h3>
        <p>
          Dein Standort wird nur nach deiner Zustimmung im Browser verwendet und nicht an unsere Server übertragen. Für Kartenkacheln,
          Briefkastendaten und Ortssuche ruft dein Browser die genannten OpenStreetMap-Dienste direkt auf (dabei wird deine IP-Adresse
          übertragen). Geladene Daten werden lokal auf deinem Gerät zwischengespeichert.
        </p>
      </div>
    </div>
  )
}
