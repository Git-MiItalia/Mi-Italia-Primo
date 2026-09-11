import { create } from 'zustand'
import i18n from '../lib/i18n'
import { readCache, writeCache } from '../lib/i18nCache'

const BASE_URL = import.meta.env.VITE_API_URL

const useLangStore = create((set) => ({
  lang: localStorage.getItem('primo_lang') || 'en',

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
    } catch {}

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
        // Same locale and same version hash means i18n already has this exact
        // bundle, applied from cache before the first render. Calling
        // changeLanguage anyway would emit languageChanged, re-render every
        // view and re-run its language-dependent effect — refetching all page
        // data for no reason. So on an unchanged visit, do nothing.
        const alreadyApplied =
          !!cached && cached.locale === locale && !!version && cached.version === version && i18n.language === locale

        writeCache(locale, version, bundle)
        localStorage.setItem('primo_lang', locale)

        if (alreadyApplied) {
          set({ lang: locale })
          return
        }

        i18n.addResourceBundle(locale, 'translation', bundle, true, true)
        i18n.changeLanguage(locale)
        set({ lang: locale })
      }
    } catch (err) {
      console.error('fetchTranslations error:', err)
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