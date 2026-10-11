import { useEffect, useId, useRef, useState } from 'react'
import { t } from '../i18n'
import { useDebounced } from '../hooks/useDebounced'
import { searchPlaces, type Place } from '../lib/geocode'
import type { LatLon } from '../lib/types'
import { CloseIcon, SearchIcon, SpinnerIcon } from './Icons'

interface Props {
  near: LatLon | null
  onPick: (p: Place) => void
}

export function SearchBar({ near, onPick }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounced = useDebounced(q, 400)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const skipNext = useRef(false)
  const lastRun = useRef('')

  const run = async (query: string, explicit: boolean) => {
    abortRef.current?.abort()
    lastRun.current = query.trim()
    const ac = new AbortController()
    abortRef.current = ac
    if (query.trim().length < 3 && !/\d/.test(query)) {
      setResults([])
      setLoading(false)
      return []
    }
    setLoading(true)
    setError(null)
    try {
      const r = await searchPlaces(query, { near, explicit, signal: ac.signal })
      if (ac.signal.aborted) return []
      setResults(r)
      setActive(r.length > 0 ? 0 : -1)
      setOpen(true)
      if (r.length === 0 && explicit) setError(t('search.noResult'))
      return r
    } catch {
      if (!ac.signal.aborted) {
        setError(t('search.unavailable'))
        setOpen(true)
      }
      return []
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }

  // Search-as-you-type (debounced, Photon only)
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false
      return
    }
    // Don't restart (and abort) a search that Enter already started for this text.
    if (debounced.trim() === lastRun.current) return
    if (debounced.trim().length >= 3) void run(debounced, false)
    else {
      setResults([])
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const pick = (p: Place) => {
    skipNext.current = true
    setQ(p.label)
    setOpen(false)
    setResults([])
    inputRef.current?.blur()
    onPick(p)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (open && active >= 0 && results[active] && lastRun.current === q.trim()) return pick(results[active])
    const r = await run(q, true)
    // Enter = take the best match directly.
    if (r.length > 0) pick(r[0])
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && (results.length > 0 || error)

  return (
    <form role="search" onSubmit={onSubmit} className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">
        {t('search.label')}
      </label>
      <div className="flex items-center gap-2 rounded-2xl bg-white px-3 shadow-lg ring-1 ring-slate-900/10 focus-within:ring-2 focus-within:ring-brand-500 dark:bg-slate-900 dark:ring-white/10">
        <SearchIcon className="shrink-0 text-slate-500 dark:text-slate-400" />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('search.placeholder')}
          className="h-12 w-full min-w-0 bg-transparent text-base outline-none focus-visible:outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={Boolean(showList)}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && showList ? `${listId}-opt-${active}` : undefined}
        />
        {loading && <SpinnerIcon className="shrink-0 text-slate-500" />}
        {q && !loading && (
          <button
            type="button"
            className="-mr-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => {
              setQ('')
              setResults([])
              setError(null)
              inputRef.current?.focus()
            }}
            aria-label={t('search.clear')}
          >
            <CloseIcon width={18} height={18} />
          </button>
        )}
      </div>
      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-[1200] mt-2 max-h-[60vh] overflow-auto rounded-2xl bg-white py-1 shadow-xl ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10"
        >
          {error && <li className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{error}</li>}
          {results.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-4 py-2.5 ${i === active ? 'bg-brand-50 dark:bg-slate-800' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(r)}
              onMouseEnter={() => setActive(i)}
            >
              <div className="truncate font-medium">{r.label}</div>
              {r.detail && <div className="truncate text-sm text-slate-600 dark:text-slate-400">{r.detail}</div>}
            </li>
          ))}
          <li className="border-t border-slate-100 px-4 py-1.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {t('search.attribution')}
          </li>
        </ul>
      )}
    </form>
  )
}
