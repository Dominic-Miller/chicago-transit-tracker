import { describe, expect, it } from 'vitest'
import { buildNearbyBusLines, buildNearbyLines, filterVehiclesForDirection, mergeNearbyLines, walkLabel } from './feed'
import type { Arrival, NearbyBoard, NearbyBusBoard, Station } from './types'

const station = (id: string, routes: string[]): Station => ({
  id, name: `Station ${id}`, descriptiveName: '', latitude: 41.88, longitude: -87.63,
  accessible: true, routes,
})
const arrival = (stationId: string, route: string, platform: string, minutes: number, flags: Partial<Arrival> = {}): Arrival => ({
  stationId, route, platform, minutes, runNumber: `${stationId}-${minutes}`, destination: platform.includes('North') ? 'Howard' : '95th',
  arrivalTime: `2026-07-30T12:${String(minutes).padStart(2, '0')}:00`, approaching: false,
  scheduled: false, delayed: false, ...flags,
})
const board = (stations: NearbyBoard['stations']): NearbyBoard => ({
  generatedAt: '', reference: { latitude: 41.88, longitude: -87.63 }, stations,
})

describe('buildNearbyLines', () => {
  it('chooses the closest station for duplicate lines and sorts by proximity', () => {
    const result = buildNearbyLines(board([
      { station: station('far', ['Red']), distanceMiles: 0.4, walkMinutes: 10, arrivals: [arrival('far', 'Red', 'Northbound', 1)] },
      { station: station('near', ['Red', 'Blue']), distanceMiles: 0.1, walkMinutes: 3, arrivals: [arrival('near', 'Red', 'Northbound', 8), arrival('near', 'Blue', 'Westbound', 2)] },
    ]))
    expect(result.map((line) => line.route)).toEqual(['Blue', 'Red'])
    expect(result.find((line) => line.route === 'Red')?.station.id).toBe('near')
  })

  it('groups directions and keeps prediction states distinct', () => {
    const live = arrival('one', 'Red', 'Northbound platform', 2)
    const scheduled = arrival('one', 'Red', 'Northbound platform', 5, { scheduled: true })
    const delayedDue = arrival('one', 'Red', 'Southbound platform', 0, { delayed: true, approaching: true })
    const [line] = buildNearbyLines(board([{ station: station('one', ['Red']), distanceMiles: 0.1, walkMinutes: 3, arrivals: [scheduled, delayedDue, live] }]))
    expect(line.directions).toHaveLength(2)
    expect(line.directions.find((direction) => direction.id === 'Northbound platform')?.arrivals).toEqual([live, scheduled])
    expect(line.directions.find((direction) => direction.id === 'Southbound platform')?.arrivals[0]).toMatchObject({ delayed: true, approaching: true })
  })

  it('uses stable line-name ordering when proximity and ETA match', () => {
    const lines = buildNearbyLines(board([{ station: station('one', ['Red', 'Blue']), distanceMiles: 0.2, walkMinutes: 5, arrivals: [] }]))
    expect(lines.map((line) => line.route)).toEqual(['Blue', 'Red'])
  })
})

it('formats approximate walking context', () => {
  expect(walkLabel(6, 0.23)).toBe('About 6 min walk · 0.2 mi')
})

describe('filterVehiclesForDirection', () => {
  const northbound = {
    id: 'Northbound', label: 'Northbound · Howard',
    arrivals: [arrival('one', 'Red', 'Northbound', 2, { destination: 'Howard' })],
  }
  const vehicles = [
    { id: 'north', destination: 'Howard' },
    { id: 'south', destination: '95th/Dan Ryan' },
  ]

  it('shows only vehicles serving the selected direction destination', () => {
    expect(filterVehiclesForDirection(vehicles, northbound).map((vehicle) => vehicle.id)).toEqual(['north'])
  })

  it('keeps all vehicles when directional predictions are unavailable', () => {
    expect(filterVehiclesForDirection(vehicles, { ...northbound, arrivals: [] })).toEqual(vehicles)
  })
})

describe('buildNearbyBusLines', () => {
  const busBoard: NearbyBusBoard = {
    generatedAt: '', reference: { latitude: 41.92, longitude: -87.67 },
    stops: [
      { stop: { id: 'far', name: 'Damen & Fullerton', direction: 'Northbound', latitude: 41.92, longitude: -87.67, routes: ['50'] }, distanceMiles: .3, walkMinutes: 8,
        arrivals: [{ stopId: 'far', vehicleId: '1', route: '50', destination: 'Edgewater', direction: 'Northbound', predictionTime: '2026-07-30T12:02', minutes: 2, approaching: false, scheduled: false, delayed: false }] },
      { stop: { id: 'near', name: 'Damen & Webster', direction: 'Northbound', latitude: 41.921, longitude: -87.67, routes: ['50', '74'] }, distanceMiles: .1, walkMinutes: 3,
        arrivals: [
          { stopId: 'near', vehicleId: '2', route: '50', destination: 'Edgewater', direction: 'Northbound', predictionTime: '2026-07-30T12:08', minutes: 8, approaching: false, scheduled: false, delayed: false },
          { stopId: 'near', vehicleId: '', route: '74', destination: 'Grand/Nordica', direction: 'Westbound', predictionTime: '2026-07-30T12:05', minutes: 5, approaching: false, scheduled: true, delayed: false },
        ] },
    ],
  }

  it('chooses the closest stop for duplicate routes and preserves prediction states', () => {
    const lines = buildNearbyBusLines(busBoard, [{ id: '50', name: 'Damen' }, { id: '74', name: 'Fullerton' }])
    expect(lines.map((line) => line.route)).toEqual(['74', '50'])
    expect(lines.find((line) => line.route === '50')?.stop.id).toBe('near')
    expect(lines.find((line) => line.route === '74')?.directions[0].arrivals[0].scheduled).toBe(true)
  })

  it('keeps the nearest stop and predictions for each direction of a route', () => {
    const oppositeBoard: NearbyBusBoard = {
      ...busBoard,
      stops: [
        ...busBoard.stops,
        { stop: { id: 'south', name: 'Damen & Webster', direction: 'Southbound', latitude: 41.921, longitude: -87.671, routes: ['50'] }, distanceMiles: .12, walkMinutes: 4,
          arrivals: [{ stopId: 'south', vehicleId: '3', route: '50', destination: '35th/Archer', direction: 'Southbound', predictionTime: '2026-07-30T12:06', minutes: 6, approaching: false, scheduled: false, delayed: false }] },
      ],
    }

    const route = buildNearbyBusLines(oppositeBoard).find((line) => line.route === '50')
    expect(route?.directions.map((direction) => direction.id)).toEqual(['Northbound', 'Southbound'])
    expect(route?.directions.find((direction) => direction.id === 'Northbound')?.busStop?.id).toBe('near')
    expect(route?.directions.find((direction) => direction.id === 'Southbound')?.busStop?.id).toBe('south')
    expect(route?.directions.find((direction) => direction.id === 'Southbound')?.arrivals[0].destination).toBe('35th/Archer')
  })

  it('sorts rail and bus cards together by proximity', () => {
    const rail = buildNearbyLines(board([{ station: station('rail', ['Red']), distanceMiles: .2, walkMinutes: 5, arrivals: [] }]))
    expect(mergeNearbyLines(rail, buildNearbyBusLines(busBoard)).map((line) => line.mode)).toEqual(['bus', 'bus', 'rail'])
  })
})
