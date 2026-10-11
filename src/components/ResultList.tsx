import { useState } from 'react'
import { nextCollection } from '../lib/collectionTimes'
import { operatorName, type ResultItem } from '../lib/filters'
import { formatDistance } from '../lib/geo'
import { colourCss, colourLabel } from '../lib/labels'
import { ChevronIcon, ClockIcon } from './Icons'
import { ShippingBadge } from './ShippingBadge'

interface Props {
  items: ResultItem[]
  nearestId: string | null
  distanceLabel: string
  onSelect: (id: string) => void
}

const PAGE = 60

export function ResultList({ items, nearestId, distanceLabel, onSelect }: Props) {
  const [limit, setLimit] = useState(PAGE)
  return (
    <div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800" aria-label="Briefkästen, nach Entfernung sortiert">
        {items.slice(0, limit).map(({ box, distance }) => {
          const next = box.collectionTimes ? nextCollection(box.collectionTimes) : null
          const swatch = box.colour ? colourCss(box.colour.split(';')[0]) : null
          return (
            <li key={box.id}>
              <button
                type="button"
                onClick={() => onSelect(box.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-900 dark:focus-visible:bg-slate-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {box.id === nearestId && (
                      <span className="rounded bg-yellow-300 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-yellow-950">
                        Nächster
                      </span>
                    )}
                    <span className="truncate font-medium">
                      {operatorName(box) ?? 'Betreiber unbekannt'}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-400">
                    {box.address ?? box.ref ?? box.name ?? 'Keine Adresse hinterlegt'}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <ShippingBadge shipping={box.shipping} />
                    {next ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
                        <ClockIcon width={13} height={13} /> {next.label}
                      </span>
                    ) : box.collectionTimes ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
                        <ClockIcon width={13} height={13} /> Leerungszeiten vorhanden
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">Leerung unbekannt</span>
                    )}
                    {swatch && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
                        <span className="h-3 w-3 rounded-full ring-1 ring-slate-900/20" style={{ background: swatch }} />
                        {colourLabel(box.colour!)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold tabular-nums">{formatDistance(distance)}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{distanceLabel}</div>
                </div>
                <ChevronIcon className="shrink-0 text-slate-400" width={18} height={18} />
              </button>
            </li>
          )
        })}
      </ul>
      {items.length > limit && (
        <div className="p-4">
          <button
            type="button"
            className="h-11 w-full rounded-xl font-medium ring-1 ring-slate-300 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-900"
            onClick={() => setLimit((l) => l + PAGE)}
          >
            Weitere {Math.min(PAGE, items.length - limit)} anzeigen ({items.length - limit} übrig)
          </button>
        </div>
      )}
    </div>
  )
}
