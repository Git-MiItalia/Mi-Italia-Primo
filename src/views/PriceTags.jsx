import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import {
  TAG_DIMS,
  STYLE_PALETTES,
  getAvailableFields,
  buildBarcodeSvg,
  buildQrSvg,
  buildBoutiqueTagHtml,
  openPrintWindow,
} from '../lib/tagPrint'

const API = import.meta.env.VITE_API_URL

/* ── PRINTER DATA (static — no API needed) ── */
const PRINTERS = {
  dymo: {
    name:'Dymo LabelWriter 550', connection:'USB / Wi-Fi · Thermal',
    sizes:[
      { id:'57x32', name:'57mm × 32mm', dims:'57×32', use:'Standard price tag · item labels', rec:true },
      { id:'25x54', name:'25mm × 54mm', dims:'25×54', use:'Narrow hanging tag' },
      { id:'19x51', name:'19mm × 51mm', dims:'19×51', use:'Jewellery / small accessories' },
      { id:'89x28', name:'89mm × 28mm', dims:'89×28', use:'Long narrow label' },
    ],
    stock:'Dymo 30334 (57×32), 30336 (25×54), 30299 (19×51)',
    setup:'Connect USB or pair via Wi-Fi. Primo connects via Dymo Connect SDK (Windows/Mac). No driver installation needed on Mac OS 12+.',
  },
  brother: {
    name:'Brother QL-820NWB', connection:'Wi-Fi · Bluetooth · USB · Thermal',
    sizes:[
      { id:'62x29',  name:'62mm × 29mm',  dims:'62×29',  use:'Standard price tag', rec:true },
      { id:'62x100', name:'62mm × 100mm', dims:'62×100', use:'Full product label' },
      { id:'29x90',  name:'29mm × 90mm',  dims:'29×90',  use:'Narrow price tag' },
    ],
    stock:'Brother DK-11209 (29mm), DK-11209 (62mm). Pre-cut rolls only.',
    setup:'Connect via Wi-Fi or Bluetooth. Primo uses AirPrint on iPad. Install Brother iPrint&Label for direct wireless printing.',
  },
  zebra: {
    name:'Zebra ZD421', connection:'USB · Ethernet · Bluetooth · Thermal',
    sizes:[
      { id:'51x25', name:'51mm × 25mm (2″ × 1″)',       dims:'51×25', use:'Standard retail tag · barcode labels', rec:true },
      { id:'57x32', name:'57mm × 32mm (2.25″ × 1.25″)', dims:'57×32', use:'Price tag with more info' },
      { id:'76x51', name:'76mm × 51mm (3″ × 2″)',       dims:'76×51', use:'Full label · shipping / product' },
    ],
    stock:'Zebra Z-Select 2000D direct thermal. Order in rolls of 2580 (51×25) or 1890 (76×51).',
    setup:'Connect via USB or Ethernet. Install Zebra ZPL driver. Primo sends ZPL commands directly. No print dialog shown — labels print immediately.',
  },
  avery: {
    name:'Standard Printer (Avery Sheets)', connection:'Any laser or inkjet printer',
    sizes:[
      { id:'38x21', name:'38.1mm × 21.2mm', dims:'38×21', use:'65 labels / A4 sheet · Avery L7159' },
      { id:'70x37', name:'70mm × 37mm',      dims:'70×37', use:'24 labels / A4 sheet · price tag size', rec:true },
      { id:'35x35', name:'35mm × 35mm',      dims:'35×35', use:'40 labels / A4 sheet · square tag' },
      { id:'55x85', name:'55mm × 85mm',      dims:'55×85', use:'Hang tag / 10 per A4 sheet' },
    ],
    stock:'Avery L7159 (38×21), Avery J8651 (38×21), Avery L7168 (70×37). Available at any office supplier.',
    setup:'No special setup. Download the matching Avery Word/PDF template to align labels precisely. Use at 100% scale. Laser or inkjet both work — inkjet gives colour.',
  },
}

