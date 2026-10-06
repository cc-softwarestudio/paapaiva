/** Sheet parsing and geocoding helpers shared by the browser (sheetData.js) and scripts/build-geocache.js */

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

export function csvToObjects(text) {
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

export function rowToLocation(row) {
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
// Nominatim geocoding
// ---------------------------------------------------------------------------

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const CONTACT = 'miko.paajanen@gmail.com'

/** Minimum gap between Nominatim requests (their usage policy: max 1 req/s) */
export const GEOCODE_INTERVAL_MS = 1100

export const forwardKey = address => `fwd:${address}`
export const reverseKey = (lat, lng) => `rev:${lat},${lng}`

/** Resolves to { lat, lng }, or null if Nominatim has no match. Throws on network/HTTP errors. */
export async function forwardGeocode(address, fetchOptions) {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=fi&email=${CONTACT}`
  const res = await fetch(url, fetchOptions)
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const data = await res.json()
  if (!data?.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

/** Resolves to an address string, or null if Nominatim has no match. Throws on network/HTTP errors. */
export async function reverseGeocode(lat, lng, fetchOptions) {
  const url = `${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json&email=${CONTACT}`
  const res = await fetch(url, fetchOptions)
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const data = await res.json()
  if (!data || data.error) return null
  const a = data.address
  const parts = [
    a.road && a.house_number ? `${a.road} ${a.house_number}` : a.road,
    a.suburb || a.neighbourhood,
    a.city || a.town || a.village,
    a.postcode
  ].filter(Boolean)
  return parts.join(', ') || data.display_name
}
