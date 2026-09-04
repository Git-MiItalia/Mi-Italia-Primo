import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import RangeBar from '../components/ui/RangeBar'
import { PR_TODAY } from '../lib/dateHelpers'

const API = import.meta.env.VITE_API_URL
const LANG_MAP = {
  it: { flag:'🇮🇹', name:'Italian' },
  fr: { flag:'🇫🇷', name:'French' },
  es: { flag:'🇪🇸', name:'Spanish' },
  de: { flag:'🇩🇪', name:'German' },
  ar: { flag:'🇸🇦', name:'Arabic' },
  zh: { flag:'🇨🇳', name:'Mandarin' },
  ja: { flag:'🇯🇵', name:'Japanese' },
  en: { flag:'EN',  name:'English'  },
  hi: { flag:'🇮🇳', name:'Hindi' },
  pt: { flag:'🇵🇹', name:'Portuguese' },
}
const SEG_AVATAR = {
  vip:    { bg:'rgba(184,149,90,0.12)', color:'var(--gold-dk)' },
  loyal:  { bg:'rgba(99,91,255,0.1)',   color:'var(--stripe)'   },
  new:    { bg:'rgba(0,108,53,0.08)',   color:'var(--green)'    },
  warm:   { bg:'rgba(217,119,6,0.1)',   color:'#B45309'         },
  lapsed: { bg:'rgba(197,0,26,0.07)',   color:'var(--red)'      },
}

function langDisplayName(code, t) {
  const names = {
    it: t('eng.lang_name.it', 'Italian'), en: t('eng.lang_name.en', 'English'), fr: t('eng.lang_name.fr', 'French'),
    de: t('eng.lang_name.de', 'German'), es: t('eng.lang_name.es', 'Spanish'), ar: t('eng.lang_name.ar', 'Arabic'),
    zh: t('eng.lang_name.zh', 'Mandarin'), ja: t('eng.lang_name.ja', 'Japanese'),
    hi: t('eng.lang_name.hi', 'Hindi'), pt: t('eng.lang_name.pt', 'Portuguese'),
  }
  return names[code] || code
}

function timeAgo(iso, t) {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0)    return t('eng.time.today', 'Today')
  if (days === 1)   return t('eng.time.yesterday', 'Yesterday')
  if (days < 7)     return t('eng.time.days_ago', { count: days, defaultValue: '{{count}} days ago' })
  if (days < 30)    return t('eng.time.weeks_ago', { count: Math.floor(days/7), defaultValue: '{{count}} week(s) ago' })
  if (days < 365)   return t('eng.time.months_ago', { count: Math.floor(days/30), defaultValue: '{{count}} month(s) ago' })
  return t('eng.time.years_ago', { count: Math.floor(days/365), defaultValue: '{{count}} year(s) ago' })
}

function activityStatusColor(status) {
  const s = (status || '').toLowerCase()
  if (['collected', 'completed', 'delivered', 'paid', 'confirmed'].includes(s)) return 'var(--green)'
  if (['cancelled', 'canceled', 'failed', 'refunded', 'expired'].includes(s)) return 'var(--red)'
  return 'var(--stone)'
}

const LANG_META = {
  it: { flag:'🇮🇹', code:null, name:'Italian'  },
  en: { flag:null,  code:'EN',  name:'English'  },
  fr: { flag:'🇫🇷', code:null, name:'French'   },
  de: { flag:'🇩🇪', code:null, name:'German'   },
  es: { flag:'🇪🇸', code:null, name:'Spanish'  },
  ar: { flag:'🇸🇦', code:null, name:'Arabic'   },
  zh: { flag:'🇨🇳', code:null, name:'Chinese'  },
  ja: { flag:'🇯🇵', code:null, name:'Japanese' },
  hi: { flag:'🇮🇳', code:null, name:'Hindi'    },
  pt: { flag:'🇵🇹', code:null, name:'Portuguese' },
}



function langSrcLabel(src, t) {
  return src === 'user_set'  ? t('eng.ct.lang_src_user_set', 'User-set')
       : src === 'staff_set' ? t('eng.ct.lang_src_staff_set', 'Staff-set')
       : src === 'detected'  ? t('eng.ct.lang_src_detected', 'Detected')
       : src === 'unknown' || !src ? t('eng.ct.lang_src_fallback', 'Fallback · EN')
       : src
}

function mapCustomer(c, t) {
  const name = (c.name || '').trim() || t('eng.ct.unnamed', 'Unnamed')
  const code = c.language?.code
  const langInfo = code ? { flag: LANG_MAP[code]?.flag ?? code.toUpperCase(), name: langDisplayName(code, t) } : null
  const src = c.language?.source
  const langSrc = langSrcLabel(src, t)
  const av = SEG_AVATAR[c.segment] || SEG_AVATAR.new
  const cn = c.consent || {}
  const yn = (b) => b ? 'yes' : 'no'
  const spend = Number(c.total_spend || 0)
  const sourceLabels = {
    walkin: t('eng.ct.source_walkin', 'In-store'), csv: t('eng.ct.source_csv', 'CSV Import'),
    mi_italia: t('eng.ct.source_mi', 'Mi Italia'), online: t('eng.ct.source_online', 'Online'),
  }
  return {
    id:           c.id,
    name,
    init:         name.charAt(0).toUpperCase() || '?',
    initBg:       av.bg,
    initColor:    av.color,
    seg:          c.segment || 'new',
    langCode:     code || 'unknown',
    lang:         langInfo ? langInfo.flag : '?',
    langName:     langInfo ? langInfo.name : t('eng.ct.unknown', 'Unknown'),
    langSrc,
    purchases:    c.purchase_count || 0,
    favorites:    c.favorite_count || 0,
    interactions: t('eng.ct.interactions', { purchases: c.purchase_count || 0, favorites: c.favorite_count || 0, defaultValue: '{{purchases}} purchases · {{favorites}} favorites' }),
    ltv:          spend > 0 ? `€${spend.toLocaleString()}` : '—',
    email:        yn(cn.email),
    wa:           yn(cn.whatsapp),
    print:        yn(cn.print),
    src:          sourceLabels[c.source] || c.source || t('eng.ct.unknown', 'Unknown'),
    last:         timeAgo(c.last_visit_at || c.created_at, t),
  }
}


const campaignApi = {
  get:    (id)       => apiFetch(`${API}/boutique/marketing/campaigns/${id}`).then(r => r.json()),
  create: (data)     => apiFetch(`${API}/boutique/marketing/campaigns`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(data),
                        }).then(r => r.json()),
  update: (id, data) => apiFetch(`${API}/boutique/marketing/campaigns/${id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(data),
                        }).then(r => r.json()),
  send: (id) => apiFetch(`${API}/boutique/marketing/campaigns/${id}/send`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({}),
                }).then(r => r.json()),
  delete: (id)       => apiFetch(`${API}/boutique/marketing/campaigns/${id}`, {
                          method: 'DELETE',
                        }).then(r => r.json()),
  getTranslations:    (id)             => apiFetch(`${API}/boutique/marketing/campaigns/${id}/translations`).then(r => r.json()),
  updateTranslation:  (id, lang, data) => apiFetch(`${API}/boutique/marketing/campaigns/${id}/translations/${lang}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(data),
                        }).then(r => r.json()),
}

const templateApi = {
  list:      ()         => apiFetch(`${API}/boutique/email-templates`).then(r => r.json()),
  get:       (id)       => apiFetch(`${API}/boutique/email-templates/${id}`).then(r => r.json()),
  create:    (data)     => apiFetch(`${API}/boutique/email-templates`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data),
                          }).then(r => r.json()),
  update:    (id, data) => apiFetch(`${API}/boutique/email-templates/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data),
                          }).then(r => r.json()),
  translate: (id, lang) => apiFetch(`${API}/boutique/email-templates/${id}/translate`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(lang ? { lang } : {}),
                    }).then(r => r.json()),
  delete:    (id)       => apiFetch(`${API}/boutique/email-templates/${id}`, {
                            method: 'DELETE',
                          }).then(r => r.json()),
  performance:   (id)       => apiFetch(`${API}/boutique/email-templates/${id}/performance`).then(r => r.json()),
  versions:      (id)       => apiFetch(`${API}/boutique/email-templates/${id}/versions`).then(r => r.json()),
  changeRequests: (id)      => apiFetch(`${API}/boutique/email-templates/${id}/change-requests`).then(r => r.json()),
  submitChangeRequest: (id, requestText) => apiFetch(`${API}/boutique/email-templates/${id}/change-requests`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ request_text: requestText }),
                          }).then(r => r.json()),
  variables: () => apiFetch(`${API}/boutique/marketing/template-variables`).then(r => r.json()),
}

const emailSettingsApi = {
  create: (data) => apiFetch(`${API}/boutique/email-settings`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            }).then(r => r.json()),
  update: (data) => apiFetch(`${API}/boutique/email-settings`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            }).then(r => r.json()),
  verify: () => apiFetch(`${API}/boutique/email-settings/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            }).then(r => r.json()),
  refresh: () => apiFetch(`${API}/boutique/email-settings/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            }).then(r => r.json()),
}

const automationApi = {
  list:   ()               => apiFetch(`${API}/boutique/marketing/automations`).then(r => r.json()),
  create: (data)           => apiFetch(`${API}/boutique/marketing/automations`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data),
                              }).then(r => r.json()),
  update: (id, data)       => apiFetch(`${API}/boutique/marketing/automations/${id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data),
                              }).then(r => r.json()),
  toggle: (id, enabled)    => apiFetch(`${API}/boutique/marketing/automations/${id}/toggle`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ enabled }),
                              }).then(r => r.json()),
  delete: (id)              => apiFetch(`${API}/boutique/marketing/automations/${id}`, {
                                method: 'DELETE',
                              }).then(r => r.json()),
}

const favoritesApi = {
  products:      (limit = 50)      => apiFetch(`${API}/boutique/marketing/favorites/products?limit=${limit}`).then(r => r.json()),
  savers:        (productId)       => apiFetch(`${API}/boutique/marketing/favorites/products/${productId}/savers`).then(r => r.json()),
  customer:      (customerId)      => apiFetch(`${API}/boutique/marketing/favorites/customers/${customerId}`).then(r => r.json()),
  notifyRestock: (productId, msg)  => apiFetch(`${API}/boutique/marketing/favorites/products/${productId}/notify-restock`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ message: msg }),
                                      }).then(r => r.json()),
  contacts:      (params)          => apiFetch(`${API}/boutique/marketing/favorites/contacts?${new URLSearchParams(params)}`).then(r => r.json()),
  alertLowStock: (productId)       => apiFetch(`${API}/boutique/marketing/favorites/alert-low-stock`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(productId ? { productId } : {}),
                                      }).then(r => r.json()),
  campaignToSavers: (data)         => apiFetch(`${API}/boutique/marketing/favorites/campaign-to-savers`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(data),
                                      }).then(r => r.json()),
}

const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL ?? ''
function favImgSrc(url) {
  if (!url) return null
  return url.startsWith('http') ? url : `${IMG_BASE}${url}`
}

// Convert "aw25_new_arrivals" → "AW25 New Arrivals"
const templateDisplayName = (key, t) => {
  if (!key) return t('eng.tpl.untitled', 'Untitled template')
  return key.split('_')
    .map(w => /^(aw|ss|fw|sp)\d*$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Pick a sensible emoji from template_key
const templateEmoji = (key) => {
  if (!key) return '📧'
  const k = key.toLowerCase()
  if (/arrival/.test(k))                    return '👗'
  if (/vip/.test(k))                        return '⭐'
  if (/stock|restock/.test(k))              return '📦'
  if (/sale|promo|saldi|discount/.test(k))  return '🎁'
  if (/winback|win[-_]back|lapsed/.test(k)) return '💌'
  if (/event|invite/.test(k))               return '📅'
  return '📧'
}

const channelKey = (ch) =>
  ch === 'wa' || ch === 'whatsapp' ? 'wa' :
  ch === 'print'                   ? 'print' :
                                     'email'


const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

// Converts a "wall clock" datetime-local value (e.g. "2026-09-01T09:00"), interpreted as local
// time IN `timeZone`, into the equivalent UTC ISO instant — needed because a merchant may pick a
// timezone other than their own browser's, and Date() only ever parses in the browser's zone.
const zonedTimeToUtcISO = (localDateTimeStr, timeZone) => {
  if (!localDateTimeStr) return null
  const asIfUTC = new Date(`${localDateTimeStr}:00Z`)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(fmt.formatToParts(asIfUTC).map(x => [x.type, x.value]))
  const asZoned = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute, +p.second)
  const offset = asZoned - asIfUTC.getTime()
  return new Date(asIfUTC.getTime() - offset).toISOString()
}

// Reverse of the above — for pre-filling the datetime-local input when editing a scheduled campaign.
const utcISOToZonedLocal = (isoUTC, timeZone) => {
  if (!isoUTC) return ''
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  const p = Object.fromEntries(fmt.formatToParts(new Date(isoUTC)).map(x => [x.type, x.value]))
  const hour = p.hour === '24' ? '00' : p.hour
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`
}

const TIMEZONE_OPTIONS = [
  'Europe/Rome', 'Europe/London', 'Europe/Paris', 'Europe/Madrid', 'Europe/Berlin',
  'America/New_York', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Asia/Dubai', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'UTC',
]
const realCampaignStats = (c, t) => {
  const fmtPct = (v) => v == null ? '—' : `${Math.round(Number(v))}%`
  const fmtNum = (v) => v == null ? '—' : Number(v).toLocaleString()
  const channel = channelKey(c.channel)

  if (channel === 'wa') return [
    { val:fmtPct(c.open_rate),  lbl:t('eng.camp.stat_read', 'read') },
    { val:fmtPct(c.click_rate), lbl:t('eng.camp.stat_replied', 'replied') },
    { val:fmtNum(c.recipients), lbl:t('eng.camp.stat_recipients', 'recipients') },
  ]
  return [
    { val:fmtPct(c.open_rate),  lbl:t('eng.camp.stat_opened', 'opened') },
    { val:fmtPct(c.click_rate), lbl:t('eng.camp.stat_clicked', 'clicked') },
    { val:fmtNum(c.recipients), lbl:t('eng.camp.stat_recipients', 'recipients') },
  ]
}


function mapApiCampaignCard(c, t) {
  const ch     = channelKey(c.channel)
  const status = c.status
  const statusLabel = c.status === 'sent'      ? t('eng.camp.status_sent', 'Sent')
           : c.status === 'draft'     ? t('eng.camp.status_draft', 'Draft')
           : c.status === 'scheduled' ? t('eng.camp.status_scheduled', 'Scheduled')
           : c.status === 'in_review' ? t('eng.camp.status_in_review', 'In Review')
           : c.status === 'recurring' ? t('eng.camp.status_recurring', 'Recurring')
           : c.status

  const date = c.sent_at      ? formatDate(c.sent_at)
             : c.scheduled_at ? t('eng.camp.date_scheduled', { date: formatDate(c.scheduled_at), defaultValue: 'Scheduled {{date}}' })
             : c.created_at   ? t('eng.camp.date_created', { date: formatDate(c.created_at), defaultValue: 'Created {{date}}' })
             : null

  const seg = c.target_segment
  const segLabels = {
    vip: t('eng.camp.seg_vip', 'VIP'), loyal: t('eng.camp.seg_loyal', 'Loyal'), new: t('eng.camp.seg_new', 'New'),
    warm: t('eng.camp.seg_warm', 'Warm'), lapsed: t('eng.camp.seg_lapsed', 'Lapsed'), all: t('eng.camp.seg_all', 'All contacts'),
  }
  const segs = !seg ? []
             : seg === 'all' ? [{ key:'neutral', label:t('eng.camp.seg_all', 'All contacts') }]
             : [{ key: seg, label: segLabels[seg] || seg }]

  return {
    id:          c.id,
    ch,
    name:        c.campaign_name,
    status,
    statusLabel,
    date,
    segs,
    recipients:  c.recipients ?? 0,
    extra:       null,
    langs:       c.languages ?? [],
    stats: c.status === 'sent' ? realCampaignStats(c, t) : null,
    actions: status === 'draft'
      ? [
          { label:t('common.edit', 'Edit'), cls:'btn-outline', action:'edit' },
          { label:t('eng.camp.action_submit', 'Submit'), cls:'btn-primary', action:'submit' },
          { label:t('common.delete', 'Delete'), cls:'btn-outline btn-red', action:'delete' },
        ]
      : null,
  }
}

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle${on ? ' on' : ''}`} onClick={onToggle}>
      <div className="toggle-knob" />
    </div>
  )
}

function ConsentDot({ channel, state }) {
  const cls  = state === 'yes' ? 'cd-yes' : state === 'pend' ? 'cd-pend' : 'cd-no'
  const icon = channel === 'email' ? 'mail' : channel === 'wa' ? 'chat' : 'description'
  return (
    <div className={`cd cd-${channel} ${cls}`}>
      <span className="material-symbols-outlined">{icon}</span>
    </div>
  )
}

function SegBadge({ seg }) {
  const { t } = useTranslation()
  const map = {
    vip:    { cls:'seg-vip',    icon:'★', label:t('eng.camp.seg_vip', 'VIP') },
    loyal:  { cls:'seg-loyal',  icon:'♻', label:t('eng.camp.seg_loyal', 'Loyal') },
    new:    { cls:'seg-new',    icon:'✦', label:t('eng.camp.seg_new', 'New') },
    warm:   { cls:'seg-warm',   icon:'🔥', label:t('eng.camp.seg_warm', 'Warm') },
    lapsed: { cls:'seg-lapsed', icon:'⏱', label:t('eng.camp.seg_lapsed', 'Lapsed') },
  }
  const s = map[seg] || { cls:'seg-new', icon:'', label:seg }
  return <span className={`seg ${s.cls}`}>{s.icon} {s.label}</span>
}

function ChTag({ ch }) {
  const { t } = useTranslation()
  const map = {
    email: ['ch-email', 'mail',         t('eng.channels.email', 'Email')],
    wa:    ['ch-wa',    'chat',         t('eng.channels.wa', 'WhatsApp')],
    print: ['ch-print', 'description',  t('eng.channels.print', 'Print')],
    insta: ['ch-insta', 'photo_camera', t('eng.channels.insta', 'Instagram')],
  }
  const [cls, icon, label] = map[ch] || ['ch-email', 'mail', ch]
  return (
    <span className={`ch-tag ${cls}`}>
      <span className="ch-tag-icon material-symbols-outlined">{icon}</span>{label}
    </span>
  )
}

function LangBar({ languages }) {
  const colors  = ['var(--gold)', '#1A4FBF', '#DD2A7B', 'var(--stone)', 'var(--green)']
  const entries = Object.entries(languages ?? {})
  const total   = entries.reduce((s, [, v]) => s + v, 0)
  if (!total) return <span className="lang-bar-empty">—</span>
  const top3 = entries.sort((a, b) => b[1] - a[1]).slice(0, 3)
  const rest = total - top3.reduce((s, [, v]) => s + v, 0)
  return (
    <div className="lang-bar-wrap">
      <div className="lang-bar-track">
        {top3.map(([, cnt], i) => (
          <div key={i} className="lang-bar-seg" style={{flex:cnt, background:colors[i]}} />
        ))}
        {rest > 0 && <div className="lang-bar-seg lang-bar-rest" style={{flex:rest}} />}
      </div>
      <div className="lang-bar-labels">
        {top3.map(([lang, cnt], i) => (
          <span key={lang} className="lang-bar-lbl" style={{color:colors[i]}}>
            {i > 0 ? ' ' : ''}{lang.toUpperCase()} {Math.round(cnt / total * 100)}%
          </span>
        ))}
        {rest > 0 && <span className="lang-bar-rest-lbl"> +{entries.length - top3.length}</span>}
      </div>
    </div>
  )
}

function ChBar({ icon, iconColor, label, val, pct, barColor, soon }) {
  const { t } = useTranslation()
  return (
    <div className={`eng-ch-item${soon ? ' eng-ch-soon' : ''}`}>
      <div className="eng-ch-header">
        <span className="eng-ch-label">
          <span className="material-symbols-outlined eng-ch-icon" style={{color:iconColor}}>{icon}</span>
          {label}
          {soon && <span className="eng-soon-tag">{t('eng.camp.soon_tag', 'SOON')}</span>}
        </span>
        <span className={`eng-ch-val${soon ? ' eng-ch-val-muted' : ''}`}>{val}</span>
      </div>
      <div className="eng-ch-bar-wrap">
        <div className="eng-ch-bar" style={{width:`${pct}%`, background:barColor}} />
      </div>
    </div>
  )
}

