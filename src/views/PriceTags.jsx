import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/* ── DATA ── */
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

const TAG_DIMS = {
  '57x32':{w:171,h:96,wMM:57,hMM:32},'25x54':{w:75,h:162,wMM:25,hMM:54},
  '19x51':{w:57,h:153,wMM:19,hMM:51},'89x28':{w:267,h:84,wMM:89,hMM:28},
  '62x29':{w:186,h:87,wMM:62,hMM:29},'62x100':{w:186,h:300,wMM:62,hMM:100},
  '29x90':{w:87,h:270,wMM:29,hMM:90},'51x25':{w:153,h:75,wMM:51,hMM:25},
  '76x51':{w:228,h:153,wMM:76,hMM:51},'38x21':{w:114,h:63,wMM:38,hMM:21},
  '70x37':{w:210,h:111,wMM:70,hMM:37},'35x35':{w:105,h:105,wMM:35,hMM:35},
  '55x85':{w:165,h:255,wMM:55,hMM:85},
}

const INIT_PRODUCTS = [
  { id:1,  emoji:'🧥', name:'Cashmere Trench Coat — Camel',    cat:'Ready-to-Wear', price:1290, sku:'NEG-CTR-0008', size:'M',        checked:false, qty:1 },
  { id:2,  emoji:'👗', name:'Silk Slip Dress — Ivory',          cat:'Ready-to-Wear', price:680,  sku:'NEG-DRS-0021', size:'S',        checked:false, qty:1 },
  { id:3,  emoji:'🧥', name:'Velvet Evening Jacket — Midnight',  cat:'Ready-to-Wear', price:960,  sku:'NEG-JKT-0044', size:'M',        checked:false, qty:1 },
  { id:4,  emoji:'👔', name:'Tailored Linen Blazer — Navy',      cat:'Menswear',      price:890,  sku:'NEG-BLZ-0012', size:'42',       checked:false, qty:1 },
  { id:5,  emoji:'👕', name:'Wool Crewneck — Ivory',             cat:'Menswear',      price:340,  sku:'NEG-KNT-0033', size:'L',        checked:false, qty:2 },
  { id:6,  emoji:'👡', name:'Leather Mule — Cognac',             cat:'Footwear',      price:420,  sku:'NEG-SHO-0029', size:'38',       checked:false, qty:1 },
  { id:7,  emoji:'👢', name:'Suede Chelsea Boot — Tan',          cat:'Footwear',      price:520,  sku:'NEG-SHO-0031', size:'40',       checked:false, qty:1 },
  { id:8,  emoji:'👜', name:'Leather Tote — Camel',              cat:'Accessories',   price:560,  sku:'NEG-BAG-0007', size:'One Size', checked:false, qty:1 },
  { id:9,  emoji:'🧣', name:'Cashmere Scarf — Camel',            cat:'Accessories',   price:180,  sku:'NEG-ACC-0019', size:'One Size', checked:false, qty:3 },
  { id:10, emoji:'📿', name:'Gold Pendant Necklace',             cat:'Jewellery',     price:220,  sku:'NEG-JWL-0003', size:'45cm',     checked:false, qty:1 },
  { id:11, emoji:'💍', name:'Sterling Silver Cuff',              cat:'Jewellery',     price:180,  sku:'NEG-JWL-0006', size:'One Size', checked:false, qty:1 },
]

const SCENES = [
  { key:'setup',    label:'1 · Printer Setup' },
  { key:'designer', label:'2 · Tag Designer' },
  { key:'select',   label:'3 · Select Products' },
  { key:'preview',  label:'4 · Print Preview' },
]

const STYLES = [
  { key:'minimal',  label:'Minimal',   bg:'#FFFFFF', border:'1px solid #DDD' },
  { key:'standard', label:'Standard',  bg:'#FFFFFF', border:'1px solid #DDD' },
  { key:'bold',     label:'Bold Dark', bg:'#1A1209', border:'none' },
  { key:'kraft',    label:'Kraft',     bg:'#E8DCC8', border:'1px solid #C8B898' },
]

