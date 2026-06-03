export const translations = {
  fi: {
    filters: {
      all: 'Kaikki',
      current: 'Nyt',
      upcoming: 'Tulossa',
      day: 'Päivä 10–17',
      evening: 'Ilta 17–21',
      lateNight: 'Myöhäisilta 21–'
    },
    tags: {
      music: 'musiikki',
      art: 'taide',
      food: 'ruoka',
      culture: 'kulttuuri',
      outdoor: 'ulkoilma',
      sports: 'urheilu',
      market: 'tori',
      family: 'perhe'
    },
    list: {
      noResults: 'Ei tuloksia valituilla suodattimilla.'
    },
    langToggle: 'EN'
  },
  en: {
    filters: {
      all: 'All',
      current: 'Now',
      upcoming: 'Upcoming',
      day: 'Day 10–17',
      evening: 'Evening 17–21',
      lateNight: 'Late night 21–'
    },
    tags: {
      music: 'music',
      art: 'art',
      food: 'food',
      culture: 'culture',
      outdoor: 'outdoor',
      sports: 'sports',
      market: 'market',
      family: 'family'
    },
    list: {
      noResults: 'No results for the selected filters.'
    },
    langToggle: 'FI'
  }
}

export let currentLang = 'fi'

export function setLang(lang) {
  currentLang = lang
  document.documentElement.lang = lang
  document.dispatchEvent(new CustomEvent('langChanged'))
}

export function toggleLang() {
  setLang(currentLang === 'fi' ? 'en' : 'fi')
}

export function t(path) {
  const keys = path.split('.')
  let val = translations[currentLang]
  for (const k of keys) {
    val = val?.[k]
  }
  return val ?? path
}

export function getTitle(location) {
  return currentLang === 'en' && location.title_en ? location.title_en : location.title
}

export function getDescription(location) {
  return currentLang === 'en' && location.description_en ? location.description_en : location.description
}

export function getTagLabel(tag) {
  return translations[currentLang]?.tags?.[tag] ?? tag
}
