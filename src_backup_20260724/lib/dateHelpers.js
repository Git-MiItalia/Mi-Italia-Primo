// ══════════════════════════════════════════════════════════════════════
// Shared date helpers — used by RangePicker, RangeBar, and views that
// need to format JS Date objects consistently.
//
// NOTE: several views (Customers, Orders, Reports, etc.) have their own
// local `fmtDate(iso)` helpers that take ISO strings — those are a
// DIFFERENT signature and are not consolidated here. This file targets
// the Date-object flavor used by the range picker.
// ══════════════════════════════════════════════════════════════════════

// Fixed demo "today" used across the range picker and analytics mocks
export const PR_TODAY = new Date(2026, 4, 21)   // 21 May 2026

export const PR_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export const PR_MONTHS_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
]

// True if two Date objects fall on the same calendar day
export const sameDay = (a, b) =>
  a && b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth() &&
  a.getDate()     === b.getDate()

// "21 May 2026"
export const fmtDate = (d) =>
  d ? `${d.getDate()} ${PR_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}` : ''

// "May 21"
export const fmtDateShort = (d) =>
  d ? `${PR_MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` : ''