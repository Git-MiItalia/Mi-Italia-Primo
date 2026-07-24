import { create } from 'zustand'
import i18n from '../i18n'

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
        const bundle = data.data.translatedData.bundle  // ← note .bundle here
        i18n.addResourceBundle(lang, 'translation', bundle, true, true)
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
        const bundle = data.data.translatedData  // ← no .bundle here (GET response)
        const locale = data.data.preferred_locale || 'en'
        i18n.addResourceBundle(locale, 'translation', bundle, true, true)
        i18n.changeLanguage(locale)
        localStorage.setItem('primo_lang', locale)
        set({ lang: locale })
      }
    } catch (err) {
      console.error('fetchTranslations error:', err)
    }
  },
}))

export default useLangStore