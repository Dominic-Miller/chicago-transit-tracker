import { useEffect, useMemo, useState } from 'react'
import { getArrivals, getStations, getTrainPositions } from './api'
import { nearbyStations } from './geo'
import TransitMap from './TransitMap'
import type { ArrivalBoard, MapCenter, Station, TrainPosition } from './types'

const INITIAL_CENTER: MapCenter = { latitude: 41.9214, longitude: -87.6776 }
const ROUTES = ['Red', 'Blue', 'Green', 'Brown', 'Purple', 'Pink', 'Orange', 'Yellow']

const routeClass: Record<string, string> = {
  Red: 'red', Blue: 'blue', G: 'green', Green: 'green', Brn: 'brown', Brown: 'brown',
  P: 'purple', Purple: 'purple', Pink: 'pink', Org: 'orange', Orange: 'orange',
  Y: 'yellow', Yellow: 'yellow',
}

export default function App() {
  const [stations, setStations] = useState<Station[]>([])
  const [center, setCenter] = useState(INITIAL_CENTER)
  const [selected, setSelected] = useState<Station | null>(null)
  const [arrivals, setArrivals] = useState<ArrivalBoard | null>(null)
  const [loadingStations, setLoadingStations] = useState(true)
  const [loadingArrivals, setLoadingArrivals] = useState(false)
  const [arrivalError, setArrivalError] = useState<string | null>(null)
  const [stationError, setStationError] = useState<string | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)
  const [trains, setTrains] = useState<TrainPosition[]>([])
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [arrivalRetry, setArrivalRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [locateRequest, setLocateRequest] = useState(0)

  useEffect(() => {
    getStations()
      .then(setStations)
      .catch((reason: Error) => setStationError(reason.message))
      .finally(() => setLoadingStations(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    let active = true

    const load = () => {
      setLoadingArrivals(true)
      setArrivalError(null)
      getArrivals(selected.id)
        .then((board) => { if (active) setArrivals(board) })
        .catch((reason: Error) => { if (active) setArrivalError(reason.message) })
        .finally(() => { if (active) setLoadingArrivals(false) })
    }

    load()
    const timer = window.setInterval(load, 30_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [selected?.id, arrivalRetry])

  useEffect(() => {
    if (!selectedRoute) {
      setTrains([])
      setRouteError(null)
      return
    }
    let active = true
    const load = () => {
      setLoadingPositions(true)
      setRouteError(null)
      getTrainPositions(selectedRoute)
        .then((positions) => { if (active) setTrains(positions) })
        .catch((reason: Error) => { if (active) setRouteError(reason.message) })
        .finally(() => { if (active) setLoadingPositions(false) })
    }
    setTrains([])
    load()
    const timer = window.setInterval(load, 15_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [selectedRoute])

  const nearest = useMemo(() => nearbyStations(stations, center), [stations, center])
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return stations
      .filter((station) => `${station.name} ${station.descriptiveName}`.toLowerCase().includes(query))
      .slice(0, 6)
  }, [search, stations])

  const selectStation = (station: Station) => {
    setSelected(station)
    setArrivals(null)
    setSearch('')
    setArrivalError(null)
  }

  const selectRoute = (route: string) => setSelectedRoute((current) => current === route ? null : route)

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Open Transit Chicago home">
          <span className="brand-mark">OT</span>
          <span>Open Transit <strong>Chicago</strong></span>
        </a>
        <span className="prototype-pill">Rail prototype</span>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="intro">
            <p className="eyebrow">Chicago, unlocked.</p>
            <h1>Go anywhere.<br />See what's coming.</h1>
            <p>Move the map to browse every nearby 'L' station—no teleportation subscription required.</p>
          </div>

          <div className="search-wrap">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search stations"
              aria-label="Search stations"
            />
            <button className="locate-button" onClick={() => setLocateRequest((value) => value + 1)}
                    aria-label="Use my location" title="Use my location">◎</button>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((station) => (
                  <button key={station.id} onClick={() => selectStation(station)}>
                    <span>{station.name}</span>
                    <RouteChips routes={station.routes} compact />
                  </button>
                ))}
              </div>
            )}
          </div>

          {stationError && <div className="notice error-notice" role="alert">{stationError}</div>}

          <section className="nearby-section" aria-labelledby="nearby-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Map center</p>
                <h2 id="nearby-title">Nearby stations</h2>
              </div>
              <span>{stations.length} systemwide</span>
            </div>

            {loadingStations ? (
              <div className="loading-list">Loading Chicago's rail map…</div>
            ) : (
              <div className="station-list">
                {nearest.map(({ station, distance }) => (
                  <button
                    key={station.id}
                    className={`station-row ${selected?.id === station.id ? 'selected' : ''}`}
                    onClick={() => selectStation(station)}
                  >
                    <div>
                      <strong>{station.name}</strong>
                      <span>{distance < 0.1 ? 'At map center' : `${distance.toFixed(1)} mi away`}</span>
                    </div>
                    <RouteChips routes={station.routes} compact />
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className="map-stage">
          <TransitMap
            stations={stations}
            selectedStation={selected}
            onCenterChange={setCenter}
            onStationSelect={selectStation}
            locateRequest={locateRequest}
            trains={trains}
            selectedRoute={selectedRoute}
          />
          <div className="map-instruction">Drag anywhere to browse that neighborhood</div>

          <nav className="route-picker" aria-label="Show live trains by route">
            {ROUTES.map((route) => (
              <button
                key={route}
                className={`${routeClass[route] ?? ''} ${selectedRoute === route ? 'active' : ''}`}
                onClick={() => selectRoute(route)}
                aria-pressed={selectedRoute === route}
                title={`Show live ${route} Line trains`}
              >{route}</button>
            ))}
          </nav>

          {(selectedRoute || routeError) && (
            <div className="route-status" role="status">
              {routeError ? routeError : loadingPositions && trains.length === 0
                ? `Loading ${selectedRoute} Line trains…`
                : `${trains.length} ${selectedRoute} Line trains · updates every 15 seconds`}
            </div>
          )}

          <section className={`arrival-panel ${selected ? 'open' : ''}`} aria-live="polite">
            {selected ? (
              <>
                <div className="arrival-header">
                  <div>
                    <p className="eyebrow">Live from CTA</p>
                    <h2>{selected.name}</h2>
                    <RouteChips routes={selected.routes} onRouteSelect={selectRoute} selectedRoute={selectedRoute} />
                  </div>
                  <button className="close-button" onClick={() => setSelected(null)} aria-label="Close arrivals">×</button>
                </div>

                <div className="arrival-list">
                  {loadingArrivals && !arrivals && <div className="loading-list">Checking the tracks…</div>}
                  {arrivalError && (
                    <div className="arrival-error" role="alert">
                      <strong>Arrival times unavailable</strong>
                      <span>{arrivalError}</span>
                      <button onClick={() => setArrivalRetry((value) => value + 1)}>Try again</button>
                    </div>
                  )}
                  {arrivals?.arrivals.length === 0 && <div className="empty-state">No predictions available right now.</div>}
                  {arrivals?.arrivals.map((arrival) => (
                    <article className="arrival-row" key={`${arrival.runNumber}-${arrival.arrivalTime}`}>
                      <span className={`route-dot ${routeClass[arrival.route] ?? ''}`}>{routeAbbreviation(arrival.route)}</span>
                      <div className="arrival-destination">
                        <strong>to {arrival.destination}</strong>
                        <span>{arrival.delayed ? 'Delayed' : arrival.scheduled ? 'Scheduled time' : `Live · ${arrival.platform}`}</span>
                      </div>
                      <div className={`arrival-time ${arrival.approaching ? 'due' : ''}`} title={formatArrivalTime(arrival.arrivalTime)}>
                        <div>{arrival.approaching ? 'Due' : <><strong>{arrival.minutes}</strong><span>min</span></>}</div>
                        <time dateTime={arrival.arrivalTime}>{formatArrivalTime(arrival.arrivalTime)}</time>
                      </div>
                    </article>
                  ))}
                </div>
                {arrivals && <p className="freshness">Updated {formatTime(arrivals.generatedAt)} · refreshes every 30 seconds</p>}
              </>
            ) : (
              <div className="empty-panel">
                <span className="pulse-dot" />
                Select a station to see live arrivals
              </div>
            )}
          </section>
        </section>
      </section>

      <footer>
        <span>Data provided by Chicago Transit Authority and the City of Chicago.</span>
        <span>Unofficial · No accounts · No subscriptions</span>
      </footer>
    </main>
  )
}

function RouteChips({ routes, compact = false, onRouteSelect, selectedRoute }: {
  routes: string[]
  compact?: boolean
  onRouteSelect?: (route: string) => void
  selectedRoute?: string | null
}) {
  return (
    <span className={`route-chips ${compact ? 'compact' : ''}`} aria-label={`Routes: ${routes.join(', ')}`}>
      {routes.map((route) => onRouteSelect && !compact ? (
        <button key={route} className={`${routeClass[route] ?? ''} ${selectedRoute === route ? 'active' : ''}`}
                onClick={() => onRouteSelect(route)} aria-pressed={selectedRoute === route}>
          {route}
        </button>
      ) : <span key={route} className={routeClass[route] ?? ''}>{compact ? '' : route}</span>)}
    </span>
  )
}

function formatArrivalTime(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Time unavailable' : parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function routeAbbreviation(route: string) {
  return ({ Red: 'R', Blue: 'B', G: 'G', Brn: 'Br', P: 'P', Pink: 'Pk', Org: 'O', Y: 'Y' } as Record<string, string>)[route] ?? route
}

function formatTime(value: string) {
  if (!value) return 'just now'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
