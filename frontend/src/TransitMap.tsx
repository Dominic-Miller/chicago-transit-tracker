import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import type { MapCenter, Station, TrainPosition } from './types'

type Props = {
  stations: Station[]
  selectedStation: Station | null
  onCenterChange: (center: MapCenter) => void
  onStationSelect: (station: Station) => void
  locateRequest: number
  trains: TrainPosition[]
  selectedRoute: string | null
}

const routeColors: Record<string, string> = {
  Red: '#c62828',
  Blue: '#1261a0',
  Green: '#168447',
  Brown: '#72412d',
  Purple: '#6b3fa0',
  Pink: '#d8458f',
  Orange: '#e76f14',
  Yellow: '#d9ae00',
}

export default function TransitMap({
  stations,
  selectedStation,
  onCenterChange,
  onStationSelect,
  locateRequest,
  trains,
  selectedRoute,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const stationLayerRef = useRef<L.LayerGroup | null>(null)
  const trainLayerRef = useRef<L.LayerGroup | null>(null)
  const fittedRouteRef = useRef<string | null>(null)
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
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    const stationLayer = L.layerGroup().addTo(map)
    const trainLayer = L.layerGroup().addTo(map)
    mapRef.current = map
    stationLayerRef.current = stationLayer
    trainLayerRef.current = trainLayer

    map.on('moveend', () => {
      const center = map.getCenter()
      onCenterChangeRef.current({ latitude: center.lat, longitude: center.lng })
    })

    // Leaflet can initialize before the grid has finished laying out.
    // Recalculate once on the next frame so the full map remains draggable.
    window.requestAnimationFrame(() => map.invalidateSize())

    return () => {
      map.remove()
      mapRef.current = null
      stationLayerRef.current = null
      trainLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const stationLayer = stationLayerRef.current
    if (!stationLayer) return

    stationLayer.clearLayers()
    stations.forEach((station) => {
      const selected = station.id === selectedStation?.id
      const color = routeColors[station.routes[0]] ?? '#264653'
      const marker = L.circleMarker([station.latitude, station.longitude], {
        radius: selected ? 10 : 6,
        color: selected ? '#102a43' : '#ffffff',
        weight: selected ? 3 : 2,
        fillColor: color,
        fillOpacity: 1,
      })

      marker.bindTooltip(textLabel(station.name), {
        direction: 'top',
        offset: [0, -7],
      })
      marker.on('click', () => onStationSelectRef.current(station))
      marker.addTo(stationLayer)
    })
  }, [stations, selectedStation?.id])

  useEffect(() => {
    const map = mapRef.current
    const trainLayer = trainLayerRef.current
    if (!map || !trainLayer) return

    trainLayer.clearLayers()
    trains.forEach((train) => {
      const marker = L.marker([train.latitude, train.longitude], {
        zIndexOffset: 1000,
        title: `Run ${train.runNumber} to ${train.destination}; next stop ${train.nextStationName}`,
        alt: `Train ${train.runNumber} toward ${train.destination}`,
        icon: L.divIcon({
          className: 'train-marker-shell',
          html: `<span class="train-marker ${selectedRoute?.toLowerCase() ?? ''}" style="--heading:${Math.max(0, Math.min(359, train.heading))}deg">▲</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      })
      marker.bindTooltip(trainTooltip(train), { direction: 'top', offset: [0, -13] })
      marker.bindPopup(trainTooltip(train), { offset: [0, -13] })
      marker.addTo(trainLayer)
      marker.getElement()?.setAttribute(
        'aria-label',
        `Train ${train.runNumber} toward ${train.destination}; next stop ${train.nextStationName}`,
      )
    })

    if (selectedRoute && trains.length > 0 && fittedRouteRef.current !== selectedRoute) {
      fittedRouteRef.current = selectedRoute
      map.fitBounds(L.latLngBounds(trains.map((train) => [train.latitude, train.longitude])), {
        padding: [55, 55],
        maxZoom: 13,
      })
    }
    if (!selectedRoute) fittedRouteRef.current = null
  }, [trains, selectedRoute])

  useEffect(() => {
    if (!selectedStation || !mapRef.current) return
    mapRef.current.flyTo(
      [selectedStation.latitude, selectedStation.longitude],
      Math.max(mapRef.current.getZoom(), 13),
      { animate: true, duration: 0.55 },
    )
  }, [selectedStation?.id])

  useEffect(() => {
    if (locateRequest === 0 || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      mapRef.current?.flyTo([coords.latitude, coords.longitude], 14, {
        animate: true,
        duration: 0.65,
      })
    })
  }, [locateRequest])

  return <div ref={containerRef} className="map" aria-label="Map of Chicago rail stations" />
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
