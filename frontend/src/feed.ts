import type { Arrival, BusArrival, BusRoute, BusStop, NearbyBoard, NearbyBusBoard, Station } from './types'

export type DirectionGroup = {
  id: string
  label: string
  arrivals: Arrival[]
  busStop?: BusStop
  distanceMiles?: number
  walkMinutes?: number
}

export type NearbyLine = {
  mode: 'rail'
  route: string
  station: Station
  distanceMiles: number
  walkMinutes: number
  directions: DirectionGroup[]
  earliestMinutes: number
}

export type NearbyBusLine = {
  mode: 'bus'
  route: string
  routeName: string
  stop: BusStop
  distanceMiles: number
  walkMinutes: number
  directions: DirectionGroup[]
  earliestMinutes: number
}

export type TransitNearbyLine = NearbyLine | NearbyBusLine

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
        mode: 'rail',
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

export function buildNearbyBusLines(board: NearbyBusBoard | null, routes: BusRoute[] = []): NearbyBusLine[] {
  if (!board) return []
  const routeNames = new Map(routes.map((route) => [route.id, route.name]))
  const candidates = new Map<string, NearbyBusBoard['stops']>()
  ;[...board.stops]
    .sort((left, right) => left.distanceMiles - right.distanceMiles || left.stop.id.localeCompare(right.stop.id))
    .forEach((candidate) => {
      const { stop, arrivals } = candidate
      const routeIds = new Set([...stop.routes, ...arrivals.map((arrival) => arrival.route)])
      routeIds.forEach((route) => {
        candidates.set(route, [...(candidates.get(route) ?? []), candidate])
      })
    })
  return [...candidates.entries()].map(([route, stops]) => {
    const nearest = stops[0]
    const directions = new Map<string, DirectionGroup>()
    stops.forEach(({ stop, distanceMiles, walkMinutes, arrivals }) => {
      const routeArrivals = arrivals.filter((arrival) => arrival.route === route)
      const directionIds = new Set((routeArrivals.length
        ? routeArrivals.map((arrival) => arrival.direction.trim())
        : [stop.direction.trim()]).filter(Boolean))
      directionIds.forEach((id) => {
        if (directions.has(id)) return
        const values = routeArrivals.filter((arrival) => arrival.direction.trim() === id)
          .map(busArrivalToArrival).sort(compareArrival)
        directions.set(id, {
          id,
          label: directionLabel(id, values[0]?.destination),
          arrivals: values,
          busStop: stop,
          distanceMiles,
          walkMinutes,
        })
      })
    })
    const groupedDirections = [...directions.values()]
    return {
      mode: 'bus' as const,
      route,
      routeName: routeNames.get(route) ?? `Route ${route}`,
      stop: nearest.stop,
      distanceMiles: nearest.distanceMiles,
      walkMinutes: nearest.walkMinutes,
      directions: groupedDirections,
      earliestMinutes: Math.min(...groupedDirections.flatMap((direction) => direction.arrivals.map((arrival) => arrival.minutes)), Number.POSITIVE_INFINITY),
    }
  }).sort(compareTransitLine)
}

export function mergeNearbyLines(rail: NearbyLine[], buses: NearbyBusLine[]): TransitNearbyLine[] {
  return [...rail, ...buses].sort(compareTransitLine)
}

export function filterVehiclesForDirection<T extends { destination: string }>(vehicles: T[], direction?: DirectionGroup): T[] {
  const destinations = [...new Set((direction?.arrivals ?? [])
    .map((arrival) => normalizeDestination(arrival.destination))
    .filter(Boolean))]
  if (destinations.length === 0) return vehicles
  return vehicles.filter((vehicle) => {
    const destination = normalizeDestination(vehicle.destination)
    return destinations.some((candidate) => destination === candidate
      || destination.length >= 4 && candidate.length >= 4
        && (destination.includes(candidate) || candidate.includes(destination)))
  })
}

export function busArrivalToArrival(arrival: BusArrival): Arrival {
  return {
    stationId: arrival.stopId,
    runNumber: arrival.vehicleId || `${arrival.route}-${arrival.predictionTime}`,
    route: arrival.route,
    destination: arrival.destination,
    platform: arrival.direction,
    arrivalTime: arrival.predictionTime,
    minutes: arrival.minutes,
    approaching: arrival.approaching,
    scheduled: arrival.scheduled,
    delayed: arrival.delayed,
  }
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

function compareTransitLine(left: TransitNearbyLine, right: TransitNearbyLine) {
  return left.distanceMiles - right.distanceMiles
    || left.earliestMinutes - right.earliestMinutes
    || left.mode.localeCompare(right.mode)
    || left.route.localeCompare(right.route, undefined, { numeric: true })
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

function normalizeDestination(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
