import locations from './data/locations-resolved.json'
import { initMap, loadMarkers, updateMarkers, highlightMarker, panToLocation } from './map.js'
import { initFilters, applyFilters, refreshFilterLabels } from './filters.js'
import { renderList, highlightListItem } from './locationList.js'
import { toggleLang, t, getTitle, getDescription, getTagLabel } from './i18n.js'

initMap('map')

let currentSidebarLocation = null

function openSidebar(location) {
  currentSidebarLocation = location
  const sidebar = document.getElementById('location-sidebar')
  sidebar.querySelector('.sidebar-title').textContent = getTitle(location)
  sidebar.querySelector('.sidebar-address').textContent = location.address || ''
  sidebar.querySelector('.sidebar-time').textContent = `${location.time.start}–${location.time.end}`
  sidebar.querySelector('.sidebar-description').textContent = getDescription(location)

  const tagsEl = sidebar.querySelector('.sidebar-tags')
  tagsEl.innerHTML = ''
  location.tags.forEach(tag => {
    const span = document.createElement('span')
    span.className = 'tag'
    span.textContent = getTagLabel(tag)
    tagsEl.appendChild(span)
  })

  sidebar.classList.remove('sidebar--hidden')
}

function closeSidebar() {
  currentSidebarLocation = null
  document.getElementById('location-sidebar').classList.add('sidebar--hidden')
}

function onSelectLocation(location) {
  openSidebar(location)
  highlightMarker(location.id)
  highlightListItem(location.id)
  if (location.lat != null && location.lng != null) {
    panToLocation(location.lat, location.lng)
  }
}

loadMarkers(locations, onSelectLocation)
initFilters(locations, '#time-filters', '#tag-filters')
renderList(locations, '#location-list', onSelectLocation)

document.getElementById('sidebar-close').addEventListener('click', closeSidebar)

document.getElementById('lang-toggle').addEventListener('click', () => {
  toggleLang()
})

document.addEventListener('filtersChanged', () => {
  const filtered = applyFilters(locations)
  updateMarkers(filtered)
  renderList(filtered, '#location-list', onSelectLocation)
})

document.addEventListener('langChanged', () => {
  document.getElementById('lang-toggle').textContent = t('langToggle')
  refreshFilterLabels('#time-filters', '#tag-filters')
  const filtered = applyFilters(locations)
  renderList(filtered, '#location-list', onSelectLocation)
  if (currentSidebarLocation) openSidebar(currentSidebarLocation)
})
