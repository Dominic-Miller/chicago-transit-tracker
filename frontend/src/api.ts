import type { ArrivalBoard, Station, TrainPosition } from './types'

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path)
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
