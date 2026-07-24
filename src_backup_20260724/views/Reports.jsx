import { useState } from 'react'
import { apiFetch } from '../lib/api'

const API = import.meta.env.VITE_API_URL

// ─── Period options ──────────────────────────────────────
// Values match the API's `period` query param exactly.
const PERIOD_OPTIONS = [
  { value: 'this_month',    label: 'This Month'    },
  { value: 'last_month',    label: 'Last Month'    },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'this_year',     label: 'This Year'     },
  { value: 'custom',        label: 'Custom Range'  },
]

// ─── Report definitions ──────────────────────────────────
// `endpoint`     = base path relative to API. null = coming soon.
// `hasPeriod`    = append ?period=<dateRange> to URL
// `hasPagination`= append &page=1&limit=100

const SALES_REPORTS = [
  {
    key:'sales', name:'Sales Report',
    meta:'Orders, revenue, commission breakdown by channel and date',
    formats:['csv','pdf','xlsx'], icon:'payments', variant:'sales', schedule:'Weekly',
    endpoint:'/boutique/reports/sales', hasPeriod:true,
  },
  {
    key:'vat', name:'VAT / Tax Report',
    meta:'Itemised VAT (22%) per transaction, by country of buyer',
    formats:['csv','pdf'], icon:'receipt_long', variant:'tax', schedule:null,
    endpoint:'/boutique/reports/vat', hasPeriod:true,
  },
  {
    key:'payouts', name:'Payout History',
    meta:'All Stripe payouts, commission deductions, and fees',
    formats:['csv','pdf'], icon:'local_shipping', variant:'sales', schedule:null,
    endpoint:null,   // not yet available
  },
]

const LOOKS_REPORTS = [
  {
    key:'looks', name:'Looks Feed Performance',
    meta:'Try-ons, likes, shares, revenue attributed to Looks posts',
    formats:['csv','xlsx'], icon:'auto_awesome', variant:'looks', schedule:null,
    endpoint:'/boutique/reports/looks-feed', hasPeriod:true,
  },
]

const INVENTORY_REPORTS = [
  {
    key:'inventory', name:'Inventory Report',
    meta:'Current stock levels by product, variant, and location',
    formats:['csv','xlsx'], icon:'warehouse', variant:'inventory', schedule:'Daily',
    endpoint:'/boutique/reports/inventory', hasPeriod:false,
  },
  {
    key:'top-products', name:'Top Products Report',
    meta:'Best sellers by revenue, units, views, and try-on count',
    formats:['csv','pdf'], icon:'trending_up', variant:'inventory', schedule:null,
    endpoint:null,   // not yet available
  },
]

const CUSTOMER_REPORTS = [
  {
    key:'customers', name:'Customer Export',
    meta:'All customers with lifetime value, order count, last purchase',
    formats:['csv','xlsx'], icon:'group', variant:'customer', schedule:null,
    endpoint:'/boutique/reports/customers', hasPeriod:false, hasPagination:true,
  },
  {
    key:'returns', name:'Returns Report',
    meta:'All return requests, reasons, refund amounts, and outcomes',
    formats:['csv','pdf'], icon:'undo', variant:'customer', schedule:null,
    endpoint:'/boutique/reports/returns', hasPeriod:true,
  },
]

const SCHEDULED_REPORTS = [
  { id:'s1', name:'Sales Report',     frequency:'Weekly · Monday', format:'pdf',
    recipients:['giulia@ateliersbianchi.it'], nextRun:'Mar 25' },
  { id:'s2', name:'Inventory Report', frequency:'Daily · 08:00',   format:'csv',
    recipients:['giulia@ateliersbianchi.it','ops@ateliersbianchi.it'], nextRun:'Tomorrow' },
  { id:'s3', name:'VAT Report',       frequency:'Monthly · 1st',   format:'pdf',
    recipients:['accounting@ateliersbianchi.it'], nextRun:'Apr 1' },
]

// ─── CSV utilities ───────────────────────────────────────

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function csvRow(cells) { return cells.map(csvEscape).join(',') }

// Build a CSV section from a rows-of-objects list. Uses first row's keys as headers.
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
  // Flatten each product into its variants
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
    <div style={{
      fontSize: 9, fontWeight: 600, letterSpacing: 1.5,
      textTransform: 'uppercase', color: 'var(--stone)',
      marginBottom: 10, marginTop: extraTop ? 4 : 0,
    }}>{children}</div>
  )
}

