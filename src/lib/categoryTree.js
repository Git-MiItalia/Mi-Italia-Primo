import { useState, useEffect } from 'react'
import { apiFetch } from './api'
import useLangStore from '../store/langStore'

const API = import.meta.env.VITE_API_URL

// ══ Shared category-tree cache ══════════════════════════════════════════════
//
// The tree is the largest payload on the screens that use it (~20 kB), and
// every caller used to fetch its own copy. Discounts fetched it twice — once
// for the page, again the moment the Create Promo modal mounted — and in
// development StrictMode's second effect pass doubled every one of those again.
//
// Both maps are keyed by language, because apiFetch sends Accept-Language and
// the backend returns translated names: switching language must not keep
// serving the previous language's tree.
//
//   cache    — the last good response with the time it arrived
//   inflight — the request currently in the air, so components mounting
//              together (and StrictMode's second pass) share one round trip
//
// A response younger than TTL_MS is reused with no network call at all, which
// is what covers opening a modal on a page that just loaded the tree. Past
// that the cached copy still renders immediately and a refresh runs behind it,
// so product_count picks up products added on another screen. The window is
// deliberately short: these counts change whenever a product is added, and a
// stale count is worth less than a wasted request is expensive.
//
// Nothing is cached on failure, and a failure while cached data exists keeps
// showing that data — only a cold failure surfaces as `error`.
const TTL_MS   = 60_000
const cache    = new Map()
const inflight = new Map()

function fetchTree(lang) {
  const hit = cache.get(lang)
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.categories)

  const pending = inflight.get(lang)
  if (pending) return pending

  const request = apiFetch(`${API}/boutique/categories/tree`)
    .then(r => r.json())
    .then(res => {
      if (!res.success) throw new Error('categories/tree returned success:false')
      const categories = res.data?.categories ?? []
      cache.set(lang, { categories, at: Date.now() })
      return categories
    })
    .finally(() => { inflight.delete(lang) })

  inflight.set(lang, request)
  return request
}

export function useCategoryTree() {
  const lang = useLangStore(s => s.lang)
  // Seeded from the cache so a second consumer renders the tree on its first
  // paint instead of flashing an empty list while the network catches up.
  const [tree, setTree]       = useState(() => cache.get(lang)?.categories ?? [])
  const [loading, setLoading] = useState(() => !cache.has(lang))
  const [error, setError]     = useState(false)

  useEffect(() => {
    let cancelled = false

    fetchTree(lang)
      .then(categories => { if (!cancelled) { setTree(categories); setError(false) } })
      // Losing a refresh is not worth blanking a tree we already have.
      .catch(()         => { if (!cancelled && !cache.has(lang)) setError(true) })
      .finally(()       => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [lang])

  return { tree, loading, error }
}

export function findDivision(tree, name) { return tree.find(c => c.name === name) ?? null }
export function findType(division, name) { return division?.types?.find(t => t.name === name) ?? null }
export function findStyle(type, name) { return type?.styles?.find(s => s.name === name) ?? null }
export function getAttrNames(typeNode) {
  return (typeNode?.attrs ?? []).map(a => (typeof a === 'string' ? a : a?.name)).filter(Boolean)
}
