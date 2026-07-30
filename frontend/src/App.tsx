import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Accessibility from 'lucide-react/dist/esm/icons/accessibility'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import BusFront from 'lucide-react/dist/esm/icons/bus-front'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up'
import Clock3 from 'lucide-react/dist/esm/icons/clock-3'
import Footprints from 'lucide-react/dist/esm/icons/footprints'
import LocateFixed from 'lucide-react/dist/esm/icons/locate-fixed'
import MapPin from 'lucide-react/dist/esm/icons/map-pin'
import Navigation from 'lucide-react/dist/esm/icons/navigation'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Search from 'lucide-react/dist/esm/icons/search'
import TrainFront from 'lucide-react/dist/esm/icons/train-front'
import Wifi from 'lucide-react/dist/esm/icons/wifi'
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off'
import X from 'lucide-react/dist/esm/icons/x'
import { getArrivals, getBusArrivals, getBusPositions, getBusRouteGeometry, getBusRouteStops, getBusRoutes, getRouteGeometry, getStations, getTrainPositions, searchBusStops } from './api'
import { buildNearbyBusLines, buildNearbyLines, busArrivalToArrival, filterVehiclesForDirection, mergeNearbyLines, normalizeRoute, walkLabel, type DirectionGroup, type NearbyBusLine, type NearbyLine, type TransitNearbyLine } from './feed'
import { useLocation } from './hooks/useLocation'
import { useNearbyBoard } from './hooks/useNearbyBoard'
import { useNearbyBusBoard } from './hooks/useNearbyBusBoard'
import TransitMap from './TransitMap'
import type { Arrival, ArrivalBoard, BusArrivalBoard, BusPosition, BusRoute, BusStop, MapCenter, RouteGeometry, Station, TrainPosition } from './types'

const INITIAL_CENTER: MapCenter = { latitude: 41.9214, longitude: -87.6776 }
const ROUTES = ['Red', 'Blue', 'Green', 'Brown', 'Purple', 'Pink', 'Orange', 'Yellow'] as const
type SheetState = 'collapsed' | 'partial' | 'expanded'
type ReferenceMode = 'location' | 'map'
type RouteFocus = { mode: 'rail' | 'bus'; route: string; station: Station | null; busStop: BusStop | null; directions: DirectionGroup[]; directionId: string | null; walkMinutes?: number; distanceMiles?: number }

export const routeClass: Record<string, string> = {
  Red: 'red', Blue: 'blue', G: 'green', Green: 'green', Brn: 'brown', Brown: 'brown',
  P: 'purple', Purple: 'purple', Pink: 'pink', Org: 'orange', Orange: 'orange',
  Y: 'yellow', Yellow: 'yellow',
}

