/**
 * Pre-geocodes the Google Sheet so visitors' browsers don't have to.
 *
 * Fetches the published sheet, looks up every missing address / coordinate
 * pair via Nominatim and writes src/data/geocache.json, which is bundled with
 * the app. Entries already in the file are reused, so re-runs only query
 * Nominatim for new or changed rows.
 *
 * Run after adding or moving locations in the sheet, then commit and deploy.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { SHEET_CSV_URL } from '../src/config.js'
import {
  csvToObjects, rowToLocation, forwardGeocode, reverseGeocode,
  forwardKey, reverseKey, GEOCODE_INTERVAL_MS
} from '../src/sheetCore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cachePath = join(__dirname, '../src/data/geocache.json')

const FETCH_OPTIONS = {
  headers: { 'User-Agent': 'paapaiva-event-map/1.0 (miko.paajanen@gmail.com)' }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const res = await fetch(SHEET_CSV_URL, FETCH_OPTIONS)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching sheet`)
  const locations = csvToObjects(await res.text()).map(rowToLocation).filter(Boolean)
  console.log(`Parsed ${locations.length} locations from sheet\n`)

  const previous = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}
  const cache = {}
  const failed = []
  let requests = 0

  for (const loc of locations) {
    const hasCoords = loc.lat != null && loc.lng != null
    if (hasCoords === !!loc.address) {
      if (!hasCoords) console.log(`  WARN     ${loc.id}: no address or coordinates`)
      continue
    }

    const key = hasCoords ? reverseKey(loc.lat, loc.lng) : forwardKey(loc.address)
    if (key in cache) continue
    if (previous[key]) {
      cache[key] = previous[key]
      console.log(`  cached   ${loc.id}`)
      continue
    }

    if (requests++ > 0) await sleep(GEOCODE_INTERVAL_MS)
    const result = hasCoords
      ? await reverseGeocode(loc.lat, loc.lng, FETCH_OPTIONS)
      : await forwardGeocode(loc.address, FETCH_OPTIONS)

    if (result) {
      cache[key] = result
      console.log(`  ${hasCoords ? 'reverse' : 'forward'}  ${loc.id}: ${JSON.stringify(result)}`)
    } else {
      failed.push(loc.id)
      console.log(`  FAILED   ${loc.id}: no match for ${key}`)
    }
  }

  writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n')
  console.log(`\nDone. ${Object.keys(cache).length} entries written to src/data/geocache.json (${requests} Nominatim requests)`)
  if (failed.length) console.warn(`Warning: ${failed.length} failed geocoding: ${failed.join(', ')}`)
}

main().catch(err => { console.error('Error:', err.message); process.exit(1) })
