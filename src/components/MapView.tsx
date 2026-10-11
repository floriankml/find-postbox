import L from 'leaflet'
import { memo, useEffect, useMemo, useRef } from 'react'
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet'
import type { ResultItem } from '../lib/filters'
import type { BBox, LatLon, ShippingStatus } from '../lib/types'
import { SHIPPING_LONG } from './ShippingBadge'

export interface MapCommand {
  center: LatLon
  zoom?: number
  bbox?: BBox
  nonce: number
}

export interface ViewInfo {
  bbox: BBox
  center: LatLon
  zoom: number
}

const MARKER_COLOURS: Record<ShippingStatus, string> = {
  international: '#047857',
  national: '#b45309',
  unknown: '#1d4ed8',
}

const iconCache = new Map<string, L.DivIcon>()
function markerIcon(status: ShippingStatus, nearest: boolean, selected: boolean): L.DivIcon {
  const key = `${status}|${nearest}|${selected}`
  let icon = iconCache.get(key)
  if (icon) return icon
  const size = nearest || selected ? 44 : 34
  const fill = MARKER_COLOURS[status]
  const ring = selected ? '#facc15' : nearest ? '#f8fafc' : 'white'
  const glyph =
    status === 'international'
      ? '<circle cx="16" cy="14" r="6.2" fill="none" stroke="white" stroke-width="1.6"/><path d="M9.8 14h12.4M16 7.8c2 2 2 10.4 0 12.4M16 7.8c-2 2-2 10.4 0 12.4" fill="none" stroke="white" stroke-width="1.4"/>'
      : '<rect x="9" y="10" width="14" height="9.5" rx="1.5" fill="white"/><path d="m9.5 10.8 6.5 5 6.5-5" fill="none" stroke="' +
        fill +
        '" stroke-width="1.6"/>'
  const html = `<svg width="${size}" height="${size * 1.25}" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 39s13-12.4 13-23A13 13 0 0 0 3 16c0 10.6 13 23 13 23z" fill="${fill}" stroke="${ring}" stroke-width="${selected ? 3 : 2}"/>
    ${glyph}
    ${nearest ? '<circle cx="26" cy="6" r="5" fill="#facc15" stroke="white" stroke-width="1.5"/>' : ''}
  </svg>`
  icon = L.divIcon({
    html,
    className: `pf-marker${selected ? ' is-selected' : ''}`,
    iconSize: [size, size * 1.25],
    iconAnchor: [size / 2, size * 1.25],
  })
  iconCache.set(key, icon)
  return icon
}

