/**
 * Returns Policy — Data Model
 * ---------------------------------------------------------------------------
 * Mi Italia · Primo · boutique returns policy engine.
 * Ported from the design handoff (primo-returns-policy-mock.html reference
 * modules). Pure data + factories — no persistence, no framework.
 *
 * Legal note: exemption logic is [Likely] per the handoff. Confirm the
 * withdrawal exemptions (bespoke, sealed) with Italian counsel before the
 * enforcement layer relies on them.
 * ---------------------------------------------------------------------------
 */

/** @typedef {'none'|'bespoke'|'sealed'} Exemption */

/**
 * @typedef {Object} Policy
 * @property {string}    id       Stable identifier.
 * @property {string}    en       Display name (English).
 * @property {string}    it       Display name (Italian, formal Lei register).
 * @property {number}    days     Return window in days. 0 when `none` is true.
 * @property {boolean}   none     True = no returns accepted.
 * @property {boolean}   online   Offered on the online channel (display intent).
 * @property {boolean}   instore  Offered in store (display intent).
 * @property {Exemption} exempt   Legal exemption basis when `none` is true.
 */

/**
 * @typedef {Object} ReturnsClass
 * @property {string}      id   Stable identifier.
 * @property {string}      en   Display name (English).
 * @property {string}      it   Display name (Italian).
 * @property {string|null} map  Policy id this class maps to, or null = follow store default.
 */

/** Seed policy library. IDs `standard`..`final` are protected (non-deletable). */
export const SEED_POLICIES = /** @type {Policy[]} */ ([
  { id: 'standard', en: 'Standard 14-day', it: 'Standard 14 giorni', days: 14, none: false, online: true,  instore: true, exempt: 'none' },
  { id: 'extended', en: 'Extended 30-day', it: 'Esteso 30 giorni',   days: 30, none: false, online: true,  instore: true, exempt: 'none' },
  { id: 'mtm',      en: 'Made to Measure', it: 'Su Misura',          days: 0,  none: true,  online: true,  instore: true, exempt: 'bespoke' },
  { id: 'hygiene',  en: 'Hygiene / Sealed',it: 'Igiene / Sigillato', days: 0,  none: true,  online: true,  instore: true, exempt: 'sealed' },
  { id: 'final',    en: 'Final Sale',      it: 'Vendita Finale',     days: 0,  none: true,  online: false, instore: true, exempt: 'none' }
])

/** Policy ids seeded by the system and protected from deletion. */
export const PROTECTED_POLICY_IDS = ['standard', 'extended', 'mtm', 'hygiene', 'final']

/** The store-default fallback id used when nothing more specific applies. */
export const BASELINE_POLICY_ID = 'standard'

/**
 * Returns classes: the product-NATURE axis returns key off (not the browse taxonomy).
 * `map: null` means "follow the store default".
 */
export const RETURNS_CLASSES = /** @type {ReturnsClass[]} */ ([
  { id: 'standard',  en: 'Standard goods',      it: 'Merce standard',          map: null },
  { id: 'mtm',       en: 'Made to Measure',     it: 'Su Misura',               map: 'mtm' },
  { id: 'sealed',    en: 'Sealed / Hygiene',    it: 'Sigillato / Igiene',      map: 'hygiene' },
  { id: 'finalsale', en: 'Final Sale eligible', it: 'Idoneo a Vendita Finale', map: 'final' }
])

/** The returns class assigned when no suggest rule matches. */
export const DEFAULT_CLASS_ID = 'standard'

/**
 * @typedef {Object} SuggestRule
 * @property {{division?:string,type?:string}} when     Match on browse division and/or L2 type.
 * @property {string} klass                             Returns class id to suggest.
 * @property {string} reasonEn                          Human reason (English) for the suggestion strip.
 * @property {string} reasonIt                          Human reason (Italian).
 */

/**
 * Auto-suggest rules. Ordered: first match wins. Only nodes that carry
 * return-relevant meaning appear here; everything else falls to DEFAULT_CLASS_ID.
 * Keys off the real browse taxonomy already used by CategorySelector.jsx
 * (Division -> L2 Type) — extend this list, not the engine, to add signals.
 */
export const SUGGEST_RULES = /** @type {SuggestRule[]} */ ([
  { when: { division: 'Vintage' }, klass: 'finalsale', reasonEn: 'Vintage division', reasonIt: 'divisione Vintage' },
  { when: { type: 'Swimwear' },    klass: 'sealed',    reasonEn: 'Swimwear type',    reasonIt: 'tipo Costumi' },
])

/** Create a validated-shape custom policy object (id supplied by caller/store). */
export function makePolicy({ id, en, it, days = 0, none = false, online = true, instore = true, exempt = 'none' }) {
  return { id, en, it, days: none ? 0 : days, none, online, instore, exempt }
}

/** Lookup helper used across modules. */
export function findById(list, id) {
  return list.find((x) => x.id === id) || null
}

/** True for the five seed ids — used to gate the Remove action in the editor. */
export function isProtected(id) {
  return PROTECTED_POLICY_IDS.includes(id)
}
