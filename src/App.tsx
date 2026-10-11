import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { DetailSheet } from './components/DetailSheet'
import { FilterBar } from './components/FilterBar'
import { InfoIcon, ListIcon, LocateIcon, MapIcon, PlusIcon, SpinnerIcon } from './components/Icons'
import { MapView, type MapCommand, type ViewInfo } from './components/MapView'
import { ResultList } from './components/ResultList'
import { SearchBar } from './components/SearchBar'
import { ShippingBadge } from './components/ShippingBadge'
import { StatusBar } from './components/StatusBar'
import { locationAlreadyGranted, useGeolocation } from './hooks/useGeolocation'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useOnline } from './hooks/useOnline'
import { useTheme } from './hooks/useTheme'
import { nextCollection } from './lib/collectionTimes'
import { activeFilterCount, applyFilters, DEFAULT_FILTERS, operatorName, topOperators, type Filters } from './lib/filters'
import { bboxAround, formatDistance } from './lib/geo'
import type { Place } from './lib/geocode'
import { postboxStore } from './lib/store'
import type { BBox, LatLon } from './lib/types'

// Rarely used dialogs are loaded on demand.
const InfoDialog = lazy(() => import('./components/InfoDialog').then((m) => ({ default: m.InfoDialog })))
const ReportDialog = lazy(() => import('./components/ReportDialog').then((m) => ({ default: m.ReportDialog })))

/** Below this zoom level no data is requested for the plain map view. */
const MIN_DATA_ZOOM = 12

function padBBox(b: BBox, f = 0.15): BBox {
  const dy = (b.north - b.south) * f
  const dx = (b.east - b.west) * f
  return { south: b.south - dy, north: b.north + dy, west: b.west - dx, east: b.east + dx }
}

function loadFilters(): Filters {
  try {
    return { ...DEFAULT_FILTERS, ...(JSON.parse(localStorage.getItem('pf-filters') ?? '{}') as Partial<Filters>) }
  } catch {
    return DEFAULT_FILTERS
  }
}

