import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { navigationTargets } from '../lib/navigation'
import type { LatLon } from '../lib/types'
import { ChevronDownIcon, NavigateIcon } from './Icons'

interface Props {
  dest: LatLon
  origin: LatLon | null
}

/**
 * Primary: Google Maps universal link (opens the app on Android/iOS if
 * installed, otherwise the website). Secondary menu: Apple Karten, the
 * Android app chooser (geo: URI) and OpenStreetMap as universal fallback.
 */
export function NavigateButton({ dest, origin }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const targets = navigationTargets(dest, origin)
  const primary = targets.find((x) => x.primary)!
  const others = targets.filter((x) => !x.primary)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return
        e.stopPropagation() // only close the menu, not the detail view
        setOpen(false)
      } else if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={ref} className="relative flex w-full">
      <a
        href={primary.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-13 flex-1 items-center justify-center gap-2 rounded-l-2xl bg-brand-700 px-4 text-base font-semibold text-white shadow-md hover:bg-brand-800 active:bg-brand-800"
      >
        <NavigateIcon />
        {t('nav.go')}
      </a>
      <button
        type="button"
        className="grid h-13 w-13 place-items-center rounded-r-2xl border-l border-white/25 bg-brand-700 text-white shadow-md hover:bg-brand-800"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('nav.choose')}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDownIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute inset-x-0 bottom-full z-10 mb-2 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/10"
        >
          <a
            role="menuitem"
            href={primary.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700"
            onClick={() => setOpen(false)}
          >
            {primary.label}
          </a>
          {others.map((target) => (
            <a
              key={target.id}
              role="menuitem"
              href={target.url}
              target={target.id === 'geo' ? undefined : '_blank'}
              rel="noopener noreferrer"
              className="block border-t border-slate-100 px-4 py-3 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
              onClick={() => setOpen(false)}
            >
              {target.label}
            </a>
          ))}
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t('nav.target')}: {dest.lat.toFixed(5)}, {dest.lon.toFixed(5)}
          </div>
        </div>
      )}
    </div>
  )
}
