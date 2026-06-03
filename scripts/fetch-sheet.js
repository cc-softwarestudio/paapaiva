/**
 * Fetches location data from a published Google Sheet (CSV export),
 * geocodes any entries missing coordinates via Nominatim,
 * and writes src/data/locations-resolved.json.
 *
 * Expected sheet columns (first row = headers):
 *   id, title, title_en, address, lat, lng,
 *   time_start, time_end, description, description_en, tags
 *
 * Required: id, title, time_start, time_end
 * Optional: title_en, address, lat, lng, description, description_en, tags
 *   - address only  → forward-geocoded
 *   - lat+lng only  → reverse-geocoded
 *   - both          → used as-is (coords take precedence)
 *
 * Tags cell: comma-separated values, e.g. "music, culture"
 *
 * Setup: copy .env.example to .env and set SHEET_URL
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const resolvedPath = join(root, 'src/data/locations-resolved.json')

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !key.startsWith('#')) process.env[key] = val
  }
}

loadEnv()

const SHEET_URL = process.env.SHEET_URL
if (!SHEET_URL) {
  console.error('Error: SHEET_URL is not set.')
  console.error('Copy .env.example to .env and set your Google Sheet URL.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

function parseCSV(text) {
  const rows = []
  let current = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

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

const REQUIRED = ['id', 'title', 'time_start', 'time_end']

function rowToLocation(row) {
  for (const col of REQUIRED) {
    if (!row[col]) throw new Error(`Row with id "${row.id || '?'}" is missing required column: ${col}`)
  }
  const lat = row.lat ? parseFloat(row.lat) : null
  const lng = row.lng ? parseFloat(row.lng) : null
  return {
    id: row.id,
    title: row.title,
    title_en: row.title_en || null,
    address: row.address || null,
    lat: lat != null && !isNaN(lat) ? lat : null,
    lng: lng != null && !isNaN(lng) ? lng : null,
    time: { start: row.time_start, end: row.time_end },
    description: row.description || '',
    description_en: row.description_en || null,
    tags: row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  }
}

// ---------------------------------------------------------------------------
// Nominatim geocoding
// ---------------------------------------------------------------------------

const USER_AGENT = 'paapaiva-event-map/1.0 (miko.paajanen@gmail.com)'
const NOMINATIM = 'https://nominatim.openstreetmap.org'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function forwardGeocode(address) {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=fi`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  const data = await res.json()
  if (!data?.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
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

async function geocode(location, existing) {
  if (existing?._geocodeSource) return existing

  const result = { ...location }

  if (location.lat != null && location.lng != null) {
    if (!location.address) {
      process.stdout.write(`  reverse ${location.id}... `)
      const geo = await reverseGeocode(location.lat, location.lng)
      result.address = geo?.address ?? null
      result._geocodeSource = 'reverse'
      if (!geo) { result._geocodeFailed = true; console.log('FAILED') }
      else console.log(`OK (${result.address})`)
      await sleep(1100)
    } else {
      result._geocodeSource = 'provided'
    }
  } else if (location.address) {
    process.stdout.write(`  forward ${location.id}: "${location.address}"... `)
    const geo = await forwardGeocode(location.address)
    if (geo) {
      result.lat = geo.lat; result.lng = geo.lng
      result._geocodeSource = 'forward'
      console.log(`OK (${geo.lat}, ${geo.lng})`)
    } else {
      result._geocodeSource = 'forward'; result._geocodeFailed = true
      console.log('FAILED — no results')
    }
    await sleep(1100)
  } else {
    console.log(`  WARN  ${location.id}: no address or coordinates`)
    result._geocodeSource = 'none'; result._geocodeFailed = true
  }

  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Fetching sheet: ${SHEET_URL}\n`)
  const res = await fetch(SHEET_URL, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching sheet`)
  const csv = await res.text()

  const rows = csvToObjects(csv)
  console.log(`Parsed ${rows.length} rows from sheet\n`)

  const locations = rows.map(rowToLocation)

  let existing = {}
  if (existsSync(resolvedPath)) {
    JSON.parse(readFileSync(resolvedPath, 'utf8')).forEach(l => { existing[l.id] = l })
  }

  const resolved = []
  for (const loc of locations) {
    const cached = existing[loc.id]
    const needsGeocode = cached?._geocodeSource &&
      cached.lat === loc.lat && cached.lng === loc.lng &&
      cached.address === loc.address

    if (needsGeocode) {
      console.log(`  skip  ${loc.id} (geocoding cached)`)
      resolved.push({ ...loc, ...pick(cached, ['address', 'lat', 'lng', '_geocodeSource', '_geocodeFailed']) })
    } else {
      resolved.push(await geocode(loc, null))
    }
  }

  writeFileSync(resolvedPath, JSON.stringify(resolved, null, 2))
  const failed = resolved.filter(l => l._geocodeFailed)
  console.log(`\nDone. ${resolved.length} locations written to locations-resolved.json`)
  if (failed.length) console.warn(`Warning: ${failed.length} failed geocoding: ${failed.map(l => l.id).join(', ')}`)
}

function pick(obj, keys) {
  return Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]))
}

main().catch(err => { console.error('Error:', err.message); process.exit(1) })
