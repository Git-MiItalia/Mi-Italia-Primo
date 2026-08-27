// ══ Shared tag print utilities ══════════════════════════════════════════════
//
// Used by:
//   • PriceTags.jsx           (multi-product bulk print)
//   • PrintTagModal.jsx       (single-product print from AddProduct)
//
// Fonts are self-hosted from public/fonts/. See src/styles/fonts.css.
// The print window loads the same files via absolute URL (window.location.origin).
//
// Exports:
//   TAG_DIMS               — size registry
//   isCondensedSize        — true for labels too small for the full layout
//   getAvailableFields     — which `show.*` fields can render at a given size
//   STYLE_PALETTES         — color palettes keyed by tag style
//   encodeEAN13            — EAN-13 encoder (checksum + L/G/R patterns)
//   buildBarcodeSvg        — inline SVG barcode
//   buildQrSvg             — inline SVG QR code (uses `qrcode` npm)
//   buildBoutiqueTagHtml   — rich hang-tag layout, shared by both consumers
//   openPrintWindow        — spawns print window with self-hosted fonts

import QRCode from 'qrcode'

// ── Size registry ───────────────────────────────────────────────────────────
export const TAG_DIMS = {
  '57x32':  { w: 171, h: 96,  wMM: 57,  hMM: 32 },
  '25x54':  { w: 75,  h: 162, wMM: 25,  hMM: 54 },
  '19x51':  { w: 57,  h: 153, wMM: 19,  hMM: 51 },
  '89x28':  { w: 267, h: 84,  wMM: 89,  hMM: 28 },
  '62x29':  { w: 186, h: 87,  wMM: 62,  hMM: 29 },
  '62x100': { w: 186, h: 300, wMM: 62,  hMM: 100 },
  '29x90':  { w: 87,  h: 270, wMM: 29,  hMM: 90 },
  '51x25':  { w: 153, h: 75,  wMM: 51,  hMM: 25 },
  '76x51':  { w: 228, h: 153, wMM: 76,  hMM: 51 },
  '38x21':  { w: 114, h: 63,  wMM: 38,  hMM: 21 },
  '70x37':  { w: 210, h: 111, wMM: 70,  hMM: 37 },
  '35x35':  { w: 105, h: 105, wMM: 35,  hMM: 35 },
  '55x85':  { w: 165, h: 255, wMM: 55,  hMM: 85 },
  '90x55':  { w: 270, h: 165, wMM: 90,  hMM: 55 },
  '100x70': { w: 300, h: 210, wMM: 100, hMM: 70 },
}

// ── Condensed-layout threshold ──────────────────────────────────────────────
// Labels below this size can't fit the full boutique layout (header, product
// name, size, origin, season, QR) — only a compact brand/price/sku/barcode
// row fits. Same threshold the old PriceTags "isNarrow" branch used.
export function isCondensedSize(sizeId) {
  const d = TAG_DIMS[sizeId] || TAG_DIMS['57x32']
  return d.w < 100 || d.h < 80
}

// Which `show.*` fields can render at a given size — the single source of
// truth for both greying out UI toggles and masking the render itself.
export function getAvailableFields(sizeId) {
  if (!isCondensedSize(sizeId)) {
    return { boutique: true, name: true, brand: true, price: true, size: true, sku: true, barcode: true, madeInFlag: true, season: true, qr: true }
  }
  return { boutique: false, name: false, brand: true, price: true, size: false, sku: true, barcode: true, madeInFlag: false, season: false, qr: false }
}

