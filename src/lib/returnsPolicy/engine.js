/**
 * Returns Policy — Resolution Engine
 * ---------------------------------------------------------------------------
 * Pure functions. No DOM, no I/O. Ported from the design handoff reference
 * modules.
 * ---------------------------------------------------------------------------
 */

import { SUGGEST_RULES, DEFAULT_CLASS_ID } from './model.js'

/** Minimum statutory return window for EU distance (online) sales, in days. [Likely] */
export const ONLINE_MIN_DAYS = 14

/**
 * Is a policy lawful to apply on a distance (online) sale?
 * - No-returns is lawful online ONLY with a recognised exemption (bespoke, sealed).
 * - A finite window is lawful online only if it meets the statutory minimum.
 * @param {import('./model.js').Policy} p
 * @returns {boolean}
 */
export function isLawfulOnline(p) {
  if (p.none) return p.exempt === 'bespoke' || p.exempt === 'sealed'
  return p.days >= ONLINE_MIN_DAYS
}

/** A policy may serve as a store default or a class map only if it is lawful online. */
export function isEligibleAsDefault(p) {
  return isLawfulOnline(p)
}

/**
 * Suggest a returns class from a browse node (Division + L2 Type).
 * @param {{division?:string, type?:string}} node
 * @returns {{classId:string, reasonEn:string|null, reasonIt:string|null}}
 */
export function suggestClass(node) {
  const div = node && node.division
  const type = node && node.type
  for (const rule of SUGGEST_RULES) {
    const okDiv = rule.when.division === undefined || rule.when.division === div
    const okType = rule.when.type === undefined || rule.when.type === type
    if (okDiv && okType) {
      return { classId: rule.klass, reasonEn: rule.reasonEn, reasonIt: rule.reasonIt }
    }
  }
  return { classId: DEFAULT_CLASS_ID, reasonEn: null, reasonIt: null }
}

/**
 * @typedef {Object} ResolveContext
 * @property {string|null} overridePolicyId  Hard product override, or null.
 * @property {string}      classId           Assigned returns class id.
 * @property {Object.<string,(string|null)>} classMap  classId -> policyId|null (null = store default).
 * @property {string}      storeDefault      Store default policy id.
 * @property {boolean}     online            Is the product listed online?
 * @property {(id:string)=>(import('./model.js').Policy|null)} getPolicy
 */

/**
 * Resolve the effective policy for a product.
 * @param {ResolveContext} ctx
 * @returns {{policyId:string, source:'product'|'class'|'store', fallback:boolean}}
 */
export function resolvePolicy(ctx) {
  const { overridePolicyId, classId, classMap, storeDefault, online, getPolicy } = ctx

  // 1. product override
  if (overridePolicyId && getPolicy(overridePolicyId)) {
    return { policyId: overridePolicyId, source: 'product', fallback: false }
  }

  // 2. returns class -> policy (null map = follow store default)
  const mapped = classMap ? classMap[classId] : null
  let candidate = storeDefault
  let source = /** @type {'class'|'store'} */ ('store')
  if (mapped && getPolicy(mapped)) {
    candidate = mapped
    source = 'class'
  }

  // online fallback: a class-derived in-store-only policy cannot apply online
  if (source === 'class' && online && !isLawfulOnline(getPolicy(candidate))) {
    return { policyId: storeDefault, source: 'store', fallback: true }
  }

  return { policyId: candidate, source, fallback: false }
}

/**
 * Build the classId -> policyId map from a RETURNS_CLASSES array.
 * @param {import('./model.js').ReturnsClass[]} classes
 * @returns {Object.<string,(string|null)>}
 */
export function buildClassMap(classes) {
  const m = {}
  for (const c of classes) m[c.id] = c.map
  return m
}

/** Validation error codes returned by validatePolicy. */
export const POLICY_ERRORS = {
  NAMES_REQUIRED: 'NAMES_REQUIRED',
  CHANNEL_REQUIRED: 'CHANNEL_REQUIRED',
  ONLINE_MIN: 'ONLINE_MIN',
  EXEMPTION_REQUIRED: 'EXEMPTION_REQUIRED',
}

/**
 * Validate a policy draft (create or edit). Encodes the same guardrails the
 * boutique-facing UI enforces, so the API can reject the same illegal states.
 * @param {{en:string, it:string, days:number, none:boolean, online:boolean, instore:boolean, exempt:string}} d
 * @returns {{ok:boolean, error?:string}}
 */
export function validatePolicy(d) {
  if (!d.en || !d.en.trim() || !d.it || !d.it.trim()) return { ok: false, error: POLICY_ERRORS.NAMES_REQUIRED }
  if (!d.online && !d.instore) return { ok: false, error: POLICY_ERRORS.CHANNEL_REQUIRED }
  if (d.online && !d.none && d.days < ONLINE_MIN_DAYS) return { ok: false, error: POLICY_ERRORS.ONLINE_MIN }
  if (d.online && d.none && d.exempt === 'none') return { ok: false, error: POLICY_ERRORS.EXEMPTION_REQUIRED }
  return { ok: true }
}