const PRINTER_CARDS = [
  { id:'dymo',    ico:'🖨️', name:'Dymo LabelWriter 550',  type:'Thermal · USB / Wireless',     badge:'⭐ Most popular',      badgeBg:'rgba(0,108,53,.09)',   badgeColor:'var(--green)', desc:'No ink needed. Fast, quiet. Direct Primo integration available.' },
  { id:'brother', ico:'🖨️', name:'Brother QL-820NWB',     type:'Thermal · Wi-Fi / Bluetooth',  badge:'📶 Wireless',          badgeBg:'rgba(26,79,191,.08)',  badgeColor:'var(--blue)',  desc:'Print from iPad or phone. Great for boutiques without a fixed desk.' },
  { id:'zebra',   ico:'🖨️', name:'Zebra ZD421',           type:'Thermal · USB / Ethernet',     badge:'Pro',                  badgeBg:'rgba(184,149,90,.1)', badgeColor:'#8A6A30',      desc:'Industry standard for multi-location retail. High volume, durable.' },
  { id:'avery',   ico:'🖳',  name:'Standard Printer',      type:'Laser / Inkjet · A4 Sheet',    badge:'No special hardware',  badgeBg:'var(--mist)',          badgeColor:'var(--stone)', desc:'Use Avery label sheets. Any office printer. Full colour available.' },
]

/* ── Tag HTML builder — data-driven, inline styles kept intentionally ── */
function buildTagHtml(prod, sizeId, style, fields, currency, priceSize, scale = 1) {
  const d   = TAG_DIMS[sizeId] || TAG_DIMS['57x32']
  const w   = d.w * scale, h = d.h * scale, fs = scale
  const bg       = style==='bold'?'#1A1209':style==='kraft'?'#E8DCC8':'#FFFFFF'
  const textMain = style==='bold'?'#FDFAF5':style==='kraft'?'#3A2A10':'#1A1209'
  const textSub  = style==='bold'?'rgba(255,255,255,.55)':style==='kraft'?'#7A6040':'#8C7B6B'
  const brandCol = style==='bold'?'#B8955A':style==='kraft'?'#8A6A30':'#1A1209'
  const borderCol= style==='bold'?'transparent':style==='kraft'?'#C8B898':'#E0E0E0'
  const divCol   = style==='bold'?'rgba(255,255,255,.15)':'rgba(0,0,0,.1)'
  const pFSMap   = { large:Math.round(22*fs), medium:Math.round(17*fs), small:Math.round(13*fs) }
  const pFS      = pFSMap[priceSize] || 22
  const isNarrow = d.w < 100 || d.h < 80
  const shortName= prod.name.length > 26 ? prod.name.substring(0,24)+'…' : prod.name
  const bcPattern= '101110011010110011101101010110111010010101101100111'

  let inner = ''
  if (isNarrow) {
    inner += `<div style="display:flex;align-items:center;justify-content:space-between">`
    if (fields.brand) inner += `<div style="font-family:'Bodoni Moda',Georgia,serif;font-size:${Math.round(8*fs)}px;letter-spacing:${Math.round(2*fs)}px;text-transform:uppercase;color:${brandCol};font-weight:600">NEGLIA</div>`
    if (fields.price) inner += `<div style="font-family:'Bodoni Moda',Georgia,serif;font-size:${Math.round(14*fs)}px;font-weight:300;color:${textMain}">${currency}${prod.price.toLocaleString()}</div>`
    inner += `</div>`
    if (fields.sku) inner += `<div style="font-size:${Math.round(6*fs)}px;color:${textSub}">${prod.sku}</div>`
  } else {
    if (fields.brand) {
      inner += `<div style="font-family:'Bodoni Moda',Georgia,serif;font-size:${Math.round(9*fs)}px;letter-spacing:${Math.round(3*fs)}px;text-transform:uppercase;color:${brandCol};font-weight:600;margin-bottom:${Math.round(1*fs)}px">NEGLIA</div>`
      inner += `<div style="height:1px;background:${divCol};margin-bottom:${Math.round(2*fs)}px"></div>`
    }
    if (fields.name)  inner += `<div style="font-size:${Math.round(8*fs)}px;font-weight:500;color:${textSub};margin-bottom:${Math.round(2*fs)}px;line-height:1.3;overflow:hidden">${shortName}</div>`
    if (fields.price) inner += `<div style="font-family:'Bodoni Moda',Georgia,serif;font-size:${pFS}px;font-weight:300;color:${textMain};line-height:1;margin-bottom:${Math.round(2*fs)}px">${currency}${prod.price.toLocaleString()}</div>`
    if (fields.sku || fields.size) {
      inner += `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto">`
      if (fields.sku)  inner += `<div style="font-size:${Math.round(7*fs)}px;color:${textSub}">${prod.sku}</div>`
      if (fields.size) inner += `<div style="font-size:${Math.round(8*fs)}px;font-weight:700;color:${textMain}">${prod.size}</div>`
      inner += `</div>`
    }
    if (fields.barcode) {
      const bars = bcPattern.split('').map(b => `<div style="width:${Math.round(1.5*fs)}px;height:${Math.round(18*fs)}px;background:${b==='1'?textMain:'transparent'};display:inline-block;flex-shrink:0"></div>`).join('')
      inner += `<div style="display:flex;align-items:flex-end;gap:0;margin-top:${Math.round(3*fs)}px;height:${Math.round(20*fs)}px;overflow:hidden">${bars}</div>`
    }
    if (fields.origin) inner += `<div style="font-size:${Math.round(6.5*fs)}px;color:${textSub};margin-top:${Math.round(1*fs)}px">Made in Italy</div>`
    if (fields.season) inner += `<div style="font-size:${Math.round(6.5*fs)}px;color:${textSub}">SS 2026</div>`
  }

  return `<div style="width:${w}px;height:${h}px;background:${bg};border:1px solid ${borderCol};border-radius:0}px;padding:${Math.round(5*fs)}px ${Math.round(7*fs)}px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;box-sizing:border-box;font-family:'Jost',system-ui,sans-serif;position:relative;">${inner}</div>`
}

