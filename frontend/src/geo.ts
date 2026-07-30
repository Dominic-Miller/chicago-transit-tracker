import type { MapCenter, Station } from './types'

const EARTH_RADIUS_MILES = 3958.8

const toRadians = (degrees: number) => degrees * Math.PI / 180

export function distanceMiles(a: MapCenter, b: MapCenter): number {
  const latDelta = toRadians(b.latitude - a.latitude)
  const lonDelta = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const haversine = Math.sin(latDelta / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(haversine))
}

export function nearbyStations(stations: Station[], center: MapCenter, limit = 8) {
  return stations
    .map((station) => ({ station, distance: distanceMiles(center, station) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, limit)
}
