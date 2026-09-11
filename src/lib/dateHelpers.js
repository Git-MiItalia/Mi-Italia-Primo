// ══════════════════════════════════════════════════════════════════════
// Shared date helpers — used by RangePicker, RangeBar, and views that
// need to format JS Date objects consistently.
//
// NOTE: several views (Customers, Orders, Reports, etc.) have their own
// local `fmtDate(iso)` helpers that take ISO strings — those are a
// DIFFERENT signature and are not consolidated here. This file targets
// the Date-object flavor used by the range picker.
// ══════════════════════════════════════════════════════════════════════

import i18n from './i18n'

// Fixed demo "today" used across the range picker and analytics mocks
export const PR_TODAY = new Date(2026, 4, 21)   // 21 May 2026

// The month names below are English literals, so every date in the portal read
// "1 Sep 2026" even with the interface in Italian. These resolve the active
// language at call time instead. Components that render them already re-render
// on a language switch (they use useTranslation), so the label follows along.
const LOCALES = { it: 'it-IT', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' }
export const activeLocale = () => LOCALES[(i18n.language || 'en').slice(0, 2)] ?? 'en-GB'

// "21 May 2026" / "21 mag 2026"
export const fmtDateLocalized = (d) =>
  d ? new Date(d).toLocaleDateString(activeLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : ''

// "May 21" / "21 mag"
export const fmtDateShortLocalized = (d) =>
  d ? new Date(d).toLocaleDateString(activeLocale(), { day: 'numeric', month: 'short' }) : ''

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

// Calendar chrome for the range picker, in the active language. Built from a
// fixed reference year so the index is always 0 = January / 0 = Monday.
export const monthNames = () => {
  const f = new Intl.DateTimeFormat(activeLocale(), { month: 'long' })
  return Array.from({ length: 12 }, (_, m) => {
    const s = f.format(new Date(2021, m, 1))
    return s.charAt(0).toUpperCase() + s.slice(1)  // Italian months are lowercase
  })
}

// Mon-first weekday initials — 4 Jan 2021 was a Monday.
export const weekdayInitials = () => {
  const f = new Intl.DateTimeFormat(activeLocale(), { weekday: 'short' })
  return Array.from({ length: 7 }, (_, i) => {
    const s = f.format(new Date(2021, 0, 4 + i)).replace(/\.$/, '')
    return s.charAt(0).toUpperCase() + s.slice(1, 2)
  })
}

// "21 May 2026" — follows the interface language
export const fmtDate = (d) => fmtDateLocalized(d)

// "May 21" — follows the interface language
export const fmtDateShort = (d) => fmtDateShortLocalized(d)