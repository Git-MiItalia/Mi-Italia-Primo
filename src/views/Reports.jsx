import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'

const API = import.meta.env.VITE_API_URL

// ─── Report definitions ──────────────────────────────────
// `endpoint`     = base path relative to API. null = coming soon.
// `hasPeriod`    = append ?period=<dateRange> to URL
// `hasPagination`= append &page=1&limit=100
// `nameKey` / `metaKey` = i18n keys within `reports.items.*`

const SALES_REPORTS = [
  {
    key:'sales', nameKey:'sales_report', icon:'payments', variant:'sales',
    endpoint:'/boutique/reports/sales', hasPeriod:true,
  },
  {
    key:'vat', nameKey:'vat_report', icon:'receipt_long', variant:'tax',
    endpoint:'/boutique/reports/vat', hasPeriod:true,
  },
  {
    key:'payouts', nameKey:'payout_history', icon:'local_shipping', variant:'sales',
    endpoint:null,
  },
]

const LOOKS_REPORTS = [
  {
    key:'looks', nameKey:'looks_feed', icon:'auto_awesome', variant:'looks',
    endpoint:'/boutique/reports/looks-feed', hasPeriod:true,
  },
]

const INVENTORY_REPORTS = [
  {
    key:'inventory', nameKey:'inventory_report', icon:'warehouse', variant:'inventory',
    endpoint:'/boutique/reports/inventory', hasPeriod:false,
  },
  {
    key:'top-products', nameKey:'top_products', icon:'trending_up', variant:'inventory',
    endpoint:null,
  },
]

const CUSTOMER_REPORTS = [
  {
    key:'customers', nameKey:'customer_export', icon:'group', variant:'customer',
    endpoint:'/boutique/reports/customers', hasPeriod:false, hasPagination:true,
  },
  {
    key:'returns', nameKey:'returns_report', icon:'undo', variant:'customer',
    endpoint:'/boutique/reports/returns', hasPeriod:true,
  },
]

const SCHEDULED_REPORTS = [
  { id:'s1', nameKey:'sales_report',     frequency:'Weekly · Monday', format:'pdf',
    recipients:['giulia@ateliersbianchi.it'], nextRun:'Mar 25' },
  { id:'s2', nameKey:'inventory_report', frequency:'Daily · 08:00',   format:'csv',
    recipients:['giulia@ateliersbianchi.it','ops@ateliersbianchi.it'], nextRun:'Tomorrow' },
  { id:'s3', nameKey:'vat_report',       frequency:'Monthly · 1st',   format:'pdf',
    recipients:['accounting@ateliersbianchi.it'], nextRun:'Apr 1' },
]

// ─── CSV utilities ───────────────────────────────────────

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function csvRow(cells) { return cells.map(csvEscape).join(',') }

function csvTable(rows, headerOverrides = null) {
  if (!rows || rows.length === 0) return csvRow(['(no data)'])
  const cols = Object.keys(rows[0])
  const headerRow = headerOverrides
    ? csvRow(cols.map(c => headerOverrides[c] ?? c))
    : csvRow(cols)
  const bodyRows = rows.map(r => csvRow(cols.map(c => r[c])))
  return [headerRow, ...bodyRows].join('\n')
}

function fmtDate(iso) {
  if (!iso) return ''
  try   { return new Date(iso).toISOString().slice(0,10) }
  catch { return iso }
}

// ─── Per-report CSV builders ─────────────────────────────

function buildSalesCsv(data) {
  const p = data.period ?? {}, t = data.totals ?? {}
  const parts = []
  parts.push(csvRow(['Sales Report']))
  parts.push(csvRow(['Period', p.type]))
  parts.push(csvRow(['Start',  fmtDate(p.start)]))
  parts.push(csvRow(['End',    fmtDate(p.end)]))
  parts.push('')
  parts.push(csvRow(['TOTALS']))
  parts.push(csvRow(['Orders',        t.orders     ?? 0]))
  parts.push(csvRow(['Gross (€)',     t.gross      ?? 0]))
  parts.push(csvRow(['Commission (€)',t.commission ?? 0]))
  parts.push(csvRow(['Net (€)',       t.net        ?? 0]))
  parts.push('')
  parts.push(csvRow(['BY CHANNEL']))
  parts.push(csvTable(data.by_channel))
  parts.push('')
  parts.push(csvRow(['BY DAY']))
  parts.push(csvTable(data.by_day))
  return parts.join('\n')
}

