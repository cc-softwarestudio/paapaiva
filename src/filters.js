import { t, getTagLabel } from './i18n.js'

export const filterState = {
  activeTimeFilter: 'all',
  activeTags: new Set()
}

const TIME_WINDOWS = {
  day: { start: '10:00', end: '17:00' },
  evening: { start: '17:00', end: '21:00' },
  lateNight: { start: '21:00', end: '00:00' }
}

const TIME_FILTER_KEYS = ['all', 'current', 'upcoming', 'day', 'evening', 'lateNight']

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function endToMinutes(t) {
  const m = timeToMinutes(t)
  return m === 0 ? 1440 : m
}

function nowInMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function windowOverlap(locStart, locEnd, winStart, winEnd) {
  return locStart < winEnd && locEnd > winStart
}

export function locationMatchesTime(loc) {
  const filter = filterState.activeTimeFilter
  if (filter === 'all') return true

  const locStart = timeToMinutes(loc.time.start)
  const locEnd = endToMinutes(loc.time.end)
  const now = nowInMinutes()

  if (filter === 'current') return now >= locStart && now < locEnd
  if (filter === 'upcoming') return locStart > now

  const win = TIME_WINDOWS[filter]
  if (!win) return true
  return windowOverlap(locStart, locEnd, timeToMinutes(win.start), endToMinutes(win.end))
}

export function locationMatchesTags(loc) {
  if (filterState.activeTags.size === 0) return true
  return loc.tags.some(tag => filterState.activeTags.has(tag))
}

export function applyFilters(locations) {
  return locations.filter(loc => locationMatchesTime(loc) && locationMatchesTags(loc))
}

let allLocations = []

export function initFilters(locations, timeContainerId, tagContainerId) {
  allLocations = locations
  const timeContainer = document.querySelector(timeContainerId)
  const tagContainer = document.querySelector(tagContainerId)
  timeContainer.innerHTML = ''
  tagContainer.innerHTML = ''

  TIME_FILTER_KEYS.forEach(key => {
    const btn = document.createElement('button')
    btn.textContent = t(`filters.${key}`)
    btn.className = `time-btn${filterState.activeTimeFilter === key ? ' time-btn--active' : ''}`
    btn.dataset.timeFilter = key
    btn.dataset.i18n = `filters.${key}`
    btn.addEventListener('click', () => {
      filterState.activeTimeFilter = key
      timeContainer.querySelectorAll('.time-btn').forEach(b => b.classList.remove('time-btn--active'))
      btn.classList.add('time-btn--active')
      document.dispatchEvent(new CustomEvent('filtersChanged'))
    })
    timeContainer.appendChild(btn)
  })

  const allTags = [...new Set(locations.flatMap(loc => loc.tags))].sort()
  allTags.forEach(tag => {
    const btn = document.createElement('button')
    btn.textContent = getTagLabel(tag)
    btn.className = `tag-btn${filterState.activeTags.has(tag) ? ' tag-btn--active' : ''}`
    btn.dataset.tag = tag
    btn.addEventListener('click', () => {
      if (filterState.activeTags.has(tag)) {
        filterState.activeTags.delete(tag)
        btn.classList.remove('tag-btn--active')
      } else {
        filterState.activeTags.add(tag)
        btn.classList.add('tag-btn--active')
      }
      document.dispatchEvent(new CustomEvent('filtersChanged'))
    })
    tagContainer.appendChild(btn)
  })
}

export function refreshFilterLabels(timeContainerId, tagContainerId) {
  document.querySelectorAll(`${timeContainerId} [data-i18n]`).forEach(el => {
    el.textContent = t(el.dataset.i18n)
  })
  document.querySelectorAll(`${tagContainerId} [data-tag]`).forEach(el => {
    el.textContent = getTagLabel(el.dataset.tag)
  })
}
