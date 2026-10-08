// i18next setup. Every string comes from the backend bundle (GET
// /auth/boutique/translations), matching the other Mi Italia frontends. The one
// exception compiled in is src/i18n/new-keys.json — English for keys sir has
// not loaded yet (see below).
//
// Call sites are `t('orders.detail.items')` with no English second argument:
// the English lives in primo5.json alone, so it cannot drift from what the
// backend serves. What catches a key the bundle is missing is lib/i18nFallback.js,
// which loads primo5.json as the `en` resource — `fallbackLng` below then reads
// through to it key by key.
//
// The login pages are the exception. Their strings come from a separate backend
// bundle (login-translations) and are NOT in primo5.json, so Login, forgot/reset/
// set-password and StripeConnect still carry their English at the call site.
//
// Imported first in main.jsx so init runs before React renders.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { readCache, cachedLocale } from './i18nCache'
// Keys added since sir's last bundle load — English only, until the language
// pass. See the note below where they are applied.
import newKeys from '../i18n/new-keys.json'

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

/* New keys, built into the app.
 *
 * Keys added after sir's last bundle load exist nowhere on the backend, so
 * the only thing behind them was the lazy primo5.json fallback — which loads
 * after the first paint, so a slow load could show key names for a moment.
 * src/i18n/new-keys.json holds those keys (English only) and is applied here,
 * synchronously, before anything renders.
 *
 * overwrite:false, and applied before the cached and fetched bundles (both of
 * which overwrite), so the moment sir's bundle carries a key, his wins. On an
 * Italian page a key sir does not have yet reads through fallbackLng to this
 * English.
 *
 * Every NEW key goes in that file, not in primo5.json. At the language pass
 * it is merged into primo5.json, sent to sir, and emptied. */
i18n.addResourceBundle('en', 'translation', newKeys, true, false)

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
