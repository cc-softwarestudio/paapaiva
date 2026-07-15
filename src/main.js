import { fetchLocations } from './sheetData.js'
import { initMap, loadMarkers, updateMarkers, highlightMarker, panToLocation, invalidateMapSize, setMapTheme } from './map.js'
import { initFilters, applyFilters, refreshFilterLabels } from './filters.js'
import { renderList, highlightListItem } from './locationList.js'
import { toggleLang, t, getTitle, getDescription, getTagLabel } from './i18n.js'
import themeFlyerUrl from './styles/theme-flyer.css?url'
import themeSimpleUrl from './styles/theme-simple.css?url'
import themeDefaultUrl from './styles/theme-default.css?url'
import themeRisoUrl from './styles/theme-riso.css?url'
import themeHanddrawnUrl from './styles/theme-handdrawn.css?url'
import themeDarkroomUrl from './styles/theme-darkroom.css?url'

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
// Theme picker
// ---------------------------------------------------------------------------

const THEME_URLS = {
  'theme-flyer': themeFlyerUrl,
  'theme-simple': themeSimpleUrl,
  'theme-default': themeDefaultUrl,
  'theme-riso': themeRisoUrl,
  'theme-handdrawn': themeHanddrawnUrl,
  'theme-darkroom': themeDarkroomUrl,
}

const themePicker = document.getElementById('theme-picker')

// Built dynamically (not left as a static <link> in index.html) because Vite
// bundles/hashes any stylesheet referenced from index.html, which would
// break href-swapping and drop the id in production builds.
const themeLink = document.createElement('link')
themeLink.rel = 'stylesheet'
themeLink.id = 'theme-link'
themeLink.href = THEME_URLS[themePicker.value]
document.head.appendChild(themeLink)

themePicker.addEventListener('change', () => {
  const value = themePicker.value
  themeLink.href = THEME_URLS[value]
  // Strip "theme-" prefix to look up the Leaflet tile layer
  setMapTheme(value.replace('theme-', ''))
})

// ---------------------------------------------------------------------------
// Map initialisation (happens immediately, before data loads)
// ---------------------------------------------------------------------------

initMap('map')

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

let currentSidebarLocation = null

function openSidebar(location) {
  currentSidebarLocation = location
  const sidebar = document.getElementById('location-sidebar')
  sidebar.querySelector('.sidebar-title').textContent = getTitle(location)
  sidebar.querySelector('.sidebar-address').textContent = location.address || ''
  sidebar.querySelector('.sidebar-time').textContent = `${location.time.start}–${location.time.end}`
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

// ---------------------------------------------------------------------------
// Language toggle
// ---------------------------------------------------------------------------

document.getElementById('lang-toggle').addEventListener('click', () => {
  toggleLang()
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

    document.addEventListener('langChanged', () => {
      document.getElementById('lang-toggle').textContent = t('langToggle')
      tabMapBtn.textContent = t('tabs.map')
      tabListBtn.textContent = t('tabs.list')
      //refreshFilterLabels('#time-filters', '#tag-filters')
      const filtered = applyFilters(locations)
      renderList(filtered, '#location-list', onSelectLocation)
      if (currentSidebarLocation) openSidebar(currentSidebarLocation)
    })
  })
  .catch(err => {
    showError(err.message)
  })
