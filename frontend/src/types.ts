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
