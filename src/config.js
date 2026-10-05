export const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTG-gyAtDv8GTTfDFnfHXMRtmaxMoiwOqejTuCOrfcz9Unk7lqcDqck5sVpDV6gKV9C4GSFtr4Qq5jp/pub?gid=0&single=true&output=csv'

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const HOT_ATTRIBUTION = `${OSM_ATTRIBUTION}, tiles by <a href="https://www.hotosm.org/">HOT</a>, hosted by <a href="https://openstreetmap.fr/">OSM France</a>`

/** Per-theme basemaps (key-free OSM tiles) — set matching data-theme on <html> in index.html */
export const MAP_TILE_LAYERS = {
  default: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
    subdomains: 'abc',
    maxZoom: 19,
  },
  flyer: {
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: HOT_ATTRIBUTION,
    subdomains: 'abc',
    maxZoom: 19,
  },
  simple: {
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: HOT_ATTRIBUTION,
    subdomains: 'abc',
    maxZoom: 19,
  },
}
