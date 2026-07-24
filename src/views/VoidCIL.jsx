import { useState } from 'react'

// ─── Reason options ──────────────────────────────────────
const REASONS = [
  { key:'damaged',        label:'Damaged in transit' },
  { key:'wrong_size',     label:'Wrong size'         },
  { key:'not_described',  label:'Not as described'   },
  { key:'changed_mind',   label:'Changed mind'       },
  { key:'too_late',       label:'Arrived too late'   },
  { key:'quality',        label:'Quality issue'      },
]

// ─── Pipeline template ───────────────────────────────────
const PIPELINE = [
  { num:1, title:'Return Requested',
    sub:'Customer submitted return request.' },
  { num:2, title:'Boutique Review',
    sub:'Review the request and approve or reject. If approved, generate a DHL return label for the customer.' },
  { num:3, title:'Customer Ships Item Back',
    sub:'DHL prepaid return label sent to customer. Awaiting drop-off.' },
  { num:4, title:'Item Received & Inspected',
    sub:'Confirm item received in acceptable condition before processing refund.' },
  { num:5, title:'Refund Issued',
    sub:"Stripe refund processed to customer's original payment method." },
]

// ─── Mock returns data ───────────────────────────────────
const MOCK_RETURNS = [
  {
    id:'RET-084', status:'open', currentStep:2,
    customer:'Sarah Mitchell', orderId:'MI-4821',
    opened:'Mar 20', openedTime:'Mar 20 · 11:24',
    reason:'wrong_size', reasonDetail:'Ordered M, received L.',
    itemLabel:'Nylon Vest · M', value:598,
    items:[{
      name:'Nylon Vest Camouflage', size:'M', colour:'Green', sku:'FRT-VNC',
      price:598, qty:1,
      image:'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=72&h=92&fit=crop&q=80',
    }],
    restockingFee:0, shippingCost:0, phone:'+44 7700 900321',
  },
  {
    id:'RET-083', status:'open', currentStep:2,
    customer:'Anna Kowalski', orderId:'MI-4815',
    opened:'Mar 18', openedTime:'Mar 18 · 15:02',
    reason:'changed_mind', reasonDetail:'Customer preferred alternative style.',
    itemLabel:'Linen Shirt × 2', value:370,
    items:[
      { name:'Linen Shirt · White',  size:'M', colour:'White',  sku:'LIN-SHT-W', price:185, qty:1,
        image:'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=72&h=92&fit=crop&q=80' },
      { name:'Linen Shirt · Blue',   size:'M', colour:'Blue',   sku:'LIN-SHT-B', price:185, qty:1,
        image:'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=72&h=92&fit=crop&q=80' },
    ],
    restockingFee:0, shippingCost:0, phone:'+48 512 345 678',
  },
  {
    id:'RET-081', status:'in_progress', currentStep:3,
    customer:'James Kim', orderId:'MI-4780',
    opened:'Mar 15', openedTime:'Mar 15 · 09:41',
    reason:'damaged', reasonDetail:'Zip broken on arrival.',
    itemLabel:'Crossbody Bag', value:245,
    items:[{
      name:'Crossbody Bag · Espresso', size:'One Size', colour:'Espresso', sku:'BAG-CROSS-01',
      price:245, qty:1,
      image:'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=72&h=92&fit=crop&q=80',
    }],
    restockingFee:0, shippingCost:0, phone:'+82 10 8765 4321',
  },
  {
    id:'RET-079', status:'completed', currentStep:5,
    customer:'Elena Rossi', orderId:'MI-4762',
    opened:'Mar 8', openedTime:'Mar 8 · 14:11',
    reason:'quality', reasonDetail:'Stitching came loose after first wash.',
    itemLabel:'Silk Scarf', value:180,
    items:[{
      name:'Silk Scarf · Bordeaux', size:'One Size', colour:'Bordeaux', sku:'SCF-SLK-BDX',
      price:180, qty:1,
      image:'https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=72&h=92&fit=crop&q=80',
    }],
    restockingFee:0, shippingCost:0, phone:'+39 340 111 2233',
  },
  {
    id:'RET-076', status:'rejected', currentStep:2,
    customer:'Marco Bianchi', orderId:'MI-4750',
    opened:'Mar 3', openedTime:'Mar 3 · 18:22',
    reason:'changed_mind', reasonDetail:'Return requested outside 14-day window.',
    itemLabel:'Wool Trousers', value:320,
    items:[{
      name:'Wool Trousers · Navy', size:'50', colour:'Navy', sku:'TRS-WOL-NVY',
      price:320, qty:1,
      image:'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=72&h=92&fit=crop&q=80',
    }],
    restockingFee:0, shippingCost:0, phone:'+39 349 555 6677',
  },
]

