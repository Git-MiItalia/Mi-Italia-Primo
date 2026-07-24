import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import Toast, { useToast } from '../components/ui/Toast'
import CategorySelector from '../components/product/CategorySelector'
import VariantTable from '../components/product/VariantTable'
import ColourVariants from '../components/product/ColourVariants'
import VariantsStock from '../components/product/VariantsStock'
import ProductPhotos from '../components/product/ProductPhotos'
import VirtualTryOn from '../components/product/VirtualTryOn'
import AIModelStudio from '../components/product/AIModelStudio'
import PrintTagModal from '../components/product/PrintTagModal'

const API = import.meta.env.VITE_API_URL
const MAX_PRODUCTS = Number(import.meta.env.VITE_MAX_PRODUCTS ?? 10)

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle${on ? ' on' : ''}`} onClick={onToggle}>
      <div className="toggle-knob" />
    </div>
  )
}

function BrandOption({ brand, selected, onSelect }) {
  return (
    <div className={`brand-option${selected ? ' sel' : ''}`} onClick={onSelect}>
      <div className="brand-option-logo" style={brand.img ? { backgroundImage:`url('${brand.img}')`, backgroundSize:'cover' } : { background: brand.bg }} />
      <div>
        <div className="brand-option-name">{brand.name}</div>
        <div className="brand-option-country">{brand.sub}</div>
      </div>
      <span className="material-symbols-outlined brand-option-check">check</span>
    </div>
  )
}

export default function AddProduct() {
  const navigate   = useNavigate()
  const { id }     = useParams()
  const isEditMode = !!id
  const { toasts, show } = useToast()
  const { t } = useTranslation()

  const [brandOpen, setBrandOpen]             = useState(false)
  const [selectedBrand, setSelectedBrand]     = useState({ id:'own', name:'Own Label', isOwn:true })
  const [madeIn, setMadeIn]                   = useState('Italy')
  const [designedInItaly, setDesignedInItaly] = useState(true)
  const [priceHidden, setPriceHidden]         = useState(false)
  const [founderCard, setFounderCard]         = useState(true)
  const [showroomOn, setShowroomOn]           = useState(true)
  const [reserveOn, setReserveOn]             = useState(true)
  const [shippingOn, setShippingOn]           = useState(true)
  const [productName, setProductName]         = useState('')
  const [sku, setSku]                         = useState('')
  const [description, setDescription]         = useState('')
  const [retailPrice, setRetailPrice]         = useState('')
  const [pickupDiscount, setPickupDiscount]   = useState('')
  const [productStatus, setProductStatus]     = useState('active')
  const [selectedColour, setSelectedColour]   = useState('')
  const [category, setCategory]               = useState(null)
  const [sizes, setSizes]                     = useState([])
  const [colours, setColours]                 = useState([])
  const [productId, setProductId]             = useState(null)
  const [published, setPublished]             = useState(false)
  const [initialPhotos, setInitialPhotos]     = useState([])
  const [boutiqueName, setBoutiqueName]       = useState('Own Label')
  const [costPrice, setCostPrice]             = useState('')
  const [shippingCost, setShippingCost]       = useState('')
  const [stockData, setStockData]             = useState([])
  const [variants, setVariants]               = useState([])
  const [showAddBrand, setShowAddBrand]       = useState(false)
  const [newBrand, setNewBrand]               = useState({ name:'', country:'Italy', category:'Womenswear', website:'' })
  const [brandSubmitting, setBrandSubmitting] = useState(false)
  const [brandSuccess, setBrandSuccess]       = useState(false)
  const [brandCarry, setBrandCarry]           = useState([])
  const [brandAll, setBrandAll]               = useState([])

  // New state for previously uncontrolled fields
  const [primaryMaterial, setPrimaryMaterial]     = useState('')
  const [vendorName, setVendorName]               = useState('')
  const [vendorSku, setVendorSku]                 = useState('')
  const [vendorEmail, setVendorEmail]             = useState('')
  const [vendorLeadTime, setVendorLeadTime]       = useState('1–2 weeks')
  const [barcodeFormat, setBarcodeFormat]         = useState('EAN-13 (European standard)')
  const [barcodeValue, setBarcodeValue]           = useState('')
  const [wholesaleDiscount, setWholesaleDiscount] = useState('')
  const [wholesaleMinQty, setWholesaleMinQty]     = useState('')
  const [whatsappEnquiry, setWhatsappEnquiry]     = useState('')
  const [initialCategoryPath, setInitialCategoryPath] = useState(null)
  const [editLoaded, setEditLoaded] = useState(false)
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0)
  const bumpPhotoRefresh = () => setPhotoRefreshKey(k => k + 1)
  const [showPrintTag, setShowPrintTag] = useState(false)

  // ── Shared variant-payload builder ──────────────────────────────────────────
  // Applied to POST + both PUTs to prevent unique constraint violations from:
  //   1. Case-only duplicates ("One Size" vs "ONE SIZE")
  //   2. Ghost fallback rows ("One Size" / null-colour) left over from
  //      photo-triggered early product creation, alongside real variants.
  // For PUT calls, pass includeIds=true so backend can update-in-place.
  function buildVariantsPayload({ includeIds = false } = {}) {
    const raw = stockData.length > 0
      ? stockData.map(s => {
          const base = {
            size_label: s.size,
            size_it:    s.size,
            colour:     s.colour ?? null,
            colour_hex: colours.find(c => c.name === s.colour)?.hex ?? null,
            stock_qty:  s.qty,
          }
          if (includeIds) {
            const existing = variants.find(v =>
              v.size_label === s.size &&
              (v.colour === s.colour || (!v.colour && !s.colour))
            )
            if (existing?.id) base.id = existing.id
          }
          return base
        })
      : sizes.length > 0
      ? sizes.filter(s => s.size?.toString().trim()).map(s => ({
          size_label: s.size?.toString(),
          size_it:    s.size?.toString(),
          colour:     colours[0]?.name ?? selectedColour ?? null,
          colour_hex: colours[0]?.hex ?? null,
          stock_qty:  0,
        }))
      : [{
          size_label: 'One Size',
          size_it:    'One Size',
          colour:     colours[0]?.name ?? selectedColour ?? null,
          colour_hex: colours[0]?.hex ?? null,
          stock_qty:  0,
        }]

    // Case-insensitive dedupe on (size_label, colour) — later entries win
    const seen = new Map()
    raw.forEach(v => {
      const key = `${(v.size_label ?? '').toLowerCase()}::${(v.colour ?? '').toLowerCase()}`
      seen.set(key, v)
    })
    const deduped = Array.from(seen.values())

    // Drop ghost "One Size / null-colour" entry when real variants exist
    const hasRealVariants = deduped.some(v =>
      v.size_label?.toLowerCase() !== 'one size' || v.colour
    )
    return hasRealVariants
      ? deduped.filter(v => !(v.size_label?.toLowerCase() === 'one size' && !v.colour))
      : deduped
  }

  useEffect(() => {
    // Fetch brands
    apiFetch(`${API}/boutique/brands`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const mapBrand = b => ({
            id:       b.id,
            name:     b.name,
            sub:      [b.country, b.category].filter(Boolean).join(' · ') || b.slug || '',
            img:      b.logo_url ?? null,
            bg:       'var(--deep)',
            country:  b.country ?? '',
            category: b.category ?? '',
            website:  b.website ?? '',
          })
          setBrandCarry((res.data.own    ?? []).map(mapBrand))
          setBrandAll  ((res.data.global ?? []).map(mapBrand))
        }
      })
      .catch(() => {})

    // Fetch profile
    apiFetch(`${API}/boutique/profile`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setBoutiqueName(res.data?.name ?? 'Own Label')
          setSelectedBrand(prev => prev.id === 'own' ? { ...prev, name: res.data.name } : prev)
        }
      })
      .catch(() => {})

    // Fetch product — edit mode only
    if (!id) return
    setProductId(id)
    apiFetch(`${API}/boutique/products/${id}`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) return
        const p = res.data
        setProductName(p.name ?? '')
        setSku(p.sku ?? '')
        setDescription(p.description ?? '')
        setRetailPrice(p.retail_price ?? '')
        setPickupDiscount(p.pickup_discount_pct ?? '')
        setMadeIn(p.made_in ?? 'Italy')
        setProductStatus(p.status ?? 'active')
        setPriceHidden(p.price_hidden ?? false)
        setShowroomOn(p.showroom_enabled ?? false)
        setInitialPhotos(p.photos ?? [])
        setVariants(p.variants ?? [])
        setPublished(true)

        // Seed previously missing fields
        setPrimaryMaterial(p.primary_material ?? '')
        setVendorName(p.vendor_name ?? '')
        setVendorSku(p.vendor_sku ?? '')
        setVendorEmail(p.vendor_email ?? '')
        setVendorLeadTime(p.vendor_lead_time ?? '1–2 weeks')
        setBarcodeFormat(p.barcode_format ?? 'EAN-13 (European standard)')
        setBarcodeValue(p.barcode ?? '')
        setWholesaleDiscount(p.wholesale_price ?? '')
        setWholesaleMinQty(p.wholesale_min_qty ?? '')
        setWhatsappEnquiry(p.whatsapp_enquiry_number ?? '')
        setCostPrice(p.cost_price ?? '')
        setShippingCost(p.shipping_duty ?? '')
        setDesignedInItaly(p.designed_in_italy ?? true)
        setInitialCategoryPath(p.category_path ?? null)

        // Also seed category state so saveChanges has the value
        if (p.category_path) {
          const parts = p.category_path.split(' > ')
          setCategory({
            l1: parts[0] ?? null,
            l2: parts[1] ?? null,
            l3: parts[2] ?? null,
            l4: [],
          })
        }
        setEditLoaded(true)

        // Restore brand
        if (p.brand_id && p.brand_name) {
          setSelectedBrand({ id: p.brand_id, name: p.brand_name, isOwn: false })
        } else {
          setSelectedBrand(prev => ({ ...prev, isOwn: true }))
        }

        // Build sizes, colours, stockData from variants
        const existingSizes = [...new Set((p.variants ?? []).map(v => v.size_label))]
          .map(s => ({ size: s }))

        const existingColours = [...new Map(
          (p.variants ?? [])
            .filter(v => v.colour)
            .map(v => [v.colour, { id: v.colour, name: v.colour, hex: v.colour_hex ?? '#888888' }])
        ).values()]

        const existingStock = (p.variants ?? []).map(v => ({
          size:   v.size_label,
          colour: v.colour,
          qty:    v.stock_qty,
          active: true,
        }))

        setSizes(existingSizes)
        setColours(existingColours)
        setStockData(existingStock)
      })
      .catch(() => {})
  }, [id])

  async function publishProduct() {
    const missing = []
    if (!productName.trim()) missing.push(t('add_product.validation.name_required'))
    if (!sku.trim())         missing.push(t('add_product.validation.sku_required'))
    if (!retailPrice)        missing.push(t('add_product.validation.price_required'))
    if (missing.length > 0) {
      show(t('add_product.validation.missing', { fields: missing.join(', ') }))
      return null
    }

    if (productStatus !== 'draft') {
      const listRes = await apiFetch(`${API}/boutique/products`).then(r => r.json())
      const published = (listRes?.data?.products ?? []).filter(p => p.status === 'active' || p.status === 'hidden').length
      if (published >= MAX_PRODUCTS) {
        show(`Limit reached: ${MAX_PRODUCTS} published products max. Hide or delete a product first, or save this one as a Draft.`)
        return null
      }
    }

    const res = await apiFetch(`${API}/boutique/products`, {
      method: 'POST',
      body: JSON.stringify({
        name:                    productName,
        sku,
        description,
        retail_price:            parseFloat(retailPrice) || 0,
        pickup_discount_pct:     parseFloat(pickupDiscount) || 0,
        made_in:                 madeIn,
        designed_in_italy:       designedInItaly,
        price_hidden:            priceHidden,
        showroom_enabled:        showroomOn,
        status:                  productStatus,
        reserve_enabled:         reserveOn,
        shipping_enabled:        shippingOn,
        primary_material:        primaryMaterial || null,
        vendor_name:             vendorName || null,
        vendor_sku:              vendorSku || null,
        vendor_email:            vendorEmail || null,
        vendor_lead_time:        vendorLeadTime || null,
        barcode:                 barcodeValue || null,
        barcode_format:          barcodeFormat || null,
        wholesale_price:         wholesaleDiscount ? parseFloat(wholesaleDiscount) : null,
        wholesale_min_qty:       wholesaleMinQty   ? parseInt(wholesaleMinQty)     : null,
        whatsapp_enquiry_number: whatsappEnquiry   || null,
        cost_price:              costPrice         ? parseFloat(costPrice)         : null,
        shipping_duty:           shippingCost      ? parseFloat(shippingCost)      : null,
        brand_id:                selectedBrand.isOwn ? null : selectedBrand.id,
        category_path:           category ? [category.l1, category.l2, category.l3].filter(Boolean).join(' > ') : null,
        style_slugs:             category?.l4 ?? [],
        variants:                buildVariantsPayload({ includeIds: false })
      })
    }).then(r => r.json())

    if (res.success) {
      setProductId(res.data?.product?.id ?? null)
      setPublished(true)
      return res.data?.product?.id ?? null
    }
    return null
  }

  function saveChanges() {
    apiFetch(`${API}/boutique/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name:                    productName,
        sku,
        description,
        retail_price:            parseFloat(retailPrice),
        pickup_discount_pct:     parseFloat(pickupDiscount),
        made_in:                 madeIn,
        designed_in_italy:       designedInItaly,
        price_hidden:            priceHidden,
        showroom_enabled:        showroomOn,
        status:                  productStatus,
        reserve_enabled:         reserveOn,
        shipping_enabled:        shippingOn,
        primary_material:        primaryMaterial || null,
        vendor_name:             vendorName || null,
        vendor_sku:              vendorSku || null,
        vendor_email:            vendorEmail || null,
        vendor_lead_time:        vendorLeadTime || null,
        barcode:                 barcodeValue || null,
        barcode_format:          barcodeFormat || null,
        wholesale_price:         wholesaleDiscount ? parseFloat(wholesaleDiscount) : null,
        wholesale_min_qty:       wholesaleMinQty   ? parseInt(wholesaleMinQty)     : null,
        whatsapp_enquiry_number: whatsappEnquiry   || null,
        cost_price:              costPrice         ? parseFloat(costPrice)         : null,
        shipping_duty:           shippingCost      ? parseFloat(shippingCost)      : null,
        category_path: category
          ? [category.l1, category.l2, category.l3].filter(Boolean).join(' > ')
          : initialCategoryPath ?? null,
        style_slugs:             category?.l4 ?? [],
        variants:                buildVariantsPayload({ includeIds: true })
      })

    }).then(r => r.json()).then(res => {
      if (!res.success) return

      // Save stock changes via inventory API
      if (stockData.length > 0 && variants.length > 0) {
        const updates = stockData
          .map(s => {
            const variant = variants.find(v =>
              v.size_label === s.size && (v.colour === s.colour || (!v.colour && !s.colour))
            )
            if (!variant) return null
            return { variant_id: variant.id, stock_qty: s.qty }
          })
          .filter(Boolean)

        if (updates.length > 0) {
          apiFetch(`${API}/boutique/inventory`, {
            method: 'PUT',
            body: JSON.stringify({ updates })
          }).then(r => r.json())
        }
      }

      navigate('/products')
    })
  }

  function selectBrand(b) { setSelectedBrand(b); setBrandOpen(false) }

  const pickupPrice = (parseFloat(retailPrice) * (1 - parseFloat(pickupDiscount || 0) / 100)).toFixed(2)

  return (
    <>
      {/* ── Top bar ── */}
      <div className="ap-topbar">
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/products')}>
          <span className="material-symbols-outlined">arrow_back</span>{t('add_product.back_btn')}
        </button>
        <h3 className="ap-topbar-title">
          {isEditMode
            ? <>{t('add_product.title_edit')} <em>{t('add_product.title_edit_em')}</em></>
            : <>{t('add_product.title_add')} <em>{t('add_product.title_add_em')}</em></>
          }
        </h3>
        <div className="ap-topbar-actions">
          {isEditMode ? (
            <>
              <button className="btn btn-outline" onClick={() => navigate('/products')}>{t('add_product.cancel_btn')}</button>
              <button className="btn btn-primary" onClick={saveChanges}>
                <span className="material-symbols-outlined">save</span>{t('add_product.save_changes')}
              </button>
            </>
          ) : !published ? (
            <>
              <button className="btn btn-outline" onClick={async () => {
                const prev = productStatus
                setProductStatus('draft')
                await publishProduct()
                setProductStatus(prev)
              }}>{t('add_product.save_draft')}</button>
              <button className="btn btn-primary" onClick={publishProduct}>
                <span className="material-symbols-outlined">cloud_upload</span>{t('add_product.publish_btn')}
              </button>
            </>
          ) : (
            <>
              <span className="ap-published-msg">
                <span className="material-symbols-outlined">check_circle</span>
                {t('add_product.published_msg')}
              </span>
              <button className="btn btn-primary" onClick={async () => {
                // Save latest form state to the just-created product before leaving
                const res = await apiFetch(`${API}/boutique/products/${productId}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                    name:                    productName,
                    sku,
                    description,
                    retail_price:            parseFloat(retailPrice) || 0,
                    pickup_discount_pct:     parseFloat(pickupDiscount) || 0,
                    made_in:                 madeIn,
                    designed_in_italy:       designedInItaly,
                    price_hidden:            priceHidden,
                    showroom_enabled:        showroomOn,
                    status:                  productStatus,
                    reserve_enabled:         reserveOn,
                    shipping_enabled:        shippingOn,
                    primary_material:        primaryMaterial || null,
                    vendor_name:             vendorName || null,
                    vendor_sku:              vendorSku || null,
                    vendor_email:            vendorEmail || null,
                    vendor_lead_time:        vendorLeadTime || null,
                    barcode:                 barcodeValue || null,
                    barcode_format:          barcodeFormat || null,
                    wholesale_price:         wholesaleDiscount ? parseFloat(wholesaleDiscount) : null,
                    wholesale_min_qty:       wholesaleMinQty   ? parseInt(wholesaleMinQty)     : null,
                    whatsapp_enquiry_number: whatsappEnquiry   || null,
                    cost_price:              costPrice         ? parseFloat(costPrice)         : null,
                    shipping_duty:           shippingCost      ? parseFloat(shippingCost)      : null,
                    brand_id:                selectedBrand.isOwn ? null : selectedBrand.id,
                    category_path:           category ? [category.l1, category.l2, category.l3].filter(Boolean).join(' > ') : null,
                    style_slugs:             category?.l4 ?? [],
                    variants:                buildVariantsPayload({ includeIds: true })
                  })
                }).then(r => r.json())

                // Also push stock updates via inventory endpoint
                if (res.success && stockData.length > 0 && variants.length > 0) {
                  const updates = stockData
                    .map(s => {
                      const variant = variants.find(v =>
                        v.size_label === s.size && (v.colour === s.colour || (!v.colour && !s.colour))
                      )
                      return variant ? { variant_id: variant.id, stock_qty: s.qty } : null
                    })
                    .filter(Boolean)

                  if (updates.length > 0) {
                    await apiFetch(`${API}/boutique/inventory`, {
                      method: 'PUT',
                      body: JSON.stringify({ updates })
                    })
                  }
                }

                navigate('/products')
              }}>
                <span className="material-symbols-outlined">check</span>{t('add_product.done_btn')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid2">
        {/* ══ LEFT COLUMN ══ */}
        <div>

          {/* Product Details */}
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">{t('add_product.details.title')} <em>{t('add_product.details.title_em')}</em></div>
            </div>

            <div className="form-group">
              <label className="form-lbl">{t('add_product.details.name_label')}</label>
              <input className="form-input" value={productName} onChange={e => setProductName(e.target.value)} />
            </div>

            {/* Brand Selector */}
            <div className="form-group">
              <label className="form-lbl">{t('add_product.details.brand_label')}</label>
              <div className="brand-selector">
                <div className="brand-selected" onClick={() => setBrandOpen(o => !o)}>
                  <div className="brand-selected-logo own">
                    <span className="material-symbols-outlined">storefront</span>
                  </div>
                  <div className="brand-selected-name">{selectedBrand.name}</div>
                  <div className="brand-selected-tag own-tag">Own Label</div>
                  <span className="material-symbols-outlined ap-expand-icon">expand_more</span>
                </div>
                <div className={`brand-dropdown${brandOpen ? ' open' : ''}`}>
                  <div className="brand-search">
                    <span className="material-symbols-outlined">search</span>
                    <input placeholder="Search brands..." />
                  </div>
                  <div>
                    <div className="brand-section-lbl">Your Store</div>
                    <div className={`brand-option${selectedBrand.id === 'own' ? ' sel' : ''}`}
                      onClick={() => selectBrand({ id:'own', name: boutiqueName, isOwn:true })}>
                      <div className="brand-option-logo own-logo"><span className="material-symbols-outlined">storefront</span></div>
                      <div>
                        <div className="brand-option-name">{boutiqueName}</div>
                        <div className="brand-option-country">Own Label · {boutiqueName}</div>
                      </div>
                      <span className="material-symbols-outlined brand-option-check">check</span>
                    </div>
                    <div className="brand-section-lbl">Brands You Carry</div>
                    {brandCarry.map(b => (
                      <BrandOption key={b.id} brand={b} selected={selectedBrand.id === b.id} onSelect={() => selectBrand(b)} />
                    ))}
                    <div className="brand-section-lbl">All Mi Italia Brands</div>
                    {brandAll.map(b => (
                      <BrandOption key={b.id} brand={b} selected={selectedBrand.id === b.id} onSelect={() => selectBrand(b)} />
                    ))}
                    <div className="brand-add-new" onClick={() => { setBrandOpen(false); setShowAddBrand(true) }}>
                      <span className="material-symbols-outlined">add</span>Add a brand not listed
                    </div>
                  </div>
                </div>
              </div>
              <div className="brand-hint">
                <span className="material-symbols-outlined">info</span>
                <span>For <strong>own-label products</strong>, select your store name. For <strong>multi-brand boutiques</strong>, select the designer or label.</span>
              </div>
            </div>

            {/* Category */}
            <div className="form-group">
              <label className="form-lbl">{t('add_product.details.category_label')}</label>
              <CategorySelector
                onChange={(cat) => setCategory(cat)}
                initialCategory={initialCategoryPath}
              />
              <div className="form-hint">{t('add_product.details.category_hint')}</div>
            </div>

            {/* SKU + Made In */}
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('add_product.details.sku_label')}</label>
                <input className="form-input" value={sku} onChange={e => setSku(e.target.value)} placeholder={t('add_product.details.sku_placeholder')} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('add_product.details.made_in_label')}</label>
                <select className="form-select" value={madeIn} onChange={e => setMadeIn(e.target.value)}>
                  <option value="Italy">🇮🇹 Italy</option>
                  <option value="France">🇫🇷 France</option>
                  <option value="Portugal">🇵🇹 Portugal</option>
                  <option value="Spain">🇪🇸 Spain</option>
                  <option value="United Kingdom">🇬🇧 United Kingdom</option>
                  <option value="Germany">🇩🇪 Germany</option>
                  <option value="Romania">🇷🇴 Romania</option>
                  <option value="Bulgaria">🇧🇬 Bulgaria</option>
                  <option value="Turkey">🇹🇷 Turkey</option>
                  <option value="Morocco">🇲🇦 Morocco</option>
                  <option value="India">🇮🇳 India</option>
                  <option value="China">🇨🇳 China</option>
                  <option value="Japan">🇯🇵 Japan</option>
                  <option value="Vietnam">🇻🇳 Vietnam</option>
                  <option value="Bangladesh">🇧🇩 Bangladesh</option>
                  <option value="Other">🌍 Other</option>
                </select>
              </div>
            </div>

            {/* Designed in Italy */}
            {madeIn !== 'Italy' && (
              <div className="ap-designed-italy">
                <div className="ap-designed-italy-row">
                  <div className="ap-designed-italy-left">
                    <span className="ap-flag">🇮🇹</span>
                    <div>
                      <div className="ap-designed-italy-title">Designed in Italy</div>
                      <div className="ap-designed-italy-sub">This product was designed in Italy and must be declared as such on the Mi Italia listing.</div>
                    </div>
                  </div>
                  <Toggle on={designedInItaly} onToggle={() => setDesignedInItaly(v => !v)} />
                </div>
                <div className="alert alert-info ap-alert-sm">
                  <span className="material-symbols-outlined">info</span>
                  Mi Italia requires all products not made in Italy declare whether they are designed in Italy.
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-lbl">{t('add_product.details.desc_label')}</label>
              <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('add_product.details.material_label')}</label>
              <input className="form-input" value={primaryMaterial} onChange={e => setPrimaryMaterial(e.target.value)} />
            </div>
          </div>

          {/* Pricing */}
          <div className="card">
            <div className="ap-pricing-inner">
              <div className="ap-pricing-hdr">
                <div className="ap-pricing-title">Pricing</div>
                <div className="ap-pricing-toggle-row">
                  <span className="ap-pricing-toggle-lbl">{t('add_product.pricing.hide_price')}</span>
                  <Toggle on={priceHidden} onToggle={() => setPriceHidden(v => !v)} />
                </div>
              </div>
              {!priceHidden ? (
                <div className="form-row3">
                  <div className="form-group ap-no-mb">
                    <label className="form-lbl">{t('add_product.pricing.retail_label')}</label>
                    <input className="form-input" value={retailPrice} onChange={e => setRetailPrice(e.target.value)} />
                  </div>
                  <div className="form-group ap-no-mb">
                    <label className="form-lbl">{t('add_product.pricing.discount_label')}</label>
                    <input className="form-input" value={pickupDiscount} onChange={e => setPickupDiscount(e.target.value)} />
                  </div>
                  <div className="form-group ap-no-mb">
                    <label className="form-lbl">{t('add_product.pricing.pickup_label')}</label>
                    <input className="form-input ap-pickup-price" value={`€${pickupPrice}`} readOnly />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="alert alert-info">
                    <span className="material-symbols-outlined">visibility_off</span>
                    {t('add_product.pricing.hidden_alert')}
                  </div>
                  <div className="form-group ap-no-mb">
                    <label className="form-lbl">{t('add_product.pricing.whatsapp_label')}</label>
                    <input className="form-input" placeholder="+39..." value={whatsappEnquiry} onChange={e => setWhatsappEnquiry(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="ap-founder-row" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
              <div>
                <div className="ap-founder-title">{t('add_product.pricing.founder_card')}</div>
                <div className="ap-founder-sub">{t('add_product.pricing.founder_sub')}</div>
              </div>
              <Toggle on={founderCard} onToggle={() => setFounderCard(v => !v)} />
            </div>
          </div>

          {/* Photos */}
          <ProductPhotos
            productId={productId}
            initialPhotos={initialPhotos}
            onNeedPublish={publishProduct}
            refreshKey={photoRefreshKey}
            onPhotosChange={bumpPhotoRefresh}
          />

          {/* AI Model Studio — extracted to standalone component */}
          <AIModelStudio
            productId={productId}
            refreshKey={photoRefreshKey}
            onPhotosChange={bumpPhotoRefresh}
          />

          {/* Virtual Try-On */}
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">Virtual <em>Try-On</em></div>
              <div className="ap-card-sub">Front / back / side reference photos per variant</div>
            </div>
            <VirtualTryOn productId={productId} />
          </div>
        </div>

        {/* ══ RIGHT COLUMN ══ */}
        <div>
          <div className="card">
            <VariantTable
              category={category}
              initialSizes={isEditMode ? sizes : undefined}
              onRowsChange={(s) => setSizes(s)}
              skipCategoryReset={isEditMode && editLoaded}
            />
          </div>

          <ColourVariants
            initialColours={isEditMode ? colours : undefined}
            onColourChange={(c) => setSelectedColour(c?.name ?? '')}
            onColoursChange={(c) => setColours(c)}
          />

          <VariantsStock
            key={isEditMode ? `edit-${id}` : `add-${sizes.length}-${colours.length}`}
            sizes={sizes}
            colours={colours}
            onStockChange={(s) => setStockData(s)}
            initialStock={stockData}
            variants={variants}
          />

          {/* Inventory & Costing */}
          <div className="card">
            <div className="card-hdr">
              <div>
                <div className="card-title">Inventory <em>&amp; Costing</em></div>
                <div className="ap-card-sub">Private — never shown to customers or Mi Italia</div>
              </div>
              <span className="ap-private-badge">PRIVATE</span>
            </div>

            <div className="ap-section-row">
              <span className="material-symbols-outlined ap-section-icon">local_shipping</span>
              Vendor / Supplier
            </div>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">Vendor Name</label>
                <input className="form-input" value={vendorName} onChange={e => setVendorName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">Vendor SKU</label>
                <input className="form-input" value={vendorSku} onChange={e => setVendorSku(e.target.value)} />
              </div>
            </div>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">Vendor Email</label>
                <input className="form-input" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">Lead Time</label>
                <select className="form-select" value={vendorLeadTime} onChange={e => setVendorLeadTime(e.target.value)}>
                  <option>1–2 weeks</option>
                  <option>2–4 weeks</option>
                  <option>4–6 weeks</option>
                  <option>6–8 weeks</option>
                  <option>8+ weeks</option>
                  <option>Pre-order only</option>
                </select>
              </div>
            </div>

            <div className="detail-divider" />

            <div className="ap-section-row">
              <span className="material-symbols-outlined ap-section-icon">euro</span>
              Cost &amp; Margins
            </div>
            <div className="form-row3">
              <div className="form-group ap-no-mb"><label className="form-lbl">Cost Price (ex. VAT)</label><input className="form-input" value={costPrice} onChange={e => setCostPrice(e.target.value)} /></div>
              <div className="form-group ap-no-mb"><label className="form-lbl">Shipping &amp; Duty</label><input className="form-input" value={shippingCost} onChange={e => setShippingCost(e.target.value)} /></div>
              <div className="form-group ap-no-mb">
                <label className="form-lbl">Landed Cost</label>
                <input className="form-input ap-landed-cost"
                  value={costPrice && shippingCost ? `€${(parseFloat(costPrice||0) + parseFloat(shippingCost||0)).toFixed(2)}` : '—'}
                  readOnly />
              </div>
            </div>
            <div className="ap-margins-grid">
              {(() => {
                const retail   = parseFloat(retailPrice) || 0
                const pickup   = retail * (1 - (parseFloat(pickupDiscount) || 0) / 100)
                const landed   = (parseFloat(costPrice) || 0) + (parseFloat(shippingCost) || 0)
                const grossMgn = landed && retail ? (((retail  - landed) / retail)  * 100).toFixed(1) : '—'
                const pickMgn  = landed && pickup ? (((pickup  - landed) / pickup)  * 100).toFixed(1) : '—'
                const afterCom = landed && retail ? ((((retail * 0.92) - landed) / (retail * 0.92)) * 100).toFixed(1) : '—'
                return [
                  { label:'Gross Margin',     value: grossMgn !== '—' ? `${grossMgn}%` : '—', color:'var(--green)', sub:`on retail €${retail.toFixed(2)}` },
                  { label:'Pickup Margin',    value: pickMgn  !== '—' ? `${pickMgn}%`  : '—', color:'var(--green)', sub:`on pickup €${pickup.toFixed(2)}` },
                  { label:'After Commission', value: afterCom !== '—' ? `${afterCom}%` : '—', color:'var(--gold)',  sub:'after 8% Mi Italia' },
                ].map(m => (
                  <div key={m.label} className="ap-margin-card">
                    <div className="ap-margin-label">{m.label}</div>
                    <div className="ap-margin-val" style={{ color:m.color }}>{m.value}</div>
                    <div className="ap-margin-sub">{m.sub}</div>
                  </div>
                ))
              })()}
            </div>

            <div className="detail-divider" />

            <div className="ap-section-row">
              <span className="material-symbols-outlined ap-section-icon">barcode</span>
              Barcode
            </div>
            <div className="form-row2 ap-no-mb-row">
              <div className="form-group ap-no-mb">
                <label className="form-lbl">Barcode Format</label>
                <select
                  className="form-select"
                  value={barcodeFormat}
                  onChange={e => setBarcodeFormat(e.target.value)}
                >
                  <option value="">No barcode</option>
                  <option value="EAN13">EAN-13 (European standard)</option>
                  <option value="EAN8">EAN-8</option>
                </select>
              </div>
              <div className="form-group ap-no-mb">
                <label className="form-lbl">Barcode Value</label>
                <div className="ap-barcode-input-row">
                  <input className="form-input" value={barcodeValue} onChange={e => setBarcodeValue(e.target.value)} />
                  <button className="btn btn-sm btn-outline" title="Auto-generate">
                    <span className="material-symbols-outlined">auto_awesome</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="ap-barcode-preview">
              <div className="ap-barcode-preview-inner">
                <div className="ap-barcode-preview-lbl">Barcode Preview</div>
                <div className="ap-barcode-number">{barcodeValue || '—'}</div>
                <div className="ap-barcode-type">{barcodeFormat.split(' ')[0]}</div>
              </div>
              <div className="ap-barcode-actions">
                <button className="btn btn-sm btn-outline ap-nowrap" onClick={() => setShowPrintTag(true)}>
                  <span className="material-symbols-outlined">print</span>Print Tag
                </button>
                <button className="btn btn-sm btn-outline ap-nowrap" onClick={() => navigator.clipboard.writeText(barcodeValue)}>
                  <span className="material-symbols-outlined">content_copy</span>Copy
                </button>
              </div>
            </div>
            <div className="form-hint">EAN-13 for standard retail scanning. Code 128 if your SKU contains letters. Barcodes are used in Primo POS — scan at checkout instead of searching.</div>
          </div>

          {/* Showroom */}
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">Showroom &amp; <em>Wholesale</em></div>
            </div>
            <div className="showroom-row">
              <div className="showroom-icon"><span className="material-symbols-outlined">business_center</span></div>
              <div className="ap-showroom-body">
                <div className="ap-showroom-title">Push to Showroom</div>
                <div className="ap-showroom-sub">B2B buyers can discover and order at wholesale price</div>
              </div>
              <Toggle on={showroomOn} onToggle={() => setShowroomOn(v => !v)} />
            </div>
            <div className="form-row2 ap-showroom-fields">
              <div className="form-group">
                <label className="form-lbl">Wholesale Discount</label>
                <input className="form-input" value={wholesaleDiscount} onChange={e => setWholesaleDiscount(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">Min Order Qty</label>
                <input className="form-input" value={wholesaleMinQty} onChange={e => setWholesaleMinQty(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Visibility */}
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">{t('add_product.visibility.title')} <em>{t('add_product.visibility.title_em')}</em></div>
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('add_product.visibility.status_label')}</label>
              <select className="form-select" value={productStatus} onChange={e => setProductStatus(e.target.value)}>
                <option value="active">{t('add_product.visibility.status_active')}</option>
                <option value="hidden">{t('add_product.visibility.status_hidden')}</option>
                <option value="draft">{t('add_product.visibility.status_draft')}</option>
              </select>
            </div>
            <div className="ap-toggle-row" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, padding:'12px 0', borderBottom:'1px solid var(--mist)' }}>
              <div className="ap-toggle-label">{t('add_product.visibility.reserve')}</div>
              <Toggle on={reserveOn} onToggle={() => setReserveOn(v => !v)} />
            </div>
            <div className="ap-toggle-row" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, padding:'12px 0' }}>
              <div className="ap-toggle-label">{t('add_product.visibility.shipping')}</div>
              <Toggle on={shippingOn} onToggle={() => setShippingOn(v => !v)} />
            </div>
          </div>
        </div>
      </div>

      {/* Add Brand Modal */}
      {showAddBrand && (
        <div className="modal-backdrop" onClick={() => setShowAddBrand(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()} style={{ overflowY:'auto', maxHeight:'90vh' }}>
            <div className="modal-hdr">
              <div className="modal-title">Add a <em>Brand</em></div>
              <div className="modal-close" onClick={() => setShowAddBrand(false)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>

            {brandSuccess ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, marginBottom:6 }}>
                  Brand <em style={{ color:'var(--gold)' }}>Submitted</em>
                </div>
                <div style={{ fontSize:11, color:'var(--stone)', marginBottom:20 }}>
                  <strong>{newBrand.name}</strong> has been added to your Boutique.
                </div>
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}
                  onClick={() => { setShowAddBrand(false); setBrandSuccess(false) }}>Done</button>
              </div>
            ) : (
              <>
                <div className="alert alert-info" style={{ marginBottom:14 }}>
                  <span className="material-symbols-outlined">info</span>
                  New brands are reviewed by Mi Italia within 24h.
                </div>
                <div className="form-group">
                  <label className="form-lbl">Brand Name</label>
                  <input className="form-input" placeholder="e.g. Loro Piana"
                    value={newBrand.name} onChange={e => setNewBrand(b => ({ ...b, name: e.target.value }))} />
                </div>
                <div className="form-row2">
                  <div className="form-group">
                    <label className="form-lbl">Country of Origin</label>
                    <select className="form-select" value={newBrand.country}
                      onChange={e => setNewBrand(b => ({ ...b, country: e.target.value }))}>
                      <option>Italy</option><option>France</option><option>United Kingdom</option>
                      <option>United States</option><option>Spain</option><option>Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-lbl">Category</label>
                    <select className="form-select" value={newBrand.category}
                      onChange={e => setNewBrand(b => ({ ...b, category: e.target.value }))}>
                      <option>Womenswear</option><option>Menswear</option>
                      <option>Unisex</option><option>Accessories</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-lbl">Brand Website</label>
                  <input className="form-input" placeholder="https://www.loropiana.com"
                    value={newBrand.website} onChange={e => setNewBrand(b => ({ ...b, website: e.target.value }))} />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setShowAddBrand(false)}>Cancel</button>
                  <button className="btn btn-primary" disabled={!newBrand.name.trim() || brandSubmitting}
                    onClick={async () => {
                      if (!newBrand.name.trim()) return
                      setBrandSubmitting(true)
                      try {
                        const res = await apiFetch(`${API}/boutique/brands`, {
                          method: 'POST',
                          body: JSON.stringify({
                            name:     newBrand.name,
                            country:  newBrand.country,
                            category: newBrand.category,
                            website:  newBrand.website,
                          })
                        }).then(r => r.json())
                        if (res.success) {
                          setBrandSuccess(true)
                          setBrandCarry(prev => [...prev, {
                            id:       res.data.id,
                            name:     res.data.name,
                            sub:      [res.data.country, res.data.category].filter(Boolean).join(' · ') || res.data.slug || '',
                            img:      res.data.logo_url ?? null,
                            bg:       'var(--deep)',
                            country:  res.data.country ?? '',
                            category: res.data.category ?? '',
                            website:  res.data.website ?? '',
                          }])
                        }
                      } catch {}
                      finally { setBrandSubmitting(false) }
                    }}>
                    <span className="material-symbols-outlined">send</span>
                    {brandSubmitting ? 'Submitting…' : 'Submit Brand'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <PrintTagModal
        isOpen={showPrintTag}
        onClose={() => setShowPrintTag(false)}
        product={{
          name:          productName,
          sku,
          retailPrice:   parseFloat(retailPrice) || 0,
          madeIn,
          barcodeValue,
          barcodeFormat,
          vendorSku,
        }}
        category={category}
        brand={selectedBrand?.isOwn ? '' : (selectedBrand?.name || '')}
        sizes={sizes}
        productId={productId}
      />
      <Toast toasts={toasts} />
    </>
  )
}