export default function App() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const online = useOnline()
  const { pref: theme, cycle: cycleTheme } = useTheme()
  const geo = useGeolocation()
  const snap = useSyncExternalStore(postboxStore.subscribe, postboxStore.getSnapshot)

  const [view, setView] = useState<ViewInfo | null>(null)
  const [filters, setFilters] = useState<Filters>(loadFilters)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileList, setMobileList] = useState(false)
  const [command, setCommand] = useState<MapCommand | null>(null)
  const [searchPoint, setSearchPoint] = useState<Place | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [missingOpen, setMissingOpen] = useState(false)
  const [geoMessage, setGeoMessage] = useState<string | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerH, setHeaderH] = useState(120)

  useEffect(() => {
    try {
      localStorage.setItem('pf-filters', JSON.stringify(filters))
    } catch {
      /* ignore */
    }
  }, [filters])

  // Measure the floating header on mobile so panels can sit below it.
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeaderH(el.getBoundingClientRect().height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [isDesktop])

  const user = geo.position
  // Reference point for distances: searched place > own position > map centre.
  // (Pressing the locate button clears the searched place again.)
  const refPoint: LatLon | null = searchPoint ?? user ?? view?.center ?? null
  const distanceLabel = searchPoint ? 'vom Suchort' : user ? 'von dir' : 'v. Kartenmitte'
  const tooFar = !!view && filters.radius === null && view.zoom < MIN_DATA_ZOOM

  // Load data for the visible area or the radius.
  const refKey = refPoint ? `${refPoint.lat.toFixed(4)},${refPoint.lon.toFixed(4)}` : ''
  useEffect(() => {
    if (!view || !refPoint) return
    if (filters.radius !== null) void postboxStore.ensureViewport(bboxAround(refPoint, filters.radius))
    else if (view.zoom >= MIN_DATA_ZOOM) void postboxStore.ensureViewport(padBBox(view.bbox))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, filters.radius, refKey])

  const items = useMemo(
    () => (refPoint && !tooFar ? applyFilters(snap.boxes.values(), filters, refPoint, view?.bbox ?? null) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap.version, filters, refKey, view, tooFar],
  )
  const filtersOn = activeFilterCount(filters) > 0
  // How many boxes the filters hide (only computed when nothing is left).
  const hiddenByFilters = useMemo(
    () =>
      refPoint && !tooFar && items.length === 0 && filtersOn
        ? applyFilters(snap.boxes.values(), { ...DEFAULT_FILTERS, radius: filters.radius }, refPoint, view?.bbox ?? null).length
        : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, filtersOn, snap.version],
  )
  const operators = useMemo(() => topOperators(snap.boxes.values()), [snap.version]) // eslint-disable-line react-hooks/exhaustive-deps
  const nearest = items[0] ?? null
  const selected = selectedId ? (snap.boxes.get(selectedId) ?? null) : null

  const select = useCallback((id: string) => {
    setSelectedId(id)
    setMobileList(false)
  }, [])

  const locate = useCallback(async () => {
    setGeoMessage(null)
    const p = await geo.locate()
    if (p) {
      setSearchPoint(null)
      setCommand({ center: p, zoom: 16, nonce: Date.now() })
    }
  }, [geo])

  useEffect(() => {
    const msg: Partial<Record<typeof geo.status, string>> = {
      denied: 'Standortzugriff nicht erlaubt. Du kannst stattdessen einen Ort suchen.',
      unavailable: 'Standort konnte nicht ermittelt werden. Suche stattdessen einen Ort.',
      timeout: 'Standortbestimmung dauerte zu lange. Bitte erneut versuchen oder Ort suchen.',
      unsupported: 'Dein Browser unterstützt keine Standortbestimmung. Suche stattdessen einen Ort.',
    }
    setGeoMessage(msg[geo.status] ?? null)
  }, [geo.status])

  // If location permission was granted earlier, use it right away (no prompt).
  useEffect(() => {
    void locationAlreadyGranted().then((granted) => {
      if (granted) void locate()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape closes the detail view.
  useEffect(() => {
    if (!selectedId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  const onPick = useCallback((p: Place) => {
    setSearchPoint(p)
    setSelectedId(null)
    setMobileList(false)
    setCommand({ center: p, bbox: p.bbox, zoom: p.bbox ? 15 : 17, nonce: Date.now() })
  }, [])

  const header = (
    <div ref={headerRef} className={isDesktop ? 'space-y-2 p-3' : 'pt-safe space-y-2 px-3 pb-1'}>
      <div className="flex items-center gap-2">
        <SearchBar near={user ?? view?.center ?? null} onPick={onPick} />
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-lg ring-1 ring-slate-900/10 hover:bg-slate-50 dark:bg-slate-900 dark:ring-white/10 dark:hover:bg-slate-800"
          aria-label="Info, Legende und Datenquellen"
        >
          <InfoIcon />
        </button>
      </div>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        operators={operators}
        radiusHint={searchPoint ? 'um den Suchort' : user ? 'um deinen Standort' : 'um die Kartenmitte'}
      />
    </div>
  )

  const filterNotice = hiddenByFilters > 0 && (
    <div className="pointer-events-auto mt-2 flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-sm shadow-lg ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10" role="status">
      <span className="flex-1">
        Kein Treffer mit diesen Filtern. {hiddenByFilters} Briefk{hiddenByFilters === 1 ? 'asten' : 'ästen'} ohne passende Angabe ausgeblendet
        {filters.shipping === 'international' ? ' – Auslandsversand ist in den Daten nur selten ausdrücklich vermerkt.' : '.'}
      </span>
      <button type="button" className="shrink-0 font-semibold text-brand-700 underline dark:text-brand-500" onClick={() => setFilters({ ...DEFAULT_FILTERS, radius: filters.radius })}>
        Alle zeigen
      </button>
    </div>
  )

  const status = (
    <StatusBar
      state={snap.state}
      tooFar={tooFar}
      online={online}
      stale={snap.stale}
      oldestFetch={snap.oldestFetch}
      geoMessage={geoMessage}
      onRetry={() => void postboxStore.retry()}
      onLocate={() => void locate()}
      onDismissGeo={() => setGeoMessage(null)}
    />
  )

  const filtersActive = filtersOn
  const emptyState = !tooFar && snap.state.status === 'ready' && items.length === 0 && (
    <div className="p-6 text-center text-sm text-slate-600 dark:text-slate-400">
      <p className="font-medium text-slate-900 dark:text-slate-100">Keine Briefkästen gefunden</p>
      <p className="mt-1">
        {filtersActive
          ? `Mit den aktuellen Filtern gibt es hier keine Treffer${hiddenByFilters ? ` (${hiddenByFilters} ausgeblendet)` : ''}.`
          : 'In OpenStreetMap ist in diesem Bereich kein Briefkasten eingetragen. Die Daten sind nicht überall vollständig.'}
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {filtersActive && (
          <button type="button" className="h-10 rounded-full px-4 font-medium ring-1 ring-slate-300 dark:ring-slate-700" onClick={() => setFilters({ ...DEFAULT_FILTERS, radius: filters.radius })}>
            Filter zurücksetzen
          </button>
        )}
        {filters.radius !== null && filters.radius < 5000 && (
          <button type="button" className="h-10 rounded-full px-4 font-medium ring-1 ring-slate-300 dark:ring-slate-700" onClick={() => setFilters({ ...filters, radius: 5000 })}>
            Umkreis 5 km
          </button>
        )}
      </div>
    </div>
  )

  const listHeader = (
    <div className="flex items-center justify-between px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
      <span>
        {items.length} Briefk{items.length === 1 ? 'asten' : 'ästen'}{' '}
        {filters.radius !== null ? `im Umkreis von ${formatDistance(filters.radius)}` : 'im Kartenausschnitt'}
      </span>
      <button type="button" className="inline-flex items-center gap-1 font-medium text-brand-700 dark:text-brand-500" onClick={() => setMissingOpen(true)}>
        <PlusIcon width={16} height={16} /> Fehlt einer?
      </button>
    </div>
  )

  const list = (
    <>
      {listHeader}
      {emptyState}
      <ResultList items={items} nearestId={nearest?.box.id ?? null} distanceLabel={distanceLabel} onSelect={select} />
      <p className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
        Daten © OpenStreetMap-Mitwirkende (ODbL). Keine offizielle Auskunft der Postdienstleister – Angaben im Zweifel vor Ort prüfen.
      </p>
    </>
  )

  const locateButton = (
    <button
      type="button"
      onClick={() => void locate()}
      className={`pointer-events-auto grid h-14 w-14 place-items-center rounded-full shadow-lg ring-1 ring-slate-900/10 dark:ring-white/10 ${
        user ? 'bg-brand-700 text-white' : 'bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100'
      }`}
      aria-label="Meinen Standort verwenden"
      title="Meinen Standort verwenden"
    >
      {geo.status === 'locating' ? <SpinnerIcon width={24} height={24} /> : <LocateIcon width={24} height={24} />}
    </button>
  )

  const map = (
    <MapView
      items={items}
      selectedId={selectedId}
      nearestId={nearest?.box.id ?? null}
      user={user}
      radiusCenter={refPoint}
      radius={filters.radius}
      command={command}
      onSelect={select}
      onView={setView}
      searchPoint={user ? null : searchPoint}
      showZoom={isDesktop}
    />
  )

  const dialogs = (
    <Suspense fallback={null}>
      {infoOpen && <InfoDialog onClose={() => setInfoOpen(false)} theme={theme} onCycleTheme={cycleTheme} />}
      {missingOpen && view && (
        <ReportDialog kind="missing" box={null} location={view.center} onClose={() => setMissingOpen(false)} />
      )}
    </Suspense>
  )

  if (isDesktop) {
    return (
      <div className="flex h-dvh w-full overflow-hidden">
        <aside className="flex w-[420px] shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="border-b border-slate-200 dark:border-slate-800">
            <h1 className="flex items-center gap-2 px-4 pt-3 text-base font-bold tracking-tight">
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-6 w-6" /> Postbox Finder
            </h1>
            {header}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {selected ? (
              <DetailSheet box={selected} user={user} isNearest={selected.id === nearest?.box.id} fallbackRef={searchPoint ? { point: searchPoint, label: 'vom Suchort' } : null} onClose={() => setSelectedId(null)} />
            ) : (
              list
            )}
          </div>
        </aside>
        <main className="relative min-w-0 flex-1">
          {map}
          <div className="pointer-events-none absolute top-3 left-1/2 z-[1100] w-[min(32rem,90%)] -translate-x-1/2">
            {status}
            {filterNotice}
          </div>
          <div className="pointer-events-none absolute right-3 bottom-24 z-[1100]">{locateButton}</div>
        </main>
        {dialogs}
      </div>
    )
  }

  // ---------- Mobile ----------
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <h1 className="sr-only">Postbox Finder</h1>
      <main className="absolute inset-0">{map}</main>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100]">
        <div className="pointer-events-auto bg-gradient-to-b from-slate-50/90 via-slate-50/60 to-transparent dark:from-slate-950/90 dark:via-slate-950/60">
          {header}
        </div>
        {!mobileList && !selected && (
          <div className="px-3">
            {status}
            {filterNotice}
          </div>
        )}
      </div>

      {mobileList && !selected && (
        <section
          className="absolute inset-x-0 bottom-0 z-[1050] overflow-y-auto bg-white pb-24 dark:bg-slate-950"
          style={{ top: headerH }}
          aria-label="Ergebnisliste"
        >
          <div className="px-3 pt-1">{status}</div>
          {list}
        </section>
      )}

      {selected ? (
        <section
          className="absolute inset-x-0 bottom-0 z-[1150] max-h-[72dvh] overflow-y-auto rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.15)] dark:bg-slate-950"
          aria-label="Briefkasten-Details"
        >
          <div className="flex justify-center bg-white pt-2 dark:bg-slate-950" aria-hidden>
            <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
          <DetailSheet box={selected} user={user} isNearest={selected.id === nearest?.box.id} fallbackRef={searchPoint ? { point: searchPoint, label: 'vom Suchort' } : null} onClose={() => setSelectedId(null)} />
        </section>
      ) : (
        <div className="pb-safe pointer-events-none absolute inset-x-0 bottom-0 z-[1100] space-y-3 px-3">
          <div className="flex items-end justify-between">
            <button
              type="button"
              onClick={() => setMobileList((v) => !v)}
              className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-slate-900 px-5 font-semibold text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
            >
              {mobileList ? <MapIcon /> : <ListIcon />}
              {mobileList ? 'Karte' : `Liste${items.length ? ` (${items.length})` : ''}`}
            </button>
            {!mobileList && locateButton}
          </div>
          {!mobileList && nearest && (
            <button
              type="button"
              onClick={() => select(nearest.box.id)}
              className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-xl ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-yellow-300 text-sm font-bold text-yellow-950" aria-hidden>
                1
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  Nächster Briefkasten · {formatDistance(nearest.distance)} {distanceLabel}
                </span>
                <span className="block truncate font-medium">
                  {operatorName(nearest.box) ?? 'Betreiber unbekannt'}
                  {nearest.box.collectionTimes && nextCollection(nearest.box.collectionTimes)
                    ? ` · Leerung ${nextCollection(nearest.box.collectionTimes)!.label}`
                    : ''}
                </span>
                <span className="mt-1 block">
                  <ShippingBadge shipping={nearest.box.shipping} />
                </span>
              </span>
            </button>
          )}
        </div>
      )}
      {dialogs}
    </div>
  )
}
