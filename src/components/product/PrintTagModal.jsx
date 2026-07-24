import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from '../../lib/api'
import {
  TAG_DIMS,
  buildBarcodeSvg,
  buildQrSvg,
  buildBoutiqueTagHtml,
  openPrintWindow,
} from '../../lib/tagPrint'

const API = import.meta.env.VITE_API_URL

// Print sizes exposed in the modal (rich boutique tag layouts fit well here).
// Feel free to add/remove; every entry must exist in TAG_DIMS.
const SIZE_OPTIONS = [
  { id: '57x32',  label: '57×32mm'  },
  { id: '90x55',  label: '90×55mm'  },
  { id: '100x70', label: '100×70mm' },
]

// Field toggles surfaced to the user (map to `show.*` in buildBoutiqueTagHtml).
const FIELD_OPTIONS = [
  { key: 'boutique',   label: 'Boutique name & city' },
  { key: 'product',    label: 'Product name & brand' },
  { key: 'price',      label: 'Price' },
  { key: 'barcode',    label: 'Barcode (for POS scanning)' },
  { key: 'madeInFlag', label: 'Made in Italy flag' },
  { key: 'qr',         label: 'QR code (links to Mi Italia listing)' },
  { key: 'sku',        label: 'SKU & Vendor SKU' },
]

/**
 * Props:
 *   isOpen         boolean — controls visibility
 *   onClose        () => void — parent-driven close
 *   product        { name, sku, retailPrice, madeIn, barcodeValue, barcodeFormat, vendorSku, ... }
 *   category       { l1, l2, l3, l4[] } — from AddProduct state
 *   brand          string — brand name (Fortela, etc.)
 *   sizes          [{ size }] — available sizes for the "Size to print" dropdown
 *   productId      string — used in QR URL; may be null in add-mode (before save)
 */
