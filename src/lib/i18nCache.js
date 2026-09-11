// Translation bundle cache. Paired with lib/i18n.js.
//
// Translations are fetched from /auth/boutique/translations at runtime, from an
// effect in Layout — so the app always painted once before any text existed,
// showing raw keys, and the changeLanguage() that followed re-ran every view's
// language-dependent effect, fetching all page data a second time.
//
// Caching the bundle lets i18n start with real text already loaded, so neither
// happens on a repeat visit. The response carries a `translationsVersion` hash,
// which is what tells us whether a re-fetch actually changed anything.
//
// Every access is wrapped: if storage is unavailable (private mode, blocked
// site data) or the entry is corrupt, these return null / do nothing and the
// app behaves exactly as it did before caching existed.

const CACHE_KEY = 'primo_i18n_cache'
const LANG_KEY  = 'primo_lang'

/** Locale to start i18n in — the one whose bundle we cached, if any. */
export function cachedLocale() {
  try {
    return localStorage.getItem(LANG_KEY) || 'en'
  } catch {
    return 'en'
  }
}

/** @returns {{locale: string, version: string|null, bundle: object}|null} */
export function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Guard against a half-written or older-shaped entry.
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.locale || !parsed.bundle || typeof parsed.bundle !== 'object') return null
    return { locale: parsed.locale, version: parsed.version ?? null, bundle: parsed.bundle }
  } catch {
    return null
  }
}

export function writeCache(locale, version, bundle) {
  try {
    if (!locale || !bundle || typeof bundle !== 'object') return
    localStorage.setItem(CACHE_KEY, JSON.stringify({ locale, version: version ?? null, bundle }))
  } catch {
    // Quota exceeded or storage blocked — caching is an optimisation, so skip it.
  }
}
