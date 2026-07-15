export const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTG-gyAtDv8GTTfDFnfHXMRtmaxMoiwOqejTuCOrfcz9Unk7lqcDqck5sVpDV6gKV9C4GSFtr4Qq5jp/pub?gid=0&single=true&output=csv'

const TILE_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'

/** Per-theme basemaps — set matching data-theme on <html> in index.html */
export const MAP_TILE_LAYERS = {
  default: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: TILE_ATTRIBUTION,
    subdomains: 'abcd',
    maxZoom: 19,
  },
  flyer: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: TILE_ATTRIBUTION,
    subdomains: 'abcd',
    maxZoom: 20,
  },
  simple: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: TILE_ATTRIBUTION,
    subdomains: 'abcd',
    maxZoom: 20,
  },
}