// SCENES and STYLES moved inside component for t() access

// Designer field keys → buildBoutiqueTagHtml's `show.*` keys.
const FIELD_TO_SHOW = {
  boutique: 'boutique', brand: 'brand', name: 'name', price: 'price',
  size: 'size', sku: 'sku', barcode: 'barcode', origin: 'madeInFlag',
  season: 'season', qr: 'qr',
}

const PRINTER_CARDS = [
  { id:'dymo',    ico:'🖨️', name:'Dymo LabelWriter 550',  type:'Thermal · USB / Wireless',     badge:'⭐ Most popular',      badgeBg:'rgba(0,108,53,.09)',   badgeColor:'var(--green)', desc:'No ink needed. Fast, quiet. Direct Primo integration available.' },
  { id:'brother', ico:'🖨️', name:'Brother QL-820NWB',     type:'Thermal · Wi-Fi / Bluetooth',  badge:'📶 Wireless',          badgeBg:'rgba(26,79,191,.08)',  badgeColor:'var(--blue)',  desc:'Print from iPad or phone. Great for boutiques without a fixed desk.' },
  { id:'zebra',   ico:'🖨️', name:'Zebra ZD421',           type:'Thermal · USB / Ethernet',     badge:'Pro',                  badgeBg:'rgba(184,149,90,.1)', badgeColor:'#8A6A30',      desc:'Industry standard for multi-location retail. High volume, durable.' },
  { id:'avery',   ico:'🖳',  name:'Standard Printer',      type:'Laser / Inkjet · A4 Sheet',    badge:'No special hardware',  badgeBg:'var(--mist)',          badgeColor:'var(--stone)', desc:'Use Avery label sheets. Any office printer. Full colour available.' },
]

function SectionDivider({ label }) {
  return (
    <div className="pt-section-divider">
      {label}
      <span className="pt-section-line" />
    </div>
  )
}

function Toggle({ on, onToggle, disabled }) {
  return (
    <div
      className={`toggle${on ? ' on' : ''}${disabled ? ' toggle-disabled' : ''}`}
      onClick={disabled ? undefined : onToggle}
    >
      <div className="toggle-knob" />
    </div>
  )
}

