import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const locationsPath = join(__dirname, '../src/data/locations.json')
const resolvedPath = join(__dirname, '../src/data/locations-resolved.json')

const USER_AGENT = 'paapaiva-event-map/1.0 (miko.paajanen@gmail.com)'
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function forwardGeocode(address) {
  const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=fi`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  const data = await res.json()
  if (!data || data.length === 0) return null
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name
  }
}

async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json`
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

async function main() {
  const locations = JSON.parse(readFileSync(locationsPath, 'utf8'))

  let existing = {}
  if (existsSync(resolvedPath)) {
    const existingData = JSON.parse(readFileSync(resolvedPath, 'utf8'))
    existingData.forEach(loc => { existing[loc.id] = loc })
  }

  const resolved = []

  for (const loc of locations) {
    if (existing[loc.id] && existing[loc.id]._geocodeSource) {
      console.log(`  skip  ${loc.id} (already resolved as "${existing[loc.id]._geocodeSource}")`)
      resolved.push(existing[loc.id])
      continue
    }

    const result = { ...loc }

    if (loc.lat != null && loc.lng != null) {
      if (!loc.address) {
        process.stdout.write(`  reverse ${loc.id}... `)
        const geo = await reverseGeocode(loc.lat, loc.lng)
        if (geo) {
          result.address = geo.address
          result._geocodeSource = 'reverse'
          console.log(`OK (${result.address})`)
        } else {
          result._geocodeSource = 'reverse'
          result._geocodeFailed = true
          console.log('FAILED')
        }
        await sleep(1100)
      } else {
        result._geocodeSource = 'provided'
        console.log(`  skip  ${loc.id} (both address and coords provided)`)
      }
    } else if (loc.address) {
      process.stdout.write(`  forward ${loc.id}: "${loc.address}"... `)
      const geo = await forwardGeocode(loc.address)
      if (geo) {
        result.lat = geo.lat
        result.lng = geo.lng
        result._geocodeSource = 'forward'
        console.log(`OK (${geo.lat}, ${geo.lng})`)
      } else {
        result._geocodeSource = 'forward'
        result._geocodeFailed = true
        console.log('FAILED — no results')
      }
      await sleep(1100)
    } else {
      console.log(`  WARN  ${loc.id}: no address or coordinates`)
      result._geocodeSource = 'none'
      result._geocodeFailed = true
    }

    resolved.push(result)
  }

  writeFileSync(resolvedPath, JSON.stringify(resolved, null, 2))
  const failed = resolved.filter(l => l._geocodeFailed)
  console.log(`\nDone. ${resolved.length} locations written.`)
  if (failed.length > 0) {
    console.warn(`Warning: ${failed.length} location(s) failed geocoding: ${failed.map(l => l.id).join(', ')}`)
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
