import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Accessibility from 'lucide-react/dist/esm/icons/accessibility'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
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
import { getArrivals, getRouteGeometry, getStations, getTrainPositions } from './api'
import { buildNearbyLines, normalizeRoute, walkLabel, type DirectionGroup, type NearbyLine } from './feed'
import { useLocation } from './hooks/useLocation'
import { useNearbyBoard } from './hooks/useNearbyBoard'
import TransitMap from './TransitMap'
import type { Arrival, ArrivalBoard, MapCenter, RouteGeometry, Station, TrainPosition } from './types'

const INITIAL_CENTER: MapCenter = { latitude: 41.9214, longitude: -87.6776 }
const ROUTES = ['Red', 'Blue', 'Green', 'Brown', 'Purple', 'Pink', 'Orange', 'Yellow'] as const
type SheetState = 'collapsed' | 'partial' | 'expanded'
type ReferenceMode = 'location' | 'map'
type RouteFocus = { route: string; station: Station | null; directions: DirectionGroup[]; directionId: string | null; walkMinutes?: number; distanceMiles?: number }

export const routeClass: Record<string, string> = {
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
  const [routeFocus, setRouteFocus] = useState<RouteFocus | null>(null)
  const [trains, setTrains] = useState<TrainPosition[]>([])
  const [geometry, setGeometry] = useState<RouteGeometry | null>(null)
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [arrivalRetry, setArrivalRetry] = useState(0)
  const [stationRetry, setStationRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [sheetState, setSheetState] = useState<SheetState>('partial')
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>('map')
  const [focusPoint, setFocusPoint] = useState<{ point: MapCenter; token: number } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const reference = referenceMode === 'location' && location.coordinates ? location.coordinates : center
  const nearby = useNearbyBoard(reference)
  const lines = useMemo(() => buildNearbyLines(nearby.board), [nearby.board])
  const selectedRoute = routeFocus?.route ?? null

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
    if (!selectedRoute) {
      setTrains([]); setGeometry(null); setRouteError(null)
      return
    }
    let active = true
    const controller = new AbortController()
    getRouteGeometry(selectedRoute, controller.signal)
      .then((result) => { if (active) setGeometry(result) })
      .catch(() => { if (active) setGeometry(null) })
    const loadTrains = () => {
      setLoadingPositions(true); setRouteError(null)
      getTrainPositions(selectedRoute).then((positions) => { if (active) setTrains(positions) })
        .catch((reason: Error) => { if (active) setRouteError(reason.message) })
        .finally(() => { if (active) setLoadingPositions(false) })
    }
    setTrains([]); setGeometry(null); loadTrains()
    const timer = window.setInterval(loadTrains, 15_000)
    return () => { active = false; controller.abort(); window.clearInterval(timer) }
  }, [selectedRoute])

  useEffect(() => {
    if (!location.coordinates) return
    setReferenceMode('location')
    setFocusPoint((current) => ({ point: location.coordinates!, token: (current?.token ?? 0) + 1 }))
  }, [location.coordinates])

  const normalizedSearch = search.trim().toLowerCase()
  const searchResults = useMemo(() => normalizedSearch ? stations.filter((station) =>
    `${station.name} ${station.descriptiveName} ${station.routes.join(' ')}`.toLowerCase().includes(normalizedSearch)).slice(0, 7) : [], [normalizedSearch, stations])

  const selectStation = useCallback((station: Station) => {
    setRouteFocus(null); setSelected(station); setArrivals(null); setSearch(''); setArrivalError(null); setSheetState('partial')
  }, [])

  const openLine = (line: NearbyLine, directionId?: string) => {
    setSelected(null); setArrivals(null)
    setRouteFocus({
      route: line.route, station: line.station, directions: line.directions,
      directionId: directionId ?? line.directions[0]?.id ?? null,
      walkMinutes: line.walkMinutes, distanceMiles: line.distanceMiles,
    })
    setSheetState('partial')
  }

  const openRoute = (route: string, station?: Station, stationArrivals: Arrival[] = []) => {
    const normalized = normalizeRoute(route)
    const matchingLine = lines.find((line) => line.route === normalized)
    if (!station && matchingLine) return openLine(matchingLine)
    const routeArrivals = stationArrivals.filter((arrival) => normalizeRoute(arrival.route) === normalized)
    const grouped = groupDirections(routeArrivals)
    setSelected(null); setArrivals(null)
    setRouteFocus({ route: normalized, station: station ?? null, directions: grouped, directionId: grouped[0]?.id ?? null })
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
  }

  const title = routeFocus ? `${routeFocus.route} Line` : selected?.name ?? (referenceMode === 'location' ? 'Near you' : 'Near map center')
  const kicker = routeFocus ? 'Route' : selected ? 'Station' : referenceMode === 'location' ? 'Live departures' : 'Explore Chicago'

  return (
    <main className={`app-shell sheet-${sheetState}`}>
      <TransitMap
        stations={stations}
        selectedStation={selected ?? routeFocus?.station ?? null}
        onCenterChange={onMapCenterChange}
        onStationSelect={selectStation}
        trains={trains}
        selectedRoute={selectedRoute}
        geometry={geometry}
        userLocation={location.coordinates}
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
          {normalizedSearch && <SearchResults results={searchResults} selectedId={selected?.id} onSelect={selectStation} />}
        </div>
      </header>

      {selectedRoute && <div className={`route-status ${routeError ? 'is-error' : ''}`} role="status">
        {routeError ? <AlertCircle size={16} /> : loadingPositions ? <RefreshCw className="spin" size={16} /> : <Navigation size={16} />}
        <span>{routeError ? 'Live trains unavailable' : loadingPositions && trains.length === 0 ? `Finding ${selectedRoute} trains…` : `${trains.length} ${selectedRoute} train${trains.length === 1 ? '' : 's'} live`}</span>
      </div>}

      <BottomSheet state={sheetState} setState={setSheetState} onCycle={cycleSheet}>
        <div className="sheet-heading">
          <div className="sheet-title">
            {routeFocus && <button className="icon-button detail-back" onClick={closeDetail} aria-label="Back to nearby departures"><ArrowLeft size={20} /></button>}
            <span className={`sheet-title-icon ${routeFocus ? routeClass[routeFocus.route] : ''}`}>{routeFocus ? <TrainFront size={19} /> : selected ? <MapPin size={19} /> : <LocateFixed size={19} />}</span>
            <div><span className="sheet-kicker">{kicker}</span><h1>{title}</h1></div>
          </div>
          <div className="sheet-actions">
            {(selected || routeFocus) && !routeFocus && <button className="icon-button" onClick={closeDetail} aria-label="Close details"><X size={20} /></button>}
            <button className="icon-button sheet-down" onClick={() => cycleSheet(-1)} disabled={sheetState === 'collapsed'} aria-label="Collapse sheet"><ChevronDown size={21} /></button>
            <button className="icon-button sheet-up" onClick={() => cycleSheet(1)} disabled={sheetState === 'expanded'} aria-label="Expand sheet"><ChevronUp size={21} /></button>
          </div>
        </div>

        {!selected && !routeFocus && <div className="sheet-summary">
          <MapPin size={16} /><span>{nearby.loading && !nearby.board ? 'Finding nearby departures' : `${lines.length} lines nearby`}</span>
          {referenceMode === 'map' && location.coordinates && <button className="return-location" onClick={returnToLocation}><LocateFixed size={16} />Return to my location</button>}
        </div>}

        <div className="sheet-body">
          {routeFocus ? <RouteDetail focus={routeFocus} onDirection={(directionId) => setRouteFocus((current) => current ? { ...current, directionId } : current)} loadingTrains={loadingPositions} routeError={routeError} />
            : selected ? <StationBoard station={selected} arrivals={arrivals} loading={loadingArrivals} error={arrivalError} onRouteSelect={(route) => openRoute(route, selected, arrivals?.arrivals)} onRetry={() => setArrivalRetry((value) => value + 1)} />
              : <NearbyFeed lines={lines} boardReady={Boolean(nearby.board)} loading={nearby.loading} refreshing={nearby.refreshing} error={nearby.error || stationError}
                locationPermission={location.permission} locationMessage={location.message} onLocation={location.request} onRetry={nearby.retry} onOpen={openLine} limit={sheetState === 'expanded' ? undefined : 6} />}

          {!selected && !routeFocus && sheetState === 'expanded' && <div className="all-lines-section">
            <div className="section-label"><span>All rail lines</span><small>Explore live trains</small></div>
            <RoutePicker onSelect={(route) => openRoute(route)} />
          </div>}
        </div>
      </BottomSheet>
      <p className="data-credit">CTA + City of Chicago data · Unofficial · Free and open source</p>
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

function NearbyFeed({ lines, boardReady, loading, refreshing, error, locationPermission, locationMessage, onLocation, onRetry, onOpen, limit }: {
  lines: NearbyLine[]; boardReady: boolean; loading: boolean; refreshing: boolean; error: string | null
  locationPermission: string; locationMessage: string | null; onLocation: () => void; onRetry: () => void; onOpen: (line: NearbyLine, directionId?: string) => void; limit?: number
}) {
  return <div className="nearby-feed">
    {locationPermission === 'idle' && <div className="location-card">
      <span className="location-card-icon"><LocateFixed size={22} /></span>
      <div><strong>See trains near you</strong><span>Use your location to find the easiest departures to catch.</span></div>
      <button onClick={onLocation}>Use location</button>
    </div>}
    {['denied', 'unavailable', 'error'].includes(locationPermission) && locationMessage && <div className="inline-notice" role="status"><AlertCircle size={18} /><span>{locationMessage}</span><button onClick={onLocation}>Try again</button></div>}
    {loading && !boardReady && <FeedSkeleton />}
    {error && !boardReady && <StateCard icon={<WifiOff />} title="Nearby departures unavailable" detail={error} action="Try again" onAction={onRetry} />}
    {error && boardReady && <div className="stale-notice" role="status"><WifiOff size={15} />Showing the last update.<button onClick={onRetry}>Retry</button></div>}
    {!loading && boardReady && !lines.length && <StateCard icon={<Clock3 />} title="No nearby predictions" detail="CTA is not reporting trains near this point right now." action="Refresh" onAction={onRetry} />}
    {lines.length > 0 && <div className="line-feed" aria-label="Nearby rail departures">
      {lines.slice(0, limit).map((line) => <NearbyLineCard key={line.route} line={line} onOpen={onOpen} />)}
    </div>}
    {refreshing && boardReady && <p className="refreshing-label"><RefreshCw className="spin" size={14} />Refreshing departures</p>}
  </div>
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

function RouteDetail({ focus, onDirection, loadingTrains, routeError }: { focus: RouteFocus; onDirection: (id: string) => void; loadingTrains: boolean; routeError: string | null }) {
  const direction = focus.directions.find((item) => item.id === focus.directionId) ?? focus.directions[0]
  const etaCards = direction?.arrivals.slice(0, 3) ?? []
  const later = direction?.arrivals.slice(3) ?? []
  return <div className={`route-detail ${routeClass[focus.route]}`}>
    <div className="route-focus-context">
      <span className="route-focus-badge"><TrainFront size={22} /></span>
      <div><strong>{focus.station?.name ?? `${focus.route} Line map`}</strong>
        {focus.station && <span>{focus.walkMinutes !== undefined ? <><Footprints size={14} />{walkLabel(focus.walkMinutes, focus.distanceMiles ?? 0)}</> : 'Selected boarding station'}</span>}
      </div>
      {focus.station?.accessible && <span className="accessibility-label"><Accessibility size={16} />Accessible</span>}
    </div>
    {focus.directions.length > 0 && <div className="route-directions" aria-label="Choose travel direction">{focus.directions.map((item) => <button key={item.id} className={item.id === direction?.id ? 'active' : ''} aria-pressed={item.id === direction?.id} onClick={() => onDirection(item.id)}>{item.label}</button>)}</div>}
    {etaCards.length > 0 ? <div className="eta-cards">{etaCards.map((arrival) => <EtaCard key={`${arrival.runNumber}-${arrival.arrivalTime}`} arrival={arrival} />)}</div>
      : <StateCard icon={<Clock3 />} title="No predictions this direction" detail="Live trains are still shown on the map when CTA positions are available." />}
    {later.length > 0 && <div className="later-arrivals"><div className="section-label"><span>Later departures</span></div>{later.map((arrival) => <ArrivalRow key={`${arrival.runNumber}-${arrival.arrivalTime}`} arrival={arrival} hideRoute />)}</div>}
    <div className={`map-live-status ${routeError ? 'is-error' : ''}`}>{routeError ? <AlertCircle size={16} /> : loadingTrains ? <RefreshCw className="spin" size={16} /> : <Wifi size={16} />}<span>{routeError ? 'Live train positions are temporarily unavailable.' : loadingTrains ? 'Refreshing live train positions' : 'Live trains update every 15 seconds'}</span></div>
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

function ArrivalRow({ arrival, hideRoute = false }: { arrival: Arrival; hideRoute?: boolean }) {
  const status = arrival.delayed ? 'Delayed' : arrival.scheduled ? 'Scheduled' : 'Live'
  return <article className={`arrival-row ${arrival.delayed ? 'is-delayed' : ''}`}>
    {!hideRoute && <span className={`route-badge ${routeClass[arrival.route] ?? ''}`}>{routeAbbreviation(arrival.route)}</span>}
    <div className="arrival-destination"><strong>{arrival.destination}</strong><span className="arrival-platform"><Navigation size={13} />{arrival.platform || 'Platform pending'}</span><span className={`arrival-status ${status.toLowerCase()}`}>{status}</span></div>
    <div className={`arrival-time ${arrival.approaching ? 'due' : ''}`} title={formatArrivalTime(arrival.arrivalTime)}><div>{arrival.approaching ? <strong>Due</strong> : <><strong>{arrival.minutes}</strong><span>min</span></>}</div><time dateTime={arrival.arrivalTime}>{formatArrivalTime(arrival.arrivalTime)}</time></div>
  </article>
}

function RoutePicker({ onSelect }: { onSelect: (route: string) => void }) {
  return <nav className="route-picker" aria-label="Explore rail lines">{ROUTES.map((route) => <button key={route} className={routeClass[route]} onClick={() => onSelect(route)} aria-label={`${route} Line`}><span className="route-swatch" aria-hidden="true" /><span>{route}</span></button>)}</nav>
}

function RouteChips({ routes, onRouteSelect }: { routes: string[]; onRouteSelect: (route: string) => void }) {
  return <div className="route-chips" aria-label={`Routes: ${routes.join(', ')}`}>{routes.map((route) => <button key={route} className={routeClass[route] ?? ''} onClick={() => onRouteSelect(route)}><span className="route-swatch" aria-hidden="true" />{normalizeRoute(route)} Line<ChevronRight size={15} /></button>)}</div>
}

function SearchResults({ results, selectedId, onSelect }: { results: Station[]; selectedId?: string; onSelect: (station: Station) => void }) {
  return <div className="search-results" id="station-search-results" role="listbox" aria-label="Station search results">{results.length ? results.map((station) => <button key={station.id} role="option" aria-selected={selectedId === station.id} onClick={() => onSelect(station)}><span className="search-result-icon"><MapPin size={18} /></span><span className="search-result-name"><strong>{station.name}</strong><small>{station.descriptiveName}</small></span><RouteDots routes={station.routes} /></button>) : <div className="search-empty"><Search size={22} /><strong>No matching stations</strong><span>Try a station, neighborhood, or line color.</span></div>}</div>
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
