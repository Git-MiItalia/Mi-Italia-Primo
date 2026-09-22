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
let booted = false
if (cached) {
  try {
    i18n.addResourceBundle(cached.locale, 'translation', cached.bundle, true, true)
    booted = true
  } catch {
    // Bad cache entry — ignore it; the runtime fetch will populate as before.
  }
}

/* Whether the first paint already has real words.
 *
 * False on a browser that has never loaded the bundle — a first login, a
 * cleared profile, a private window. There is nothing to show but key names
 * until the fetch returns, so Layout holds the first paint rather than
 * rendering "sidebar.dashboard" across the screen for a second or two. True
 * on every repeat visit, where the cached bundle makes that wait unnecessary
 * and the app renders immediately as before. */
export const hasBootBundle = booted

export default i18n
