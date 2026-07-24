import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'

const API      = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL

function fmt(n) { return '€' + Number(n).toFixed(2) }

function tierStyle(tier) {
  if (!tier) return { bg:'var(--mist)', color:'var(--stone)' }
  const t = tier.toLowerCase()
  if (t === 'gold')     return { bg:'var(--gold)',    color:'var(--deep)' }
  if (t === 'platinum') return { bg:'linear-gradient(135deg,#B8955A,#D4AF72)', color:'var(--deep)' }
  if (t === 'silver')   return { bg:'#C0C0C0',        color:'var(--deep)' }
  return { bg:'rgba(184,149,90,0.15)', color:'var(--deep)' }
}

function imgSrc(url) {
  if (!url) return null
  return url.startsWith('http') ? url : `${IMG_BASE}${url}`
}

/* ── Walk-in Customer Modal ── */
function WalkInModal({ onClose, onCreated }) {
  const [firstName,  setFirstName]  = useState('')
  const [lastName,   setLastName]   = useState('')
  const [email,      setEmail]      = useState('')
  const [phone,      setPhone]      = useState('')
  const [sendInvite, setSendInvite] = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  async function handleAdd() {
    if (!firstName.trim()) { setError('First name is required.'); return }
    setSaving(true); setError('')
    try {
      const res = await apiFetch(`${API}/boutique/customers`, {
        method: 'POST',
        body: JSON.stringify({
          name:  `${firstName.trim()} ${lastName.trim()}`.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        })
      }).then(r => r.json())

      if (res.success) {
        onCreated({
          source:                'walkin',
          boutique_customer_id:  res.data.id,
          mi_italia_user_id:     null,
          name:                  res.data.name,
          email:                 res.data.email,
          phone:                 res.data.phone,
          profile_photo_url:     null,
          platform_profile:      { tier:'', points_balance:0, wallet_balance:'0.00' },
          boutique_history:      { total_spend:'0.00', visit_count:0, last_visit_at:null },
        })
        onClose()
      } else {
        setError(res.message ?? 'Failed to create customer.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">Add <em>Walk-in Customer</em></div>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="alert alert-info" style={{ marginBottom:14 }}>
          <span className="material-symbols-outlined">info</span>
          Walk-in customers are saved to your customer list. After the sale you can invite them to join Mi Italia to link future purchases and earn loyalty points.
        </div>

        {error && (
          <div className="alert alert-urgent" style={{ marginBottom:12 }}>
            <span className="material-symbols-outlined">error</span>{error}
          </div>
        )}

        <div className="form-row2">
          <div className="form-group">
            <label className="form-lbl">First Name</label>
            <input className="form-input" placeholder="Sofia" value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-lbl">Last Name</label>
            <input className="form-input" placeholder="Bianchi" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-lbl">Email</label>
          <input className="form-input" type="email" placeholder="sofia@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-lbl">Phone / WhatsApp</label>
          <input className="form-input" placeholder="+39 ..." value={phone} onChange={e => setPhone(e.target.value)} />
        </div>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 13px', background:'var(--card)', borderRadius: 0, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:600 }}>Send Mi Italia app invite after sale</div>
            <div style={{ fontSize:9, color:'var(--stone)' }}>Customer gets a WhatsApp link to download the app and connect their account</div>
          </div>
          <div className={`toggle${sendInvite ? ' on' : ''}`} onClick={() => setSendInvite(v => !v)}>
            <div className="toggle-knob" />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
            <span className="material-symbols-outlined">person_add</span>
            {saving ? 'Adding…' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Sale Success Modal ── */
function SaleSuccessModal({ order, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()} style={{ textAlign:'center' }}>
        <div style={{ fontSize:44, marginBottom:12 }}>✅</div>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, marginBottom:6 }}>
          Sale <em style={{ color:'var(--gold)' }}>Complete</em>
        </div>
        <div style={{ fontSize:11, color:'var(--stone)', marginBottom:6 }}>Order #{String(order.id).slice(0,8)}</div>
        <div style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>{fmt(order.gross_amount)}</div>
        <div style={{ fontSize:10, color:'var(--stone)', marginBottom:20 }}>
          {order.payment_method === 'cash' ? 'Cash' : order.payment_method === 'stripe' ? 'Stripe Terminal' : 'External Terminal'} · VAT {fmt(order.vat_amount)}
        </div>
        <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={onClose}>
          New Sale
        </button>
      </div>
    </div>
  )
}

export default function POS() {
  const { t } = useTranslation()

  // Customer search
  const [search,        setSearch]        = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching,     setSearching]     = useState(false)
  const [showDropdown,  setShowDropdown]  = useState(false)
  const [customer,      setCustomer]      = useState(null)
  const [showWalkIn,    setShowWalkIn]    = useState(false)

  // Products
  const [products,     setProducts]     = useState([])
  const [prodSearch,   setProdSearch]   = useState('')
  const [prodLoading,  setProdLoading]  = useState(true)
  const [selectedProd, setSelectedProd] = useState(null)
  const [prodVariants, setProdVariants] = useState([])
  const [variantModal, setVariantModal] = useState(false)

  // Cart
  const [cart,         setCart]         = useState([])
  const [payTab,       setPayTab]       = useState('cash')
  const [terminal,     setTerminal]     = useState('SumUp')
  const [cashTendered, setCashTendered] = useState('')
  const [promoCode,    setPromoCode]    = useState('')
  const [discount,     setDiscount]     = useState(null)

  // Order
  const [completing,   setCompleting]   = useState(false)
  const [saleOrder,    setSaleOrder]    = useState(null)

  const debounceRef  = useRef(null)
  const prodDebRef   = useRef(null)
  const dropdownRef  = useRef(null)

  // Load products on mount
  useEffect(() => {
    setProdLoading(true)
    apiFetch(`${API}/boutique/products?status=active&limit=20`)
      .then(r => r.json())
      .then(res => { setProducts(res.data?.products ?? []); setProdLoading(false) })
      .catch(() => setProdLoading(false))
  }, [])

  // Debounced product search
  useEffect(() => {
    clearTimeout(prodDebRef.current)
    prodDebRef.current = setTimeout(() => {
      setProdLoading(true)
      const q = prodSearch.trim() ? `&search=${encodeURIComponent(prodSearch)}` : ''
      apiFetch(`${API}/boutique/products?status=active&limit=20${q}`)
        .then(r => r.json())
        .then(res => { setProducts(res.data?.products ?? []); setProdLoading(false) })
        .catch(() => setProdLoading(false))
    }, 350)
    return () => clearTimeout(prodDebRef.current)
  }, [prodSearch])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounced customer search
  function handleSearchChange(val) {
    setSearch(val)
    if (!val.trim()) { setSearchResults([]); setShowDropdown(false); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearching(true)
      apiFetch(`${API}/boutique/pos/customers/lookup?q=${encodeURIComponent(val)}`)
        .then(r => r.json())
        .then(res => {
          if (res.success) { setSearchResults(res.data.results ?? []); setShowDropdown(true) }
        })
        .catch(() => {})
        .finally(() => setSearching(false))
    }, 300)
  }

  function selectCustomer(c) { setCustomer(c); setSearch(c.name); setShowDropdown(false); setSearchResults([]) }
  function clearCustomer()   { setCustomer(null); setSearch(''); setSearchResults([]); setShowDropdown(false) }

  // Open product — fetch variants then show variant picker
  function openProduct(p) {
    setSelectedProd(p)
    apiFetch(`${API}/boutique/products/${p.id}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setProdVariants(res.data.variants ?? [])
          setVariantModal(true)
        }
      })
      .catch(() => {})
  }

  function addToCartWithVariant(p, variant) {
    const cartItem = {
      id:        `${p.id}-${variant.id}`,
      productId: p.id,
      variantId: variant.id,
      name:      `${p.name} · ${variant.size_label}${variant.colour ? ` · ${variant.colour}` : ''}`,
      price:     parseFloat(p.retail_price),
      img:       imgSrc(p.main_photo),
      qty:       1,
    }
    setCart(prev => {
      const ex = prev.find(i => i.id === cartItem.id)
      if (ex) return prev.map(i => i.id === cartItem.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, cartItem]
    })
    setVariantModal(false)
    setSelectedProd(null)
    setProdVariants([])
  }

  function changeQty(id, delta) {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
  }
  function removeItem(id) { setCart(prev => prev.filter(i => i.id !== id)) }
  function clearCart()    { setCart([]); setDiscount(null); setPromoCode('') }

  // Totals
  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart])
  const discAmt  = useMemo(() => {
    if (!discount) return 0
    if (discount.type === 'pct')   return Math.round(subtotal * discount.val / 100 * 100) / 100
    if (discount.type === 'fixed') return Math.min(discount.val, subtotal)
    return 0
  }, [discount, subtotal])
  const discountedSubtotal = subtotal - discAmt
  const vat    = discountedSubtotal * 0.22
  const total  = discountedSubtotal + vat
  const change = cashTendered ? Math.max(0, parseFloat(cashTendered) - total) : 0

  // Complete sale
  async function completeSale(paymentMethod) {
    if (cart.length === 0) return
    setCompleting(true)
    try {
      const body = {
        payment_method: paymentMethod,
        terminal_type:  paymentMethod === 'external' ? terminal : null,
        vat_rate:       0.22,
        promo_code:     promoCode || null,
        promo_discount: discAmt,
        items: cart.map(i => ({
          product_id: i.productId,
          variant_id: i.variantId,
          unit_price: i.price,
          qty:        i.qty,
        }))
      }
      if (customer?.mi_italia_user_id) body.user_id = customer.mi_italia_user_id
      if (customer?.boutique_customer_id) body.boutique_customer_id = customer.boutique_customer_id

      const res = await apiFetch(`${API}/boutique/orders/pos`, {
        method: 'POST',
        body:   JSON.stringify(body)
      }).then(r => r.json())

      if (res.success) {
        setSaleOrder(res.data.order)
        clearCart()
        clearCustomer()
        setCashTendered('')
      }
    } catch {}
    finally { setCompleting(false) }
  }

  // Customer card derived values
  const isReturning  = customer?.source === 'returning'
  const isWalkIn     = customer?.source === 'walkin'
  const borderColor  = isReturning ? 'rgba(0,108,53,0.25)' : 'rgba(184,149,90,0.15)'
  const gradFrom     = isReturning ? 'rgba(0,108,53,0.05)' : 'rgba(184,149,90,0.06)'
  const verifiedBg   = isReturning ? 'var(--green)' : 'var(--gold)'
  const dividerColor = isReturning ? 'rgba(0,108,53,0.12)' : 'rgba(184,149,90,0.15)'
  const tier         = customer?.platform_profile?.tier ?? ''
  const ts           = tierStyle(tier)
  const walletBal    = parseFloat(customer?.platform_profile?.wallet_balance ?? 0)
  const points       = customer?.platform_profile?.points_balance ?? 0
  const totalSpend   = customer?.boutique_history?.total_spend ? `€${parseFloat(customer.boutique_history.total_spend).toFixed(2)}` : '—'
  const visitCount   = customer?.boutique_history?.visit_count ?? 0

  return (
    <div className="pos-layout">

      {/* ── LEFT: products panel ── */}
      <div className="pos-items">

        {/* Customer lookup */}
        <div style={{ background:'rgba(184,149,90,0.04)', border:'1.5px solid rgba(184,149,90,0.15)', borderRadius: 0, padding:'12px 14px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:0 }} ref={dropdownRef}>
            <div style={{ flex:1, position:'relative' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 12px', background:'var(--white)', border:'1.5px solid var(--mist)', borderRadius: 0}}>
                <span className="material-symbols-outlined" style={{ fontSize:15, color:'var(--stone)' }}>person_search</span>
                <input
                  value={search}
                  onChange={e => handleSearchChange(e.target.value)}
                  style={{ border:'none', background:'none', fontFamily:"'Montserrat',sans-serif", fontSize:12, color:'var(--deep)', outline:'none', flex:1 }}
                  placeholder="Search by name, email, phone or Mi Italia ID..."
                />
                {searching && <span className="material-symbols-outlined" style={{ fontSize:14, color:'var(--stone)' }}>sync</span>}
                {search && !searching && (
                  <span style={{ cursor:'pointer' }} onClick={clearCustomer}>
                    <span className="material-symbols-outlined" style={{ fontSize:15, color:'var(--stone)' }}>close</span>
                  </span>
                )}
              </div>

              {/* Search results dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--white)', border:'1.5px solid var(--mist)', borderRadius: 0, boxShadow:'0 4px 20px rgba(26,18,9,0.12)', zIndex:50, overflow:'hidden' }}>
                  {searchResults.map((r, i) => (
                    <div key={i} onClick={() => selectCustomer(r)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', cursor:'pointer', borderBottom: i < searchResults.length-1 ? '1px solid var(--mist)' : 'none' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {imgSrc(r.profile_photo_url) ? (
                        <div style={{ width:32, height:32, borderRadius:'50%', backgroundImage:`url('${imgSrc(r.profile_photo_url)}')`, backgroundSize:'cover', flexShrink:0 }} />
                      ) : (
                        <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--mist)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize:16, color:'var(--stone)' }}>person</span>
                        </div>
                      )}
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600 }}>{r.name}</div>
                        <div style={{ fontSize:10, color:'var(--stone)' }}>{r.email} · {r.phone}</div>
                      </div>
                      <span style={{ padding:'1px 7px', borderRadius: 0, fontSize:8, fontWeight:600, background: r.source === 'returning' ? 'rgba(0,108,53,0.1)' : 'rgba(184,149,90,0.1)', color: r.source === 'returning' ? 'var(--green)' : 'var(--gold)' }}>
                        {r.source === 'returning' ? 'Returning' : 'Mi Italia'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn-sm btn-outline" onClick={() => setShowWalkIn(true)}>
              <span className="material-symbols-outlined">person_add</span>New
            </button>
          </div>

          {/* Customer card — Mi Italia / returning customer */}
          {customer && !isWalkIn && (
            <div style={{ marginTop:10 }}>
              <div style={{ background:`linear-gradient(135deg,${gradFrom},rgba(255,255,255,0))`, border:`1.5px solid ${borderColor}`, borderRadius: 0, overflow:'hidden' }}>
                <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    {imgSrc(customer.profile_photo_url) ? (
                      <div style={{ width:44, height:44, borderRadius:'50%', backgroundImage:`url('${imgSrc(customer.profile_photo_url)}')`, backgroundSize:'cover', border:`2px solid ${isReturning ? 'var(--green)' : 'var(--gold)'}` }} />
                    ) : (
                      <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--mist)', display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${isReturning ? 'var(--green)' : 'var(--gold)'}` }}>
                        <span className="material-symbols-outlined" style={{ fontSize:20, color:'var(--stone)' }}>person</span>
                      </div>
                    )}
                    <div style={{ position:'absolute', bottom:-2, right:-2, width:16, height:16, borderRadius:'50%', background:verifiedBg, border:'2px solid var(--white)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize:9, color: isReturning ? 'white' : 'var(--deep)' }}>verified</span>
                    </div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'var(--deep)' }}>{customer.name}</span>
                      {tier && <span style={{ padding:'1px 7px', borderRadius: 0, background:ts.bg, color:ts.color, fontSize:8, fontWeight:700 }}>{tier.toUpperCase()}</span>}
                      <span style={{ padding:'1px 7px', borderRadius: 0, background: isReturning ? 'rgba(0,108,53,0.1)' : 'rgba(184,149,90,0.1)', color: isReturning ? 'var(--green)' : 'var(--gold)', fontSize:8, fontWeight:600 }}>
                        {isReturning ? 'Returning' : 'Mi Italia'}
                      </span>
                    </div>
                    <div style={{ fontSize:10, color:'var(--stone)', marginTop:2 }}>{customer.phone} · {customer.email}</div>
                  </div>
                  <span style={{ cursor:'pointer' }} onClick={clearCustomer}>
                    <span className="material-symbols-outlined" style={{ fontSize:16, color:'var(--stone)' }}>close</span>
                  </span>
                </div>

                <div style={{ borderTop:`1px solid ${dividerColor}`, padding:'10px 14px', background:'rgba(255,255,255,0.5)' }}>
                  <div style={{ fontSize:8, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', color:'var(--stone)', marginBottom:8 }}>Mi Italia Profile</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:10 }}>
                    {[
                      { val: totalSpend,                    lbl:'Platform Spend', color:'var(--deep)'  },
                      { val: visitCount,                    lbl:'Boutique Visits', color:'var(--deep)' },
                      { val: `€${walletBal.toFixed(2)}`,   lbl:'Wallet Credit',  color:'var(--green)' },
                      { val: points,                        lbl:'Points',         color:'var(--gold)'  },
                    ].map(s => (
                      <div key={s.lbl} style={{ background:'var(--white)', borderRadius: 0, padding:'8px 10px', textAlign:'center', border:'1px solid var(--mist)' }}>
                        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontWeight:600, color:s.color }}>{s.val}</div>
                        <div style={{ fontSize:8, color:'var(--stone)', marginTop:1 }}>{s.lbl}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop:`1px solid ${dividerColor}`, padding:'10px 14px', display:'flex', gap:8 }}>
                  <button className="btn btn-sm btn-outline" style={{ flex:1, justifyContent:'center' }}>
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                    Apply €{walletBal.toFixed(2)} Credit
                  </button>
                  <button className="btn btn-sm" style={{ background:'#25D366', color:'white', flex:1, justifyContent:'center', borderRadius: 0, padding:'5px 12px', fontSize:10, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}
                    onClick={() => { const phone = customer.phone?.replace(/\D/g,''); if(phone) window.open(`https://wa.me/${phone}`, '_blank') }}>
                    <span className="material-symbols-outlined" style={{ fontSize:13 }}>chat_bubble</span>WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Walk-in customer indicator */}
          {customer && isWalkIn && (
            <div style={{ marginTop:10, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(99,91,255,0.05)', border:'1.5px solid rgba(99,91,255,0.15)', borderRadius: 0}}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className="material-symbols-outlined" style={{ color:'var(--stripe)' }}>person</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:600 }}>{customer.name}</div>
                  <div style={{ fontSize:9, color:'var(--stone)' }}>Walk-in · {customer.phone || customer.email || 'No contact info'}</div>
                </div>
              </div>
              <span style={{ cursor:'pointer' }} onClick={clearCustomer}>
                <span className="material-symbols-outlined" style={{ fontSize:16, color:'var(--stone)' }}>close</span>
              </span>
            </div>
          )}
        </div>

        {/* Product search */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:6, padding:'8px 12px', background:'var(--card)', borderRadius: 0}}>
            <span className="material-symbols-outlined" style={{ fontSize:16, color:'var(--stone)' }}>search</span>
            <input
              style={{ border:'none', background:'none', fontFamily:"'Montserrat',sans-serif", fontSize:12, color:'var(--deep)', outline:'none', width:'100%' }}
              placeholder="Search products..."
              value={prodSearch}
              onChange={e => setProdSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Product grid */}
        <div className="pos-grid">
          {prodLoading && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:30, color:'var(--stone)', fontSize:12 }}>
              <span className="material-symbols-outlined">hourglass_empty</span>
            </div>
          )}
          {!prodLoading && products.map(p => (
            <div key={p.id} className="pos-product" onClick={() => openProduct(p)}>
              <div className="pos-product-img" style={{ backgroundImage: imgSrc(p.main_photo) ? `url('${imgSrc(p.main_photo)}')` : 'none', backgroundSize:'cover', backgroundPosition:'center' }} />
              <div className="pos-product-name">{p.name}</div>
              <div className="pos-product-price">{fmt(p.retail_price)}</div>
              {parseInt(p.total_stock) === 0 && (
                <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,0.7)', borderRadius: 0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:600, color:'var(--red)' }}>Out of stock</div>
              )}
            </div>
          ))}
          {!prodLoading && products.length === 0 && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:30, color:'var(--stone)', fontSize:12 }}>No products found</div>
          )}
        </div>
      </div>

      {/* ── RIGHT: cart panel ── */}
      <div className="pos-cart">
        <div className="pos-cart-hdr">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ fontSize:16, fontWeight:500 }}>Current Sale</h3>
            <button className="btn btn-sm btn-outline" onClick={clearCart}>Clear</button>
          </div>
          <div style={{ fontSize:10, color:'var(--stone)', marginTop:2 }}>
            {customer ? customer.name : 'Walk-in'} · {t('pos.boutique_name') || 'Boutique'}
          </div>
        </div>

        <div className="pos-cart-body">
          {cart.length === 0 ? (
            <div style={{ textAlign:'center', padding:'30px 20px', color:'var(--stone)' }}>
              <span className="material-symbols-outlined" style={{ fontSize:36, display:'block', marginBottom:6, color:'var(--mist)' }}>shopping_cart</span>
              Tap a product to add
            </div>
          ) : cart.map(item => (
            <div key={item.id} className="pos-cart-item">
              {item.img && <img src={item.img} alt={item.name} className="pos-cart-item-img" />}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, fontWeight:600 }}>{item.name}</div>
                <div style={{ fontSize:10, color:'var(--stone)' }}>{fmt(item.price)}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                  <button className="pos-qty-btn" onClick={() => changeQty(item.id, -1)}>−</button>
                  <span style={{ fontSize:12, fontWeight:600, minWidth:16, textAlign:'center' }}>{item.qty}</span>
                  <button className="pos-qty-btn" onClick={() => changeQty(item.id, +1)}>+</button>
                  <button onClick={() => removeItem(item.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--stone)', marginLeft:2, fontSize:13 }}>🗑</button>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{fmt(item.price * item.qty)}</div>
                {item.qty > 1 && <div style={{ fontSize:9, color:'var(--stone)' }}>{fmt(item.price)} each</div>}
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="pos-cart-footer">
            {/* Promo code */}
            <div style={{ marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'var(--card)', borderRadius: 0}}>
                <span className="material-symbols-outlined" style={{ fontSize:14, color:'var(--stone)' }}>local_offer</span>
                <input
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value)}
                  style={{ border:'none', background:'none', fontFamily:"'Montserrat',sans-serif", fontSize:11, color:'var(--deep)', outline:'none', flex:1 }}
                  placeholder="Promo code..."
                />
                <button className="btn btn-sm btn-outline">Apply</button>
              </div>
            </div>

            {/* Totals */}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--stone)', marginBottom:3 }}>
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            {discount && discAmt > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--green)', marginBottom:3 }}>
                <span>Discount</span><span>−{fmt(discAmt)}</span>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--stone)', marginBottom:8 }}>
              <span>VAT (22%)</span><span>{fmt(vat)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:20, fontWeight:700, marginBottom:14 }}>
              <span>Total</span><span>{fmt(total)}</span>
            </div>

            {/* Payment tabs */}
            <div style={{ display:'flex', gap:5, background:'var(--mist)', borderRadius: 0, padding:4, marginBottom:12 }}>
              {[
                { key:'stripe',   icon:'point_of_sale', label:'Stripe'   },
                { key:'external', icon:'credit_card',   label:'External' },
                { key:'cash',     icon:'payments',      label:'Cash'     },
              ].map(tab => (
                <div key={tab.key} className={`pos-pay-tab${payTab === tab.key ? ' act' : ''}`} onClick={() => setPayTab(tab.key)}>
                  <span className="material-symbols-outlined">{tab.icon}</span>{tab.label}
                </div>
              ))}
            </div>

            {/* Stripe panel */}
            {payTab === 'stripe' && (
              <div>
                <button className="btn btn-primary" style={{ width:'100%', padding:13, justifyContent:'center' }} disabled={completing} onClick={() => completeSale('stripe')}>
                  <span className="material-symbols-outlined">point_of_sale</span>
                  {completing ? 'Processing…' : 'Charge via Stripe Terminal'}
                </button>
                <div style={{ fontSize:9, color:'var(--stone)', textAlign:'center', marginTop:5 }}>Card tapped/inserted on terminal · Commission auto-deducted</div>
              </div>
            )}

            {/* External terminal panel */}
            {payTab === 'external' && (
              <div>
                <div style={{ background:'rgba(99,91,255,0.05)', border:'1.5px solid rgba(99,91,255,0.15)', borderRadius: 0, padding:12, marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize:16, color:'var(--stripe)' }}>credit_card</span>
                    <div style={{ fontSize:12, fontWeight:600 }}>Process on your terminal</div>
                  </div>
                  <div style={{ fontSize:22, fontWeight:700, textAlign:'center', marginBottom:4 }}>{fmt(total)}</div>
                  <div style={{ fontSize:9, color:'var(--stone)', textAlign:'center' }}>Charge this amount on your card terminal</div>
                </div>
                <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                  {['SumUp','Verifone','Square','Bank POS','Other'].map(t => (
                    <div key={t} className={`pos-terminal-chip${terminal === t ? ' act' : ''}`} onClick={() => setTerminal(t)}>{t}</div>
                  ))}
                </div>
                <button className="btn btn-primary" style={{ width:'100%', padding:13, justifyContent:'center' }} disabled={completing} onClick={() => completeSale('external')}>
                  <span className="material-symbols-outlined">check_circle</span>
                  {completing ? 'Processing…' : 'Payment Received — Complete Sale'}
                </button>
                <div style={{ fontSize:9, color:'var(--stone)', textAlign:'center', marginTop:5 }}>Sale recorded in Primo · Commission invoiced monthly</div>
              </div>
            )}

            {/* Cash panel */}
            {payTab === 'cash' && (
              <div>
                <div style={{ background:'rgba(0,108,53,0.05)', border:'1.5px solid rgba(0,108,53,0.15)', borderRadius: 0, padding:12, marginBottom:10 }}>
                  <div style={{ fontSize:22, fontWeight:700, textAlign:'center', marginBottom:8 }}>{fmt(total)}</div>
                  <div className="form-row2" style={{ marginBottom:0 }}>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-lbl">Cash Tendered</label>
                      <input className="form-input" placeholder="€0.00" value={cashTendered} onChange={e => setCashTendered(e.target.value)} style={{ textAlign:'center', fontSize:16, fontWeight:700 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-lbl">Change Due</label>
                      <input className="form-input" value={cashTendered ? fmt(change) : '€0.00'} readOnly style={{ textAlign:'center', fontSize:16, fontWeight:700, color:'var(--green)' }} />
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                  {[20, 50, 100, 200, 500].map(v => (
                    <button key={v} className="pos-terminal-chip" onClick={() => setCashTendered(String(v))}>€{v}</button>
                  ))}
                  <button className="pos-terminal-chip" onClick={() => setCashTendered(total.toFixed(2))}>Exact</button>
                </div>
                <button className="btn btn-primary" style={{ width:'100%', padding:13, justifyContent:'center' }} disabled={completing} onClick={() => completeSale('cash')}>
                  <span className="material-symbols-outlined">payments</span>
                  {completing ? 'Processing…' : 'Complete Cash Sale'}
                </button>
                <div style={{ fontSize:9, color:'var(--stone)', textAlign:'center', marginTop:5 }}>Sale recorded in Primo · Commission invoiced monthly</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Walk-in Modal ── */}
      {showWalkIn && (
        <WalkInModal
          onClose={() => setShowWalkIn(false)}
          onCreated={c => { selectCustomer(c) }}
        />
      )}

      {/* ── Variant Picker Modal ── */}
      {variantModal && selectedProd && (
        <div className="modal-backdrop" onClick={() => { setVariantModal(false); setSelectedProd(null) }}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{selectedProd.name} — <em>Select Size</em></div>
              <button className="modal-close" onClick={() => { setVariantModal(false); setSelectedProd(null) }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:'8px 0' }}>
              {prodVariants.map(v => {
                const outOfStock = v.stock_qty === 0
                return (
                  <button
                    key={v.id}
                    className={`btn ${outOfStock ? 'btn-outline' : 'btn-outline'}`}
                    style={{ opacity: outOfStock ? 0.4 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer', minWidth:60 }}
                    disabled={outOfStock}
                    onClick={() => !outOfStock && addToCartWithVariant(selectedProd, v)}
                  >
                    {v.size_label}{v.colour ? ` · ${v.colour}` : ''}
                    {outOfStock && <span style={{ display:'block', fontSize:8, color:'var(--red)' }}>Out</span>}
                    {!outOfStock && <span style={{ display:'block', fontSize:8, color:'var(--stone)' }}>{v.stock_qty} left</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Sale Success Modal ── */}
      {saleOrder && (
        <SaleSuccessModal order={saleOrder} onClose={() => setSaleOrder(null)} />
      )}
    </div>
  )
}
