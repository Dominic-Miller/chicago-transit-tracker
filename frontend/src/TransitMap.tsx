import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import type { MapCenter, RouteGeometry, Station, TrainPosition } from './types'

type Props = {
  stations: Station[]
  selectedStation: Station | null
  onCenterChange: (center: MapCenter, userInitiated: boolean) => void
  onStationSelect: (station: Station) => void
  trains: TrainPosition[]
  selectedRoute: string | null
  geometry: RouteGeometry | null
  userLocation: MapCenter | null
  focusPoint: { point: MapCenter; token: number } | null
}

const routeColors: Record<string, string> = {
  Red: '#c81d31', Blue: '#1769aa', G: '#148447', Green: '#148447', Brn: '#70402f', Brown: '#70402f',
  P: '#6b3fa0', Purple: '#6b3fa0', Pink: '#d63b82', Org: '#e96b19', Orange: '#e96b19',
  Y: '#f5c51b', Yellow: '#f5c51b',
}

// Lucide's TrainFront icon, inlined because Leaflet's divIcon API expects HTML.
const trainFrontIcon = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"></path><path d="m9 15-1-1"></path><path d="m15 15 1-1"></path><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"></path><path d="m8 19-2 3"></path><path d="m16 19 2 3"></path></svg>'

export default function TransitMap({
  stations,
  selectedStation,
  onCenterChange,
  onStationSelect,
  trains,
  selectedRoute,
  geometry,
  userLocation,
  focusPoint,
}: Props) {
  const [mapZoom, setMapZoom] = useState(12)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const stationLayerRef = useRef<L.LayerGroup | null>(null)
  const trainLayerRef = useRef<L.LayerGroup | null>(null)
  const geometryLayerRef = useRef<L.LayerGroup | null>(null)
  const locationLayerRef = useRef<L.LayerGroup | null>(null)
  const fittedRouteRef = useRef<string | null>(null)
  const userInteractionRef = useRef(false)
  const onCenterChangeRef = useRef(onCenterChange)
  const onStationSelectRef = useRef(onStationSelect)

  onCenterChangeRef.current = onCenterChange
  onStationSelectRef.current = onStationSelect

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [41.9214, -87.6776],
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    })

    L.control.zoom({ position: 'topright' }).addTo(map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      className: 'map-base-tiles',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      className: 'map-label-tiles',
      opacity: 0.5,
    }).addTo(map)

    const stationLayer = L.layerGroup().addTo(map)
    const geometryLayer = L.layerGroup().addTo(map)
    const trainLayer = L.layerGroup().addTo(map)
    const locationLayer = L.layerGroup().addTo(map)
    mapRef.current = map
    stationLayerRef.current = stationLayer
    geometryLayerRef.current = geometryLayer
    trainLayerRef.current = trainLayer
    locationLayerRef.current = locationLayer

    const syncMapDetail = () => {
      if (containerRef.current) containerRef.current.dataset.mapDetail = String(map.getZoom() >= 14)
      setMapZoom(map.getZoom())
    }
    const reportCenter = () => {
      const center = map.getCenter()
      onCenterChangeRef.current({ latitude: center.lat, longitude: center.lng }, userInteractionRef.current)
      userInteractionRef.current = false
    }
    syncMapDetail()
    map.on('zoomend', syncMapDetail)
    map.on('moveend', reportCenter)
    map.on('dragstart', () => { userInteractionRef.current = true })
    map.on('zoomstart', (event: { originalEvent?: Event }) => {
      if (event.originalEvent) userInteractionRef.current = true
    })

    window.requestAnimationFrame(() => map.invalidateSize())

    return () => {
      map.remove()
      mapRef.current = null
      stationLayerRef.current = null
      geometryLayerRef.current = null
      trainLayerRef.current = null
      locationLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const layer = geometryLayerRef.current
    const map = mapRef.current
    if (!layer || !map) return
    layer.clearLayers()
    if (!geometry || !selectedRoute) return
    const color = routeColors[selectedRoute] ?? '#1769aa'
    const bounds: [number, number][] = []
    geometry.paths.forEach((path) => {
      const latLngs = path.map((point) => [point.latitude, point.longitude] as [number, number])
      bounds.push(...latLngs)
      L.polyline(latLngs, { color: '#ffffff', weight: 9, opacity: 0.94, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layer)
      L.polyline(latLngs, { color, weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layer)
    })
    if (bounds.length && fittedRouteRef.current !== selectedRoute) {
      fittedRouteRef.current = selectedRoute
      const desktop = window.matchMedia('(min-width: 900px)').matches
      map.fitBounds(L.latLngBounds(bounds), {
        paddingTopLeft: desktop ? [460, 76] : [34, 130],
        paddingBottomRight: desktop ? [40, 76] : [34, 260],
        maxZoom: 13,
        animate: !reducedMotion(),
      })
    }
  }, [geometry, selectedRoute])

  useEffect(() => {
    const stationLayer = stationLayerRef.current
    if (!stationLayer) return

    const map = mapRef.current
    if (!map) return

    stationLayer.clearLayers()
    const visibleStations = selectedRoute
      ? stations.filter((station) => station.id === selectedStation?.id || station.routes.some((route) => normalizeRoute(route) === selectedRoute))
      : stations
    clusterStations(visibleStations, map, selectedStation?.id, Boolean(selectedRoute)).forEach((group) => {
      if (group.length > 1) {
        const bounds = L.latLngBounds(group.map((station) => [station.latitude, station.longitude]))
        const center = bounds.getCenter()
        const marker = L.marker(center, {
          keyboard: true,
          title: `${group.length} nearby stations. Zoom in to explore them.`,
          alt: `${group.length} nearby stations`,
          zIndexOffset: 300,
          icon: L.divIcon({
            className: 'station-cluster-shell',
            html: stationClusterHtml(group),
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
        })
        marker.bindTooltip(stationClusterTooltip(group), { direction: 'top', offset: [0, -16] })
        marker.on('click', () => map.flyToBounds(bounds, {
          padding: [54, 54],
          maxZoom: 14,
          animate: !reducedMotion(),
          duration: 0.5,
        }))
        marker.addTo(stationLayer)
        const element = marker.getElement()
        element?.setAttribute('role', 'button')
        element?.setAttribute('aria-label', `${group.length} nearby stations. Zoom in to explore them.`)
        element?.addEventListener('focus', () => marker.openTooltip())
        element?.addEventListener('blur', () => marker.closeTooltip())
        return
      }

      const station = group[0]
      const selected = station.id === selectedStation?.id
      const marker = L.marker([station.latitude, station.longitude], {
        keyboard: true,
        title: `${station.name} station, ${station.routes.map(normalizeRoute).join(', ')} Line`,
        alt: `${station.name} station`,
        zIndexOffset: selected ? 800 : 0,
        icon: L.divIcon({
          className: `station-marker-shell${selected ? ' is-selected' : ''}`,
          html: stationMarkerHtml(station, selected),
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
      })

      marker.bindTooltip(textLabel(station.name), { direction: 'top', offset: [0, selected ? -15 : -11] })
      marker.on('click', () => onStationSelectRef.current(station))
      marker.addTo(stationLayer)
      const element = marker.getElement()
      element?.setAttribute('role', 'button')
      element?.setAttribute('aria-label', `${station.name} station, ${station.routes.map(normalizeRoute).join(', ')} Line`)
      element?.addEventListener('focus', () => marker.openTooltip())
      element?.addEventListener('blur', () => marker.closeTooltip())
    })
  }, [stations, selectedStation?.id, selectedRoute, mapZoom])

  useEffect(() => {
    const map = mapRef.current
    const trainLayer = trainLayerRef.current
    if (!map || !trainLayer) return

    trainLayer.clearLayers()
    trains.forEach((train) => {
      const routeSlug = selectedRoute?.toLowerCase() ?? ''
      const markerRotation = clampHeading(train.heading) + 135
      const marker = L.marker([train.latitude, train.longitude], {
        keyboard: true,
        zIndexOffset: 1000,
        title: `Run ${train.runNumber} to ${train.destination}; next stop ${train.nextStationName}`,
        alt: `Train ${train.runNumber} toward ${train.destination}`,
        icon: L.divIcon({
          className: 'train-marker-shell',
          html: `<span class="train-marker ${routeSlug}${train.delayed ? ' is-delayed' : ''}" style="--marker-rotation:${markerRotation}deg;--icon-rotation:${-markerRotation}deg"><span class="train-marker-icon">${trainFrontIcon}</span></span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
      })
      marker.bindTooltip(trainTooltip(train), { direction: 'top', offset: [0, -16] })
      marker.bindPopup(trainPopup(train), { offset: [0, -16], className: 'train-popup' })
      marker.addTo(trainLayer)
      marker.getElement()?.setAttribute('aria-label', `Train ${train.runNumber} toward ${train.destination}; next stop ${train.nextStationName}${train.delayed ? '; delayed' : ''}`)
    })

    if (selectedRoute && trains.length > 0 && !geometry && fittedRouteRef.current !== selectedRoute) {
      fittedRouteRef.current = selectedRoute
      const desktop = window.matchMedia('(min-width: 900px)').matches
      if (desktop) {
        map.once('moveend', () => {
          if (map.getZoom() < 11) map.setZoom(11, { animate: false })
        })
      }
      map.fitBounds(L.latLngBounds(trains.map((train) => [train.latitude, train.longitude])), {
        paddingTopLeft: desktop ? [460, 76] : [40, 150],
        paddingBottomRight: desktop ? [40, 76] : [40, 240],
        maxZoom: 13,
        animate: !reducedMotion(),
      })
    }
    if (!selectedRoute) fittedRouteRef.current = null
  }, [trains, selectedRoute, geometry])

  useEffect(() => {
    if (!selectedStation || !mapRef.current) return
    mapRef.current.flyTo(
      [selectedStation.latitude, selectedStation.longitude],
      Math.max(mapRef.current.getZoom(), 14),
      { animate: !reducedMotion(), duration: 0.5 },
    )
  }, [selectedStation?.id])

  useEffect(() => {
    locationLayerRef.current?.clearLayers()
    if (!userLocation || !locationLayerRef.current) return
    L.circleMarker([userLocation.latitude, userLocation.longitude], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#1769aa',
        fillOpacity: 1,
        className: 'user-location-marker',
      }).bindTooltip('Your location', { direction: 'top' }).addTo(locationLayerRef.current)
  }, [userLocation])

  useEffect(() => {
    if (!focusPoint || !mapRef.current) return
    mapRef.current.flyTo([focusPoint.point.latitude, focusPoint.point.longitude], 14, {
      animate: !reducedMotion(), duration: 0.6,
    })
  }, [focusPoint?.token])

  return <div ref={containerRef} className="map" aria-label="Interactive map of Chicago rail stations" />
}

function stationMarkerHtml(station: Station, selected: boolean) {
  const colors = station.routes.map((route) => routeColors[route] ?? '#35495a')
  const background = colors.length === 1
    ? colors[0]
    : `conic-gradient(${colors.map((color, index) => `${color} ${index / colors.length * 100}% ${(index + 1) / colors.length * 100}%`).join(',')})`
  return `<span class="station-marker${selected ? ' is-selected' : ''}" style="--station-routes:${background}"><span></span></span>`
}

function clusterStations(stations: Station[], map: L.Map, selectedStationId?: string, routeFocused = false): Station[][] {
  if (map.getZoom() >= 14 || routeFocused) return stations.map((station) => [station])

  const threshold = map.getZoom() <= 11 ? 36 : map.getZoom() === 12 ? 30 : 25
  const groups: Array<{ stations: Station[]; x: number; y: number }> = []

  stations.forEach((station) => {
    const point = map.latLngToLayerPoint([station.latitude, station.longitude])
    if (station.id === selectedStationId) {
      groups.push({ stations: [station], x: point.x, y: point.y })
      return
    }

    const group = groups.find((candidate) =>
      candidate.stations[0].id !== selectedStationId
      && Math.hypot(candidate.x - point.x, candidate.y - point.y) < threshold,
    )
    if (!group) {
      groups.push({ stations: [station], x: point.x, y: point.y })
      return
    }

    const count = group.stations.length
    group.x = (group.x * count + point.x) / (count + 1)
    group.y = (group.y * count + point.y) / (count + 1)
    group.stations.push(station)
  })

  const minimumClusterSize = map.getZoom() <= 11 ? 3 : 4
  return groups.flatMap((group) => group.stations.length >= minimumClusterSize
    ? [group.stations]
    : group.stations.map((station) => [station]))
}

function stationClusterHtml(stations: Station[]) {
  const colors = [...new Set(stations.flatMap((station) => station.routes).map((route) => routeColors[route] ?? '#35495a'))]
  const background = colors.length === 1
    ? colors[0]
    : `conic-gradient(${colors.map((color, index) => `${color} ${index / colors.length * 100}% ${(index + 1) / colors.length * 100}%`).join(',')})`
  return `<span class="station-cluster" style="--cluster-routes:${background}"><span>${stations.length}</span></span>`
}

function stationClusterTooltip(stations: Station[]) {
  const label = document.createElement('span')
  const title = document.createElement('strong')
  title.textContent = `${stations.length} nearby stations`
  const detail = document.createElement('span')
  const names = stations.slice(0, 3).map((station) => station.name).join(', ')
  detail.textContent = `${names}${stations.length > 3 ? ` + ${stations.length - 3} more` : ''}`
  label.append(title, document.createElement('br'), detail)
  return label
}

function textLabel(value: string) {
  const label = document.createElement('span')
  label.textContent = value
  return label
}

function trainTooltip(train: TrainPosition) {
  const label = document.createElement('span')
  const title = document.createElement('strong')
  title.textContent = `Run ${train.runNumber} to ${train.destination}`
  const detail = document.createElement('span')
  detail.textContent = `Next: ${train.nextStationName}${train.delayed ? ' · Delayed' : ''}`
  label.append(title, document.createElement('br'), detail)
  return label
}

function trainPopup(train: TrainPosition) {
  const content = document.createElement('div')
  content.className = 'train-popup-content'
  const label = document.createElement('span')
  label.className = 'popup-kicker'
  label.textContent = `Run ${train.runNumber}${train.delayed ? ' · Delayed' : ''}`
  const title = document.createElement('strong')
  title.textContent = `Toward ${train.destination}`
  const next = document.createElement('span')
  next.textContent = `Next stop · ${train.nextStationName}`
  content.append(label, title, next)
  return content
}

function normalizeRoute(route: string) {
  return ({ G: 'Green', Brn: 'Brown', P: 'Purple', Org: 'Orange', Y: 'Yellow' } as Record<string, string>)[route] ?? route
}

function clampHeading(heading: number) {
  return Math.max(0, Math.min(359, heading))
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
