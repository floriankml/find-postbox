import { useEffect, useId, useRef, useState } from 'react'
import { activeFilterCount, RADIUS_OPTIONS, type Filters } from '../lib/filters'
import { formatDistance } from '../lib/geo'
import { CloseIcon, FilterIcon } from './Icons'

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  operators: { name: string; count: number }[]
  radiusHint: string
}

const chip = (active: boolean) =>
  `h-9 shrink-0 rounded-full px-3.5 text-sm font-medium ring-1 ring-inset transition-colors ${
    active
      ? 'bg-brand-700 text-white ring-brand-700 dark:bg-brand-500 dark:ring-brand-500 dark:text-slate-950'
      : 'bg-white text-slate-800 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800'
  }`

export function FilterBar({ filters, onChange, operators, radiusHint }: Props) {
  const [panel, setPanel] = useState(false)
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const more = activeFilterCount(filters) - (filters.shipping !== 'all' ? 1 : 0)

  return (
    <>
      <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3 py-1" role="toolbar" aria-label="Schnellfilter">
        <button
          type="button"
          className={chip(filters.shipping === 'international')}
          aria-pressed={filters.shipping === 'international'}
          onClick={() => set({ shipping: filters.shipping === 'international' ? 'all' : 'international' })}
        >
          🌍 Ausland bestätigt
        </button>
        <RadiusChip value={filters.radius} onChange={(radius) => set({ radius })} hint={radiusHint} />
        <button
          type="button"
          className={chip(filters.open24)}
          aria-pressed={filters.open24}
          onClick={() => set({ open24: !filters.open24 })}
        >
          Jederzeit zugänglich
        </button>
        <button
          type="button"
          className={`${chip(more > 0 || filters.shipping === 'national')} inline-flex items-center gap-1.5`}
          onClick={() => setPanel(true)}
          aria-haspopup="dialog"
        >
          <FilterIcon width={16} height={16} />
          Weitere Filter{more > 0 ? ` (${more})` : ''}
        </button>
      </div>
      {panel && <FilterPanel filters={filters} onChange={onChange} operators={operators} onClose={() => setPanel(false)} />}
    </>
  )
}

function RadiusChip({ value, onChange, hint }: { value: number | null; onChange: (v: number | null) => void; hint: string }) {
  const id = useId()
  return (
    <label className={`${chip(value !== null)} relative inline-flex items-center gap-1`} htmlFor={id} title={hint}>
      <span aria-hidden>📍</span>
      <span>{value === null ? 'Umkreis' : formatDistance(value)}</span>
      <select
        id={id}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={`Umkreis (${hint})`}
        value={value === null ? '' : RADIUS_OPTIONS.includes(value) ? String(value) : 'custom'}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') onChange(null)
          else if (v === 'custom') {
            const input = window.prompt('Umkreis in Kilometern (0,1 – 10):', value ? String(value / 1000) : '2')
            const km = input ? Number(input.replace(',', '.')) : NaN
            if (Number.isFinite(km) && km > 0) onChange(Math.round(Math.min(10, Math.max(0.1, km)) * 1000))
          } else onChange(Number(v))
        }}
      >
        <option value="">Kartenausschnitt</option>
        {RADIUS_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {formatDistance(r)}
          </option>
        ))}
        <option value="custom">Eigener Wert…</option>
      </select>
    </label>
  )
}

function FilterPanel({
  filters,
  onChange,
  operators,
  onClose,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  operators: { name: string; count: number }[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button, select, input')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [onClose])

  const row = 'flex min-h-12 items-center justify-between gap-3 py-2'
  const checkbox = 'h-5 w-5 accent-brand-700'
  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-slate-950/40 md:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-title"
        className="pb-safe max-h-[85dvh] w-full overflow-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-md md:rounded-3xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 id="filter-title" className="text-lg font-semibold">
            Filter
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Filter schließen"
          >
            <CloseIcon />
          </button>
        </div>

        <fieldset className="border-b border-slate-200 py-3 dark:border-slate-800">
          <legend className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Versand</legend>
          {(
            [
              ['all', 'Alle Briefkästen'],
              ['international', 'Internationaler Versand bestätigt'],
              ['national', 'Nur nationaler Versand bestätigt'],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className={row}>
              <span>{label}</span>
              <input
                type="radio"
                name="shipping"
                className={checkbox}
                checked={filters.shipping === v}
                onChange={() => set({ shipping: v })}
              />
            </label>
          ))}
          <p className="text-xs text-slate-600 dark:text-slate-400">
            „Bestätigt“ heißt: ausdrücklich in OpenStreetMap oder von mehreren Nutzer:innen angegeben. Die Farbe des
            Briefkastens wird dafür nie verwendet.
          </p>
        </fieldset>

        <fieldset className="border-b border-slate-200 py-3 dark:border-slate-800">
          <legend className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Betreiber</legend>
          <select
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
            value={filters.operator}
            onChange={(e) => set({ operator: e.target.value })}
            aria-label="Betreiber"
          >
            <option value="">Alle Betreiber</option>
            {filters.operator && !operators.some((o) => o.name === filters.operator) && (
              <option value={filters.operator}>{filters.operator}</option>
            )}
            {operators.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name} ({o.count})
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="py-3">
          <legend className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-300">Eigenschaften</legend>
          <label className={row}>
            <span>
              Rund um die Uhr zugänglich
              <span className="block text-xs text-slate-600 dark:text-slate-400">24/7 laut OSM oder im Freien angebracht</span>
            </span>
            <input type="checkbox" className={checkbox} checked={filters.open24} onChange={(e) => set({ open24: e.target.checked })} />
          </label>
          <label className={row}>
            <span>Leerungszeiten vorhanden</span>
            <input
              type="checkbox"
              className={checkbox}
              checked={filters.hasCollectionTimes}
              onChange={(e) => set({ hasCollectionTimes: e.target.checked })}
            />
          </label>
          <label className={row}>
            <span>
              Kürzlich überprüft
              <span className="block text-xs text-slate-600 dark:text-slate-400">Prüfdatum in den letzten 2 Jahren</span>
            </span>
            <input
              type="checkbox"
              className={checkbox}
              checked={filters.recentlyChecked}
              onChange={(e) => set({ recentlyChecked: e.target.checked })}
            />
          </label>
        </fieldset>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            className="h-12 flex-1 rounded-xl font-medium ring-1 ring-slate-300 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
            onClick={() => onChange({ ...filters, shipping: 'all', operator: '', open24: false, hasCollectionTimes: false, recentlyChecked: false })}
          >
            Zurücksetzen
          </button>
          <button
            type="button"
            className="h-12 flex-1 rounded-xl bg-brand-700 font-semibold text-white hover:bg-brand-800"
            onClick={onClose}
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  )
}