function ReportCard({ report, exporting, onExport }) {
  const isDisabled = !report.endpoint || exporting
  return (
    <div className="report-card" style={isDisabled ? { opacity: exporting ? 0.85 : 1, cursor: 'default' } : undefined}>
      <div className={`report-icon ${report.variant}`}>
        <span className="material-symbols-outlined">{report.icon}</span>
      </div>
      <div className="report-body">
        <div className="report-name">{report.name}</div>
        <div className="report-meta">{report.meta}</div>
        <div className="report-formats">
          {report.formats.map(f => (
            <span key={f} className={`report-fmt ${f}`}>{f.toUpperCase()}</span>
          ))}
          {!report.endpoint && (
            <span style={{ fontSize: 8, color: 'var(--stone)', marginLeft: 6, fontStyle: 'italic' }}>
              endpoint pending
            </span>
          )}
        </div>
      </div>
      <div className="report-actions">
        {report.schedule && <div className="scheduled-badge">{report.schedule}</div>}
        <button
          className="btn btn-sm btn-primary"
          onClick={() => onExport(report)}
          disabled={exporting}
        >
          <span className="material-symbols-outlined">{exporting ? 'hourglass_top' : 'download'}</span>
          {exporting ? 'Exporting…' : 'Export'}
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
    <div style={{
      position:'fixed', bottom:20, right:20, zIndex:1000,
      padding:'10px 14px', background:'var(--white)', borderRadius:8,
      border:`1px solid ${c.border}`, boxShadow:'0 4px 16px rgba(26,18,9,0.14)',
      fontSize:11, color:c.text, fontWeight:600, display:'flex', alignItems:'center', gap:10,
      maxWidth:360,
    }}>
      <span style={{ background:c.bg, borderRadius:6, padding:'3px 4px', display:'flex' }}>
        <span className="material-symbols-outlined" style={{ fontSize:14, color:c.text }}>
          {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
        </span>
      </span>
      <span style={{ flex:1 }}>{toast.msg}</span>
      <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', padding:0, display:'flex', color:c.text }}>
        <span className="material-symbols-outlined" style={{ fontSize:14 }}>close</span>
      </button>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────

export default function Reports() {
  const [dateRange, setDateRange] = useState('this_month')
  const [exporting, setExporting] = useState({})   // { [key]: bool }
  const [toast, setToast]         = useState(null)

  function showToast(msg, type = 'info', ms = 3500) {
    setToast({ msg, type })
    setTimeout(() => setToast(prev => (prev && prev.msg === msg ? null : prev)), ms)
  }

  async function handleExport(report) {
    if (!report.endpoint) {
      showToast(`${report.name} — endpoint not yet available`, 'info')
      return
    }
    setExporting(prev => ({ ...prev, [report.key]: true }))

    try {
      // Build URL with query params
      const params = []
      if (report.hasPeriod)     params.push(`period=${dateRange === 'custom' ? 'this_month' : dateRange}`)
      if (report.hasPagination) params.push('page=1', 'limit=100')
      const url = `${API}${report.endpoint}${params.length ? '?' + params.join('&') : ''}`

      const res = await apiFetch(url).then(r => r.json())
      if (!res?.success) throw new Error(res?.message || 'Request failed')

      const builder = CSV_BUILDERS[report.key]
      if (!builder) throw new Error(`No CSV builder registered for ${report.key}`)

      const csv       = builder(res.data)
      const timestamp = new Date().toISOString().slice(0, 10)
      const suffix    = report.hasPeriod ? `_${dateRange}` : ''
      triggerDownload(csv, `${report.key}${suffix}_${timestamp}.csv`)
      showToast(`${report.name} exported`, 'success')
    } catch (e) {
      showToast(`Failed to export: ${e.message}`, 'error', 5000)
    } finally {
      setExporting(prev => ({ ...prev, [report.key]: false }))
    }
  }

  function handleNewSchedule() {
    showToast('Scheduled reports — endpoints coming soon', 'info')
  }

  function handleEditSchedule(scheduleId) {
    showToast(`Edit schedule ${scheduleId} — endpoints coming soon`, 'info')
  }

  return (
    <>
      {/* Header */}
      <div className="view-header">
        <div className="view-header-left">
          <h2>Reports & <em>Exports</em></h2>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select
            className="form-select"
            style={{ width:160, fontSize:11, padding:'7px 10px' }}
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
          <SectionHeading>Sales & Financial</SectionHeading>
          {SALES_REPORTS.map(r => (
            <ReportCard key={r.key} report={r} exporting={!!exporting[r.key]} onExport={handleExport} />
          ))}

          <SectionHeading extraTop>Looks Feed</SectionHeading>
          {LOOKS_REPORTS.map(r => (
            <ReportCard key={r.key} report={r} exporting={!!exporting[r.key]} onExport={handleExport} />
          ))}
        </div>

        {/* ══ RIGHT ══ */}
        <div>
          <SectionHeading>Inventory & Products</SectionHeading>
          {INVENTORY_REPORTS.map(r => (
            <ReportCard key={r.key} report={r} exporting={!!exporting[r.key]} onExport={handleExport} />
          ))}

          <SectionHeading extraTop>Customers</SectionHeading>
          {CUSTOMER_REPORTS.map(r => (
            <ReportCard key={r.key} report={r} exporting={!!exporting[r.key]} onExport={handleExport} />
          ))}
        </div>
      </div>

      {/* Scheduled Reports */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">Scheduled <em>Reports</em></div>
          <button className="btn btn-sm btn-outline" onClick={handleNewSchedule}>
            <span className="material-symbols-outlined">add</span>New Schedule
          </button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Report</th><th>Frequency</th><th>Format</th>
              <th>Recipients</th><th>Next Run</th><th></th>
            </tr>
          </thead>
          <tbody>
            {SCHEDULED_REPORTS.map((s, i) => (
              <tr key={s.id} style={i === SCHEDULED_REPORTS.length - 1 ? { borderBottom:'none' } : undefined}>
                <td style={{ fontWeight:600 }}>{s.name}</td>
                <td>{s.frequency}</td>
                <td><span className={`report-fmt ${s.format}`}>{s.format.toUpperCase()}</span></td>
                <td style={{ fontSize:10.5, color:'var(--stone)' }}>
                  {s.recipients.join(', ')}
                </td>
                <td>{s.nextRun}</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => handleEditSchedule(s.id)}>Edit</button>
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