const TABS = [
  { key:'open',        label:'Open'        },
  { key:'in_progress', label:'In Progress' },
  { key:'completed',   label:'Completed'   },
  { key:'rejected',    label:'Rejected'    },
]

// ─── Utility ─────────────────────────────────────────────
function statusLabel(s) {
  return s === 'in_progress' ? 'In Progress'
       : s === 'completed'   ? 'Completed'
       : s === 'rejected'    ? 'Rejected'
       : 'Open'
}
function statusPill(s) {
  return s === 'open'        ? 'pending'
       : s === 'in_progress' ? 'shipped'
       : s === 'completed'   ? 'active'
       : s === 'rejected'    ? 'cancelled'
       : 'pending'
}

// ─── Main ────────────────────────────────────────────────

export default function Returns() {
  const [returns,       setReturns]       = useState(MOCK_RETURNS)
  const [activeTab,     setActiveTab]     = useState('open')
  const [selectedId,    setSelectedId]    = useState('RET-084')
  const [toast,         setToast]         = useState(null)

  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = returns.filter(r => r.status === t.key).length
    return acc
  }, {})

  const filtered = returns.filter(r => r.status === activeTab)
  const selected = returns.find(r => r.id === selectedId) ?? filtered[0] ?? null

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  function updateReturn(id, patch) {
    setReturns(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  // Actions
  function approveWithLabel(r) {
    updateReturn(r.id, { status:'in_progress', currentStep:3 })
    setActiveTab('in_progress')
    showToast('DHL label generated · customer notified')
  }
  function approveNoReturn(r) {
    updateReturn(r.id, { status:'completed', currentStep:5 })
    setActiveTab('completed')
    showToast('Return approved · refund queued')
  }
  function rejectReturn(r) {
    updateReturn(r.id, { status:'rejected' })
    setActiveTab('rejected')
    showToast('Return rejected · customer notified')
  }
  function markReceived(r) {
    updateReturn(r.id, { currentStep:4 })
    showToast('Item marked as received')
  }
  function issueRefund(r) {
    updateReturn(r.id, { status:'completed', currentStep:5 })
    setActiveTab('completed')
    showToast('Refund issued via Stripe')
  }
  function whatsapp(r) {
    showToast(`Opening WhatsApp for ${r.customer}…`)
    // TODO: real integration — open wa.me/${r.phone.replace(/\D/g,'')}
  }
  function changeReason(r, reasonKey) {
    updateReturn(r.id, { reason:reasonKey })
  }

  const refundTotal = selected
    ? selected.value - selected.restockingFee
    : 0

  return (
    <>
      {/* Tabs */}
      <div className="tabs">
        {TABS.map(t => (
          <div key={t.key}
            className={`tab${activeTab === t.key ? ' act' : ''}`}
            onClick={() => setActiveTab(t.key)}>
            {t.label}{' '}
            {counts[t.key] > 0
              ? (t.key === 'open'
                  ? <span className="tab-badge">{counts[t.key]}</span>
                  : `(${counts[t.key]})`)
              : t.key === 'open' ? null : '(0)'}
          </div>
        ))}
      </div>

      <div className="grid2" style={{ alignItems:'start' }}>
        {/* Returns list */}
        <div>
          <div className="card" style={{ padding:0 }}>
            {filtered.length === 0 ? (
              <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--stone)', fontSize:11 }}>
                No {statusLabel(activeTab).toLowerCase()} returns.
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Return ID</th><th>Customer</th><th>Item</th>
                    <th>Reason</th><th>Value</th><th>Opened</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      style={{
                        cursor:'pointer',
                        background: r.id === selected?.id ? 'rgba(184,149,90,0.06)' : undefined,
                      }}>
                      <td style={{
                        fontWeight:600,
                        color: (r.status === 'open' || r.status === 'in_progress') ? 'var(--gold)' : 'var(--deep)'
                      }}>#{r.id}</td>
                      <td>{r.customer}</td>
                      <td>{r.itemLabel}</td>
                      <td>{REASONS.find(x => x.key === r.reason)?.label ?? r.reason}</td>
                      <td>€{r.value.toFixed(2)}</td>
                      <td>{r.opened}</td>
                      <td><span className={`status ${statusPill(r.status)}`}>{statusLabel(r.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="detail-panel">
          {!selected ? (
            <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--stone)', fontSize:11 }}>
              Select a return to view details.
            </div>
          ) : (
            <>
              <div className="detail-panel-hdr">
                <div className="detail-panel-icon">
                  <span className="material-symbols-outlined">undo</span>
                </div>
                <div>
                  <div className="detail-panel-title">Return #{selected.id}</div>
                  <div className="detail-panel-sub">
                    {selected.customer} · Order #{selected.orderId} · Opened {selected.opened}
                  </div>
                </div>
                <span className={`status ${statusPill(selected.status)}`} style={{ marginLeft:'auto' }}>
                  {statusLabel(selected.status)}
                </span>
              </div>

              <div className="detail-panel-body">
                {/* Items */}
                {selected.items.map((it, i) => (
                  <div key={i} style={{
                    display:'flex', gap:10, alignItems:'center', padding:10,
                    background:'var(--card)', borderRadius: 0, marginBottom:8,
                  }}>
                    <div style={{
                      width:36, height:46, borderRadius: 0, flexShrink:0,
                      backgroundImage:`url('${it.image}')`, backgroundSize:'cover', backgroundPosition:'center',
                    }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600 }}>{it.name}</div>
                      <div style={{ fontSize:9, color:'var(--stone)' }}>
                        Size {it.size} · {it.colour} · SKU: {it.sku}
                        {it.qty > 1 && ` · Qty ${it.qty}`}
                      </div>
                    </div>
                    <div style={{ fontWeight:700, fontSize:14 }}>€{(it.price * it.qty).toFixed(2)}</div>
                  </div>
                ))}

                {/* Pipeline */}
                <div style={{
                  fontSize:10, fontWeight:600, color:'var(--stone)',
                  textTransform:'uppercase', letterSpacing:0.5,
                  marginTop:14, marginBottom:10,
                }}>Return Pipeline</div>

                <div style={{ marginBottom:14 }}>
                  {PIPELINE.map((step, idx) => {
                    const isDone   = selected.currentStep > step.num || selected.status === 'completed'
                    const isActive = selected.currentStep === step.num && selected.status !== 'rejected' && selected.status !== 'completed'
                    const isRejected = selected.status === 'rejected' && step.num >= selected.currentStep

                    const numClass = isDone ? 'done' : isActive ? 'active' : 'todo'

                    let timing = '—'
                    if (step.num === 1) timing = selected.openedTime
                    else if (isActive)  timing = 'Now'

                    return (
                      <div key={step.num} className="return-step"
                        style={idx === PIPELINE.length - 1 ? { borderBottom:'none' } : undefined}>
                        <div className={`return-step-num ${numClass}`}
                          style={isRejected ? { background:'rgba(197,0,26,0.08)', color:'var(--red)', border:'1px solid rgba(197,0,26,0.3)' } : undefined}>
                          {isDone
                            ? <span className="material-symbols-outlined" style={{ fontSize:13 }}>check</span>
                            : isRejected
                              ? <span className="material-symbols-outlined" style={{ fontSize:13 }}>close</span>
                              : step.num
                          }
                        </div>
                        <div className="return-step-body">
                          <div className="return-step-title">{step.num} · {step.title}</div>
                          <div className="return-step-sub">{step.sub}</div>
                        </div>
                        <div style={{ fontSize:9, color:'var(--stone)', whiteSpace:'nowrap' }}>{timing}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Reason chips */}
                <div style={{
                  fontSize:10, fontWeight:600, color:'var(--stone)',
                  textTransform:'uppercase', letterSpacing:0.5, marginBottom:8,
                }}>Return Reason</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                  {REASONS.map(r => (
                    <div key={r.key}
                      className={`reason-chip${selected.reason === r.key ? ' sel' : ''}`}
                      onClick={() => changeReason(selected, r.key)}>
                      {r.label}
                    </div>
                  ))}
                </div>
                {selected.reasonDetail && (
                  <div style={{ fontSize:10.5, color:'var(--stone)', fontStyle:'italic', marginBottom:14, paddingLeft:2 }}>
                    Note: {selected.reasonDetail}
                  </div>
                )}

                {/* Refund breakdown */}
                <div style={{
                  fontSize:10, fontWeight:600, color:'var(--stone)',
                  textTransform:'uppercase', letterSpacing:0.5, marginBottom:8,
                }}>Refund Breakdown</div>
                <div className="refund-breakdown">
                  <div className="refund-line"><span>Item total</span><span>€{selected.value.toFixed(2)}</span></div>
                  <div className="refund-line"><span>DHL return shipping</span><span>€{selected.shippingCost.toFixed(2)} (prepaid by boutique)</span></div>
                  <div className="refund-line deduction">
                    <span>Restocking fee (optional)</span>
                    <span>−€{selected.restockingFee.toFixed(2)}</span>
                  </div>
                  <div className="refund-line total">
                    <span>Refund total</span>
                    <span style={{ color:'var(--green)' }}>€{refundTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="detail-divider" />

                {/* Actions per state */}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {selected.status === 'open' && (
                    <>
                      <button className="btn btn-dhl"
                        style={{ width:'100%', justifyContent:'center'}}
                        onClick={() => approveWithLabel(selected)}>
                        <span className="material-symbols-outlined">local_shipping</span>
                        Generate DHL Return Label &amp; Approve
                      </button>
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn"
                          style={{
                            flex:1, justifyContent:'center',
                            background:'rgba(0,108,53,0.08)',
                            color:'var(--green)',
                            border:'1.5px solid rgba(0,108,53,0.25)'
                          }}
                          onClick={() => approveNoReturn(selected)}>
                                                  <span className="material-symbols-outlined">check_circle</span>
                          Approve — No Return Needed
                        </button>
                        <button className="btn"
                          style={{
                            flex:1, justifyContent:'center',
                            background:'rgba(197,0,26,0.06)',
                            color:'var(--red)',
                            border:'1.5px solid rgba(197,0,26,0.25)'
                          }}
                          onClick={() => rejectReturn(selected)}>
                          <span className="material-symbols-outlined">cancel</span>
                          Reject Return
                        </button>
                      </div>
                    </>
                  )}

                  {selected.status === 'in_progress' && selected.currentStep === 3 && (
                    <button className="btn btn-primary"
                      style={{ width:'100%', justifyContent:'center' }}
                      onClick={() => markReceived(selected)}>
                      <span className="material-symbols-outlined">inventory</span>
                      Mark Item as Received
                    </button>
                  )}

                  {selected.status === 'in_progress' && selected.currentStep === 4 && (
                    <button className="btn"
                      style={{ width:'100%', justifyContent:'center', background:'var(--green)', color:'white', border:'none' }}
                      onClick={() => issueRefund(selected)}>
                      <span className="material-symbols-outlined">payments</span>
                      Issue Refund via Stripe
                    </button>
                  )}

                  {selected.status === 'completed' && (
                    <div style={{
                      padding:'10px 12px', background:'rgba(0,108,53,0.06)',
                      border:'1px solid rgba(0,108,53,0.25)', borderRadius: 0,
                      fontSize:11, color:'var(--green)', display:'flex', alignItems:'center', gap:8,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize:16 }}>check_circle</span>
                      Return completed · €{refundTotal.toFixed(2)} refunded to customer.
                    </div>
                  )}

                  {selected.status === 'rejected' && (
                    <div style={{
                      padding:'10px 12px', background:'rgba(197,0,26,0.06)',
                      border:'1px solid rgba(197,0,26,0.25)', borderRadius: 0,
                      fontSize:11, color:'var(--red)', display:'flex', alignItems:'center', gap:8,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize:16 }}>cancel</span>
                      Return rejected · customer notified.
                    </div>
                  )}

                  <button className="btn btn-whatsapp"
                    style={{ width:'100%', justifyContent:'center' }}
                    onClick={() => whatsapp(selected)}>
                    <span className="material-symbols-outlined">chat_bubble</span>
                    WhatsApp {selected.customer.split(' ')[0]} {selected.customer.split(' ').slice(1).join(' ')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:20, right:20, zIndex:1000,
          padding:'10px 14px', background:'var(--white)', borderRadius: 0,
          border:'1px solid var(--mist)', boxShadow:'0 4px 16px rgba(26,18,9,0.14)',
          fontSize:11, color:'var(--deep)', fontWeight:600, display:'flex', alignItems:'center', gap:8,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize:14, color:'var(--gold)' }}>check_circle</span>
          {toast}
        </div>
      )}
    </>
  )
}
