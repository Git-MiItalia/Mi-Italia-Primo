import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { csvRow, csvTable, csvSections, triggerDownload } from '../lib/csv'
import { buildXlsx, downloadBlob } from '../lib/xlsx'
import { fmtDateLocalized } from '../lib/dateHelpers'
import Loading from '../components/ui/Loading'

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
    // Lives under /financials rather than /reports — it is the same endpoint the
    // Financials tab lists payouts from, so the two can never disagree.
    key:'payouts', nameKey:'payout_history', icon:'local_shipping', variant:'sales',
    endpoint:'/boutique/financials/payouts', hasPeriod:false,
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
    endpoint:'/boutique/reports/top-products', hasPeriod:true,
  },
]

const CUSTOMER_REPORTS = [
  {
    // `pageKey` names the array in `data` that has to be accumulated across
    // pages — see the paging loop in handleExport.
    key:'customers', nameKey:'customer_export', icon:'group', variant:'customer',
    endpoint:'/boutique/reports/customers', hasPeriod:false, hasPagination:true, pageKey:'customers',
  },
  {
    key:'returns', nameKey:'returns_report', icon:'undo', variant:'customer',
    endpoint:'/boutique/reports/returns', hasPeriod:true,
  },
]

/* ─── Scheduled reports ───────────────────────────────────
 *
 * This card used to hold three invented schedules, rendered exactly like real
 * ones: fake frequencies, fake next-run dates, and recipients at a boutique
 * that does not exist (giulia@ateliersbianchi.it and friends). A merchant
 * reading the page saw their reports apparently being emailed to three
 * strangers every week. They were removed, and both buttons said "coming
 * soon" until the endpoints existed.
 *
 * They now exist:
 *   GET    /boutique/reports/schedules
 *   POST   /boutique/reports/schedules      report_type, format, frequency, recipients
 *   PATCH  /boutique/reports/schedules/:id  any subset of frequency, recipients, is_active
 *
 * There is no delete — is_active:false is how a schedule is stopped, so the
 * edit dialog offers a switch rather than a delete button.
 */

/* Every report, flattened. `nameKey` doubles as the backend's `report_type`:
   the eight values match exactly, so no mapping table is needed — and if that
   ever stops being true, the dropdown breaks loudly rather than silently
   scheduling the wrong report. */
const ALL_REPORTS = [...SALES_REPORTS, ...LOOKS_REPORTS, ...INVENTORY_REPORTS, ...CUSTOMER_REPORTS]

/* Which formats each report may be scheduled in. The backend rejects anything
   else, so the format dropdown is filtered by the chosen report rather than
   letting a merchant pick a pairing that can only come back as an error.
   Verified equal to the `reports.items.*.fmts` lists the cards advertise. */
const SCHEDULE_FORMATS = {
  sales_report:     ['csv', 'pdf', 'xlsx'],
  vat_report:       ['csv', 'pdf'],
  payout_history:   ['csv', 'pdf'],
  looks_feed:       ['csv', 'xlsx'],
  inventory_report: ['csv', 'xlsx'],
  top_products:     ['csv', 'pdf'],
  customer_export:  ['csv', 'xlsx'],
  returns_report:   ['csv', 'pdf'],
}

const FREQUENCIES    = ['daily', 'weekly', 'monthly']
const MAX_RECIPIENTS = 10

/* What the Export menu can produce, in the order it offers them.
 *
 * None of these come from the server: the endpoints return JSON and ignore
 * ?format= entirely (tested — identical responses for pdf and xlsx). All three
 * are built here. CSV is assembled as text, PDF is the browser's own print
 * dialog (the route the packing slip already takes), and XLSX is written by
 * lib/xlsx.js, which packs the sheets into the ZIP an .xlsx really is.
 *
 * Each report still only offers its own formats — see menuFormats below — so
 * the menu agrees with the badges on the card. */
const EXPORTABLE_FORMATS = ['csv', 'pdf', 'xlsx']
const FORMAT_SUB = {
  csv:  'Plain text, opens in Excel',
  pdf:  'Print or save',
  xlsx: 'Excel, one tab per section',
}

/* English fallbacks for the frequency labels. Needed because the bundle is
   fetched from the server, so until these keys reach it every t() falls back
   to its second argument — and passing the raw value there printed a
   lowercase "daily" in a column of otherwise capitalised text. */
const FREQ_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
const freqLabel  = (t, f) =>
  f ? t(`reports.sched.freq_${f}`, FREQ_LABEL[f] ?? f) : '—'

