import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { AGE_BRACKETS, bracketName, bracketRange } from '../lib/ageBracket'
import useLangStore from '../store/langStore'
import Toast, { useToast } from '../components/ui/Toast'

const API = import.meta.env.VITE_API_URL

// Wired to /boutique/markdowns/*, confirmed via the boutique-markdowns
// Postman collection (sir, Sep 2026). Response field names for the GET
// endpoints (rules/preview/approvals/history) weren't in that collection —
// only request shapes were — so these are best-guess snake_case reads
// matching the confirmed request convention. Flag any mismatch found while
// testing live so the reads below can be corrected.

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle${on ? ' on' : ''}`} onClick={onToggle}>
      <div className="toggle-knob" />
    </div>
  )
}

// Bracket ids and thresholds are fixed by the backend and shared with the
// Products tab via lib/ageBracket.js — see the note there.
const BRACKET_COLOR = { fresh: 'var(--green)', normal: 'var(--blue)', aging: 'var(--amber)', slow: 'var(--red)', dead: '#8A0012' }
const HISTORY_PAGE_SIZE = 50

// History rows carry the timestamp as `date`; `applied_at` is kept only as a
// fallback in case the field is renamed back.
const markdownDate = h => h?.date ?? h?.applied_at ?? null

// `applied_by` is the literal string "Auto" for automatic markdowns and a
// staff member's name otherwise. It was compared against "system", which
// never matched, so the Auto badge never rendered.
const isAutoApplied = v => typeof v === 'string' && ['auto', 'system'].includes(v.trim().toLowerCase())

// Money follows the portal language, not the browser's: Italian wants
// "€1.234,56" where English wants "€1,234.56". Guards NaN too — a null
// price multiplied by a stock count used to render "€NaN".
function fmt(v, lang) {
  const n = Number(v)
  if (v == null || !Number.isFinite(n)) return '—'
  return `€${n.toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}`
}

export default function Markdowns() {
  const { t } = useTranslation()
  const lang = useLangStore(s => s.lang)
  const { toasts, show } = useToast()

  const [activeTab, setActiveTab] = useState(0)
  const [showSettings, setShowSettings] = useState(false)

  const [rules, setRules] = useState([])
  const [settings, setSettings] = useState({ margin_floor_pct: 30, rounding_mode: '.90', notify_savers: true, daily_cap: 25 })
  const [draftSettings, setDraftSettings] = useState(settings)
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesError, setRulesError] = useState('')

  const [preview, setPreview] = useState({ summary: {}, rows: [] })
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState('')

  const [approvals, setApprovals] = useState([])
  const [approvalsLoading, setApprovalsLoading] = useState(true)
  const [approvalsError, setApprovalsError] = useState('')

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  // The endpoint returns pagination {page, limit, total, total_pages}; we used
  // to request page 1 and ignore the rest, so anything past the first 50
  // applied markdowns was invisible with nothing on screen saying so.
  const [historyPage, setHistoryPage] = useState(1)
  const [historyMeta, setHistoryMeta] = useState({ total: 0, total_pages: 0 })

  const BRACKET_LABELS = Object.fromEntries(
    AGE_BRACKETS.map(bk => [bk, { name: bracketName(t, bk), range: bracketRange(t, bk) }])
  )

  // All four loads used to end in `.catch(() => {})` with no `else` on
  // `res.success`, so a backend error or a dropped connection left the tab
  // blank and silent. Each now keeps its own error string and the tab renders
  // it instead of an empty table.
  function loadFailed(res) {
    return res?.message || t('markdowns.err_load', 'Could not load. Please try again.')
  }

  function refetchRules() {
    setRulesLoading(true); setRulesError('')
    apiFetch(`${API}/boutique/markdowns/rules`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) { setRulesError(loadFailed(res)); return }
        // Merge onto the defaults rather than replacing with `settings` from
        // the enclosing scope — that read a value captured before the fetch.
        setSettings(prev => ({ ...prev, ...(res.data?.settings ?? {}) }))
        setRules(res.data?.rules ?? [])
      })
      .catch(() => setRulesError(t('markdowns.err_network', 'Network error.')))
      .finally(() => setRulesLoading(false))
  }
  function refetchPreview() {
    setPreviewLoading(true); setPreviewError('')
    apiFetch(`${API}/boutique/markdowns/preview`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) { setPreviewError(loadFailed(res)); return }
        setPreview({ summary: res.data?.summary ?? {}, rows: res.data?.rows ?? [] })
      })
      .catch(() => setPreviewError(t('markdowns.err_network', 'Network error.')))
      .finally(() => setPreviewLoading(false))
  }
  function refetchApprovals() {
    setApprovalsLoading(true); setApprovalsError('')
    apiFetch(`${API}/boutique/markdowns/approvals`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) { setApprovalsError(loadFailed(res)); return }
        setApprovals(res.data?.approvals ?? [])
      })
      .catch(() => setApprovalsError(t('markdowns.err_network', 'Network error.')))
      .finally(() => setApprovalsLoading(false))
  }
  function refetchHistory(page = historyPage) {
    setHistoryLoading(true); setHistoryError('')
    apiFetch(`${API}/boutique/markdowns/history?page=${page}&limit=${HISTORY_PAGE_SIZE}`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) { setHistoryError(loadFailed(res)); return }
        setHistory(res.data?.history ?? [])
        const pg = res.data?.pagination ?? {}
        setHistoryMeta({ total: pg.total ?? 0, total_pages: pg.total_pages ?? 0 })
        setHistoryPage(pg.page ?? page)
      })
      .catch(() => setHistoryError(t('markdowns.err_network', 'Network error.')))
      .finally(() => setHistoryLoading(false))
  }

  // Rules/settings, preview, and approvals all load up front — preview's
  // "affected item" counts feed the Rules tab, and approvals' count feeds
  // the tab badge, regardless of which tab is actually open.
  useEffect(() => {
    refetchRules()
    refetchPreview()
    refetchApprovals()
    refetchHistory()
  }, [])

  function getRule(bracket) { return rules.find(r => r.bracket === bracket) ?? { bracket, enabled: false, discount_pct: 0, apply_mode: 'auto' } }

  function patchRules(body) {
    return apiFetch(`${API}/boutique/markdowns/rules`, { method: 'PATCH', body: JSON.stringify(body) })
      .then(r => r.json())
      .then(res => {
        if (!res.success) { show(res.message || t('markdowns.err_save', 'Failed to save.'), 'error'); return false }
        return true
      })
      .catch(() => { show(t('markdowns.err_network', 'Network error.'), 'error'); return false })
  }

  // Every rule control updates the screen first, then saves. If the save
  // fails we used to show a toast and LEAVE the new value on screen — the
  // toggle read "on" while the server still had "off", and a refresh silently
  // undid it. On failure we now re-read the rules so the screen matches the
  // server again. (Same lying-toggle bug as the one fixed in Inventory.)
  function afterPatch(ok) {
    if (ok) refetchPreview()
    else refetchRules()
  }

  function toggleRule(bracket) {
    const cur = getRule(bracket)
    const next = { bracket, enabled: !cur.enabled, discount_pct: (!cur.enabled && cur.discount_pct === 0) ? 10 : cur.discount_pct, apply_mode: cur.apply_mode }
    setRules(prev => {
      const exists = prev.some(r => r.bracket === bracket)
      return exists ? prev.map(r => r.bracket === bracket ? { ...r, ...next } : r) : [...prev, next]
    })
    patchRules({ rules: [next] }).then(afterPatch)
  }
  function stepRulePct(bracket, delta) {
    const cur = getRule(bracket)
    // Clamped at 5, not 0: an enabled rule set to 0% is switched on but does
    // nothing, which reads as broken. Use the toggle to turn it off instead.
    const pct = Math.max(5, Math.min(70, Number(cur.discount_pct || 0) + delta))
    const next = { bracket, discount_pct: pct }
    setRules(prev => prev.map(r => r.bracket === bracket ? { ...r, discount_pct: pct } : r))
    patchRules({ rules: [next] }).then(afterPatch)
  }
  function setRuleMode(bracket, mode) {
    setRules(prev => prev.map(r => r.bracket === bracket ? { ...r, apply_mode: mode } : r))
    patchRules({ rules: [{ bracket, apply_mode: mode }] }).then(afterPatch)
  }

  function approveOne(id, overridePct) {
    const body = overridePct != null ? { override_pct: overridePct } : {}
    apiFetch(`${API}/boutique/markdowns/approvals/${id}/approve`, { method: 'POST', body: JSON.stringify(body) })
      .then(r => r.json())
      .then(res => {
        if (res.success) { show(t('markdowns.approvals.toast_approved', 'Markdown applied.'), 'success'); refetchApprovals(); refetchPreview() }
        else show(res.message || t('common.error', 'Something went wrong.'), 'error')
      })
      .catch(() => show(t('markdowns.err_network', 'Network error.'), 'error'))
  }
  function skipOne(id) {
    apiFetch(`${API}/boutique/markdowns/approvals/${id}/skip`, { method: 'POST', body: '{}' })
      .then(r => r.json())
      .then(res => {
        // Preview has to be refreshed too. Approve already did this; skip did
        // not, so a skipped product vanished from Approvals but stayed listed
        // in Preview & Impact until the page was reloaded.
        if (res.success) { show(t('markdowns.approvals.toast_skipped', 'Skipped.'), 'success'); refetchApprovals(); refetchPreview() }
        else show(res.message || t('common.error', 'Something went wrong.'), 'error')
      })
      .catch(() => show(t('markdowns.err_network', 'Network error.'), 'error'))
  }
  function applyAllAuto() {
    apiFetch(`${API}/boutique/markdowns/apply-auto`, { method: 'POST', body: '{}' })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          show(t('markdowns.preview.toast_applied', { count: res.data?.applied ?? 0, defaultValue: '{{count}} markdown(s) applied' }), 'success')
          refetchPreview(); refetchApprovals(); refetchHistory()
          setActiveTab(3)
        } else show(res.message || t('common.error', 'Something went wrong.'), 'error')
      })
      .catch(() => show(t('markdowns.err_network', 'Network error.'), 'error'))
  }

  function openSettings() { setDraftSettings(settings); setShowSettings(true) }
  function saveSettings() {
    patchRules({ settings: draftSettings }).then(ok => {
      if (ok) { setSettings(draftSettings); setShowSettings(false); show(t('markdowns.settings.toast_saved', 'Settings saved.'), 'success'); refetchPreview() }
    })
  }

  function exportHistory() {
    const rows = [['Date', 'Product', 'Was', 'Now', 'Cut %', 'Units', 'Savers Notified', 'By']]
      .concat(history.map(h => [markdownDate(h), h.product_name, h.was_price, h.new_price, h.discount_pct, h.units, h.savers_notified, h.applied_by]))
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `markdown-history-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const TABS = [
    t('markdowns.tabs.rules', 'Markdown Rules'),
    t('markdowns.tabs.preview', 'Preview & Impact'),
    `${t('markdowns.tabs.approvals', 'Approvals')}${approvals.length > 0 ? ` (${approvals.length})` : ''}`,
    t('markdowns.tabs.history', 'History'),
  ]

  return (
    <>
      <Toast toasts={toasts} />
      <div className="tabs">
        {TABS.map((tab, i) => (
          <div key={i} className={`tab${activeTab === i ? ' act' : ''}`} onClick={() => setActiveTab(i)}>{tab}</div>
        ))}
      </div>

      {activeTab === 0 && (
        <RulesTab
          t={t} rules={rules} settings={settings} preview={preview} loading={rulesLoading} error={rulesError}
          bracketLabels={BRACKET_LABELS} getRule={getRule} retry={refetchRules}
          toggleRule={toggleRule} stepRulePct={stepRulePct} setRuleMode={setRuleMode}
          openSettings={openSettings}
        />
      )}

      {activeTab === 1 && (
        <PreviewTab
          t={t} lang={lang} preview={preview} loading={previewLoading} error={previewError}
          bracketLabels={BRACKET_LABELS} retry={refetchPreview}
          applyAllAuto={applyAllAuto}
        />
      )}

      {activeTab === 2 && (
        <ApprovalsTab
          t={t} lang={lang} items={approvals} loading={approvalsLoading} error={approvalsError} settings={settings}
          bracketLabels={BRACKET_LABELS} retry={refetchApprovals}
          approveOne={approveOne} skipOne={skipOne}
        />
      )}

      {activeTab === 3 && (
        <HistoryTab
          t={t} lang={lang} history={history} loading={historyLoading} error={historyError}
          retry={refetchHistory} exportHistory={exportHistory}
          page={historyPage} meta={historyMeta} onPage={refetchHistory}
        />
      )}

      {showSettings && (
        <SettingsModal
          t={t} draft={draftSettings} setDraft={setDraftSettings}
          onClose={() => setShowSettings(false)} onSave={saveSettings}
        />
      )}
    </>
  )
}

/* A failed load is shown, not swallowed — with a way back out of it. */
function LoadError({ t, error, retry }) {
  return (
    <div className="alert alert-red">
      <span className="material-symbols-outlined">error</span>
      <div style={{ flex: 1 }}>{error}</div>
      <button className="btn btn-outline btn-sm" onClick={retry}>{t('common.retry', 'Retry')}</button>
    </div>
  )
}

/* ── Tab 1: Rules ── */
function RulesTab({ t, settings, preview, loading, error, retry, bracketLabels, getRule, toggleRule, stepRulePct, setRuleMode, openSettings }) {
  if (loading) return <div className="empty">{t('markdowns.loading', 'Loading') + '…'}</div>
  if (error) return <LoadError t={t} error={error} retry={retry} />
  return (
    <>
      <div className="alert alert-info">
        <span className="material-symbols-outlined">info</span>
        <div>{t('markdowns.rules.intro', 'Markdowns run off your inventory aging. Set a discount per age bracket; items are marked down automatically as they cross into that bracket. A margin floor protects you: any cut that would push margin below the floor is held for your approval instead of applying silently.')}</div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-title">{t('markdowns.rules.title_pre', 'Markdown by')} <em>{t('markdowns.rules.title_em', 'age bracket')}</em></div>
          <button className="btn btn-outline btn-sm" onClick={openSettings}>
            <span className="material-symbols-outlined">tune</span>{t('markdowns.rules.global_settings', 'Global settings')}
          </button>
        </div>
        {AGE_BRACKETS.map(bk => {
          const rule = getRule(bk)
          const affected = preview.rows.filter(row => (row.proposal?.bracket ?? row.bracket) === bk && !(row.product?.marked_down ?? row.marked_down)).length
          const lbl = bracketLabels[bk]
          return (
            <div key={bk} className="ap-toggle-row ap-toggle-border" style={{ flexWrap: 'wrap', gap: 14 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: BRACKET_COLOR[bk], flexShrink: 0 }} />
              <div style={{ minWidth: 110 }}>
                <div className="ap-toggle-label">{lbl.name}</div>
                <div className="form-hint" style={{ margin: 0 }}>{lbl.range}</div>
              </div>
              <Toggle on={!!rule.enabled} onToggle={() => toggleRule(bk)} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, opacity: rule.enabled ? 1 : 0.4, pointerEvents: rule.enabled ? 'auto' : 'none', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--stone)', marginBottom: 4 }}>{t('markdowns.rules.discount', 'Discount')}</div>
                  <div className="num-stepper">
                    <div className="num-btn" onClick={() => stepRulePct(bk, -5)}>−</div>
                    <span style={{ minWidth: 36, textAlign: 'center', fontWeight: 700 }}>{rule.discount_pct}%</span>
                    <div className="num-btn" onClick={() => stepRulePct(bk, 5)}>+</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--stone)', marginBottom: 4 }}>{t('markdowns.rules.apply_mode', 'Apply mode')}</div>
                  <select className="form-select" value={rule.apply_mode} onChange={e => setRuleMode(bk, e.target.value)}>
                    <option value="auto">{t('markdowns.rules.mode_auto', 'Auto-apply')}</option>
                    <option value="approval">{t('markdowns.rules.mode_approval', 'Require approval')}</option>
                  </select>
                </div>
              </div>
              <div style={{ fontSize: 9, color: 'var(--stone)', textAlign: 'right', minWidth: 70 }}>
                {t('markdowns.rules.affected', { count: affected, defaultValue: '{{count}} item(s)\nin stock' })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="stat-row">
        <div className="stat-card"><div className="stat-lbl">{t('markdowns.rules.stat_floor', 'Margin Floor')}</div><div className="stat-val">{settings.margin_floor_pct}%</div></div>
        <div className="stat-card"><div className="stat-lbl">{t('markdowns.rules.stat_round', 'Price Rounding')}</div><div className="stat-val">{settings.rounding_mode === 'whole' ? '€1' : settings.rounding_mode === 'none' ? t('markdowns.rules.exact', 'Exact') : settings.rounding_mode}</div></div>
        <div className="stat-card"><div className="stat-lbl">{t('markdowns.rules.stat_notify', 'Notify Savers')}</div><div className="stat-val">{settings.notify_savers ? t('common.on', 'On') : t('common.off', 'Off')}</div></div>
        <div className="stat-card"><div className="stat-lbl">{t('markdowns.rules.stat_cap', 'Daily Auto Cap')}</div><div className="stat-val">{settings.daily_cap}</div></div>
      </div>
    </>
  )
}

/* ── Tab 2: Preview & Impact ── */
function PreviewTab({ t, lang, preview, loading, error, retry, bracketLabels, applyAllAuto }) {
  const s = preview.summary ?? {}
  const rows = preview.rows ?? []
  const autoCount = s.auto_eligible ?? rows.filter(r => (r.proposal?.outcome ?? r.outcome) === 'auto').length
  const needApproval = s.need_approval ?? rows.filter(r => (r.proposal?.outcome ?? r.outcome) === 'approval').length

  if (loading) return <div className="empty">{t('markdowns.loading', 'Loading') + '…'}</div>
  if (error) return <LoadError t={t} error={error} retry={retry} />

  return (
    <>
      <div className="stat-row">
        {/* NOT "90d+" as the old label claimed. Checked against live data:
            aged_value was 4518 while the oldest item was 6 days old, and
            4518 = 89x30 + 88x21 — the retail value of the proposed rows at
            their CURRENT price. cash_recoverable is the same basket after the
            cut, and aged_value - cash_recoverable = margin_given_up exactly.
            New key on purpose: the old one has "90d+" baked into the bundle. */}
        <div className="stat-card"><div className="stat-lbl">{t('markdowns.preview.stat_value_before', 'Value Before Markdown')}</div><div className="stat-val" style={{ color: 'var(--red)' }}>{fmt(s.aged_value ?? 0, lang)}</div></div>
        <div className="stat-card"><div className="stat-lbl">{t('markdowns.preview.stat_proposed', 'Markdowns Proposed')}</div><div className="stat-val">{s.proposed ?? 0}</div><div className="form-hint">{t('markdowns.preview.stat_proposed_sub', { auto: s.auto_eligible ?? 0, appr: s.need_approval ?? 0, defaultValue: '{{auto}} auto · {{appr}} approval' })}</div></div>
        <div className="stat-card"><div className="stat-lbl">{t('markdowns.preview.stat_auto', 'Auto-Eligible Now')}</div><div className="stat-val" style={{ color: 'var(--green)' }}>{s.auto_eligible ?? 0}</div></div>
        <div className="stat-card"><div className="stat-lbl">{t('markdowns.preview.stat_cash', 'Cash Recoverable')}</div><div className="stat-val">{fmt(s.cash_recoverable ?? 0, lang)}</div></div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-title">{t('markdowns.preview.title_pre', 'Markdown')} <em>{t('markdowns.preview.title_em', 'preview')}</em></div>
          {/* Greyed out with no reason given just reads as a broken button.
              Say why: it only ever applies the AUTO rows, and every row here
              can be sitting on "approval" instead. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {autoCount === 0 && rows.length > 0 && (
              <span className="form-hint" style={{ margin: 0, textAlign: 'right' }}>
                {t('markdowns.preview.no_auto_hint', { count: needApproval, defaultValue: 'Nothing qualifies for automatic markdown — {{count}} item(s) need your approval first.' })}
              </span>
            )}
            <button className="btn btn-primary btn-sm" onClick={applyAllAuto} disabled={autoCount === 0}
              title={autoCount === 0 ? t('markdowns.preview.no_auto_title', 'No auto-eligible markdowns right now') : undefined}>
              <span className="material-symbols-outlined">bolt</span>{t('markdowns.preview.apply_auto', 'Apply auto now')}
            </button>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="empty">
            <span className="material-symbols-outlined">sell</span>
            {t('markdowns.preview.empty', 'Nothing due for a markdown right now.')}
          </div>
        ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('markdowns.preview.col_product', 'Product')}</th>
                <th>{t('markdowns.preview.col_age', 'Age')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.preview.col_units', 'Units')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.preview.col_cost', 'Cost')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.preview.col_current', 'Current')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.preview.col_cut', 'Cut')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.preview.col_new_price', 'New Price')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.preview.col_new_margin', 'New Margin')}</th>
                <th>{t('markdowns.preview.col_status', 'Status')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.preview.col_savers', 'Savers')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const p = row.product ?? row
                const e = row.proposal ?? row
                const bk = e.bracket ?? p.bracket
                const lbl = bracketLabels[bk] ?? { name: bk, range: '' }
                const outcome = e.outcome ?? 'none'
                return (
                  <tr key={p.id ?? i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--stone)' }}>inventory_2</span>
                        <div><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 9, color: 'var(--stone)' }}>{p.category}</div></div>
                      </div>
                    </td>
                    <td><span className="status pending" style={{ whiteSpace: 'nowrap' }}>{lbl.name} · {p.days_in_stock ?? p.days}d</span></td>
                    <td style={{ textAlign: 'right' }}>{p.stock}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(p.cost, lang)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(p.price, lang)}</td>
                    <td style={{ textAlign: 'right' }}>{outcome === 'none' ? '—' : <span style={{ color: 'var(--red)', fontWeight: 700 }}>−{e.discount_pct}%</span>}</td>
                    <td style={{ textAlign: 'right' }}>{outcome === 'none' ? '—' : <span style={{ fontWeight: 700 }}>{fmt(e.new_price, lang)}</span>}</td>
                    <td style={{ textAlign: 'right' }}>{e.margin_pct != null ? `${Number(e.margin_pct).toFixed(0)}%` : '—'}</td>
                    <td>
                      {outcome === 'none' && <span className="status hidden">{t('markdowns.preview.status_none', 'No markdown')}</span>}
                      {outcome === 'auto' && <span className="status active">{t('markdowns.preview.status_auto', 'Auto')}</span>}
                      {outcome === 'approval' && <span className="status pending">{e.floor_breach ? t('markdowns.preview.status_floor', 'Floor · approve') : t('markdowns.preview.status_approve', 'Approve')}</span>}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--gold-dk)', fontWeight: 600 }}>{p.savers_count ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </>
  )
}

/* ── Tab 3: Approvals ── */
function ApprovalsTab({ t, lang, items, loading, error, retry, settings, bracketLabels, approveOne, skipOne }) {
  const [adjust, setAdjust] = useState({})

  if (loading) return <div className="empty">{t('markdowns.loading', 'Loading') + '…'}</div>
  if (error) return <LoadError t={t} error={error} retry={retry} />

  return (
    <>
      <div className="alert alert-warn">
        <span className="material-symbols-outlined">gpp_maybe</span>
        <div>{t('markdowns.approvals.intro', { floor: settings.margin_floor_pct, defaultValue: 'These markdowns need your sign-off, either because they are dead-stock clearances or because the cut would take margin below your {{floor}}% floor.' })}</div>
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <span className="material-symbols-outlined">task_alt</span>
          {t('markdowns.approvals.empty', 'Nothing awaiting approval. Auto-markdowns apply on their own; dead-stock and below-floor cuts appear here.')}
        </div>
      ) : (
        <div className="grid2">
          {items.map(a => {
            const bk = a.bracket
            const lbl = bracketLabels[bk] ?? { name: bk }
            // This endpoint returns its decimals as STRINGS ("35.00", "88.00",
            // "-602.99"), unlike /preview which returns real numbers. Without
            // the coercion the badge reads "−35.00%" and the stepper starts
            // from a string.
            const pct = adjust[a.id] ?? Math.round(Number(a.discount_pct) || 0)
            const margin = a.margin_pct == null ? null : Number(a.margin_pct)
            const breach = a.floor_breach ?? (margin != null && margin < settings.margin_floor_pct)
            return (
              <div key={a.id} className="card" style={breach ? { borderLeft: '3px solid var(--red)' } : undefined}>
                <div style={{ display: 'flex', gap: 11, marginBottom: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--stone)' }}>inventory_2</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{a.product_name}</div>
                    <div style={{ fontSize: 9, color: 'var(--stone)' }}>{lbl.name} · {a.days_in_stock} {t('markdowns.approvals.days', 'days')} · {a.stock} {t('markdowns.approvals.units', 'units')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '10px 0' }}>
                  <span style={{ fontSize: 13, textDecoration: 'line-through', color: 'var(--stone)' }}>{fmt(a.current_price, lang)}</span>
                  <span className="material-symbols-outlined" style={{ color: 'var(--gold)' }}>arrow_forward</span>
                  <span style={{ fontSize: 22, fontWeight: 600 }}>{fmt(a.new_price, lang)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', background: 'rgba(197,0,26,.07)', padding: '2px 8px', borderRadius: 6 }}>−{pct}%</span>
                </div>
                <div className="detail-row"><div className="detail-label">{t('markdowns.approvals.new_margin', 'New margin')}</div><div className="detail-value" style={{ color: breach ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>{margin != null && Number.isFinite(margin) ? `${margin.toFixed(0)}%` : '—'}{breach ? ` · ${t('markdowns.approvals.below_floor', 'below {{floor}}% floor', { floor: settings.margin_floor_pct })}` : ''}</div></div>
                <div className="detail-row"><div className="detail-label">{t('markdowns.approvals.cash', 'Cash recoverable')}</div><div className="detail-value">{fmt(a.new_price != null ? a.new_price * (a.stock ?? 1) : null, lang)}</div></div>
                <div className="detail-row"><div className="detail-label">{t('markdowns.approvals.savers', 'Savers to notify')}</div><div className="detail-value">{a.savers ?? 0}</div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--mist)' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--stone)' }}>{t('markdowns.approvals.adjust', 'Adjust')}</span>
                  <div className="num-stepper">
                    <div className="num-btn" onClick={() => setAdjust(prev => ({ ...prev, [a.id]: Math.max(5, Math.min(70, pct - 5)) }))}>−</div>
                    <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 700 }}>{pct}%</span>
                    <div className="num-btn" onClick={() => setAdjust(prev => ({ ...prev, [a.id]: Math.max(5, Math.min(70, pct + 5)) }))}>+</div>
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--stone)' }}>{t('markdowns.approvals.then_approve', 'then approve')}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => approveOne(a.id, adjust[a.id])}>
                    <span className="material-symbols-outlined">check</span>{t('markdowns.approvals.approve_btn', 'Approve & apply')}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => skipOne(a.id)}>{t('markdowns.approvals.skip_btn', 'Skip')}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ── Tab 4: History ── */
function HistoryTab({ t, lang, history, loading, error, retry, exportHistory, page, meta, onPage }) {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">{t('markdowns.history.title_pre', 'Applied')} <em>{t('markdowns.history.title_em', 'markdowns')}</em></div>
        <button className="btn btn-outline btn-sm" onClick={exportHistory} disabled={history.length === 0}>
          <span className="material-symbols-outlined">download</span>{t('common.export', 'Export')}
        </button>
      </div>
      {loading ? (
        <div className="empty">{t('markdowns.loading', 'Loading') + '…'}</div>
      ) : error ? (
        <LoadError t={t} error={error} retry={retry} />
      ) : history.length === 0 ? (
        <div className="empty">
          <span className="material-symbols-outlined">history</span>
          {t('markdowns.history.empty', 'No markdowns applied yet.')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('markdowns.history.col_date', 'Date')}</th>
                <th>{t('markdowns.history.col_product', 'Product')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.history.col_was', 'Was')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.history.col_now', 'Now')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.history.col_cut', 'Cut')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.history.col_units', 'Units')}</th>
                <th style={{ textAlign: 'right' }}>{t('markdowns.history.col_savers', 'Savers Notified')}</th>
                <th>{t('markdowns.history.col_by', 'By')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={h.id ?? i}>
                  {/* The field is `date`, confirmed live. `applied_at` was a
                      guess made before this endpoint had any rows to inspect,
                      and it left every date showing as an em dash. */}
                  <td>{markdownDate(h) ? new Date(markdownDate(h)).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ fontWeight: 600 }}>{h.product_name}</td>
                  <td style={{ textAlign: 'right' }}><span style={{ textDecoration: 'line-through', color: 'var(--stone)' }}>{fmt(h.was_price, lang)}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(h.new_price, lang)}</td>
                  {/* Rounded like the approvals card: this endpoint may send
                      its decimals as strings ("35.00") the way /approvals does. */}
                  <td style={{ textAlign: 'right', color: 'var(--red)', fontWeight: 700 }}>−{Math.round(Number(h.discount_pct) || 0)}%</td>
                  <td style={{ textAlign: 'right' }}>{h.units}</td>
                  <td style={{ textAlign: 'right' }}>{h.savers_notified > 0 ? <span style={{ fontSize: 9, color: 'var(--gold-dk)', fontWeight: 600 }}>{t('markdowns.history.notified', { count: h.savers_notified, defaultValue: '{{count}} notified' })}</span> : '—'}</td>
                  <td>{isAutoApplied(h.applied_by) ? <span className="status active">{t('markdowns.auto', 'Auto')}</span> : h.applied_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Same pager markup as the POS receipt list — modal-footer is the
              existing right-aligned row style; there is no .pager class. */}
          {meta.total_pages > 1 && (
            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
              <span>{t('markdowns.history.page_of', { page, pages: meta.total_pages, total: meta.total, defaultValue: 'Page {{page}} of {{pages}} · {{total}} total' })}</span>
              <button className="btn btn-outline btn-sm" disabled={page >= meta.total_pages} onClick={() => onPage(page + 1)}>›</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Settings modal ── */
function SettingsModal({ t, draft, setDraft, onClose, onSave }) {
  // The inner stopPropagation only does anything if the backdrop closes on
  // click — that handler was missing, so clicking outside did nothing.
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('markdowns.settings.title', 'Global settings')}</div>
          <div className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></div>
        </div>

        <div className="ap-toggle-row ap-toggle-border">
          <div>
            <div className="ap-toggle-label">{t('markdowns.settings.floor_label', 'Margin floor')}</div>
            <div className="form-hint">{t('markdowns.settings.floor_hint', 'Minimum gross margin for an automatic markdown. Cuts below this are held for approval.')}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input className="form-input" style={{ width: 56, textAlign: 'center' }} type="number" min="0" max="90" value={draft.margin_floor_pct} onChange={e => setDraft(d => ({ ...d, margin_floor_pct: Math.max(0, Math.min(90, Number(e.target.value) || 0)) }))} />
            <span style={{ fontSize: 12, color: 'var(--stone)' }}>%</span>
          </div>
        </div>

        <div className="ap-toggle-row ap-toggle-border">
          <div>
            <div className="ap-toggle-label">{t('markdowns.settings.round_label', 'Price rounding')}</div>
            <div className="form-hint">{t('markdowns.settings.round_hint', 'How new prices are rounded after the discount.')}</div>
          </div>
          <select className="form-select" value={draft.rounding_mode} onChange={e => setDraft(d => ({ ...d, rounding_mode: e.target.value }))}>
            <option value=".90">{t('markdowns.settings.round_90', '.90 ending')}</option>
            <option value=".99">{t('markdowns.settings.round_99', '.99 ending')}</option>
            <option value="whole">{t('markdowns.settings.round_whole', 'Whole euro')}</option>
            <option value="none">{t('markdowns.settings.round_exact', 'Exact')}</option>
          </select>
        </div>

        <div className="ap-toggle-row ap-toggle-border">
          <div>
            <div className="ap-toggle-label">{t('markdowns.settings.notify_label', 'Notify savers on markdown')}</div>
            <div className="form-hint">{t('markdowns.settings.notify_hint', 'When a markdown applies, fire the price-drop alert to customers who saved the item.')}</div>
          </div>
          <Toggle on={draft.notify_savers} onToggle={() => setDraft(d => ({ ...d, notify_savers: !d.notify_savers }))} />
        </div>

        <div className="ap-toggle-row">
          <div>
            <div className="ap-toggle-label">{t('markdowns.settings.cap_label', 'Daily auto-apply cap')}</div>
            <div className="form-hint">{t('markdowns.settings.cap_hint', 'Maximum automatic markdowns applied in one day, to avoid flooding customers.')}</div>
          </div>
          <input className="form-input" style={{ width: 56, textAlign: 'center' }} type="number" min="1" value={draft.daily_cap} onChange={e => setDraft(d => ({ ...d, daily_cap: Math.max(1, Number(e.target.value) || 1) }))} />
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={onSave}>
            <span className="material-symbols-outlined">save</span>{t('markdowns.settings.save_btn', 'Save settings')}
          </button>
        </div>
      </div>
    </div>
  )
}