// ── OVERVIEW ─────────────────────────────────────────────
function OverviewView({ segments, dashboard, campaigns, onNewCampaign, onManageContacts, onManageAutomations, onViewAllCampaigns}) {
  const { t } = useTranslation()
  const [automations, setAutomations] = useState([])
  useEffect(() => {
    automationApi.list().then(res => { if (res?.success) setAutomations(res.data?.automations ?? []) }).catch(() => {})
  }, [])
  const [ovKpis, setOvKpis] = useState([])
  useEffect(() => {
    apiFetch(`${API}/boutique/marketing/analytics?range=30d&compare=previous_period`)
      .then(r => r.json())
      .then(res => { if (res?.success) setOvKpis(res.data?.kpis ?? []) })
      .catch(() => {})
  }, [])
  const ovDelta = (key) => ovKpis.find(k => k.key === key)?.delta_pct
  const segsArr = Array.isArray(segments) ? segments : []
  const total   = segsArr.reduce((s, sg) => s + (sg.customers ?? 0), 0)
  const emailR  = dashboard?.email_reach  ?? '—'
  const waR     = dashboard?.wa_reach     ?? '—'
  const printR  = dashboard?.print_reach  ?? '—'
  const revenue = dashboard?.revenue ?? '—'

  const chPerf = (ch) => (dashboard?.channel_performance ?? []).find(c => c.channel === ch)
  const chPct  = (ch, field) => { const c = chPerf(ch); return c ? Number(c[field]) : null }
  const chVal  = (ch, field, suffix = '%') => { const v = chPct(ch, field); return v == null ? '—' : `${v}${suffix}` }

  const activityDot = (kind) =>
    kind === 'campaign_sent' ? 'var(--gold)' : kind === 'contact_added' ? 'var(--green)' : 'var(--stone)'
  const activityAction = (kind) =>
    kind === 'campaign_sent' ? t('eng.ov.activity_campaign_sent', 'campaign sent')
    : kind === 'contact_added' ? t('eng.ov.activity_contact_added', 'added as a new contact')
    : kind.replace(/_/g, ' ')
  const liveActivity = dashboard?.activity_feed ?? []

  const autoRunning = automations.slice(0, 3).map(a => {
    const ic = automationIcon(a.trigger_type)
    return { icon: ic.icon, iconColor: ic.color, name: a.name, sent: null, status: a.enabled ? 'on' : 'paused' }
  })
  const segLabels = {
    vip: t('eng.camp.seg_vip', 'VIP'), loyal: t('eng.camp.seg_loyal', 'Loyal'), new: t('eng.camp.seg_new', 'New'),
    warm: t('eng.camp.seg_warm', 'Warm'), lapsed: t('eng.camp.seg_lapsed', 'Lapsed'), all: t('eng.camp.seg_all', 'All contacts'),
  }
  const campList = (Array.isArray(campaigns) ? campaigns : []).slice(0, 3).map(c => ({
    campaign_name: c.campaign_name,
    channel:       channelKey(c.channel),
    status:        c.status,
    date:          c.sent_at ? formatDate(c.sent_at) : c.scheduled_at ? t('eng.camp.date_scheduled', { date: formatDate(c.scheduled_at), defaultValue: 'Scheduled {{date}}' }) : c.created_at ? t('eng.camp.date_created', { date: formatDate(c.created_at), defaultValue: 'Created {{date}}' }) : null,
    seg:           c.target_segment ? (segLabels[c.target_segment] || c.target_segment) : null,
    sent:          0,
    langs:         [],
    extra:         null,
  }))
  return (
    <div>
      <div className="alert alert-gdpr mkt-gdpr-alert">
        <span className="material-symbols-outlined">gpp_good</span>
        <div><strong>{t('eng.ov.gdpr_title', 'GDPR Compliant.')}</strong> {t('eng.ov.gdpr_body', 'Mi Italia manages per-channel consent for every customer. You can only reach customers who have explicitly opted in for each channel. Consent records are stored and auditable.')}</div>
      </div>

      {/* KPI Row */}
      <div className="stat-row col5">
        <div className="stat-card">
          <div className="stat-lbl">{t('eng.ov.total_contacts', 'Total Contacts')}</div>
          <div className="stat-val">{total || '—'}</div>
          {ovDelta('new_contacts') != null && (
            <div className={`stat-change ${ovDelta('new_contacts') < 0 ? 'down' : 'up'}`}>
              {ovDelta('new_contacts') >= 0 ? '↑ +' : '↓ '}{ovDelta('new_contacts')}% {t('eng.ov.vs_last_30d', 'vs prior 30 days')}
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-email">mail</span>{t('eng.ov.email_reach', 'Email Reach')}
          </div>
          <div className="stat-val">{emailR}</div>
          <div className="stat-sub">{t('eng.ov.email_sub_real', { rate: chVal('email', 'open_rate'), defaultValue: 'Avg open {{rate}}' })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-wa">chat</span>{t('eng.ov.wa_reach', 'WhatsApp Reach')}
          </div>
          <div className="stat-val">{waR}</div>
          <div className="stat-sub">{t('eng.ov.wa_sub_real', { rate: chVal('wa', 'open_rate'), defaultValue: 'Avg read {{rate}}' })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-print">description</span>{t('eng.ov.print_insert', 'Printed insert')}
          </div>
          <div className="stat-val">{printR}</div>
          <div className="stat-sub">{t('eng.ov.print_sub_real', { rate: chVal('print', 'click_rate'), defaultValue: 'QR scan rate {{rate}}' })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('eng.ov.revenue_attr', 'Revenue Attributed')}</div>
          <div className="stat-val">{revenue !== '—' ? `€${revenue}` : '—'}</div>
          {ovDelta('attributed_revenue') != null && (
            <div className={`stat-change ${ovDelta('attributed_revenue') < 0 ? 'down' : 'up'}`}>
              {ovDelta('attributed_revenue') >= 0 ? '↑ +' : '↓ '}{ovDelta('attributed_revenue')}% {t('eng.ov.vs_last_30d', 'vs prior 30 days')}
            </div>
          )}
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid2 mkt-row2">
        <div className="card card-flush">
          <div className="card-hdr">
            <div className="card-title">{t('eng.ov.ch_perf', 'Channel')} <em>{t('eng.ov.ch_perf_em', 'Performance')}</em></div>
            <select className="mkt-period-select">
              <option>{t('eng.ov.last_30d', 'Last 30 days')}</option><option>{t('eng.ov.last_90d', 'Last 90 days')}</option>
            </select>
          </div>
          <div className="eng-section-lbl">{t('eng.ov.open_read', 'Open / Read Rate')}</div>
          <div className="eng-ch-row mkt-ch-block">
            <ChBar icon="mail"         iconColor="var(--gold-dk)" label={t('eng.ov.ch_email', 'Email')}          val={chVal('email', 'open_rate')}   pct={chPct('email', 'open_rate') ?? 0}  barColor="var(--gold)"  />
            <ChBar icon="chat"         iconColor="#1a9e4d"        label={t('eng.ov.ch_whatsapp', 'WhatsApp')}       val={chVal('wa', 'open_rate')}      pct={chPct('wa', 'open_rate') ?? 0}     barColor="var(--wa)"    />
            <ChBar icon="photo_camera" iconColor="#DD2A7B"        label={t('eng.ov.ch_instagram_dm', 'Instagram DM')}   val="—"        pct={0}  barColor="transparent"  soon />
            <ChBar icon="description"  iconColor="var(--stone)"   label={t('eng.ov.print_insert', 'Printed insert')} val={chVal('print', 'open_rate')}   pct={chPct('print', 'open_rate') ?? 0}  barColor="var(--stone)" />
          </div>
          <div className="eng-section-lbl">{t('eng.ov.click_reply', 'Click-through / Reply Rate')}</div>
          <div className="eng-ch-row">
            <ChBar icon="mail"         iconColor="var(--gold-dk)" label={t('eng.ov.ch_email_click', 'Email click')}     val={chVal('email', 'click_rate')} pct={chPct('email', 'click_rate') ?? 0} barColor="var(--gold)"  />
            <ChBar icon="chat"         iconColor="#1a9e4d"        label={t('eng.ov.ch_whatsapp_reply', 'WhatsApp reply')}  val={chVal('wa', 'click_rate')}    pct={chPct('wa', 'click_rate') ?? 0}    barColor="var(--wa)"    />
            <ChBar icon="photo_camera" iconColor="#DD2A7B"        label={t('eng.ov.ch_instagram_reply', 'Instagram reply')} val="—"   pct={0}  barColor="transparent"  soon />
            <ChBar icon="description"  iconColor="var(--stone)"   label={t('eng.ov.ch_print_qr', 'Print QR scan')}   val={chVal('print', 'click_rate')} pct={chPct('print', 'click_rate') ?? 0} barColor="var(--stone)" />
          </div>
        </div>

        <div className="card card-flush">
          <div className="card-hdr">
            <div className="card-title">{t('eng.ov.seg_health', 'Segment')} <em>{t('eng.ov.seg_health_em', 'Health')}</em></div>
            <button className="card-action" onClick={onManageContacts}>{t('eng.ov.manage', '→ Manage')}</button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('eng.ov.col_seg', 'Segment')}</th><th>{t('eng.ov.col_contacts', 'Contacts')}</th><th>{t('eng.ov.col_engaged', 'Engaged')}</th><th>{t('eng.ov.col_langs', 'Languages')}</th><th>{t('eng.ov.col_last_camp', 'Last Campaign')}</th><th></th>
              </tr>
            </thead>
            <tbody>
              {segsArr.map((s) => {
                const engPct   = s.engagedPct ?? 0
                const engCls   = engPct >= 70 ? 'eng-pct-green' : engPct >= 40 ? 'eng-pct-gold' : 'eng-pct-red'
                return (
                  <tr key={s.key}>
                    <td><SegBadge seg={s.key} /></td>
                    <td className="tbl-num-bold">{s.customers ?? 0}</td>
                    <td className={engCls}>{engPct}%</td>
                    <td><LangBar languages={s.languages} /></td>
                    <td className="tbl-meta">{s.lastCampaign ? `${s.lastCampaign.name}${s.lastCampaign.sentAt ? ` · ${formatDate(s.lastCampaign.sentAt)}` : ''}` : '—'}</td>
                    <td>
                      <button
                        className={`btn btn-xs ${s.key === 'lapsed' ? 'btn-red' : 'btn-outline'}`}
                        onClick={() => onNewCampaign(s.key)}
                      >
                        {s.key === 'lapsed' ? t('eng.ov.reengage', 'Re-engage') : t('eng.ov.send', 'Send')}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {segsArr.length === 0 && (
                <tr><td colSpan={6} className="empty">{t('eng.ov.no_segments', 'No segments yet')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3 */}
      <div className="grid2">
        <div className="card card-flush">
          <div className="card-hdr">
            <div className="card-title">{t('eng.ov.recent_camp', 'Recent')} <em>{t('eng.ov.recent_camp_em', 'Campaigns')}</em></div>
            <button className="card-action" onClick={onViewAllCampaigns}>{t('eng.ov.all_campaigns', '→ All campaigns')}</button>
          </div>
          {campList.length === 0 && <div className="eng-loading">{t('eng.ov.no_campaigns', 'No campaigns yet.')}</div>}
          {campList.map((c, i) => (
            <div key={i} className="rc-item">
              <div className={`rc-icon ${c.channel}`}>
                <span className="material-symbols-outlined">{c.channel === 'wa' ? 'chat' : 'mail'}</span>
              </div>
              <div className="rc-body">
                <div className="rc-name">{c.campaign_name}</div>
                <div className="rc-meta">
                  <span className={`status ${c.status}`}>{c.status}</span>
                  {c.date && <span className="rc-meta-txt">{c.date}</span>}
                  {c.seg  && <span className="rc-meta-txt rc-meta-seg">{c.seg}</span>}
                  {c.sent > 0 && <span className="rc-meta-txt">{t('eng.ov.sent_count', { count: c.sent, defaultValue: '{{count}} sent' })}</span>}
                  {(c.langs ?? []).map(l => (
                    <span key={l} className={`rc-lang-tag${l !== 'IT' ? ' rc-lang-en' : ''}`}>{l}</span>
                  ))}
                  {c.extra && <span className="rc-meta-txt">{c.extra}</span>}
                </div>
              </div>
              {(c.open || c.metric || c.clicked) && (
                <div className="rc-stats">
                  <div className="rc-stat">
                    <div className="rc-stat-val">{c.open}</div>
                    <div className="rc-stat-lbl">{c.channel === 'wa' ? t('eng.ov.stat_read', 'READ') : t('eng.ov.stat_opened', 'OPENED')}</div>
                  </div>
                  <div className="rc-stat">
                    <div className="rc-stat-val">{c.metric ?? c.clicked}</div>
                    <div className="rc-stat-lbl">{c.metricLbl ?? t('eng.ov.stat_clicked', 'CLICKED')}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="overview-right-col">
          <div className="card card-flush">
            <div className="card-hdr">
              <div className="card-title">{t('eng.ov.live_activity', 'Live')} <em>{t('eng.ov.live_activity_em', 'Activity')}</em></div>
            </div>
            {liveActivity.length === 0 && <div className="eng-loading">{t('eng.ov.no_activity', 'No recent activity.')}</div>}
            {liveActivity.map((a, i) => (
              <div key={i} className="live-act-item">
                <div className="live-act-dot" style={{background:activityDot(a.kind)}} />
                <div>
                  <div className="live-act-text">
                    <strong>{a.label}</strong>
                    <span className="live-act-action"> {activityAction(a.kind)}</span>
                  </div>
                  <div className="live-act-meta">{timeAgo(a.occurred_at, t)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card card-flush">
            <div className="card-hdr">
              <div className="card-title">{t('eng.ov.auto_running', 'Automations')} <em>{t('eng.ov.auto_running_em', 'Running')}</em></div>
              <span className="material-symbols-outlined auto-running-fwd" onClick={onManageAutomations}>arrow_forward</span>
            </div>
            {autoRunning.length === 0 && <div className="eng-loading">{t('eng.auto.empty', 'No automations yet — create one to get started.')}</div>}
            {autoRunning.map((a, i) => (
              <div key={i} className="auto-running-row">
                <span className="material-symbols-outlined auto-running-icon" style={{color:a.iconColor}}>{a.icon}</span>
                <span className="auto-running-name">{a.name}</span>
                {a.sent && <span className="auto-running-sent">{a.sent}</span>}
                <span className={`auto-running-badge ${a.status}`}>{a.status === 'on' ? t('eng.auto.on', 'On') : t('eng.auto.paused_label', 'Paused')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CONTACTS ─────────────────────────────────────────────
function ContactsView({ onContactsChanged, segments }) {
  const { t, i18n } = useTranslation()
  const [contacts,       setContacts]       = useState([])
  const [loadingList,    setLoadingList]    = useState(true)
  const [showImport,     setShowImport]     = useState(false)
  const [importFile,     setImportFile]     = useState(null)
  const [importDragOver, setImportDragOver] = useState(false)
  const [importing,      setImporting]      = useState(false)
  const [importResult,   setImportResult]   = useState(null)
  const [importError,    setImportError]    = useState('')
  const importInputRef = useRef(null)
  const [showAddContact, setShowAddContact] = useState(false)
  const [showPanel,      setShowPanel]      = useState(false)
  const [panelContact,   setPanelContact]   = useState(null)
  const [panelDetail,    setPanelDetail]    = useState(null)
  const [panelLoading,   setPanelLoading]   = useState(false)
  const [panelFavorites,        setPanelFavorites]        = useState([])
  const [panelFavoritesLoading, setPanelFavoritesLoading] = useState(false)
  const [panelFavoritesError,   setPanelFavoritesError]   = useState('')
  const [langEditing,   setLangEditing]   = useState(false)
  const [langCode,      setLangCode]      = useState('')
  const [langSaving,    setLangSaving]    = useState(false)
  const [langSaveError, setLangSaveError] = useState('')
  const [addFirst, setAddFirst]     = useState('')
  const [addLast, setAddLast]       = useState('')
  const [addEmail, setAddEmail]     = useState('')
  const [addPhone, setAddPhone]     = useState('')
  const [addSegment, setAddSegment] = useState('new')
  const [addNotes, setAddNotes]     = useState('')
  const [addError, setAddError]     = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [segFilter,   setSegFilter]   = useState(null)
  const [langFilter,  setLangFilter]  = useState(null)
  const [page,        setPage]        = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [total,       setTotal]       = useState(0)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkNote,    setBulkNote]    = useState('')
  const [bulkBusy,    setBulkBusy]    = useState(false)
  const [bulkSegment, setBulkSegment] = useState('')
  const [showBulkMessage, setShowBulkMessage] = useState(false)
  const [bulkMsgSubject,  setBulkMsgSubject]  = useState('')
  const [bulkMsgBody,     setBulkMsgBody]     = useState('')
  const [bulkMsgResult,   setBulkMsgResult]   = useState(null)
  const [messageContactIds, setMessageContactIds] = useState([])

  const langOptions = Array.from(new Map(contacts.map(c => [c.langCode, c.langName])).entries())

  const filteredContacts = contacts // filtering now happens server-side

  const allFilteredSelected = filteredContacts.length > 0 && filteredContacts.every(c => selectedIds.has(c.id))
  function toggleSelectAll() {
    setSelectedIds(allFilteredSelected ? new Set() : new Set(filteredContacts.map(c => c.id)))
  }
  function toggleSelectOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const CONTACTS_PAGE_SIZE = 20
  const refetchContacts = (targetPage = page) => {
    setLoadingList(true)
    const params = new URLSearchParams({ page: String(targetPage), limit: String(CONTACTS_PAGE_SIZE) })
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
    if (segFilter) params.set('segment', segFilter)
    if (langFilter) params.set('language', langFilter)
    apiFetch(`${API}/boutique/customers?${params.toString()}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const list = res.data?.customers ?? []
          setContacts(list.map(c => mapCustomer(c, t)))
          setPage(targetPage)
          const pg = res.data?.pagination
          setHasNextPage(pg ? !!pg.has_more : list.length === CONTACTS_PAGE_SIZE)
          setTotal(pg?.total ?? list.length)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }
  const goToPage = (targetPage) => {
    if (targetPage < 1 || loadingList) return
    setSelectedIds(new Set())
    refetchContacts(targetPage)
  }

  const bulkAction = (action, extra = {}) =>
    apiFetch(`${API}/boutique/marketing/contacts/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, contact_ids: Array.from(selectedIds), ...extra }),
    }).then(r => r.json())

  const handleBulkAddToSegment = (segment) => {
    if (!segment) return
    setBulkBusy(true)
    bulkAction('add_to_segment', { segment })
      .then(res => {
        setBulkNote(res?.message || (res?.success ? t('eng.ct.bulk_segment_done', 'Contacts updated.') : t('eng.ct.bulk_failed', 'Bulk action failed.')))
        if (res?.success)  { refetchContacts(); onContactsChanged?.() }
      })
      .catch(() => setBulkNote(t('eng.ct.err_network', 'Network error')))
      .finally(() => { setBulkBusy(false); setBulkSegment(''); setTimeout(() => setBulkNote(''), 4000) })
  }

  const handleBulkExport = () => {
    setBulkBusy(true)
    bulkAction('export')
      .then(res => {
        if (res?.success) {
          const rows = res.data?.contacts ?? []
          const headers = ['name', 'email', 'phone', 'source', 'assigned_segment', 'boutique_total_spend', 'boutique_visit_count', 'boutique_last_visit_at', 'created_at']
          const csv = [headers.join(',')]
            .concat(rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')))
            .join('\n')
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)
          setBulkNote(res.message || t('eng.ct.bulk_export_done', 'Export downloaded.'))
        } else {
          setBulkNote(res?.message || t('eng.ct.bulk_failed', 'Bulk action failed.'))
        }
      })
      .catch(() => setBulkNote(t('eng.ct.err_network', 'Network error')))
      .finally(() => { setBulkBusy(false); setTimeout(() => setBulkNote(''), 4000) })
  }

  const sendMessage = (ids, extra = {}) =>
    apiFetch(`${API}/boutique/marketing/contacts/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'message', contact_ids: ids, ...extra }),
    }).then(r => r.json())

  const handleBulkMessage = () => {
    if (!bulkMsgBody.trim()) return
    setBulkBusy(true)
    sendMessage(messageContactIds, { subject: bulkMsgSubject, message: bulkMsgBody })
      .then(res => {
        if (res?.success) setBulkMsgResult(res.data)
        else setBulkNote(res?.message || t('eng.ct.bulk_failed', 'Bulk action failed.'))
      })
      .catch(() => setBulkNote(t('eng.ct.err_network', 'Network error')))
      .finally(() => setBulkBusy(false))
  }

  const closeImportModal = () => {
    setShowImport(false); setImportFile(null); setImportResult(null); setImportError(''); setImportDragOver(false)
  }

  const pickImportFile = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) { setImportError(t('eng.ct.err_csv_only', 'Please choose a .csv file.')); return }
    setImportError(''); setImportResult(null); setImportFile(file)
  }

  const handleImportSubmit = () => {
    if (!importFile) return
    setImporting(true); setImportError(''); setImportResult(null)
    const formData = new FormData()
    formData.append('file', importFile)
    apiFetch(`${API}/boutique/marketing/contacts/import`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(res => {
        if (res?.success) { setImportResult(res.data); refetchContacts(); onContactsChanged?.() }
        else setImportError(res?.message || t('eng.ct.err_import_failed', 'Import failed.'))
      })
      .catch(() => setImportError(t('eng.ct.err_network', 'Network error')))
      .finally(() => setImporting(false))
  }

  function handleAddContact() {
    if (!addFirst.trim() || !addEmail.trim()) { setAddError(t('eng.ct.err_required', 'First name and email are required')); return }
    setAddError('')
    apiFetch(`${API}/boutique/marketing/contacts`, {
      method: 'POST',
      body: JSON.stringify({ firstName: addFirst, lastName: addLast, email: addEmail, phone: addPhone || undefined, segment: addSegment, notes: addNotes || undefined })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        setShowAddContact(false); setAddFirst(''); setAddLast(''); setAddEmail(''); setAddPhone(''); setAddSegment('new'); setAddNotes(''); setAddError('')
        refetchContacts(); onContactsChanged?.()
      } else setAddError(res.message ?? t('eng.ct.err_add_failed', 'Failed to add contact'))
    }).catch(() => setAddError(t('eng.ct.err_network', 'Network error')))
  }

  const openLangEditor = () => {
    setLangCode(panelDetail?.language?.code || '')
    setLangSaveError('')
    setLangEditing(true)
  }

  const saveLangChange = () => {
    if (!panelContact?.id) return
    setLangSaving(true)
    setLangSaveError('')
    apiFetch(`${API}/boutique/customers/${panelContact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: langCode ? { code: langCode, source: 'staff_set' } : null }),
    }).then(r => r.json()).then(res => {
      if (res?.success) {
        const lang = res.data?.language ?? { code: null, source: 'unknown' }
        const langInfo = lang.code ? { flag: LANG_MAP[lang.code]?.flag ?? lang.code.toUpperCase(), name: langDisplayName(lang.code, t) } : null
        setPanelContact(prev => prev && ({
          ...prev,
          lang:     langInfo ? langInfo.flag : '?',
          langName: langInfo ? langInfo.name : t('eng.ct.unknown', 'Unknown'),
          langSrc:  langSrcLabel(lang.source, t),
        }))
        setPanelDetail(prev => prev && ({ ...prev, language: lang }))
        setLangEditing(false)
        refetchContacts()
      } else {
        setLangSaveError(res?.message || t('eng.ct.err_lang_save', 'Failed to update language.'))
      }
    }).catch(() => setLangSaveError(t('eng.ct.err_network', 'Network error')))
      .finally(() => setLangSaving(false))
  }

  // Fetch contact list on mount, language change, or segment/language filter change
  useEffect(() => {
    refetchContacts(1)
  }, [i18n.language, segFilter, langFilter])

  // Search is debounced so we don't fire a request on every keystroke
  const isFirstSearch = useRef(true)
  useEffect(() => {
    if (isFirstSearch.current) { isFirstSearch.current = false; return }
    const timer = setTimeout(() => refetchContacts(1), 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch full profile whenever the panel opens
  useEffect(() => {
    setLangEditing(false); setLangSaveError('')
    if (!showPanel || !panelContact?.id) { setPanelDetail(null); return }
    setPanelLoading(true)
    apiFetch(`${API}/boutique/customers/${panelContact.id}`)
      .then(r => r.json())
      .then(res => { if (res.success) setPanelDetail(res.data) })
      .catch(() => {})
      .finally(() => setPanelLoading(false))
  }, [showPanel, panelContact?.id, i18n.language])

  // Fetch this customer's saved products whenever the panel opens
  useEffect(() => {
    setPanelFavoritesError('')
    if (!showPanel || !panelContact?.id) { setPanelFavorites([]); return }
    setPanelFavoritesLoading(true)
    favoritesApi.customer(panelContact.id)
      .then(res => {
        if (res?.success) setPanelFavorites(res.data?.favorites ?? [])
        else setPanelFavoritesError(res?.message || t('eng.ct.err_favorites', 'Failed to load saved items.'))
      })
      .catch(() => setPanelFavoritesError(t('eng.ct.err_network', 'Network error')))
      .finally(() => setPanelFavoritesLoading(false))
  }, [showPanel, panelContact?.id])

  return (
    <div>
      <div className="ct-toolbar">
        <div className="ct-search">
          <span className="material-symbols-outlined">search</span>
          <input placeholder={t('eng.ct.search', 'Search contacts…')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="ct-seg-filters">
          {[
            { key:'vip',    cls:'seg-vip',    icon:'⭐', label:t('eng.camp.seg_vip', 'VIP') },
            { key:'loyal',  cls:'seg-loyal',  icon:'♻', label:t('eng.camp.seg_loyal', 'Loyal') },
            { key:'new',    cls:'seg-new',    icon:'✦', label:t('eng.camp.seg_new', 'New') },
            { key:'warm',   cls:'seg-warm',   icon:'🔥', label:t('eng.camp.seg_warm', 'Warm') },
            { key:'lapsed', cls:'seg-lapsed', icon:'⏱', label:t('eng.camp.seg_lapsed', 'Lapsed') },
          ].map(s => (
            <span key={s.key} className={`seg ${s.cls} ct-seg-btn`}
              style={{ cursor:'pointer', boxShadow: segFilter === s.key ? 'inset 0 0 0 1.5px var(--deep)' : 'none' }}
              onClick={() => setSegFilter(prev => prev === s.key ? null : s.key)}>
              {s.icon} {s.label} ({(segments ?? []).find(sg => sg.key === s.key)?.customers ?? 0})
            </span>
          ))}
          <span className="ct-lang-btn" style={{ display:'inline-flex', alignItems:'center' }}>
            <span className="material-symbols-outlined ct-lang-icon">translate</span>
            <select value={langFilter || ''} onChange={e => setLangFilter(e.target.value || null)}
              style={{ border:'none', background:'transparent', font:'inherit', color:'inherit', cursor:'pointer', outline:'none' }}>
              <option value="">{t('eng.ct.language', 'Language')}</option>
              {langOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
            <span className="material-symbols-outlined ct-lang-chevron">expand_more</span>
          </span>
        </div>
        <div className="ct-toolbar-right">
          <button className="btn btn-outline btn-sm" onClick={() => setShowImport(true)}>
            <span className="material-symbols-outlined">upload</span>{t('eng.ct.import_csv', 'Import CSV')}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowAddContact(true)}>
            <span className="material-symbols-outlined">person_add</span>{t('eng.ct.add_contact', 'Add Contact')}
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="alert alert-warn" style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12, flexWrap:'wrap' }}>
          <span>{t('eng.ct.selected_count', { count: selectedIds.size, defaultValue: '{{count}} selected' })}</span>
          <div className="select-wrap" style={{ width:'auto' }}>
            <select className="form-select" value={bulkSegment} disabled={bulkBusy}
              onChange={e => { setBulkSegment(e.target.value); handleBulkAddToSegment(e.target.value) }}>
              <option value="">{t('eng.ct.bulk_add_segment', 'Add to segment')}</option>
              <option value="vip">⭐ {t('eng.camp.seg_vip', 'VIP')}</option>
              <option value="loyal">♻ {t('eng.camp.seg_loyal', 'Loyal')}</option>
              <option value="new">✦ {t('eng.camp.seg_new', 'New')}</option>
              <option value="warm">🔥 {t('eng.camp.seg_warm', 'Warm')}</option>
              <option value="lapsed">⏱ {t('eng.camp.seg_lapsed', 'Lapsed')}</option>
            </select>
          </div>
          <button className="btn btn-outline btn-xs" disabled={bulkBusy} onClick={handleBulkExport}>{t('common.export', 'Export')}</button>
          <button className="btn btn-outline btn-xs" disabled={bulkBusy} onClick={() => { setMessageContactIds(Array.from(selectedIds)); setBulkMsgResult(null); setShowBulkMessage(true) }}>{t('eng.ct.message', 'Message')}</button>
          <button className="btn btn-outline btn-xs" onClick={() => setSelectedIds(new Set())}>{t('common.clear', 'Clear')}</button>
        </div>
      )}
      {bulkNote && <div className="alert alert-warn" style={{ marginBottom:12 }}>{bulkNote}</div>}

      <div className="card ct-table-card">
        <table className="tbl">
          <thead>
            <tr>
              <th className="tbl-cb-col"><input type="checkbox" className="tbl-cb" checked={allFilteredSelected} onChange={toggleSelectAll} /></th>
              <th>{t('eng.ct.col_contact', 'Contact')}</th><th>{t('eng.ov.col_seg', 'Segment')}</th><th>{t('eng.ct.language', 'Language')}</th><th>{t('eng.ct.col_interactions', 'Interactions')}</th><th>{t('eng.ct.col_ltv', 'LTV')}</th><th>{t('eng.ct.col_consent', 'Consent')}</th><th>{t('eng.ct.col_source', 'Source')}</th><th>{t('eng.ct.col_last', 'Last Seen')}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.length === 0 && !loadingList && (
              <tr><td colSpan={10} className="eng-loading">{t('eng.ct.no_match_filters', 'No contacts match your filters.')}</td></tr>
            )}
            {filteredContacts.map((c, i) => (
              <tr key={i}>
                <td><input type="checkbox" className="tbl-cb" checked={selectedIds.has(c.id)} onChange={() => toggleSelectOne(c.id)} /></td>
                <td>
                  <div className="ct-contact-cell" onClick={() => { setPanelContact(c); setShowPanel(true) }}>
                    <div className="ct-av" style={{background:c.initBg, color:c.initColor}}>{c.init}</div>
                    <div>
                      <div className="ct-name">{c.name}</div>
                      {(() => {
                        const optedCount = [c.email, c.wa, c.print].filter(v => v === 'yes').length
                        return (
                          <div className={`ct-consent-sub ${optedCount === 0 ? 'pend' : 'ok'}`}>
                            {optedCount === 0
                              ? t('eng.ct.optin_pending', 'Opt-in request pending')
                              : t('eng.ct.channels_opted', { count: optedCount, total: 3, defaultValue: '{{count}} of {{total}} channels opted in' })}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </td>
                <td><SegBadge seg={c.seg} /></td>
                <td>
                  <div className="ct-lang-wrap">
                    {c.lang === '?' && <span className="material-symbols-outlined ct-unknown-icon">help_outline</span>}
                    {c.lang === 'EN' && <span className="ct-en-badge">EN</span>}
                    {c.lang !== '?' && c.lang !== 'EN' && <span className="ct-flag">{c.lang}</span>}
                    <div>
                      <div className={`ct-lang-name${c.lang === '?' ? ' unknown' : ''}`}>{c.langName}</div>
                      <div className="ct-lang-src">{c.langSrc}</div>
                    </div>
                  </div>
                </td>
                <td className="tbl-sm">{c.interactions}</td>
                <td><strong>{c.ltv}</strong></td>
                <td>
                  <div className="cd-row">
                    <ConsentDot channel="email" state={c.email} />
                    <ConsentDot channel="wa"    state={c.wa} />
                    <ConsentDot channel="print" state={c.print} />
                  </div>
                </td>
                <td className="tbl-meta">{c.src}</td>
                <td className="tbl-meta">{c.last}</td>
                <td>
                  {[c.email, c.wa, c.print].filter(v => v === 'yes').length === 0
                    ? <button className="btn btn-outline btn-xs" disabled>{t('common.pending', 'Pending')}</button>
                    : c.seg === 'lapsed'
                    ? <button className="btn btn-primary btn-xs" onClick={() => {
                        setMessageContactIds([c.id])
                        setBulkMsgSubject(t('eng.ct.reengage_subject', 'We miss you, {{name}}!', { name: c.name?.split(' ')[0] || '' }))
                        setBulkMsgBody(t('eng.ct.reengage_body', "It's been a while — come see what's new at Mi Italia. We'd love to have you back!"))
                        setBulkMsgResult(null)
                        setShowBulkMessage(true)
                      }}>{t('eng.ov.reengage', 'Re-engage')}</button>
                    : <button className="btn btn-outline btn-xs" onClick={() => { setMessageContactIds([c.id]); setBulkMsgSubject(''); setBulkMsgBody(''); setBulkMsgResult(null); setShowBulkMessage(true) }}>{t('eng.ct.message', 'Message')}</button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ct-table-footer">
          <span>{t('eng.ct.showing_loaded', { shown: filteredContacts.length, total, defaultValue: 'Showing {{shown}} of {{total}} contacts' })}</span>
          <div className="ct-footer-btns">
            <button className="btn btn-outline btn-xs" disabled={page <= 1 || loadingList} onClick={() => goToPage(page - 1)}>{t('eng.ct.prev', '← Prev')}</button>
            <span>{t('eng.ct.page_n', { page, defaultValue: 'Page {{page}}' })}</span>
            <button className="btn btn-outline btn-xs" disabled={!hasNextPage || loadingList} onClick={() => goToPage(page + 1)}>{t('eng.ct.next', 'Next →')}</button>
          </div>
        </div>
      </div>
      {/* Import CSV Modal */}
      {showImport && (
        <div className="modal-backdrop">
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('eng.ct.import_title', 'Import')} <em>{t('eng.ct.import_title_em', 'Contacts')}</em></div>
              <div className="modal-close" onClick={closeImportModal}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>
            {importResult ? (
              <>
                <div className="eng-success">
                  {t('eng.ct.import_result', {
                    imported: importResult.imported ?? 0, merged: importResult.merged_duplicates ?? 0,
                    pending: importResult.pending_consent ?? 0, skipped: importResult.skipped ?? 0,
                    defaultValue: 'Imported {{imported}} · merged {{merged}} duplicate(s) · {{pending}} pending consent · {{skipped}} skipped',
                  })}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={closeImportModal}>{t('common.done', 'Done')}</button>
                </div>
              </>
            ) : (
              <>
                {importError && <div className="eng-error">{importError}</div>}
                <input ref={importInputRef} type="file" accept=".csv" style={{ display:'none' }}
                  onChange={e => pickImportFile(e.target.files?.[0])} />
                <div className={`ct-drop-zone${importDragOver ? ' ct-drop-zone-over' : ''}`}
                  style={{ cursor:'pointer' }}
                  onClick={() => importInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setImportDragOver(true) }}
                  onDragLeave={() => setImportDragOver(false)}
                  onDrop={e => { e.preventDefault(); setImportDragOver(false); pickImportFile(e.dataTransfer.files?.[0]) }}>
                  <span className="material-symbols-outlined ct-drop-icon">upload_file</span>
                  <div className="ct-drop-title">
                    {importFile ? importFile.name : t('eng.ct.drop_title', 'Drop your CSV here or click to browse')}
                  </div>
                  <div className="ct-drop-sub">{t('eng.ct.drop_sub', 'Required columns: First Name, Last Name, Email. Optional: Phone, Segment')}</div>
                </div>
                <div className="alert-gdpr-blue">
                  <span className="material-symbols-outlined">verified_user</span>
                  <div dangerouslySetInnerHTML={{ __html: t('eng.ct.import_note', 'Imported contacts are added in <strong>pending consent</strong> status. They cannot be messaged until they opt in. Duplicate emails are automatically merged with existing contacts.') }} />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={closeImportModal} disabled={importing}>{t('common.cancel', 'Cancel')}</button>
                  <button className="btn btn-primary" onClick={handleImportSubmit} disabled={!importFile || importing}>
                    <span className="material-symbols-outlined">upload</span>{importing ? t('eng.ct.importing', 'Importing…') : t('eng.ct.import_send_btn', 'Import Contacts')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="modal-backdrop">
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('eng.ct.add_title', 'Add')} <em>{t('eng.ct.add_title_em', 'Contact')}</em></div>
              <div className="modal-close" onClick={() => setShowAddContact(false)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>
            {addError && <div className="eng-error">{addError}</div>}
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('eng.ct.first_name_label', 'First Name *')}</label>
                <input className="form-input" placeholder="Sofia" value={addFirst} onChange={e => setAddFirst(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('eng.ct.last_name_label', 'Last Name')}</label>
                <input className="form-input" placeholder="Marchetti" value={addLast} onChange={e => setAddLast(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('eng.ct.email_label', 'Email Address *')}</label>
              <input className="form-input" placeholder="sofia@example.com" type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('eng.ct.phone_label', 'Phone (for WhatsApp)')}</label>
              <input className="form-input" placeholder="+39 333 000 0000" value={addPhone} onChange={e => setAddPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('eng.ct.assign_segment_label', 'Assign to Segment')}</label>
              <div className="select-wrap">
                <select className="form-select" value={addSegment} onChange={e => setAddSegment(e.target.value)}>
                  <option value="vip">⭐ {t('eng.camp.seg_vip', 'VIP')}</option>
                  <option value="loyal">♻ {t('eng.camp.seg_loyal', 'Loyal')}</option>
                  <option value="new">✦ {t('eng.camp.seg_new', 'New')}</option>
                  <option value="warm">🔥 {t('eng.camp.seg_warm', 'Warm')}</option>
                  <option value="lapsed">⏱ {t('eng.camp.seg_lapsed', 'Lapsed')}</option>
                </select>
                <span className="material-symbols-outlined select-arrow">expand_more</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('eng.ct.notes_label', 'Notes')}</label>
              <textarea className="form-textarea ct-notes-textarea" placeholder={t('eng.ct.notes_placeholder', 'Any relevant notes about this customer…')} value={addNotes} onChange={e => setAddNotes(e.target.value)} />
            </div>
            <div className="alert-gdpr-blue">
              <span className="material-symbols-outlined">gpp_good</span>
              <div>{t('eng.ct.add_consent_note', 'A consent request will be sent to this contact via email before any marketing is delivered. You cannot message manually added contacts until they opt in.')}</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddContact(false)}>{t('common.cancel', 'Cancel')}</button>
              <button className="btn btn-primary" onClick={handleAddContact}>
                <span className="material-symbols-outlined">person_add</span>{t('eng.ct.add_send_btn', 'Add & Send Consent Request')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkMessage && (
        <div className="modal-backdrop">
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('eng.ct.bulk_message_title', 'Message')} <em>{t('eng.ct.bulk_message_title_em', 'Selected')}</em></div>
              <div className="modal-close" onClick={() => setShowBulkMessage(false)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>
            {!bulkMsgResult ? (
              <>
                <div className="form-group">
                  <label className="form-lbl">{t('eng.ct.bulk_message_subject', 'Subject')}</label>
                  <input className="form-input" value={bulkMsgSubject} onChange={e => setBulkMsgSubject(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-lbl">{t('eng.ct.bulk_message_body', 'Message')}</label>
                  <textarea className="form-textarea ct-notes-textarea" value={bulkMsgBody} onChange={e => setBulkMsgBody(e.target.value)} />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setShowBulkMessage(false)}>{t('common.cancel', 'Cancel')}</button>
                  <button className="btn btn-primary" disabled={bulkBusy || !bulkMsgBody.trim()} onClick={handleBulkMessage}>
                    <span className="material-symbols-outlined">send</span>{bulkBusy ? t('eng.rev.sending', 'Sending…') : t('eng.ct.bulk_message_send', 'Send')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={bulkMsgResult.sent > 0 ? 'eng-success' : 'eng-error'}>
                  {t('eng.ct.bulk_message_result', { sent: bulkMsgResult.sent, total: bulkMsgResult.total, defaultValue: 'Sent to {{sent}} of {{total}} contact(s).' })}
                </div>
                {(bulkMsgResult.results ?? []).filter(r => !r.ok).length > 0 && (
                  <ul className="eng-send-failures">
                    {bulkMsgResult.results.filter(r => !r.ok).map((r, i) => (
                      <li key={i}>{r.id} — {r.reason || t('eng.rev.unknown_error', 'Unknown error')}</li>
                    ))}
                  </ul>
                )}
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={() => { setShowBulkMessage(false); setBulkMsgSubject(''); setBulkMsgBody(''); setBulkMsgResult(null) }}>{t('common.done', 'Done')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Contact Detail Panel */}
      {showPanel && panelContact && (
        <div className="ct-panel-overlay" onClick={() => setShowPanel(false)}>
          <div className="ct-panel" onClick={e => e.stopPropagation()}>
            <div className="ct-panel-hdr">
              <button className="ct-panel-back" onClick={() => setShowPanel(false)}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="ct-panel-title">{t('eng.ct.panel_title', 'Contact Profile')}</div>
              <button className="btn btn-primary btn-sm" onClick={() => { setMessageContactIds([panelContact.id]); setBulkMsgSubject(''); setBulkMsgBody(''); setBulkMsgResult(null); setShowBulkMessage(true) }}>
                <span className="material-symbols-outlined">campaign</span>{t('eng.ct.message', 'Message')}
              </button>
            </div>
            <div className="ct-panel-body">
              {/* Avatar */}
              <div className="ct-panel-av-wrap">
                <div className="ct-panel-av" style={{background:panelContact.initBg, color:panelContact.initColor}}>
                  {panelContact.init}
                </div>
                <div className="ct-panel-av-name">{panelContact.name}</div>
                <SegBadge seg={panelContact.seg} />
              </div>

              {/* Channel tabs */}
              <div className="ct-panel-channels">
                <div className="ct-panel-ch act">
                  <span className="material-symbols-outlined">mail</span>{t('eng.channels.email', 'Email')}
                </div>
                <div className="ct-panel-ch">
                  <span className="material-symbols-outlined">chat</span>{t('eng.channels.wa', 'WhatsApp')}
                </div>
                <div className="ct-panel-ch ct-panel-ch-soon">
                  <span className="material-symbols-outlined">photo_camera</span>{t('eng.channels.insta_dm', 'Instagram DM')}
                  <span className="ct-soon-badge">{t('eng.camp.soon_tag', 'SOON')}</span>
                </div>
              </div>

              {/* Boutique Interactions */}
              <div className="ct-panel-section-lbl">{t('eng.ct.interactions_section', 'Boutique Interactions')}</div>
              <div className="ct-panel-rows">
                <div className="ct-panel-row"><span>{t('eng.ct.purchases', 'Purchases')}</span><strong>{panelContact.purchases}</strong></div>
                <div className="ct-panel-row"><span>{t('eng.ct.items_favorited', 'Items Favorited')}</span><strong>{panelContact.favorites}</strong></div>
                <div className="ct-panel-row"><span>{t('eng.ct.total_spent', 'Total Spent')}</span><strong>{panelContact.ltv}</strong></div>
                <div className="ct-panel-row"><span>{t('eng.ct.source', 'Source')}</span><span>{panelContact.src}</span></div>
                <div className="ct-panel-row"><span>{t('eng.ct.last_active', 'Last Active')}</span><span>{panelContact.last}</span></div>
              </div>

              {/* Saved Items */}
              <div className="ct-panel-section-lbl">{t('eng.ct.saved_items_section', 'Saved Items')}</div>
              {panelFavoritesLoading ? (
                <div className="eng-loading-sm">{t('eng.fav.loading', 'Loading favorites…')}</div>
              ) : panelFavoritesError ? (
                <div className="eng-error">{panelFavoritesError}</div>
              ) : panelFavorites.length === 0 ? (
                <div className="eng-loading-sm">{t('eng.ct.no_saved_items', 'No saved items yet.')}</div>
              ) : (
                panelFavorites.map((f, i) => (
                  <div key={f.product_id ?? i} className="ct-panel-row">
                    <span>{f.product_name || f.name || t('eng.fav.untitled_product', 'Product')}</span>
                    <strong>{f.retail_price != null ? `€${f.retail_price}` : ''}</strong>
                  </div>
                ))
              )}

              {/* Spend by Category */}
              <div className="ct-panel-section-lbl">{t('eng.ct.spend_by_category', 'Spend by Category')}</div>
              {(() => {
                const cats = panelDetail?.spend_by_category ?? []
                if (cats.length === 0) {
                  return <div className="eng-loading-sm">{t('eng.ct.spend_by_category_unavailable', 'Category breakdown not available yet.')}</div>
                }
                return cats.map(s => (
                  <div key={s.category} className="ct-panel-spend-row">
                    <div className="ct-panel-spend-lbl">{s.category}</div>
                    <div className="ct-panel-spend-bar-wrap">
                      <div className="ct-panel-spend-bar" style={{width:`${s.pct}%`}} />
                    </div>
                    <div className="ct-panel-spend-val">{s.amount != null ? `€${s.amount}` : ''}</div>
                  </div>
                ))
              })()}

              {/* Language */}
              <div className="ct-panel-section-lbl">{t('eng.ct.lang_section', 'Language & Localization')}</div>
              {langEditing ? (
                <div className="ct-panel-lang-row">
                  <div className="select-wrap" style={{ flex:1 }}>
                    <select className="form-select" value={langCode} onChange={e => setLangCode(e.target.value)} disabled={langSaving}>
                      <option value="">{t('eng.ct.lang_clear_override', 'No override (use detected)')}</option>
                      {Object.keys(LANG_MAP).map(code => <option key={code} value={code}>{langDisplayName(code, t)}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-outline btn-xs" onClick={() => setLangEditing(false)} disabled={langSaving}>{t('common.cancel', 'Cancel')}</button>
                  <button className="btn btn-primary btn-xs" onClick={saveLangChange} disabled={langSaving}>{langSaving ? t('eng.set.saving', 'Saving…') : t('common.save', 'Save')}</button>
                </div>
              ) : (
                <div className="ct-panel-lang-row">
                  <span className="ct-panel-lang-flag">{panelContact.lang}</span>
                  <div>
                    <div className="ct-panel-lang-name">{panelContact.langName}</div>
                    <div className="ct-panel-lang-src">{panelContact.langSrc}</div>
                  </div>
                  <button className="btn btn-outline btn-xs ct-panel-lang-change" onClick={openLangEditor}>
                    <span className="material-symbols-outlined">edit</span>{t('common.change', 'Change')}
                  </button>
                </div>
              )}
              {langSaveError && <div className="eng-error">{langSaveError}</div>}
                            <div className="ct-panel-lang-note">{t('eng.ct.lang_note', 'All campaign translations target this language. Set explicitly by customer or staff.')}</div>

              {/* GDPR Consent */}
              <div className="ct-panel-section-lbl">{t('eng.ct.consent_section', 'GDPR Consent — Per Channel')}</div>
              {[
                { icon:'mail',         label:t('eng.channels.email', 'Email'),          state:panelContact.email },
                { icon:'chat',         label:t('eng.channels.wa', 'WhatsApp'),        state:panelContact.wa    },
                { icon:'photo_camera', label:t('eng.channels.insta_dm', 'Instagram DM'),    soon:true                },
                { icon:'description',  label:t('eng.ov.print_insert', 'Printed insert'),  state:panelContact.print },
              ].map(ch => {
                const status   = ch.soon ? 'soon' : ch.state === 'yes' ? 'opted_in' : 'no'
                const statusTxt = ch.soon ? t('eng.ct.consent_not_available', 'Not yet available') : ch.state === 'yes' ? `✓ ${t('eng.ct.consent_opted_in', 'Opted in')}` : t('eng.ct.consent_not_opted', 'Not opted in')
                return (
                  <div key={ch.label} className="ct-panel-consent-row">
                    <span className="material-symbols-outlined ct-panel-consent-icon">{ch.icon}</span>
                    <div className="ct-panel-consent-label">
                      {ch.label}
                      {ch.soon && <span className="ct-soon-badge">{t('eng.camp.soon_tag', 'SOON')}</span>}
                    </div>
                    <span className={`ct-panel-consent-status ${status}`}>{statusTxt}</span>
                  </div>
                )
              })}
              <div className="ct-panel-consent-note">{t('eng.ct.consent_note', 'Consent managed by Mi Italia. You cannot modify consent status directly.')}</div>

              {/* Activity Timeline */}
              <div className="ct-panel-section-lbl">{t('eng.ct.activity_section', 'Activity Timeline')}</div>
              {panelLoading ? (
                <div className="eng-loading-sm">{t('eng.ct.loading_activity', 'Loading activity…')}</div>
              ) : (() => {
                const orders  = panelDetail?.recent_orders       ?? []
                const reservs = panelDetail?.recent_reservations ?? []
                if (orders.length === 0 && reservs.length === 0) {
                  return <div className="eng-loading-sm">{t('eng.ct.no_activity', 'No recent activity yet.')}</div>
                }
                const items = [
                  ...reservs.map(r => ({
                    key: `r-${r.id}`,
                    icon: 'event',
                    title: r.product_name || t('eng.ct.reservation_label', 'Reservation'),
                    status: r.status,
                    price: r.pickup_price,
                    date: r.confirmed_at,
                  })),
                  // recent_orders has always been empty in every real response we've seen so far,
                  // so this field mapping is inferred, not confirmed — re-check once a populated one exists.
                  ...orders.map((o, i) => ({
                    key: o.id ?? `o-${i}`,
                    icon: 'shopping_bag',
                    title: o.product_name || o.items?.[0]?.name || t('eng.ct.order_label', 'Order'),
                    status: o.status,
                    price: o.total ?? o.total_amount ?? o.amount,
                    date: o.created_at ?? o.ordered_at ?? o.date,
                  })),
                ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                return items.map(it => (
                  <div key={it.key} className="ct-panel-row">
                    <span>
                      <span className="material-symbols-outlined" style={{ fontSize:16, verticalAlign:'middle', marginRight:6 }}>{it.icon}</span>
                      {it.title}
                      {it.status && <span style={{ color: activityStatusColor(it.status), marginLeft:6 }}>· {it.status}</span>}
                    </span>
                    <span>
                      {it.price != null ? `€${Number(it.price).toLocaleString()} · ` : ''}{it.date ? timeAgo(it.date, t) : '—'}
                    </span>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CAMPAIGNS — HUB ──────────────────────────────────────
function CampaignsView({ campaigns: rawCampaigns, segments, dashboard, refetchCampaigns, campaignsLoading, emailSettings, initialSub = 'hub', initialSegment = null, initialTemplate = null, initialChannel = null }) {
  const { t } = useTranslation()
  const [campSub,        setCampSub]        = useState(initialSub || 'hub')
  const [presetSegment,  setPresetSegment]  = useState(initialSegment ?? null)
  const [presetTemplate, setPresetTemplate] = useState(initialTemplate ?? null)
  const [presetChannel,  setPresetChannel]  = useState(initialChannel ?? null)
  const [channelFilter,  setChannelFilter]  = useState('all')
  const [editingId,      setEditingId]      = useState(null)
  const [analyticsModalId, setAnalyticsModalId] = useState(null)
  const [deleteTarget,  setDeleteTarget]    = useState(null)
  const [deleting,      setDeleting]        = useState(false)
  const [deleteError,   setDeleteError]     = useState('')

  const list = (rawCampaigns ?? []).map(c => mapApiCampaignCard(c, t))
  const loadingList = campaignsLoading

  if (campSub === 'builder') return (
    <CampaignBuilder
      campaignId={editingId}
      initialSegment={editingId ? null : presetSegment}
      initialTemplate={editingId ? null : presetTemplate}
      initialChannel={editingId ? null : presetChannel}
      segments={segments}
      emailSettings={emailSettings}
      onBack={() => { refetchCampaigns(); setEditingId(null); setPresetSegment(null); setPresetTemplate(null); setPresetChannel(null); setCampSub('hub') }}
      onReview={(savedId) => { setEditingId(savedId); setCampSub('review') }}
    />
  )
  if (campSub === 'review') return (
    <CampaignReview
      campaignId={editingId}
      segments={segments}
      onBack={() => setCampSub('builder')}
      onSubmit={() => { refetchCampaigns(); setEditingId(null); setPresetSegment(null); setPresetTemplate(null); setPresetChannel(null); setCampSub('hub') }}
    />
  )


  // Hub view
  const openDraft = (id) => { setEditingId(id); setCampSub('builder') }
  const openCard = (c) => {
    if (c.status === 'draft') openDraft(c.id)
    else                      setAnalyticsModalId(c.id)
  }
  const confirmDelete = () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    campaignApi.delete(deleteTarget.id)
      .then(res => {
        if (res?.success) { setDeleteTarget(null); refetchCampaigns() }
        else setDeleteError(res?.message || t('eng.camp.err_delete_failed', 'Failed to delete campaign.'))
      })
      .catch(() => setDeleteError(t('eng.camp.err_delete_failed', 'Failed to delete campaign.')))
      .finally(() => setDeleting(false))
  }
  const handleAction = (c, action) => {
    if (action === 'edit')        openDraft(c.id)
    else if (action === 'submit') { setEditingId(c.id); setCampSub('review') }
    else if (action === 'delete') { setDeleteError(''); setDeleteTarget(c) }
  }

  const counts = {
    all:   list.length,
    email: list.filter(c => c.ch === 'email').length,
    wa:    list.filter(c => c.ch === 'wa').length,
    print: list.filter(c => c.ch === 'print').length,
  }
  const filtered = channelFilter === 'all'
    ? list
    : list.filter(c => c.ch === channelFilter)

  const tabs = [
    { key:'all',   label:t('eng.camp.ch_all', 'All'),         count:counts.all },
    { key:'email', icon:'mail',         color:'var(--gold-dk)', label:t('eng.camp.ch_email', 'Email'),     count:counts.email, ctBg:'var(--gold)' },
    { key:'wa',    icon:'chat',         color:'#1a9e4d',         label:t('eng.camp.ch_wa', 'WhatsApp'),  count:counts.wa,    ctBg:'var(--wa)' },
    { key:'print', icon:'description',  color:'var(--stone)',    label:t('eng.camp.ch_print', 'Print'),     count:counts.print, ctBg:'var(--stone)' },
    { key:'perf',  icon:'analytics',    color:'var(--gold)',     label:t('eng.camp.ch_performance', 'Performance'), comingSoon:true },
  ]

  const segStyleNeutral = { fontSize:8, padding:'1px 6px', background:'var(--mist)', color:'var(--stone)' }

  return (
    <div>
      {/* Info banner */}
      <div className="camp-info-banner">
        <span className="material-symbols-outlined camp-info-icon">verified</span>
        <div className="camp-info-body">
          <div className="camp-info-title">{t('eng.camp.info_title', 'Mi Italia reviews all campaigns before sending')}</div>
          <div className="camp-info-sub">{t('eng.camp.info_sub', 'Choose a channel & language → write your content → translations auto-generate → review and submit. Mi Italia approves for brand standards within 4 hours Mon–Fri.')}</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setPresetSegment(null); setPresetTemplate(null); setPresetChannel(null); setCampSub('builder') }}>
          <span className="material-symbols-outlined">add</span>{t('eng.camp.new_campaign', 'New Campaign')}
        </button>
      </div>

      {/* KPI Row — wired to dashboard */}
      <div className="stat-row col4 camp-kpi-row">
        <div className="stat-card">
          <div className="stat-lbl">{t('eng.camp.kpi_active', 'Active Campaigns')}</div>
          <div className="stat-val">{dashboard?.totalCampaigns ?? '—'}</div>
          <div className="stat-sub">{dashboard
            ? t('eng.camp.kpi_active_sub', { sent: dashboard.sentCampaigns ?? 0, draft: dashboard.draftCampaigns ?? 0, scheduled: dashboard.scheduledCampaigns ?? 0, defaultValue: '{{sent}} sent · {{draft}} draft · {{scheduled}} scheduled' })
            : t('common.loading', 'Loading...')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('eng.camp.kpi_sent_30d', 'Campaigns Sent · 30d')}</div>
          <div className="stat-val">{dashboard?.campaignsSent30d ?? '—'}</div>
          <div className="stat-sub">{t('eng.camp.kpi_last_30d', 'Last 30 days')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('eng.camp.kpi_avg_open', 'Avg Open Rate')}</div>
          <div className="stat-val">{dashboard?.avgOpenRate != null ? `${dashboard.avgOpenRate}%` : '—'}</div>
          <div className="stat-sub">{t('eng.camp.kpi_all_channels', 'Across all channels')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('eng.camp.kpi_revenue', 'Revenue Attributed')}</div>
          <div className="stat-val">{dashboard?.revenue != null ? `€${Number(dashboard.revenue).toLocaleString()}` : '—'}</div>
          <div className="stat-sub">{t('eng.camp.kpi_revenue_sub', 'From attributed purchases')}</div>
        </div>
      </div>

      {/* Channel filter tabs */}
      <div className="tabs">
        {tabs.map(tab => (
          <div key={tab.key} className={`tab${channelFilter === tab.key ? ' act' : ''}${tab.comingSoon ? ' dis' : ''}`}
            style={tab.comingSoon ? { opacity:0.55, cursor:'not-allowed' } : undefined}
            onClick={() => !tab.comingSoon && setChannelFilter(tab.key)}>
            {tab.icon && <span className="material-symbols-outlined tab-icon" style={{ color:tab.color }}>{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span className="tab-ct" style={tab.ctBg && channelFilter === tab.key ? { background:tab.ctBg } : undefined}>{tab.count}</span>
            )}
            {tab.comingSoon && <span className="eng-soon-tag">{t('eng.camp.soon_tag', 'SOON')}</span>}
          </div>
        ))}
      </div>

      {/* Campaign cards */}
      {loadingList ? (
        <div className="eng-loading">{t('eng.camp.loading_list', 'Loading campaigns…')}</div>
      ) : filtered.length === 0 ? (
        <div className="eng-loading">
          {t('eng.camp.empty_hint', { newCampaignLabel: t('eng.camp.new_campaign', 'New Campaign'), defaultValue: 'No campaigns yet — click "{{newCampaignLabel}}" to start.' })}
        </div>
      ) : filtered.map(c => (
        <div key={c.id} className="ccamp" onClick={() => openCard(c)}>
          <div className={`cc-ico ${c.ch}`}>
            <span className="material-symbols-outlined">{c.ch === 'wa' ? 'chat' : c.ch === 'print' ? 'description' : 'mail'}</span>
          </div>

          <div className="cc-body">
            <div className="cc-name">{c.name}</div>
            <div className="cc-meta">
              <span className={`status ${c.status}`}>{c.statusLabel}</span>
              {c.date && <span>{c.date}</span>}
              {c.segs.map((s, i) =>
                s.key === 'neutral'
                  ? <span key={i} className="seg" style={segStyleNeutral}>{s.label}</span>
                  : <span key={i} className={`seg seg-${s.key} seg-xs`}>{s.label}</span>
              )}
            </div>
          </div>

          <div className="cc-stats">
            {c.actions ? (
              <div className="cc-actions-wrap">
                {c.actions.map((a, i) => (
                  <button key={i} className={`btn ${a.cls} btn-sm`} onClick={e => { e.stopPropagation(); handleAction(c, a.action) }}>{a.label}</button>
                ))}
              </div>
            ) : c.stats ? c.stats.map((s, i) => (
              <div key={i}>
                <div className="cc-sv">{s.val}</div>
                <div className="cc-sl">{s.lbl}</div>
              </div>
            )) : null}
          </div>
        </div>
      ))}
      <CampaignAnalyticsModal
        campaignId={analyticsModalId}
        onClose={() => { setAnalyticsModalId(null); refetchCampaigns() }}
      />
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('eng.camp.delete_title', 'Delete')} <em>{t('eng.camp.delete_title_em', 'Campaign')}</em></div>
              <div className="modal-close" onClick={() => !deleting && setDeleteTarget(null)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>
            {deleteError && <div className="eng-error">{deleteError}</div>}
            <div>{t('eng.camp.confirm_delete', { name: deleteTarget.name, defaultValue: 'Delete "{{name}}"? This cannot be undone.' })}</div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t('common.cancel', 'Cancel')}</button>
              <button className="btn btn-red" onClick={confirmDelete} disabled={deleting}>
                <span className="material-symbols-outlined">delete</span>{deleting ? t('eng.camp.deleting', 'Deleting…') : t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ── CAMPAIGNS — BUILDER (5-step) ─────────────────────────
function CampaignBuilder({ campaignId: initialId, segments: segArr, emailSettings, onBack, onReview, initialSegment = null, initialTemplate = null, initialChannel = null }) {
  const { t, i18n } = useTranslation()
  const [campaignId,      setCampaignId]      = useState(initialId || null)
  const [campaignName,    setCampaignName]    = useState(t('eng.camp.untitled', 'Untitled draft'))
  const [channel,         setChannel]         = useState(initialChannel === 'whatsapp' ? 'wa' : 'email')
  const [template,        setTemplate]        = useState(initialTemplate || null)
  const [subject,         setSubject]         = useState('')
  const [previewText,     setPreviewText]     = useState('')
  const [body,            setBody]            = useState('')
  const [segment,         setSegment]         = useState(initialSegment || 'all')
  const [sendMode,        setSendMode]        = useState('immediate')            // 'immediate' | 'scheduled'
  const [scheduledLocal,  setScheduledLocal]  = useState('')                     // raw <input type="datetime-local"> value, wall-clock in `timezone`
  const [timezone,        setTimezone]        = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome' } catch { return 'Europe/Rome' }
  })
  const [saving,          setSaving]          = useState(false)
  const [loadingCampaign, setLoadingCampaign] = useState(false)
  const [errorMsg,        setErrorMsg]        = useState(null)
  const [apiTemplates, setApiTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)

  useEffect(() => {
    setTemplatesLoading(true)
    templateApi.list()
      .then(res => {
        if (res?.success) {
          const list = (res.data?.templates ?? []).filter(t => !t.template_kind || t.template_kind === 'marketing')
          setApiTemplates(list)
        }
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false))
  }, [i18n.language])

  // Load existing campaign when editing
  useEffect(() => {
    if (!initialId) return
    setLoadingCampaign(true)
    setErrorMsg(null)
    campaignApi.get(initialId)
      .then(res => {
        if (res?.success && res.data) {
          const c = res.data
          setCampaignId(c.id)
          setCampaignName(c.campaign_name || t('eng.camp.untitled', 'Untitled draft'))
          setChannel(channelKey(c.channel))
          setSubject(c.subject || '')
          setPreviewText(c.preview_text || '')
          setBody(c.message || '')
          setSegment(c.target_segment || 'all')
          setTemplate(c.template_id || null)
          const tz = c.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome')
          setTimezone(tz)
          setSendMode(c.send_mode === 'scheduled' ? 'scheduled' : 'immediate')
          setScheduledLocal(c.scheduled_at ? utcISOToZonedLocal(c.scheduled_at, tz) : '')
        } else {
          setErrorMsg(res?.message || t('eng.camp.err_load_failed', 'Failed to load campaign'))
        }
      })
      .catch(() => setErrorMsg(t('eng.camp.err_load_failed', 'Failed to load campaign')))
      .finally(() => setLoadingCampaign(false))
  }, [initialId])

  // POST if new, PUT if existing. Returns the saved id (or null on failure).
  const saveDraft = async () => {
    const name = campaignName.trim() || t('eng.camp.untitled', 'Untitled draft')
    if (sendMode === 'scheduled' && !scheduledLocal) {
      setErrorMsg(t('eng.camp.err_no_schedule_time', 'Pick a date and time to schedule this campaign.'))
      return null
    }
    setSaving(true)
    setErrorMsg(null)
    try {
      const payload = {
        campaign_name:  name,
        channel,
        target_segment: segment,
        send_mode:      sendMode,
        timezone,
      }
      payload.template_id = template || null
      if (subject.trim())     payload.subject      = subject
      if (previewText.trim()) payload.preview_text = previewText
      if (body.trim())        payload.message      = body
      if (sendMode === 'scheduled' && scheduledLocal) {
        payload.scheduled_at = zonedTimeToUtcISO(scheduledLocal, timezone)
      }
      const res = campaignId
        ? await campaignApi.update(campaignId, payload)
        : await campaignApi.create(payload)
      if (!res?.success) {
        setErrorMsg(res?.message || t('eng.camp.err_save_failed', 'Save failed'))
        return null
      }
      const savedId = res.data?.id || campaignId
      if (!campaignId && savedId) setCampaignId(savedId)
      return savedId
    } catch (e) {
      setErrorMsg(t('eng.camp.err_save_network', 'Save failed — check your connection and try again.'))
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndClose = async () => { const id = await saveDraft(); if (id) onBack() }
  const handleReview       = async () => { const id = await saveDraft(); if (id) onReview(id) }

  const channels = [
    { key:'email', icon:'mail',         color:'var(--gold-dk)', label:t('eng.channels.email', 'Email'),     priceLbl:t('eng.camp.free', 'FREE') },
    { key:'wa',    icon:'chat',         color:'#1a9e4d',        label:t('eng.channels.wa', 'WhatsApp'),  priceLbl:'€0.10' },
    { key:'insta', icon:'photo_camera', color:'#DD2A7B',        label:t('eng.channels.insta', 'Instagram'), priceLbl:t('eng.camp.coming_soon', 'COMING SOON'), disabled:true },
    { key:'print', icon:'description',  color:'var(--stone)',   label:t('eng.channels.print', 'Print'),     priceLbl:'€0.18' },
  ]

  // Real per-language share of the selected segment (or all segments combined), from the same
  // `languages` field LangBar already renders elsewhere — replaces the old hardcoded 87/8/5% guesses.
  const segLanguages = segment === 'all'
    ? (segArr || []).reduce((merged, s) => {
        Object.entries(s.languages ?? {}).forEach(([lang, cnt]) => { merged[lang] = (merged[lang] ?? 0) + cnt })
        return merged
      }, {})
    : (segArr || []).find(s => s.key === segment)?.languages ?? {}
  const segLangTotal = Object.values(segLanguages).reduce((a, b) => a + b, 0)

  const LANGS = ['it', ...Object.keys(LANG_MAP).filter(c => c !== 'it')].map(code => {
    const meta = LANG_MAP[code]
    const pct  = segLangTotal > 0 ? Math.round((segLanguages[code] ?? 0) / segLangTotal * 100) : 0
    return {
      code,
      flag: meta.flag,
      name: langDisplayName(code, t),
      share: code === 'it'
        ? t('eng.camp.lang_source_share', { pct, defaultValue: 'SOURCE · {{pct}}%' })
        : pct > 0 ? `${pct}%` : null,
      locked: code === 'it',
      isBadge: meta.flag === 'EN',
    }
  })

  // Segment cards — keys match the API enum
  const segCountFor = (key) => {
    if (key === 'all') return (segArr || []).reduce((s, x) => s + (x.customers ?? 0), 0)
    return (segArr || []).find(x => x.key === key)?.customers ?? 0
  }
  const segmentCards = [
    { key:'all',    emoji:'👥', name:t('eng.camp.seg_all', 'All contacts'), desc:t('eng.camp.seg_desc_all', 'Everyone reachable on this channel') },
    { key:'vip',    emoji:'⭐', name:t('eng.camp.seg_vip', 'VIP'),          desc:t('eng.camp.seg_desc_vip', 'Platino tier · spend €5k+ lifetime') },
    { key:'loyal',  emoji:'♻', name:t('eng.camp.seg_loyal', 'Loyal'),        desc:t('eng.camp.seg_desc_loyal', 'Oro+ tier · 3+ purchases · visited 90d') },
    { key:'new',    emoji:'✦', name:t('eng.camp.seg_new', 'New'),          desc:t('eng.camp.seg_desc_new', 'Argento · 1 purchase · joined 90d') },
    { key:'warm',   emoji:'🔥', name:t('eng.camp.seg_warm', 'Warm'),         desc:t('eng.camp.seg_desc_warm', 'Has favorited but not purchased') },
    { key:'lapsed', emoji:'⏱', name:t('eng.camp.seg_lapsed', 'Lapsed'),       desc:t('eng.camp.seg_desc_lapsed', 'Has purchased · no visit 180d') },
  ]

  const steps = [t('eng.camp.step_channel', 'Channel & Languages'), t('eng.camp.step_template', 'Template'), t('eng.camp.step_content', 'Content'), t('eng.camp.step_audience', 'Audience & Schedule'), t('eng.camp.step_review', 'Translation Review')]

  return (
    <div className="camp-sub-wrap">
      {loadingCampaign && (
        <div className="eng-loading-sm">{t('eng.camp.loading', 'Loading campaign…')}</div>
      )}
      {errorMsg && (
        <div className="eng-error">{errorMsg}</div>
      )}

      {/* Top bar */}
      <div className="camp-builder-top">
        <button className="btn btn-outline btn-sm" onClick={onBack} disabled={saving}>
          <span className="material-symbols-outlined">arrow_back</span>{t('eng.camp.hub_em', 'Hub')}
        </button>
        <div className="camp-builder-title-wrap">
          <input
            value={campaignName}
            onChange={e => setCampaignName(e.target.value)}
            placeholder={t('eng.camp.untitled', 'Untitled draft')}
            className="camp-name-input"
          />
          <div className="camp-builder-sub">
            {campaignId ? t('eng.camp.draft_persist', 'Draft · click Save or Translation Review to persist') : t('eng.camp.untitled_persist', 'Untitled draft · click Save to persist')}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleSaveAndClose} disabled={saving}>
          {saving ? t('common.saving', 'Saving…') : t('eng.camp.save_close', 'Save & close')}
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleReview} disabled={saving}>
          {saving ? t('common.saving', 'Saving…') : t('eng.camp.translation_review', 'Translation Review')}<span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>

      {/* 5-step progress */}
      <div className="camp-prog">
        {steps.map((step, i) => (
          <div key={step} className="camp-prog-item">
            <div className={`ps ${i < 4 ? 'act' : 'todo'}`}>
              <div className="ps-n">{i + 1}</div>
              <div className="ps-l">{step}</div>
            </div>
            {i < steps.length - 1 && <div className="ps-line" />}
          </div>
        ))}
      </div>

      {/* Form grid */}
      <div className="camp-builder-2col">
        <div>
          {/* Step 1: Channel */}
          <div className="camp-step">
            <div className="form-lbl">{t('eng.camp.step1_label', 'Step 1 — Channel')}</div>
            <div className="chs-grid">
              {channels.map(c => (
                <div key={c.key}
                  className={`chs-opt${channel === c.key ? ' sel' : ''}${c.disabled ? ' dis' : ''}`}
                  onClick={() => !c.disabled && setChannel(c.key)}>
                  <span className="material-symbols-outlined chs-opt-icon" style={{ color:c.color }}>{c.icon}</span>
                  <div className="chs-opt-label">{c.label}</div>
                  <div className={`chs-opt-price${c.disabled ? ' coming' : ''}`}>{c.priceLbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2: Languages */}
          <div className="camp-step">
            <div className="form-lbl">{t('eng.camp.step2_label', 'Step 2 — Your audience\'s languages')}</div>
            <div className="camp-tip">
              <span className="material-symbols-outlined">tips_and_updates</span>
              {t('eng.camp.lang_tip', 'Every campaign is automatically translated into all supported languages. Below is the language mix for your selected segment.')}
            </div>
            <div className="lang-pills">
              {LANGS.map(l => (
                <div key={l.code} className={`lang-pill sel${l.locked ? ' locked' : ''}`}>
                  {l.isBadge ? <span className="lang-text-badge">{l.flag}</span> : <span>{l.flag}</span>}
                  {l.name}
                  {l.share && <span className="lang-pill-share">{l.share}</span>}
                </div>
              ))}
            </div>
            <div className="form-hint">{t('eng.camp.auto_translate', 'Auto-translated on save · review each before send.')}</div>
          </div>

          {/* Step 3: Template */}
          <div className="camp-step">
            <div className="form-lbl">{t('eng.camp.step3_label', 'Step 3 — Template')}</div>
            <div className="tmpl-grid">
              {templatesLoading ? (
                <div className="eng-loading-grid">{t('eng.camp.loading_tpl', 'Loading templates…')}</div>
              ) : apiTemplates.length === 0 ? (
                <div className="eng-loading-grid">
                  {t('eng.camp.no_templates', 'No templates yet — campaigns will use the message body below.')}
                </div>
              ) : (
                <>
                  <div className={`tmpl-pick${template === null ? ' sel' : ''}`} onClick={() => setTemplate(null)}>
                    <div className="tmpl-pick-emoji">✏️</div>
                    <div className="tmpl-pick-label">{t('eng.camp.no_template', 'No template')}<br/><span className="tmpl-no-tpl-sub">{t('eng.camp.use_body', 'Use message below')}</span></div>
                  </div>
                  {apiTemplates.map(tpl => (
                    <div key={tpl.id}
                      className={`tmpl-pick${template === tpl.id ? ' sel' : ''}`}
                      onClick={() => setTemplate(tpl.id)}>
                      <div className="tmpl-pick-emoji">{templateEmoji(tpl.template_key)}</div>
                      <div className="tmpl-pick-label">{templateDisplayName(tpl.template_key, t)}</div>
                      {tpl.translations_pending && (
                        <div className="tmpl-pending-tag">{t('eng.camp.translations_pending', 'TRANSLATIONS PENDING')}</div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Step 4: Content */}
          <div className="camp-step">
            <div className="form-lbl">{t('eng.camp.step4_label', 'Step 4 — Content · Italian (source)')}</div>
            {template && (
              <div className="alert alert-info">
                <span className="material-symbols-outlined">info</span>
                <div>{t('eng.camp.step4_template_override', { name: templateDisplayName(apiTemplates.find(tpl => tpl.id === template)?.template_key, t), defaultValue: 'This campaign uses "{{name}}"\'s content, so Subject and Body below are locked. Edit the actual content in Translation Review, or clear the template in Step 3 to write custom content here instead.' })}</div>
              </div>
            )}
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('eng.camp.subject', 'Subject Line')}</label>
                <input className="form-input" disabled={!!template} value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('eng.camp.preview_text', 'Preview Text')}</label>
                <input className="form-input" disabled={!!template} value={previewText} onChange={e => setPreviewText(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('eng.camp.body', 'Message Body')}</label>
              <textarea className="form-textarea camp-body-textarea" disabled={!!template} value={body} onChange={e => setBody(e.target.value)} />
              <div className="form-hint">{t('eng.camp.write_italian', 'Write in Italian. The other languages auto-translate on save — review each in step 5 before send.')}</div>
            </div>
          </div>

          {/* Step 5: Audience & schedule */}
          <div className="camp-step">
            <div className="form-lbl">{t('eng.camp.step5_label', 'Step 5 — Audience & schedule')}</div>
            <div className="camp-tip">
              <span className="material-symbols-outlined">groups</span>
              <span dangerouslySetInnerHTML={{ __html: t('eng.camp.segment_hint', 'Pick a segment from your <strong>Contacts</strong>. Manage standing segments once — target them everywhere.') }} />
            </div>
            <div className="seg-grid">
              {segmentCards.map(s => (
                <div key={s.key}
                  className={`seg-card${segment === s.key ? ' sel' : ''}`}
                  onClick={() => setSegment(s.key)}>
                  <div className="seg-card-hdr">
                    <span className="seg-card-emoji">{s.emoji}</span>
                    <span className="seg-card-name">{s.name}</span>
                    <span className="seg-card-count">{segCountFor(s.key)}</span>
                  </div>
                  <div className="seg-card-desc">{s.desc}</div>
                </div>
              ))}
            </div>
            <div className="seg-link">
              <span className="material-symbols-outlined">open_in_new</span>
              {t('eng.camp.edit_segments', 'Create or edit segments in Contacts')}
            </div>

            <div className="refine-row">
              <span className="material-symbols-outlined refine-icon">filter_alt</span>
              <div className="refine-body">
                <div className="refine-title">{t('eng.camp.exclude_recent', 'Exclude recent recipients')} <span className="eng-soon-tag">{t('eng.camp.soon_tag', 'SOON')}</span></div>
                <div className="refine-sub">{t('eng.camp.exclude_hint', 'Skip anyone who got another campaign in the last 7 days. Not yet available — targeting is by segment only for now.')}</div>
              </div>
              <Toggle on={false} onToggle={() => {}} />
            </div>
            <div className="refine-row">
              <span className="material-symbols-outlined refine-icon">translate</span>
              <div className="refine-body">
                <div className="refine-title">{t('eng.camp.match_lang', 'Match recipient language')} <span className="eng-soon-tag">{t('eng.camp.soon_tag', 'SOON')}</span></div>
                <div className="refine-sub">{t('eng.camp.match_hint', 'Only send to contacts whose language is in your selected languages. Not yet available — targeting is by segment only for now.')}</div>
              </div>
              <Toggle on={false} onToggle={() => {}} />
            </div>

            <div className="form-row2 eng-mt14">
              <div className="form-group">
                <label className="form-lbl">{t('eng.camp.when_send', 'When to send')}</label>
                <select className="form-select" value={sendMode} onChange={e => setSendMode(e.target.value)}>
                  <option value="immediate">{t('eng.camp.send_approved', 'Send when approved')}</option>
                  <option value="scheduled">{t('eng.camp.schedule_time', 'Schedule for specific time')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('eng.camp.timezone', 'Time zone')}</label>
                <select className="form-select" value={timezone} onChange={e => setTimezone(e.target.value)}>
                  {TIMEZONE_OPTIONS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
            {sendMode === 'scheduled' && (
              <div className="form-group eng-mt14">
                <label className="form-lbl">{t('eng.camp.schedule_datetime', 'Date & time')}</label>
                <input
                  className="form-input"
                  type="datetime-local"
                  min={new Date().toISOString().slice(0, 16)}
                  value={scheduledLocal}
                  onChange={e => setScheduledLocal(e.target.value)}
                />
                <div className="form-hint">{t('eng.camp.schedule_tz_hint', { tz: timezone, defaultValue: 'Local time in {{tz}}.' })}</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live preview */}
        <div>
          <div className="camp-preview-wrap">
            <div className="camp-preview-head">
              <div className="camp-preview-label">{t('eng.camp.live_preview', { channel: channels.find(c => c.key === channel)?.label || t('eng.channels.email', 'Email'), defaultValue: 'Live preview · {{channel}} · Italian' })}</div>
              <div className="camp-preview-sub">
                <span className="material-symbols-outlined">visibility</span>{t('eng.camp.recipient_view', 'Recipient view')}
              </div>
            </div>
            <div className="email-preview">
              <div className="email-preview-head">
                {t('eng.camp.email_from', 'From:')} {emailSettings
                  ? <><strong>{emailSettings.sender_display_name}</strong> &lt;{emailSettings.sender_local_part}@{emailSettings.sender_domain}&gt;</>
                  : t('common.loading', 'Loading...')}<br />
                {t('eng.camp.email_subject', 'Subject:')} <strong>{subject}</strong>
              </div>
              <div className="email-preview-body">
                <div className="email-preview-brand">{emailSettings ? emailSettings.sender_display_name : t('common.loading', 'Loading...')}</div>
                <div className="email-preview-title">{campaignName || t('eng.camp.untitled_short', 'Untitled')}</div>
                <div className="email-preview-tag">Seta italiana · SS26</div>
                <div className="email-preview-hero">👗</div>
                <div className="email-preview-text">{body}</div>
                <a className="email-preview-cta">{t('eng.camp.email_cta', 'Reserve at Brera')}</a>
              </div>
              <div className="email-preview-foot">{emailSettings ? `${emailSettings.sender_display_name} · ${emailSettings.physical_address} · Mi Italia` : t('common.loading', 'Loading...')}<br />{t('eng.camp.unsubscribe_anytime', 'Unsubscribe anytime')}</div>
            </div>
            <div className="camp-preview-note">{t('eng.camp.preview_note', "Preview shows Italian (source). After save, translations generate and you'll review each in step 5.")}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CAMPAIGNS — TRANSLATION REVIEW ───────────────────────
function CampaignReview({ campaignId, segments, onBack, onSubmit }) {
  const { t } = useTranslation()
  const [sending,     setSending]     = useState(false)
  const [errorMsg,    setErrorMsg]    = useState(null)
  const [successMsg,  setSuccessMsg]  = useState(null)
  const [sendResult,  setSendResult]  = useState(null)

  const [campaign,        setCampaign]              = useState(null)
  const [template,        setTemplate]              = useState(null)
  const [campaignTranslations, setCampaignTranslations] = useState({})   // { [langCode]: {subject, body, confirmed, ...} } — real per-campaign overrides
  const [loadingTpl,      setLoadingTpl]            = useState(true)
  const [retranslating,   setRetranslating]         = useState(null)   // holds the lang code currently being retranslated
  const [editedContent,   setEditedContent]         = useState({})     // { [langCode]: {subject, text} } — local edit buffer
  const [dirtyLangs,      setDirtyLangs]            = useState(() => new Set())
  const [savingLang,      setSavingLang]            = useState(null)

  const hasTemplate = !!campaign?.template_id
  const languages = template?.content
    ? Object.keys(template.content).sort((a, b) => a === template.primary_language ? -1 : b === template.primary_language ? 1 : a.localeCompare(b))
    : []
  const isConfirmed    = (lang) => campaignTranslations[lang]?.confirmed === true && !dirtyLangs.has(lang)
  const confirmedCount = languages.filter(isConfirmed).length
  const allConfirmed   = !hasTemplate || (languages.length > 0 && languages.every(isConfirmed))

  useEffect(() => {
    if (!campaignId) return
    setLoadingTpl(true)
    campaignApi.get(campaignId)
      .then(res => {
        if (!res?.success) return null
        setCampaign(res.data)
        return Promise.all([
          res.data?.template_id ? templateApi.get(res.data.template_id) : null,
          campaignApi.getTranslations(campaignId),
        ])
      })
      .then(results => {
        if (!results) return
        const [tres, trres] = results
        if (tres?.success) setTemplate(tres.data?.template)
        if (trres?.success) {
          const byLang = {}
          ;(trres.data?.translations ?? []).forEach(row => { byLang[row.locale] = row })
          setCampaignTranslations(byLang)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTpl(false))
  }, [campaignId])

  // Re-seed the local edit buffer: real campaign-level translation if one exists, else the template's default copy
  useEffect(() => {
    if (!template?.content) return
    const init = {}
    Object.keys(template.content).forEach(lang => {
      const saved = campaignTranslations[lang]
      const tpl   = template.content[lang]
      init[lang] = { subject: saved?.subject ?? tpl?.subject ?? '', text: saved?.body ?? tpl?.text ?? '' }
    })
    setEditedContent(init)
  }, [template, campaignTranslations])

  const handleFieldChange = (lang, field, value) => {
    setEditedContent(prev => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }))
    setDirtyLangs(prev => new Set(prev).add(lang))
  }

  const handleConfirmLang = async (lang) => {
    setSavingLang(lang)
    setErrorMsg(null)
    try {
      const content = editedContent[lang] ?? {}
      const res = await campaignApi.updateTranslation(campaignId, lang, { subject: content.subject, body: content.text, confirmed: true })
      if (res?.success) {
        setCampaignTranslations(prev => ({ ...prev, [lang]: res.data }))
        setDirtyLangs(prev => { const next = new Set(prev); next.delete(lang); return next })
      } else {
        setErrorMsg(res?.message || t('eng.rev.err_save_translation', 'Failed to save this translation.'))
      }
    } catch (e) {
      setErrorMsg(t('eng.rev.err_save_translation_network', 'Failed to save — check your connection.'))
    } finally {
      setSavingLang(null)
    }
  }

  const handleRetranslate = async (lang) => {
    if (!template?.id) {
      setErrorMsg(t('eng.rev.err_no_template', 'No template attached — translations can only be regenerated from a template.'))
      return
    }
    setRetranslating(lang)
    setErrorMsg(null)
    try {
      const res = await templateApi.translate(template.id, lang)
      if (res?.success) {
        setSuccessMsg(t('eng.rev.retranslate_queued_lang', { lang: langDisplayName(lang, t), defaultValue: 'Translation queued for {{lang}}.' }))
        // Refresh template to pick up new translations_pending state
        const tres = await templateApi.get(template.id)
        if (tres?.success) setTemplate(tres.data?.template)
      } else {
        setErrorMsg(res?.message || t('eng.rev.err_retranslate', 'Re-translate failed.'))
      }
    } catch {
      setErrorMsg(t('eng.rev.err_retranslate_network', 'Re-translate failed — check your connection.'))
    } finally {
      setRetranslating(null)
    }
  }

  const handleSubmit = async () => {
    if (!campaignId) {
      setErrorMsg(t('eng.rev.err_no_campaign', 'No campaign id — save the campaign first.'))
      return
    }
    if (!allConfirmed) {
      setErrorMsg(t('eng.rev.err_confirm_all', 'Confirm all translations before submitting.'))
      return
    }
    setSending(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    setSendResult(null)
    try {
      const res = await campaignApi.send(campaignId)
      if (res?.success) {
        setSuccessMsg(res.message || t('eng.rev.campaign_sent', 'Campaign sent.'))
        setSendResult(res.data ?? null)
        const hasFailures = (res.data?.failed ?? 0) > 0 || (res.data?.failures?.length ?? 0) > 0
        if (!hasFailures) {
          // Small delay so user sees the success state, then exit
          setTimeout(() => { onSubmit() }, 800)
        }
        // else: leave the panel open so the user can read the failure breakdown
      } else {
        setErrorMsg(res?.message || t('eng.rev.err_send', 'Send failed.'))
      }
    } catch (e) {
      setErrorMsg(t('eng.rev.err_send_network', 'Send failed — check your connection and try again.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="camp-sub-wrap">
      {/* Top bar */}
      <div className="camp-builder-top">
        <button className="btn btn-outline btn-sm" onClick={onBack} disabled={sending}>
          <span className="material-symbols-outlined">arrow_back</span>{t('eng.rev.back_builder', 'Back to Builder')}
        </button>
        <div className="camp-builder-title-wrap">
          <div className="camp-builder-title">{t('eng.rev.title', 'Translation')} <em>{t('eng.rev.title_em', 'Review')}</em></div>
          <div className="camp-builder-sub">
            {campaign?.campaign_name || t('eng.camp.untitled', 'Untitled draft')}
            {hasTemplate ? ` · ${t('eng.rev.langs_ready_dyn', { count: confirmedCount, total: languages.length, defaultValue: '{{count}} of {{total}} languages ready' })}` : ''}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onBack} disabled={sending}>{t('eng.camp.save_draft', 'Save Draft')}</button>
        <button className={`btn btn-primary${sending || !campaignId || !allConfirmed ? ' btn-disabled' : ''}`} disabled={sending || !campaignId || !allConfirmed} onClick={handleSubmit}>
          <span className="material-symbols-outlined">check</span>{sending ? t('eng.rev.sending', 'Sending…') : t('eng.rev.submit', 'Submit for review')}
        </button>
      </div>

      {errorMsg && (
        <div className="eng-error">{errorMsg}</div>
      )}
      {successMsg && (
        <div className="eng-success">
          {successMsg}
          {sendResult && (
            <div className="eng-send-breakdown">
              <span>{t('eng.rev.recipients_count', { count: sendResult.recipients_count ?? 0, defaultValue: '{{count}} recipients' })}</span>
              <span>{t('eng.rev.delivered_count', { count: sendResult.delivered ?? 0, defaultValue: '{{count}} delivered' })}</span>
              {sendResult.skipped > 0 && <span>{t('eng.rev.skipped_count', { count: sendResult.skipped, defaultValue: '{{count}} skipped' })}</span>}
              {sendResult.failed > 0 && <span className="eng-send-failed">{t('eng.rev.failed_count', { count: sendResult.failed, defaultValue: '{{count}} failed' })}</span>}
            </div>
          )}
          {sendResult?.failures?.length > 0 && (
            <ul className="eng-send-failures">
              {sendResult.failures.map((f, i) => (
                <li key={i}>{f.email || f.contact_id || f.recipient} — {f.reason || f.error || t('eng.rev.unknown_error', 'Unknown error')}</li>
              ))}
            </ul>
          )}
          {sendResult && ((sendResult.failed ?? 0) > 0 || (sendResult.failures?.length ?? 0) > 0) && (
            <button className="btn btn-outline btn-sm eng-mt14" onClick={onSubmit}>{t('common.done', 'Done')}</button>
          )}
        </div>
      )}

      {loadingTpl ? (
        <div className="eng-loading">{t('eng.rev.loading', 'Loading campaign…')}</div>
      ) : (
        <>
          {/* Source banner */}
          <div className="cr-banner">
            <div className="cr-banner-icon"><span className="material-symbols-outlined">translate</span></div>
            <div className="cr-banner-body">
              <div className="cr-banner-title">
                {hasTemplate
                  ? t('eng.rev.source_banner_dyn', { lang: langDisplayName(template?.primary_language, t), count: Math.max(languages.length - 1, 0), defaultValue: 'Source: {{lang}} · {{count}} translation(s)' })
                  : t('eng.rev.source_banner_none', 'No template attached — this campaign sends one message with no translations.')}
              </div>
              {hasTemplate && (
                <div className="cr-banner-sub" dangerouslySetInnerHTML={{ __html: t('eng.rev.source_hint', "Review each translation. Edit any wording that doesn't sound right. <strong>Confirm</strong> each one before submitting — the Send button only unlocks when all are confirmed.") }} />
              )}
            </div>
          </div>

          {!hasTemplate && (
            <div className="card cr-source-card">
              <div className="cr-source-head">
                <div className="cr-source-title">{t('eng.rev.no_template_title', 'Single-language campaign')}</div>
              </div>
              <div className="cr-source-subject">{t('eng.rev.subject', 'SUBJECT')}: {campaign?.subject || '—'}</div>
              <div className="cr-source-body">{campaign?.message || '—'}</div>
            </div>
          )}

          {/* Translation cards */}
          {hasTemplate && (
            <div className="cr-grid">
              {languages.map(lang => {
                const isPrimary = lang === template.primary_language
                const content = editedContent[lang] ?? { subject:'', html:'', text:'' }
                const confirmed = isConfirmed(lang)
                const recipientCount = segments?.find(s => s.key === campaign?.target_segment)?.languages?.[lang]
                const flag = LANG_META[lang]?.flag || LANG_META[lang]?.code || lang.toUpperCase()
                return (
                  <div key={lang} className="card cr-card">
                    <div className="cr-card-head">
                      <span className="eng-flag-lg">{flag}</span>
                      <div className="cr-card-lang">{langDisplayName(lang, t)}</div>
                      {isPrimary && <span className="cr-source-locked">{t('eng.rev.source_tag', 'SOURCE')}</span>}
                      <span className={`cr-card-status ${confirmed ? 'confirmed' : 'edited'}`}>
                        {confirmed ? t('eng.rev.confirmed', 'CONFIRMED') : t('eng.rev.needs_review', 'NEEDS REVIEW')}
                      </span>
                    </div>
                    <div className="cr-card-label">{t('eng.rev.subject', 'SUBJECT')}</div>
                    <input
                      className={`form-input cr-input${!confirmed ? ' cr-input-edited' : ''}`}
                      value={content.subject}
                      onChange={e => handleFieldChange(lang, 'subject', e.target.value)} />
                    <div className="cr-card-label">{t('eng.rev.body', 'BODY')}</div>
                    <textarea
                      className="form-textarea cr-card-textarea"
                      value={content.text}
                      onChange={e => handleFieldChange(lang, 'text', e.target.value)} />
                    <div className="cr-card-foot">
                      {confirmed
                        ? <span className="cr-card-foot-txt">{recipientCount != null ? t('eng.rev.recipients_confirmed', { count: recipientCount, defaultValue: '{{count}} recipients · Confirmed' }) : t('eng.rev.confirmed_label', 'Confirmed')}</span>
                        : <button className="btn btn-primary btn-xs" disabled={savingLang === lang} onClick={() => handleConfirmLang(lang)}>
                            <span className="material-symbols-outlined">check</span>{savingLang === lang ? t('eng.rev.saving', 'Saving…') : t('eng.rev.confirm_changes', 'Confirm changes')}
                          </button>
                      }
                      <button className="btn btn-outline btn-xs" onClick={() => handleRetranslate(lang)} disabled={!!retranslating}>
                        <span className="material-symbols-outlined">refresh</span>{retranslating === lang ? t('eng.rev.queuing', 'Queuing…') : t('eng.rev.retranslate', 'Re-translate')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Send bar */}
          <div className="cr-send-bar">
            <span className="material-symbols-outlined cr-send-icon">verified</span>
            <div className="cr-send-body">
              <div className="cr-send-title">
                {hasTemplate
                  ? t('eng.rev.translations_confirmed_count', { count: confirmedCount, total: languages.length, defaultValue: '{{count}} of {{total}} translations confirmed' })
                  : t('eng.rev.no_translations_needed', 'No translations to confirm')}
              </div>
              <div className="cr-send-sub">
                {allConfirmed
                  ? t('eng.rev.all_confirmed', 'All translations confirmed — ready to submit for Mi Italia review.')
                  : t('eng.rev.not_confirmed_dyn', 'Confirm every language before submitting.')}
              </div>
            </div>
            <button className={`btn btn-primary${sending || !campaignId || !allConfirmed ? ' btn-disabled' : ''}`} disabled={sending || !campaignId || !allConfirmed} onClick={handleSubmit}>
              <span className="material-symbols-outlined">check</span>{sending ? t('eng.rev.sending', 'Sending…') : t('eng.rev.submit', 'Submit for review')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const OPEN_TIME_BUCKETS = ['1h', '3h', '6h', '12h', '24h', '48h', '+']

// Real per-language breakdown from `analytics.by_language` — confirmed field names via live curl:
// { locale, recipients, delivered, opened, clicked, open_rate, click_rate }. No per-language `revenue`
// field exists yet, so that column stays 0 until a real one is confirmed.
function mapLangBreakdown(byLanguage, t) {
  return (byLanguage ?? []).map(row => {
    const code   = row.locale || row.language || row.code
    const sent    = row.recipients ?? row.sent ?? 0
    const opened  = row.opened ?? row.opens ?? null
    const clicked = row.clicked ?? row.clicks ?? null
    const openRate  = row.open_rate  ?? (sent ? Math.round((opened  ?? 0) / sent * 1000) / 10 : 0)
    const clickRate = row.click_rate ?? (sent ? Math.round((clicked ?? 0) / sent * 1000) / 10 : 0)
    return { code, label: langDisplayName(code, t), sent, openRate, clickRate, revenue: row.revenue ?? 0, low: openRate < 20 }
  })
}

// Real opens-over-time from `analytics.opens_over_time` — confirmed to always be `[]` so far (no
// campaign has real open activity yet), so `{bucket, count}` field names are still inferred, not
// verified. Bars normalize to the max bucket; re-check field names once a populated response exists.
function mapOpensOverTime(opensOverTime) {
  const byBucket = {}
  ;(opensOverTime ?? []).forEach(row => { byBucket[row.bucket] = row.count ?? row.opens ?? 0 })
  const max = Math.max(1, ...OPEN_TIME_BUCKETS.map(b => byBucket[b] ?? 0))
  return OPEN_TIME_BUCKETS.map(b => Math.round(((byBucket[b] ?? 0) / max) * 100))
}

// Real per-contact top performers from `GET /campaigns/:id/top-performers` — endpoint and the
// `data.performers` wrapper confirmed via live curl, but every real example so far is `[]`
// (no test contact has ever purchased/clicked/opened), so field names inside each row are
// still guessed and defensively normalized here. Re-check once a populated response exists.
function mapTopPerformers(performers, sentAt, t) {
  const timeSince = (occurredAt) => {
    if (!occurredAt || !sentAt) return ''
    const diffMin = Math.round((new Date(occurredAt) - new Date(sentAt)) / 60000)
    if (diffMin < 60) return t('eng.an.time_min', { count: diffMin, defaultValue: '{{count}}min after send' })
    return t('eng.an.time_hr', { count: Math.round(diffMin / 60), defaultValue: '{{count}}h after send' })
  }
  return (performers ?? []).map(row => {
    const name = row.contact_name || row.name || [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || t('eng.an.contact_fallback', 'Contact')
    const action = row.action || row.event_type || row.type || 'clicked'
    const actionLabel = action === 'purchased' ? t('eng.an.action_purchased', 'Purchased')
      : action === 'opened' ? t('eng.an.action_opened', 'Opened')
      : t('eng.an.action_clicked', 'Clicked link')
    return { name, action, actionLabel, time: timeSince(row.occurred_at || row.created_at || row.timestamp) }
  })
}

function CampaignAnalyticsModal({ campaignId, onClose }) {
  const { t, i18n } = useTranslation()
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [performers, setPerformers] = useState([])

  useEffect(() => {
    if (!campaignId) return
    setLoading(true)
    setErrorMsg(null)
    apiFetch(`${API}/boutique/marketing/campaigns/${campaignId}/analytics`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) setData(res.data)
        else setErrorMsg(res?.message || t('eng.an.err_load', 'Failed to load analytics'))
      })
      .catch(() => setErrorMsg(t('eng.an.err_load', 'Failed to load analytics')))
      .finally(() => setLoading(false))
  }, [campaignId, i18n.language])

  useEffect(() => {
    if (!campaignId) return
    apiFetch(`${API}/boutique/marketing/campaigns/${campaignId}/top-performers`)
      .then(r => r.json())
      .then(res => { if (res?.success) setPerformers(res.data?.performers ?? []) })
      .catch(() => {})
  }, [campaignId])

  useEffect(() => {
    if (!campaignId) return
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [campaignId, onClose])

  if (!campaignId) return null

  const c      = data?.campaign || {}
  const counts = data?.counts   || {}
  const rates  = data?.rates    || {}

  const fmt    = (n) => (n == null ? '—' : Number(n).toLocaleString())
  const fmtPct = (r) => (r == null ? '—' : `${(+r).toFixed(1).replace(/\.0$/, '')}%`)

  const displayName = c.campaign_name || t('eng.an.campaign_fallback', 'Campaign')
  const dateLbl     = c.sent_at ? formatDate(c.sent_at) : c.status === 'draft' ? t('eng.an.draft_not_sent', 'Draft · not yet sent') : ''

  const revenue   = data?.attribution?.revenue ?? 0
  const purchases = data?.attribution?.orders  ?? 0

  const langRows      = mapLangBreakdown(data?.by_language, t)
  const timeBars       = mapOpensOverTime(data?.opens_over_time)
  const topPerformers = mapTopPerformers(performers, c.sent_at, t)
  const totalLangs    = langRows.length

  return (
    <>
      <div className="cam-modal-overlay" onClick={onClose} />
      <div className="cam-modal" role="dialog" aria-modal="true">
        <div className="cam-modal-hdr">
          <div className="cam-modal-title">{displayName} <em>— {t('eng.an.title_em', 'Analytics')}</em></div>
          <button className="cam-modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="cam-modal-body">
          {loading && (
            <div className="eng-loading">{t('eng.an.loading', 'Loading analytics…')}</div>
          )}
          {errorMsg && (
            <div className="eng-error">{errorMsg}</div>
          )}

          {!loading && !errorMsg && (
            <>
              {/* Top 4 KPI cards */}
              <div className="cam-modal-stats">
                <div className="cam-modal-stat">
                  <div className="cam-modal-stat-lbl">{t('eng.an.col_sent', 'Sent')}</div>
                  <div className="cam-modal-stat-val">{fmt(counts.sent)}</div>
                  <div className="cam-modal-stat-sub">{dateLbl}</div>
                </div>
                <div className="cam-modal-stat">
                  <div className="cam-modal-stat-lbl">{t('eng.ov.stat_opened', 'OPENED')}</div>
                  <div className="cam-modal-stat-val">{fmt(counts.opened)}</div>
                  <div className="cam-modal-stat-sub up">{t('eng.an.open_rate_val', { pct: fmtPct(rates.open), defaultValue: '{{pct}} open rate' })}</div>
                </div>
                <div className="cam-modal-stat">
                  <div className="cam-modal-stat-lbl">{t('eng.ov.stat_clicked', 'CLICKED')}</div>
                  <div className="cam-modal-stat-val">{fmt(counts.clicked)}</div>
                  <div className="cam-modal-stat-sub">{t('eng.an.ctr_val', { pct: fmtPct(rates.click), defaultValue: '{{pct}} CTR' })}</div>
                </div>
                <div className="cam-modal-stat">
                  <div className="cam-modal-stat-lbl">{t('eng.an.col_revenue', 'Revenue')}</div>
                  <div className="cam-modal-stat-val">€{fmt(revenue)}</div>
                  <div className="cam-modal-stat-sub up">{t('eng.an.purchases_attributed', { count: purchases, defaultValue: '{{count}} purchase(s) attributed' })}</div>
                </div>
              </div>

              {/* Delivery health */}
              {counts.sent > 0 && (
                <div className="cam-modal-card">
                  <div className="cam-modal-card-hdr">
                    <div className="cam-modal-card-title">{t('eng.an.delivery_health', 'Delivery')} <em>{t('eng.an.delivery_health_em', 'Health')}</em></div>
                  </div>
                  <div className="cam-modal-stats">
                    <div className="cam-modal-stat">
                      <div className="cam-modal-stat-lbl">{t('eng.an.stat_delivery_rate', 'DELIVERY RATE')}</div>
                      <div className="cam-modal-stat-val">{fmtPct(rates.delivery)}</div>
                    </div>
                    <div className="cam-modal-stat">
                      <div className="cam-modal-stat-lbl">{t('eng.an.stat_bounce_rate', 'BOUNCE RATE')}</div>
                      <div className="cam-modal-stat-val">{fmtPct(rates.bounce)}</div>
                    </div>
                    <div className="cam-modal-stat">
                      <div className="cam-modal-stat-lbl">{t('eng.an.stat_complaint_rate', 'COMPLAINT RATE')}</div>
                      <div className="cam-modal-stat-val">{fmtPct(rates.complaint)}</div>
                    </div>
                    <div className="cam-modal-stat">
                      <div className="cam-modal-stat-lbl">{t('eng.an.stat_unsubscribed', 'UNSUBSCRIBED')}</div>
                      <div className="cam-modal-stat-val">{fmt(counts.unsubscribed)}</div>
                    </div>
                  </div>
                  {(counts.bounced > 0 || counts.complained > 0 || counts.failed > 0 || counts.skipped > 0) && (
                    <div className="cam-modal-stats" style={{ marginTop:10 }}>
                      {counts.bounced    > 0 && <div className="cam-modal-stat"><div className="cam-modal-stat-lbl">{t('eng.an.stat_bounced', 'BOUNCED')}</div><div className="cam-modal-stat-val">{fmt(counts.bounced)}</div></div>}
                      {counts.complained > 0 && <div className="cam-modal-stat"><div className="cam-modal-stat-lbl">{t('eng.an.stat_complained', 'COMPLAINED')}</div><div className="cam-modal-stat-val">{fmt(counts.complained)}</div></div>}
                      {counts.failed     > 0 && <div className="cam-modal-stat"><div className="cam-modal-stat-lbl">{t('eng.an.stat_failed', 'FAILED')}</div><div className="cam-modal-stat-val">{fmt(counts.failed)}</div></div>}
                      {counts.skipped    > 0 && <div className="cam-modal-stat"><div className="cam-modal-stat-lbl">{t('eng.an.stat_skipped', 'SKIPPED')}</div><div className="cam-modal-stat-val">{fmt(counts.skipped)}</div></div>}
                    </div>
                  )}
                </div>
              )}

              {/* Performance by language */}
              {langRows.length > 0 && (
                <div className="cam-modal-card">
                  <div className="cam-modal-card-hdr">
                    <div className="cam-modal-card-title">{t('eng.an.perf_by', 'Performance by')} <em>{t('eng.an.perf_by_em', 'language')}</em></div>
                    <div className="cam-modal-card-meta">{t('eng.an.langs_meta', { count: totalLangs, defaultValue: '{{count}} LANGUAGES' })}</div>
                  </div>
                  <table className="cam-modal-tbl">
                    <thead>
                      <tr>
                        <th>{t('eng.an.col_lang', 'Language')}</th>
                        <th>{t('eng.an.col_sent', 'Sent')}</th>
                        <th>{t('eng.an.col_open', 'Open Rate')}</th>
                        <th>CTR</th>
                        <th>{t('eng.an.col_revenue', 'Revenue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {langRows.map(r => (
                        <tr key={r.code}>
                          <td>
                            <div className="cam-modal-lang-cell">
                              {LANG_META[r.code]?.flag
                                ? <span className="cam-modal-lang-flag">{LANG_META[r.code].flag}</span>
                                : <span className="cam-modal-lang-code">{LANG_META[r.code]?.code || (r.code || '').toUpperCase()}</span>
                              }
                              <div className="cam-modal-lang-name">{r.label}</div>
                            </div>
                          </td>
                          <td><strong>{r.sent}</strong></td>
                          <td>
                            <div className={`cam-modal-rate ${r.low ? 'low' : 'good'}`}>{r.openRate}%</div>
                            <div className="cam-modal-rate-track"><div className="cam-modal-rate-fill" style={{ width:`${r.openRate}%`, background: r.low ? 'var(--red)' : 'var(--green)' }} /></div>
                          </td>
                          <td><strong>{r.clickRate}%</strong></td>
                          <td><strong>€{r.revenue}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Row: Opens Over Time + Top Performers */}
              <div className="cam-modal-grid2">
                <div className="cam-modal-card">
                  <div className="cam-modal-card-hdr">
                    <div className="cam-modal-card-title">{t('eng.an.opens_time', 'Opens')} <em>{t('eng.an.opens_time_em', 'Over Time')}</em></div>
                  </div>
                  <div className="cam-modal-bars">
                    {['1h','3h','6h','12h','24h','48h','+'].map((lbl, i) => (
                      <div key={lbl} className="cam-modal-bar-col">
                        <div className="cam-modal-bar" style={{ height: counts.opened > 0 ? `${timeBars[i]}%` : '0%' }} />
                        <div className="cam-modal-bar-lbl">{lbl}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {topPerformers.length > 0 && (
                <div className="cam-modal-card">
                  <div className="cam-modal-card-hdr">
                    <div className="cam-modal-card-title">{t('eng.an.top_performers', 'Top')} <em>{t('eng.an.top_performers_em', 'Performers')}</em></div>
                  </div>
                  <table className="cam-modal-tbl compact">
                    <thead>
                      <tr>
                        <th>{t('eng.an.col_contact', 'Contact')}</th>
                        <th>{t('eng.an.col_action', 'Action')}</th>
                        <th>{t('eng.an.col_time', 'Time')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPerformers.map((p, i) => (
                        <tr key={i}>
                          <td>{p.name}</td>
                          <td>
                            <span className={`cam-modal-action ${p.action}`}>{p.actionLabel}</span>
                          </td>
                          <td className="eng-meta-sm">{p.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}


function LangBadge({ code }) {
  const m = LANG_META[code]
  if (!m) return <span>{code}</span>
  if (m.flag) return (
    <span className="lang-badge">
      <span className="lang-badge-flag">{m.flag}</span><span>{m.name}</span>
    </span>
  )
  return (
    <span className="lang-badge">
      <span className="lang-badge-code">{m.code}</span>
      <span>{m.name}</span>
    </span>
  )
}

function MiniTrend({ data, endLabel }) {
  const W = 580, H = 110, padL = 32, padR = 10, padT = 10, padB = 24
  const cW = W - padL - padR, cH = H - padT - padB
  const max = Math.max(...data) * 1.15
  const stepX = cW / (data.length - 1)
  const pts = data.map((v, i) => ({ x: padL + i * stepX, y: padT + cH - (v / max) * cH }))
  const lineStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
  const fillStr = `M ${padL},${padT + cH} ${pts.map(p => `L ${p.x},${p.y}`).join(' ')} L ${padL + (data.length - 1) * stepX},${padT + cH} Z`

  return (
    <div className="cdp-mini-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width:'100%', height:H }}>
        <defs>
          <linearGradient id="cdpMiniGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--gold)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padL} y1={padT}          x2={W - padR} y2={padT}          stroke="var(--mist)" strokeWidth="1" strokeDasharray="2,3" />
        <line x1={padL} y1={padT + cH/2}   x2={W - padR} y2={padT + cH/2}   stroke="var(--mist)" strokeWidth="1" strokeDasharray="2,3" />
        <line x1={padL} y1={padT + cH}     x2={W - padR} y2={padT + cH}     stroke="var(--mist)" strokeWidth="1" />
        <text x={padL - 5} y={padT + 4}          fontSize="9" fill="var(--stone)" textAnchor="end" fontFamily="Jost">{Math.round(max)}</text>
        <text x={padL - 5} y={padT + cH/2 + 3}   fontSize="9" fill="var(--stone)" textAnchor="end" fontFamily="Jost">{Math.round(max/2)}</text>
        <text x={padL - 5} y={padT + cH + 3}     fontSize="9" fill="var(--stone)" textAnchor="end" fontFamily="Jost">0</text>
        <path d={fillStr} fill="url(#cdpMiniGrad)" />
        <path d={lineStr} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--white)" stroke="var(--gold)" strokeWidth="1.5" />
        ))}
        <text x={padL}       y={H - 6} fontSize="9" fill="var(--stone)"                  fontFamily="Jost">0h</text>
        <text x={W - padR}   y={H - 6} fontSize="9" fill="var(--stone)" textAnchor="end" fontFamily="Jost">{endLabel || '15h'}</text>
      </svg>
    </div>
  )
}

function LinkHeatmap({ linkClicks }) {
  const totalClicks  = linkClicks.reduce((a, b) => a + b.clicks, 0)
  const topBubble    = linkClicks[0]
  const footerBubble = linkClicks.find(l => l.label.toLowerCase().includes('unsub')) || linkClicks[linkClicks.length - 1]
  const bubbleSize   = (n) => Math.max(20, Math.min(42, 18 + n * 0.5))

  return (
    <>
      <div className="cdp-sec-title">Link click distribution</div>
      <div className="cdp-heat">
        <div className="cdp-heat-email">
          <div className="cdp-heat-hdr">
            <div className="cdp-heat-logo">MI</div>
            <div className="cdp-heat-brand">Mi Italia · Where Fashion Begins</div>
          </div>
          <div className="cdp-heat-hero">Hero image</div>
          <div className="cdp-heat-body">
            <div className="cdp-heat-txt">Ciao {'{{name}}'}, discover our latest arrivals — hand-selected for you.</div>
            <div className="cdp-heat-cta-wrap">
              <button className="cdp-heat-cta">{topBubble.label.toUpperCase()} →</button>
              <div className="cdp-click-bubble" style={{
                width: bubbleSize(topBubble.clicks), height: bubbleSize(topBubble.clicks),
                background:'rgba(184,149,90,0.92)', top:-10, right:-14, fontSize:9,
              }}>{topBubble.clicks}</div>
            </div>
          </div>
          <div className="cdp-heat-footer">
            <a>Unsubscribe</a> · <a>Privacy</a>
            <div className="cdp-click-bubble" style={{
              width: bubbleSize(footerBubble.clicks), height: bubbleSize(footerBubble.clicks),
              background:'rgba(140,123,107,0.78)', top:-8, right:24, fontSize:8,
            }}>{footerBubble.clicks}</div>
          </div>
        </div>
        <div>
          <div className="cdp-click-breakdown-hdr">Click breakdown</div>
          <div className="cdp-click-list">
            {linkClicks.map((l, i) => (
              <div key={i} className="cdp-click-row">
                <div className="cdp-click-row-hdr">
                  <span>{l.label}</span>
                  <span className="cdp-click-val">
                    {l.clicks} <span className="cdp-click-pct">({l.pct}%)</span>
                  </span>
                </div>
                <div className="cdp-click-row-track">
                  <div className="cdp-click-row-fill" style={{ width:`${l.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="cdp-click-foot">
            {totalClicks} clicks across {linkClicks.length} tracked links.
          </div>
        </div>
      </div>
    </>
  )
}

// ── CAMPAIGN DETAIL PANEL (slide-out from analytics ROI table) ──
function CampaignDetailPanel({ campaignId, onClose }) {
  const { t, i18n } = useTranslation()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!campaignId) { setData(null); return }
    setLoading(true)
    apiFetch(`${API}/boutique/marketing/campaigns/${campaignId}/analytics`)
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [campaignId, i18n.language])

  useEffect(() => {
    if (!campaignId) return
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handleEsc); document.body.style.overflow = '' }
  }, [campaignId, onClose])

  if (!campaignId) return null

  if (loading) return (
    <>
      <div className="cdpanel-overlay" onClick={onClose} />
      <div className="cdpanel open">
        <div className="cdpanel-scroll"><div className="eng-loading">{t('eng.an.loading', 'Loading analytics…')}</div></div>
      </div>
    </>
  )

  if (!data) return null

  const camp   = data.campaign || {}
  const counts = data.counts || {}
  const rates  = data.rates || {}

  const channelIcon = camp.channel === 'wa' ? 'chat' : camp.channel === 'sms' ? 'sms' : 'mail'
  const channelCls  = camp.channel === 'wa' ? 'wa' : camp.channel === 'sms' ? 'print' : 'email'

  const funnelSteps = [
    { label:t('eng.an.funnel_recipients', 'Recipients'), val:counts.recipients, cls:'cdp-fnl-deep' },
    { label:t('eng.an.col_sent', 'Sent'),       val:counts.sent,       cls:'cdp-fnl-stone' },
    { label:t('eng.an.funnel_delivered', 'Delivered'),  val:counts.delivered,  cls:'cdp-fnl-gold' },
    { label:t('eng.an.funnel_opened', 'Opened'),     val:counts.opened,     cls:'cdp-fnl-goldk' },
    { label:t('eng.an.funnel_clicked', 'Clicked'),    val:counts.clicked,    cls:'cdp-fnl-green' },
  ].filter(s => s.val != null)

  const handleExportDetail = () => {
    const rows = [
      ['campaign_name', camp.campaign_name ?? ''],
      ['channel', camp.channel ?? ''],
      ['target_segment', camp.target_segment ?? ''],
      ['status', camp.status ?? ''],
      ['sent_at', camp.sent_at ?? ''],
      ['recipients', counts.recipients ?? ''],
      ['sent', counts.sent ?? ''],
      ['delivered', counts.delivered ?? ''],
      ['opened', counts.opened ?? ''],
      ['clicked', counts.clicked ?? ''],
      ['unsubscribed', counts.unsubscribed ?? ''],
      ['bounced', counts.bounced ?? ''],
      ['complained', counts.complained ?? ''],
      ['failed', counts.failed ?? ''],
      ['skipped', counts.skipped ?? ''],
      ['open_rate_pct', rates.open ?? ''],
      ['click_rate_pct', rates.click ?? ''],
      ['delivery_rate_pct', rates.delivery ?? ''],
      ['bounce_rate_pct', rates.bounce ?? ''],
      ['complaint_rate_pct', rates.complaint ?? ''],
    ]
    const csv = ['metric,value'].concat(rows.map(([k, v]) => `"${k}","${String(v).replace(/"/g, '""')}"`)).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(camp.campaign_name || 'campaign').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-analytics.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="cdpanel-overlay" onClick={onClose} />
      <div className="cdpanel open">
        <div className="cdpanel-hdr">
          <div className={`cdpanel-ico ${channelCls}`}>
            <span className="material-symbols-outlined">{channelIcon}</span>
          </div>
          <div className="cdpanel-hdr-info">
            <div className="cdpanel-title"><em>{camp.campaign_name}</em></div>
            <div className="cdpanel-sub">
              {camp.channel} · {camp.target_segment} · {camp.status}
              {camp.sent_at ? ` · ${t('eng.an.sent_on', { date: new Date(camp.sent_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }), defaultValue: 'Sent {{date}}' })}` : ''}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); handleExportDetail() }}>
            <span className="material-symbols-outlined">download</span>{t('common.export', 'Export')}
          </button>
          <button className="cdpanel-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="cdpanel-scroll">
          {/* Stats grid */}
          <div className="cdp-stats">
            <div className="cdp-stat">
              <div className="cdp-stat-val">{counts.sent?.toLocaleString() ?? 0}</div>
              <div className="cdp-stat-lbl">{t('eng.an.stat_sent', 'SENT')}</div>
            </div>
            <div className="cdp-stat">
              <div className="cdp-stat-val">{rates.open != null ? `${rates.open}%` : '—'}</div>
              <div className="cdp-stat-lbl">{t('eng.an.stat_open_rate', 'OPEN RATE')}</div>
            </div>
            <div className="cdp-stat">
              <div className="cdp-stat-val">{rates.click != null ? `${rates.click}%` : '—'}</div>
              <div className="cdp-stat-lbl">{t('eng.an.stat_click_rate', 'CLICK RATE')}</div>
            </div>
            <div className="cdp-stat">
              <div className="cdp-stat-val">{counts.unsubscribed ?? 0}</div>
              <div className="cdp-stat-lbl">{t('eng.an.stat_unsubscribed', 'UNSUBSCRIBED')}</div>
            </div>
          </div>

          {/* Delivery funnel */}
          <div className="cdp-sec-title">{t('eng.an.delivery_funnel', 'Delivery funnel')}</div>
          <div className="cdp-fnl">
            {funnelSteps.map((s, i) => {
              const pct = counts.recipients > 0 ? Math.round(s.val / counts.recipients * 100) : 0
              return (
                <div key={i}>
                  <div className="cdp-fnl-step">
                    <div className="cdp-fnl-bar-wrap">
                      <div className={`cdp-fnl-bar ${s.cls}`} style={{ width:`${Math.max(pct, 6)}%` }}>{s.label}</div>
                    </div>
                    <div className="cdp-fnl-right">
                      <div className="cdp-fnl-val">{s.val.toLocaleString()}</div>
                      <div className="cdp-fnl-pct">{pct}%</div>
                    </div>
                  </div>
                  {i < funnelSteps.length - 1 && <div className="cdp-fnl-connector" />}
                </div>
              )
            })}
          </div>

          {/* Delivery rate */}
          {rates.delivery != null && (
            <>
              <div className="cdp-sec-title">{t('eng.an.delivery', 'Delivery')}</div>
              <div className="cdp-stats">
                <div className="cdp-stat">
                  <div className="cdp-stat-val">{rates.delivery}%</div>
                  <div className="cdp-stat-lbl">{t('eng.an.stat_delivery_rate', 'DELIVERY RATE')}</div>
                </div>
                <div className="cdp-stat">
                  <div className="cdp-stat-val">{rates.bounce ?? 0}%</div>
                  <div className="cdp-stat-lbl">{t('eng.an.stat_bounce_rate', 'BOUNCE RATE')}</div>
                </div>
                <div className="cdp-stat">
                  <div className="cdp-stat-val">{rates.complaint ?? 0}%</div>
                  <div className="cdp-stat-lbl">{t('eng.an.stat_complaint_rate', 'COMPLAINT RATE')}</div>
                </div>
              </div>
            </>
          )}

          {/* Issues — only show if any */}
          {(counts.bounced > 0 || counts.complained > 0 || counts.failed > 0 || counts.skipped > 0) && (
            <>
              <div className="cdp-sec-title">{t('eng.an.issues', 'Issues')}</div>
              <div className="cdp-stats">
                {counts.bounced > 0 && <div className="cdp-stat"><div className="cdp-stat-val">{counts.bounced}</div><div className="cdp-stat-lbl">{t('eng.an.stat_bounced', 'BOUNCED')}</div></div>}
                {counts.complained > 0 && <div className="cdp-stat"><div className="cdp-stat-val">{counts.complained}</div><div className="cdp-stat-lbl">{t('eng.an.stat_complained', 'COMPLAINED')}</div></div>}
                {counts.failed > 0 && <div className="cdp-stat"><div className="cdp-stat-val">{counts.failed}</div><div className="cdp-stat-lbl">{t('eng.an.stat_failed', 'FAILED')}</div></div>}
                {counts.skipped > 0 && <div className="cdp-stat"><div className="cdp-stat-val">{counts.skipped}</div><div className="cdp-stat-lbl">{t('eng.an.stat_skipped', 'SKIPPED')}</div></div>}
              </div>
            </>
          )}

          {/* No data state */}
          {counts.sent === 0 && (
            <div className="an-tip-footer">
              <span className="material-symbols-outlined an-tip-footer-icon">info</span>
              <div>{t('eng.an.not_sent', "This campaign hasn't been sent yet. Analytics will appear after it's delivered.")}</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── MAIN: AnalyticsView (real data) ─────────────────────────

const AN_RANGE_TO_API = { ytd: 'ytd', '7d': '7d', '30d': '30d', '90d': '90d', '12m': '12m' }
const AN_COMPARE_TO_API = { none: 'none', prev: 'previous_period', prevyear: 'previous_year' }
const AN_KPI_UNIT = { currency: '€', percent: '', count: '' }
const AN_KPI_SUFFIX = { currency: '', percent: '%', count: '' }

function sparklinePoints(sparkline) {
  const values = (sparkline ?? []).map(p => Number(p.value) || 0)
  if (values.length === 0) return ''
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const range = max - min || 1
  const step = values.length > 1 ? 64 / (values.length - 1) : 0
  return values.map((v, i) => `${(i * step).toFixed(1)},${(28 - ((v - min) / range) * 26 - 1).toFixed(1)}`).join(' ')
}

function AnalyticsView() {
  const { t } = useTranslation()
  const [range,       setRange]       = useState('30d')
  const [compare,     setCompare]     = useState('none')
  const [customRange, setCustomRange] = useState(null)
  const [detailId,    setDetailId]    = useState(null)
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [errorMsg,    setErrorMsg]    = useState('')

  useEffect(() => {
    if (range === 'custom') return
    setLoading(true); setErrorMsg('')
    const apiRange = AN_RANGE_TO_API[range] ?? '30d'
    const apiCompare = AN_COMPARE_TO_API[compare] ?? 'none'
    apiFetch(`${API}/boutique/marketing/analytics?range=${apiRange}&compare=${apiCompare}`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) setData(res.data)
        else setErrorMsg(res?.message || t('eng.an.err_load', 'Failed to load analytics.'))
      })
      .catch(() => setErrorMsg(t('eng.an.err_network', 'Network error.')))
      .finally(() => setLoading(false))
  }, [range, compare])

  const periodLabel = (() => {
    if (range === 'custom') return t('eng.an.custom_not_supported', 'Custom ranges aren\'t supported yet — pick a preset above')
    if (!data?.range) return ''
    const base = `${formatDate(data.range.from)} — ${formatDate(data.range.to)}`
    if (compare === 'prev') return `${base} · ${t('eng.an.vs_prev_period', 'vs prev period')}`
    if (compare === 'prevyear') return `${base} · ${t('eng.an.vs_prev_year', { year: PR_TODAY.getFullYear() - 1, defaultValue: 'vs {{year}}' })}`
    return base
  })()

  const onOpenCampaignDetail = (id) => setDetailId(id)

  const kpis = data?.kpis ?? []
  const idr = data?.id_rate
  const revByChannel = data?.revenue_by_channel ?? []
  const funnel = data?.engagement_funnel
  const roiRows = data?.campaign_roi ?? []
  const handleExportRoi = () => {
    if (roiRows.length === 0) return
    const headers = ['campaign_name', 'channel', 'sent_at', 'recipients', 'open_rate', 'click_rate', 'orders', 'revenue', 'revenue_per_recipient']
    const csv = [headers.join(',')]
      .concat(roiRows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `campaign-performance-${range}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  const segHealth = data?.segment_health ?? []
  const cohorts = data?.cohort_retention?.cohorts ?? []
  const trackMonths = data?.cohort_retention?.track_months ?? 6

  const SALES_CHANNEL_META = {
    pos:    { label: t('eng.an.channel_pos', 'In-store (POS)'), icon: 'storefront' },
    ship:   { label: t('eng.an.channel_ship', 'Shipped'),        icon: 'local_shipping' },
    pickup: { label: t('eng.an.channel_pickup', 'Pickup'),       icon: 'inventory_2' },
  }
  const maxChannelRevenue = Math.max(1, ...revByChannel.map(r => Number(r.revenue) || 0))

  const funnelStages = funnel ? [
    { key:'sent',      icon:'campaign',      label:t('eng.an.funnel_sent', 'Sent'),       val: funnel.sent },
    { key:'delivered',  icon:'mark_email_read', label:t('eng.an.funnel_delivered', 'Delivered'), val: funnel.delivered },
    { key:'opened',     icon:'drafts',        label:t('eng.an.opened_read', 'Opened / read'), val: funnel.opened },
    { key:'clicked',    icon:'touch_app',     label:t('eng.an.clicked_replied', 'Clicked / replied'), val: funnel.clicked },
    { key:'purchased',  icon:'check_circle',  label:t('eng.an.action_purchased', 'Purchased'), val: funnel.purchased, success:true },
  ] : []
  const funnelTop = funnelStages[0]?.val || 1

  return (
    <div>
      {/* ── Range bar (shared component) ── */}
      <RangeBar
        range={range}
        compare={compare}
        customRange={customRange}
        periodLabel={periodLabel}
        presetKeys={['ytd', '7d', '30d', '90d', '12m']}
        onRangeChange={setRange}
        onCompareChange={setCompare}
        onCustomApply={r => { setCustomRange(r); setRange('custom') }}
        onExport={handleExportRoi}
      />

      {errorMsg && <div className="eng-error eng-mb18">{errorMsg}</div>}

      {range === 'custom' ? (
        <div className="eng-loading eng-mb18">{t('eng.an.custom_not_supported', 'Custom ranges aren\'t supported yet — pick a preset above')}</div>
      ) : loading ? (
        <div className="eng-loading eng-mb18">{t('eng.an.loading', 'Loading analytics…')}</div>
      ) : (
        <>
          {/* ── KPI hero strip ── */}
          <div className="an-kpi-grid">
            {kpis.map(k => {
              const isFlat = k.delta_pct == null || k.delta_pct === 0
              const isDown = (k.delta_pct ?? 0) < 0
              return (
                <div key={k.key} className="kpi-an">
                  <div className="kpi-an-lbl">{k.label}</div>
                  <div className="kpi-an-val">{AN_KPI_UNIT[k.unit] ?? ''}<em>{(k.value ?? 0).toLocaleString()}</em>{AN_KPI_SUFFIX[k.unit] ?? ''}</div>
                  <div className={`kpi-an-delta ${isFlat ? 'flat' : isDown ? 'down' : 'up'}`}>
                    <span className="material-symbols-outlined">{isFlat ? 'remove' : isDown ? 'trending_down' : 'trending_up'}</span>
                    {isFlat ? '—' : `${k.delta_pct > 0 ? '+' : ''}${k.delta_pct}%`}
                  </div>
                  <svg className="kpi-an-spark" width="64" height="28" viewBox="0 0 64 28">
                    <polyline points={sparklinePoints(k.sparkline)} fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )
            })}
          </div>

          {/* ── Identification rate + commission ── */}
          {idr && (
            <div className="chart-card eng-mb18">
              <div className="chart-hd">
                <div className="chart-hd-l">
                  <span className="material-symbols-outlined">monitoring</span>
                  <div>
                    <div className="chart-hd-ttl">{t('eng.an.id_trend', 'Identification')} <em>{t('eng.an.id_trend_em', 'rate trend')}</em></div>
                    <div className="chart-hd-sub">{t('eng.an.id_trend_sub_real', '% of orders where the buyer was identified, vs an anonymous POS sale.')}</div>
                  </div>
                </div>
              </div>

              <div className="idr-chart">
                <svg viewBox="0 0 800 280" preserveAspectRatio="none" className="idr-chart-svg">
                  <line className="idr-grid" x1="60" y1="240" x2="780" y2="240" />
                  <line className="idr-grid" x1="60" y1="185" x2="780" y2="185" />
                  <line className="idr-grid" x1="60" y1="130" x2="780" y2="130" />
                  <line className="idr-grid" x1="60" y1="75"  x2="780" y2="75"  />
                  <line className="idr-grid" x1="60" y1="20"  x2="780" y2="20"  />
                  <text className="idr-axis" x="55" y="244" textAnchor="end">0%</text>
                  <text className="idr-axis" x="55" y="189" textAnchor="end">25%</text>
                  <text className="idr-axis" x="55" y="134" textAnchor="end">50%</text>
                  <text className="idr-axis" x="55" y="79"  textAnchor="end">75%</text>
                  <text className="idr-axis" x="55" y="24"  textAnchor="end">100%</text>

                  {(() => {
                    const trend = idr.trend ?? []
                    if (trend.length === 0) return null
                    const step = trend.length > 1 ? 720 / (trend.length - 1) : 0
                    const pts = trend.map((pt, i) => [60 + i * step, 240 - (Math.min(100, Math.max(0, pt.id_rate_pct ?? 0)) / 100) * 220])
                    const pointsStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
                    const fillD = `M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')} L ${pts[pts.length - 1][0].toFixed(1)} 240 L 60 240 Z`
                    return (
                      <>
                        <path className="idr-fill" d={fillD} />
                        <polyline className="idr-line" points={pointsStr} />
                        {pts.map(([x, y], i) => <circle key={i} className={i === pts.length - 1 ? 'idr-current-dot' : 'idr-dot'} cx={x} cy={y} r={i === pts.length - 1 ? 5 : 3.5} />)}
                        {trend.map((pt, i) => (i % Math.ceil(trend.length / 10) === 0) && (
                          <text key={i} className="idr-axis" x={pts[i][0]} y="260" textAnchor="middle">{formatDate(pt.date).slice(0, 6)}</text>
                        ))}
                      </>
                    )
                  })()}
                </svg>
              </div>

              <div className="eng-card-footer-row">
                <div className="an-tier-item">
                  <strong className="eng-strong">{t('eng.an.current_id_rate', { pct: idr.current_pct, defaultValue: '{{pct}}% identified' })}</strong>
                  {idr.delta_pct != null && <span> · {idr.delta_pct > 0 ? '+' : ''}{idr.delta_pct}% {t('eng.an.vs_compare', 'vs comparison period')}</span>}
                </div>
                {idr.commission && (
                  <div className="an-tier-item eng-ml-auto eng-tnum">
                    <span>{t('eng.an.commission_contracted', 'Contracted:')} </span>
                    <strong className="eng-strong">{(idr.commission.commission_rate_pos * 100).toFixed(1)}% POS / {(idr.commission.commission_rate_ecom * 100).toFixed(1)}% online</strong>
                    <span> · {t('eng.an.commission_realized', 'Realized this period:')} </span>
                    <strong className="eng-green">€{(idr.commission.realized_commission ?? 0).toLocaleString()} ({idr.commission.realized_effective_rate_pct}%)</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Row 1: Revenue by sales channel + Funnel ── */}
          <div className="an-grid2">
            <div className="chart-card">
              <div className="chart-hd">
                <div className="chart-hd-l">
                  <span className="material-symbols-outlined">euro</span>
                  <div>
                    <div className="chart-hd-ttl">{t('eng.an.rev_channel_sales', 'Revenue by')} <em>{t('eng.an.rev_channel_em', 'sales channel')}</em></div>
                    <div className="chart-hd-sub">{t('eng.an.rev_channel_sales_sub', 'Where your orders came from this period — not campaign attribution.')}</div>
                  </div>
                </div>
              </div>

              {revByChannel.length === 0 ? (
                <div className="eng-loading">{t('eng.an.no_revenue_data', 'No revenue data for this range.')}</div>
              ) : (
                <div className="rev-chan">
                  {revByChannel.map(r => {
                    const meta = SALES_CHANNEL_META[r.channel] ?? { label: r.channel, icon: 'payments' }
                    const pct = Math.round((Number(r.revenue) / maxChannelRevenue) * 100)
                    return (
                      <div key={r.channel} className="rev-chan-row">
                        <div className="rev-chan-name">
                          <span className="material-symbols-outlined">{meta.icon}</span>
                          <span>{meta.label}</span>
                        </div>
                        <div className="rev-chan-bar"><div className="rev-chan-fill email" style={{ width:`${pct}%` }}>{r.pct_of_total}%</div></div>
                        <div className="rev-chan-val">€{(r.revenue ?? 0).toLocaleString()}<span className="sub">{r.orders} {t('eng.an.orders', 'orders')}</span></div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-hd">
                <div className="chart-hd-l">
                  <span className="material-symbols-outlined">filter_alt</span>
                  <div>
                    <div className="chart-hd-ttl">{t('eng.an.eng_funnel', 'Engagement')} <em>{t('eng.an.eng_funnel_em', 'funnel')}</em></div>
                    <div className="chart-hd-sub">{t('eng.an.eng_funnel_sub_real', 'Sent → delivered → opened → clicked → purchased, this period.')}</div>
                  </div>
                </div>
              </div>

              {!funnel ? (
                <div className="eng-loading">{t('eng.an.no_funnel_data', 'No campaign activity in this range yet.')}</div>
              ) : (
                <div className="funnel">
                  {funnelStages.map((s, i) => {
                    const pct = funnelTop ? Math.round(((s.val ?? 0) / funnelTop) * 1000) / 10 : 0
                    const prev = funnelStages[i - 1]
                    const dropPct = prev && prev.val ? Math.round((1 - (s.val ?? 0) / prev.val) * 1000) / 10 : null
                    return (
                      <div key={s.key}>
                        {dropPct != null && dropPct > 0 && (
                          <div className="funnel-drop">
                            <span className="material-symbols-outlined eng-icon-xs">south</span>
                            <strong>−{dropPct}%</strong>&nbsp;<span>{t('eng.an.drop_generic', { from: prev.label, defaultValue: "didn't continue past {{from}}" })}</span>
                          </div>
                        )}
                        <div className="funnel-step">
                          <div className="funnel-lbl">
                            <span className="material-symbols-outlined" style={s.success ? { color:'var(--green)' } : undefined}>{s.icon}</span>
                            <span>{s.label}</span>
                          </div>
                          <div className="funnel-bar-wrap">
                            <div className={`funnel-bar${s.success ? ' funnel-bar-success' : ''}`} style={{ width:`${pct}%` }}>{pct}%</div>
                          </div>
                          <div className="funnel-val" style={s.success ? { color:'var(--green)' } : undefined}>
                            {(s.val ?? 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Campaign ROI table ── */}
          <div className="chart-card eng-mb18">
            <div className="chart-hd">
              <div className="chart-hd-l">
                <span className="material-symbols-outlined">leaderboard</span>
                <div>
                  <div className="chart-hd-ttl">{t('eng.an.campaign_roi_title', 'Campaign')} <em>{t('eng.an.performance_em', 'Performance')}</em></div>
                  <div className="chart-hd-sub">{t('eng.an.roi_table_sub_real', 'Every campaign sent in the selected range. Revenue per recipient stands in for ROI — we don\'t have per-send cost data yet.')}</div>
                </div>
              </div>
            </div>

            {roiRows.length === 0 ? (
              <div className="eng-loading">{t('eng.an.no_sent_campaigns', 'No sent campaigns yet.')}</div>
            ) : (
              <table className="croi-tbl">
                <thead>
                  <tr>
                    <th>{t('eng.an.col_campaign', 'Campaign')}</th><th>{t('eng.an.col_date', 'Date')}</th>
                    <th className="num">{t('eng.an.col_sent', 'Sent')}</th><th className="num">{t('eng.an.col_open_short', 'Open')}</th><th className="num">{t('eng.an.col_click', 'Click')}</th>
                    <th className="num">{t('eng.an.col_orders', 'Orders')}</th><th className="num">{t('eng.an.col_revenue', 'Revenue')}</th><th className="num">{t('eng.an.col_rev_per_recipient', 'Rev/recipient')}</th>
                  </tr>
                </thead>
                <tbody>
                  {roiRows.map(c => {
                    const ch = channelKey(c.channel)
                    return (
                      <tr key={c.campaign_id} onClick={() => onOpenCampaignDetail(c.campaign_id)}>
                        <td>
                          <div className="croi-name">
                            <div className={`cn-ico ${ch}`}><span className="material-symbols-outlined">{ch === 'wa' ? 'chat' : ch === 'print' ? 'description' : 'mail'}</span></div>
                            <span>{c.campaign_name}</span>
                          </div>
                        </td>
                        <td className="eng-meta-sm">{c.sent_at ? formatDate(c.sent_at) : '—'}</td>
                        <td className="num">{c.recipients ?? 0}</td>
                        <td className="num">{c.open_rate != null ? `${c.open_rate}%` : '—'}</td>
                        <td className="num">{c.click_rate != null ? `${c.click_rate}%` : '—'}</td>
                        <td className="num">{c.orders ?? 0}</td>
                        <td className="num"><strong>€{(c.revenue ?? 0).toLocaleString()}</strong></td>
                        <td className="num">€{(c.revenue_per_recipient ?? 0).toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Row 2: Segment health + Cohort retention ── */}
          <div className="an-grid2-even">
            <div className="chart-card">
              <div className="chart-hd">
                <div className="chart-hd-l">
                  <span className="material-symbols-outlined">stacked_bar_chart</span>
                  <div>
                    <div className="chart-hd-ttl">{t('eng.an.seg_health', 'Segment')} <em>{t('eng.an.seg_health_em', 'health')}</em></div>
                    <div className="chart-hd-sub">{t('eng.an.seg_health_sub_real', 'Customers, engagement, and revenue by segment this period.')}</div>
                  </div>
                </div>
              </div>

              {segHealth.length === 0 ? (
                <div className="eng-loading">{t('eng.an.no_segment_data', 'No segment data for this range.')}</div>
              ) : (
                <div className="an-seg-footer" style={{ gridTemplateColumns:`repeat(${segHealth.length}, 1fr)` }}>
                  {segHealth.map(s => (
                    <div key={s.segment}>
                      <div className="an-seg-footer-lbl">{t(`eng.camp.seg_${s.segment}`, s.segment)}</div>
                      <div className="an-seg-footer-val">{s.customers}</div>
                      <div className="an-seg-delta" style={{ color: (s.delta_pct ?? 0) >= 0 ? 'var(--green)' : '#B45309' }}>
                        {s.delta_pct != null ? `${s.delta_pct >= 0 ? '↑ +' : '↓ '}${s.delta_pct}%` : '—'} · €{(s.revenue ?? 0).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-hd">
                <div className="chart-hd-l">
                  <span className="material-symbols-outlined">grid_on</span>
                  <div>
                    <div className="chart-hd-ttl">{t('eng.an.cohort_retention', 'Cohort')} <em>{t('eng.an.cohort_retention_em', 'retention')}</em></div>
                    <div className="chart-hd-sub">{t('eng.an.cohort_retention_sub', '% of customers from each month who returned in subsequent months. Higher numbers later = healthier base.')}</div>
                  </div>
                </div>
              </div>

              {cohorts.length === 0 ? (
                <div className="eng-loading">{t('eng.an.no_cohort_data', { months: trackMonths, defaultValue: 'Not enough history yet — cohort retention needs at least a few months of contact data.' })}</div>
              ) : (
                <div className="cohort">
                  <div className="cohort-hd cohort-row-lbl">{t('eng.an.acquired_in', 'Acquired in')}</div>
                  {Array.from({ length: trackMonths }, (_, i) => <div key={i} className="cohort-hd">{`M+${i}`}</div>)}
                  {cohorts.flatMap((row, ri) => [
                    <div key={`${ri}-name`} className="cohort-row-name">{row.acquired_month ?? row.month ?? '—'}<span className="sub">{t('eng.an.contacts_count', { count: row.contacts ?? 0, defaultValue: '{{count}} contacts' })}</span></div>,
                    ...Array.from({ length: trackMonths }, (_, ci) => {
                      const pct = (row.retention ?? row.months ?? [])[ci]?.pct ?? (row.retention ?? row.months ?? [])[ci]
                      return <div key={`${ri}-${ci}`} className={`cohort-cell ${pct == null ? 'empty' : 'c3'}`}>{pct == null ? '—' : `${pct}%`}</div>
                    }),
                  ])}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Footer note ── */}
      <div className="an-tip-footer">
        <span className="material-symbols-outlined an-tip-footer-icon">tips_and_updates</span>
        <div>
          <strong>{t('eng.an.all_shown', 'All Engagement metrics shown.')}</strong>
          <span> {t('eng.an.storewide_note', 'For store-wide analytics — POS revenue, product velocity, order volume — see')} </span>
          <span className="an-tip-link">{t('eng.an.storewide_link', 'Insights → Analytics')}</span>
          <span> {t('eng.an.storewide_note_suffix', 'in the sidebar.')}</span>
        </div>
      </div>
      <CampaignDetailPanel campaignId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}


// ── AUTOMATIONS ──────────────────────────────────────────
const AUTOMATION_ICONS = [
  { match: /lapsed/,      icon: 'schedule',       bg: 'rgba(217,119,6,0.08)',  color: '#B45309' },
  { match: /birthday/,    icon: 'celebration',    bg: 'rgba(99,91,255,0.08)',  color: 'var(--stripe)' },
  { match: /stock/,       icon: 'favorite',       bg: 'rgba(184,149,90,0.1)',  color: 'var(--gold)' },
  { match: /reservation/, icon: 'calendar_month', bg: 'rgba(99,91,255,0.08)', color: 'var(--stripe)' },
  { match: /purchase|welcome/, icon: 'shopping_bag', bg: 'rgba(0,108,53,0.08)', color: 'var(--green)' },
  { match: /new_contact/, icon: 'person_add',     bg: 'rgba(0,108,53,0.08)',  color: 'var(--green)' },
  { match: /vip/,         icon: 'star',           bg: 'rgba(184,149,90,0.1)', color: 'var(--gold)' },
]
const automationIcon = (triggerType) => AUTOMATION_ICONS.find(a => a.match.test(triggerType || '')) || { icon: 'bolt', bg: 'rgba(140,123,107,0.1)', color: 'var(--stone)' }

const AUTOMATION_SEG_LABELS = { all: 'All contacts', vip: 'VIP', loyal: 'Loyal', new: 'New', warm: 'Warm', lapsed: 'Lapsed' }

// Confirmed via live curl (400 validation error) against POST /boutique/marketing/automations:
// "trigger_type must be one of: new_contact, post_purchase, lapsed_customer, vip_reached, birthday, back_in_stock"
const AUTOMATION_TRIGGER_LABELS = {
  new_contact:     'New contact added',
  post_purchase:   'After a purchase',
  lapsed_customer: 'Customer went lapsed',
  vip_reached:     'Customer reached VIP',
  birthday:        "Customer's birthday",
  back_in_stock:   'Favorited item back in stock',
}

function AutomationsView() {
  const { t } = useTranslation()
  const [automations, setAutomations] = useState([])
  const [loading,      setLoading]     = useState(true)
  const [errorMsg,     setErrorMsg]    = useState('')
  const [busyId,       setBusyId]      = useState(null)
  const [showForm,     setShowForm]    = useState(false)
  const [editing,      setEditing]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,     setDeleting]    = useState(false)

  const refetch = () => {
    setLoading(true)
    automationApi.list()
      .then(res => { if (res?.success) setAutomations(res.data?.automations ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { refetch() }, [])

  const handleToggle = (a) => {
    setBusyId(a.id)
    automationApi.toggle(a.id, !a.enabled)
      .then(res => {
        if (res?.success) setAutomations(prev => prev.map(x => x.id === a.id ? res.data : x))
        else setErrorMsg(res?.message || t('eng.auto.err_toggle', 'Failed to update automation.'))
      })
      .catch(() => setErrorMsg(t('eng.auto.err_network', 'Network error.')))
      .finally(() => setBusyId(null))
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setDeleting(true)
    automationApi.delete(deleteTarget.id)
      .then(res => {
        if (res?.success) { setDeleteTarget(null); refetch() }
        else setErrorMsg(res?.message || t('eng.auto.err_delete', 'Failed to delete automation.'))
      })
      .catch(() => setErrorMsg(t('eng.auto.err_network', 'Network error.')))
      .finally(() => setDeleting(false))
  }

  return (
    <div>
      <div className="auto-header">
        <div className="auto-intro">{t('eng.auto.intro', 'Set triggers once — Mi Italia sends on your behalf whenever conditions are met.')}</div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>
          <span className="material-symbols-outlined">add</span>{t('eng.auto.create', 'Create Automation')}
        </button>
      </div>

      {errorMsg && <div className="eng-error">{errorMsg}</div>}

      {loading ? (
        <div className="eng-loading">{t('eng.auto.loading', 'Loading automations…')}</div>
      ) : automations.length === 0 ? (
        <div className="eng-loading">{t('eng.auto.empty', 'No automations yet — create one to get started.')}</div>
      ) : (
        <div className="auto-flow-list">
          {automations.map(a => {
            const ic = automationIcon(a.trigger_type)
            const ch = channelKey(a.channel)
            return (
              <div key={a.id} className="auto-flow-card">
                <div className="auto-flow-icon" style={{ background: ic.bg }}>
                  <span className="material-symbols-outlined" style={{ color: ic.color }}>{ic.icon}</span>
                </div>
                <div className="auto-flow-body">
                  <div className="auto-flow-title">{a.name}</div>
                  <div className="auto-flow-sub">
                    {t('eng.auto.desc_line', {
                      channel: ch === 'wa' ? t('eng.channels.wa', 'WhatsApp') : t('eng.channels.email', 'Email'),
                      trigger: AUTOMATION_TRIGGER_LABELS[a.trigger_type] || a.trigger_type,
                      segment: AUTOMATION_SEG_LABELS[a.target_segment] || a.target_segment,
                      delay: a.delay_hours ?? 0,
                      defaultValue: 'Channel: {{channel}} · Trigger: {{trigger}} · Segment: {{segment}} · Delay: {{delay}}h',
                    })}
                  </div>
                </div>
                <div className="auto-flow-hdr-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => { setEditing(a); setShowForm(true) }}>
                    <span className="material-symbols-outlined">edit</span>{t('common.edit', 'Edit')}
                  </button>
                  <button className="btn btn-outline btn-sm btn-red" onClick={() => setDeleteTarget(a)}>
                    <span className="material-symbols-outlined">delete</span>{t('common.delete', 'Delete')}
                  </button>
                </div>
                <Toggle on={!!a.enabled} onToggle={() => busyId !== a.id && handleToggle(a)} />
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <AutomationFormModal
          automation={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch() }}
        />
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('eng.auto.delete_title', 'Delete')} <em>{t('eng.auto.delete_title_em', 'Automation')}</em></div>
              <div className="modal-close" onClick={() => !deleting && setDeleteTarget(null)}><span className="material-symbols-outlined">close</span></div>
            </div>
            <div>{t('eng.auto.confirm_delete', { name: deleteTarget.name, defaultValue: 'Delete "{{name}}"? This cannot be undone.' })}</div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t('common.cancel', 'Cancel')}</button>
              <button className="btn btn-red" onClick={confirmDelete} disabled={deleting}>
                <span className="material-symbols-outlined">delete</span>{deleting ? t('eng.camp.deleting', 'Deleting…') : t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AutomationFormModal({ automation, onClose, onSaved }) {
  const { t } = useTranslation()
  const isEdit = !!automation
  const [name,        setName]        = useState(automation?.name ?? '')
  const [triggerType, setTriggerType] = useState(automation?.trigger_type ?? 'lapsed_customer')
  const [channel,     setChannel]     = useState(channelKey(automation?.channel) === 'wa' ? 'wa' : 'email')
  const [subject,     setSubject]     = useState(automation?.subject ?? '')
  const [message,     setMessage]     = useState(automation?.message ?? '')
  const [segment,     setSegment]     = useState(automation?.target_segment ?? 'all')
  const [delayHours,  setDelayHours]  = useState(automation?.delay_hours ?? 0)
  const [enabled,     setEnabled]     = useState(automation?.enabled ?? true)
  const [saving,       setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const handleSave = async () => {
    if (!name.trim() || !triggerType.trim() || !message.trim()) {
      setError(t('eng.auto.err_required', 'Name, trigger type, and message are required.')); return
    }
    setSaving(true); setError('')
    const payload = {
      name: name.trim(), trigger_type: triggerType.trim(), channel,
      subject: subject.trim() || undefined, message: message.trim(),
      target_segment: segment, delay_hours: Number(delayHours) || 0, enabled,
    }
    try {
      const res = isEdit ? await automationApi.update(automation.id, payload) : await automationApi.create(payload)
      if (res?.success) onSaved()
      else setError(res?.message || t('eng.auto.err_save', 'Failed to save automation.'))
    } catch { setError(t('eng.auto.err_network', 'Network error.')) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{isEdit ? t('eng.auto.edit_title', 'Edit') : t('eng.auto.create_title', 'Create')} <em>{t('eng.auto.form_title_em', 'Automation')}</em></div>
          <div className="modal-close" onClick={() => !saving && onClose()}><span className="material-symbols-outlined">close</span></div>
        </div>
        {error && <div className="eng-error">{error}</div>}
        <div className="form-group">
          <label className="form-lbl">{t('eng.auto.name', 'Name')}</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-row2">
          <div className="form-group">
            <label className="form-lbl">{t('eng.auto.trigger_type', 'Trigger type')}</label>
            <div className="select-wrap">
              <select className="form-select" value={triggerType} onChange={e => setTriggerType(e.target.value)}>
                {Object.entries(AUTOMATION_TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <span className="material-symbols-outlined select-arrow">expand_more</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('eng.auto.delay_hours', 'Delay (hours)')}</label>
            <input className="form-input" type="number" min="0" value={delayHours} onChange={e => setDelayHours(e.target.value)} />
          </div>
        </div>
        <div className="form-row2">
          <div className="form-group">
            <label className="form-lbl">{t('eng.camp.step1_channel', 'Channel')}</label>
            <div className="select-wrap">
              <select className="form-select" value={channel} onChange={e => setChannel(e.target.value)}>
                <option value="email">{t('eng.channels.email', 'Email')}</option>
                <option value="wa">{t('eng.channels.wa', 'WhatsApp')}</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('eng.ov.col_seg', 'Segment')}</label>
            <div className="select-wrap">
              <select className="form-select" value={segment} onChange={e => setSegment(e.target.value)}>
                {Object.entries(AUTOMATION_SEG_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="form-group">
          <label className="form-lbl">{t('eng.camp.subject', 'Subject')} ({t('common.optional', 'optional')})</label>
          <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-lbl">{t('eng.camp.body', 'Message')}</label>
          <textarea className="form-textarea ct-notes-textarea" value={message} onChange={e => setMessage(e.target.value)} />
        </div>
        <div className="refine-row">
          <div className="refine-body">
            <div className="refine-title">{t('eng.auto.enabled', 'Enabled')}</div>
          </div>
          <Toggle on={enabled} onToggle={() => setEnabled(v => !v)} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>{t('common.cancel', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t('eng.set.saving', 'Saving…') : t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── FAVORITES ────────────────────────────────────────────
function FavoritesView() {
  const { t } = useTranslation()
  const [products,      setProducts]      = useState([])
  const [loading,        setLoading]       = useState(true)
  const [errorMsg,       setErrorMsg]      = useState('')
  const [saversFor,      setSaversFor]     = useState(null)
  const [savers,         setSavers]        = useState([])
  const [saversLoading,  setSaversLoading] = useState(false)
  const [saversError,    setSaversError]   = useState('')
  const [notifyTarget,   setNotifyTarget]  = useState(null)
  const [notifyMsg,      setNotifyMsg]     = useState('')
  const [notifying,      setNotifying]     = useState(false)
  const [notifyResult,   setNotifyResult]  = useState(null)

  const [lowStockSweeping, setLowStockSweeping] = useState(false)
  const [lowStockResult,   setLowStockResult]   = useState(null)

  const [campaignTarget,  setCampaignTarget]  = useState(null)
  const [campaignChannel, setCampaignChannel] = useState('email')
  const [campaignSubject, setCampaignSubject] = useState('')
  const [campaignMessage, setCampaignMessage] = useState('')
  const [campaignSending, setCampaignSending] = useState(false)
  const [campaignResult,  setCampaignResult]  = useState(null)

  const [viewMode,    setViewMode]    = useState('products') // 'products' | 'customers'
  const [custQuery,   setCustQuery]   = useState('')
  const [custSegment, setCustSegment] = useState('')
  const [custSort,    setCustSort]    = useState('last_favorited')
  const [custOrder,   setCustOrder]   = useState('desc')
  const [custPage,    setCustPage]    = useState(1)
  const [custTotal,   setCustTotal]   = useState(0)
  const [custHasMore, setCustHasMore] = useState(false)
  const [favCustomers,        setFavCustomers]        = useState([])
  const [favCustomersLoading, setFavCustomersLoading] = useState(false)
  const [favCustomersError,   setFavCustomersError]   = useState('')

  const FAV_CUST_PAGE_SIZE = 20
  const refetchFavCustomers = (targetPage = custPage) => {
    setFavCustomersLoading(true); setFavCustomersError('')
    const params = { sort: custSort, order: custOrder, page: String(targetPage), limit: String(FAV_CUST_PAGE_SIZE) }
    if (custQuery.trim()) params.search = custQuery.trim()
    if (custSegment) params.segment = custSegment
    favoritesApi.contacts(params)
      .then(res => {
        if (res?.success) {
          setFavCustomers(res.data?.contacts ?? [])
          setCustPage(targetPage)
          const pg = res.data?.pagination
          setCustTotal(pg?.total ?? 0)
          setCustHasMore(!!pg?.has_more)
        } else setFavCustomersError(res?.message || t('eng.fav.err_load', 'Failed to load favorites.'))
      })
      .catch(() => setFavCustomersError(t('eng.fav.err_network', 'Network error.')))
      .finally(() => setFavCustomersLoading(false))
  }

  useEffect(() => {
    if (viewMode !== 'customers') return
    refetchFavCustomers(1)
  }, [viewMode, custSort, custOrder, custSegment])

  const isFirstCustSearch = useRef(true)
  useEffect(() => {
    if (viewMode !== 'customers') return
    if (isFirstCustSearch.current) { isFirstCustSearch.current = false; return }
    const timer = setTimeout(() => refetchFavCustomers(1), 400)
    return () => clearTimeout(timer)
  }, [custQuery])

  const goToCustPage = (targetPage) => {
    if (targetPage < 1 || favCustomersLoading) return
    refetchFavCustomers(targetPage)
  }

  useEffect(() => {
    setLoading(true)
    favoritesApi.products(50)
      .then(res => {
        if (res?.success) setProducts(res.data?.products ?? [])
        else setErrorMsg(res?.message || t('eng.fav.err_load', 'Failed to load favorites.'))
      })
      .catch(() => setErrorMsg(t('eng.fav.err_network', 'Network error.')))
      .finally(() => setLoading(false))
  }, [])

  const totalSavers = products.reduce((s, p) => s + (p.saver_count ?? 0), 0)
  const restockCandidates = products.filter(p => (p.total_stock ?? 0) === 0 && (p.saver_count ?? 0) > 0)
  const mostSaved = products.length ? products.reduce((a, b) => (b.saver_count ?? 0) > (a.saver_count ?? 0) ? b : a) : null

  const openSavers = (p) => {
    setSaversFor(p); setSavers([]); setSaversError(''); setSaversLoading(true)
    favoritesApi.savers(p.product_id)
      .then(res => {
        if (res?.success) setSavers(res.data?.savers ?? [])
        else setSaversError(res?.message || t('eng.fav.err_savers', 'Failed to load savers.'))
      })
      .catch(() => setSaversError(t('eng.fav.err_network', 'Network error.')))
      .finally(() => setSaversLoading(false))
  }

  const openNotify = (p) => { setNotifyTarget(p); setNotifyMsg(''); setNotifyResult(null) }
  const sendNotify = () => {
    if (!notifyTarget) return
    setNotifying(true)
    favoritesApi.notifyRestock(notifyTarget.product_id, notifyMsg.trim() || t('eng.fav.default_restock_msg', 'Good news — the item you saved is back in stock!'))
      .then(res => {
        if (res?.success) setNotifyResult({ ...res.data, message: res.message })
        else setNotifyResult({ error: res?.message || t('eng.fav.err_notify', 'Failed to notify savers.') })
      })
      .catch(() => setNotifyResult({ error: t('eng.fav.err_network', 'Network error.') }))
      .finally(() => setNotifying(false))
  }

  const runLowStockSweep = () => {
    setLowStockSweeping(true); setLowStockResult(null)
    favoritesApi.alertLowStock()
      .then(res => {
        if (res?.success) setLowStockResult({ ...res.data, message: res.message })
        else setLowStockResult({ error: res?.message || t('eng.fav.err_alert', 'Failed to alert savers.') })
      })
      .catch(() => setLowStockResult({ error: t('eng.fav.err_network', 'Network error.') }))
      .finally(() => setLowStockSweeping(false))
  }

  const openCampaignToSavers = (p) => { setCampaignTarget(p); setCampaignChannel('email'); setCampaignSubject(''); setCampaignMessage(''); setCampaignResult(null) }
  const sendCampaignToSavers = () => {
    if (!campaignTarget || !campaignMessage.trim()) return
    setCampaignSending(true)
    favoritesApi.campaignToSavers({
      product_id: campaignTarget.product_id,
      channel: campaignChannel,
      subject: campaignChannel === 'email' ? (campaignSubject.trim() || undefined) : undefined,
      message: campaignMessage.trim(),
      send_now: true,
    })
      .then(res => {
        if (res?.success) setCampaignResult({ ...res.data, message: res.message })
        else setCampaignResult({ error: res?.message || t('eng.fav.err_campaign', 'Failed to send campaign.') })
      })
      .catch(() => setCampaignResult({ error: t('eng.fav.err_network', 'Network error.') }))
      .finally(() => setCampaignSending(false))
  }

  return (
    <div>
      <div className="card-hdr eng-mb18">
        <div className="card-title">{t('eng.fav.title', 'Product')} <em>{t('eng.fav.title_em', 'Favorites')}</em></div>
        <button className="btn btn-outline btn-sm" disabled={lowStockSweeping} onClick={runLowStockSweep}>
          <span className="material-symbols-outlined">notifications_active</span>
          {lowStockSweeping ? t('eng.rev.sending', 'Sending…') : t('eng.fav.alert_low_stock', 'Alert Low-Stock Savers')}
        </button>
      </div>
      {lowStockResult && (
        <div className={lowStockResult.error ? 'eng-error eng-mb18' : 'eng-success eng-mb18'}>
          {lowStockResult.error || lowStockResult.message || t('eng.fav.low_stock_result', { products: lowStockResult.products_alerted ?? 0, notified: lowStockResult.notified ?? 0, defaultValue: 'Alerted savers of {{products}} product(s) · {{notified}} notified.' })}
        </div>
      )}

      {/* KPI Row — derived from the real product-favorites leaderboard, no fabricated totals */}
      <div className="stat-row col3 eng-mb18">
        <div className="stat-card">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-email">favorite</span>
            {t('eng.fav.total_saves', 'Total Product Saves')}
          </div>
          <div className="stat-val">{totalSavers}</div>
          <div className="stat-sub">{t('eng.fav.across_products', { count: products.length, defaultValue: 'Across {{count}} products' })}</div>
        </div>
        <div className="stat-card fav-out">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined fav-oos-icon">inventory_2</span>
            {t('eng.fav.restock_candidates', 'Out-of-Stock, Saved')}
          </div>
          <div className="stat-val">{restockCandidates.length}</div>
          <div className="stat-sub">{t('eng.fav.restock_candidates_sub', 'Products worth a restock alert')}</div>
        </div>
        <div className="stat-card fav-most">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-email">star</span>
            {t('eng.fav.most_saved_product', 'Most-Saved Product')}
          </div>
          <div className="stat-val fav-most-val">{mostSaved ? mostSaved.product_name : '—'}</div>
          <div className="stat-sub">{mostSaved ? t('eng.fav.most_saved_product_sub_real', { count: mostSaved.saver_count ?? 0, defaultValue: '{{count}} customer(s) saved this' }) : ''}</div>
        </div>
      </div>

      <div className="tpl-filter-row eng-mb18">
        <div className={`tpl-chip${viewMode === 'products' ? ' on' : ''}`} style={{ cursor:'pointer' }} onClick={() => setViewMode('products')}>{t('eng.fav.by_product', 'By Product')}</div>
        <div className={`tpl-chip${viewMode === 'customers' ? ' on' : ''}`} style={{ cursor:'pointer' }} onClick={() => setViewMode('customers')}>{t('eng.fav.by_customer', 'By Customer')}</div>
      </div>

      {viewMode === 'products' ? (
        <>
      {errorMsg && <div className="eng-error">{errorMsg}</div>}

      {loading ? (
        <div className="eng-loading">{t('eng.fav.loading', 'Loading favorites…')}</div>
      ) : products.length === 0 ? (
        <div className="eng-loading">{t('eng.fav.empty', 'No products have been saved yet.')}</div>
      ) : (
        products.map(p => {
          const stock = p.total_stock ?? 0
          const stockCls = stock === 0 ? 'out' : stock <= 3 ? 'low' : 'in-stock'
          const stockTxt = stock === 0 ? t('eng.fav.out_of_stock', 'Out of stock') : stock <= 3 ? t('eng.fav.low_stock_n', { count: stock, defaultValue: 'Low stock · {{count}} left' }) : t('eng.fav.in_stock', 'In stock')
          const img = favImgSrc(p.image_url)
          return (
            <div key={p.product_id} className="pfav-card">
              <div className="pfav-inner">
                <div className="pfav-img">
                  {img ? <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '👗'}
                  {stock === 0 && <div className="pfav-stock-badge" style={{ background:'rgba(197,0,26,0.9)', color:'white' }}>{t('eng.fav.out_of_stock', 'Out of stock').toUpperCase()}</div>}
                </div>
                <div className="pfav-body">
                  <div className="pfav-name">{p.product_name}</div>
                  <div className="pfav-meta">
                    <span><strong>€{p.retail_price}</strong></span>
                    <span>·</span>
                    <span className={`status ${stockCls}`}>{stockTxt}</span>
                  </div>
                  <div className="pfav-savers">
                    <div className="saver-count">{t('eng.fav.saver_count', { count: p.saver_count ?? 0, defaultValue: '{{count}} customer(s) have this saved' })}</div>
                  </div>
                </div>
              </div>
              <div className="pfav-actions">
                {stock === 0 && (p.saver_count ?? 0) > 0 && (
                  <button className="btn btn-primary btn-sm" onClick={() => openNotify(p)}>
                    <span className="material-symbols-outlined">notifications_active</span>{t('eng.fav.notify_savers', { count: p.saver_count, defaultValue: 'Notify {{count}} savers when restocked' })}
                  </button>
                )}
                {(p.saver_count ?? 0) > 0 && (
                  <button className="btn btn-outline btn-sm" onClick={() => openCampaignToSavers(p)}>
                    <span className="material-symbols-outlined">campaign</span>{t('eng.fav.campaign_to_savers', 'Send Campaign to Savers')}
                  </button>
                )}
                <button className="btn btn-outline btn-sm" onClick={() => openSavers(p)}>
                  <span className="material-symbols-outlined">people</span>{t('eng.fav.view_savers', { count: p.saver_count ?? 0, defaultValue: 'View all {{count}} savers' })}
                </button>
              </div>
            </div>
          )
        })
      )}
        </>
      ) : (
        <>
          <div className="ct-search eng-mb18">
            <span className="material-symbols-outlined">search</span>
            <input placeholder={t('eng.fav.search_customers', 'Search customers…')} value={custQuery} onChange={e => setCustQuery(e.target.value)} />
          </div>
          <div className="tpl-filter-row eng-mb18">
            {[
              { key:'',       label:t('eng.camp.ch_all', 'All') },
              { key:'vip',    label:t('eng.camp.seg_vip', 'VIP') },
              { key:'loyal',  label:t('eng.camp.seg_loyal', 'Loyal') },
              { key:'new',    label:t('eng.camp.seg_new', 'New') },
              { key:'warm',   label:t('eng.camp.seg_warm', 'Warm') },
              { key:'lapsed', label:t('eng.camp.seg_lapsed', 'Lapsed') },
            ].map(s => (
              <div key={s.key} className={`tpl-chip${custSegment === s.key ? ' on' : ''}`} style={{ cursor:'pointer' }} onClick={() => setCustSegment(s.key)}>{s.label}</div>
            ))}
            <div className="select-wrap" style={{ width:'auto', marginLeft:'auto' }}>
              <select className="form-select" value={`${custSort}:${custOrder}`} onChange={e => { const [s, o] = e.target.value.split(':'); setCustSort(s); setCustOrder(o) }}>
                <option value="last_favorited:desc">{t('eng.fav.sort_recent', 'Most recently favorited')}</option>
                <option value="favorite_count:desc">{t('eng.fav.sort_most_saves', 'Most saves')}</option>
                <option value="name:asc">{t('eng.fav.sort_name', 'Name (A-Z)')}</option>
              </select>
            </div>
          </div>

          {favCustomersError && <div className="eng-error">{favCustomersError}</div>}

          {favCustomersLoading ? (
            <div className="eng-loading">{t('eng.fav.loading', 'Loading favorites…')}</div>
          ) : favCustomers.length === 0 ? (
            <div className="eng-loading">{t('eng.fav.no_customers', 'No customers have saved anything yet.')}</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('eng.ct.col_contact', 'Contact')}</th><th>{t('eng.ov.col_seg', 'Segment')}</th>
                  <th>{t('eng.fav.col_saves', 'Saves')}</th><th>{t('eng.fav.col_last_favorited', 'Last favorited')}</th>
                </tr>
              </thead>
              <tbody>
                {favCustomers.map((c, i) => (
                  <tr key={c.id ?? c.user_id ?? i}>
                    <td>
                      {c.name || t('eng.ct.unnamed', 'Unnamed')}
                      {!c.has_contact_record && <span className="tpl-review-txt" style={{ marginLeft:8 }}>{t('eng.fav.webshop_only', 'Webshop only')}</span>}
                    </td>
                    <td>{c.segment ? <SegBadge seg={c.segment} /> : '—'}</td>
                    <td>{c.favorite_count ?? 0}</td>
                    <td className="eng-meta-sm">{c.last_favorited_at ? timeAgo(c.last_favorited_at, t) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="ct-table-footer">
            <span>{t('eng.ct.showing_loaded', { shown: favCustomers.length, total: custTotal, defaultValue: 'Showing {{shown}} of {{total}} contacts' })}</span>
            <div className="ct-footer-btns">
              <button className="btn btn-outline btn-xs" disabled={custPage <= 1 || favCustomersLoading} onClick={() => goToCustPage(custPage - 1)}>{t('eng.ct.prev', '← Prev')}</button>
              <span>{t('eng.ct.page_n', { page: custPage, defaultValue: 'Page {{page}}' })}</span>
              <button className="btn btn-outline btn-xs" disabled={!custHasMore || favCustomersLoading} onClick={() => goToCustPage(custPage + 1)}>{t('eng.ct.next', 'Next →')}</button>
            </div>
          </div>
        </>
      )}

      {saversFor && (
        <div className="modal-backdrop" onClick={() => setSaversFor(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('eng.fav.savers_title', 'Savers')} <em>{saversFor.product_name}</em></div>
              <div className="modal-close" onClick={() => setSaversFor(null)}><span className="material-symbols-outlined">close</span></div>
            </div>
            {saversLoading ? (
              <div className="eng-loading">{t('eng.fav.loading_savers', 'Loading savers…')}</div>
            ) : saversError ? (
              <div className="eng-error">{saversError}</div>
            ) : savers.length === 0 ? (
              <div className="eng-loading">{t('eng.fav.no_savers', 'No savers to show.')}</div>
            ) : (
              <ul className="eng-send-failures" style={{ color:'inherit' }}>
                {savers.map((s, i) => <li key={s.id ?? s.customer_id ?? i}>{s.name || s.email || s.customer_id || JSON.stringify(s)}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {notifyTarget && (
        <div className="modal-backdrop">
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('eng.fav.notify_title', 'Notify')} <em>{t('eng.fav.notify_title_em', 'Savers')}</em></div>
              <div className="modal-close" onClick={() => !notifying && setNotifyTarget(null)}><span className="material-symbols-outlined">close</span></div>
            </div>
            {!notifyResult ? (
              <>
                <div className="form-group">
                  <label className="form-lbl">{t('eng.fav.notify_message', 'Message')}</label>
                  <textarea className="form-textarea ct-notes-textarea" placeholder={t('eng.fav.default_restock_msg', 'Good news — the item you saved is back in stock!')} value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)} />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setNotifyTarget(null)} disabled={notifying}>{t('common.cancel', 'Cancel')}</button>
                  <button className="btn btn-primary" onClick={sendNotify} disabled={notifying}>
                    <span className="material-symbols-outlined">send</span>{notifying ? t('eng.rev.sending', 'Sending…') : t('eng.fav.notify_send', 'Notify')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={notifyResult.error ? 'eng-error' : 'eng-success'}>
                  {notifyResult.error || notifyResult.message || t('eng.fav.notify_result', { notified: notifyResult.notified ?? 0, total: notifyResult.total ?? 0, defaultValue: 'Notified {{notified}} of {{total}} saver(s).' })}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={() => setNotifyTarget(null)}>{t('common.done', 'Done')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {campaignTarget && (
        <div className="modal-backdrop">
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('eng.fav.campaign_title', 'Campaign to')} <em>{t('eng.fav.campaign_title_em', 'Savers')}</em></div>
              <div className="modal-close" onClick={() => !campaignSending && setCampaignTarget(null)}><span className="material-symbols-outlined">close</span></div>
            </div>
            {!campaignResult ? (
              <>
                <div className="form-hint eng-mb18">{t('eng.fav.campaign_hint', { count: campaignTarget.saver_count ?? 0, product: campaignTarget.product_name, defaultValue: 'Sends a real campaign to the {{count}} customer(s) who saved "{{product}}".' })}</div>
                <div className="form-group">
                  <label className="form-lbl">{t('eng.camp.channel', 'Channel')}</label>
                  <div className="select-wrap">
                    <select className="form-select" value={campaignChannel} onChange={e => setCampaignChannel(e.target.value)}>
                      <option value="email">{t('eng.channels.email', 'Email')}</option>
                      <option value="whatsapp">{t('eng.channels.wa', 'WhatsApp')}</option>
                      <option value="push">{t('eng.tpl.push', 'Push')}</option>
                    </select>
                  </div>
                </div>
                {campaignChannel === 'email' && (
                  <div className="form-group">
                    <label className="form-lbl">{t('eng.rev.subject', 'SUBJECT')}</label>
                    <input className="form-input" placeholder={t('eng.fav.campaign_subject_placeholder', 'Still thinking about this one?')} value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-lbl">{t('eng.rev.body', 'BODY')}</label>
                  <textarea className="form-textarea ct-notes-textarea" placeholder={t('eng.fav.campaign_message_placeholder', 'Hi {{name}}, the piece you saved is still available — come see it before it\'s gone!')} value={campaignMessage} onChange={e => setCampaignMessage(e.target.value)} />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setCampaignTarget(null)} disabled={campaignSending}>{t('common.cancel', 'Cancel')}</button>
                  <button className="btn btn-primary" onClick={sendCampaignToSavers} disabled={campaignSending || !campaignMessage.trim()}>
                    <span className="material-symbols-outlined">send</span>{campaignSending ? t('eng.rev.sending', 'Sending…') : t('eng.fav.campaign_send', 'Send Campaign')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={campaignResult.error ? 'eng-error' : 'eng-success'}>
                  {campaignResult.error || campaignResult.message || t('eng.fav.campaign_result', { count: campaignResult.recipients_count ?? 0, defaultValue: 'Campaign sent to {{count}} recipient(s).' })}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={() => setCampaignTarget(null)}>{t('common.done', 'Done')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}



// ── TEMPLATES VIEW (real data) ────────────────────────────
function templateChannelLabel(ch, t) {
  return ch === 'whatsapp' ? t('eng.channels.wa', 'WhatsApp') : ch === 'push' ? t('eng.tpl.push', 'Push') : t('eng.channels.email', 'Email')
}
function templateChannelTag(ch, t) {
  return ch === 'whatsapp' ? `💬 ${t('eng.channels.wa', 'WhatsApp')}` : ch === 'push' ? `🔔 ${t('eng.tpl.push', 'Push')}` : `📧 ${t('eng.channels.email', 'Email')}`
}
const tplChDotClass = (ch) => ch === 'whatsapp' ? 'wa' : ch === 'push' ? 'push' : 'email'

function RealTemplateFormModal({ template, onClose, onSaved }) {
  const { t } = useTranslation()
  const isEdit = !!template?.id
  const primaryContent = template?.content?.[template?.primary_language] ?? {}
  const [templateKey, setTemplateKey] = useState(template?.template_key ?? '')
  const [primaryLang, setPrimaryLang] = useState(template?.primary_language ?? 'it')
  const [channel,     setChannel]     = useState(template?.channel ?? 'email')
  const [subject,     setSubject]     = useState(primaryContent.subject ?? '')
  const [text,        setText]        = useState(primaryContent.text ?? '')
  const [title,       setTitle]       = useState(primaryContent.title ?? '')
  const [body,        setBody]        = useState(primaryContent.body ?? '')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const handleSave = async () => {
    if (!isEdit && !templateKey.trim()) { setError(t('eng.tpl.err_key_required', 'Template key is required.')); return }
    let content
    if (channel === 'whatsapp') {
      if (!body.trim()) { setError(t('eng.tpl.err_body_required', 'Body is required.')); return }
      content = { body: body.trim() }
    } else if (channel === 'push') {
      if (!title.trim() || !body.trim()) { setError(t('eng.tpl.err_title_body_required', 'Title and body are required.')); return }
      content = { title: title.trim(), body: body.trim() }
    } else {
      if (!subject.trim() || !text.trim()) { setError(t('eng.tpl.err_content_required', 'Subject and body are required.')); return }
      content = { subject: subject.trim(), html: `<p>${text.trim()}</p>`, text: text.trim() }
    }
    setSaving(true); setError('')
    try {
      const res = isEdit
        ? await templateApi.update(template.id, { content })
        : await templateApi.create({ templateKey: templateKey.trim(), channel, primaryLanguage: primaryLang, content })
      if (res?.success) onSaved(res.data?.template?.id)
      else setError(res?.message || t('eng.tpl.err_save', 'Failed to save template.'))
    } catch { setError(t('eng.tpl.err_network', 'Network error.')) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{isEdit ? t('eng.tpl.edit_real_title', 'Edit') : t('eng.tpl.create_real_title', 'Create')} <em>{t('eng.tpl.form_title_em', 'Template')}</em></div>
          <div className="modal-close" onClick={() => !saving && onClose()}><span className="material-symbols-outlined">close</span></div>
        </div>
        {error && <div className="eng-error">{error}</div>}
        {!isEdit ? (
          <>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('eng.tpl.template_key', 'Template key')}</label>
                <input className="form-input" placeholder={t('eng.tpl.template_key_placeholder', 'name, eg. aw25_new_arrivals')} value={templateKey} onChange={e => setTemplateKey(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('eng.tpl.primary_language', 'Primary language')}</label>
                <div className="select-wrap">
                  <select className="form-select" value={primaryLang} onChange={e => setPrimaryLang(e.target.value)}>
                    {Object.keys(LANG_MAP).map(code => <option key={code} value={code}>{langDisplayName(code, t)}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('eng.tpl.channel', 'Channel')}</label>
              <div className="select-wrap">
                <select className="form-select" value={channel} onChange={e => setChannel(e.target.value)}>
                  <option value="email">{t('eng.channels.email', 'Email')}</option>
                  <option value="whatsapp">{t('eng.channels.wa', 'WhatsApp')}</option>
                  <option value="push">{t('eng.tpl.push', 'Push')}</option>
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className="form-hint eng-mb18">{t('eng.tpl.editing_primary_hint', { lang: langDisplayName(template.primary_language, t), defaultValue: 'Editing the {{lang}} (primary) content. Saving invalidates existing translations — re-translate afterward.' })}</div>
        )}
        {channel === 'whatsapp' ? (
          <div className="form-group">
            <label className="form-lbl">{t('eng.rev.body', 'BODY')}</label>
            <textarea className="form-textarea ct-notes-textarea" value={body} onChange={e => setBody(e.target.value)} />
          </div>
        ) : channel === 'push' ? (
          <>
            <div className="form-group">
              <label className="form-lbl">{t('eng.tpl.sec_title', 'TITLE')}</label>
              <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('eng.rev.body', 'BODY')}</label>
              <textarea className="form-textarea ct-notes-textarea" value={body} onChange={e => setBody(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label className="form-lbl">{t('eng.rev.subject', 'SUBJECT')}</label>
              <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('eng.rev.body', 'BODY')}</label>
              <textarea className="form-textarea ct-notes-textarea" value={text} onChange={e => setText(e.target.value)} />
            </div>
          </>
        )}
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>{t('common.cancel', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('eng.set.saving', 'Saving…') : t('common.save', 'Save')}</button>
        </div>
      </div>
    </div>
  )
}

function TemplateRequestModal({ requestName, setRequestName, requestChannel, setRequestChannel, requestDescribe, setRequestDescribe, requestError, requestSending, requestSent, onClose, onSubmit }) {
  const { t } = useTranslation()
  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('eng.tpl.request_title', 'Request a')} <em>{t('eng.tpl.request_title_em', 'Custom Template')}</em></div>
          <div className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></div>
        </div>
        <div className="alert alert-info"><span className="material-symbols-outlined">info</span><div dangerouslySetInnerHTML={{ __html: t('eng.tpl.request_timeline_hint', 'Mi Italia will build, translate, and submit your custom template. Timeline: <strong>3–5 business days</strong> for Email/Push · <strong>5–10 days</strong> for WhatsApp (Meta review).') }} /></div>
        {requestSent ? (
          <>
            <div className="eng-success">{t('eng.tpl.request_sent', 'Request submitted — Mi Italia will follow up on the timeline above.')}</div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>{t('common.done', 'Done')}</button>
            </div>
          </>
        ) : (
          <>
            {requestError && <div className="eng-error">{requestError}</div>}
            <div className="form-group"><label className="form-lbl">{t('eng.tpl.template_name', 'Template Name')} *</label><input className="form-input" placeholder="e.g. Post-Purchase Thank You" value={requestName} onChange={e => setRequestName(e.target.value)} /></div>
            <div className="form-group">
              <label className="form-lbl">{t('eng.tpl.channels_needed', 'Channel Needed')}</label>
              <div className="select-wrap">
                <select className="form-select" value={requestChannel} onChange={e => setRequestChannel(e.target.value)}>
                  <option value="email">{t('eng.tpl.email_only', 'Email')}</option>
                  <option value="whatsapp">{t('eng.tpl.wa_only', 'WhatsApp')}</option>
                  <option value="push">{t('eng.tpl.push_only', 'Push')}</option>
                </select>
                <span className="material-symbols-outlined select-arrow">expand_more</span>
              </div>
            </div>
            <div className="form-group"><label className="form-lbl">{t('eng.tpl.describe_need', 'Describe what you need')} *</label><textarea className="form-textarea" rows={4} placeholder="Purpose, audience, sections, specific requirements…" value={requestDescribe} onChange={e => setRequestDescribe(e.target.value)} /></div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={onClose} disabled={requestSending}>{t('common.cancel', 'Cancel')}</button>
              <button className="btn btn-primary" onClick={onSubmit} disabled={requestSending}><span className="material-symbols-outlined">send</span>{requestSending ? t('eng.rev.sending', 'Sending…') : t('eng.tpl.submit_template_request', 'Submit Template Request')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TemplatesView({ onNavigateToBuilder, emailSettings }) {
  const { t } = useTranslation()
  const [templates,     setTemplates]     = useState([])
  const [loadingList,   setLoadingList]   = useState(true)
  const [selId,         setSelId]         = useState(null)
  const [tplDetail,     setTplDetail]     = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab,     setActiveTab]     = useState('structure')
  const [searchQ,       setSearchQ]       = useState('')
  const [channelFilter, setChannelFilter] = useState('all')
  const [previewLang,   setPreviewLang]   = useState(null)

  const [showForm,     setShowForm]     = useState(false)
  const [editingTpl,   setEditingTpl]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState('')

  const [variables,        setVariables]        = useState([])
  const [variablesLoading, setVariablesLoading] = useState(true)
  const [perf,             setPerf]             = useState(null)
  const [perfLoading,      setPerfLoading]      = useState(false)
  const [versions,         setVersions]         = useState([])
  const [versionsLoading,  setVersionsLoading]  = useState(false)
  const [changeRequests,        setChangeRequests]        = useState([])
  const [changeRequestsLoading, setChangeRequestsLoading] = useState(false)
  const [changeRequestText,    setChangeRequestText]    = useState('')
  const [changeRequestSending, setChangeRequestSending] = useState(false)
  const [changeRequestError,   setChangeRequestError]   = useState('')

  const [langBusy, setLangBusy] = useState(null)
  const [langNote, setLangNote] = useState('')

  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestName,       setRequestName]       = useState('')
  const [requestChannel,    setRequestChannel]    = useState('email')
  const [requestDescribe,   setRequestDescribe]   = useState('')
  const [requestError,      setRequestError]      = useState('')
  const [requestSending,    setRequestSending]    = useState(false)
  const [requestSent,       setRequestSent]       = useState(false)

  const refetchTemplates = () => {
    setLoadingList(true)
    templateApi.list()
      .then(res => { if (res?.success) setTemplates(res.data?.templates ?? []) })
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }
  useEffect(() => { refetchTemplates() }, [])

  useEffect(() => {
    templateApi.variables()
      .then(res => { if (res?.success) setVariables(res.data?.variables ?? []) })
      .catch(() => {})
      .finally(() => setVariablesLoading(false))
  }, [])

  // Keep a valid selection once the list loads or changes
  useEffect(() => {
    if (templates.length === 0) { setSelId(null); return }
    if (selId == null || !templates.some(x => x.id === selId)) setSelId(templates[0].id)
  }, [templates])

  const refetchChangeRequests = (id) => {
    setChangeRequestsLoading(true)
    templateApi.changeRequests(id)
      .then(res => { if (res?.success) setChangeRequests(res.data?.change_requests ?? []) })
      .catch(() => {})
      .finally(() => setChangeRequestsLoading(false))
  }

  // Fetch full detail + performance/versions/change-requests whenever selection changes
  useEffect(() => {
    if (!selId) { setTplDetail(null); return }
    setDetailLoading(true)
    templateApi.get(selId).then(res => {
      if (res?.success) {
        setTplDetail(res.data?.template)
        setPreviewLang(res.data?.template?.primary_language ?? null)
      }
    }).catch(() => {}).finally(() => setDetailLoading(false))

    setPerfLoading(true)
    templateApi.performance(selId).then(res => { if (res?.success) setPerf(res.data) }).catch(() => {}).finally(() => setPerfLoading(false))

    setVersionsLoading(true)
    templateApi.versions(selId).then(res => { if (res?.success) setVersions(res.data?.versions ?? []) }).catch(() => {}).finally(() => setVersionsLoading(false))

    refetchChangeRequests(selId)
    setActiveTab('structure')
    setLangNote('')
  }, [selId])

  const filteredTemplates = templates.filter(tpl => {
    if (channelFilter !== 'all' && tpl.channel !== channelFilter) return false
    if (searchQ.trim() && !templateDisplayName(tpl.template_key, t).toLowerCase().includes(searchQ.trim().toLowerCase())) return false
    return true
  })

  const openCreate = () => { setEditingTpl(null); setShowForm(true) }
  const openEdit = async (tpl) => {
    const res = await templateApi.get(tpl.id).catch(() => null)
    setEditingTpl(res?.success ? res.data?.template : tpl)
    setShowForm(true)
  }
  const onFormSaved = (savedId) => {
    setShowForm(false)
    refetchTemplates()
    if (savedId) setSelId(savedId)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setDeleting(true); setDeleteError('')
    templateApi.delete(deleteTarget.id)
      .then(res => {
        if (res?.success) { setDeleteTarget(null); refetchTemplates() }
        else setDeleteError(res?.message || t('eng.tpl.err_delete', 'Failed to delete template.'))
      })
      .catch(() => setDeleteError(t('eng.tpl.err_network', 'Network error.')))
      .finally(() => setDeleting(false))
  }

  const retranslateLang = (code) => {
    if (!selId) return
    setLangBusy(code); setLangNote('')
    templateApi.translate(selId, code).then(res => {
      if (res?.success) {
        setLangNote(t('eng.tpl.retranslate_queued_lang', { lang: langDisplayName(code, t), defaultValue: 'Translation queued for {{lang}}.' }))
        templateApi.get(selId).then(r => { if (r?.success) setTplDetail(r.data?.template) })
      } else {
        setLangNote(res?.message || t('eng.tpl.err_request_failed', 'Request failed.'))
      }
    }).catch(() => setLangNote(t('eng.tpl.err_network', 'Network error'))).finally(() => setLangBusy(null))
  }

  const submitChangeRequest = () => {
    if (!selId || !changeRequestText.trim()) return
    setChangeRequestSending(true); setChangeRequestError('')
    templateApi.submitChangeRequest(selId, changeRequestText.trim())
      .then(res => {
        if (res?.success) { setChangeRequestText(''); refetchChangeRequests(selId) }
        else setChangeRequestError(res?.message || t('eng.tpl.err_request_failed', 'Request failed.'))
      })
      .catch(() => setChangeRequestError(t('eng.tpl.err_network', 'Network error')))
      .finally(() => setChangeRequestSending(false))
  }

  const closeRequestModal = () => {
    setShowRequestModal(false); setRequestName(''); setRequestChannel('email'); setRequestDescribe(''); setRequestError(''); setRequestSent(false)
  }
  const handleSubmitRequest = () => {
    if (!requestName.trim() || !requestDescribe.trim()) {
      setRequestError(t('eng.tpl.err_required', 'Template name and description are required'))
      return
    }
    setRequestError('')
    setRequestSending(true)
    apiFetch(`${API}/boutique/marketing/template-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: requestChannel, title: requestName.trim(), brief: requestDescribe.trim() }),
    }).then(r => r.json()).then(res => {
      if (res?.success) setRequestSent(true)
      else setRequestError(res?.message || t('eng.tpl.err_request_failed', 'Request failed.'))
    }).catch(() => setRequestError(t('eng.tpl.err_network', 'Network error.')))
      .finally(() => setRequestSending(false))
  }

  const TABS = [
    { key:'structure',   label:t('eng.tpl.tab_structure', 'Structure') },
    { key:'preview',     label:t('common.preview', 'Preview') },
    { key:'languages',   label:t('eng.tpl.tab_languages', 'Languages') },
    { key:'performance', label:t('eng.tpl.tab_performance', 'Performance') },
    { key:'versions',    label:t('eng.tpl.versions', 'Versions') },
    { key:'variables',   label:t('eng.tpl.tab_variables', 'Variables') },
  ]

  const content = tplDetail?.content?.[previewLang] ?? tplDetail?.content?.[tplDetail?.primary_language] ?? {}

  return (
    <>
    <div className="tpl-wrap">
      {/* ── LIBRARY PANEL ── */}
      <div className="tpl-library">
        <div className="tpl-lib-hdr">
          <div className="tpl-lib-title">{t('eng.tpl.lib_title', 'Campaign')} <em>{t('eng.tpl.lib_title_em', 'Templates')}</em></div>
          <div className="tpl-lib-count">{t('eng.tpl.lib_count_real', { count: templates.length, defaultValue: '{{count}} template(s)' })}</div>
        </div>

        <div className="tpl-lib-search">
          <span className="material-symbols-outlined">search</span>
          <input placeholder={t('eng.tpl.search_templates', 'Search templates…')} value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>

        <div className="tpl-filters">
          <div className="tpl-filter-row">
            <div className={`tpl-chip${channelFilter === 'all' ? ' on' : ''}`} style={{ cursor:'pointer' }} onClick={() => setChannelFilter('all')}>{t('eng.camp.ch_all', 'All')}</div>
            <div className={`tpl-chip${channelFilter === 'email' ? ' email-on' : ''}`} style={{ cursor:'pointer' }} onClick={() => setChannelFilter('email')}>📧 {t('eng.channels.email', 'Email')}</div>
            <div className={`tpl-chip${channelFilter === 'whatsapp' ? ' wa-on' : ''}`} style={{ cursor:'pointer' }} onClick={() => setChannelFilter('whatsapp')}>💬 {t('eng.channels.wa', 'WhatsApp')}</div>
            <div className={`tpl-chip${channelFilter === 'push' ? ' push-on' : ''}`} style={{ cursor:'pointer' }} onClick={() => setChannelFilter('push')}>🔔 {t('eng.tpl.push', 'Push')}</div>
          </div>
        </div>

        <div className="tpl-lib-list">
          <button className="btn btn-primary btn-sm" style={{ marginBottom:12 }} onClick={openCreate}>
            <span className="material-symbols-outlined">add</span>{t('eng.tpl.create_real', 'Create Template')}
          </button>
          {loadingList ? (
            <div className="eng-loading">{t('eng.tpl.loading_real', 'Loading templates…')}</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="eng-loading">{t('eng.tpl.no_real_templates', 'No templates yet.')}</div>
          ) : (
            filteredTemplates.map(tpl => (
              <div key={tpl.id} className={`tpl-row${selId === tpl.id ? ' sel' : ''}`} onClick={() => setSelId(tpl.id)}>
                <div className="tpl-row-thumb">{templateEmoji(tpl.template_key)}</div>
                <div className="tpl-row-body">
                  <div className="tpl-row-name">{templateDisplayName(tpl.template_key, t)}</div>
                  <div className="tpl-row-meta">
                    <span className="tpl-row-meta"><span className={`tpl-ch-dot ${tplChDotClass(tpl.channel)}`} />{templateChannelLabel(tpl.channel, t)}</span>
                    {tpl.translations_pending && <span className="tpl-review-txt">{t('eng.tpl.translations_pending', 'Translations pending')}</span>}
                  </div>
                </div>
                <button className="btn btn-outline btn-xs btn-red" onClick={e => { e.stopPropagation(); setDeleteTarget(tpl) }}>{t('common.delete', 'Delete')}</button>
              </div>
            ))
          )}

          <div className="tpl-request" onClick={() => setShowRequestModal(true)}>
            <div className="material-symbols-outlined tpl-request-icon">add_circle</div>
            <div className="tpl-request-title">{t('eng.tpl.request_title_full', 'Request a Custom Template')}</div>
            <div className="tpl-request-sub">{t('eng.tpl.request_sub', 'Mi Italia builds and approves it · 3–5 business days')}</div>
          </div>
        </div>
      </div>

      {/* ── DETAIL PANEL ── */}
      <div className="tpl-detail">
        <div className="tpl-detail-inner">
          {!tplDetail ? (
            <div className="eng-loading">{detailLoading ? t('eng.tpl.loading_real', 'Loading…') : t('eng.tpl.no_selection', 'Select a template, or create one to get started.')}</div>
          ) : (
            <>
              <div className="tpl-det-hdr">
                <div className="tpl-det-top">
                  <div className="tpl-det-thumb">{templateEmoji(tplDetail.template_key)}</div>
                  <div className="tpl-det-title-block">
                    <div className="tpl-det-name">{templateDisplayName(tplDetail.template_key, t)}</div>
                    <div className="tpl-det-tags">
                      <div className={`tpl-det-tag ${tplChDotClass(tplDetail.channel)}`}>{templateChannelTag(tplDetail.channel, t)}</div>
                      <div className="tpl-det-tag">{langDisplayName(tplDetail.primary_language, t)} · {t('eng.tpl.source', 'source')}</div>
                      {tplDetail.translations_pending && <div className="tpl-det-tag">{t('eng.tpl.translations_pending', 'Translations pending')}</div>}
                    </div>
                  </div>
                  <div className="tpl-det-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(tplDetail)}><span className="material-symbols-outlined">edit</span>{t('common.edit', 'Edit')}</button>
                    <button className="btn btn-primary" onClick={() => onNavigateToBuilder?.(tplDetail.id, tplDetail.channel)}><span className="material-symbols-outlined">campaign</span>{t('eng.tpl.use_template', 'Use Template')}</button>
                  </div>
                </div>
              </div>

              {perf && (
                <div className="tpl-stats">
                  <div className="tpl-stat"><div className="tpl-stat-val">{perf.usage_count ?? 0}</div><div className="tpl-stat-lbl">{t('eng.tpl.stat_times_used', 'Times Used')}</div></div>
                  <div className="tpl-stat"><div className="tpl-stat-val">{perf.rates?.open != null ? `${perf.rates.open}%` : '—'}</div><div className="tpl-stat-lbl">{t('eng.tpl.stat_avg_open', 'Avg Open Rate')}</div></div>
                  <div className="tpl-stat"><div className="tpl-stat-val">{perf.rates?.click != null ? `${perf.rates.click}%` : '—'}</div><div className="tpl-stat-lbl">{t('eng.tpl.stat_avg_click', 'Avg Click Rate')}</div></div>
                  <div className="tpl-stat"><div className="tpl-stat-val">{perf.counts?.recipients ?? 0}</div><div className="tpl-stat-lbl">{t('eng.tpl.stat_recipients', 'Recipients')}</div></div>
                </div>
              )}

              <div className="tpl-tabs">
                {TABS.map(tab => (
                  <div key={tab.key} className={`tpl-tab${activeTab === tab.key ? ' act' : ''}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</div>
                ))}
              </div>

              {activeTab === 'structure' && (
                <div>
                  <div className="alert alert-info">
                    <span className="material-symbols-outlined">info</span>
                    <div>{t('eng.tpl.structure_hint_real', 'This is the primary-language content. Click Edit to change it — saving invalidates existing translations.')}</div>
                  </div>
                  {tplDetail.channel === 'whatsapp' ? (
                    <div className="tpl-ts">
                      <div className="cdp-sec-title">{t('eng.tpl.sec_body_short', 'Body')}</div>
                      <div className="tpl-ts-field-val fixed-val">{content.body || '—'}</div>
                    </div>
                  ) : tplDetail.channel === 'push' ? (
                    <div className="tpl-ts">
                      <div className="cdp-sec-title">{t('eng.tpl.sec_title', 'Title')}</div>
                      <div className="tpl-ts-field-val fixed-val">{content.title || '—'}</div>
                      <div className="cdp-sec-title">{t('eng.tpl.sec_body_short', 'Body')}</div>
                      <div className="tpl-ts-field-val fixed-val">{content.body || '—'}</div>
                    </div>
                  ) : (
                    <div className="tpl-ts">
                      <div className="cdp-sec-title">{t('eng.rev.subject', 'Subject')}</div>
                      <div className="tpl-ts-field-val fixed-val">{content.subject || '—'}</div>
                      <div className="cdp-sec-title">{t('eng.rev.body', 'Body')}</div>
                      <div className="tpl-ts-field-val fixed-val">{content.text || '—'}</div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'preview' && (
                <div>
                  {Object.keys(tplDetail.content || {}).length > 1 && (
                    <div className="select-wrap" style={{ maxWidth:220, marginBottom:12 }}>
                      <select className="form-select" value={previewLang || ''} onChange={e => setPreviewLang(e.target.value)}>
                        {Object.keys(tplDetail.content).map(code => <option key={code} value={code}>{langDisplayName(code, t)}</option>)}
                      </select>
                    </div>
                  )}
                  {tplDetail.channel === 'email' && (
                    <div className="tpl-email-frame">
                      <div className="tpl-ef-topbar">
                        <div className="tpl-ef-dots"><div className="tpl-ef-dot" style={{background:'#FF5F57'}} /><div className="tpl-ef-dot" style={{background:'#FFBD2E'}} /><div className="tpl-ef-dot" style={{background:'#28C840'}} /></div>
                        <div className="tpl-ef-urlbar">mail.google.com</div>
                      </div>
                      <div className="tpl-ef-subj-bar">
                        <div className="tpl-ef-from">{t('eng.tpl.from_label', 'From:')} {emailSettings ? `${emailSettings.sender_display_name} <${emailSettings.reply_to_email || `${emailSettings.sender_local_part}@${emailSettings.sender_domain}`}>` : t('common.loading', 'Loading...')}</div>
                        <div className="tpl-ef-subj">{content.subject || '—'}</div>
                      </div>
                      <div className="tpl-ef-body">
                        {content.html
                          ? <div dangerouslySetInnerHTML={{ __html: content.html }} />
                          : <div className="tpl-ef-content"><div className="tpl-ef-txt">{(content.text || '—').split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</div></div>}
                      </div>
                    </div>
                  )}
                  {tplDetail.channel === 'whatsapp' && (
                    <div className="tpl-wa-frame">
                      <div className="tpl-wa-top">
                        <div className="tpl-wa-av">{templateEmoji(tplDetail.template_key)}</div>
                        <div><div className="tpl-wa-biz">{t('eng.tpl.wa_preview_biz', 'Your Boutique')}</div></div>
                      </div>
                      <div className="tpl-wa-chat">
                        <div className="tpl-wa-bubble">
                          <div className="tpl-wa-bub-body"><div className="tpl-wa-bub-txt">{(content.body || '—').split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</div></div>
                        </div>
                      </div>
                    </div>
                  )}
                  {tplDetail.channel === 'push' && (
                    <div className="tpl-push-wrap">
                      <div className="tpl-push-device">
                        <div className="tpl-push-bg">
                          <div className="tpl-push-notif">
                            <div className="tpl-pn-row1"><div className="tpl-pn-app-ico">MI</div><div className="tpl-pn-app-name">Mi Italia</div></div>
                            <div className="tpl-pn-title">{content.title || '—'}</div>
                            <div className="tpl-pn-body">{content.body || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'languages' && (
                <div>
                  <div className="alert alert-info">
                    <span className="material-symbols-outlined">translate</span>
                    <div>{t('eng.tpl.langs_hint_real', 'Contacts receive this template in their preferred language automatically. Missing languages fall back to the primary language.')}</div>
                  </div>
                  <div className="tpl-lang-grid">
                    {Object.keys(LANG_MAP).map(code => {
                      const ready = !!tplDetail.content?.[code]
                      const isPrimary = code === tplDetail.primary_language
                      return (
                        <div key={code} className={`tpl-lang-card${ready ? ' sel' : ' unavail'}`}>
                          <div className="tpl-lang-flag">{LANG_MAP[code].flag}</div>
                          <div className="tpl-lang-name">{langDisplayName(code, t)}</div>
                          <div className={`tpl-lang-status${ready ? ' ready' : ' unavail'}`}>
                            {isPrimary ? t('eng.rev.source_tag', 'Source') : ready ? `✓ ${t('eng.tpl.status_approved_ready', 'Ready')}` : t('eng.tpl.status_not_available', 'Not yet translated')}
                          </div>
                          {!isPrimary && (
                            <button className="btn btn-outline btn-xs" disabled={!!langBusy} onClick={() => retranslateLang(code)} style={{ marginTop:6 }}>
                              {langBusy === code ? t('eng.tpl.requesting', 'Requesting…') : ready ? t('eng.tpl.retranslate', 'Re-translate') : t('eng.tpl.translate', 'Translate')}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {langNote && <div className="alert alert-warn" style={{ marginTop:10 }}>{langNote}</div>}
                </div>
              )}

              {activeTab === 'performance' && (
                <div>
                  <div className="cdp-sec-title">{t('eng.tpl.perf_title', { name: templateDisplayName(tplDetail.template_key, t), defaultValue: 'Campaign Performance — {{name}}' })}</div>
                  {perfLoading ? (
                    <div className="eng-loading">{t('common.loading', 'Loading...')}</div>
                  ) : !perf || (perf.usage_count ?? 0) === 0 ? (
                    <div className="eng-loading">{t('eng.tpl.no_perf_data', 'No performance data yet — this template has not been used in a campaign.')}</div>
                  ) : (
                    <div className="tpl-perf-card">
                      <div className="tpl-perf-hdr"><div className="tpl-perf-hdr-txt">{t('eng.tpl.perf_count', { count: perf.usage_count, defaultValue: '{{count}} campaign(s) using this template' })}</div></div>
                      <div className="tpl-perf-stats">
                        <div className="tpl-perf-stat"><div className="tpl-perf-stat-v">{perf.counts?.recipients ?? 0}</div><div className="tpl-perf-stat-l">{t('eng.an.col_recipients', 'Recipients')}</div></div>
                        <div className="tpl-perf-stat"><div className="tpl-perf-stat-v">{perf.rates?.open != null ? `${perf.rates.open}%` : '—'}</div><div className="tpl-perf-stat-l">{t('eng.an.col_open_short', 'Open')}</div></div>
                        <div className="tpl-perf-stat"><div className="tpl-perf-stat-v">{perf.rates?.click != null ? `${perf.rates.click}%` : '—'}</div><div className="tpl-perf-stat-l">{t('eng.an.col_click', 'Click')}</div></div>
                        <div className="tpl-perf-stat"><div className="tpl-perf-stat-v">{perf.rates?.bounce != null ? `${perf.rates.bounce}%` : '—'}</div><div className="tpl-perf-stat-l">{t('eng.an.col_bounce', 'Bounce')}</div></div>
                      </div>
                      {(perf.campaigns_used_in ?? []).length > 0 && (
                        <div>
                          {perf.campaigns_used_in.map((c, i) => (
                            <div key={c.id ?? i} className="tpl-perf-row">
                              <div className="tpl-perf-camp">
                                <div className="tpl-perf-camp-name">{c.campaign_name || c.name || t('eng.tpl.untitled_campaign', 'Untitled campaign')}</div>
                                {c.sent_at && <div className="tpl-perf-camp-meta">{formatDate(c.sent_at)}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'versions' && (
                <div>
                  <div className="cdp-sec-title">{t('eng.tpl.version_history_title', { name: templateDisplayName(tplDetail.template_key, t), defaultValue: 'Version History — {{name}}' })}</div>
                  {versionsLoading ? (
                    <div className="eng-loading">{t('common.loading', 'Loading...')}</div>
                  ) : versions.length === 0 ? (
                    <div className="eng-loading">{t('eng.tpl.no_version_history', 'No version history yet.')}</div>
                  ) : (
                    versions.map((v, i) => (
                      <div key={v.id ?? i} className="tpl-ver-row">
                        <div>
                          <div className="tpl-ver-name">
                            {t('eng.tpl.version_n', { n: v.version_number, defaultValue: 'Version {{n}}' })}
                            {i === 0 && <span className="tpl-ver-badge current">{t('eng.tpl.current', 'Current')}</span>}
                          </div>
                          <div className="tpl-ver-meta">{formatDate(v.created_at)}{v.change_note ? ` · ${v.change_note}` : ''}</div>
                        </div>
                      </div>
                    ))
                  )}

                  <div className="eng-card-footer">
                    <div className="cdp-sec-title">{t('eng.tpl.request_change', 'Request a Change')}</div>
                    {!changeRequestsLoading && changeRequests.length > 0 && (
                      <div style={{ marginBottom:12 }}>
                        {changeRequests.map(cr => (
                          <div key={cr.id} className="tpl-ver-row">
                            <div>
                              <div className="tpl-ver-name">{cr.request_text} <span className={`tpl-ver-badge ${cr.status === 'open' ? 'archived' : 'current'}`}>{cr.status}</span></div>
                              <div className="tpl-ver-meta">{formatDate(cr.created_at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="card card-flush">
                      <div className="tpl-perf-hdr-txt">{t('eng.tpl.request_custom_hint', "Need something this template can't do? Submit a change request to Mi Italia.")}</div>
                      {changeRequestError && <div className="eng-error">{changeRequestError}</div>}
                      <div className="form-group">
                        <label className="form-lbl">{t('eng.tpl.what_change', 'What would you like to change?')}</label>
                        <textarea className="form-textarea" placeholder={t('eng.tpl.what_change_placeholder', "e.g. I'd like to add a second CTA button…")} value={changeRequestText} onChange={e => setChangeRequestText(e.target.value)} />
                      </div>
                      <button className="btn btn-outline btn-sm" disabled={changeRequestSending || !changeRequestText.trim()} onClick={submitChangeRequest}>
                        <span className="material-symbols-outlined">send</span>{changeRequestSending ? t('eng.rev.sending', 'Sending…') : t('eng.tpl.submit_change_request', 'Submit Change Request')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'variables' && (
                <div>
                  <div className="alert alert-info">
                    <span className="material-symbols-outlined">data_object</span>
                    <div>{t('eng.tpl.variables_hint', 'Variables are pulled automatically from your Mi Italia data at send time.')}</div>
                  </div>
                  {variablesLoading ? (
                    <div className="eng-loading">{t('common.loading', 'Loading...')}</div>
                  ) : (
                    <div className="tpl-var-grid">
                      {variables.map(v => (
                        <div key={v.key} className="tpl-var-card">
                          <div className="tpl-var-token">{`{{${v.key}}}`}</div>
                          <div className="tpl-var-desc">{v.description}</div>
                          <div className="tpl-var-ex"><span className="material-symbols-outlined">check_circle</span>{v.example}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {showForm && (
      <RealTemplateFormModal
        template={editingTpl}
        onClose={() => setShowForm(false)}
        onSaved={onFormSaved}
      />
    )}
    {deleteTarget && (
      <div className="modal-backdrop" onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteError('') } }}>
        <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr">
            <div className="modal-title">{t('eng.tpl.delete_title', 'Delete')} <em>{t('eng.tpl.delete_title_em', 'Template')}</em></div>
            <div className="modal-close" onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteError('') } }}><span className="material-symbols-outlined">close</span></div>
          </div>
          {deleteError && <div className="eng-error">{deleteError}</div>}
          <div>{t('eng.tpl.confirm_delete', { name: templateDisplayName(deleteTarget.template_key, t), defaultValue: 'Delete "{{name}}"? This cannot be undone.' })}</div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => { setDeleteTarget(null); setDeleteError('') }} disabled={deleting}>{t('common.cancel', 'Cancel')}</button>
            <button className="btn btn-red" onClick={confirmDelete} disabled={deleting}>
              <span className="material-symbols-outlined">delete</span>{deleting ? t('eng.camp.deleting', 'Deleting…') : t('common.delete', 'Delete')}
            </button>
          </div>
        </div>
      </div>
    )}
    {showRequestModal && (
      <TemplateRequestModal
        requestName={requestName} setRequestName={setRequestName}
        requestChannel={requestChannel} setRequestChannel={setRequestChannel}
        requestDescribe={requestDescribe} setRequestDescribe={setRequestDescribe}
        requestError={requestError} requestSending={requestSending} requestSent={requestSent}
        onClose={closeRequestModal} onSubmit={handleSubmitRequest}
      />
    )}
    </>
  )
}

// ── SETTINGS — SENDER IDENTITY ────────────────────────────
function VerifyStatus({ ok, label }) {
  return (
    <div className="stat-card">
      <div className="stat-lbl">{label}</div>
      <div className="stat-val" style={{ color: ok ? 'var(--green)' : 'var(--stone)', fontSize:18 }}>
        {ok ? '✓' : '—'}
      </div>
    </div>
  )
}

function SenderSettingsView({ emailSettings, refetchEmailSettings }) {
  const { t } = useTranslation()
  const hasSettings = !!emailSettings

  const [displayName, setDisplayName] = useState('')
  const [replyTo,     setReplyTo]     = useState('')
  const [address,     setAddress]     = useState('')
  const [subdomain,   setSubdomain]   = useState('')
  const [localPart,   setLocalPart]   = useState('')

  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState('')
  const [saveError,   setSaveError]   = useState('')
  const [verifying,   setVerifying]   = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [dnsRecords,  setDnsRecords]  = useState(null)
  const [refreshing,  setRefreshing]  = useState(false)
  const [refreshMsg,  setRefreshMsg]  = useState('')
  const [copied,      setCopied]      = useState('')

  useEffect(() => {
    setDisplayName(emailSettings?.sender_display_name ?? '')
    setReplyTo(emailSettings?.reply_to_email ?? '')
    setAddress(emailSettings?.physical_address ?? '')
  }, [emailSettings])

  const handleCreate = async () => {
    if (!subdomain.trim() || !localPart.trim() || !displayName.trim() || !replyTo.trim() || !address.trim()) {
      setSaveError(t('eng.set.err_required', 'All fields are required.')); return
    }
    setSaving(true); setSaveError(''); setSaveMsg('')
    try {
      const res = await emailSettingsApi.create({
        senderSubdomain:   subdomain.trim(),
        senderLocalPart:   localPart.trim(),
        senderDisplayName: displayName.trim(),
        replyToEmail:      replyTo.trim(),
        physicalAddress:   address.trim(),
      })
      if (res?.success) { setSaveMsg(res.message || t('eng.set.created', 'Sender identity created.')); refetchEmailSettings() }
      else setSaveError(res?.message || t('eng.set.err_save', 'Failed to save.'))
    } catch { setSaveError(t('eng.set.err_network', 'Network error.')) }
    finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    if (!displayName.trim() || !replyTo.trim() || !address.trim()) {
      setSaveError(t('eng.set.err_required', 'All fields are required.')); return
    }
    setSaving(true); setSaveError(''); setSaveMsg('')
    try {
      const res = await emailSettingsApi.update({
        senderDisplayName: displayName.trim(),
        replyToEmail:      replyTo.trim(),
        physicalAddress:   address.trim(),
      })
      if (res?.success) { setSaveMsg(res.message || t('eng.set.saved', 'Settings updated.')); refetchEmailSettings() }
      else setSaveError(res?.message || t('eng.set.err_save', 'Failed to save.'))
    } catch { setSaveError(t('eng.set.err_network', 'Network error.')) }
    finally { setSaving(false) }
  }

  const handleVerify = async () => {
    setVerifying(true); setVerifyError(''); setDnsRecords(null)
    try {
      const res = await emailSettingsApi.verify()
      if (res?.success) { setDnsRecords(res.data?.dnsRecords ?? null); refetchEmailSettings() }
      else setVerifyError(res?.message || t('eng.set.err_verify', 'Verification failed.'))
    } catch { setVerifyError(t('eng.set.err_network', 'Network error.')) }
    finally { setVerifying(false) }
  }

  const handleRefresh = async () => {
    setRefreshing(true); setRefreshMsg('')
    try {
      const res = await emailSettingsApi.refresh()
      setRefreshMsg(res?.message || (res?.success ? t('eng.set.refreshed', 'Status updated.') : t('eng.set.err_refresh', 'Refresh failed.')))
      if (res?.success) refetchEmailSettings()
    } catch { setRefreshMsg(t('eng.set.err_network', 'Network error.')) }
    finally { setRefreshing(false); setTimeout(() => setRefreshMsg(''), 5000) }
  }

  const copyValue = (val, key) => {
    navigator.clipboard?.writeText(val).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1500) }).catch(() => {})
  }

  const dnsRows = dnsRecords ? [
    ...(dnsRecords.dkim ?? []).map((r, i) => ({ ...r, group: `DKIM ${i + 1}` })),
    dnsRecords.spf      && { ...dnsRecords.spf,      group: 'SPF' },
    dnsRecords.dmarc     && { ...dnsRecords.dmarc,     group: 'DMARC' },
    dnsRecords.mailFrom && { ...dnsRecords.mailFrom, group: 'Mail From' },
  ].filter(Boolean) : []

  if (!hasSettings) {
    return (
      <div>
        <div className="card" style={{ maxWidth:560 }}>
          <div className="card-hdr"><div className="card-title">{t('eng.set.setup_title', 'Set up your')} <em>{t('eng.set.setup_title_em', 'sender identity')}</em></div></div>
          <div className="eng-loading" style={{ padding:'0 0 14px' }}>{t('eng.set.setup_hint', "Before you can send marketing email, Mi Italia needs a dedicated sending domain and address for your boutique.")}</div>
          {saveError && <div className="eng-error">{saveError}</div>}
          {saveMsg && <div className="eng-success">{saveMsg}</div>}
          <div className="form-group">
            <label className="form-lbl">{t('eng.set.subdomain', 'Subdomain')}</label>
            <input className="form-input" placeholder="yourboutique" value={subdomain} onChange={e => setSubdomain(e.target.value)} />
            <div className="form-hint">{t('eng.set.subdomain_hint', { sub: subdomain.trim() || 'yourboutique', defaultValue: 'Your sending domain will be {{sub}}.miitalia.com' })}</div>
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('eng.set.local_part', 'Sender address (before the @)')}</label>
            <input className="form-input" placeholder="newsletter" value={localPart} onChange={e => setLocalPart(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('eng.set.display_name', 'Sender display name')}</label>
            <input className="form-input" placeholder="Your Boutique Name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('eng.set.reply_to', 'Reply-to email')}</label>
            <input className="form-input" type="email" placeholder="support@yourboutique.com" value={replyTo} onChange={e => setReplyTo(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('eng.set.physical_address', 'Physical address')}</label>
            <input className="form-input" placeholder={t('eng.set.address_placeholder', 'Required by anti-spam law for marketing email')} value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={saving} onClick={handleCreate}>
            <span className="material-symbols-outlined">mail</span>{saving ? t('eng.set.saving', 'Saving…') : t('eng.set.create_btn', 'Create sender identity')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">{t('eng.set.status_title', 'Sender')} <em>{t('eng.set.status_title_em', 'Status')}</em></div>
          <button className="card-action" disabled={refreshing} onClick={handleRefresh}>
            {refreshing ? t('eng.set.refreshing', 'Checking…') : t('eng.set.refresh_btn', '→ Check verification status')}
          </button>
        </div>
        {refreshMsg && <div className="eng-success" style={{ marginBottom:12 }}>{refreshMsg}</div>}
        <div className="eng-loading" style={{ padding:'0 0 14px' }}>
          {t('eng.set.sending_from', { addr: `${emailSettings.sender_local_part}@${emailSettings.sender_domain}`, defaultValue: 'Sending from {{addr}}' })}
        </div>
        <div className="stat-row col4">
          <VerifyStatus ok={emailSettings.ses_verified}   label={t('eng.set.stat_ses', 'DOMAIN VERIFIED')} />
          <VerifyStatus ok={emailSettings.dkim_verified}  label="DKIM" />
          <VerifyStatus ok={emailSettings.spf_verified}   label="SPF" />
          <VerifyStatus ok={emailSettings.dmarc_verified} label="DMARC" />
        </div>
        <div className="eng-mt14">
          <span className={`status ${emailSettings.sending_enabled ? 'sent' : 'draft'}`}>
            {emailSettings.sending_enabled ? t('eng.set.sending_enabled', 'Sending enabled') : t('eng.set.sending_disabled', 'Sending not yet enabled')}
          </span>
        </div>
      </div>

      <div className="card eng-mt14">
        <div className="card-hdr">
          <div className="card-title">{t('eng.set.edit_title', 'Edit')} <em>{t('eng.set.edit_title_em', 'Sender Details')}</em></div>
        </div>
        {saveError && <div className="eng-error">{saveError}</div>}
        {saveMsg && <div className="eng-success">{saveMsg}</div>}
        <div className="form-group">
          <label className="form-lbl">{t('eng.set.display_name', 'Sender display name')}</label>
          <input className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-lbl">{t('eng.set.reply_to', 'Reply-to email')}</label>
          <input className="form-input" type="email" value={replyTo} onChange={e => setReplyTo(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-lbl">{t('eng.set.physical_address', 'Physical address')}</label>
          <input className="form-input" value={address} onChange={e => setAddress(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={saving} onClick={handleUpdate}>
          {saving ? t('eng.set.saving', 'Saving…') : t('common.save', 'Save')}
        </button>
      </div>

      {!(emailSettings.ses_verified && emailSettings.dkim_verified && emailSettings.spf_verified && emailSettings.dmarc_verified) && (
        <div className="card eng-mt14">
          <div className="card-hdr">
            <div className="card-title">{t('eng.set.verify_title', 'Verify')} <em>{t('eng.set.verify_title_em', 'Domain')}</em></div>
          </div>
          <div className="eng-loading" style={{ padding:'0 0 14px' }}>
            {t('eng.set.verify_hint', "Get the DNS records to publish at your domain provider, then check status once they're live (DNS changes can take up to a few hours to propagate).")}
          </div>
          {verifyError && <div className="eng-error">{verifyError}</div>}
          <button className="btn btn-outline" disabled={verifying} onClick={handleVerify}>
            <span className="material-symbols-outlined">dns</span>{verifying ? t('eng.set.verifying', 'Requesting…') : t('eng.set.verify_btn', 'Get DNS records')}
          </button>

          {dnsRows.length > 0 && (
            <table className="tbl eng-mt14">
              <thead>
                <tr>
                  <th>{t('eng.set.col_group', 'Record')}</th>
                  <th>{t('eng.set.col_type', 'Type')}</th>
                  <th>{t('eng.set.col_name', 'Name')}</th>
                  <th>{t('eng.set.col_value', 'Value')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dnsRows.map((r, i) => (
                  <tr key={i}>
                    <td className="tbl-meta">{r.group}</td>
                    <td>{r.type}</td>
                    <td style={{ wordBreak:'break-all', fontSize:11 }}>{r.name}</td>
                    <td style={{ wordBreak:'break-all', fontSize:11 }}>{r.value}</td>
                    <td>
                      <button className="btn btn-outline btn-xs" onClick={() => copyValue(r.value, `${r.group}-${i}`)}>
                        {copied === `${r.group}-${i}` ? t('common.copied', 'Copied') : t('common.copy', 'Copy')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────
export default function Engagement() {
  const { t, i18n } = useTranslation()
  const [activeView, setActiveView] = useState('overview')
  const [campaigns,  setCampaigns]  = useState([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [segments,   setSegments]   = useState([])
  const [dashboard,  setDashboard]  = useState(null)
  const [emailSettings, setEmailSettings] = useState(null)
  const [campaignsStart, setCampaignsStart] = useState('hub')
  const [campaignsPresetSegment, setCampaignsPresetSegment] = useState(null)
  const [campaignsPresetTemplate, setCampaignsPresetTemplate] = useState(null)
  const [campaignsPresetChannel, setCampaignsPresetChannel] = useState(null)

  const refetchCampaigns = () => {
    setCampaignsLoading(true)
    apiFetch(`${API}/boutique/marketing/campaigns`)
      .then(r => r.json())
      .then(res => { if (res.success) setCampaigns(res.data?.campaigns ?? []) })
      .catch(() => {})
      .finally(() => setCampaignsLoading(false))
  }

  const refetchEmailSettings = () =>
    apiFetch(`${API}/boutique/email-settings`)
      .then(r => r.json())
      .then(res => { if (res.success) setEmailSettings(res.data?.settings ?? null) })
      .catch(() => {})

  const refetchSegments = () =>
    apiFetch(`${API}/boutique/marketing/segments`)
      .then(r => r.json())
      .then(res => { if (res.success) setSegments(res.data?.segments ?? []) })
      .catch(() => {})

  const refetchDashboard = () =>
    apiFetch(`${API}/boutique/marketing/dashboard`)
      .then(r => r.json())
      .then(res => { if (res.success) setDashboard(res.data) })
      .catch(() => {})

  const onContactsChanged = () => { refetchSegments(); refetchDashboard() }

  useEffect(() => {
    apiFetch(`${API}/boutique/marketing/segments`)
      .then(r => r.json())
      .then(res => { if (res.success) setSegments(res.data?.segments ?? []) })
      .catch(() => {})

    apiFetch(`${API}/boutique/marketing/dashboard`)
      .then(r => r.json())
      .then(res => { if (res.success) setDashboard(res.data) })
      .catch(() => {})

    refetchEmailSettings()
    refetchCampaigns()
  }, [i18n.language])

  const VIEWS = [
    { key:'overview',    icon:'dashboard',  label:t('eng.nav.overview', 'Overview') },
    { key:'contacts',    icon:'people',     label:t('eng.nav.contacts', 'Contacts') },
    { key:'favorites',   icon:'favorite',   label:t('eng.nav.favorites', 'Favorites') },
    { key:'campaigns',   icon:'campaign',   label:t('eng.nav.campaigns', 'Campaigns') },
    { key:'templates',   icon:'description', label:t('eng.nav.templates', 'Templates') },
    { key:'automations', icon:'bolt',        label:t('eng.nav.automations', 'Automations') },
    { key:'analytics',   icon:'monitoring', label:t('eng.nav.analytics', 'Analytics') },
    { key:'settings',    icon:'settings',   label:t('eng.nav.settings', 'Settings') },
  ]

  return (
    <>
      <div className="crm-subnav">
        {VIEWS.map(v => (
          <div key={v.key} className={`sni${activeView === v.key ? ' act' : ''}`} onClick={() => {
            if (v.key === 'campaigns') { setCampaignsStart('hub'); setCampaignsPresetSegment(null) }
            setActiveView(v.key)
          }}>
            <span className="material-symbols-outlined">{v.icon}</span>
            {v.label}
            {v.tag && <span className="sni-tag">{v.tag}</span>}
          </div>
        ))}
      </div>

      <div className="content">
        {activeView === 'overview' && (
          <OverviewView
            segments={segments}
            dashboard={dashboard}
            campaigns={campaigns}
            onNewCampaign={(presetSegment) => { setCampaignsPresetSegment(presetSegment ?? null); setCampaignsStart('builder'); setActiveView('campaigns') }}
            onViewAllCampaigns={() => { setCampaignsPresetSegment(null); setCampaignsStart('hub'); setActiveView('campaigns') }}
            onManageContacts={() => setActiveView('contacts')}
            onManageAutomations={() => setActiveView('automations')}
          />
        )}
       {activeView === 'contacts'    && <ContactsView onContactsChanged={onContactsChanged} segments={segments} />}
        {activeView === 'favorites'   && <FavoritesView />}
        {activeView === 'campaigns'   && <CampaignsView  campaigns={campaigns} segments={segments} dashboard={dashboard} refetchCampaigns={refetchCampaigns} campaignsLoading={campaignsLoading} emailSettings={emailSettings} initialSub={campaignsStart} initialSegment={campaignsPresetSegment} initialTemplate={campaignsPresetTemplate} initialChannel={campaignsPresetChannel} key={`${campaignsStart}:${campaignsPresetSegment ?? ''}:${campaignsPresetTemplate ?? ''}`} />}
        {activeView === 'templates'   && <TemplatesView emailSettings={emailSettings} onNavigateToBuilder={(presetTemplateId, presetChannel) => { setCampaignsPresetTemplate(presetTemplateId ?? null); setCampaignsPresetChannel(presetChannel ?? null); setCampaignsStart('builder'); setActiveView('campaigns') }} />}
        {activeView === 'automations' && <AutomationsView />}
        {activeView === 'analytics'   && <AnalyticsView />}
        {activeView === 'settings'    && <SenderSettingsView emailSettings={emailSettings} refetchEmailSettings={refetchEmailSettings} />}
      </div>
    </>
  )
}