export default function App() {
  const [stations, setStations] = useState<Station[]>([])
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>([])
  const [center, setCenter] = useState(INITIAL_CENTER)
  const [selected, setSelected] = useState<Station | null>(null)
  const [selectedBusStop, setSelectedBusStop] = useState<BusStop | null>(null)
  const [arrivals, setArrivals] = useState<ArrivalBoard | null>(null)
  const [busArrivals, setBusArrivals] = useState<BusArrivalBoard | null>(null)
  const [loadingStations, setLoadingStations] = useState(true)
  const [loadingArrivals, setLoadingArrivals] = useState(false)
  const [arrivalError, setArrivalError] = useState<string | null>(null)
  const [busArrivalError, setBusArrivalError] = useState<string | null>(null)
  const [loadingBusArrivals, setLoadingBusArrivals] = useState(false)
  const [stationError, setStationError] = useState<string | null>(null)
  const [routeFocus, setRouteFocus] = useState<RouteFocus | null>(null)
  const [trains, setTrains] = useState<TrainPosition[]>([])
  const [buses, setBuses] = useState<BusPosition[]>([])
  const [busRouteStops, setBusRouteStops] = useState<BusStop[]>([])
  const [geometry, setGeometry] = useState<RouteGeometry | null>(null)
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [arrivalRetry, setArrivalRetry] = useState(0)
  const [stationRetry, setStationRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [busStopSearchResults, setBusStopSearchResults] = useState<BusStop[]>([])
  const [sheetState, setSheetState] = useState<SheetState>('partial')
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>('map')
  const [focusPoint, setFocusPoint] = useState<{ point: MapCenter; token: number } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const isOnline = useOnlineStatus()
  const reference = referenceMode === 'location' && location.coordinates ? location.coordinates : center
  const nearby = useNearbyBoard(reference)
  const nearbyBuses = useNearbyBusBoard(reference)
  const railLines = useMemo(() => buildNearbyLines(nearby.board), [nearby.board])
  const busLines = useMemo(() => buildNearbyBusLines(nearbyBuses.board, busRoutes), [nearbyBuses.board, busRoutes])
  const lines = useMemo(() => mergeNearbyLines(railLines, busLines), [railLines, busLines])
  const selectedRoute = routeFocus?.route ?? null
  const selectedMode = routeFocus?.mode ?? null
  const selectedDirection = routeFocus?.directions.find((direction) => direction.id === routeFocus.directionId) ?? routeFocus?.directions[0]
  const visibleTrains = useMemo(() => filterVehiclesForDirection(trains, selectedDirection), [trains, selectedDirection])
  const visibleBuses = useMemo(() => filterVehiclesForDirection(buses, selectedDirection), [buses, selectedDirection])

  useEffect(() => {
    let active = true
    setLoadingStations(true)
    setStationError(null)
    getStations().then((result) => { if (active) setStations(result) })
      .catch((reason: Error) => { if (active) setStationError(reason.message) })
      .finally(() => { if (active) setLoadingStations(false) })
    return () => { active = false }
  }, [stationRetry])

  useEffect(() => {
    let active = true
    getBusRoutes().then((routes) => { if (active) setBusRoutes(routes) }).catch(() => { if (active) setBusRoutes([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selected) return
    let active = true
    const load = () => {
      setLoadingArrivals(true)
      setArrivalError(null)
      getArrivals(selected.id).then((board) => { if (active) setArrivals(board) })
        .catch((reason: Error) => { if (active) setArrivalError(reason.message) })
        .finally(() => { if (active) setLoadingArrivals(false) })
    }
    load()
    const timer = window.setInterval(load, 30_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [selected?.id, arrivalRetry])

  useEffect(() => {
    if (!selectedBusStop) return
    let active = true
    const load = () => {
      setLoadingBusArrivals(true); setBusArrivalError(null)
      getBusArrivals(selectedBusStop.id).then((board) => { if (active) setBusArrivals(board) })
        .catch((reason: Error) => { if (active) setBusArrivalError(reason.message) })
        .finally(() => { if (active) setLoadingBusArrivals(false) })
    }
    load()
    const timer = window.setInterval(load, 60_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [selectedBusStop?.id, arrivalRetry])

  useEffect(() => {
    if (!selectedRoute || !selectedMode) {
      setTrains([]); setBuses([]); setBusRouteStops([]); setGeometry(null); setRouteError(null)
      return
    }
    let active = true
    const controller = new AbortController()
    const geometryRequest = selectedMode === 'bus'
      ? getBusRouteGeometry(selectedRoute, controller.signal)
      : getRouteGeometry(selectedRoute, controller.signal)
    geometryRequest
      .then((result) => { if (active) setGeometry(result) })
      .catch(() => { if (active) setGeometry(null) })
    if (selectedMode === 'bus') {
      getBusRouteStops(selectedRoute, controller.signal)
        .then((stops) => { if (active) setBusRouteStops(stops) })
        .catch(() => { if (active) setBusRouteStops([]) })
    }
    const loadVehicles = () => {
      setLoadingPositions(true); setRouteError(null)
      const request = selectedMode === 'bus' ? getBusPositions(selectedRoute) : getTrainPositions(selectedRoute)
      request.then((positions) => {
        if (!active) return
        if (selectedMode === 'bus') { setBuses(positions as BusPosition[]); setTrains([]) }
        else { setTrains(positions as TrainPosition[]); setBuses([]) }
      })
        .catch((reason: Error) => { if (active) setRouteError(reason.message) })
        .finally(() => { if (active) setLoadingPositions(false) })
    }
    setTrains([]); setBuses([]); setBusRouteStops([]); setGeometry(null); loadVehicles()
    const timer = window.setInterval(loadVehicles, selectedMode === 'bus' ? 60_000 : 15_000)
    return () => { active = false; controller.abort(); window.clearInterval(timer) }
  }, [selectedRoute, selectedMode])

  useEffect(() => {
    if (!location.coordinates) return
    setReferenceMode('location')
    setFocusPoint((current) => ({ point: location.coordinates!, token: (current?.token ?? 0) + 1 }))
  }, [location.coordinates])

  const normalizedSearch = search.trim().toLowerCase()
  const searchResults = useMemo(() => normalizedSearch ? stations.filter((station) =>
    `${station.name} ${station.descriptiveName} ${station.routes.join(' ')}`.toLowerCase().includes(normalizedSearch)).slice(0, 7) : [], [normalizedSearch, stations])
  const busSearchResults = useMemo(() => normalizedSearch ? busRoutes.filter((route) =>
    `${route.id} ${route.name}`.toLowerCase().includes(normalizedSearch)).slice(0, 7) : [], [normalizedSearch, busRoutes])

  useEffect(() => {
    if (normalizedSearch.length < 2) { setBusStopSearchResults([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchBusStops(normalizedSearch, controller.signal).then(setBusStopSearchResults).catch(() => setBusStopSearchResults([]))
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [normalizedSearch])

  const selectStation = useCallback((station: Station) => {
    setRouteFocus(null); setSelectedBusStop(null); setBusArrivals(null); setSelected(station); setArrivals(null); setSearch(''); setArrivalError(null); setSheetState('partial')
  }, [])

  const selectBusStop = useCallback((stop: BusStop) => {
    setRouteFocus(null); setSelected(null); setArrivals(null); setSelectedBusStop(stop); setBusArrivals(null); setSearch(''); setBusArrivalError(null); setSheetState('partial')
  }, [])

  const openLine = (line: NearbyLine, directionId?: string) => {
    setSelected(null); setSelectedBusStop(null); setArrivals(null); setBusArrivals(null)
    setRouteFocus({
      mode: 'rail', route: line.route, station: line.station, busStop: null, directions: line.directions,
      directionId: directionId ?? line.directions[0]?.id ?? null,
      walkMinutes: line.walkMinutes, distanceMiles: line.distanceMiles,
    })
    setSheetState('partial')
  }

  const openBusLine = (line: NearbyBusLine, directionId?: string) => {
    setSelected(null); setSelectedBusStop(null); setArrivals(null); setBusArrivals(null)
    const direction = line.directions.find((item) => item.id === directionId) ?? line.directions[0]
    setRouteFocus({
      mode: 'bus', route: line.route, station: null, busStop: direction?.busStop ?? line.stop, directions: line.directions,
      directionId: direction?.id ?? null,
      walkMinutes: direction?.walkMinutes ?? line.walkMinutes,
      distanceMiles: direction?.distanceMiles ?? line.distanceMiles,
    })
    setSheetState('partial')
  }

  const selectFocusedDirection = (directionId: string) => setRouteFocus((current) => {
    if (!current) return current
    const direction = current.directions.find((item) => item.id === directionId)
    return {
      ...current,
      directionId,
      ...(current.mode === 'bus' && direction?.busStop ? {
        busStop: direction.busStop,
        walkMinutes: direction.walkMinutes,
        distanceMiles: direction.distanceMiles,
      } : {}),
    }
  })

  const openNearbyLine = (line: TransitNearbyLine, directionId?: string) => {
    if (line.mode === 'bus') openBusLine(line, directionId)
    else openLine(line, directionId)
  }

  const openRoute = (route: string, station?: Station, stationArrivals: Arrival[] = []) => {
    const normalized = normalizeRoute(route)
    const matchingLine = railLines.find((line) => line.route === normalized)
    if (!station && matchingLine) return openLine(matchingLine)
    const routeArrivals = stationArrivals.filter((arrival) => normalizeRoute(arrival.route) === normalized)
    const grouped = groupDirections(routeArrivals)
    setSelected(null); setSelectedBusStop(null); setArrivals(null); setBusArrivals(null)
    setRouteFocus({ mode: 'rail', route: normalized, station: station ?? null, busStop: null, directions: grouped, directionId: grouped[0]?.id ?? null })
    setSheetState('partial')
  }

  const openBusRoute = (route: BusRoute) => {
    const nearbyLine = busLines.find((line) => line.route === route.id)
    if (nearbyLine) return openBusLine(nearbyLine)
    setSelected(null); setSelectedBusStop(null); setArrivals(null); setBusArrivals(null); setSearch('')
    setRouteFocus({ mode: 'bus', route: route.id, station: null, busStop: null, directions: [], directionId: null })
    setSheetState('partial')
  }

  const openBusRouteAtStop = (route: string, stop: BusStop, board: BusArrivalBoard | null) => {
    const grouped = groupDirections((board?.arrivals ?? []).filter((arrival) => arrival.route === route).map(busArrivalToArrival))
    setSelected(null); setSelectedBusStop(null); setArrivals(null); setBusArrivals(null)
    setRouteFocus({ mode: 'bus', route, station: null, busStop: stop, directions: grouped, directionId: grouped[0]?.id ?? null })
    setSheetState('partial')
  }

  const onMapCenterChange = (nextCenter: MapCenter, userInitiated: boolean) => {
    if (userInitiated) setCenter(nextCenter)
    if (userInitiated && location.coordinates) setReferenceMode('map')
  }
  const returnToLocation = () => {
    if (!location.coordinates) return
    setReferenceMode('location')
    setFocusPoint((current) => ({ point: location.coordinates!, token: (current?.token ?? 0) + 1 }))
  }
  const cycleSheet = (direction: 1 | -1) => {
    const states: SheetState[] = ['collapsed', 'partial', 'expanded']
    setSheetState((current) => states[Math.max(0, Math.min(2, states.indexOf(current) + direction))])
  }
  const closeDetail = () => {
    if (routeFocus) setFocusPoint((current) => ({ point: reference, token: (current?.token ?? 0) + 1 }))
    setSelected(null); setArrivals(null); setRouteFocus(null); setArrivalError(null)
    setSelectedBusStop(null); setBusArrivals(null); setBusArrivalError(null)
  }

  const title = routeFocus ? routeFocus.mode === 'bus' ? `${routeFocus.route} ${busRoutes.find((route) => route.id === routeFocus.route)?.name ?? 'Bus'}` : `${routeFocus.route} Line` : selected?.name ?? selectedBusStop?.name ?? (referenceMode === 'location' ? 'Near you' : 'Near map center')
  const kicker = routeFocus ? 'Route' : selected ? 'Station' : selectedBusStop ? 'Bus stop' : referenceMode === 'location' ? 'Live departures' : 'Explore Chicago'

  return (
    <main className={`app-shell sheet-${sheetState}`}>
      <TransitMap
        stations={stations}
        selectedStation={selected ?? routeFocus?.station ?? null}
        onCenterChange={onMapCenterChange}
        onStationSelect={selectStation}
        trains={isOnline ? visibleTrains : []}
        buses={isOnline ? visibleBuses : []}
        busStops={busRouteStops}
        selectedBusStop={selectedBusStop ?? routeFocus?.busStop ?? null}
        selectedRoute={selectedRoute}
        selectedMode={selectedMode}
        geometry={geometry}
        userLocation={location.coordinates}
        nearbyReference={!selected && !selectedBusStop && !routeFocus ? reference : null}
        nearbyReferenceVisible={referenceMode === 'map'}
        focusPoint={focusPoint}
      />

      <header className="top-chrome">
        <a className="brand" href="#" aria-label="Open Transit Chicago home" onClick={(event) => { event.preventDefault(); closeDetail() }}>
          <span className="brand-mark" aria-hidden="true"><TrainFront size={19} strokeWidth={2.4} /></span>
          <span>Open Transit <strong>Chicago</strong></span>
        </a>
        <div className="search-area">
          <div className="search-field">
            <Search size={20} aria-hidden="true" />
            <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape') setSearch('') }} placeholder="Search stations or lines"
              aria-label="Search stations or lines" aria-expanded={Boolean(normalizedSearch)} aria-controls="station-search-results" />
            {search && <button className="icon-button search-clear" onClick={() => { setSearch(''); searchRef.current?.focus() }} aria-label="Clear search"><X size={19} /></button>}
          </div>
          <button className="icon-button locate-button" onClick={location.request} aria-label="Use my location" title="Use my location" disabled={location.permission === 'requesting'}>
            {location.permission === 'requesting' ? <RefreshCw className="spin" size={21} /> : <LocateFixed size={21} />}
          </button>
          {normalizedSearch && <SearchResults results={searchResults} busRoutes={busSearchResults} busStops={busStopSearchResults} selectedId={selected?.id} selectedBusStopId={selectedBusStop?.id} onSelect={selectStation} onBusRoute={openBusRoute} onBusStop={selectBusStop} />}
        </div>
      </header>

      {selectedRoute && isOnline && <div className={`route-status ${routeError ? 'is-error' : ''}`} role="status">
        {routeError ? <AlertCircle size={16} /> : loadingPositions ? <RefreshCw className="spin" size={16} /> : selectedMode === 'bus' ? <BusFront size={16} /> : <Navigation size={16} />}
        <span>{routeError ? `Live ${selectedMode === 'bus' ? 'buses' : 'trains'} unavailable`
          : loadingPositions && (selectedMode === 'bus' ? visibleBuses.length : visibleTrains.length) === 0 ? `Finding ${selectedRoute} ${selectedMode === 'bus' ? 'buses' : 'trains'}…`
            : `${selectedMode === 'bus' ? `${visibleBuses.length} Route ${selectedRoute} bus${visibleBuses.length === 1 ? '' : 'es'}` : `${visibleTrains.length} ${selectedRoute} train${visibleTrains.length === 1 ? '' : 's'}`} live`}</span>
      </div>}

      {!isOnline && <div className="offline-status" role="status"><WifiOff size={17} /><span>Offline · Live departures paused</span></div>}

      <BottomSheet state={sheetState} setState={setSheetState} onCycle={cycleSheet}>
        <div className="sheet-heading">
          <div className="sheet-title">
            {routeFocus && <button className="icon-button detail-back" onClick={closeDetail} aria-label="Back to nearby departures"><ArrowLeft size={20} /></button>}
            <span className={`sheet-title-icon ${routeFocus ? routeFocus.mode === 'bus' ? 'bus' : routeClass[routeFocus.route] : selectedBusStop ? 'bus' : ''}`}>{routeFocus ? routeFocus.mode === 'bus' ? <BusFront size={19} /> : <TrainFront size={19} /> : selectedBusStop ? <BusFront size={19} /> : selected ? <MapPin size={19} /> : <LocateFixed size={19} />}</span>
            <div><span className="sheet-kicker">{kicker}</span><h1>{title}</h1></div>
          </div>
          <div className="sheet-actions">
            {(selected || selectedBusStop || routeFocus) && !routeFocus && <button className="icon-button" onClick={closeDetail} aria-label="Close details"><X size={20} /></button>}
            <button className="icon-button sheet-down" onClick={() => cycleSheet(-1)} disabled={sheetState === 'collapsed'} aria-label="Collapse sheet"><ChevronDown size={21} /></button>
            <button className="icon-button sheet-up" onClick={() => cycleSheet(1)} disabled={sheetState === 'expanded'} aria-label="Expand sheet"><ChevronUp size={21} /></button>
          </div>
        </div>

        {!selected && !selectedBusStop && !routeFocus && <div className="sheet-summary">
          <MapPin size={16} /><span>{!isOnline ? 'Live data unavailable' : (nearby.loading || nearbyBuses.loading) && !nearby.board && !nearbyBuses.board ? 'Finding nearby departures' : `${lines.length} routes nearby`}</span>
          {referenceMode === 'map' && location.coordinates && <button className="return-location" onClick={returnToLocation}><LocateFixed size={16} />Return to my location</button>}
        </div>}

        <div className="sheet-body">
          {!isOnline ? <StateCard icon={<WifiOff />} title="You’re offline" detail="Reconnect to load current CTA predictions and vehicle positions. Stored departure times are never shown as live." /> : <>
            {routeFocus ? <RouteDetail focus={routeFocus} onDirection={selectFocusedDirection} loadingVehicles={loadingPositions} routeError={routeError} />
              : selected ? <StationBoard station={selected} arrivals={arrivals} loading={loadingArrivals} error={arrivalError} onRouteSelect={(route) => openRoute(route, selected, arrivals?.arrivals)} onRetry={() => setArrivalRetry((value) => value + 1)} />
                : selectedBusStop ? <BusStopBoard stop={selectedBusStop} arrivals={busArrivals} loading={loadingBusArrivals} error={busArrivalError} onRouteSelect={(route) => openBusRouteAtStop(route, selectedBusStop, busArrivals)} onRetry={() => setArrivalRetry((value) => value + 1)} />
                : <NearbyFeed lines={lines} boardReady={Boolean(nearby.board || nearbyBuses.board)} loading={nearby.loading || nearbyBuses.loading} refreshing={nearby.refreshing || nearbyBuses.refreshing}
                  error={!nearby.board && !nearbyBuses.board ? nearby.error || nearbyBuses.error || stationError : null}
                  partialError={nearby.error && nearbyBuses.error ? 'Train and bus updates are temporarily unavailable.' : nearby.error ? 'Train updates are temporarily unavailable.' : nearbyBuses.error ? 'Bus updates are temporarily unavailable.' : null}
                  isOnline={isOnline} locationPermission={location.permission} locationMessage={location.message} onLocation={location.request} onRetry={() => { nearby.retry(); nearbyBuses.retry() }} onOpen={openNearbyLine} limit={sheetState === 'expanded' ? undefined : 6} />}

            {!selected && !selectedBusStop && !routeFocus && sheetState === 'expanded' && <div className="all-lines-section">
              <div className="section-label"><span>All rail lines</span><small>Explore live trains</small></div>
              <RoutePicker onSelect={(route) => openRoute(route)} />
              <div className="section-label bus-section-label"><span>All bus routes</span><small>Search {busRoutes.length || 'CTA'} routes</small></div>
              <BusRoutePicker routes={busRoutes} onSelect={openBusRoute} />
            </div>}
          </>}
        </div>
      </BottomSheet>
      <p className="data-credit">CTA + City of Chicago data · Unofficial · <a href="/privacy.html">Privacy</a> · Free and open source</p>
    </main>
  )
}

function BottomSheet({ state, setState, onCycle, children }: { state: SheetState; setState: (state: SheetState) => void; onCycle: (direction: 1 | -1) => void; children: React.ReactNode }) {
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const startY = event.clientY
    const handlePointerUp = (nextEvent: PointerEvent) => {
      const delta = nextEvent.clientY - startY
      if (Math.abs(delta) > 44) onCycle(delta < 0 ? 1 : -1)
      window.removeEventListener('pointerup', handlePointerUp); window.removeEventListener('pointercancel', handlePointerUp)
    }
    window.addEventListener('pointerup', handlePointerUp); window.addEventListener('pointercancel', handlePointerUp)
  }
  return <section className="bottom-sheet" aria-label="Transit information">
    <div className="sheet-drag-zone" onPointerDown={handlePointerDown} onDoubleClick={() => setState(state === 'expanded' ? 'partial' : 'expanded')} aria-hidden="true"><span className="sheet-grabber" /></div>
    {children}
  </section>
}

function NearbyFeed({ lines, boardReady, loading, refreshing, error, partialError, isOnline, locationPermission, locationMessage, onLocation, onRetry, onOpen, limit }: {
  lines: TransitNearbyLine[]; boardReady: boolean; loading: boolean; refreshing: boolean; error: string | null; partialError: string | null
  isOnline: boolean; locationPermission: string; locationMessage: string | null; onLocation: () => void; onRetry: () => void; onOpen: (line: TransitNearbyLine, directionId?: string) => void; limit?: number
}) {
  const wakingService = useDelayedFlag(loading && !boardReady && isOnline, 4_000)
  return <div className="nearby-feed">
    {locationPermission === 'idle' && <div className="location-card">
      <span className="location-card-icon"><LocateFixed size={22} /></span>
      <div><strong>See transit near you</strong><span>Use your location to find the easiest departures to catch.</span></div>
      <button onClick={onLocation}>Use location</button>
    </div>}
    {['denied', 'unavailable', 'error'].includes(locationPermission) && locationMessage && <div className="inline-notice" role="status"><AlertCircle size={18} /><span>{locationMessage}</span><button onClick={onLocation}>Try again</button></div>}
    {loading && !boardReady && <FeedSkeleton />}
    {wakingService && <div className="wake-notice" role="status"><RefreshCw className="spin" size={16} /><span><strong>Waking the live service…</strong> The free server can take about a minute after a quiet period.</span></div>}
    {error && !boardReady && <StateCard icon={<WifiOff />} title={isOnline ? 'Nearby departures unavailable' : 'You’re offline'} detail={isOnline ? error : 'Reconnect to load current CTA predictions and vehicle positions.'} action="Try again" onAction={onRetry} />}
    {partialError && boardReady && <div className="stale-notice" role="status"><WifiOff size={15} />{partialError}<button onClick={onRetry}>Retry</button></div>}
    {!loading && boardReady && !lines.length && <StateCard icon={<Clock3 />} title="No nearby predictions" detail="CTA is not reporting upcoming service near this point right now." action="Refresh" onAction={onRetry} />}
    {lines.length > 0 && <div className="line-feed" aria-label="Nearby transit departures">
      {lines.slice(0, limit).map((line) => line.mode === 'bus'
        ? <NearbyBusCard key={`bus-${line.route}`} line={line} onOpen={onOpen} />
        : <NearbyLineCard key={`rail-${line.route}`} line={line} onOpen={onOpen} />)}
    </div>}
    {refreshing && boardReady && <p className="refreshing-label"><RefreshCw className="spin" size={14} />Refreshing departures</p>}
  </div>
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return isOnline
}

function useDelayedFlag(active: boolean, delay: number) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!active) { setVisible(false); return }
    const timer = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timer)
  }, [active, delay])
  return visible
}

function NearbyBusCard({ line, onOpen }: { line: NearbyBusLine; onOpen: (line: TransitNearbyLine, directionId?: string) => void }) {
  const [directionId, setDirectionId] = useState(line.directions[0]?.id ?? '')
  useEffect(() => { if (!line.directions.some((direction) => direction.id === directionId)) setDirectionId(line.directions[0]?.id ?? '') }, [line, directionId])
  const direction = line.directions.find((item) => item.id === directionId) ?? line.directions[0]
  const stop = direction?.busStop ?? line.stop
  const walkMinutes = direction?.walkMinutes ?? line.walkMinutes
  const distanceMiles = direction?.distanceMiles ?? line.distanceMiles
  return <article className="nearby-line-card bus-line-card">
    <button className="line-card-main" onClick={() => onOpen(line, direction?.id)} aria-label={`Route ${line.route} ${line.routeName} at ${stop.name}. ${walkLabel(walkMinutes, distanceMiles)}`}>
      <span className="line-identity bus-identity"><span className="line-icon"><BusFront size={21} /></span><strong>{line.route}</strong><small>Bus</small></span>
      <span className="line-station"><strong>{line.routeName}</strong><small className="bus-stop-name">{stop.name}</small><small><Footprints size={14} />{walkLabel(walkMinutes, distanceMiles)}</small></span>
      <span className="mini-etas">{direction?.arrivals.slice(0, 2).map((arrival) => <MiniEta key={`${arrival.runNumber}-${arrival.arrivalTime}`} arrival={arrival} />)}{!direction?.arrivals.length && <span className="no-eta">No ETAs</span>}</span>
      <ChevronRight size={19} aria-hidden="true" />
    </button>
    {line.directions.length > 1 && <div className="direction-switcher" aria-label={`Route ${line.route} direction`}>
      {line.directions.map((item) => <button key={item.id} className={item.id === direction?.id ? 'active' : ''} aria-pressed={item.id === direction?.id} onClick={() => setDirectionId(item.id)}>{item.label}</button>)}
    </div>}
  </article>
}

function NearbyLineCard({ line, onOpen }: { line: NearbyLine; onOpen: (line: NearbyLine, directionId?: string) => void }) {
  const [directionId, setDirectionId] = useState(line.directions[0]?.id ?? '')
  useEffect(() => { if (!line.directions.some((direction) => direction.id === directionId)) setDirectionId(line.directions[0]?.id ?? '') }, [line, directionId])
  const direction = line.directions.find((item) => item.id === directionId) ?? line.directions[0]
  return <article className={`nearby-line-card ${routeClass[line.route]}`}>
    <button className="line-card-main" onClick={() => onOpen(line, direction?.id)} aria-label={`${line.route} Line at ${line.station.name}. ${walkLabel(line.walkMinutes, line.distanceMiles)}`}>
      <span className="line-identity"><span className="line-icon"><TrainFront size={21} /></span><strong>{line.route}</strong><small>Line</small></span>
      <span className="line-station"><strong>{line.station.name}</strong><small><Footprints size={14} />{walkLabel(line.walkMinutes, line.distanceMiles)}</small></span>
      <span className="mini-etas">{direction?.arrivals.slice(0, 2).map((arrival) => <MiniEta key={`${arrival.runNumber}-${arrival.arrivalTime}`} arrival={arrival} />)}{!direction?.arrivals.length && <span className="no-eta">No ETAs</span>}</span>
      <ChevronRight size={19} aria-hidden="true" />
    </button>
    {line.directions.length > 1 && <div className="direction-switcher" aria-label={`${line.route} Line direction`}>
      {line.directions.map((item) => <button key={item.id} className={item.id === direction?.id ? 'active' : ''} aria-pressed={item.id === direction?.id} onClick={() => setDirectionId(item.id)}>{item.label}</button>)}
    </div>}
  </article>
}

function MiniEta({ arrival }: { arrival: Arrival }) {
  const status = arrival.delayed ? 'Delayed' : arrival.scheduled ? 'Scheduled' : 'Live'
  return <span className={`mini-eta ${arrival.delayed ? 'is-delayed' : ''}`} title={`${status}, ${formatArrivalTime(arrival.arrivalTime)}`}>
    <strong>{arrival.approaching ? 'Due' : arrival.minutes}</strong>{!arrival.approaching && <small>min</small>}
    <i className={status.toLowerCase()} aria-label={status} />
  </span>
}

function RouteDetail({ focus, onDirection, loadingVehicles, routeError }: { focus: RouteFocus; onDirection: (id: string) => void; loadingVehicles: boolean; routeError: string | null }) {
  const direction = focus.directions.find((item) => item.id === focus.directionId) ?? focus.directions[0]
  const etaCards = direction?.arrivals.slice(0, 3) ?? []
  const later = direction?.arrivals.slice(3) ?? []
  const boardingPlace = focus.mode === 'bus' ? focus.busStop : focus.station
  return <div className={`route-detail ${focus.mode === 'bus' ? 'bus' : routeClass[focus.route]}`}>
    <div className="route-focus-context">
      <span className="route-focus-badge">{focus.mode === 'bus' ? <BusFront size={22} /> : <TrainFront size={22} />}</span>
      <div><strong>{boardingPlace?.name ?? (focus.mode === 'bus' ? `Route ${focus.route}` : `${focus.route} Line map`)}</strong>
        {boardingPlace && <span>{focus.walkMinutes !== undefined ? <><Footprints size={14} />{walkLabel(focus.walkMinutes, focus.distanceMiles ?? 0)}</> : `Selected boarding ${focus.mode === 'bus' ? 'stop' : 'station'}`}</span>}
      </div>
      {focus.station?.accessible && <span className="accessibility-label"><Accessibility size={16} />Accessible</span>}
    </div>
    {focus.directions.length > 0 && <div className="route-directions" aria-label="Choose travel direction">{focus.directions.map((item) => <button key={item.id} className={item.id === direction?.id ? 'active' : ''} aria-pressed={item.id === direction?.id} onClick={() => onDirection(item.id)}>{item.label}</button>)}</div>}
    {etaCards.length > 0 ? <div className="eta-cards">{etaCards.map((arrival) => <EtaCard key={`${arrival.runNumber}-${arrival.arrivalTime}`} arrival={arrival} />)}</div>
      : <StateCard icon={<Clock3 />} title={focus.directions.length ? 'No predictions this direction' : 'Choose a nearby stop for arrivals'} detail={`Live ${focus.mode === 'bus' ? 'buses' : 'trains'} are still shown on the map when CTA positions are available.`} />}
    {later.length > 0 && <div className="later-arrivals"><div className="section-label"><span>Later departures</span></div>{later.map((arrival) => <ArrivalRow key={`${arrival.runNumber}-${arrival.arrivalTime}`} arrival={arrival} hideRoute />)}</div>}
    <div className={`map-live-status ${routeError ? 'is-error' : ''}`}>{routeError ? <AlertCircle size={16} /> : loadingVehicles ? <RefreshCw className="spin" size={16} /> : <Wifi size={16} />}<span>{routeError ? `Live ${focus.mode === 'bus' ? 'bus' : 'train'} positions are temporarily unavailable.` : loadingVehicles ? `Refreshing live ${focus.mode === 'bus' ? 'bus' : 'train'} positions` : `Live ${focus.mode === 'bus' ? 'buses update every minute' : 'trains update every 15 seconds'}`}</span></div>
  </div>
}

function EtaCard({ arrival }: { arrival: Arrival }) {
  const status = arrival.delayed ? 'Delayed' : arrival.scheduled ? 'Scheduled' : 'Live'
  return <article className={`eta-card ${arrival.delayed ? 'is-delayed' : ''}`}>
    <span className={`eta-state ${status.toLowerCase()}`}>{status}</span>
    <div className="eta-countdown">{arrival.approaching ? <strong>Due</strong> : <><strong>{arrival.minutes}</strong><span>min</span></>}</div>
    <time dateTime={arrival.arrivalTime}>{formatArrivalTime(arrival.arrivalTime)}</time>
    <small>{arrival.destination}</small>
  </article>
}

function StationBoard({ station, arrivals, loading, error, onRouteSelect, onRetry }: { station: Station; arrivals: ArrivalBoard | null; loading: boolean; error: string | null; onRouteSelect: (route: string) => void; onRetry: () => void }) {
  return <div className="station-board">
    <div className="station-meta"><RouteChips routes={station.routes} onRouteSelect={onRouteSelect} />{station.accessible && <span className="accessibility-label"><Accessibility size={16} />Accessible</span>}</div>
    <div className="arrival-section-heading"><div><Wifi size={16} /><strong>Arrivals</strong></div>{loading && arrivals && <RefreshCw className="spin" size={15} aria-label="Refreshing arrivals" />}</div>
    {loading && !arrivals && <ArrivalSkeleton />}
    {error && <StateCard icon={<WifiOff />} title="Arrival times unavailable" detail={error} action="Try again" onAction={onRetry} />}
    {!error && arrivals?.arrivals.length === 0 && <StateCard icon={<Clock3 />} title="No predictions right now" detail="CTA is not reporting upcoming trains for this station." action="Refresh" onAction={onRetry} />}
    {!error && arrivals && arrivals.arrivals.length > 0 && <div className="arrival-list">{arrivals.arrivals.map((arrival) => <ArrivalRow key={`${arrival.runNumber}-${arrival.arrivalTime}`} arrival={arrival} />)}</div>}
    {arrivals && !error && <p className="freshness">Updated {formatTime(arrivals.generatedAt)} · Auto-refreshes every 30 seconds</p>}
  </div>
}

function BusStopBoard({ stop, arrivals, loading, error, onRouteSelect, onRetry }: { stop: BusStop; arrivals: BusArrivalBoard | null; loading: boolean; error: string | null; onRouteSelect: (route: string) => void; onRetry: () => void }) {
  const adapted = arrivals?.arrivals.map(busArrivalToArrival) ?? []
  return <div className="station-board bus-stop-board">
    <div className="station-meta"><div className="route-chips bus-route-chips" aria-label={`Bus routes: ${stop.routes.join(', ')}`}>{stop.routes.map((route) => <button key={route} className="bus" onClick={() => onRouteSelect(route)}><span className="route-swatch" aria-hidden="true" />Route {route}<ChevronRight size={15} /></button>)}</div><span className="stop-direction"><Navigation size={15} />{stop.direction}</span></div>
    <div className="arrival-section-heading"><div><Wifi size={16} /><strong>Bus arrivals</strong></div>{loading && arrivals && <RefreshCw className="spin" size={15} aria-label="Refreshing bus arrivals" />}</div>
    {loading && !arrivals && <ArrivalSkeleton />}
    {error && <StateCard icon={<WifiOff />} title="Bus arrival times unavailable" detail={error} action="Try again" onAction={onRetry} />}
    {!error && arrivals && adapted.length === 0 && <StateCard icon={<Clock3 />} title="No predictions right now" detail="CTA is not reporting upcoming buses for this stop." action="Refresh" onAction={onRetry} />}
    {!error && adapted.length > 0 && <div className="arrival-list">{adapted.map((arrival) => <ArrivalRow key={`${arrival.runNumber}-${arrival.arrivalTime}-${arrival.route}`} arrival={arrival} bus />)}</div>}
    {arrivals && !error && <p className="freshness">Updated {formatTime(arrivals.generatedAt)} · Auto-refreshes every minute</p>}
  </div>
}

function ArrivalRow({ arrival, hideRoute = false, bus = false }: { arrival: Arrival; hideRoute?: boolean; bus?: boolean }) {
  const status = arrival.delayed ? 'Delayed' : arrival.scheduled ? 'Scheduled' : 'Live'
  return <article className={`arrival-row ${arrival.delayed ? 'is-delayed' : ''}`}>
    {!hideRoute && <span className={`route-badge ${bus ? 'bus' : routeClass[arrival.route] ?? ''}`}>{routeAbbreviation(arrival.route)}</span>}
    <div className="arrival-destination"><strong>{arrival.destination}</strong><span className="arrival-platform"><Navigation size={13} />{arrival.platform || 'Platform pending'}</span><span className={`arrival-status ${status.toLowerCase()}`}>{status}</span></div>
    <div className={`arrival-time ${arrival.approaching ? 'due' : ''}`} title={formatArrivalTime(arrival.arrivalTime)}><div>{arrival.approaching ? <strong>Due</strong> : <><strong>{arrival.minutes}</strong><span>min</span></>}</div><time dateTime={arrival.arrivalTime}>{formatArrivalTime(arrival.arrivalTime)}</time></div>
  </article>
}

function RoutePicker({ onSelect }: { onSelect: (route: string) => void }) {
  return <nav className="route-picker" aria-label="Explore rail lines">{ROUTES.map((route) => <button key={route} className={routeClass[route]} onClick={() => onSelect(route)} aria-label={`${route} Line`}><span className="route-swatch" aria-hidden="true" /><span>{route}</span></button>)}</nav>
}

function BusRoutePicker({ routes, onSelect }: { routes: BusRoute[]; onSelect: (route: BusRoute) => void }) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLowerCase()
  const visible = routes.filter((route) => !normalized || `${route.id} ${route.name}`.toLowerCase().includes(normalized)).slice(0, normalized ? 30 : 12)
  return <div className="bus-route-picker">
    <label><Search size={17} aria-hidden="true" /><span className="sr-only">Search bus routes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bus routes" />{query && <button onClick={() => setQuery('')} aria-label="Clear bus route search"><X size={16} /></button>}</label>
    <div className="bus-route-grid">{visible.map((route) => <button key={route.id} onClick={() => onSelect(route)}><span>{route.id}</span><strong>{route.name}</strong><ChevronRight size={16} /></button>)}</div>
    {!visible.length && <div className="bus-route-empty"><BusFront size={20} /><span>No matching bus routes</span></div>}
  </div>
}

function RouteChips({ routes, onRouteSelect }: { routes: string[]; onRouteSelect: (route: string) => void }) {
  return <div className="route-chips" aria-label={`Routes: ${routes.join(', ')}`}>{routes.map((route) => <button key={route} className={routeClass[route] ?? ''} onClick={() => onRouteSelect(route)}><span className="route-swatch" aria-hidden="true" />{normalizeRoute(route)} Line<ChevronRight size={15} /></button>)}</div>
}

function SearchResults({ results, busRoutes, busStops, selectedId, selectedBusStopId, onSelect, onBusRoute, onBusStop }: { results: Station[]; busRoutes: BusRoute[]; busStops: BusStop[]; selectedId?: string; selectedBusStopId?: string; onSelect: (station: Station) => void; onBusRoute: (route: BusRoute) => void; onBusStop: (stop: BusStop) => void }) {
  return <div className="search-results" id="station-search-results" role="listbox" aria-label="Transit search results">{results.map((station) => <button key={`rail-${station.id}`} role="option" aria-selected={selectedId === station.id} onClick={() => onSelect(station)}><span className="search-result-icon"><MapPin size={18} /></span><span className="search-result-name"><strong>{station.name}</strong><small>{station.descriptiveName}</small></span><RouteDots routes={station.routes} /></button>)}
    {busRoutes.map((route) => <button key={`bus-${route.id}`} role="option" aria-selected={false} onClick={() => onBusRoute(route)}><span className="search-result-icon bus"><BusFront size={18} /></span><span className="search-result-name"><strong>{route.id} {route.name}</strong><small>CTA bus route</small></span><ChevronRight size={17} /></button>)}
    {busStops.map((stop) => <button key={`stop-${stop.id}`} role="option" aria-selected={selectedBusStopId === stop.id} onClick={() => onBusStop(stop)}><span className="search-result-icon bus"><MapPin size={18} /></span><span className="search-result-name"><strong>{stop.name}</strong><small>{stop.direction} · Routes {stop.routes.join(', ')}</small></span><ChevronRight size={17} /></button>)}
    {!results.length && !busRoutes.length && !busStops.length && <div className="search-empty"><Search size={22} /><strong>No matching transit</strong><span>Try a station, street, line color, or bus route.</span></div>}
  </div>
}

function RouteDots({ routes }: { routes: string[] }) { return <span className="route-dots" aria-label={`Routes: ${routes.map(normalizeRoute).join(', ')}`}>{routes.map((route) => <span key={route} className={routeClass[route] ?? ''} />)}</span> }
function FeedSkeleton() { return <div className="feed-skeleton skeleton-list" aria-label="Loading nearby departures">{[0, 1, 2, 3].map((item) => <div className="line-skeleton" key={item}><i /><span><b /><b /></span><em /><em /></div>)}</div> }
function ArrivalSkeleton() { return <div className="skeleton-list" aria-label="Loading arrivals">{[0, 1, 2].map((item) => <div className="arrival-skeleton" key={item}><i /><span><b /><b /></span><em /></div>)}</div> }
function StateCard({ icon, title, detail, action, onAction }: { icon: React.ReactNode; title: string; detail: string; action?: string; onAction?: () => void }) { return <div className="state-card" role="status"><span className="state-icon">{icon}</span><div><strong>{title}</strong><span>{detail}</span></div>{action && onAction && <button onClick={onAction}><RefreshCw size={16} />{action}</button>}</div> }

function groupDirections(arrivals: Arrival[]) {
  const groups = new Map<string, Arrival[]>()
  arrivals.forEach((arrival) => { const id = arrival.platform || `Toward ${arrival.destination}`; groups.set(id, [...(groups.get(id) ?? []), arrival]) })
  return [...groups.entries()].map(([id, values]) => ({ id, label: id, arrivals: values.sort((a, b) => a.minutes - b.minutes) }))
}
function formatArrivalTime(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? 'Time unavailable' : parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }
function routeAbbreviation(route: string) { return ({ Red: 'R', Blue: 'B', G: 'G', Green: 'G', Brn: 'Br', Brown: 'Br', P: 'P', Purple: 'P', Pink: 'Pk', Org: 'O', Orange: 'O', Y: 'Y', Yellow: 'Y' } as Record<string, string>)[route] ?? route }
function formatTime(value: string) { if (!value) return 'just now'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }
