/**
 * Returns Policy — API client
 * ---------------------------------------------------------------------------
 * The returns config has its own endpoints. It was previously written into
 * PUT /boutique/profile alongside the shop details, which silently did nothing:
 * the profile accepted the request but never applied the values, so changing
 * the store default always reverted on refresh.
 *
 *   GET  /boutique/returns/policies -> { store_default_policy_id, policies[],
 *                                        protected_policy_ids[] }
 *   PUT  /boutique/returns/policies    replace-set: the body carries the FULL
 *                                      desired list, plus the default
 *   GET  /boutique/returns/classes  -> { classes: [{ id, map }] }
 *   PUT  /boutique/returns/classes     partial: send only the classes changed
 * ---------------------------------------------------------------------------
 */
import { apiFetch } from '../api'
import { RETURNS_CLASSES } from './model.js'

const API = import.meta.env.VITE_API_URL

async function json(res) {
  const body = await res.json()
  if (!body?.success) throw new Error(body?.message || 'request failed')
  return body.data
}

/** @returns {Promise<{policies:Array, defaultPolicyId:string|null, protectedIds:string[]}>} */
export async function fetchPolicies() {
  const d = await apiFetch(`${API}/boutique/returns/policies`).then(json)
  return {
    policies:        Array.isArray(d?.policies) ? d.policies : [],
    defaultPolicyId: d?.store_default_policy_id ?? null,
    // The server owns which ids may not be deleted; mirroring it in the client
    // would drift the moment a sixth seed is added.
    protectedIds:    Array.isArray(d?.protected_policy_ids) ? d.protected_policy_ids : [],
  }
}

/**
 * Replace-set. Always sends the whole library — omitting a protected id is
 * rejected with a 400 naming it, which is the server enforcing the same rule
 * the editor does.
 */
export async function savePolicies(policies, defaultPolicyId) {
  const body = { policies }
  if (defaultPolicyId) body.store_default_policy_id = defaultPolicyId
  const d = await apiFetch(`${API}/boutique/returns/policies`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }).then(json)
  return {
    policies:        Array.isArray(d?.policies) ? d.policies : policies,
    defaultPolicyId: d?.store_default_policy_id ?? defaultPolicyId ?? null,
  }
}

/**
 * The wire form is [{ id, map }]; the UI carries the label fields too, so map
 * the response onto the fixed four classes rather than replacing them.
 * @returns {Promise<Array>} RETURNS_CLASSES shape with `map` applied
 */
export async function fetchClasses() {
  const d = await apiFetch(`${API}/boutique/returns/classes`).then(json)
  const rows = Array.isArray(d?.classes) ? d.classes : []
  const byId = new Map(rows.map(c => [c.id, c.map ?? null]))
  return RETURNS_CLASSES.map(c => ({ ...c, map: byId.has(c.id) ? byId.get(c.id) : c.map }))
}

/** Partial write — one class at a time, matching the "Change" modal. */
export async function saveClassMap(classId, map) {
  await apiFetch(`${API}/boutique/returns/classes`, {
    method: 'PUT',
    body: JSON.stringify({ classes: [{ id: classId, map: map ?? null }] }),
  }).then(json)
}

/**
 * Server-side class suggestion for a browse node. The client rule is kept as an
 * instant fallback so the strip does not blank while this is in flight.
 * @returns {Promise<string|null>} class id, or null if the call fails
 */
export async function suggestClassFor(categoryTypeId) {
  const qs = categoryTypeId ? `?category_type_id=${encodeURIComponent(categoryTypeId)}` : ''
  try {
    const d = await apiFetch(`${API}/boutique/products/returns/suggest${qs}`).then(json)
    return d?.class_id ?? null
  } catch {
    return null
  }
}
