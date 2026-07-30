import { useCallback, useEffect, useRef, useState } from 'react'
import { getNearbyBusBoard } from '../api'
import type { MapCenter, NearbyBusBoard } from '../types'

export function useNearbyBusBoard(reference: MapCenter) {
  const [board, setBoard] = useState<NearbyBusBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const boardRef = useRef<NearbyBusBoard | null>(null)
  boardRef.current = board

  useEffect(() => {
    let controller: AbortController | null = null
    let timer: number | null = null
    let stopped = false
    const schedule = () => {
      if (!stopped && document.visibilityState === 'visible') timer = window.setTimeout(load, 60_000)
    }
    const load = async () => {
      if (document.visibilityState !== 'visible') return
      controller?.abort()
      controller = new AbortController()
      setError(null)
      setLoading(!boardRef.current)
      setRefreshing(Boolean(boardRef.current))
      try {
        const result = await getNearbyBusBoard(reference, controller.signal)
        if (!stopped) setBoard(result)
      } catch (reason) {
        if (!stopped && !(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError(reason instanceof Error ? reason.message : 'Nearby buses are unavailable')
        }
      } finally {
        if (!stopped) { setLoading(false); setRefreshing(false); schedule() }
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (timer !== null) window.clearTimeout(timer)
        void load()
      } else {
        controller?.abort()
        if (timer !== null) window.clearTimeout(timer)
      }
    }
    void load()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stopped = true
      controller?.abort()
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [reference.latitude, reference.longitude, retryKey])

  return { board, loading, refreshing, error, retry: useCallback(() => setRetryKey((value) => value + 1), []) }
}
