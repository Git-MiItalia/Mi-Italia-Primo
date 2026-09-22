// Live Shopify connection layer, wired against the endpoints handed over on
// 2026-08-25 (POST connect, GET connection, PATCH location-mapping, PATCH
// writeback, DELETE connection, POST sync-types, GET mapping, PATCH mapping
// row, POST mapping/apply). Customers-import and orders-sync/list are not
// wired here yet — no UI surface exists for them (see Integrations.jsx).
import { apiFetch } from './api'

const API = import.meta.env.VITE_API_URL
const BASE = `${API}/boutique/shopify`

// Bodyless POSTs still need an explicit `{}` body: apiFetch always sets
// Content-Type: application/json, and this backend 400s on that combo with
// a genuinely empty body.
const EMPTY_BODY = JSON.stringify({})

async function toData(res) {
  if (res.status === 404) return null
  const body = await res.json().catch(() => null)
  // The thrown message reaches the screen through Integrations' errMsg(), which
  // prefers err.message over its own translated fallback. A hand-written
  // "Request failed (500)" here therefore won the toast and printed English in
  // an Italian portal. With no message from the server there is now nothing to
  // prefer, so the caller's translated fallback shows; the status is kept on the
  // error for the console, where English is the right language anyway.
  if (!res.ok || !body?.success) {
    const err = new Error(body?.message || '')
    err.status = res.status
    throw err
  }
  return body.data
}

// The connection record backend returns one pair of flags (scope_fulfil /
// scope_inventory) that doubles as both "Shopify granted this" and "this
// write-back is currently on" — there's no separate granted-vs-on state.
// Turning a write-back off via the API is one-way (its own doc calls the
// PATCH "can only turn OFF"), so once off it reads the same as "not
// granted," which happens to be the exact lock behaviour the UI already
// wants (see WritebackRow in Integrations.jsx).
function normalizeConnection(raw, extra = {}) {
  if (!raw) return null
  const flags = { fulfil: !!raw.scope_fulfil, inv: !!raw.scope_inventory }
  return {
    id: raw.id,
    locationId: raw.boutique_location_id,
    domain: raw.shop_domain,
    status: raw.status,
    scopes: flags,
    writeback: flags,
    shopifyLocationId: raw.shopify_location_id,
    shopifyLocation: raw.shopify_location_name,
    connectedAt: raw.connected_at,
    lastSyncAt: raw.last_synced_at,
    productCount: extra.productCount,
    mapping: extra.mapping,
    // GET /connection does not return the store's available Shopify
    // locations (only whichever one is already mapped, if any) — that list
    // only comes back from POST /connect's `verify.locations`. After a page
    // reload we fall back to a single-item list built from the saved
    // mapping, so the "Sellable stock" dropdown has at least the current
    // value. A dedicated "list this store's Shopify locations" endpoint
    // would close this gap.
    shopifyLocations: extra.shopifyLocations
      ?? (raw.shopify_location_id ? [{ id: raw.shopify_location_id, name: raw.shopify_location_name }] : []),
  }
}

/* The connection row outlives both the ways it can end, and GET keeps handing
 * it back regardless, so the portal used to show a store as connected in two
 * situations where it was not:
 *
 *   DELETE /connection soft-deletes. It answers
 *   {"success":true,"message":"Disconnected"} but keeps the row, blanking the
 *   token and connected_at and setting status "not_connected". Disconnect
 *   therefore appeared to work and the store came back on the next reload.
 *
 *   POST /connect writes the row BEFORE it verifies the shop with Shopify. A
 *   failed connect returns success:false — and still leaves a row behind, with
 *   status "error". So a connection the boutique was told had failed showed up
 *   connected a moment later.
 *
 * Both observed states are listed here rather than matching against the
 * connected word, because we have never seen a successful connect and so do
 * not know what that word is. An unknown status is treated as connected: that
 * keeps a working store working, where guessing wrong the other way would hide
 * one. The cost is that a new word for "not usable" reopens this — the full
 * vocabulary is asked for in docs/backend-issues-for-sir.txt. 'failed',
 * 'pending' and 'inactive' are pre-empted on the same reasoning: each would
 * mean a store that cannot be used, none could mean a live one. */
