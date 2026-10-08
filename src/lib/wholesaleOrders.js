// Shared by the Orders list and WholesaleOrderPanel — Showroom (wholesale)
// orders, per sir's Showroom Postman collection (Oct 2026).
import { activeLocale } from './dateHelpers'

// Lifecycle, in order. The boutique moves its part one step at a time;
// cancelled can happen from any step before dispatch (by the buyer or admin).
export const WS_FLOW = ['submitted', 'confirmed', 'in_production', 'dispatched', 'delivered']

// Wholesale statuses drawn with the existing status chip colours.
export const WS_PILL = {
  submitted: 'pending', confirmed: 'active', in_production: 'active',
  dispatched: 'shipped', delivered: 'completed', cancelled: 'cancelled',
}

// Money arrives as a plain EUR number (collection convention).
export function wsMoney(n) {
  if (n == null || n === '') return '—'
  return `€${Number(n).toLocaleString(activeLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Fired by the Orders tab with the count of wholesale orders waiting for
// confirmation; the sidebar listens for it (Orders badge).
export const WS_NEW_EVENT = 'primo:ws-orders-new'