function SectionDivider({ label }) {
  return (
    <div className="pt-section-divider">
      {label}
      <span className="pt-section-line" />
    </div>
  )
}

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle${on ? ' on' : ''}`} onClick={onToggle}>
      <div className="toggle-knob" />
    </div>
  )
}

export default function PriceTags() {
  const { t } = useTranslation()

  const [scene, setScene]         = useState('setup')
  const [printer, setPrinter]     = useState('dymo')
  const [labelSize, setLabelSize] = useState('57x32')
  const [style, setStyle]         = useState('minimal')
  const [currency, setCurrency]   = useState('€')
  const [priceSize, setPriceSize] = useState('large')
  const [fields, setFields]       = useState({ brand:true, name:true, price:true, size:true, sku:true, barcode:false, origin:false, season:false })
  const [products, setProducts]   = useState(INIT_PRODUCTS)
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('')

  const printerData = PRINTERS[printer]
  const dim         = TAG_DIMS[labelSize] || TAG_DIMS['57x32']
  const SAMPLE      = { name:'Cashmere Trench Coat — Camel', price:1290, sku:'NEG-CTR-0008', size:'M' }

  const toggleField = key => setFields(f => ({ ...f, [key]: !f[key] }))
  const filtered    = products.filter(p =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
    (!catFilter || p.cat === catFilter)
  )

  function toggleProd(id, checked) { setProducts(prev => prev.map(p => p.id===id ? {...p, checked} : p)) }
  function setQty(id, val)         { setProducts(prev => prev.map(p => p.id===id ? {...p, qty:Math.max(1,parseInt(val)||1)} : p)) }
  function toggleAll(checked)      { setProducts(prev => prev.map(p => ({...p, checked}))) }

  const selected  = products.filter(p => p.checked)
  const totalTags = selected.reduce((s, p) => s + p.qty, 0)

  function printTags() {
    if (!selected.length) { alert(t('pt.no_products_alert')); return }
    const tags = []
    selected.forEach(p => { for (let i = 0; i < p.qty; i++) tags.push(buildTagHtml(p, labelSize, style, fields, currency, priceSize, 1)) })
    const pw = window.open('', '_blank', 'width=800,height=600')
    pw.document.write(`<!DOCTYPE html><html><head>
      <style>
        @page { size: ${dim.wMM}mm ${dim.hMM}mm; margin: 0; }
        body { margin:0; padding:0; font-family:'Jost',system-ui,sans-serif; }
        .tag-wrap { display:inline-block; page-break-after:always; }
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap');
      </style></head><body>
      ${tags.map(tg => `<div class="tag-wrap">${tg}</div>`).join('')}
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>`)
    pw.document.close()
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
              {STYLES.map(s => (
                <div key={s.key} onClick={() => setStyle(s.key)} className={`pt-style-card${style===s.key?' sel':''}`}>
                  <div className="pt-style-preview" style={{ background:s.bg, border:s.border }}>
                    <div className="pt-style-preview-brand" style={{ color:s.key==='bold'?'#B8955A':s.key==='kraft'?'#7A6040':'#888' }}>NEGLIA</div>
                    <div className="pt-style-preview-price" style={{ color:s.key==='bold'?'white':s.key==='kraft'?'#3A2A10':'black' }}>€890</div>
                  </div>
                  <div className="pt-style-label">{s.label}</div>
                </div>
              ))}
            </div>

            <SectionDivider label={t('pt.designer.fields')} />
            <div className="card pt-fields-card">
              {[
                { key:'brand',   label:t('pt.fields.brand'),   sub:'NEGLIA · always recommended' },
                { key:'name',    label:t('pt.fields.name'),    sub:'Cashmere Trench Coat — Camel' },
                { key:'price',   label:t('pt.fields.price'),   sub:'Displayed prominently' },
                { key:'size',    label:t('pt.fields.size'),    sub:'S · M · L · UK 8 etc.' },
                { key:'sku',     label:t('pt.fields.sku'),     sub:'NEG-CTR-0008' },
                { key:'barcode', label:t('pt.fields.barcode'), sub:'EAN-13 or Code 128 from SKU' },
                { key:'origin',  label:t('pt.fields.origin'),  sub:'Country of origin' },
                { key:'season',  label:t('pt.fields.season'),  sub:'Spring/Summer 2026' },
              ].map((f, i, arr) => (
                <div key={f.key} className={`pt-field-row${i < arr.length-1?' pt-field-border':''}`}>
                  <div>
                    <div className="pt-field-label">{f.label}</div>
                    <div className="pt-field-sub">{f.sub}</div>
                  </div>
                  <Toggle on={fields[f.key]} onToggle={() => toggleField(f.key)} />
                </div>
              ))}
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
              <div dangerouslySetInnerHTML={{ __html: buildTagHtml(SAMPLE, labelSize, style, fields, currency, priceSize, 3) }} />
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
            <select className="form-select pt-select-cat" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">{t('pt.select.all_cats')}</option>
              <option value="Ready-to-Wear">Ready-to-Wear</option>
              <option value="Menswear">Menswear</option>
              <option value="Footwear">Footwear</option>
              <option value="Accessories">Accessories</option>
              <option value="Jewellery">Jewellery</option>
            </select>
            <div className="pt-select-actions">
              <button className="btn btn-outline btn-sm" onClick={() => toggleAll(true)}>{t('pt.select.select_all')}</button>
              <button className="btn btn-outline btn-sm" onClick={() => toggleAll(false)}>{t('common.clear')}</button>
              <div className="pt-select-count">{selected.length} {t('pt.select.selected')} · {totalTags} {t('pt.select.tags')}</div>
            </div>
          </div>

          <div className="card pt-product-table">
            <div className="pt-table-hdr">
              <input type="checkbox" className="pt-checkbox" onChange={e => toggleAll(e.target.checked)} />
              <div />
              {[t('pt.select.col_product'), t('pt.select.col_category'), t('pt.select.col_price'), t('pt.select.col_tags'), ''].map((h, i) => (
                <div key={i} className={`pt-th${h===t('pt.select.col_price') ? ' pt-th-right' : h===t('pt.select.col_tags') ? ' pt-th-center' : ''}`}>{h}</div>
              ))}
            </div>

            {filtered.map(p => (
              <div key={p.id} className={`pt-product-row${p.checked?' sel':''}`}>
                <input type="checkbox" checked={p.checked} className="pt-checkbox" onChange={e => toggleProd(p.id, e.target.checked)} />
                <div className="pt-product-emoji">{p.emoji}</div>
                <div>
                  <div className="pt-product-name">{p.name}</div>
                  <div className="pt-product-meta">{p.sku} · {p.size}</div>
                </div>
                <div className="pt-product-cat">{p.cat}</div>
                <div className="pt-product-price">{currency}{p.price.toLocaleString()}</div>
                <div className="pt-product-qty-wrap">
                  <input type="number" value={p.qty} min="1" max="99" disabled={!p.checked}
                    onChange={e => setQty(p.id, e.target.value)}
                    className={`pt-qty-input${!p.checked?' disabled':''}`}
                    onWheel={e => e.target.blur()}
                  />
                </div>
                <div>
                  <button className="btn btn-outline btn-xs" onClick={() => setScene('preview')}>{t('common.preview')}</button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-select-footer">
            <div>
              <div className="pt-select-footer-title">
                {selected.length} {t('pt.select.products')}{selected.length!==1?'s':''} · {totalTags} {t('pt.select.tag')}{totalTags!==1?'s':''}
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
              <div className="pt-preview-title">{selected.length} {t('pt.preview.products')} · {totalTags} {t('pt.preview.tags')}</div>
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
            <div className="pt-preview-sheet-lbl">{t('pt.preview.sheet_label')} — {totalTags} {t('pt.preview.tag')}{totalTags!==1?'s':''}</div>
            <div className="pt-preview-tags">
              {selected.length === 0 ? (
                <div className="pt-preview-empty">{t('pt.preview.empty')}</div>
              ) : (
                selected.flatMap(p =>
                  Array.from({ length: p.qty }, (_, i) => (
                    <div key={`${p.id}-${i}`} className="pt-preview-tag-wrap"
                      dangerouslySetInnerHTML={{ __html: buildTagHtml(p, labelSize, style, fields, currency, priceSize, 2.5) }}
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
