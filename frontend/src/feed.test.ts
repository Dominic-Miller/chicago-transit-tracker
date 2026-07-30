import { describe, expect, it } from 'vitest'
import { buildNearbyLines, walkLabel } from './feed'
import type { Arrival, NearbyBoard, Station } from './types'

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
