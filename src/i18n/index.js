import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: {
      sidebar: { engagement: 'Engagement', promotions: 'Promotions', analytics: 'Discovery Analytics' },
    } },
    it: { translation: {
      sidebar: { engagement: 'Engagement', promotions: 'Promozioni', analytics: 'Discovery Analytics' },
    } },
  },
  lng: 'en',
  fallbackLng: 'en',
  nsSeparator: false, // keys are never namespaced here, and some (AI Studio aspect ratios) contain a literal ':'
  interpolation: {
    escapeValue: false, // React already escapes
  },
  useSuspense: false,
})


export default i18n
