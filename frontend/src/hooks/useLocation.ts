import { useCallback, useState } from 'react'
import type { MapCenter } from '../types'

export type LocationPermission = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error'

export function useLocation() {
  const [permission, setPermission] = useState<LocationPermission>('idle')
  const [coordinates, setCoordinates] = useState<MapCenter | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setPermission('unavailable')
      setMessage('Location is not available in this browser. You can still explore from the map center.')
      return
    }
    setPermission('requesting')
    setMessage(null)
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setCoordinates({ latitude: coords.latitude, longitude: coords.longitude })
      setPermission('granted')
      setMessage(null)
    }, (error) => {
      setCoordinates(null)
      if (error.code === error.PERMISSION_DENIED) {
        setPermission('denied')
        setMessage('Location access is off. Enable it in browser settings, then try again.')
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        setPermission('unavailable')
        setMessage('Your location could not be determined. You can still explore from the map center.')
      } else {
        setPermission('error')
        setMessage('Location timed out. Try again or keep browsing the map.')
      }
    }, { enableHighAccuracy: false, timeout: 9_000, maximumAge: 60_000 })
  }, [])

  return { permission, coordinates, message, request, retry: request }
}
