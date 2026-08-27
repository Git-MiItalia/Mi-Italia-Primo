import { useState, useEffect } from 'react'
import { apiFetch } from './api'
import useLangStore from '../store/langStore'

const API = import.meta.env.VITE_API_URL

export function useCategoryTree() {
  const lang = useLangStore(s => s.lang)
  const [tree, setTree]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch(`${API}/boutique/categories/tree`)
      .then(r => r.json())
      .then(res => {
        if (cancelled) return
        if (res.success) setTree(res.data?.categories ?? [])
        else setError(true)
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
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
