import { fetchLocations } from './sheetData.js'
import { initMap, loadMarkers, updateMarkers, highlightMarker, panToLocation, invalidateMapSize } from './map.js'
import { initFilters, applyFilters, refreshFilterLabels } from './filters.js'
import { renderList, highlightListItem } from './locationList.js'
import { getTitle, getDescription, getTagLabel, t } from './i18n.js'
import themeSimpleUrl from './styles/theme-simple.css?url'

// ---------------------------------------------------------------------------
// Loading overlay
// ---------------------------------------------------------------------------

const overlay = document.getElementById('loading-overlay')
const statusEl = document.getElementById('loading-status')

function setStatus(msg) {
  statusEl.textContent = msg
}

function hideOverlay() {
  overlay.classList.add('hidden')
  setTimeout(() => { overlay.style.display = 'none' }, 350)
}

function showError(msg) {
  statusEl.textContent = ''
  const err = document.createElement('p')
  err.className = 'loading-error'
  err.textContent = msg
  overlay.querySelector('.loading-spinner')?.remove()
  overlay.appendChild(err)
}

// ---------------------------------------------------------------------------
// Mobile tab switching
// ---------------------------------------------------------------------------

const tabMapBtn = document.getElementById('tab-map')
const tabListBtn = document.getElementById('tab-list')
const contentArea = document.getElementById('content-area')

function switchToMapTab() {
  tabMapBtn.classList.add('mobile-tab--active')
  tabListBtn.classList.remove('mobile-tab--active')
  contentArea.classList.remove('show-list')
  requestAnimationFrame(() => invalidateMapSize())
}

function switchToListTab() {
  tabListBtn.classList.add('mobile-tab--active')
  tabMapBtn.classList.remove('mobile-tab--active')
  contentArea.classList.add('show-list')
}

tabMapBtn.addEventListener('click', switchToMapTab)
tabListBtn.addEventListener('click', switchToListTab)

// ---------------------------------------------------------------------------
// Theme (simple — other theme-*.css files kept for manual switching)
// ---------------------------------------------------------------------------

const themeLink = document.createElement('link')
themeLink.rel = 'stylesheet'
themeLink.id = 'theme-link'
themeLink.href = themeSimpleUrl
document.head.appendChild(themeLink)

// ---------------------------------------------------------------------------
// Map initialisation (happens immediately, before data loads)
// ---------------------------------------------------------------------------

initMap('map')

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

let currentSidebarLocation = null

function buildGoogleMapsUrl(location) {
  const destination = location.lat != null && location.lng != null
    ? `${location.lat},${location.lng}`
    : location.address || getTitle(location)

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`
}

function refreshSidebarActions(location) {
  const sidebar = document.getElementById('location-sidebar')
  const mapsLink = sidebar.querySelector('.sidebar-action--maps')

  mapsLink.href = buildGoogleMapsUrl(location)
  mapsLink.textContent = t('sidebar.directions')
  mapsLink.setAttribute('aria-label', t('sidebar.directions'))
}

function openSidebar(location) {
  currentSidebarLocation = location
  const sidebar = document.getElementById('location-sidebar')
  sidebar.querySelector('.sidebar-title').textContent = getTitle(location)
  sidebar.querySelector('.sidebar-address').textContent = location.address || ''
  sidebar.querySelector('.sidebar-time').textContent = `${location.time.start}–${location.time.end}`
  refreshSidebarActions(location)
  sidebar.querySelector('.sidebar-description').textContent = getDescription(location)

//   const tagsEl = sidebar.querySelector('.sidebar-tags')
//   tagsEl.innerHTML = ''
//   location.tags.forEach(tag => {
//     const span = document.createElement('span')
//     span.className = 'tag'
//     span.textContent = getTagLabel(tag)
//     tagsEl.appendChild(span)
//   })

  sidebar.classList.remove('sidebar--hidden')
}

function closeSidebar() {
  currentSidebarLocation = null
  document.getElementById('location-sidebar').classList.add('sidebar--hidden')
}

document.getElementById('sidebar-close').addEventListener('click', closeSidebar)
document.addEventListener('langChanged', () => {
  if (currentSidebarLocation) openSidebar(currentSidebarLocation)
})

// ---------------------------------------------------------------------------
// Data load
// ---------------------------------------------------------------------------

fetchLocations(setStatus)
  .then(locations => {
    hideOverlay()

    function onSelectLocation(location) {
      if (contentArea.classList.contains('show-list')) switchToMapTab()
      openSidebar(location)
      highlightMarker(location.id)
      highlightListItem(location.id)
      if (location.lat != null && location.lng != null) {
        panToLocation(location.lat, location.lng)
      }
    }

    loadMarkers(locations, onSelectLocation)
    //initFilters(locations, '#time-filters', '#tag-filters')
    renderList(locations, '#location-list', onSelectLocation)

    document.addEventListener('filtersChanged', () => {
      const filtered = applyFilters(locations)
      updateMarkers(filtered)
      renderList(filtered, '#location-list', onSelectLocation)
    })
  })
  .catch(err => {
    showError(err.message)
  })
