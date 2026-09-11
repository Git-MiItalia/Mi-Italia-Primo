// Backend status fields are English enums — 'confirmed', 'in_progress'. Rendering
// them straight to screen ({o.status}) left them untranslated and lowercase on
// every page that shows one. This is the single place that maps a raw value to a
// display label, so Orders, Reservations, Dashboard, Customers, Products and
// Returns can never drift apart.
//
// Where the bundle already carries a word we reuse that key rather than adding a
// duplicate; the rest are new `status.*` keys.
const STATUS_KEYS = {
  // already in the bundle
  pending:     ['common.pending',      'Pending'],
  cancelled:   ['common.cancelled',    'Cancelled'],
  completed:   ['common.completed',    'Completed'],
  expired:     ['common.expired',      'Expired'],
  active:      ['common.active',       'Active'],
  inactive:    ['common.inactive',     'Inactive'],
  // new
  confirmed:   ['status.confirmed',    'Confirmed'],
  collected:   ['status.collected',    'Collected'],
  placed:      ['status.placed',       'Placed'],
  processing:  ['status.processing',    'Processing'],
  shipped:     ['status.shipped',      'Shipped'],
  delivered:   ['status.delivered',    'Delivered'],
  hidden:      ['status.hidden',       'Hidden'],
  draft:       ['status.draft',        'Draft'],
  open:        ['status.open',         'Open'],
  in_progress: ['status.in_progress',  'In Progress'],
  rejected:    ['status.rejected',     'Rejected'],
  refunded:    ['status.refunded',     'Refunded'],
  paid:        ['status.paid',         'Paid'],
  failed:      ['status.failed',       'Failed'],
  sent:        ['status.sent',         'Sent'],
}

/**
 * @param {(key: string, fallback: string) => string} t  from useTranslation()
 * @param {string|null|undefined} status  the raw backend value
 * @returns {string} a display label, never a raw enum
 */
export function statusLabel(t, status) {
  if (status == null || status === '') return '—'
  const key = String(status).toLowerCase().trim()
  const known = STATUS_KEYS[key]
  if (known) return t(known[0], known[1])
  // An unmapped value still beats raw snake_case on screen, and this keeps a
  // new backend status from looking broken before we have a key for it.
  return key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}