const DISCONNECTED_STATUSES = new Set([
  'not_connected', 'disconnected', 'revoked',   // observed after DELETE
  'error',                                      // observed after a failed POST /connect
  'failed', 'pending', 'inactive',              // not observed; unusable either way
])

export async function getConnection(locationId) {
  if (!locationId) return null
  const res = await apiFetch(`${BASE}/locations/${locationId}/connection`)
  const data = await toData(res)
  const raw = data?.connection
  if (raw && DISCONNECTED_STATUSES.has(String(raw.status || '').toLowerCase())) return null
  return normalizeConnection(raw)
}

export async function connectStore(locationId, { domain, accessToken, scopes }) {
  const res = await apiFetch(`${BASE}/locations/${locationId}/connect`, {
    method: 'POST',
    body: JSON.stringify({
      shopDomain: domain,
      accessToken,
      scopeFulfil: !!scopes.fulfil,
      scopeInventory: !!scopes.inv,
    }),
  })
  const data = await toData(res)
  return normalizeConnection(data.connection, { shopifyLocations: data.verify?.locations ?? [] })
}

export async function disconnect(locationId) {
  const res = await apiFetch(`${BASE}/locations/${locationId}/connection`, { method: 'DELETE' })
  await toData(res)
}

export async function setLocationMapping(connectionId, { shopifyLocationId, shopifyLocationName }, keep = {}) {
  const res = await apiFetch(`${BASE}/connections/${connectionId}/location-mapping`, {
    method: 'PATCH',
    body: JSON.stringify({ shopifyLocationId, shopifyLocationName }),
  })
  const data = await toData(res)
  return normalizeConnection(data.connection, keep)
}

export async function setWriteback(connectionId, { fulfil, inv }, keep = {}) {
  const res = await apiFetch(`${BASE}/connections/${connectionId}/writeback`, {
    method: 'PATCH',
    body: JSON.stringify({ scopeFulfil: !!fulfil, scopeInventory: !!inv }),
  })
  const data = await toData(res)
  return normalizeConnection(data.connection, keep)
}

export async function syncTypes(connectionId) {
  const res = await apiFetch(`${BASE}/connections/${connectionId}/sync-types`, { method: 'POST', body: EMPTY_BODY })
  return toData(res) // { stats, rows }
}

export async function getMapping(connectionId) {
  const res = await apiFetch(`${BASE}/connections/${connectionId}/mapping`)
  return toData(res) // { stats, rows }
}

export async function overrideMappingRow(connectionId, rowId, { categoryTypeId, styleSlug }) {
  const res = await apiFetch(`${BASE}/connections/${connectionId}/mapping/${rowId}`, {
    method: 'PATCH',
    body: JSON.stringify({ categoryTypeId, styleSlug }),
  })
  const data = await toData(res)
  return data.row
}

export async function applyMapping(connectionId) {
  const res = await apiFetch(`${BASE}/connections/${connectionId}/mapping/apply`, { method: 'POST', body: EMPTY_BODY })
  return toData(res) // { imported, stats, rows }
}

export async function importCustomers(connectionId) {
  const res = await apiFetch(`${BASE}/connections/${connectionId}/customers/import`, { method: 'POST', body: EMPTY_BODY })
  return toData(res) // { merged, created }
}

export async function syncOrders(connectionId) {
  const res = await apiFetch(`${BASE}/connections/${connectionId}/orders/sync`, { method: 'POST', body: EMPTY_BODY })
  return toData(res) // { rows }
}

export async function getOrders(connectionId) {
  const res = await apiFetch(`${BASE}/connections/${connectionId}/orders`)
  return toData(res) // { rows }
}

export function isMapped(row) { return row.status !== 'review' }

export function mappingTotals(rows) {
  const totals = { products: 0, mapped: 0, review: 0, types: rows.length }
  rows.forEach(r => {
    totals.products += r.productCount ?? 0
    if (isMapped(r)) totals.mapped += r.productCount ?? 0
    else totals.review += r.productCount ?? 0
  })
  return totals
}