export default function PrintTagModal({
  isOpen,
  onClose,
  product   = {},
  category  = null,
  brand     = '',
  sizes     = [],
  productId = null,
}) {
  const [boutique,    setBoutique]     = useState({ name: '', city: '' })
  const [sizeId,      setSizeId]       = useState('57x32')
  const [sizeToPrint, setSizeToPrint]  = useState('ALL')
  const [qty,         setQty]          = useState(1)
  const [fields,      setFields]       = useState({
    boutique: true, product: true, price: true, barcode: true, madeInFlag: true, qr: true, sku: true,
  })
  const [qrSvg,       setQrSvg]        = useState('')
  const [previewHtml, setPreviewHtml]  = useState('')

  // ── Fetch boutique profile once when modal first opens ────────────────────
  useEffect(() => {
    if (!isOpen || boutique.name) return
    apiFetch(`${API}/boutique/profile`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) {
          setBoutique({
            name: res.data?.name ?? '',
            city: res.data?.city ?? '',
          })
        }
      })
      .catch(err => console.error('[PrintTagModal] profile fetch failed:', err))
  }, [isOpen, boutique.name])

  // ── QR URL: prefer product page by ID; fall back to SKU-based route ───────
  const qrUrl = useMemo(() => {
    if (productId) return `https://miitalia.com/product/${productId}`
    if (product.sku) return `https://miitalia.com/p/${product.sku}`
    return 'https://miitalia.com'
  }, [productId, product.sku])

  // Preview scale — enlarge up to 1.5x for readability, but shrink to fit
  // the preview column when the tag exceeds container width.
  const previewScale = useMemo(() => {
    const PREVIEW_CONTAINER_W = 260  // px; accounts for .ptm-preview-wrap padding
    const NATURAL_SCALE       = 1.5
    const baseWidth = TAG_DIMS[sizeId]?.w ?? 171
    const naturalWidth = baseWidth * NATURAL_SCALE
    return naturalWidth <= PREVIEW_CONTAINER_W
      ? NATURAL_SCALE
      : PREVIEW_CONTAINER_W / baseWidth
  }, [sizeId])

  // ── Regenerate QR SVG whenever URL changes ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    buildQrSvg(qrUrl, { size: 72 }).then(svg => {
      if (!cancelled) setQrSvg(svg)
    })
    return () => { cancelled = true }
  }, [isOpen, qrUrl])

  // ── Category path string ("Men's · Accessories") ──────────────────────────
  const categoryPath = useMemo(() => {
    if (!category) return ''
    return [category.l1, category.l2, category.l3].filter(Boolean).join(' · ')
  }, [category])

  // ── Barcode SVG + human-readable digits ───────────────────────────────────
  const barcode = useMemo(() => {
    if (!product.barcodeValue) {
      return { svg: '', humanReadable: '', valid: false }
    }
    return buildBarcodeSvg(
      product.barcodeValue,
      (product.barcodeFormat || 'ean13').toLowerCase(),
      { width: 200, height: 36 }
    )
  }, [product.barcodeValue, product.barcodeFormat])

  // ── Which sizes to print, in what quantity ────────────────────────────────
  // Returns an array of { size, count } entries.
  const printJobs = useMemo(() => {
    const q = Math.max(1, Number(qty) || 1)
    if (sizeToPrint === 'ALL') {
      const list = sizes.length > 0 ? sizes.map(s => s.size) : ['One Size']
      return list.map(s => ({ size: s, count: q }))
    }
    return [{ size: sizeToPrint, count: q }]
  }, [sizes, sizeToPrint, qty])

  const totalTags = printJobs.reduce((s, j) => s + j.count, 0)

  // ── Rebuild the preview whenever any input changes ────────────────────────
  // We show ONE preview (the first job's first tag) — mirrors the mockup.
  useEffect(() => {
    if (!isOpen) return
    const firstSize = printJobs[0]?.size ?? 'One Size'
    const html = buildBoutiqueTagHtml({
      sizeId,
      scale:        previewScale,
      boutiqueName: boutique.name || 'BOUTIQUE',
      boutiqueCity: boutique.city,
      productName:  product.name || 'Product Name',
      brand,
      category:     categoryPath,
      price:        product.retailPrice ?? 0,
      currency:     '€',
      size:         firstSize,
      sku:          product.sku ?? '',
      vendorSku:    product.vendorSku ?? '',
      madeIn:       product.madeIn ?? '',
      barcodeSvg:   barcode.svg,
      barcodeText:  barcode.humanReadable,
      qrSvg,
      qrUrl,
      show:         fields,
    })
    setPreviewHtml(html)
  }, [isOpen, sizeId, printJobs, boutique, product, brand, categoryPath, barcode, qrSvg, qrUrl, fields, previewScale])

  function toggleField(key) {
    setFields(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handlePrint() {
    if (totalTags === 0) return

    const tags = []
    printJobs.forEach(job => {
      for (let i = 0; i < job.count; i++) {
        tags.push(buildBoutiqueTagHtml({
          sizeId,
          scale:        previewScale, // real print size
          boutiqueName: boutique.name,
          boutiqueCity: boutique.city,
          productName:  product.name ?? '',
          brand,
          category:     categoryPath,
          price:        product.retailPrice ?? 0,
          currency:     '€',
          size:         job.size,
          sku:          product.sku ?? '',
          vendorSku:    product.vendorSku ?? '',
          madeIn:       product.madeIn ?? '',
          barcodeSvg:   barcode.svg,
          barcodeText:  barcode.humanReadable,
          qrSvg,
          qrUrl,
          show:         fields,
        }))
      }
    })

    const opened = openPrintWindow(tags, sizeId)
    if (!opened) {
      alert('Popup blocked — please allow popups for this site to print tags.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal ptm-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">Print <em>Product Tag</em></div>
          <div className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </div>
        </div>

        <div className="ptm-body">

          {/* ── LEFT: Preview ─────────────────────────────────────────── */}
          <div>
            <div className="ptm-section-lbl">Tag Preview</div>

            <div className="ptm-size-picker">
              <span className="ptm-size-picker-lbl">Print size:</span>
              {SIZE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`btn btn-sm btn-outline ptm-size-btn${sizeId === opt.id ? ' act' : ''}`}
                  onClick={() => setSizeId(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="ptm-preview-wrap">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>

            <div className="ptm-preview-hint">
              Print on {SIZE_OPTIONS.find(s => s.id === sizeId)?.label} label paper · Dymo / Zebra / Brother compatible
            </div>

            {product.barcodeValue && !barcode.valid && (
              <div className="ptm-barcode-warn">
                ⚠ Barcode value doesn't match {product.barcodeFormat?.toUpperCase() || 'EAN-13'} format — pattern is decorative and may not scan.
              </div>
            )}
          </div>

          {/* ── RIGHT: Settings ───────────────────────────────────────── */}
          <div>
            <div className="ptm-section-lbl">Tag Settings</div>

            <div className="form-group">
              <label className="form-lbl">Size to print</label>
              <select
                className="form-select"
                value={sizeToPrint}
                onChange={e => setSizeToPrint(e.target.value)}
              >
                <option value="ALL">All sizes ({sizes.map(s => s.size).join(', ') || 'One Size'})</option>
                {sizes.map(s => (
                  <option key={s.size} value={s.size}>Size {s.size} only</option>
                ))}
                {sizes.length === 0 && <option value="One Size">One Size only</option>}
              </select>
            </div>

            <div className="form-group">
              <label className="form-lbl">Quantity per size</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="50"
                value={qty}
                onChange={e => setQty(e.target.value)}
                onWheel={e => e.target.blur()}
              />
            </div>

            <div className="ptm-section-lbl ptm-section-lbl-mt">Show on tag</div>
            <div className="ptm-fields-list">
              {FIELD_OPTIONS.map(f => (
                <label key={f.key} className="ptm-field-lbl">
                  <input
                    type="checkbox"
                    checked={!!fields[f.key]}
                    onChange={() => toggleField(f.key)}
                    className="ptm-field-cb"
                  />
                  {f.label}
                </label>
              ))}
            </div>

            <div className="ptm-footer-btns">
              <button className="btn btn-dark ptm-flex-1" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary ptm-flex-1" onClick={handlePrint} disabled={totalTags === 0}>
                <span className="material-symbols-outlined">print</span>
                Print {totalTags} tag{totalTags !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