/* Deliberately loose. The mail server is the authority on whether an address
   deliverable; a strict pattern here mostly rejects valid ones. This only has
   to catch the missing @ or trailing comma that would otherwise come back as
   an opaque 400 after the dialog has already closed. */
const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s).trim())

/* Recipients are typed as free text so pasting a list works. Split on the
   three things people actually separate addresses with. */
const parseRecipients = (text) =>
  String(text).split(/[,;\n]/).map(s => s.trim()).filter(Boolean)

// ─── CSV utilities ───────────────────────────────────────
// csvEscape / csvRow / csvTable / triggerDownload now live in lib/csv.js so the
// Inventory export can share the same quoting rules instead of its own.

function fmtDate(iso) {
  if (!iso) return ''
  try   { return new Date(iso).toISOString().slice(0,10) }
  catch { return iso }
}

// Every total below is printed as `x ?? 0`, so a field the backend does not
// send arrives in the CSV as a zero — indistinguishable from a real zero, and
// zero is a number people act on.
//
// The looks-feed endpoint already solves this: it returns `note` and an
// `unavailable` array naming the metrics it cannot fill, which is why "Looks 0"
// on that report can be trusted as a true zero. This helper renders that pair
// for ANY report, so the moment the other endpoints start sending it, their
// exports explain themselves too — no further frontend change needed.
function gapRows(data) {
  const out = []
  if (data.note) out.push(csvRow(['Note', data.note]))
  if (data.unavailable?.length) {
    out.push(csvRow(['Unavailable metrics', data.unavailable.join('; ')]))
    out.push(csvRow(['', 'These are not measured yet — their figures above are placeholders, not counts.']))
  }
  return out
}

// ─── Per-report CSV builders ─────────────────────────────

function buildSalesCsv(data) {
  const p = data.period ?? {}, t = data.totals ?? {}
  const parts = []
  parts.push(csvRow(['Sales Report']))
  parts.push(...gapRows(data))
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
  parts.push(...gapRows(data))
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
  parts.push(...gapRows(data))
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
  parts.push(...gapRows(data))
  parts.push(csvRow(['Total customers',    t.customers   ?? 0]))
  parts.push(csvRow(['Total value (€)',    t.total_value ?? 0]))
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
  parts.push(...gapRows(data))
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
  parts.push(...gapRows(data))
  parts.push(csvRow(['Period', p.type]))
  parts.push(csvRow(['Start',  fmtDate(p.start)]))
  parts.push(csvRow(['End',    fmtDate(p.end)]))
  parts.push('')
  parts.push(csvRow(['TOTALS']))
  parts.push(csvRow(['Looks',       t.looks   ?? 0]))
  parts.push(csvRow(['Likes',       t.likes   ?? 0]))
  parts.push(csvRow(['Try-ons',     t.try_ons ?? 0]))
  parts.push(csvRow(['Shares',      t.shares  ?? 0]))
  parts.push(csvRow(['Revenue (€)', t.revenue ?? 0]))
  parts.push('')
  parts.push(csvRow(['TOP TAGGED PRODUCTS']))
  parts.push(csvTable(data.top_tagged_products))
  return parts.join('\n')
}

// Field names taken from the live response the Financials tab already reads:
// data.payouts[] with amount / status / arrival_date (falling back to
// created_at, which is what that tab does), plus data.summary.
function buildPayoutsCsv(data) {
  const s = data.summary ?? {}
  const parts = []
  parts.push(csvRow(['Payout History']))
  parts.push(...gapRows(data))
  parts.push(csvRow(['Pending payout (€)', s.pending_payout ?? 0]))
  parts.push(csvRow(['Total paid (€)',     s.total_paid     ?? 0]))
  parts.push('')
  const rows = (data.payouts ?? []).map(p => ({
    Date:         fmtDate(p.arrival_date ?? p.created_at),
    'Amount (€)': p.amount,
    Status:       p.status,
  }))
  parts.push(csvTable(rows))
  return parts.join('\n')
}

// Headings only — the rows are passed through as the API sends them, so a
// column added server-side still appears (under its raw name) rather than
// being silently dropped, which is what a hand-listed builder would do.
const TOP_PRODUCT_HEADERS = {
  product_id: 'Product ID',
  name:       'Product',
  sku:        'SKU',
  units_sold: 'Units sold',
  revenue:    'Revenue (€)',
  views:      'Views',
  try_ons:    'Try-ons',
}

