import { SHEET_CSV_URL } from './config.js'

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

function parseCSV(text) {
  const rows = []
  let current = [], field = '', inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { field += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { current.push(field); field = '' }
      else if (ch === '\r' && next === '\n') {
        current.push(field); rows.push(current); current = []; field = ''; i++
      } else if (ch === '\n') {
        current.push(field); rows.push(current); current = []; field = ''
      } else { field += ch }
    }
  }
  if (field || current.length) { current.push(field); rows.push(current) }
  return rows
}

function csvToObjects(text) {
  const rows = parseCSV(text)
  if (rows.length < 2) throw new Error('Sheet has no data rows')
  const headers = rows[0].map(h => h.trim())
  return rows.slice(1)
    .filter(row => row.some(cell => cell.trim()))
    .map(row => Object.fromEntries(headers.map((h, i) => [h, (row[i] ?? '').trim()])))
}

// ---------------------------------------------------------------------------
// Row → location
// ---------------------------------------------------------------------------

function rowToLocation(row) {
  const id = row.id || row.ID
  const title = row.title || row.Title
  const timeStart = row.time_start || row['time start']
  const timeEnd = row.time_end || row['time end']
  if (!id || !title || !timeStart || !timeEnd) return null

  const lat = row.lat ? parseFloat(row.lat) : null
  const lng = row.lng ? parseFloat(row.lng) : null
  return {
    id,
    title,
    title_en: row.title_en || null,
    address: row.address || null,
    lat: lat != null && !isNaN(lat) ? lat : null,
    lng: lng != null && !isNaN(lng) ? lng : null,
    time: { start: timeStart, end: timeEnd },
    description: row.description || '',
    description_en: row.description_en || null,
    tags: row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  }
}

// ---------------------------------------------------------------------------
// Nominatim geocoding  (results cached in localStorage)
// ---------------------------------------------------------------------------

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const CACHE_KEY = 'paapaiva-geocache-v1'

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') }
  catch { return {} }
}

function saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) }
  catch {}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function forwardGeocode(address) {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=fi&email=miko.paajanen@gmail.com`
  const res = await fetch(url)
  const data = await res.json()
  if (!data?.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json&email=miko.paajanen@gmail.com`
  const res = await fetch(url)
  const data = await res.json()
  if (!data || data.error) return null
  const a = data.address
  const parts = [
    a.road && a.house_number ? `${a.road} ${a.house_number}` : a.road,
    a.suburb || a.neighbourhood,
    a.city || a.town || a.village,
    a.postcode
  ].filter(Boolean)
  return { address: parts.join(', ') || data.display_name }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function fetchLocations(onStatus) {
  onStatus?.('Haetaan tapahtumatietoja... / Fetching event data...')

  const PUBLISH_INSTRUCTIONS =
    'Julkaise taulukko: Tiedosto → Jaa → Julkaise verkkoon → CSV → Julkaise\n' +
    'Publish the sheet: File → Share → Publish to web → CSV → Publish'

  let res
  try {
    res = await fetch(SHEET_CSV_URL)
  } catch {
    throw new Error(PUBLISH_INSTRUCTIONS)
  }
  if (!res.ok) throw new Error(`Sheet fetch failed (HTTP ${res.status})`)

  const text = await res.text()
  if (text.trimStart().startsWith('<')) {
    throw new Error(PUBLISH_INSTRUCTIONS)
  }

  const rows = csvToObjects(text)
  const locations = rows.map(rowToLocation).filter(Boolean)
  if (!locations.length) throw new Error('Sheet has no valid location rows')

  const cache = loadCache()
  let geocodeCount = 0

  for (const loc of locations) {
    const hasCoords = loc.lat != null && loc.lng != null
    const hasAddress = !!loc.address

    if (hasCoords && hasAddress) continue

    if (hasCoords && !hasAddress) {
      const key = `rev:${loc.lat},${loc.lng}`
      if (cache[key]) { loc.address = cache[key]; continue }
      onStatus?.(`Haetaan osoitetta... / Fetching address for ${loc.id}`)
      if (geocodeCount > 0) await sleep(1100)
      const geo = await reverseGeocode(loc.lat, loc.lng)
      if (geo) { loc.address = geo.address; cache[key] = geo.address }
      geocodeCount++
      continue
    }

    if (!hasCoords && hasAddress) {
      const key = `fwd:${loc.address}`
      if (cache[key]) { loc.lat = cache[key].lat; loc.lng = cache[key].lng; continue }
      onStatus?.(`Haetaan koordinaatteja... / Geocoding ${loc.address}`)
      if (geocodeCount > 0) await sleep(1100)
      const geo = await forwardGeocode(loc.address)
      if (geo) { loc.lat = geo.lat; loc.lng = geo.lng; cache[key] = { lat: geo.lat, lng: geo.lng } }
      geocodeCount++
    }
  }

  if (geocodeCount > 0) saveCache(cache)
  return locations
}
