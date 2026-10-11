import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLon } from '../lib/types'

export interface GeoState {
  position: (LatLon & { accuracy: number; timestamp: number }) | null
  status: 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable' | 'timeout' | 'unsupported'
}

/**
 * Location is only requested when the user asks for it (button), or
 * automatically if the permission was granted before. Nothing is sent to a server.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ position: null, status: 'idle' })
  const watchId = useRef<number | null>(null)

  const stopWatch = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }

  const locate = useCallback((): Promise<LatLon | null> => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, status: 'unsupported' }))
      return Promise.resolve(null)
    }
    setState((s) => ({ ...s, status: 'locating' }))
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          }
          setState({ position: p, status: 'ok' })
          resolve(p)
          // Keep the blue dot up to date while the app is open.
          stopWatch()
          watchId.current = navigator.geolocation.watchPosition(
            (w) =>
              setState({
                position: {
                  lat: w.coords.latitude,
                  lon: w.coords.longitude,
                  accuracy: w.coords.accuracy,
                  timestamp: w.timestamp,
                },
                status: 'ok',
              }),
            () => stopWatch(),
            { enableHighAccuracy: true, maximumAge: 15000 },
          )
        },
        (err) => {
          const status = err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable'
          setState((s) => ({ ...s, status }))
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      )
    })
  }, [])

  useEffect(() => stopWatch, [])

  return { ...state, locate }
}

/** True if the user already granted location permission earlier. */
export async function locationAlreadyGranted(): Promise<boolean> {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    return p?.state === 'granted'
  } catch {
    return false
  }
}
