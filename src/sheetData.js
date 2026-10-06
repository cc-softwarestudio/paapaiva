import { SHEET_CSV_URL } from './config.js'
import {
  csvToObjects, rowToLocation, forwardGeocode, reverseGeocode,
  forwardKey, reverseKey, GEOCODE_INTERVAL_MS
} from './sheetCore.js'
import seedCache from './data/geocache.json'

// ---------------------------------------------------------------------------
// Geocode cache
//
// Shipped seed (data/geocache.json, built by `npm run build-geocache`) merged
// with this visitor's localStorage. Only rows missing from both hit Nominatim.
// Values: address string (rev:), { lat, lng } (fwd:), or false = no match.
// ---------------------------------------------------------------------------

const CACHE_KEY = 'paapaiva-geocache-v2'

function loadLocalCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') }
  catch { return {} }
}

function saveLocalCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) }
  catch {}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/** Fills in what the cache knows; returns true if the location still needs a Nominatim lookup. */
function applyCache(loc, cache) {
  const hasCoords = loc.lat != null && loc.lng != null
  if (hasCoords && !loc.address) {
    const hit = cache[reverseKey(loc.lat, loc.lng)]
    if (hit) loc.address = hit
    return hit === undefined
  }
  if (!hasCoords && loc.address) {
    const hit = cache[forwardKey(loc.address)]
    if (hit) { loc.lat = hit.lat; loc.lng = hit.lng }
    return hit === undefined
  }
  return false
}

/** Geocodes uncached locations one at a time, after the page is already usable. */
async function geocodeInBackground(pending, onResolved) {
  const local = loadLocalCache()
  for (const [i, loc] of pending.entries()) {
    if (i > 0) await sleep(GEOCODE_INTERVAL_MS)
    try {
      if (loc.lat != null) {
        const address = await reverseGeocode(loc.lat, loc.lng)
        local[reverseKey(loc.lat, loc.lng)] = address ?? false
        if (address) loc.address = address
      } else {
        const address = loc.address
        const geo = await forwardGeocode(address)
        local[forwardKey(address)] = geo ?? false
        if (geo) { loc.lat = geo.lat; loc.lng = geo.lng }
      }
      saveLocalCache(local)
      onResolved?.(loc)
    } catch {
      // Network / rate-limit error: leave uncached so the next page load retries
    }
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Resolves as soon as the sheet is parsed. Locations whose address/coordinates
 * are not cached are geocoded afterwards; onResolved(location) fires for each
 * one once its fields have been filled in.
 */
export async function fetchLocations(onStatus, onResolved) {
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

  const cache = { ...seedCache, ...loadLocalCache() }
  const pending = locations.filter(loc => applyCache(loc, cache))
  if (pending.length) geocodeInBackground(pending, onResolved)

  return locations
}