export default function PriceTags() {
  const { t, i18n } = useTranslation()

  const SCENES = [
    { key:'setup',    label: t('pt.scenes.setup')    },
    { key:'designer', label: t('pt.scenes.designer') },
    { key:'select',   label: t('pt.scenes.select')   },
    { key:'preview',  label: t('pt.scenes.preview')  },
  ]

  const STYLES = [
    { key:'minimal',  label: t('pt.styles.minimal')  },
    { key:'standard', label: t('pt.styles.standard') },
    { key:'bold',     label: t('pt.styles.bold')     },
    { key:'kraft',    label: t('pt.styles.kraft')    },
  ]

  const [scene, setScene]         = useState('setup')
  const [printer, setPrinter]     = useState('dymo')
  const [labelSize, setLabelSize] = useState('57x32')
  const [style, setStyle]         = useState('minimal')
  const [currency, setCurrency]   = useState('€')
  const [priceSize, setPriceSize] = useState('large')
  const [fields, setFields]       = useState({ boutique:true, brand:true, name:true, price:true, size:true, sku:true, barcode:false, origin:false, season:false, qr:false })
  const [qrMap, setQrMap]         = useState({})
  const [products, setProducts]   = useState([])
  const [search, setSearch]       = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [loading, setLoading]     = useState(true)
  const [boutiqueName, setBoutiqueName] = useState('')
  const [boutiqueCity, setBoutiqueCity] = useState('')
  const [brandList, setBrandList] = useState([])

  const printerData = PRINTERS[printer]
  const dim         = TAG_DIMS[labelSize] || TAG_DIMS['57x32']

  // Fetch products + profile on mount
  useEffect(() => {
    Promise.all([
      apiFetch(`${API}/boutique/products`).then(r => r.json()),
      apiFetch(`${API}/boutique/profile`).then(r => r.json()),
    ]).then(([prodRes, profRes]) => {
      if (profRes.success) {
        setBoutiqueName(profRes.data.name || '')
        setBoutiqueCity(profRes.data.city || '')
        if (profRes.data.currency === 'GBP') setCurrency('£')
        else if (profRes.data.currency === 'USD') setCurrency('$')
        else if (profRes.data.currency === 'CHF') setCurrency('CHF')
      }

      if (prodRes.success) {
        const mapped = (prodRes.data.products || [])
          .filter(p => p.status === 'active')
          .map(p => ({
            id:      p.id,
            name:    p.name,
            sku:     p.sku || '—',
            price:   parseFloat(p.retail_price) || 0,
            brand:   p.brand_name || '',
            madeIn:  p.made_in || 'Italy',
            barcodeValue:  p.barcode ?? '',
            barcodeFormat: p.barcode_format ?? '',
            photo:   p.main_photo || null,
            stock:   parseInt(p.total_stock) || 0,
            variants: parseInt(p.variant_count) || 1,
            size:    '',
            checked: false,
            qty:     1,
          }))
        setProducts(mapped)

        // Build unique brand list for filter
        const brands = [...new Set(mapped.map(p => p.brand).filter(Boolean))].sort()
        setBrandList(brands)
      }
    })
    .catch(() => {})
    .finally(() => setLoading(false))
  }, [i18n.language])

  const SAMPLE = products[0] || { id: null, name: boutiqueName || 'Sample Product', price: 890, sku: 'SKU-001', size: 'M', brand: boutiqueName, madeIn: 'Italy', barcodeValue: '', barcodeFormat: '' }

  const toggleField = key => setFields(f => ({ ...f, [key]: !f[key] }))
  const filtered    = products.filter(p =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())) &&
    (!brandFilter || p.brand === brandFilter)
  )

  function toggleProd(id, checked) { setProducts(prev => prev.map(p => p.id===id ? {...p, checked} : p)) }
  function setQty(id, val)         { setProducts(prev => prev.map(p => p.id===id ? {...p, qty:Math.max(1,parseInt(val)||1)} : p)) }
  function toggleAll(checked)      { setProducts(prev => prev.map(p => filtered.some(f => f.id === p.id) ? {...p, checked} : p)) }
  function clearAll()              { setProducts(prev => prev.map(p => ({...p, checked:false}))) }

  const selected  = products.filter(p => p.checked)
  const totalTags = selected.reduce((s, p) => s + p.qty, 0)

  const availableFields = getAvailableFields(labelSize)
  const palette = STYLE_PALETTES[style] || STYLE_PALETTES.minimal

  // Fetch/refresh QR codes for whichever products currently need one.
  const qrTargets = fields.qr ? [SAMPLE, ...selected].filter(p => p && p.id != null) : []
  const qrTargetKey = qrTargets.map(p => p.id).join(',')
  useEffect(() => {
    if (!qrTargets.length) return
    let cancelled = false
    const missing = qrTargets.filter(p => !qrMap[p.id])
    if (!missing.length) return
    Promise.all(missing.map(async p => {
      const svg = await buildQrSvg(`https://miitalia.com/product/${p.id}`, { size: 72, dark: palette.text, light: palette.bg })
      return [p.id, svg]
    })).then(entries => {
      if (cancelled) return
      setQrMap(prev => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrTargetKey, style])

  function buildShow() {
    const show = {}
    for (const [fieldKey, showKey] of Object.entries(FIELD_TO_SHOW)) {
      show[showKey] = !!fields[fieldKey] && availableFields[showKey] !== false
    }
    return show
  }

  function buildTag(prod, scale, qrMapOverride = qrMap) {
    const barcode = buildBarcodeSvg(prod.barcodeValue, (prod.barcodeFormat || 'ean13').toLowerCase(), { width: 200, height: 36, colour: palette.text })
    return buildBoutiqueTagHtml({
      sizeId:       labelSize,
      scale,
      style,
      priceSize,
      boutiqueName,
      boutiqueCity,
      productName:  prod.name,
      brand:        prod.brand,
      price:        prod.price,
      currency,
      size:         prod.size,
      sku:          prod.sku,
      madeIn:       prod.madeIn,
      season:       'SS 2026',
      barcodeSvg:   barcode.svg,
      barcodeText:  barcode.humanReadable,
      qrSvg:        prod.id != null ? (qrMapOverride[prod.id] || '') : '',
      qrUrl:        prod.id != null ? `https://miitalia.com/product/${prod.id}` : 'https://miitalia.com',
      show:         buildShow(),
    })
  }

  async function printTags() {
    if (!selected.length) { alert(t('pt.no_products_alert')); return }

    let freshQrMap = qrMap
    if (fields.qr) {
      const missing = selected.filter(p => p.id != null && !qrMap[p.id])
      if (missing.length) {
        const entries = await Promise.all(missing.map(async p => {
          const svg = await buildQrSvg(`https://miitalia.com/product/${p.id}`, { size: 72, dark: palette.text, light: palette.bg })
          return [p.id, svg]
        }))
        freshQrMap = { ...qrMap, ...Object.fromEntries(entries) }
        setQrMap(freshQrMap)
      }
    }

    const tags = []
    selected.forEach(p => { for (let i = 0; i < p.qty; i++) tags.push(buildTag(p, 1, freshQrMap)) })
    const opened = openPrintWindow(tags, labelSize)
    if (!opened) alert('Popup blocked — please allow popups for this site to print tags.')
  }

  return (
    <>
      {/* Scene bar */}
      <div className="pt-scene-bar">
        {SCENES.map(s => (
          <button key={s.key} onClick={() => setScene(s.key)} className={`pt-scene-btn${scene===s.key?' act':''}`}>
            {s.label}
          </button>
        ))}
        <div className="pt-scene-actions">
          <button className="btn btn-outline btn-sm pt-setup-btn" onClick={() => setScene('setup')}>
            <span className="material-symbols-outlined">settings</span>{t('pt.printer_setup')}
          </button>
          <button className="btn pt-print-btn" onClick={printTags}>
            <span className="material-symbols-outlined">print</span>{t('pt.print_selected')}
          </button>
        </div>
      </div>

      {/* ══ 1. PRINTER SETUP ══ */}
      {scene === 'setup' && (
        <>
          <SectionDivider label={t('pt.setup.select_printer')} />
          <div className="pt-printer-grid">
            {PRINTER_CARDS.map(pc => (
              <div key={pc.id} onClick={() => { setPrinter(pc.id); setLabelSize(PRINTERS[pc.id].sizes[0].id) }}
                className={`pt-printer-card${printer===pc.id?' sel':''}`}>
                <div className="pt-printer-ico">{pc.ico}</div>
                <div className="pt-printer-name">{pc.name}</div>
                <div className="pt-printer-type">{pc.type}</div>
                <div className="pt-printer-badge" style={{ background:pc.badgeBg, color:pc.badgeColor }}>{pc.badge}</div>
                <div className="pt-printer-desc">{pc.desc}</div>
              </div>
            ))}
          </div>

          <div className="grid2">
            <div>
              <SectionDivider label={t('pt.setup.label_size')} />
              <div className="pt-size-list">
                {printerData.sizes.map(s => {
                  const d  = TAG_DIMS[s.id] || TAG_DIMS['57x32']
                  const vw = Math.min(Math.round(d.w * 0.7), 90)
                  const vh = Math.min(Math.round(d.h * 0.7), 60)
                  return (
                    <div key={s.id} onClick={() => setLabelSize(s.id)} className={`pt-size-row${labelSize===s.id?' sel':''}`}>
                      <div className={`pt-size-radio${labelSize===s.id?' sel':''}`}>
                        {labelSize===s.id && <div className="pt-size-radio-dot" />}
                      </div>
                      <div className="pt-size-visual" style={{ width:vw, height:vh }}>
                        <span className="pt-size-dims">{d.wMM}×{d.hMM}</span>
                      </div>
                      <div className="pt-size-info">
                        <div className="pt-size-name">{s.name}</div>
                        <div className="pt-size-use">{s.use}</div>
                        <div className="pt-size-mm">{s.dims}mm</div>
                      </div>
                      {s.rec && <span className="pt-size-rec">✓ {t('pt.setup.recommended')}</span>}
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <SectionDivider label={t('pt.setup.printer_status')} />
              <div className="card pt-status-card">
                <div className="pt-status-hdr">
                  <div className="pt-status-dot" />
                  <div className="pt-status-name">{printerData.name}</div>
                </div>
                <div className="pt-status-connection">{printerData.connection}</div>
                <div className="pt-status-setup">{printerData.setup}</div>
              </div>

              <SectionDivider label={t('pt.setup.stock_guide')} />
              <div className="pt-stock-guide">
                <strong className="pt-stock-title">{t('pt.setup.recommended_stock')}</strong><br />{printerData.stock}
              </div>

              <div className="pt-next-btn-wrap">
                <button className="btn btn-outline btn-sm pt-next-btn" onClick={() => setScene('designer')}>
                  {t('pt.setup.next_design')} →
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══ 2. TAG DESIGNER ══ */}
      {scene === 'designer' && (
        <div className="grid2 pt-designer-grid">
          <div>
            <SectionDivider label={t('pt.designer.tag_style')} />
            <div className="pt-styles-grid">
              {STYLES.map(s => {
                const p = STYLE_PALETTES[s.key]
                return (
                  <div key={s.key} onClick={() => setStyle(s.key)} className={`pt-style-card${style===s.key?' sel':''}`}>
                    <div className="pt-style-preview" style={{
                      background: p.bg,
                      border: `1px solid ${p.border}`,
                      borderTop: s.key === 'standard' ? `3px solid ${p.accent}` : undefined,
                    }}>
                      <div className="pt-style-preview-brand" style={{ color:p.sub }}>{boutiqueName || 'BOUTIQUE'}</div>
                      <div className="pt-style-preview-price" style={{ color:p.text }}>{currency}890</div>
                    </div>
                    <div className="pt-style-label">{s.label}</div>
                  </div>
                )
              })}
            </div>

            <SectionDivider label={t('pt.designer.fields')} />
            <div className="card pt-fields-card">
              {[
                { key:'boutique', label:t('pt.fields.boutique', 'Boutique Name & City'), sub: t('pt.fields.boutique_sub', 'Shown as the tag header') },
                { key:'brand',   label:t('pt.fields.brand'),   sub: boutiqueName ? `${boutiqueName} · ${t('pt.fields.brand_rec')}` : t('pt.fields.brand_sub') },
                { key:'name',    label:t('pt.fields.name'),    sub: t('pt.fields.name_sub') },
                { key:'price',   label:t('pt.fields.price'),   sub: t('pt.fields.price_sub') },
                { key:'size',    label:t('pt.fields.size'),    sub: t('pt.fields.size_sub') },
                { key:'sku',     label:t('pt.fields.sku'),     sub: t('pt.fields.sku_sub') },
                { key:'barcode', label:t('pt.fields.barcode'), sub: t('pt.fields.barcode_sub') },
                { key:'origin',  label:t('pt.fields.origin'),  sub: t('pt.fields.origin_sub') },
                { key:'season',  label:t('pt.fields.season'),  sub: t('pt.fields.season_sub') },
                { key:'qr',      label:t('pt.fields.qr', 'QR Code'),      sub: t('pt.fields.qr_sub', 'Links to this product on Mi Italia') },
              ].map((f, i, arr) => {
                const showKey    = FIELD_TO_SHOW[f.key]
                const isAvailable = availableFields[showKey] !== false
                return (
                  <div key={f.key} className={`pt-field-row${i < arr.length-1?' pt-field-border':''}${isAvailable?'':' pt-field-disabled'}`}>
                    <div>
                      <div className="pt-field-label">{f.label}</div>
                      <div className="pt-field-sub">{isAvailable ? f.sub : t('pt.fields.unavailable_at_size', 'Not available at this label size')}</div>
                    </div>
                    <Toggle on={fields[f.key]} onToggle={() => toggleField(f.key)} disabled={!isAvailable} />
                  </div>
                )
              })}
            </div>

            <SectionDivider label={t('pt.designer.price_display')} />
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('pt.designer.currency')}</label>
                <select className="form-select" value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option value="€">€ Euro</option>
                  <option value="£">£ Sterling</option>
                  <option value="$">$ USD</option>
                  <option value="CHF">CHF</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('pt.designer.price_size')}</label>
                <select className="form-select" value={priceSize} onChange={e => setPriceSize(e.target.value)}>
                  <option value="large">{t('pt.designer.price_large')}</option>
                  <option value="medium">{t('pt.designer.price_medium')}</option>
                  <option value="small">{t('pt.designer.price_small')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div>
            <SectionDivider label={`${t('pt.designer.preview')} — ${dim.wMM}mm × ${dim.hMM}mm`} />
            <div className="pt-preview-bg">
              <div dangerouslySetInnerHTML={{ __html: buildTag(SAMPLE, 3) }} />
              <div className="pt-preview-scale-note">{t('pt.designer.scale_note')}</div>
            </div>
            <div className="pt-preview-caption">{t('pt.designer.preview_caption')}</div>

            <SectionDivider label={t('pt.designer.hang_tag')} />
            <div className="pt-hang-tag-card">
              <div className="pt-hang-tag-hdr">
                <div className="pt-hang-tag-ico">🏷️</div>
                <div>
                  <div className="pt-hang-tag-title">{t('pt.designer.hang_tag_title')}</div>
                  <div className="pt-hang-tag-sub">{t('pt.designer.hang_tag_sub')}</div>
                </div>
              </div>
              <div className="pt-hang-tag-btns">
                <button className="btn btn-outline btn-sm">{t('pt.designer.design_hang_tag')}</button>
                <button className="btn btn-outline btn-sm">{t('pt.designer.download_template')}</button>
              </div>
            </div>

            <button className="btn pt-designer-next" onClick={() => setScene('select')}>
              {t('pt.designer.next_products')} →
            </button>
          </div>
        </div>
      )}

      {/* ══ 3. SELECT PRODUCTS ══ */}
      {scene === 'select' && (
        <>
          <div className="pt-select-toolbar">
            <input className="pt-select-search" placeholder={t('pt.select.search')} value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-select pt-select-cat" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
              <option value="">{t('pt.select.all_brands')}</option>
              {brandList.map(b => <option key={b} value={b}>{b}</option>)}
              <option value="__own">{t('pt.select.own_label')}</option>
            </select>
            <div className="pt-select-actions">
              <button className="btn btn-outline btn-sm" onClick={() => toggleAll(true)}>{t('pt.select.select_all')}</button>
              <button className="btn btn-outline btn-sm" onClick={clearAll}>{t('common.clear')}</button>
              <div className="pt-select-count">{selected.length} {t('pt.select.selected')} · {totalTags} {t('pt.select.tags')}</div>
            </div>
          </div>

          {loading ? (
            <div className="pt-loading">{t('common.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="pt-loading">{t('pt.select.no_products')}{search ? ` "${search}"` : ''}</div>
          ) : (
            <div className="card pt-product-table">
              <div className="pt-table-hdr">
                <input type="checkbox" className="pt-checkbox" onChange={e => toggleAll(e.target.checked)} />
                <div />
                {[t('pt.select.col_product'), t('pt.select.col_brand'), t('pt.select.col_price'), t('pt.select.col_tags'), ''].map((h, i) => (
                  <div key={i} className={`pt-th${h===t('pt.select.col_price') ? ' pt-th-right' : h===t('pt.select.col_tags') ? ' pt-th-center' : ''}`}>{h}</div>
                ))}
              </div>

              {filtered.map(p => (
                <div key={p.id} className={`pt-product-row${p.checked?' sel':''}`}>
                  <input type="checkbox" checked={p.checked} className="pt-checkbox" onChange={e => toggleProd(p.id, e.target.checked)} />
                  <div className="pt-product-emoji">
                    {p.photo
                      ? <img src={p.photo} alt="" className="pt-product-thumb" />
                      : <span className="material-symbols-outlined pt-product-thumb-icon">inventory_2</span>
                    }
                  </div>
                  <div>
                    <div className="pt-product-name">{p.name}</div>
                    <div className="pt-product-meta">{p.sku} · {p.stock} {t('pt.select.in_stock')}</div>
                  </div>
                  <div className="pt-product-cat">{p.brand || t('pt.select.own_label_short')}</div>
                  <div className="pt-product-price">{currency}{p.price.toLocaleString()}</div>
                  <div className="pt-product-qty-wrap">
                    <input type="number" value={p.qty} min="1" max="99" disabled={!p.checked}
                      onChange={e => setQty(p.id, e.target.value)}
                      className={`pt-qty-input${!p.checked?' disabled':''}`}
                      onWheel={e => e.target.blur()}
                    />
                  </div>
                  <div>
                    <button className="btn btn-outline btn-xs" onClick={() => { toggleProd(p.id, true); setScene('preview') }}>{t('common.preview')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-select-footer">
            <div>
              <div className="pt-select-footer-title">
                {t('pt.select.footer_count', { products: selected.length, tags: totalTags })}
              </div>
              <div className="pt-select-footer-sub">{printerData.name} · {dim.wMM}×{dim.hMM}mm · {style.charAt(0).toUpperCase()+style.slice(1)}</div>
            </div>
            <button className="btn pt-select-print-btn" onClick={() => setScene('preview')}>
              <span className="material-symbols-outlined">preview</span>{t('pt.select.preview_print')} →
            </button>
          </div>
        </>
      )}

      {/* ══ 4. PRINT PREVIEW ══ */}
      {scene === 'preview' && (
        <>
          <div className="pt-preview-topbar">
            <div>
              <div className="pt-preview-title">{t('pt.select.footer_count', { products: selected.length, tags: totalTags })}</div>
              <div className="pt-preview-subtitle">{printerData.name} · {dim.wMM}mm × {dim.hMM}mm</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setScene('select')}>
              <span className="material-symbols-outlined">arrow_back</span>{t('common.back')}
            </button>
            <button className="btn pt-print-btn" onClick={printTags}>
              <span className="material-symbols-outlined">print</span>{t('pt.preview.print_now')}
            </button>
          </div>

          <div className="clm-alert clm-alert-info pt-print-hint">
            <span className="material-symbols-outlined clm-alert-icon">print</span>
            <div>
              {t('pt.preview.hint_prefix')} <strong>{dim.wMM}mm × {dim.hMM}mm {t('pt.preview.hint_for')} {printerData.name}</strong>. {t('pt.preview.hint_suffix')}
            </div>
          </div>

          <div className="pt-preview-sheet">
            <div className="pt-preview-sheet-lbl">{t('pt.preview.sheet_label')} — {t('pt.preview.tag_count', { count: totalTags })}</div>
            <div className="pt-preview-tags">
              {selected.length === 0 ? (
                <div className="pt-preview-empty">{t('pt.preview.empty')}</div>
              ) : (
                selected.flatMap(p =>
                  Array.from({ length: p.qty }, (_, i) => (
                    <div key={`${p.id}-${i}`} className="pt-preview-tag-wrap"
                      dangerouslySetInnerHTML={{ __html: buildTag(p, 2.5) }}
                    />
                  ))
                )
              )}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes pulse{0%{opacity:1;}100%{opacity:.4;}}`}</style>
    </>
  )
}
