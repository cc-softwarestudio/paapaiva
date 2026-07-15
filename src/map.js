import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { MAP_TILE_LAYERS } from './config.js'

let map
let tileLayer
let clusterGroup
let markersById = {}
let activeMarkerId = null
let onSelectCallback = null

export function initMap(containerId) {
  map = L.map(containerId, {
    center: [60.197994, 24.932019],
    zoom: 11,
    minZoom: 10,
    maxZoom: 18,
    maxBounds: [
      [59.85, 24.4],
      [60.45, 25.5]
    ],
    maxBoundsViscosity: 0.8
  })

  const theme = document.documentElement.dataset.theme || 'default'
  const tiles = MAP_TILE_LAYERS[theme] ?? MAP_TILE_LAYERS.default
  tileLayer = L.tileLayer(tiles.url, {
    attribution: tiles.attribution,
    subdomains: tiles.subdomains,
    maxZoom: tiles.maxZoom,
  }).addTo(map)

  return map
}

export function setMapTheme(themeName) {
  if (!map) return
  const tiles = MAP_TILE_LAYERS[themeName] ?? MAP_TILE_LAYERS.default
  if (tileLayer) map.removeLayer(tileLayer)
  tileLayer = L.tileLayer(tiles.url, {
    attribution: tiles.attribution,
    subdomains: tiles.subdomains,
    maxZoom: tiles.maxZoom,
  }).addTo(map)
}

function createMarkerIcon(isActive) {
  return L.divIcon({
    className: `marker-icon${isActive ? ' marker--active' : ''}`,
    html: '<div class="marker-dot"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8]
  })
}

function createClusterIcon(cluster) {
  const count = cluster.getChildCount()
  let sizeCls
  if (count < 10) sizeCls = 'cluster-sm'
  else if (count < 50) sizeCls = 'cluster-md'
  else sizeCls = 'cluster-lg'

  const size = sizeCls === 'cluster-sm' ? 28 : sizeCls === 'cluster-md' ? 36 : 48
  return L.divIcon({
    className: `cluster-icon ${sizeCls}`,
    html: `<div class="cluster-circle">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  })
}

function buildMarkers(locations) {
  markersById = {}
  const group = L.markerClusterGroup({
    maxClusterRadius: 35,
    disableClusteringAtZoom: 16,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    iconCreateFunction: createClusterIcon
  })

  locations.forEach(location => {
    if (location.lat == null || location.lng == null || location._geocodeFailed) return
    const isActive = location.id === activeMarkerId
    const marker = L.marker([location.lat, location.lng], {
      icon: createMarkerIcon(isActive)
    })
    marker.locationData = location
    marker.on('click', () => onSelectCallback?.(location))
    group.addLayer(marker)
    markersById[location.id] = marker
  })

  return group
}

export function loadMarkers(locations, onSelectLocation) {
  onSelectCallback = onSelectLocation
  clusterGroup = buildMarkers(locations)
  map.addLayer(clusterGroup)
}

export function updateMarkers(filteredLocations) {
  if (clusterGroup) map.removeLayer(clusterGroup)
  clusterGroup = buildMarkers(filteredLocations)
  map.addLayer(clusterGroup)
}

export function highlightMarker(id) {
  if (activeMarkerId && markersById[activeMarkerId]) {
    markersById[activeMarkerId].setIcon(createMarkerIcon(false))
  }
  activeMarkerId = id
  if (markersById[id]) {
    markersById[id].setIcon(createMarkerIcon(true))
  }
}

export function invalidateMapSize() {
  if (map) map.invalidateSize()
}

export function panToLocation(lat, lng) {
  const currentZoom = map.getZoom()
  map.setView([lat, lng], Math.max(currentZoom, 15), { animate: true })
}
