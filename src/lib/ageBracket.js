/**
 * Inventory age brackets — single source of truth.
 * ---------------------------------------------------------------------------
 * The backend computes these server-side and the thresholds are FIXED (not
 * configurable) — confirmed in sir's boutique-markdowns Postman collection:
 *   "Brackets are fixed: fresh 0-14d, normal 15-30d, aging 31-60d,
 *    slow 61-90d, dead 90+d"
 *
 * Products.jsx used to carry its own, much wider, thresholds (fresh 0-30,
 * normal 31-60, aging 61-90, slow 91-120, dead 120+). A product sitting 75
 * days therefore read "Aging" on the Products tab and "Slow" on Markdowns,
 * and the Products dead-stock banner claimed 120+ days while the server had
 * already marked the item down as dead at 90. Both views now read from here,
 * so the two can never drift apart again.
 *
 * Same pattern as lib/statusLabel.js: one map, every screen agrees.
 * ---------------------------------------------------------------------------
 */

/** Bracket ids, youngest first. Matches the backend's `bracket` enum. */
export const AGE_BRACKETS = ['fresh', 'normal', 'aging', 'slow', 'dead']

/**
 * [firstDay, lastDay] per bracket; lastDay null means open-ended.
 * Change a threshold here and every screen follows.
 */
export const AGE_BRACKET_DAYS = {
  fresh:  [0,  14],
  normal: [15, 30],
  aging:  [31, 60],
  slow:   [61, 90],
  dead:   [91, null],
}

/** First day of the dead-stock bracket — used by the Products dead-stock banner. */
export const DEAD_STOCK_FROM_DAYS = AGE_BRACKET_DAYS.dead[0]

/**
 * Row/badge palette. `warn` drives the ⚠ on the Products badge.
 * Kept here so the colour and the threshold can't be changed independently.
 */
const AGE_BRACKET_STYLE = {
  fresh:  { warn: false, bg: 'rgba(0,89,58,.08)',   color: '#006C35' },
  normal: { warn: false, bg: 'rgba(26,79,191,.08)', color: '#1A4FBF' },
  aging:  { warn: true,  bg: 'rgba(180,83,9,.1)',   color: '#B45309' },
  slow:   { warn: true,  bg: 'rgba(197,0,26,.08)',  color: '#C5001A' },
  dead:   { warn: true,  bg: 'rgba(197,0,26,.12)',  color: '#C5001A' },
}

/**
 * Days a product has been in stock.
 * Prefers the server's own count; falls back to created_at only when the
 * endpoint hasn't sent one. `days_in_stock` is confirmed live (Products list).
 * @returns {number|null} null when neither is available
 */
export function daysInStock(p) {
  if (p?.days_in_stock != null) return Number(p.days_in_stock)
  if (!p?.created_at) return null
  const ms = Date.now() - new Date(p.created_at).getTime()
  return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null
}

/**
 * Bracket id for a day count.
 * @param {number|null} days
 * @returns {string|null} one of AGE_BRACKETS, or null when days is unknown
 */
export function bracketForDays(days) {
  if (days == null || !Number.isFinite(Number(days))) return null
  const d = Number(days)
  for (const id of AGE_BRACKETS) {
    const [, last] = AGE_BRACKET_DAYS[id]
    if (last == null || d <= last) return id
  }
  return 'dead'
}

/**
 * Bracket + day count + palette for a product row.
 * Drop-in replacement for the old local getAgeInfo() in Products.jsx.
 * @returns {{bracket:string, days:number, warn:boolean, bg:string, color:string}|null}
 */
export function getAgeInfo(p) {
  const days = daysInStock(p)
  const bracket = bracketForDays(days)
  if (!bracket) return null
  return { bracket, days, ...AGE_BRACKET_STYLE[bracket] }
}

/**
 * Translated bracket name — "Aging" / "Invecchiamento".
 * @param {(k:string,d?:string)=>string} t
 */
export function bracketName(t, bracket) {
  if (!bracket) return ''
  const fallback = { fresh: 'Fresh', normal: 'Normal', aging: 'Aging', slow: 'Slow', dead: 'Dead Stock' }
  return t(`common.age_bracket.${bracket}`, fallback[bracket] ?? bracket)
}

/**
 * Translated day range — "31–60 days". Used where there's room to spell it out.
 */
export function bracketRange(t, bracket) {
  const span = AGE_BRACKET_DAYS[bracket]
  if (!span) return ''
  const [from, to] = span
  return to == null
    ? t(`common.age_bracket.${bracket}_range`, `${from}+ days`)
    : t(`common.age_bracket.${bracket}_range`, `${from}–${to} days`)
}

/**
 * Compact day range for a badge or filter chip — "31–60d".
 * Built from the numbers so it can never drift; only the day unit is
 * translated (Italian abbreviates giorni as "g").
 */
export function bracketRangeShort(t, bracket) {
  const span = AGE_BRACKET_DAYS[bracket]
  if (!span) return ''
  const [from, to] = span
  const d = t('common.days_abbrev', 'd')
  return to == null ? `${from}+${d}` : `${from}–${to}${d}`
}
