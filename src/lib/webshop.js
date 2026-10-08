// Links from the portal out to the public storefront ("view as customer").
//
// The storefront host is DERIVED at runtime from the hostname the portal is
// served from, so the bundle carries no environment of its own: the same
// artifact can be promoted between environments without a rebuild, and a
// deploy box with no .env cannot ship a broken link. That was the original
// bug — VITE_WEBSHOP_URL was undefined at build time, the old code produced
// the relative URL "undefined/<id>", and the browser resolved it against the
// portal, landing on primodev.revoltution.com/undefined/<id>.
//
// There are two naming conventions, not one, so there are two rules:
//
//   dev / QA   primo<env>.<domain>  ->  web<env>.<domain>     swap primo->web
//                primodev.revoltution.com -> webdev.revoltution.com
//                primoqa.revoltution.com  -> webqa.revoltution.com
//
//   production primo.<domain>       ->  <domain>              drop the label
//                primo.miitalia.com       -> miitalia.com
//
// The two cannot collide: "primodev." does not match the production pattern,
// because that one requires a dot immediately after "primo".
//
// An earlier version had only the first rule, written as a bare /^primo/ test.
// On production that would have derived web.miitalia.com — a host that does
// not exist — and, because derivation takes precedence, it would have done so
// while ignoring a correct VITE_WEBSHOP_BASE_URL sitting in the config.
//
// VITE_WEBSHOP_BASE_URL remains the fallback for anything that matches neither
// rule: localhost, an IP, a preview URL.
//
// The path template is shared by every environment. `:id` is substituted the
// way a Postman path variable is; `{{id}}` is accepted too, so a route pasted
// straight out of Postman works.

const RAW_PATH = import.meta.env.VITE_WEBSHOP_PRODUCT_PATH || '/product/:id'

const PRODUCT_PATH = RAW_PATH.trim().startsWith('/')
  ? RAW_PATH.trim()
  : `/${RAW_PATH.trim()}`

// The fixed part of the template, before the first placeholder — '/product' for
// the default. Used to spot a legacy base that already ends in it, and it stays
// in step if the template ever changes.
const PATH_PREFIX = PRODUCT_PATH.split(/\/(?::|\{)/)[0]

function normalise(value) {
  const base = String(value ?? '').trim().replace(/\/+$/, '')
  if (!base) return ''
  // Older .env files set VITE_WEBSHOP_URL to the host with /product already
  // glued on, which the template would then duplicate. Trim it back off.
  if (PATH_PREFIX && base.toLowerCase().endsWith(PATH_PREFIX.toLowerCase())) {
    return base.slice(0, -PATH_PREFIX.length).replace(/\/+$/, '')
  }
  return base
}

// primodev.revoltution.com -> webdev.revoltution.com   (dev / QA)
const PRIMO_ENV_HOST = /^primo(dev|qa)\./i
// primo.miitalia.com       -> miitalia.com             (production)
const PRIMO_ROOT_HOST = /^primo\./i

// Returns '' for anything matching neither rule, which falls through to
// VITE_WEBSHOP_BASE_URL. The port is deliberately dropped: the storefront is
// a different host and does not share the portal's dev-server port.
function derivedBase() {
  if (typeof window === 'undefined') return ''
  const { protocol, hostname } = window.location
  if (PRIMO_ENV_HOST.test(hostname)) return `${protocol}//${hostname.replace(/^primo/i, 'web')}`
  if (PRIMO_ROOT_HOST.test(hostname)) return `${protocol}//${hostname.replace(/^primo\./i, '')}`
  return ''
}

const ENV_BASE = normalise(
  import.meta.env.VITE_WEBSHOP_BASE_URL || import.meta.env.VITE_WEBSHOP_URL
)

export const WEBSHOP_BASE = normalise(derivedBase()) || ENV_BASE

// False only off a primo* host with no .env — i.e. localhost on a fresh clone.
// Deployed environments are always configured, by derivation.
export const WEBSHOP_CONFIGURED = WEBSHOP_BASE !== ''

// Returns null when there is nothing safe to open, and the caller says so
// rather than navigating. There is deliberately no last-resort fallback to the
// portal's own origin: these links must reach the storefront or nowhere.
export function webshopProductUrl(id) {
  if (!WEBSHOP_CONFIGURED) return null
  const value = encodeURIComponent(String(id ?? ''))
  return WEBSHOP_BASE + PRODUCT_PATH.replace(/:id\b|\{\{?\s*id\s*\}?\}/g, value)
}