function buildTopProductsCsv(data) {
  // The row array's key is found rather than assumed: the response was read
  // from a real export, but the other reports here use `products`, `items` and
  // `refunds` for the same thing, so this tolerates all of them.
  const rows =
    data.products ??
    data.top_products ??
    data.items ??
    Object.values(data ?? {}).find(Array.isArray) ??
    []
  const p = data.period ?? {}
  const parts = [csvRow(['Top Products'])]
  parts.push(...gapRows(data))
  if (p.type)  parts.push(csvRow(['Period', p.type]))
  if (p.start) parts.push(csvRow(['Start',  fmtDate(p.start)]))
  if (p.end)   parts.push(csvRow(['End',    fmtDate(p.end)]))
  const totals = data.totals ?? {}
  if (Object.keys(totals).length) {
    parts.push('')
    parts.push(csvRow(['TOTALS']))
    for (const [k, v] of Object.entries(totals)) parts.push(csvRow([k, v]))
  }
  parts.push('')
  parts.push(csvTable(rows, TOP_PRODUCT_HEADERS))
  return parts.join('\n')
}

const CSV_BUILDERS = {
  'sales':      buildSalesCsv,
  'vat':        buildVatCsv,
  'inventory':  buildInventoryCsv,
  'customers':  buildCustomersCsv,
  'returns':    buildReturnsCsv,
  'looks':      buildLooksCsv,
  'payouts':    buildPayoutsCsv,
  'top-products': buildTopProductsCsv,
}

// ─── Sub-components ──────────────────────────────────────

function SectionHeading({ children, extraTop = false }) {
  return (
    <div className="rpt-section-heading" style={extraTop ? { marginTop: 4 } : undefined}>{children}</div>
  )
}

/* `exporting` is the mode currently running for this card — 'preview', 'csv',
   'pdf', 'xlsx' — or null. It used to be a plain boolean, which meant pressing
   the eye put the Export button into its "Exporting…" state: the card claimed
   to be saving a file when it was only fetching one to look at. */
