import type { Arrival, NearbyBoard, Station } from './types'

export type DirectionGroup = {
  id: string
  label: string
  arrivals: Arrival[]
}

export type NearbyLine = {
  route: string
  station: Station
  distanceMiles: number
  walkMinutes: number
  directions: DirectionGroup[]
  earliestMinutes: number
}

export function buildNearbyLines(board: NearbyBoard | null): NearbyLine[] {
  if (!board) return []
  const selected = new Map<string, NearbyLine>()
  ;[...board.stations]
    .sort((left, right) => left.distanceMiles - right.distanceMiles || left.station.id.localeCompare(right.station.id))
    .forEach(({ station, distanceMiles, walkMinutes, arrivals }) => {
    station.routes.forEach((rawRoute) => {
      const route = normalizeRoute(rawRoute)
      if (selected.has(route)) return
      const routeArrivals = arrivals
        .filter((arrival) => normalizeRoute(arrival.route) === route)
        .sort(compareArrival)
      const groups = new Map<string, Arrival[]>()
      routeArrivals.forEach((arrival) => {
        const id = arrival.platform?.trim() || `Toward ${arrival.destination}`
        groups.set(id, [...(groups.get(id) ?? []), arrival])
      })
      const directions = [...groups.entries()].map(([id, values]) => ({
        id,
        label: directionLabel(id, values[0]?.destination),
        arrivals: values,
      }))
      selected.set(route, {
        route,
        station,
        distanceMiles,
        walkMinutes,
        directions,
        earliestMinutes: routeArrivals[0]?.minutes ?? Number.POSITIVE_INFINITY,
      })
    })
    })
  return [...selected.values()].sort((left, right) =>
    left.distanceMiles - right.distanceMiles
    || left.earliestMinutes - right.earliestMinutes
    || left.route.localeCompare(right.route))
}

export function directionLabel(platform: string, destination?: string) {
  const cardinal = platform.match(/(Northbound|Southbound|Eastbound|Westbound)/i)?.[1]
  if (cardinal) return `${capitalize(cardinal)}${destination ? ` · ${destination}` : ''}`
  return platform || (destination ? `Toward ${destination}` : 'Direction unavailable')
}

export function walkLabel(walkMinutes: number, distanceMiles: number) {
  return `About ${walkMinutes} min walk · ${distanceMiles < 0.1 ? '<0.1' : distanceMiles.toFixed(1)} mi`
}

export function normalizeRoute(route: string) {
  return ({ G: 'Green', Brn: 'Brown', P: 'Purple', Org: 'Orange', O: 'Orange', Y: 'Yellow' } as Record<string, string>)[route] ?? route
}

function compareArrival(left: Arrival, right: Arrival) {
  return left.minutes - right.minutes || left.arrivalTime.localeCompare(right.arrivalTime) || left.runNumber.localeCompare(right.runNumber)
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}
