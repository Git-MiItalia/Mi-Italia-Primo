import { create } from 'zustand'
import i18n, { hasBootBundle } from '../lib/i18n'
import { readCache, writeCache } from '../lib/i18nCache'

const BASE_URL = import.meta.env.VITE_API_URL

/* Do two bundles carry the same words?
 *
 * Runs only when the version hashes already match, so on the common unchanged
 * visit this is the one extra cost: two JSON.stringify passes over ~250 KB,
 * which is a millisecond or two, once per load. Worth it to stop a real
 * translation change being silently discarded.
 *
 * Key order could in principle differ between two responses carrying the same
 * words, which would make this report a difference where there is none. The
 * cost of that is one unnecessary re-apply — the same work the portal did on
 * every load before the cache existed — never a wrong or missing word.
 */
function sameBundle(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    // Unstringifiable (a cycle, or something exotic in the payload) — treat as
    // different and re-apply, which is the safe direction.
    return false
  }
}

const useLangStore = create((set) => ({
  lang: localStorage.getItem('primo_lang') || 'en',

  /* True once there are words to render with — either from the cache applied
     before the first render, or from the fetch below. Only ever false on a
     browser that has never loaded the bundle. Set on failure too: a portal
     that will not paint because one request failed is worse than an English
     one, and every t() call has an English default at the call site. */
  ready: hasBootBundle,

  setLang: async (lang) => {
    try {
      const token = localStorage.getItem('primo_token')
      const res   = await fetch(`${BASE_URL}/boutique/profile/locale`, {
        method: 'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ locale: lang }),
      })
      const data = await res.json()
      if (data.success) {
        // This endpoint returns the bundle as `translatedData` directly, with no
        // `.bundle` wrapper — reading `.bundle` gave undefined, so switching
        // language loaded no words and fell back to English until a refresh
        // pulled them from the other endpoint. Accept either shape.
        const payload = data.data.translatedData
        const bundle  = payload?.bundle ?? payload
        if (bundle && typeof bundle === 'object') {
          i18n.addResourceBundle(lang, 'translation', bundle, true, true)
          writeCache(lang, data.data.translationsVersion ?? null, bundle)
        }
      }
    } catch {
      // Deliberately silent: the language still switches below on whatever
      // words are already loaded, and every t() call has an English default.
      // A failed save of the preference is not worth blocking the switch.
    }

    i18n.changeLanguage(lang)
    localStorage.setItem('primo_lang', lang)
    set({ lang })
  },

  fetchTranslations: async () => {
    try {
      const token = localStorage.getItem('primo_token')
      const res   = await fetch(`${BASE_URL}/auth/boutique/translations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        const bundle  = data.data.translatedData  // ← no .bundle here (GET response)
        const locale  = data.data.preferred_locale || 'en'
        const version = data.data.translationsVersion ?? null

        const cached = readCache()
        /* Whether i18n already holds exactly these words, applied from cache
         * before the first render. When it does, calling changeLanguage would
         * emit languageChanged, re-render every view and re-run its
         * language-dependent effect — refetching all page data for no reason.
         *
         * The version hash alone is not enough to decide that. It is the
         * backend's hash, and a translation edit that does not move it left
         * the portal showing the previous words: we fetched the new bundle,
         * judged it unchanged, and dropped it. The words did arrive — but only
         * on the NEXT load, once the cache written just below was applied at
         * boot. From the outside that reads as "the change did not work", and
         * it cost us a round of looking for the fault in the wrong place.
         *
         * So the version is now only a cheap first test, and what actually
         * decides is whether the bundle that arrived differs from the one we
         * are holding. Sir has no way to know the portal depends on him
         * bumping a hash, and should not have to.
         */
        const sameVersion =
          !!cached && cached.locale === locale && !!version && cached.version === version
        const alreadyApplied =
          sameVersion && i18n.language === locale && sameBundle(cached.bundle, bundle)

        writeCache(locale, version, bundle)
        localStorage.setItem('primo_lang', locale)

        if (alreadyApplied) {
          set({ lang: locale, ready: true })
          return
        }

        i18n.addResourceBundle(locale, 'translation', bundle, true, true)
        i18n.changeLanguage(locale)
        set({ lang: locale, ready: true })
        return
      }
      // success:false — nothing to apply, but the app must still render.
      set({ ready: true })
    } catch (err) {
      console.error('fetchTranslations error:', err)
      set({ ready: true })
    }
  },

  // No-auth translations for pre-login pages (Login, forgot/reset/set password) and StripeConnect
  fetchLoginTranslations: async (locale) => {
    try {
      const loc = locale || localStorage.getItem('primo_lang') || 'en'
      const res  = await fetch(`${BASE_URL}/auth/boutique/login-translations?locale=${loc}`)
      const data = await res.json()
      if (data.success) {
        const bundle         = data.data.translatedData
        const resolvedLocale = data.data.preferred_locale || loc
        i18n.addResourceBundle(resolvedLocale, 'translation', bundle, true, true)
        i18n.changeLanguage(resolvedLocale)
        localStorage.setItem('primo_lang', resolvedLocale)
        set({ lang: resolvedLocale })
      }
    } catch (err) {
      console.error('fetchLoginTranslations error:', err)
    }
  },
}))

export default useLangStore