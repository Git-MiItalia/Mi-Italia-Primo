import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { isWhatsappEnabled } from '../lib/auth'
import { statusLabel } from '../lib/statusLabel'
import Loading from '../components/ui/Loading'
import useLangStore from '../store/langStore'

const API = import.meta.env.VITE_API_URL

// Locale is passed in, never hardcoded to 'en': an Italian boutique expects
// "set 2026" and "€1.234", not "Sep 2026" and "€1,234".
const loc = (lang) => (lang === 'it' ? 'it-IT' : 'en-GB')

function fmtDate(iso, lang) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(loc(lang), { month:'short', year:'numeric' })
}

function fmtSpend(val, lang) {
  if (!val) return '€0'
  return `€${parseFloat(val).toLocaleString(loc(lang), { minimumFractionDigits:0, maximumFractionDigits:0, useGrouping:true })}`
}

// Repeat buyers are counted from purchase_count — that one is populated, unlike
// visit_count. Not shown as a per-customer figure: the screen asks for visits.
function purchaseCount(c) {
  return c?.purchase_count ?? 0
}

const SOURCE_LABELS = { walkin: 'In-store', csv: 'CSV Import', mi_italia: 'Mi Italia', new_mi_italia: 'Mi Italia App', online: 'Online' }
function sourceLabel(source) {
  if (!source) return '—'
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source]
  return source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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
  const [loadFailed, setLoadFailed]       = useState(false)
  const [detailFailed, setDetailFailed]   = useState(false)
  const [reloadTick, setReloadTick]       = useState(0)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch]               = useState('')
  const [filterTag, setFilterTag]         = useState('all')
  const [stats, setStats]                 = useState({ totalCustomers:0, newThisMonth:0, repeatBuyers:0, avgLifetimeValue:0 })
  const [allCustomersLoaded, setAllCustomersLoaded] = useState(false)

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
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)

    // The endpoint pages (it returns pagination.has_more), but only page 1 was
    // ever requested. Search and the segment filter both run over the loaded
    // array, so a customer on page 2 simply could not be found — the search
    // returned nothing and they looked as though they did not exist.
    // Every page is loaded, the same way Products.jsx does it.
    async function loadAllCustomers() {
      const first = await apiFetch(`${API}/boutique/customers?page=1&limit=100`).then(r => r.json())
      if (first.success === false || !first.data) throw new Error(first.message || 'customers request failed')

      let all      = first.data.customers ?? []
      const pg     = first.data.pagination ?? {}
      const pages  = pg.total_pages ?? (pg.has_more ? null : 1)
      const perPage = pg.limit ?? 100

      if (pages && pages > 1) {
        const rest = await Promise.all(
          Array.from({ length: pages - 1 }, (_, i) =>
            apiFetch(`${API}/boutique/customers?page=${i + 2}&limit=${perPage}`)
              .then(r => r.json())
              .then(p => p.data?.customers ?? [])
              .catch(() => [])
          )
        )
        all = all.concat(...rest)
      } else if (pages == null) {
        // No total_pages, only has_more — walk forward until it stops.
        let page = 2, more = pg.has_more === true
        while (more && page <= 50) {
          const res = await apiFetch(`${API}/boutique/customers?page=${page}&limit=${perPage}`)
            .then(r => r.json()).catch(() => null)
          const rows = res?.data?.customers ?? []
          all = all.concat(rows)
          more = res?.data?.pagination?.has_more === true && rows.length > 0
          page++
        }
      }
      return { all, complete: true }
    }

    Promise.all([
      loadAllCustomers(),
      apiFetch(`${API}/boutique/customers/stats`).then(r => r.json()).catch(() => null),
    ]).then(([{ all, complete }, statsRes]) => {
      if (cancelled) return
      setCustomers(all)
      setAllCustomersLoaded(complete)
      if (all.length > 0) fetchDetail(all[0].id)
      else setSelected(null)
      if (statsRes?.success) setStats(mapStats(statsRes.data))
    }).catch(() => {
      // Previously just cleared the spinner, leaving an empty table that read
      // as "this boutique has no customers".
      if (cancelled) return
      setCustomers([]); setSelected(null); setLoadFailed(true)
    }).finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [lang, reloadTick])

  // The stats endpoint has no repeat-buyer figure, so it always came back 0 —
  // wrong the moment anyone buys twice. Count it from the loaded rows instead,
  // but only when every customer is on this page; otherwise show '—' rather
  // than a number that's short by however many rows aren't loaded.
  const repeatBuyersDisplay = stats.repeatBuyers
    ? stats.repeatBuyers
    : allCustomersLoaded
      ? customers.filter(c => purchaseCount(c) > 1).length
      : '—'

  function fetchDetail(id) {
    setDetailLoading(true)
    setDetailFailed(false)
    apiFetch(`${API}/boutique/customers/${id}`)
      .then(r => r.json())
      .then(res => {
        // No success check and no catch before this: on an error payload
        // setSelected(undefined) blanked the panel, and because
        // setDetailLoading(false) lived inside this .then the panel spun
        // forever on a dropped request.
        if (res.success === false || !res.data) throw new Error(res.message || 'customer detail failed')
        setSelected(res.data)
        setNotesValue(res.data.notes ?? '')
      })
      .catch(() => { setSelected(null); setDetailFailed(true) })
      .finally(() => setDetailLoading(false))
  }

  function createCustomer() {
    if (!newName || !newEmail) { setAddError(t('customers.add_modal.error_required', 'Name and email are required.')); return }
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
          setAddError(res.message ?? t('customers.add_modal.error_generic', 'Failed to add customer.'))
        }
      })
      .catch(() => setAddError(t('common.error_network', 'Network error. Please try again.')))
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

  // Two bugs here before:
  //   1. phone was not searchable, so a walk-in you only know by number
  //      could not be found;
  //   2. `c.name?.…  || c.email?.…` is undefined when BOTH are missing, so a
  //      customer with only a phone was filtered out even with an empty
  //      search box — invisible, not merely unfindable.
  // Digits are compared with punctuation stripped so "+39 340 123" matches
  // "3401234567".
  const q        = search.trim().toLowerCase()
  const qDigits  = q.replace(/\D/g, '')
  const filteredCustomers = customers.filter(c => {
    const matchSearch = !q
      || (c.name  ?? '').toLowerCase().includes(q)
      || (c.email ?? '').toLowerCase().includes(q)
      || (qDigits.length > 0 && (c.phone ?? '').replace(/\D/g, '').includes(qDigits))
    const matchTag = filterTag === 'all' || c.segment === filterTag
    return matchSearch && matchTag
  })

  /* Page-level wait, like Subscription: this tab is driven by one fetch, so
     until it lands there is nothing truthful to draw. Safe as an early return
     because every hook in this component is declared above it. */
  if (loading) return <Loading page />

  return (
    <div className="grid2 cu-grid">

      {/* ── LEFT COLUMN ── */}
      <div>
        <div className="cu-search-bar">
          <div className="cu-search-input-wrap">
            <span className="material-symbols-outlined cu-search-icon">search</span>
            <input
              className="cu-search-input"
              placeholder={t('customers.search_placeholder', 'Search customers…')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="form-select cu-filter-select" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
            <option value="all">{t('customers.filter_all', 'All')}</option>
            <option value="vip">{t('customers.filter_vip', 'VIP')}</option>
            <option value="repeat">{t('customers.filter_repeat', 'Repeat')}</option>
            <option value="new">{t('customers.filter_new', 'New')}</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <span className="material-symbols-outlined">add</span>{t('customers.add_btn', 'Add Customer')}
          </button>
        </div>

        {/* Stats */}
        <div className="stat-row cu-stats">
          <div className="stat-card"><div className="stat-lbl">{t('customers.stats.total', 'Total Customers')}</div><div className="stat-val">{stats.totalCustomers}</div></div>
          <div className="stat-card"><div className="stat-lbl">{t('customers.stats.new_month', 'New This Month')}</div><div className="stat-val">{stats.newThisMonth}</div></div>
          <div className="stat-card"><div className="stat-lbl">{t('customers.stats.repeat', 'Repeat Buyers')}</div><div className="stat-val">{repeatBuyersDisplay}</div></div>
          <div className="stat-card"><div className="stat-lbl">{t('customers.stats.avg_lifetime', 'Avg. Lifetime Value')}</div><div className="stat-val">{fmtSpend(stats.avgLifetimeValue, lang)}</div></div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('customers.card_title', 'All')} <em>{t('customers.card_title_em', 'Customers')}</em></div>
          </div>


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
                  <div className="customer-email">{c.email} · {sourceLabel(c.source)}</div>
                </div>
                <div className="cu-row-spend">
                  <div className="cu-spend-val">{fmtSpend(c.total_spend, lang)}</div>
                  <div className="cu-visit-count">{c.visit_count ?? 0} {t('customers.detail.visits', 'Visits').toLowerCase()}</div>
                </div>
                <div className={`customer-tag ${tag}`}>{tag.toUpperCase()}</div>
              </div>
            )
          })}

          {/* A failed load used to be indistinguishable from an empty list. */}
          {!loading && loadFailed && (
            <div className="cu-empty">
              {t('customers.err_load', 'Could not load customers.')}{' '}
              <span className="db-alert-link" onClick={() => setReloadTick(n => n + 1)}>
                {t('common.retry', 'Retry')}
              </span>
            </div>
          )}
          {!loading && !loadFailed && filteredCustomers.length === 0 && (
            <div className="cu-empty">{t('customers.empty', 'No customers found.')}</div>
          )}
        </div>
      </div>

      {/* ── RIGHT COLUMN — Detail Panel ── */}
      {!detailLoading && detailFailed && (
        <div className="detail-panel">
          <div className="cu-empty">{t('customers.err_detail', 'Could not load this customer.')}</div>
        </div>
      )}
      {selected && !detailLoading && (
        <div className="detail-panel">
          <div className="detail-panel-hdr">
            <div className="cu-detail-av">
              <span className="material-symbols-outlined cu-detail-av-icon">person</span>
            </div>
            <div className="cu-detail-hdr-body">
              <div className="detail-panel-title">{selected.name}</div>
              <div className="detail-panel-sub">{t('customers.detail.since', 'Customer since')} {fmtDate(selected.created_at, lang)} · {sourceLabel(selected.source)}</div>
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
                { v: fmtSpend(selected.boutique_total_spend, lang), l: t('customers.detail.lifetime_spend', 'Lifetime Spend') },
                { v: String(selected.boutique_visit_count ?? 0), l: t('customers.detail.visits', 'Visits') },
                { v: selected.points_balance ?? '—',    l: t('customers.detail.points', 'Points') },
              ].map(s => (
                <div key={s.l} className="cu-mini-stat">
                  <div className="cu-mini-stat-val">{s.v}</div>
                  <div className="cu-mini-stat-lbl">{s.l}</div>
                </div>
              ))}
            </div>

            <div className="detail-row"><div className="detail-label">{t('customers.detail.email', 'Email')}</div><div className="detail-value">{selected.email ?? '—'}</div></div>
            <div className="detail-row"><div className="detail-label">{t('customers.detail.phone', 'Phone')}</div><div className="detail-value">{selected.phone ?? '—'}</div></div>
            <div className="detail-row"><div className="detail-label">{t('customers.detail.source', 'Source')}</div><div className="detail-value">{sourceLabel(selected.source)}</div></div>
            <div className="detail-row">
              <div className="detail-label">{t('customers.detail.last_visit', 'Last Visit')}</div>
              <div className="detail-value">{selected.boutique_last_visit_at ? fmtDate(selected.boutique_last_visit_at, lang) : t('customers.detail.never', 'Never')}</div>
            </div>
            <div className="detail-row">
              <div className="detail-label">{t('customers.detail.tier', 'Tier')}</div>
              <div className="detail-value">
                <span className="cu-tier-badge">{selected.tier ?? '—'}</span>
              </div>
            </div>

            <div className="detail-divider" />

            {/* Notes */}
            <div className="cu-notes-hdr">
              <div className="cu-notes-lbl">{t('customers.detail.notes', 'Notes')}</div>
              {!editingNotes
                ? <button className="btn btn-sm btn-outline" onClick={() => setEditingNotes(true)}>{t('common.edit', 'Edit')}</button>
                : <div className="cu-notes-actions">
                    <button className="btn btn-sm btn-outline" onClick={() => setEditingNotes(false)}>{t('common.cancel', 'Cancel')}</button>
                    <button className="btn btn-sm btn-primary" onClick={saveNotes}>{t('common.save', 'Save')}</button>
                  </div>
              }
            </div>
            {editingNotes
              ? <textarea className="form-textarea cu-notes-ta" value={notesValue} onChange={e => setNotesValue(e.target.value)} />
              : <div className={`cu-notes-body${selected.notes ? '' : ' cu-notes-empty'}`}>
                  {selected.notes ?? t('customers.detail.notes_empty', 'No notes yet.')}
                </div>
            }

            <div className="detail-divider" />

            {/* Recent Orders */}
            <div className="cu-section-lbl">{t('customers.detail.orders', 'Recent Orders')}</div>
            {selected.recent_orders?.length > 0 ? (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('customers.table.order', 'Order')}</th>
                    <th>{t('customers.table.amount', 'Amount')}</th>
                    <th>{t('customers.table.status', 'Status')}</th>
                    <th>{t('customers.table.date', 'Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.recent_orders.map((o, i) => (
                    <tr key={i}>
                      <td className="cu-order-id">#{String(o.id).slice(0,8)}</td>
                      <td>€{o.gross_amount}</td>
                      <td><span className={`status ${o.status}`}>{statusLabel(t, o.status)}</span></td>
                      <td>{fmtDate(o.created_at, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="cu-empty-italic">{t('customers.detail.orders_empty', 'No orders yet.')}</div>
            )}

            <div className="detail-divider" />

            {/* Recent Reservations */}
            <div className="cu-section-lbl">{t('customers.detail.reservations', 'Recent Reservations')}</div>
            {selected.recent_reservations?.length > 0 ? (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('customers.table.item', 'Item')}</th>
                    <th>{t('customers.table.price', 'Price')}</th>
                    <th>{t('customers.table.status', 'Status')}</th>
                    <th>{t('customers.table.date', 'Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.recent_reservations.map((r, i) => (
                    <tr key={i}>
                      <td>{r.product_name ?? '—'}</td>
                      <td>€{r.pickup_price}</td>
                      <td><span className={`status ${r.status}`}>{statusLabel(t, r.status)}</span></td>
                      <td>{fmtDate(r.confirmed_at, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="cu-empty-italic">{t('customers.detail.reservations_empty', 'No reservations yet.')}</div>
            )}

            <div className="detail-divider" />

            {isWhatsappEnabled() && <button className="btn btn-whatsapp cu-whatsapp-btn"
              onClick={() => {
                const phone = selected.phone?.replace(/\D/g, '')
                if (!phone) return
                const name = selected.name?.split(' ')[0] ?? ''
                const msg = encodeURIComponent(`Ciao ${name}, `)
                window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
              }}>
              <span className="material-symbols-outlined">chat_bubble</span>
              {t('customers.detail.whatsapp', { name: selected.name?.split(' ')[0], defaultValue: 'Message {{name}} on WhatsApp' })}
            </button>}
          </div>
        </div>
      )}

      {/* ── Add Customer Modal ── */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <span className="modal-title">{t('customers.add_modal.title', 'Add')} <em>{t('customers.add_modal.title_em', 'Customer')}</em></span>
              <span className="modal-close" onClick={() => setShowAdd(false)}>
                <span className="material-symbols-outlined">close</span>
              </span>
            </div>
            {addError && <div className="alert alert-urgent cu-alert-mb">{addError}</div>}
            <div className="form-group">
              <label className="form-lbl">{t('customers.add_modal.name_label', 'Name')}</label>
              <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('customers.add_modal.name_placeholder', 'e.g. Sofia Marchetti')} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('customers.add_modal.email_label', 'Email')}</label>
              <input className="form-input" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={t('customers.add_modal.email_placeholder', 'sofia@example.com')} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('customers.add_modal.phone_label', 'Phone')}</label>
              <input className="form-input" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder={t('customers.add_modal.phone_placeholder', '+39 333 000 0000')} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('common.cancel', 'Cancel')}</button>
              <button className="btn btn-primary" onClick={createCustomer}>{t('customers.add_modal.create_btn', 'Add Customer')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-confirm-title">
              {t('customers.delete_modal.title', 'Delete')} <em className="modal-em-red">{t('customers.delete_modal.title_em', 'Customer')}</em>
            </div>
            <div className="modal-confirm-msg">{t('customers.delete_modal.msg', 'Are you sure you want to delete this customer? This cannot be undone.')}</div>
            <div className="modal-confirm-actions">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-outline modal-confirm-btn">{t('common.cancel', 'Cancel')}</button>
              <button onClick={() => deleteCustomer(deleteConfirm)} className="btn btn-red modal-confirm-btn">{t('common.delete', 'Delete')}</button>
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
              {t('customers.add_success.title', 'Customer')} <em className="modal-em-red">{t('customers.add_success.title_em', 'Added')}</em>
            </div>
            <div className="modal-success-msg">
              {t('customers.add_success.msg', { name: createSuccess.name, defaultValue: '{{name}} has been added to your customers.' })}
              {createSuccess.email && <><br />{t('customers.add_success.email_prefix', 'A confirmation was sent to')} <strong>{createSuccess.email}</strong></>}
            </div>
            <button onClick={() => setCreateSuccess(null)} className="btn btn-primary modal-success-btn">{t('common.done', 'Done')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
