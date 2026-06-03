import { getTitle, getTagLabel, t } from './i18n.js'

let activeId = null
let lastOnSelect = null
let lastContainerId = null

export function renderList(locations, containerId, onSelectLocation) {
  lastOnSelect = onSelectLocation
  lastContainerId = containerId
  const container = document.querySelector(containerId)
  container.innerHTML = ''

  if (locations.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'location-list-empty'
    empty.textContent = t('list.noResults')
    container.appendChild(empty)
    return
  }

  locations.forEach(loc => {
    const li = document.createElement('li')
    li.className = `location-item${loc.id === activeId ? ' location-item--active' : ''}`
    li.dataset.id = loc.id

    const title = document.createElement('span')
    title.className = 'location-item__title'
    title.textContent = getTitle(loc)

    const time = document.createElement('span')
    time.className = 'location-item__time'
    time.textContent = `${loc.time.start}–${loc.time.end}`

    const tags = document.createElement('div')
    tags.className = 'location-item__tags'
    loc.tags.slice(0, 2).forEach(tag => {
      const span = document.createElement('span')
      span.className = 'tag'
      span.textContent = getTagLabel(tag)
      tags.appendChild(span)
    })

    li.appendChild(title)
    li.appendChild(time)
    li.appendChild(tags)
    li.addEventListener('click', () => onSelectLocation(loc))
    container.appendChild(li)
  })
}

export function highlightListItem(id) {
  activeId = id
  document.querySelectorAll('.location-item').forEach(el => {
    el.classList.toggle('location-item--active', el.dataset.id === id)
  })
  const active = document.querySelector(`.location-item[data-id="${id}"]`)
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
