import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// ─── Pipeline template ───────────────────────────────────
// Moved inside component for t() access

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

// ─── Main ────────────────────────────────────────────────

export default function Returns() {
  const { t } = useTranslation()
  const [returns,       setReturns]       = useState(MOCK_RETURNS)
  const [activeTab,     setActiveTab]     = useState('open')
  const [selectedId,    setSelectedId]    = useState('RET-084')
  const [toast,         setToast]         = useState(null)

  const REASONS = [
    { key:'damaged',        label: t('ret.reasons.damaged')       },
    { key:'wrong_size',     label: t('ret.reasons.wrong_size')    },
    { key:'not_described',  label: t('ret.reasons.not_described') },
    { key:'changed_mind',   label: t('ret.reasons.changed_mind')  },
    { key:'too_late',       label: t('ret.reasons.too_late')      },
    { key:'quality',        label: t('ret.reasons.quality')       },
  ]

  const PIPELINE = [
    { num:1, title: t('ret.pipeline.requested'),   sub: t('ret.pipeline.requested_sub')  },
    { num:2, title: t('ret.pipeline.review'),       sub: t('ret.pipeline.review_sub')      },
    { num:3, title: t('ret.pipeline.ships'),        sub: t('ret.pipeline.ships_sub')       },
    { num:4, title: t('ret.pipeline.received'),     sub: t('ret.pipeline.received_sub')    },
    { num:5, title: t('ret.pipeline.refunded'),     sub: t('ret.pipeline.refunded_sub')    },
  ]

  const TABS = [
    { key:'open',        label: t('ret.tabs_labels.open')        },
    { key:'in_progress', label: t('ret.tabs_labels.in_progress') },
    { key:'completed',   label: t('ret.tabs_labels.completed')   },
    { key:'rejected',    label: t('ret.tabs_labels.rejected')    },
  ]

  function statusLabel(s) {
    return s === 'in_progress' ? t('ret.tabs_labels.in_progress')
         : s === 'completed'   ? t('ret.tabs_labels.completed')
         : s === 'rejected'    ? t('ret.tabs_labels.rejected')
         : t('ret.tabs_labels.open')
  }
  function statusPill(s) {
    return s === 'open'        ? 'pending'
         : s === 'in_progress' ? 'shipped'
         : s === 'completed'   ? 'active'
         : s === 'rejected'    ? 'cancelled'
         : 'pending'
  }

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
    showToast(t('ret.toast.dhl_generated'))
  }
  function approveNoReturn(r) {
    updateReturn(r.id, { status:'completed', currentStep:5 })
    setActiveTab('completed')
    showToast(t('ret.toast.approved'))
  }
  function rejectReturn(r) {
    updateReturn(r.id, { status:'rejected' })
    setActiveTab('rejected')
    showToast(t('ret.toast.rejected'))
  }
  function markReceived(r) {
    updateReturn(r.id, { currentStep:4 })
    showToast(t('ret.toast.received'))
  }
  function issueRefund(r) {
    updateReturn(r.id, { status:'completed', currentStep:5 })
    setActiveTab('completed')
    showToast(t('ret.toast.refunded'))
  }
  function whatsapp(r) {
    showToast(t('ret.toast.whatsapp', { name: r.customer }))
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
                {t('ret.empty_list', { status: statusLabel(activeTab).toLowerCase() })}
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('ret.table.id')}</th><th>{t('ret.table.customer')}</th><th>{t('ret.table.item')}</th>
                    <th>{t('ret.table.reason')}</th><th>{t('ret.value')}</th><th>{t('ret.table.opened')}</th><th>{t('ret.table.status')}</th>
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
              {t('ret.empty_detail')}
            </div>
          ) : (
            <>
              <div className="detail-panel-hdr">
                <div className="detail-panel-icon">
                  <span className="material-symbols-outlined">undo</span>
                </div>
                <div>
                  <div className="detail-panel-title">{t('ret.detail.return')} #{selected.id}</div>
                  <div className="detail-panel-sub">
                    {selected.customer} · {t('ret.detail.order')} #{selected.orderId} · {t('ret.opened')} {selected.opened}
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
                        {t('ret.item_meta', { size: it.size, colour: it.colour, sku: it.sku })}
                        {it.qty > 1 && t('ret.item_qty_suffix', { qty: it.qty })}
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
                }}>{t('ret.detail.pipeline')}</div>

                <div style={{ marginBottom:14 }}>
                  {PIPELINE.map((step, idx) => {
                    const isDone   = selected.currentStep > step.num || selected.status === 'completed'
                    const isActive = selected.currentStep === step.num && selected.status !== 'rejected' && selected.status !== 'completed'
                    const isRejected = selected.status === 'rejected' && step.num >= selected.currentStep

                    const numClass = isDone ? 'done' : isActive ? 'active' : 'todo'

                    let timing = '—'
                    if (step.num === 1) timing = selected.openedTime
                    else if (isActive)  timing = t('ret.now')

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
                }}>{t('ret.reason_label')}</div>
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
                    {t('ret.reason_note', { detail: selected.reasonDetail })}
                  </div>
                )}

                {/* Refund breakdown */}
                <div style={{
                  fontSize:10, fontWeight:600, color:'var(--stone)',
                  textTransform:'uppercase', letterSpacing:0.5, marginBottom:8,
                }}>{t('ret.refund_breakdown')}</div>
                <div className="refund-breakdown">
                  <div className="refund-line"><span>{t('ret.item_total')}</span><span>€{selected.value.toFixed(2)}</span></div>
                  <div className="refund-line"><span>{t('ret.dhl_shipping')}</span><span>€{selected.shippingCost.toFixed(2)} {t('ret.prepaid')}</span></div>
                  <div className="refund-line deduction">
                    <span>{t('ret.restocking_fee')}</span>
                    <span>−€{selected.restockingFee.toFixed(2)}</span>
                  </div>
                  <div className="refund-line total">
                    <span>{t('ret.refund_total')}</span>
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
                        {t('ret.actions.generate_dhl')}
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
                          {t('ret.actions.approve_no_return')}
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
                          {t('ret.actions.reject')}
                        </button>
                      </div>
                    </>
                  )}

                  {selected.status === 'in_progress' && selected.currentStep === 3 && (
                    <button className="btn btn-primary"
                      style={{ width:'100%', justifyContent:'center' }}
                      onClick={() => markReceived(selected)}>
                      <span className="material-symbols-outlined">inventory</span>
                      {t('ret.actions.mark_received')}
                    </button>
                  )}

                  {selected.status === 'in_progress' && selected.currentStep === 4 && (
                    <button className="btn"
                      style={{ width:'100%', justifyContent:'center', background:'var(--green)', color:'white', border:'none' }}
                      onClick={() => issueRefund(selected)}>
                      <span className="material-symbols-outlined">payments</span>
                      {t('ret.actions.issue_refund')}
                    </button>
                  )}

                  {selected.status === 'completed' && (
                    <div style={{
                      padding:'10px 12px', background:'rgba(0,108,53,0.06)',
                      border:'1px solid rgba(0,108,53,0.25)', borderRadius: 0,
                      fontSize:11, color:'var(--green)', display:'flex', alignItems:'center', gap:8,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize:16 }}>check_circle</span>
                      {t('ret.banner.completed', { amount: '€' + refundTotal.toFixed(2) })}
                    </div>
                  )}

                  {selected.status === 'rejected' && (
                    <div style={{
                      padding:'10px 12px', background:'rgba(197,0,26,0.06)',
                      border:'1px solid rgba(197,0,26,0.25)', borderRadius: 0,
                      fontSize:11, color:'var(--red)', display:'flex', alignItems:'center', gap:8,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize:16 }}>cancel</span>
                      {t('ret.banner.rejected')}
                    </div>
                  )}

                  <button className="btn btn-whatsapp"
                    style={{ width:'100%', justifyContent:'center' }}
                    onClick={() => whatsapp(selected)}>
                    <span className="material-symbols-outlined">chat_bubble</span>
                    {t('ret.actions.whatsapp', { name: selected.customer })}
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
