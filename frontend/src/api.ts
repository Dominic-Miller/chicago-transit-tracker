import type { ArrivalBoard, BusArrivalBoard, BusPosition, BusRoute, BusStop, MapCenter, NearbyBoard, NearbyBusBoard, RouteGeometry, Station, TrainPosition } from './types'

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ?? ''
const apiBaseUrl = configuredApiBase && !/^https?:\/\//i.test(configuredApiBase)
  ? `https://${configuredApiBase}`
  : configuredApiBase

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { signal })
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

export const getNearbyBusBoard = (reference: MapCenter, signal?: AbortSignal) => {
  const parameters = new URLSearchParams({ lat: String(reference.latitude), lon: String(reference.longitude) })
  return request<NearbyBusBoard>(`/api/buses/nearby?${parameters}`, signal)
}

export const getBusRoutes = () => request<BusRoute[]>('/api/buses/routes')

export const getBusArrivals = (stopId: string) =>
  request<BusArrivalBoard>(`/api/buses/stops/${encodeURIComponent(stopId)}/arrivals`)

export const getBusPositions = (route: string) =>
  request<BusPosition[]>(`/api/buses/routes/${encodeURIComponent(route)}/vehicles`)

export const getBusRouteGeometry = (route: string, signal?: AbortSignal) =>
  request<RouteGeometry>(`/api/buses/routes/${encodeURIComponent(route)}/geometry`, signal)

export const getBusRouteStops = (route: string, signal?: AbortSignal) =>
  request<BusStop[]>(`/api/buses/routes/${encodeURIComponent(route)}/stops`, signal)

export const searchBusStops = (query: string, signal?: AbortSignal) =>
  request<BusStop[]>(`/api/buses/stops/search?q=${encodeURIComponent(query)}`, signal)
