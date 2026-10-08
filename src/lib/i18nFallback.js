import i18n from './i18n'

/* Last-resort English, loaded only when the bundle fetch has failed.
 *
 * Every string in the portal comes from GET /auth/boutique/translations. When
 * that request fails — the API is down, the translation credit is exhausted,
 * the connection dropped — there is nothing to render but key names, and the
 * screen fills with `sidebar.products` and `dashboard.todays_revenue`.
 *
 * Roughly 1,200 t() call sites carry no English second argument, so the
 * per-call-site fallbacks never covered this; about a quarter of the screen
 * went raw. This covers all of it from one file.
 *
 * It imports primo5.json — the same English source that is sent to the backend
 * — rather than a copy, so there is nothing to keep in sync.
 *
 * The import is dynamic on purpose. Vite gives it its own chunk (~68 KB
 * gzipped), so a normal load never downloads it; only a failed load pays. */

let state = null // null = untried, Promise while loading, true/false once settled

export function loadEnglishFallback() {
  if (state !== null) return Promise.resolve(state).then(v => v === true)

  state = import('../../primo5.json')
    .then(mod => {
      const bundle = mod.default ?? mod
      if (!bundle || typeof bundle !== 'object') throw new Error('empty fallback bundle')
      /* overwrite:false — a real bundle that arrives later must win. i18n.js
         already sets fallbackLng:'en', so a boutique on `it` with no Italian
         resource reads through to this one key by key. */
      i18n.addResourceBundle('en', 'translation', bundle, true, false)
      state = true
      return true
    })
    .catch(() => {
      // Nothing more to try — the caller still renders, with raw keys.
      state = false
      return false
    })

  return state
}

/* Fetch it in the background once the real bundle has been applied.
 *
 * The call sites no longer carry an English second argument, so this file is
 * the only thing standing behind a key the backend bundle happens to be
 * missing — and it has been missing keys before, whenever sir's loaded English
 * ran behind the code. Waiting for a *total* failure would be too late for
 * that case.
 *
 * Deliberately after the first paint and never awaited: the real bundle is
 * already on screen by this point, so this costs nothing a user can see. */
export function primeEnglishFallback() {
  if (state !== null) return
  const go = () => { loadEnglishFallback() }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 3000 })
  else setTimeout(go, 1200)
}

/* Whether the English fallback is currently providing the words. Used only for
 * logging and tests; nothing in the UI branches on it. */
export const englishFallbackLoaded = () => state === true
