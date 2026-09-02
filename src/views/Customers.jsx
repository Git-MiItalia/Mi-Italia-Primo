import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import useLangStore from '../store/langStore'

const API = import.meta.env.VITE_API_URL

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en', { month:'short', year:'numeric' })
}

function fmtSpend(val) {
  if (!val) return '€0'
  return `€${parseFloat(val).toLocaleString('en', { minimumFractionDigits:0, maximumFractionDigits:0 })}`
}

// Backend field names don't match the UI's — map explicitly instead of trusting the raw shape.
// repeatBuyers has no backend equivalent yet (no repeat-purchase count in the stats endpoint).
function mapStats(data) {
  return {
    totalCustomers:   data.totalCustomers ?? 0,
    newThisMonth:     data.newLast30d ?? 0,
    repeatBuyers:     data.repeatBuyers ?? 0,
    avgLifetimeValue: data.avgSpend ?? 0,
  }
}

export default function Customers() {
  const { t } = useTranslation()
  const lang  = useLangStore(s => s.lang)

  const [customers, setCustomers]         = useState([])
  const [selected, setSelected]           = useState(null)
  const [loading, setLoading]             = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch]               = useState('')
  const [filterTag, setFilterTag]         = useState('all')
  const [stats, setStats]                 = useState({ totalCustomers:0, newThisMonth:0, repeatBuyers:0, avgLifetimeValue:0 })

  const [showAdd, setShowAdd]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [addError, setAddError] = useState('')

  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue]     = useState('')

  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [createSuccess, setCreateSuccess] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      apiFetch(`${API}/boutique/customers`).then(r => r.json()),
      apiFetch(`${API}/boutique/customers/stats`).then(r => r.json()),
    ]).then(([custRes, statsRes]) => {
      const list = custRes.data?.customers ?? []
      setCustomers(list)
      if (list.length > 0) fetchDetail(list[0].id)
      if (statsRes.success) setStats(mapStats(statsRes.data))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [lang])

  function fetchDetail(id) {
    setDetailLoading(true)
    apiFetch(`${API}/boutique/customers/${id}`)
      .then(r => r.json())
      .then(res => {
        setSelected(res.data)
        setNotesValue(res.data.notes ?? '')
        setDetailLoading(false)
      })
  }

  function createCustomer() {
    if (!newName || !newEmail) { setAddError(t('customers.add_modal.error_required')); return }
    setAddError('')
    apiFetch(`${API}/boutique/customers`, {
      method: 'POST',
      body: JSON.stringify({ name: newName, email: newEmail, phone: newPhone })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setCustomers(prev => [res.data, ...prev])
          setShowAdd(false)
          setNewName(''); setNewEmail(''); setNewPhone(''); setAddError('')
          setCreateSuccess(res.data)
          fetchDetail(res.data.id)
          // Refresh stats
          apiFetch(`${API}/boutique/customers/stats`).then(r => r.json())
            .then(r => { if (r.success) setStats(mapStats(r.data)) }).catch(() => {})
        } else {
          setAddError(res.message ?? t('customers.add_modal.error_generic'))
        }
      })
      .catch(() => setAddError(t('common.error_network')))
  }

  function saveNotes() {
    if (!selected) return
    apiFetch(`${API}/boutique/customers/${selected.id}`, {
      method: 'PUT',
      body: JSON.stringify({ notes: notesValue })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setSelected(prev => ({ ...prev, notes: notesValue }))
          setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, notes: notesValue } : c))
          setEditingNotes(false)
        }
      })
  }

  function deleteCustomer(id) {
    apiFetch(`${API}/boutique/customers/${id}`, {
      method: 'DELETE'
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setCustomers(prev => {
            const next = prev.filter(c => c.id !== id)
            if (next.length > 0) fetchDetail(next[0].id)
            else setSelected(null)
            return next
          })
          setDeleteConfirm(null)
          // Refresh stats
          apiFetch(`${API}/boutique/customers/stats`).then(r => r.json())
            .then(r => { if (r.success) setStats(mapStats(r.data)) }).catch(() => {})
        }
      })
  }

  const filteredCustomers = customers.filter(c => {
    const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
                        c.email?.toLowerCase().includes(search.toLowerCase())
    const matchTag = filterTag === 'all' || c.segment === filterTag
    return matchSearch && matchTag
  })

  return (
    <div className="grid2 cu-grid">

      {/* ── LEFT COLUMN ── */}
      <div>
        <div className="cu-search-bar">
          <div className="cu-search-input-wrap">
            <span className="material-symbols-outlined cu-search-icon">search</span>
            <input
              className="cu-search-input"
              placeholder={t('customers.search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="form-select cu-filter-select" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
            <option value="all">{t('customers.filter_all')}</option>
            <option value="vip">{t('customers.filter_vip')}</option>
            <option value="repeat">{t('customers.filter_repeat')}</option>
            <option value="new">{t('customers.filter_new')}</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <span className="material-symbols-outlined">add</span>{t('customers.add_btn')}
          </button>
        </div>

        {/* Stats */}
        <div className="stat-row cu-stats">
          <div className="stat-card"><div className="stat-lbl">{t('customers.stats.total')}</div><div className="stat-val">{stats.totalCustomers}</div></div>
          <div className="stat-card"><div className="stat-lbl">{t('customers.stats.new_month')}</div><div className="stat-val">{stats.newThisMonth}</div></div>
          <div className="stat-card"><div className="stat-lbl">{t('customers.stats.repeat')}</div><div className="stat-val">{stats.repeatBuyers}</div></div>
          <div className="stat-card"><div className="stat-lbl">{t('customers.stats.avg_lifetime')}</div><div className="stat-val">{fmtSpend(stats.avgLifetimeValue)}</div></div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('customers.card_title')} <em>{t('customers.card_title_em')}</em></div>
          </div>

          {loading && (
            <div className="cu-loading">
              <span className="material-symbols-outlined">hourglass_empty</span>
              <div>{t('customers.loading')}</div>
            </div>
          )}

          {!loading && filteredCustomers.map((c, i) => {
            const tag = c.segment || 'new'
            return (
              <div
                key={c.id}
                className={`customer-row${i === filteredCustomers.length - 1 ? ' cu-last' : ''}`}
                onClick={() => fetchDetail(c.id)}
              >
                <div className="customer-av cu-av-icon">
                  <span className="material-symbols-outlined cu-person-icon">person</span>
                </div>
                <div className="cu-row-body">
                  <div className="customer-name">{c.name}</div>
                  <div className="customer-email">{c.email} · {c.source}</div>
                </div>
                <div className="cu-row-spend">
                  <div className="cu-spend-val">{fmtSpend(c.total_spend)}</div>
                  <div className="cu-visit-count">{c.visit_count} {t('customers.detail.visits').toLowerCase()}</div>
                </div>
                <div className={`customer-tag ${tag}`}>{tag.toUpperCase()}</div>
              </div>
            )
          })}

          {!loading && filteredCustomers.length === 0 && (
            <div className="cu-empty">{t('customers.empty')}</div>
          )}
        </div>
      </div>

      {/* ── RIGHT COLUMN — Detail Panel ── */}
      {selected && !detailLoading && (
        <div className="detail-panel">
          <div className="detail-panel-hdr">
            <div className="cu-detail-av">
              <span className="material-symbols-outlined cu-detail-av-icon">person</span>
            </div>
            <div className="cu-detail-hdr-body">
              <div className="detail-panel-title">{selected.name}</div>
              <div className="detail-panel-sub">{t('customers.detail.since')} {fmtDate(selected.created_at)} · {selected.source}</div>
            </div>
            <div className="cu-detail-hdr-actions">
              <span className={`customer-tag ${selected.segment || 'new'}`}>
                {(selected.segment || 'new').toUpperCase()}
              </span>
              <button className="btn btn-sm btn-red" onClick={() => setDeleteConfirm(selected.id)}>
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>

          <div className="detail-panel-body">
            {/* Mini stats */}
            <div className="stat-row col3 cu-mini-stats">
              {[
                { v: fmtSpend(selected.total_spend), l: t('customers.detail.lifetime_spend') },
                { v: String(selected.visit_count ?? 0), l: t('customers.detail.visits') },
                { v: selected.points_balance ?? '—',    l: t('customers.detail.points') },
              ].map(s => (
                <div key={s.l} className="cu-mini-stat">
                  <div className="cu-mini-stat-val">{s.v}</div>
                  <div className="cu-mini-stat-lbl">{s.l}</div>
                </div>
              ))}
            </div>

            <div className="detail-row"><div className="detail-label">{t('customers.detail.email')}</div><div className="detail-value">{selected.email ?? '—'}</div></div>
            <div className="detail-row"><div className="detail-label">{t('customers.detail.phone')}</div><div className="detail-value">{selected.phone ?? '—'}</div></div>
            <div className="detail-row"><div className="detail-label">{t('customers.detail.source')}</div><div className="detail-value">{selected.source}</div></div>
            <div className="detail-row">
              <div className="detail-label">{t('customers.detail.last_visit')}</div>
              <div className="detail-value">{selected.last_visit_at ? fmtDate(selected.last_visit_at) : t('customers.detail.never')}</div>
            </div>
            <div className="detail-row">
              <div className="detail-label">{t('customers.detail.tier')}</div>
              <div className="detail-value">
                <span className="cu-tier-badge">{selected.tier ?? '—'}</span>
              </div>
            </div>

            <div className="detail-divider" />

            {/* Notes */}
            <div className="cu-notes-hdr">
              <div className="cu-notes-lbl">{t('customers.detail.notes')}</div>
              {!editingNotes
                ? <button className="btn btn-sm btn-outline" onClick={() => setEditingNotes(true)}>{t('common.edit')}</button>
                : <div className="cu-notes-actions">
                    <button className="btn btn-sm btn-outline" onClick={() => setEditingNotes(false)}>{t('common.cancel')}</button>
                    <button className="btn btn-sm btn-primary" onClick={saveNotes}>{t('common.save')}</button>
                  </div>
              }
            </div>
            {editingNotes
              ? <textarea className="form-textarea cu-notes-ta" value={notesValue} onChange={e => setNotesValue(e.target.value)} />
              : <div className={`cu-notes-body${selected.notes ? '' : ' cu-notes-empty'}`}>
                  {selected.notes ?? t('customers.detail.notes_empty')}
                </div>
            }

            <div className="detail-divider" />

            {/* Recent Orders */}
            <div className="cu-section-lbl">{t('customers.detail.orders')}</div>
            {selected.recent_orders?.length > 0 ? (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('customers.table.order')}</th>
                    <th>{t('customers.table.amount')}</th>
                    <th>{t('customers.table.status')}</th>
                    <th>{t('customers.table.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.recent_orders.map((o, i) => (
                    <tr key={i}>
                      <td className="cu-order-id">#{String(o.id).slice(0,8)}</td>
                      <td>€{o.gross_amount}</td>
                      <td><span className={`status ${o.status}`}>{o.status}</span></td>
                      <td>{fmtDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="cu-empty-italic">{t('customers.detail.orders_empty')}</div>
            )}

            <div className="detail-divider" />

            {/* Recent Reservations */}
            <div className="cu-section-lbl">{t('customers.detail.reservations')}</div>
            {selected.recent_reservations?.length > 0 ? (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('customers.table.item')}</th>
                    <th>{t('customers.table.price')}</th>
                    <th>{t('customers.table.status')}</th>
                    <th>{t('customers.table.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.recent_reservations.map((r, i) => (
                    <tr key={i}>
                      <td>{r.product_name ?? '—'}</td>
                      <td>€{r.pickup_price}</td>
                      <td><span className={`status ${r.status}`}>{r.status}</span></td>
                      <td>{fmtDate(r.confirmed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="cu-empty-italic">{t('customers.detail.reservations_empty')}</div>
            )}

            <div className="detail-divider" />

            <button className="btn btn-whatsapp cu-whatsapp-btn"
              onClick={() => {
                const phone = selected.phone?.replace(/\D/g, '')
                if (!phone) return
                const name = selected.name?.split(' ')[0] ?? ''
                const msg = encodeURIComponent(`Ciao ${name}, `)
                window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
              }}>
              <span className="material-symbols-outlined">chat_bubble</span>
              {t('customers.detail.whatsapp', { name: selected.name?.split(' ')[0] })}
            </button>
          </div>
        </div>
      )}

      {/* ── Add Customer Modal ── */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <span className="modal-title">{t('customers.add_modal.title')} <em>{t('customers.add_modal.title_em')}</em></span>
              <span className="modal-close" onClick={() => setShowAdd(false)}>
                <span className="material-symbols-outlined">close</span>
              </span>
            </div>
            {addError && <div className="alert alert-urgent cu-alert-mb">{addError}</div>}
            <div className="form-group">
              <label className="form-lbl">{t('customers.add_modal.name_label')}</label>
              <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('customers.add_modal.name_placeholder')} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('customers.add_modal.email_label')}</label>
              <input className="form-input" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={t('customers.add_modal.email_placeholder')} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('customers.add_modal.phone_label')}</label>
              <input className="form-input" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder={t('customers.add_modal.phone_placeholder')} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={createCustomer}>{t('customers.add_modal.create_btn')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-confirm-title">
              {t('customers.delete_modal.title')} <em className="modal-em-red">{t('customers.delete_modal.title_em')}</em>
            </div>
            <div className="modal-confirm-msg">{t('customers.delete_modal.msg')}</div>
            <div className="modal-confirm-actions">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-outline modal-confirm-btn">{t('common.cancel')}</button>
              <button onClick={() => deleteCustomer(deleteConfirm)} className="btn btn-red modal-confirm-btn">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Success Modal ── */}
      {createSuccess && (
        <div className="modal-backdrop" onClick={() => setCreateSuccess(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-success-emoji">✅</div>
            <div className="modal-success-title">
              {t('customers.add_success.title')} <em className="modal-em-red">{t('customers.add_success.title_em')}</em>
            </div>
            <div className="modal-success-msg">
              {t('customers.add_success.msg', { name: createSuccess.name })}
              {createSuccess.email && <><br />{t('customers.add_success.email_prefix')} <strong>{createSuccess.email}</strong></>}
            </div>
            <button onClick={() => setCreateSuccess(null)} className="btn btn-primary modal-success-btn">{t('common.done')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
