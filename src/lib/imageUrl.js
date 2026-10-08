// ══ Image URL resolution ════════════════════════════════════════════════════
//
// The API returns photos as app-relative paths ("/uploads/products/x.png"),
// which need the image host in front of them. An absolute URL is returned as-is.
//
// This was written out separately in ten places — Products, POS, Engagement,
// Discounts, Inventory, Showroom, AIModelStudio, Orders, Sidebar and
// StoreProfile — and four of those (Orders, Sidebar, StoreProfile, and one
// branch of Showroom) prefixed unconditionally, with no absolute-URL check.
// That is fine while every photo is hosted by us, and breaks the moment one is
// not: a Shopify CDN link would come out as
//     https://apidev.revoltution.com/https://cdn.shopify.com/...
// and render as a broken image. Storing Shopify's CDN URL directly is one of
// the options put to the backend for the catalogue import, so this is a live
// risk rather than a hypothetical one.

const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL ?? ''

/** Absolute URLs pass through; relative paths get the image host prefixed.
 *  Returns null for a missing value so callers can test it directly. */
export function imgUrl(url) {
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : `${IMG_BASE}${url}`
}

export default imgUrl