function ReportCard({ report, exporting, onExport, t }) {
  const busy        = !!exporting
  const previewBusy = exporting === 'preview'
  const exportBusy  = busy && !previewBusy
  const isDisabled  = !report.endpoint || busy
  const name     = t(`reports.items.${report.nameKey}.name`)
  const meta     = t(`reports.items.${report.nameKey}.meta`)
  const fmts     = t(`reports.items.${report.nameKey}.fmts`, { returnObjects: true })
  const schedule = t(`reports.items.${report.nameKey}.scheduled`, { defaultValue: '' })
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef(null)

  /* The menu offers only this report's own formats, so it agrees with the
     badges above it — no PDF option on a report that is CSV and XLSX only.
     Read from SCHEDULE_FORMATS rather than the bundle's `fmts` list: the two
     hold the same eight entries, but this one is in the code and so cannot go
     missing if the translation bundle is slow or fails to load.
     XLSX drops out because nothing here can build one — the endpoints ignore
     ?format=, so it is reachable only through a scheduled delivery. CSV is the
     floor: it is assembled in the browser and always works. */
  const menuFormats = useMemo(() => {
    const own = SCHEDULE_FORMATS[report.nameKey] ?? ['csv']
    const usable = own.filter(f => EXPORTABLE_FORMATS.includes(f))
    return usable.length ? usable : ['csv']
  }, [report.nameKey])

  // Close on a click anywhere else, and on Escape. Without this the menu stays
  // open behind the next card the merchant reaches for.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setMenuOpen(false) }
    const onKey  = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])
  return (
    /* rpt-menu-open lifts this card above its siblings while the dropdown is
       showing. .report-card:hover applies a transform, and a transform creates
       a stacking context — so the card the mouse crosses on its way down to the
       menu painted over the menu, no matter what z-index the menu carried. */
    <div className={`report-card${menuOpen ? ' rpt-menu-open' : ''}`}
         style={isDisabled ? { opacity: busy ? 0.85 : 1, cursor: 'default' } : undefined}>
      <div className={`report-icon ${report.variant}`}>
        <span className="material-symbols-outlined">{report.icon}</span>
      </div>
      <div className="report-body">
        <div className="report-name">{name}</div>
        <div className="report-meta">{meta}</div>
        {/* The bundle's per-report format list, shown as the cards always did.
            These describe the formats the report is available in overall —
            CSV and PDF straight from the Export menu, XLSX through a scheduled
            delivery, since the endpoints ignore ?format= and cannot build one
            on demand (tested: identical JSON for pdf and xlsx). */}
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
        {/* Preview first: the only way to find out what a report contained used
            to be to download it and open it in Excel. */}
        <button
          className="btn btn-sm btn-outline rpt-eye"
          onClick={() => onExport(report, 'preview')}
          disabled={busy}
          title={t('reports.preview.view', 'Preview')}
          aria-label={t('reports.preview.view', 'Preview')}
        >
          <span className="material-symbols-outlined">{previewBusy ? 'hourglass_top' : 'visibility'}</span>
        </button>
        <div className="rpt-export-wrap" ref={wrapRef}>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setMenuOpen(o => !o)}
            disabled={busy}
            aria-expanded={menuOpen}
          >
            <span className="material-symbols-outlined">{exportBusy ? 'hourglass_top' : 'download'}</span>
            {exportBusy ? t('reports.exporting') : t('reports.export_btn')}
            <span className="material-symbols-outlined rpt-export-chev">expand_more</span>
          </button>
          {menuOpen && (
            <div className="rpt-export-menu" role="menu">
              {menuFormats.map(f => (
                <button key={f} role="menuitem" className="rpt-export-opt"
                        onClick={() => { setMenuOpen(false); onExport(report, f) }}>
                  <span className={`report-fmt ${f}`}>{f.toUpperCase()}</span>
                  <span className="rpt-export-opt-sub">{t(`reports.fmt_sub.${f}`, FORMAT_SUB[f])}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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

/* PDF generation.
 *
 * The report endpoints ignore ?format=pdf — tested directly, identical JSON
 * comes back — so a server-made PDF is not available. The browser's own print
 * dialog offers "Save as PDF" on every modern browser, which is the mechanism
 * the packing slip already uses here. That produces a genuine PDF with no
 * backend work, so PDF is offered on every report rather than only the ones
 * the bundle happens to list.
 *
 * Built from the same csvSections() the preview renders, which are built from
 * the same CSV the download writes — one source, three outputs, so they cannot
 * disagree about what the report says. */
const escHtml = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]))

function buildPrintHtml(title, sections, filename) {
  const block = (s) => `
    ${s.heading ? `<h2>${escHtml(s.heading)}</h2>` : ''}
    <table>
      ${s.headers ? `<thead><tr>${s.headers.map(h => `<th>${escHtml(h)}</th>`).join('')}</tr></thead>` : ''}
      <tbody>${s.rows.map(r => `<tr>${r.map((c, i) =>
        `<td${!s.headers && i === 0 ? ' class="k"' : ''}>${escHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(filename)}</title>
    <style>
      body{font-family:Jost,system-ui,sans-serif;color:#0A0A0A;margin:32px;font-size:12px;}
      h1{font-family:'Bodoni Moda',Georgia,serif;font-weight:500;font-size:22px;margin:0 0 4px;}
      h2{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#6E6E6E;
         margin:22px 0 6px;font-weight:600;}
      table{border-collapse:collapse;width:100%;}
      th{text-align:left;font-size:8.5px;letter-spacing:1px;text-transform:uppercase;
         color:#6E6E6E;border-bottom:1px solid #0A0A0A;padding:5px 8px 4px;}
      td{padding:4px 8px;border-bottom:1px solid #ECE9E1;}
      td.k{color:#6E6E6E;width:40%;}
      .hint{margin-top:26px;font-size:10px;color:#6E6E6E;}
      @media print{.hint{display:none;} body{margin:0;}}
    </style></head><body>
    <h1>${escHtml(title)}</h1>
    ${sections.map(block).join('')}
    <p class="hint">Use your browser's print dialog and choose "Save as PDF".</p>
    <script>window.onload=function(){window.print()}</${''}script>
    </body></html>`
}

/** @returns true if the window opened; false means a popup blocker stopped it. */
function openPrintWindow(html) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return false          // window.open fails silently otherwise
  w.document.write(html)
  w.document.close()
  return true
}

/* One worksheet per section — the advantage a real spreadsheet has over the
   CSV, which can only lay the same sections out one under another on a single
   flat sheet. The first section carries the report's period and any note and
   has no heading of its own, so it becomes "Summary". */
const sheetsFromDoc = (doc) => doc.sections.map((s, i) => ({
  name: s.heading || (i === 0 ? 'Summary' : `Section ${i + 1}`),
  rows: s.headers ? [s.headers, ...s.rows] : s.rows,
}))

/** Title + body sections for a report, from the CSV the download would write. */
function reportDoc(name, csv) {
  const sections = csvSections(csv)
  const [head, ...rest] = sections
  return {
    title:    head?.heading ?? name,
    // The builders write the report's own name as the first heading, so it
    // becomes the document title rather than a section of it — unless that
    // first block also carries rows (period, note), which must be kept.
    sections: head?.rows?.length ? [{ ...head, heading: null }, ...rest] : rest,
  }
}

/* Report preview — the eye button on each card.
 *
 * Read-only by design: this answers "what is in this report?", and saving it
 * is the Export menu's job. Two ways to download the same thing, a step apart,
 * only makes it unclear which one the merchant is supposed to use.
 *
 * Renders the exact CSV the download writes, so what is previewed and what
 * lands in the file cannot drift apart. The eight builders are untouched and
 * remain the single source of both. */
function ReportPreview({ name, csv, onClose, t }) {
  const { title, sections } = useMemo(() => reportDoc(name, csv), [name, csv])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg rpt-preview" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="rpt-preview-body">
          {sections.length === 0 && (
            <div className="state-empty">{t('reports.preview.empty', 'This report has no data for the selected period.')}</div>
          )}
          {sections.map((s, i) => (
            <div key={i} className="rpt-preview-section">
              {s.heading && <div className="rpt-preview-heading">{s.heading}</div>}
              <table className="tbl rpt-preview-tbl">
                {s.headers && (
                  <thead><tr>{s.headers.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
                )}
                <tbody>
                  {s.rows.map((r, j) => (
                    <tr key={j}>
                      {r.map((c, k) => (
                        <td key={k} className={!s.headers && k === 0 ? 'rpt-preview-k' : undefined}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>{t('common.close', 'Close')}</button>
        </div>
      </div>
    </div>
  )
}

/* New / edit schedule dialog.
 *
 * Mounted only while open, and with a key tied to the schedule being edited,
 * so the fields below initialise from `schedule` rather than needing an effect
 * to copy props into state.
 *
 * Create and edit send different payloads on purpose: PATCH accepts only
 * frequency, recipients and is_active, so report and format are shown as
 * read-only text when editing rather than as dropdowns that would appear to
 * work and then silently not save. */
function ScheduleModal({ schedule, onClose, onSaved, t }) {
  const isEdit = !!schedule
  const [reportType, setReportType] = useState(schedule?.report_type ?? ALL_REPORTS[0].nameKey)
  const [format,     setFormat]     = useState(schedule?.format ?? 'csv')
  const [frequency,  setFrequency]  = useState(schedule?.frequency ?? 'weekly')
  const [recipients, setRecipients] = useState((schedule?.recipients ?? []).join(', '))
  const [isActive,   setIsActive]   = useState(schedule?.is_active !== false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const allowed = SCHEDULE_FORMATS[reportType] ?? ['csv']

  // Changing the report can strand the chosen format — PDF is valid for Sales
  // but not for Looks Feed. Fall back to the first the new report allows.
  function changeReport(next) {
    setReportType(next)
    const ok = SCHEDULE_FORMATS[next] ?? ['csv']
    if (!ok.includes(format)) setFormat(ok[0])
  }

  async function save() {
    const emails = parseRecipients(recipients)
    if (!emails.length) {
      setError(t('reports.sched.err_no_recipients', 'Add at least one email address.')); return
    }
    if (emails.length > MAX_RECIPIENTS) {
      setError(t('reports.sched.err_too_many', { max: MAX_RECIPIENTS, count: emails.length,
        defaultValue: 'At most {{max}} recipients — you have entered {{count}}.' })); return
    }
    const bad = emails.find(e => !looksLikeEmail(e))
    if (bad) {
      setError(t('reports.sched.err_bad_email', { email: bad,
        defaultValue: '“{{email}}” does not look like an email address.' })); return
    }
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch(
        isEdit ? `${API}/boutique/reports/schedules/${schedule.id}`
               : `${API}/boutique/reports/schedules`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          body: JSON.stringify(isEdit
            ? { frequency, recipients: emails, is_active: isActive }
            : { report_type: reportType, format, frequency, recipients: emails }),
        })
      const data = await res.json()
      if (!data?.success) {
        // Server's own words first — it knows why it refused better than we do.
        setError(data?.message || t('reports.sched.err_save', 'Could not save this schedule.'))
        setSaving(false)
        return
      }
      onSaved(isEdit)
    } catch {
      setError(t('common.error_network'))
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">
            {isEdit ? t('reports.sched.edit_title', 'Edit schedule')
                    : t('reports.sched.new_title',  'New scheduled report')}
          </div>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="rpt-sched-form">
          <label className="form-lbl">{t('reports.scheduled.col_report')}</label>
          {isEdit ? (
            <div className="rpt-sched-fixed">{t(`reports.items.${reportType}.name`)}</div>
          ) : (
            <select className="form-select" value={reportType} onChange={e => changeReport(e.target.value)}>
              {ALL_REPORTS.map(r => (
                <option key={r.key} value={r.nameKey}>{t(`reports.items.${r.nameKey}.name`)}</option>
              ))}
            </select>
          )}

          <label className="form-lbl">{t('reports.scheduled.col_format')}</label>
          {isEdit ? (
            <div className="rpt-sched-fixed">{String(format).toUpperCase()}</div>
          ) : (
            <select className="form-select" value={format} onChange={e => setFormat(e.target.value)}>
              {allowed.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </select>
          )}
          {isEdit && (
            <div className="form-hint">
              {t('reports.sched.locked_hint', 'The report and format cannot be changed — create a new schedule instead.')}
            </div>
          )}

          <label className="form-lbl">{t('reports.scheduled.col_freq')}</label>
          <select className="form-select" value={frequency} onChange={e => setFrequency(e.target.value)}>
            {FREQUENCIES.map(f => (
              <option key={f} value={f}>{freqLabel(t, f)}</option>
            ))}
          </select>

          <label className="form-lbl">{t('reports.scheduled.col_recipients')}</label>
          <textarea
            className="form-input rpt-sched-recipients"
            rows={3}
            value={recipients}
            onChange={e => setRecipients(e.target.value)}
            placeholder={t('reports.sched.recipients_ph', 'owner@boutique.it, finance@boutique.it')}
          />
          <div className="form-hint">
            {t('reports.sched.recipients_hint', { max: MAX_RECIPIENTS,
              defaultValue: 'Up to {{max}} addresses, separated by commas.' })}
          </div>

          {/* This checkbox IS the pause control — there is no delete endpoint,
              so switching it off is the only way to stop a schedule. Labelled
              plainly and with the consequence spelled out underneath, because
              "Send this report automatically" on its own left people hunting
              for a Pause button that was never going to exist. */}
          {isEdit && (
            <>
              <label className="rpt-sched-active">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                <span>{t('reports.sched.active2', 'Active — send this report automatically')}</span>
              </label>
              <div className="form-hint rpt-sched-active-hint">
                {isActive
                  ? t('reports.sched.active_hint',  'Untick to pause. The schedule stays in the list, but no emails are sent.')
                  : t('reports.sched.paused_hint', 'Paused — no emails will be sent. Tick to start again.')}
              </div>
            </>
          )}

          {error && <div className="rpt-sched-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-dark" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <span className="material-symbols-outlined">{saving ? 'hourglass_top' : 'check_circle'}</span>
            {saving ? t('reports.sched.saving', 'Saving…') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────

export default function Reports() {
  const { t } = useTranslation()

  // A "Custom" option used to sit at the end of this list, but there is no date
  // picker anywhere on the page and the API takes named periods only. Choosing
  // it sent period=this_month while still naming the file "..._custom_...", so
  // you got this month's figures in a file labelled custom — a wrong answer
  // wearing a confident label. Removed until there is a range to send.
  const PERIOD_OPTIONS = [
    { value: 'this_month',    label: t('reports.date.this_month') },
    { value: 'last_month',    label: t('reports.date.last_month') },
    { value: 'last_3_months', label: t('reports.date.last_3')     },
    { value: 'this_year',     label: t('reports.date.this_year')  },
  ]

  const [dateRange, setDateRange] = useState('this_month')
  const [exporting, setExporting] = useState({})
  const [toast, setToast]         = useState(null)

  // Scheduled reports. `schedError` holds the SERVER's wording, or '' for a
  // generic failure, or null for no error — kept untranslated so loadSchedules
  // never depends on `t` and the effect below needs no dependencies.
  const [schedules,   setSchedules]   = useState([])
  const [schedLoading, setSchedLoading] = useState(true)
  const [schedError,  setSchedError]  = useState(null)
  const [schedModal,  setSchedModal]  = useState(null)   // null | { schedule: object|null }
  const [preview,     setPreview]     = useState(null)   // null | { name, csv }

  function showToast(msg, type = 'info', ms = 3500) {
    setToast({ msg, type })
    setTimeout(() => setToast(prev => (prev && prev.msg === msg ? null : prev)), ms)
  }

  /* No setSchedLoading(true) here on purpose. It starts true, so the first
     load is already covered; a reload after saving then leaves the existing
     rows on screen until the new ones arrive, rather than blinking the table
     back to "Loading…" for a fraction of a second. */
  const loadSchedules = useCallback(() => {
    apiFetch(`${API}/boutique/reports/schedules`)
      .then(r => r.json())
      .then(res => {
        if (!res?.success) { setSchedError(res?.message || ''); setSchedules([]); return }
        // Accept the list wherever it sits. An empty table in front of a
        // working endpoint reads exactly like "you have no schedules", which
        // is the one wrong answer this card must not give again.
        const d    = res.data
        const list = Array.isArray(d) ? d : (d?.schedules ?? d?.items ?? d?.rows ?? [])
        setSchedules(Array.isArray(list) ? list : [])
        setSchedError(null)
      })
      .catch(() => { setSchedError(''); setSchedules([]) })
      .finally(() => setSchedLoading(false))
  }, [])

  useEffect(() => { loadSchedules() }, [loadSchedules])

  async function handleExport(report, mode = 'csv') {
    const name = t(`reports.items.${report.nameKey}.name`)
    if (!report.endpoint) {
      showToast(`${name} — ${t('reports.endpoint_not_available')}`, 'info')
      return
    }
    setExporting(prev => ({ ...prev, [report.key]: mode }))

    try {
      const base = []
      if (report.hasPeriod) base.push(`period=${dateRange}`)
      const qs = (extra = []) => {
        const all = [...base, ...extra]
        return `${API}${report.endpoint}${all.length ? '?' + all.join('&') : ''}`
      }

      let res
      if (report.hasPagination) {
        // This asked for page 1, limit 100, and exported whatever came back.
        // The CSV prints `totals.customers` — the real total — above the rows,
        // so a boutique with 347 customers got a file headed "Total customers,
        // 347" listing 100 of them. Every page is collected now.
        //
        // Both shapes the API has used are handled: a pagination block with
        // total_pages, or simply a short final page. PAGE_CAP is a safety net
        // so a malformed response can't spin forever.
        const PAGE_LIMIT = 100, PAGE_CAP = 200
        let page = 1, all = [], first = null, totalPages = null
        while (page <= PAGE_CAP) {
          const r = await apiFetch(qs([`page=${page}`, `limit=${PAGE_LIMIT}`])).then(x => x.json())
          if (!r?.success) throw new Error(r?.message || t('reports.request_failed'))
          if (!first) first = r
          const chunk = r.data?.[report.pageKey] ?? []
          all = all.concat(chunk)
          totalPages = r.data?.pagination?.total_pages ?? totalPages
          const more = totalPages != null ? page < totalPages : chunk.length === PAGE_LIMIT
          if (!more) break
          page++
        }
        // Keep page one's totals and note; swap in the full list.
        res = { ...first, data: { ...first.data, [report.pageKey]: all } }
      } else {
        res = await apiFetch(qs()).then(r => r.json())
        if (!res?.success) throw new Error(res?.message || t('reports.request_failed'))
      }

      const builder = CSV_BUILDERS[report.key]
      if (!builder) throw new Error(`No CSV builder registered for ${report.key}`)

      const csv       = builder(res.data)
      const timestamp = new Date().toISOString().slice(0, 10)
      const suffix    = report.hasPeriod ? `_${dateRange}` : ''
      const stem      = `${report.key}${suffix}_${timestamp}`

      /* One fetch, three destinations — all three read the same CSV string, so
         what is previewed, printed and saved cannot disagree. */
      if (mode === 'preview') {
        setPreview({ name, csv })
        return
      }
      if (mode === 'pdf') {
        const doc = reportDoc(name, csv)
        if (!openPrintWindow(buildPrintHtml(doc.title, doc.sections, `${stem}.pdf`))) {
          showToast(t('reports.preview.blocked', 'Your browser blocked the print window. Allow pop-ups for this site, then try again.'), 'error', 6000)
          return
        }
        showToast(t('reports.export_success', { name }), 'success')
        return
      }
      if (mode === 'xlsx') {
        downloadBlob(buildXlsx(sheetsFromDoc(reportDoc(name, csv))), `${stem}.xlsx`)
        showToast(t('reports.export_success', { name }), 'success')
        return
      }
      triggerDownload(csv, `${stem}.csv`)
      showToast(t('reports.export_success', { name }), 'success')
    } catch (e) {
      showToast(t('reports.export_failed', { error: e.message }), 'error', 5000)
    } finally {
      setExporting(prev => ({ ...prev, [report.key]: null }))
    }
  }

  function handleScheduleSaved(wasEdit) {
    setSchedModal(null)
    showToast(wasEdit
      ? t('reports.sched.toast_updated', 'Schedule updated')
      : t('reports.sched.toast_created', 'Schedule created'), 'success')
    loadSchedules()
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
            <ReportCard key={r.key} report={r} exporting={exporting[r.key]} onExport={handleExport} t={t} />
          ))}

          <SectionHeading extraTop>{t('reports.sections.looks')}</SectionHeading>
          {LOOKS_REPORTS.map(r => (
            <ReportCard key={r.key} report={r} exporting={exporting[r.key]} onExport={handleExport} t={t} />
          ))}
        </div>

        {/* ══ RIGHT ══ */}
        <div>
          <SectionHeading>{t('reports.sections.inventory')}</SectionHeading>
          {INVENTORY_REPORTS.map(r => (
            <ReportCard key={r.key} report={r} exporting={exporting[r.key]} onExport={handleExport} t={t} />
          ))}

          <SectionHeading extraTop>{t('reports.sections.customers')}</SectionHeading>
          {CUSTOMER_REPORTS.map(r => (
            <ReportCard key={r.key} report={r} exporting={exporting[r.key]} onExport={handleExport} t={t} />
          ))}
        </div>
      </div>

      {/* Scheduled Reports */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">{t('reports.scheduled.title')} <em>{t('reports.scheduled.title_em')}</em></div>
          <button className="btn btn-sm btn-outline" onClick={() => setSchedModal({ schedule: null })}>
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
            {schedLoading && (
              <Loading row cols={6} />
            )}
            {!schedLoading && schedError !== null && (
              <tr><td colSpan={6} className="state-empty">
                {schedError || t('reports.sched.err_load', 'Could not load your scheduled reports — this list may be incomplete. Reload the page to try again.')}
              </td></tr>
            )}
            {!schedLoading && schedError === null && schedules.length === 0 && (
              <tr><td colSpan={6} className="state-empty">
                {t('reports.sched.empty', 'No scheduled reports yet. Use New Schedule to have one emailed to you automatically.')}
              </td></tr>
            )}
            {!schedLoading && schedules.map((s, i) => {
              const type   = s.report_type
              // A report_type we do not know about still lists, showing its raw
              // value rather than vanishing from a table the merchant is using
              // to check what is being emailed out.
              const known  = Object.prototype.hasOwnProperty.call(SCHEDULE_FORMATS, type)
              const fmt    = String(s.format ?? '').toLowerCase()
              const emails = Array.isArray(s.recipients) ? s.recipients : []
              const next   = s.next_run_at ?? s.next_run ?? s.nextRun ?? null
              const active = s.is_active !== false
              return (
                <tr key={s.id ?? i}
                    style={{
                      ...(i === schedules.length - 1 ? { borderBottom:'none' } : null),
                      ...(active ? null : { opacity: 0.55 }),
                    }}>
                  <td style={{ fontWeight:600 }}>
                    {known ? t(`reports.items.${type}.name`) : type}
                    {!active && <span className="rpt-sched-paused">{t('reports.sched.paused', 'Paused')}</span>}
                  </td>
                  <td>{freqLabel(t, s.frequency)}</td>
                  <td>{fmt ? <span className={`report-fmt ${fmt}`}>{fmt.toUpperCase()}</span> : '—'}</td>
                  <td className="rpt-recipients">{emails.join(', ') || '—'}</td>
                  <td>{active ? (next ? fmtDateLocalized(next) : '—') : '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => setSchedModal({ schedule: s })}>
                      {t('common.edit')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {preview && (
        <ReportPreview
          name={preview.name}
          csv={preview.csv}
          onClose={() => setPreview(null)}
          t={t}
        />
      )}

      {/* Keyed so switching straight from one schedule to another remounts the
          dialog and its fields re-initialise from the new schedule. */}
      {schedModal && (
        <ScheduleModal
          key={schedModal.schedule?.id ?? 'new'}
          schedule={schedModal.schedule}
          onClose={() => setSchedModal(null)}
          onSaved={handleScheduleSaved}
          t={t}
        />
      )}

      <InlineToast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}