// ── Style palettes ──────────────────────────────────────────────────────────
// `minimal` reproduces the original hardcoded boutique-tag colors exactly, so
// callers that never set `style` (e.g. PrintTagModal) render unchanged.
export const STYLE_PALETTES = {
  minimal:  { bg: '#FFFFFF', text: '#1A1209', sub: '#8C7B6B', border: '#ddd', divider: '#eee', accent: '#1A1209', caption: '#555', faint: '#aaa' },
  standard: { bg: '#FFFFFF', text: '#1A1209', sub: '#6E6E6E', border: '#DDDDDD', divider: 'rgba(0,0,0,.08)', accent: '#B3945A', caption: '#555', faint: '#aaa' },
  kraft:    { bg: '#E8DCC8', text: '#3A2A10', sub: '#7A6040', border: '#C8B898', divider: 'rgba(0,0,0,.1)', accent: '#8A6A30', caption: '#5C4826', faint: '#9C8862' },
  bold:     { bg: '#1A1209', text: '#FDFAF5', sub: 'rgba(255,255,255,.55)', border: 'transparent', divider: 'rgba(255,255,255,.15)', accent: '#B8955A', caption: 'rgba(255,255,255,.4)', faint: 'rgba(255,255,255,.3)' },
}

const PRICE_FONT_SIZES = { large: 16, medium: 13, small: 11 }

// ── EAN-13 encoder ──────────────────────────────────────────────────────────
// xmlns="http://www.w3.org/2000/svg" is the XML namespace identifier required
// by the SVG spec — it is NOT a fetched URL, just a canonical string.

const EAN13_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
const EAN13_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111']
const EAN13_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100']
const EAN13_PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL']

function ean13Checksum(digits12) {
  const arr = digits12.split('').map(Number)
  const sum = arr.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10
}

export function encodeEAN13(value) {
  const cleaned = String(value ?? '').replace(/\D/g, '')
  let digits = cleaned
  if (digits.length === 12) digits += ean13Checksum(digits)
  if (digits.length !== 13) return { valid: false, pattern: '', digits: '' }

  const first = Number(digits[0])
  const parity = EAN13_PARITY[first]
  let pattern = '101'
  for (let i = 1; i <= 6; i++) {
    const d = Number(digits[i])
    pattern += parity[i - 1] === 'L' ? EAN13_L[d] : EAN13_G[d]
  }
  pattern += '01010'
  for (let i = 7; i <= 12; i++) {
    pattern += EAN13_R[Number(digits[i])]
  }
  pattern += '101'

  return { valid: true, pattern, digits }
}

// ── Barcode SVG builder ─────────────────────────────────────────────────────
export function buildBarcodeSvg(value, format = 'ean13', { width = 200, height = 36, colour = '#1A1209' } = {}) {
  const encoded = format === 'ean13' ? encodeEAN13(value) : null
  const pattern = encoded?.valid
    ? encoded.pattern
    // Decorative fallback for non-EAN13 or invalid values.
    : '10111001101011001110110101011011101001010110110011101011001011'

  const barCount = pattern.length
  const barWidth = width / barCount

  const bars = pattern.split('').map((bit, i) =>
    bit === '1'
      ? `<rect x="${(i * barWidth).toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${height}" fill="${colour}"/>`
      : ''
  ).join('')

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%;height:100%;display:block">${bars}</svg>`,
    humanReadable: encoded?.valid
      ? `${encoded.digits[0]} ${encoded.digits.slice(1, 7)} ${encoded.digits.slice(7)}`
      : String(value ?? ''),
    valid: encoded?.valid ?? false,
  }
}

// ── QR SVG builder (async — qrcode lib is async) ────────────────────────────
export async function buildQrSvg(url, { size = 72, margin = 0, dark = '#1A1209', light = '#ffffff' } = {}) {
  try {
    const svg = await QRCode.toString(url ?? '', {
      type:                 'svg',
      errorCorrectionLevel: 'M',
      margin,
      width:                size,
      color:                { dark, light },
    })
    // Strip fixed width/height so it inherits from container.
    return svg
      .replace(/\s(width|height)="[^"]*"/g, '')
      .replace('<svg ', '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" ')
  } catch (err) {
    console.error('[buildQrSvg] failed:', err)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#eee"/></svg>`
  }
}

