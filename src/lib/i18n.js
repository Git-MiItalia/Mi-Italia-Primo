// i18next setup. There are deliberately NO translations in here — every string
// comes from the backend bundle (GET /auth/boutique/translations), matching the
// other Mi Italia frontends. Anything not in the bundle falls back to the
// English default passed as the second argument at the call site:
//   t('orders.detail.items', 'Items')
//
// Imported first in main.jsx so init runs before React renders.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { readCache, cachedLocale } from './i18nCache'

i18n.use(initReactI18next).init({
  // Start in the language the boutique last used. Hardcoding 'en' meant an
  // Italian boutique always booted in English and switched a moment later.
  lng: cachedLocale(),
  fallbackLng: 'en',
  nsSeparator: false, // keys are never namespaced here, and some (AI Studio aspect ratios) contain a literal ':'
  interpolation: {
    escapeValue: false, // React already escapes
  },
  useSuspense: false,
})

// Apply the cached bundle synchronously, before React renders, so the first
// paint already has real text instead of raw keys. Deliberately the same
// addResourceBundle call the runtime fetch makes (deep merge, overwrite) so a
// cached and a freshly-fetched bundle are applied identically.
const cached = readCache()
if (cached) {
  try {
    i18n.addResourceBundle(cached.locale, 'translation', cached.bundle, true, true)
  } catch {
    // Bad cache entry — ignore it; the runtime fetch will populate as before.
  }
}

export default i18n