function buildVatCsv(data) {
  const p = data.period ?? {}, t = data.totals ?? {}
  const parts = []
  parts.push(csvRow(['VAT / Tax Report']))
  parts.push(csvRow(['Period', p.type]))
  parts.push(csvRow(['Start',  fmtDate(p.start)]))
  parts.push(csvRow(['End',    fmtDate(p.end)]))
  parts.push('')
  parts.push(csvRow(['TOTALS']))
  parts.push(csvRow(['Net (€)',   t.net   ?? 0]))
  parts.push(csvRow(['VAT (€)',   t.vat   ?? 0]))
  parts.push(csvRow(['Gross (€)', t.gross ?? 0]))
  parts.push('')
  parts.push(csvRow(['BY COUNTRY']))
  parts.push(csvTable(data.by_country))
  return parts.join('\n')
}

function buildInventoryCsv(data) {
  const t = data.totals ?? {}
  const parts = []
  parts.push(csvRow(['Inventory Report']))
  parts.push(csvRow(['Generated at', fmtDate(data.generated_at)]))
  parts.push('')
  parts.push(csvRow(['TOTALS']))
  parts.push(csvRow(['Products',              t.products              ?? 0]))
  parts.push(csvRow(['Total units',           t.total_units           ?? 0]))
  parts.push(csvRow(['Low stock variants',    t.low_stock_variants    ?? 0]))
  parts.push(csvRow(['Out of stock variants', t.out_of_stock_variants ?? 0]))
  parts.push('')
  parts.push(csvRow(['INVENTORY (flattened by variant)']))
  const rows = []
  ;(data.products ?? []).forEach(p => {
    ;(p.variants ?? []).forEach(v => {
      rows.push({
        Product:      p.name,
        SKU:          p.sku,
        Size:         v.size_label,
        Colour:       v.colour ?? '',
        Stock:        v.stock_qty,
        LowThreshold: v.low_stock_threshold,
        TotalStock:   p.total_stock,
        Status:       p.stock_status,
      })
    })
  })
  parts.push(csvTable(rows))
  return parts.join('\n')
}

function buildCustomersCsv(data) {
  const t = data.totals ?? {}
  const parts = []
  parts.push(csvRow(['Customer Export']))
  parts.push(csvRow(['Total customers',    t.customers   ?? 0]))
  parts.push(csvRow(['Total value (€)',    t.total_value ?? 0]))
  if (data.note) parts.push(csvRow(['Note', data.note]))
  parts.push('')
  const rows = (data.customers ?? []).map(c => ({
    Name:          c.name,
    Email:         c.email,
    Orders:        c.orders,
    'LTV (€)':     c.lifetime_value,
    'Last order':  fmtDate(c.last_order_at),
    UserID:        c.user_id,
  }))
  parts.push(csvTable(rows))
  return parts.join('\n')
}

function buildReturnsCsv(data) {
  const p = data.period ?? {}, t = data.totals ?? {}
  const parts = []
  parts.push(csvRow(['Returns Report']))
  parts.push(csvRow(['Period', p.type]))
  parts.push(csvRow(['Start',  fmtDate(p.start)]))
  parts.push(csvRow(['End',    fmtDate(p.end)]))
  parts.push('')
  parts.push(csvRow(['TOTALS']))
  parts.push(csvRow(['Count',      t.count  ?? 0]))
  parts.push(csvRow(['Amount (€)', t.amount ?? 0]))
  parts.push('')
  parts.push(csvRow(['REFUNDS']))
  parts.push(csvTable(data.refunds))
  return parts.join('\n')
}

function buildLooksCsv(data) {
  const p = data.period ?? {}, t = data.totals ?? {}
  const parts = []
  parts.push(csvRow(['Looks Feed Performance']))
  parts.push(csvRow(['Period', p.type]))
  parts.push(csvRow(['Start',  fmtDate(p.start)]))
  parts.push(csvRow(['End',    fmtDate(p.end)]))
  if (data.note) parts.push(csvRow(['Note', data.note]))
  parts.push('')
  parts.push(csvRow(['TOTALS']))
  parts.push(csvRow(['Looks',       t.looks   ?? 0]))
  parts.push(csvRow(['Likes',       t.likes   ?? 0]))
  parts.push(csvRow(['Try-ons',     t.try_ons ?? 0]))
  parts.push(csvRow(['Shares',      t.shares  ?? 0]))
  parts.push(csvRow(['Revenue (€)', t.revenue ?? 0]))
  if (data.unavailable?.length) {
    parts.push(csvRow(['Unavailable metrics', data.unavailable.join('; ')]))
  }
  parts.push('')
  parts.push(csvRow(['TOP TAGGED PRODUCTS']))
  parts.push(csvTable(data.top_tagged_products))
  return parts.join('\n')
}