// ── Boutique hang-tag HTML ──────────────────────────────────────────────────
// Inline styles are intentional — this HTML is portable: it renders inside the
// modal (using the app's CSS context) AND inside the print window (a fresh
// document with no shared CSS). External classes would break the print flow.
export function buildBoutiqueTagHtml({
  sizeId       = '57x32',
  scale        = 1,
  style        = 'minimal',
  priceSize    = 'large',
  boutiqueName = '',
  boutiqueCity = '',
  productName  = '',
  brand        = '',
  category     = '',
  price        = 0,
  currency     = '€',
  size         = '',
  sku          = '',
  vendorSku    = '',
  madeIn       = 'Italy',
  season       = '',
  barcodeSvg   = '',
  barcodeText  = '',
  qrSvg        = '',
  qrUrl        = '',
  show: callerShow = {},
} = {}) {
  const d       = TAG_DIMS[sizeId] || TAG_DIMS['57x32']
  const w       = d.w * scale
  const fs      = scale
  const palette = STYLE_PALETTES[style] || STYLE_PALETTES.minimal
  // Legacy callers (PrintTagModal) pass a single `product` flag for both the
  // name and brand lines — honor it before applying the rest of callerShow.
  const legacyProduct = callerShow.product
  const show = {
    boutique: true, name: true, brand: true, price: true, size: true,
    sku: true, barcode: true, madeInFlag: true, season: false, qr: true,
    ...(legacyProduct !== undefined ? { name: legacyProduct, brand: legacyProduct } : {}),
    ...callerShow,
  }
  const priceFontSize = PRICE_FONT_SIZES[priceSize] || PRICE_FONT_SIZES.large

  if (isCondensedSize(sizeId)) {
    return buildCondensedTagHtml({ w, fs, palette, show, productName, brand, category, price, currency, priceFontSize, sku, barcodeSvg, barcodeText })
  }

  const originText = madeIn === 'Italy'
    ? `<div style="display:flex;align-items:center;gap:${Math.round(3*fs)}px">
         <div style="width:${Math.round(13*fs)}px;height:${Math.round(9*fs)}px;background:linear-gradient(to right,#009246 33%,#fff 33%,#fff 66%,#ce2b37 66%);border-radius:1px"></div>
         <div style="font-size:${Math.round(6*fs)}px;color:${palette.sub};font-weight:600;line-height:1.1">Made in Italy</div>
       </div>`
    : `<div style="font-size:${Math.round(6*fs)}px;color:${palette.sub};font-weight:600;line-height:1.1">Made in ${escapeHtml(madeIn)}</div>`

  // When the boutique header is shown, origin sits inline in its top-right
  // corner (matches the original layout). Otherwise it gets its own row
  // further down, so the toggle still works independently of the header.
  const header = show.boutique
    ? `<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${palette.divider};padding-bottom:${Math.round(7*fs)}px;margin-bottom:${Math.round(8*fs)}px">
         <div>
           <div style="font-size:${Math.round(15*fs)}px;font-weight:600;color:${palette.text};letter-spacing:${Math.round(1*fs)}px;line-height:1.1">${escapeHtml(boutiqueName.toUpperCase())}</div>
           ${boutiqueCity ? `<div style="font-size:${Math.round(7*fs)}px;color:${palette.sub};letter-spacing:${Math.round(1.5*fs)}px;text-transform:uppercase">${escapeHtml(boutiqueCity)}</div>` : ''}
         </div>
         ${show.madeInFlag ? originText : ''}
       </div>`
    : ''

  const nameBlock = show.name
    ? `<div style="font-size:${Math.round(9*fs)}px;font-weight:700;color:${palette.text};margin-bottom:${Math.round(2*fs)}px">${escapeHtml(productName)}</div>`
    : ''

  const brandBlock = show.brand && (brand || category)
    ? `<div style="font-size:${Math.round(8*fs)}px;color:${palette.sub};margin-bottom:${Math.round(6*fs)}px">${[brand, category].filter(Boolean).map(escapeHtml).join(' · ')}</div>`
    : ''

  const priceBlock = show.price
    ? `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:${Math.round(8*fs)}px">
         ${(show.size && size) ? `<div>
           <div style="font-size:${Math.round(7*fs)}px;color:${palette.sub};text-transform:uppercase;letter-spacing:${Math.round(0.5*fs)}px">Size</div>
           <div style="font-size:${Math.round(13*fs)}px;font-weight:700;color:${palette.text}">${escapeHtml(size)}</div>
         </div>` : '<div></div>'}
         <div style="text-align:right">
           <div style="font-size:${Math.round(7*fs)}px;color:${palette.sub};text-transform:uppercase;letter-spacing:${Math.round(0.5*fs)}px">Price</div>
           <div style="font-size:${Math.round(priceFontSize*fs)}px;font-weight:700;color:${palette.text}">${escapeHtml(currency)}${formatPrice(price)}</div>
         </div>
       </div>`
    : ''

  const skuBlock = show.sku
    ? `<div style="font-size:${Math.round(7*fs)}px;color:${palette.sub};margin-bottom:${Math.round(6*fs)}px">SKU: ${escapeHtml(sku)}${vendorSku ? ` · Vendor: ${escapeHtml(vendorSku)}` : ''}</div>`
    : ''

  const barcodeBlock = show.barcode && barcodeSvg
    ? `<div style="text-align:center;margin-bottom:${Math.round(6*fs)}px">
         <div style="height:${Math.round(36*fs)}px;overflow:hidden">${barcodeSvg}</div>
         <div style="font-size:${Math.round(7*fs)}px;color:${palette.caption};letter-spacing:${Math.round(1.5*fs)}px;margin-top:${Math.round(2*fs)}px">${escapeHtml(barcodeText)}</div>
       </div>`
    : ''

  // Already rendered inline in the header when show.boutique is true.
  const originBlock = show.madeInFlag && !show.boutique
    ? `<div style="margin-bottom:${Math.round(4*fs)}px">${originText}</div>`
    : ''

  const seasonBlock = show.season && season
    ? `<div style="font-size:${Math.round(6.5*fs)}px;color:${palette.sub};margin-bottom:${Math.round(4*fs)}px">${escapeHtml(season)}</div>`
    : ''

  const qrSize = Math.round(36 * fs)
  const qrUrlDisplay = String(qrUrl ?? '').replace(/^https?:\/\//, '')
  const qrBlock = show.qr && qrSvg
    ? `<div style="display:flex;align-items:center;gap:${Math.round(8*fs)}px;border-top:1px solid ${palette.divider};padding-top:${Math.round(7*fs)}px;margin-top:${Math.round(4*fs)}px;overflow:hidden">
         <div style="width:${qrSize}px;height:${qrSize}px;flex-shrink:0;overflow:hidden">
           <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${qrSvg}</div>
         </div>
         <div style="flex:1;min-width:0;overflow:hidden">
           <div style="font-size:${Math.round(6*fs)}px;color:${palette.sub};font-weight:600;text-transform:uppercase;letter-spacing:${Math.round(0.5*fs)}px;line-height:1.2">Scan to view on Mi Italia</div>
           <div style="font-size:${Math.round(5.5*fs)}px;color:${palette.faint};margin-top:${Math.round(1*fs)}px;line-height:1.2;word-break:break-all;overflow:hidden">${escapeHtml(qrUrlDisplay)}</div>
         </div>
       </div>`
    : ''

  const topAccent = style === 'standard' ? `border-top:3px solid ${palette.accent};` : ''

  return `<div style="width:${w}px;background:${palette.bg};border:1.5px solid ${palette.border};${topAccent}border-radius:${Math.round(6*fs)}px;padding:${Math.round(12*fs)}px;font-family:'Jost',system-ui,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,0.08);box-sizing:border-box">
    ${header}${nameBlock}${brandBlock}${priceBlock}${skuBlock}${barcodeBlock}${originBlock}${seasonBlock}${qrBlock}
  </div>`
}

// ── Condensed layout ─────────────────────────────────────────────────────────
// For labels too small to fit the full boutique layout: a brand/price row,
// SKU, and (if room) a small barcode. Mirrors the legacy PriceTags narrow mode.
function buildCondensedTagHtml({ w, fs, palette, show, productName, brand, category, price, currency, priceFontSize, sku, barcodeSvg, barcodeText }) {
  const brandLabel = brand || category || productName || ''
  // Stacked, not side-by-side: at these widths the price text alone can
  // approach the tag's full inner width, so a flex row would starve the
  // brand label of space no matter how it's told to shrink. Most condensed
  // sizes are tall-narrow anyway (e.g. 19×51, 25×54), so vertical space is
  // the more abundant axis here.
  const brandBlock = show.brand && brandLabel
    ? `<div style="font-size:${Math.round(8*fs)}px;letter-spacing:${Math.round(2*fs)}px;text-transform:uppercase;color:${palette.text};font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(brandLabel)}</div>`
    : ''

  const priceBlock = show.price
    ? `<div style="font-size:${Math.round(Math.min(priceFontSize, 14)*fs)}px;font-weight:700;color:${palette.text};margin-top:${brandBlock ? Math.round(2*fs) : 0}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(currency)}${formatPrice(price)}</div>`
    : ''

  const skuBlock = show.sku && sku
    ? `<div style="font-size:${Math.round(6.5*fs)}px;color:${palette.sub};margin-top:${Math.round(2*fs)}px">SKU: ${escapeHtml(sku)}</div>`
    : ''

  const barcodeBlock = show.barcode && barcodeSvg
    ? `<div style="text-align:center;margin-top:${Math.round(4*fs)}px">
         <div style="height:${Math.round(22*fs)}px;overflow:hidden">${barcodeSvg}</div>
         <div style="font-size:${Math.round(6*fs)}px;color:${palette.caption};letter-spacing:${Math.round(1*fs)}px;margin-top:${Math.round(1*fs)}px">${escapeHtml(barcodeText)}</div>
       </div>`
    : ''

  return `<div style="width:${w}px;background:${palette.bg};border:1px solid ${palette.border};border-radius:${Math.round(4*fs)}px;padding:${Math.round(7*fs)}px ${Math.round(9*fs)}px;font-family:'Jost',system-ui,sans-serif;box-sizing:border-box">
    ${brandBlock}${priceBlock}${skuBlock}${barcodeBlock}
  </div>`
}

// ── Print flow ──────────────────────────────────────────────────────────────
// Loads the same self-hosted fonts as the app (from /fonts/ on the same origin
// as the opener). Awaits document.fonts.ready before printing so the print
// output uses the real fonts, not fallbacks.
export function openPrintWindow(tagsHtml, sizeId = '57x32') {
  const d = TAG_DIMS[sizeId] || TAG_DIMS['57x32']
  const pw = window.open('', '_blank', 'width=800,height=600')
  if (!pw) return false

  const origin = window.location.origin

  pw.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <style>
      @font-face { font-family: 'Jost'; font-style: normal; font-weight: 400; font-display: swap; src: url('${origin}/fonts/jost-400.woff2') format('woff2'); }
      @font-face { font-family: 'Jost'; font-style: normal; font-weight: 500; font-display: swap; src: url('${origin}/fonts/jost-500.woff2') format('woff2'); }
      @font-face { font-family: 'Jost'; font-style: normal; font-weight: 600; font-display: swap; src: url('${origin}/fonts/jost-600.woff2') format('woff2'); }
      @font-face { font-family: 'Jost'; font-style: normal; font-weight: 700; font-display: swap; src: url('${origin}/fonts/jost-700.woff2') format('woff2'); }

      @page { size: ${d.wMM}mm ${d.hMM}mm; margin: 0; }
      body     { margin: 0; padding: 0; font-family: 'Montserrat', sans-serif; }
      .tag-wrap { display: inline-block; page-break-after: always; }
    </style></head><body>
    ${tagsHtml.map(t => `<div class="tag-wrap">${t}</div>`).join('')}
    <script>
      window.onload = function () {
        var doPrint = function () { setTimeout(function () { window.print(); }, 100); };
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(doPrint);
        } else {
          doPrint();
        }
      };
    <\/script>
    </body></html>`)
  pw.document.close()
  return true
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatPrice(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}