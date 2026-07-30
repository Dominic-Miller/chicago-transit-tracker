import type { ArrivalBoard, MapCenter, NearbyBoard, RouteGeometry, Station, TrainPosition } from './types'

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(payload?.message || `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const getStations = () => request<Station[]>('/api/stations')

export const getArrivals = (stationId: string) =>
  request<ArrivalBoard>(`/api/stations/${stationId}/arrivals`)

export const getTrainPositions = (route: string) =>
  request<TrainPosition[]>(`/api/routes/${encodeURIComponent(route)}/trains`)

export const getNearbyBoard = (reference: MapCenter, signal?: AbortSignal) => {
  const parameters = new URLSearchParams({
    lat: String(reference.latitude),
    lon: String(reference.longitude),
  })
  return request<NearbyBoard>(`/api/nearby?${parameters}`, signal)
}

export const getRouteGeometry = (route: string, signal?: AbortSignal) =>
  request<RouteGeometry>(`/api/routes/${encodeURIComponent(route)}/geometry`, signal)
