export type Station = {
  id: string
  name: string
  descriptiveName: string
  latitude: number
  longitude: number
  accessible: boolean
  routes: string[]
}

export type Arrival = {
  stationId: string
  runNumber: string
  route: string
  destination: string
  platform: string
  arrivalTime: string
  minutes: number
  approaching: boolean
  scheduled: boolean
  delayed: boolean
}

export type ArrivalBoard = {
  generatedAt: string
  arrivals: Arrival[]
}

export type TrainPosition = {
  runNumber: string
  destination: string
  nextStationName: string
  latitude: number
  longitude: number
  heading: number
  delayed: boolean
}

export type MapCenter = {
  latitude: number
  longitude: number
}

export type NearbyStationBoard = {
  station: Station
  distanceMiles: number
  walkMinutes: number
  arrivals: Arrival[]
}

export type NearbyBoard = {
  generatedAt: string
  reference: MapCenter
  stations: NearbyStationBoard[]
}

export type RouteGeometry = {
  route: string
  paths: MapCenter[][]
}

export type BusRoute = {
  id: string
  name: string
}

export type BusStop = {
  id: string
  name: string
  direction: string
  latitude: number
  longitude: number
  routes: string[]
}

export type BusArrival = {
  stopId: string
  vehicleId: string
  route: string
  destination: string
  direction: string
  predictionTime: string
  minutes: number
  approaching: boolean
  scheduled: boolean
  delayed: boolean
}

export type BusArrivalBoard = {
  generatedAt: string
  arrivals: BusArrival[]
}

export type NearbyBusStopBoard = {
  stop: BusStop
  distanceMiles: number
  walkMinutes: number
  arrivals: BusArrival[]
}

export type NearbyBusBoard = {
  generatedAt: string
  reference: MapCenter
  stops: NearbyBusStopBoard[]
}

export type BusPosition = {
  vehicleId: string
  route: string
  destination: string
  latitude: number
  longitude: number
  heading: number
  delayed: boolean
}