const CSV_BUILDERS = {
  'sales':      buildSalesCsv,
  'vat':        buildVatCsv,
  'inventory':  buildInventoryCsv,
  'customers':  buildCustomersCsv,
  'returns':    buildReturnsCsv,
  'looks':      buildLooksCsv,
}

// ─── Download util ───────────────────────────────────────

function triggerDownload(text, filename) {
  const blob = new Blob(['\ufeff', text], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Sub-components ──────────────────────────────────────

function SectionHeading({ children, extraTop = false }) {
  return (
    <div className="rpt-section-heading" style={extraTop ? { marginTop: 4 } : undefined}>{children}</div>
  )
}

function ReportCard({ report, exporting, onExport, t }) {
  const isDisabled = !report.endpoint || exporting
  const name     = t(`reports.items.${report.nameKey}.name`)
  const meta     = t(`reports.items.${report.nameKey}.meta`)
  const fmts     = t(`reports.items.${report.nameKey}.fmts`, { returnObjects: true })
  const schedule = t(`reports.items.${report.nameKey}.scheduled`, { defaultValue: '' })
  return (
    <div className="report-card" style={isDisabled ? { opacity: exporting ? 0.85 : 1, cursor: 'default' } : undefined}>
      <div className={`report-icon ${report.variant}`}>
        <span className="material-symbols-outlined">{report.icon}</span>
      </div>
      <div className="report-body">
        <div className="report-name">{name}</div>
        <div className="report-meta">{meta}</div>
        <div className="report-formats">
          {(Array.isArray(fmts) ? fmts : []).map(f => (
            <span key={f} className={`report-fmt ${f}`}>{f.toUpperCase()}</span>
          ))}
          {!report.endpoint && (
            <span className="rpt-pending-tag">
              {t('reports.endpoint_pending')}
            </span>
          )}
        </div>
      </div>
      <div className="report-actions">
        {schedule && <div className="scheduled-badge">{schedule}</div>}
        <button
          className="btn btn-sm btn-primary"
          onClick={() => onExport(report)}
          disabled={exporting}
        >
          <span className="material-symbols-outlined">{exporting ? 'hourglass_top' : 'download'}</span>
          {exporting ? t('reports.exporting') : t('reports.export_btn')}
        </button>
      </div>
    </div>
  )
}

function InlineToast({ toast, onClose }) {
  if (!toast) return null
  const colors = {
    success: { bg:'rgba(0,108,53,0.06)',  border:'rgba(0,108,53,0.35)',  text:'var(--green)' },
    error:   { bg:'rgba(197,0,26,0.06)',  border:'rgba(197,0,26,0.35)',  text:'var(--red)'   },
    info:    { bg:'rgba(184,149,90,0.06)',border:'rgba(184,149,90,0.3)', text:'var(--gold-dk)' },
  }
  const c = colors[toast.type] ?? colors.info
  return (
    <div className="rpt-toast" style={{
      border:`1px solid ${c.border}`, color:c.text,
    }}>
      <span className="rpt-toast-icon" style={{ background:c.bg }}>
        <span className="material-symbols-outlined" style={{ fontSize:14, color:c.text }}>
          {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
        </span>
      </span>
      <span className="rpt-toast-msg">{toast.msg}</span>
      <button onClick={onClose} className="rpt-toast-close" style={{ color:c.text }}>
        <span className="material-symbols-outlined" style={{ fontSize:14 }}>close</span>
      </button>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────

export default function Reports() {
  const { t } = useTranslation()

  const PERIOD_OPTIONS = [
    { value: 'this_month',    label: t('reports.date.this_month') },
    { value: 'last_month',    label: t('reports.date.last_month') },
    { value: 'last_3_months', label: t('reports.date.last_3')     },
    { value: 'this_year',     label: t('reports.date.this_year')  },
    { value: 'custom',        label: t('reports.date.custom')     },
  ]

  const [dateRange, setDateRange] = useState('this_month')
  const [exporting, setExporting] = useState({})
  const [toast, setToast]         = useState(null)

  function showToast(msg, type = 'info', ms = 3500) {
    setToast({ msg, type })
    setTimeout(() => setToast(prev => (prev && prev.msg === msg ? null : prev)), ms)
  }

  async function handleExport(report) {
    const name = t(`reports.items.${report.nameKey}.name`)
    if (!report.endpoint) {
      showToast(`${name} — ${t('reports.endpoint_not_available')}`, 'info')
      return
    }
    setExporting(prev => ({ ...prev, [report.key]: true }))

    try {
      const params = []
      if (report.hasPeriod)     params.push(`period=${dateRange === 'custom' ? 'this_month' : dateRange}`)
      if (report.hasPagination) params.push('page=1', 'limit=100')
      const url = `${API}${report.endpoint}${params.length ? '?' + params.join('&') : ''}`

      const res = await apiFetch(url).then(r => r.json())
      if (!res?.success) throw new Error(res?.message || t('reports.request_failed'))

      const builder = CSV_BUILDERS[report.key]
      if (!builder) throw new Error(`No CSV builder registered for ${report.key}`)

      const csv       = builder(res.data)
      const timestamp = new Date().toISOString().slice(0, 10)
      const suffix    = report.hasPeriod ? `_${dateRange}` : ''
      triggerDownload(csv, `${report.key}${suffix}_${timestamp}.csv`)
      showToast(t('reports.export_success', { name }), 'success')
    } catch (e) {
      showToast(t('reports.export_failed', { error: e.message }), 'error', 5000)
    } finally {
      setExporting(prev => ({ ...prev, [report.key]: false }))
    }
  }

  function handleNewSchedule() {
    showToast(t('reports.schedule_pending'), 'info')
  }

  function handleEditSchedule(scheduleId) {
    showToast(t('reports.edit_schedule_pending', { id: scheduleId }), 'info')
  }

  return (
    <>
      {/* Header */}
      <div className="view-header">
        <div className="view-header-left">
          <h2>{t('reports.title')} <em>{t('reports.title_em')}</em></h2>
        </div>
        <div className="rpt-header-actions">
          <select
            className="form-select rpt-period-select"
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
          >
            {PERIOD_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid2">
        {/* ══ LEFT ══ */}
        <div>
          <SectionHeading>{t('reports.sections.sales')}</SectionHeading>
          {SALES_REPORTS.map(r => (
            <ReportCard key={r.key} report={r} exporting={!!exporting[r.key]} onExport={handleExport} t={t} />
          ))}

          <SectionHeading extraTop>{t('reports.sections.looks')}</SectionHeading>
          {LOOKS_REPORTS.map(r => (
            <ReportCard key={r.key} report={r} exporting={!!exporting[r.key]} onExport={handleExport} t={t} />
          ))}
        </div>

        {/* ══ RIGHT ══ */}
        <div>
          <SectionHeading>{t('reports.sections.inventory')}</SectionHeading>
          {INVENTORY_REPORTS.map(r => (
            <ReportCard key={r.key} report={r} exporting={!!exporting[r.key]} onExport={handleExport} t={t} />
          ))}

          <SectionHeading extraTop>{t('reports.sections.customers')}</SectionHeading>
          {CUSTOMER_REPORTS.map(r => (
            <ReportCard key={r.key} report={r} exporting={!!exporting[r.key]} onExport={handleExport} t={t} />
          ))}
        </div>
      </div>

      {/* Scheduled Reports */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">{t('reports.scheduled.title')} <em>{t('reports.scheduled.title_em')}</em></div>
          <button className="btn btn-sm btn-outline" onClick={handleNewSchedule}>
            <span className="material-symbols-outlined">add</span>{t('reports.scheduled.new_btn')}
          </button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('reports.scheduled.col_report')}</th>
              <th>{t('reports.scheduled.col_freq')}</th>
              <th>{t('reports.scheduled.col_format')}</th>
              <th>{t('reports.scheduled.col_recipients')}</th>
              <th>{t('reports.scheduled.col_next')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {SCHEDULED_REPORTS.map((s, i) => (
              <tr key={s.id} style={i === SCHEDULED_REPORTS.length - 1 ? { borderBottom:'none' } : undefined}>
                <td style={{ fontWeight:600 }}>{t(`reports.items.${s.nameKey}.name`)}</td>
                <td>{s.frequency}</td>
                <td><span className={`report-fmt ${s.format}`}>{s.format.toUpperCase()}</span></td>
                <td className="rpt-recipients">
                  {s.recipients.join(', ')}
                </td>
                <td>{s.nextRun}</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => handleEditSchedule(s.id)}>{t('common.edit')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InlineToast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}