const userIcon = L.divIcon({
  className: 'pf-user-dot',
  html: `<div style="position:relative;width:22px;height:22px">
    <span class="pf-pulse" style="position:absolute;inset:0;border-radius:9999px;background:#3b82f6"></span>
    <span style="position:absolute;inset:3px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

function readStoredView(): { center: [number, number]; zoom: number } {
  try {
    const v = JSON.parse(localStorage.getItem('pf-view') ?? 'null') as { lat: number; lon: number; zoom: number } | null
    if (v && Number.isFinite(v.lat) && Number.isFinite(v.lon) && Number.isFinite(v.zoom)) {
      return { center: [v.lat, v.lon], zoom: v.zoom }
    }
  } catch {
    /* ignore */
  }
  // Europe overview – the user can search or locate.
  return { center: [50.5, 10], zoom: 4 }
}

function toBBox(b: L.LatLngBounds): BBox {
  return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }
}

function ViewReporter({ onView }: { onView: (v: ViewInfo) => void }) {
  const timer = useRef<number | undefined>(undefined)
  const map = useMapEvents({
    moveend: () => schedule(),
    zoomend: () => schedule(),
  })
  const report = () => {
    const c = map.getCenter()
    const v = { bbox: toBBox(map.getBounds()), center: { lat: c.lat, lon: c.lng }, zoom: map.getZoom() }
    onView(v)
    try {
      localStorage.setItem('pf-view', JSON.stringify({ lat: c.lat, lon: c.lng, zoom: map.getZoom() }))
    } catch {
      /* ignore */
    }
  }
  const schedule = () => {
    window.clearTimeout(timer.current)
    // Debounce: wait until the user stops panning.
    timer.current = window.setTimeout(report, 450)
  }
  useEffect(() => {
    report()
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

function CommandRunner({ command }: { command: MapCommand | null }) {
  const map = useMap()
  useEffect(() => {
    if (!command) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (command.bbox) {
      const b = L.latLngBounds([command.bbox.south, command.bbox.west], [command.bbox.north, command.bbox.east])
      const z = Math.max(Math.min(map.getBoundsZoom(b), 17), command.zoom ?? 14)
      map.setView([command.center.lat, command.center.lon], z, { animate: !reduce })
    } else {
      map.setView([command.center.lat, command.center.lon], command.zoom ?? Math.max(map.getZoom(), 16), {
        animate: !reduce,
      })
    }
  }, [command, map])
  return null
}

/** Keep Leaflet's size in sync when the surrounding layout changes. */
function SizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}

function PanToSelected({ selected }: { selected: LatLon | null }) {
  const map = useMap()
  useEffect(() => {
    if (!selected) return
    const pt = map.latLngToContainerPoint([selected.lat, selected.lon])
    const size = map.getSize()
    // On small screens the detail sheet covers the lower half – keep the marker in the upper part.
    const isMobile = size.x < 768
    const safeBottom = isMobile ? size.y * 0.4 : size.y - 40
    if (pt.x < 40 || pt.x > size.x - 40 || pt.y < 120 || pt.y > safeBottom) {
      const target = L.point(size.x / 2, isMobile ? size.y * 0.3 : size.y / 2)
      map.panBy(pt.subtract(target), { animate: true })
    }
  }, [selected, map])
  return null
}

interface Props {
  items: ResultItem[]
  selectedId: string | null
  nearestId: string | null
  user: (LatLon & { accuracy: number }) | null
  radiusCenter: LatLon | null
  radius: number | null
  command: MapCommand | null
  onSelect: (id: string) => void
  onView: (v: ViewInfo) => void
  searchPoint: LatLon | null
  showZoom: boolean
}

const searchIcon = L.divIcon({
  className: 'pf-user-dot',
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#0f172a;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const MAX_PIN_MARKERS = 350

function MapViewInner({ items, selectedId, nearestId, user, radiusCenter, radius, command, onSelect, onView, searchPoint, showZoom }: Props) {
  const initial = useMemo(readStoredView, [])
  const usePins = items.length <= MAX_PIN_MARKERS
  const selected = items.find((i) => i.box.id === selectedId)?.box ?? null

  return (
    <MapContainer
      center={initial.center}
      zoom={initial.zoom}
      minZoom={2}
      maxZoom={19}
      zoomControl={false}
      preferCanvas
      worldCopyJump
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution='Karte &amp; Daten: &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-Mitwirkende</a> (ODbL)'
      />
      {showZoom && <ZoomControl position="bottomright" zoomInTitle="Hineinzoomen" zoomOutTitle="Herauszoomen" />}
      <ViewReporter onView={onView} />
      <CommandRunner command={command} />
      <SizeWatcher />
      <PanToSelected selected={selected} />
      {radius !== null && radiusCenter && (
        <Circle
          center={[radiusCenter.lat, radiusCenter.lon]}
          radius={radius}
          interactive={false}
          pathOptions={{ color: '#2563eb', weight: 1.5, fillOpacity: 0.04, dashArray: '6 6' }}
        />
      )}
      {searchPoint && (
        <Marker position={[searchPoint.lat, searchPoint.lon]} icon={searchIcon} interactive={false} keyboard={false} zIndexOffset={-200} />
      )}
      {user && (
        <>
          {user.accuracy > 15 && user.accuracy < 3000 && (
            <Circle
              center={[user.lat, user.lon]}
              radius={user.accuracy}
              interactive={false}
              pathOptions={{ color: '#3b82f6', weight: 1, fillOpacity: 0.1 }}
            />
          )}
          <Marker position={[user.lat, user.lon]} icon={userIcon} interactive={false} keyboard={false} zIndexOffset={-100} />
        </>
      )}
      {usePins
        ? items.map(({ box }) => {
            const isSel = box.id === selectedId
            const isNear = box.id === nearestId
            return (
              <Marker
                key={box.id}
                position={[box.lat, box.lon]}
                icon={markerIcon(box.shipping.status, isNear, isSel)}
                title={`Briefkasten${box.operator ? ` (${box.operator})` : ''} – ${SHIPPING_LONG[box.shipping.status]}${
                  isNear ? ' – nächstgelegen' : ''
                }`}
                alt="Briefkasten"
                zIndexOffset={isSel ? 1000 : isNear ? 500 : 0}
                eventHandlers={{ click: () => onSelect(box.id) }}
              />
            )
          })
        : items.map(({ box }) => (
            <CircleMarker
              key={box.id}
              center={[box.lat, box.lon]}
              radius={box.id === selectedId || box.id === nearestId ? 9 : 6}
              pathOptions={{
                color: box.id === selectedId ? '#facc15' : 'white',
                weight: 2,
                fillColor: MARKER_COLOURS[box.shipping.status],
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelect(box.id) }}
            />
          ))}
    </MapContainer>
  )
}

export const MapView = memo(MapViewInner)
export { MARKER_COLOURS }
