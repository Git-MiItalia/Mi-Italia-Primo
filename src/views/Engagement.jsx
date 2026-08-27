import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import RangeBar from '../components/ui/RangeBar'
import { PR_TODAY, fmtDate } from '../lib/dateHelpers'

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

const ANALYTICS_DATA = {
  mtd:    { period:'1 May — 21 May 2026 · month to date',           idrate:'34', idrateDelta:'+3pt',  revenue:'3,460',  revenueDelta:'+9%',   roi:'836',   roiDelta:'+62pt',  engaged:'1,184', engagedDelta:'+48',  ltv:'483', ltvDelta:'+€26' },
  ytd:    { period:'1 Jan — 21 May 2026 · year to date',            idrate:'34', idrateDelta:'+18pt', revenue:'22,840', revenueDelta:'+142%', roi:'1,024', roiDelta:'+382pt', engaged:'1,184', engagedDelta:'+524', ltv:'474', ltvDelta:'+€198' },
  '7d':   { period:'15 May — 21 May 2026 · vs prev. 7 days',        idrate:'34', idrateDelta:'+1pt',  revenue:'1,140',  revenueDelta:'+8%',   roi:'724',   roiDelta:'+12pt',  engaged:'1,184', engagedDelta:'+18',  ltv:'483', ltvDelta:'+€6' },
  '30d':  { period:'21 Apr — 21 May 2026 · vs prev. 30 days',       idrate:'34', idrateDelta:'+4pt',  revenue:'4,820',  revenueDelta:'+12%',  roi:'847',   roiDelta:'+89pt',  engaged:'1,184', engagedDelta:'+68',  ltv:'483', ltvDelta:'+€38' },
  '90d':  { period:'21 Feb — 21 May 2026 · vs prev. 90 days',       idrate:'33', idrateDelta:'+7pt',  revenue:'13,640', revenueDelta:'+24%',  roi:'912',   roiDelta:'+142pt', engaged:'1,184', engagedDelta:'+184', ltv:'471', ltvDelta:'+€52' },
  '12m':  { period:'21 May 2025 — 21 May 2026 · vs prev. 12 months',idrate:'34', idrateDelta:'+22pt', revenue:'51,920', revenueDelta:'+186%', roi:'1,148', roiDelta:'+520pt', engaged:'1,184', engagedDelta:'+712', ltv:'483', ltvDelta:'+€241' },
  custom: { period:'Custom range applied',                          idrate:'34', idrateDelta:'—',     revenue:'4,820',  revenueDelta:'—',     roi:'847',   roiDelta:'—',      engaged:'1,184', engagedDelta:'—',    ltv:'483', ltvDelta:'—' },
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

const CAMP_DETAIL = {
  'spring-new': {
    name:'Spring Collection — New Arrivals', channel:'email', icon:'mail',
    date:'3 May 2026', segments:['New','Returning','VIP'],
    sent:416, delivered:408, opens:341, clicks:128, visits:22, purchases:8, revenue:1840, cost:0,
    template:'New Arrivals · localized',
    langs:{ it:152, en:184, fr:48, de:32 },
    miniTrend:[12,14,18,22,28,31,34,38,42,40,38,35,32,28,24],
    segPerf:[
      { name:'VIP',       open:96, click:54, color:'var(--gold)' },
      { name:'Returning', open:84, click:38, color:'var(--gold-light)' },
      { name:'New',       open:72, click:24, color:'var(--gold-soft)' },
    ],
    linkClicks:[
      { label:'SHOP NOW button',    clicks:84, pct:66 },
      { label:'View collection',    clicks:28, pct:22 },
      { label:'View lookbook (PDF)',clicks:11, pct:9  },
      { label:'Unsubscribe',        clicks:5,  pct:4  },
    ],
  },
  'brera-vips': {
    name:'Brera shop visit — returning VIPs', channel:'wa', icon:'chat',
    date:'22 March 2026', segments:['VIP'],
    sent:86, delivered:86, opens:70, clicks:34, visits:11, purchases:6, revenue:1860, cost:8.60,
    template:'In-store visit invitation',
    langs:{ it:62, en:24 },
    miniTrend:[8,12,18,22,28,32,34,33,28,22,16,11,7,4,2],
    segPerf:[{ name:'VIP', open:81, click:40, color:'var(--gold)' }],
    linkClicks:null,
  },
  'vip-capsule': {
    name:'VIP Early Access — Capsule Drop', channel:'wa', icon:'chat',
    date:'14 April 2026', segments:['VIP'],
    sent:48, delivered:48, opens:45, clicks:20, visits:8, purchases:5, revenue:1120, cost:4.80,
    template:'VIP Early Access',
    langs:{ it:32, en:16 },
    miniTrend:[10,18,28,38,42,40,32,24,18,14,10,8,6,4,2],
    segPerf:[{ name:'VIP', open:94, click:42, color:'var(--gold)' }],
    linkClicks:null,
  },
  'ss26-bordeaux': {
    name:'SS26 · Bordeaux silk drop', channel:'email', icon:'mail',
    date:'9 April 2026', segments:['Returning','VIP'],
    sent:352, delivered:344, opens:250, clicks:67, visits:14, purchases:5, revenue:420, cost:0,
    template:'Limited drop notification',
    langs:{ it:148, en:142, fr:38, de:24 },
    miniTrend:[18,22,28,32,38,42,46,42,36,28,22,16,12,8,5],
    segPerf:[
      { name:'VIP',       open:88, click:32, color:'var(--gold)' },
      { name:'Returning', open:67, click:18, color:'var(--gold-light)' },
    ],
    linkClicks:[
      { label:'View Bordeaux silk', clicks:48, pct:72 },
      { label:'Reserve in store',   clicks:14, pct:21 },
      { label:'Unsubscribe',        clicks:5,  pct:7  },
    ],
  },
  'res-reminder': {
    name:'Reservation expiring · 24h reminder', channel:'wa', icon:'chat',
    date:'Recurring · daily', segments:['Anyone with active reservation'],
    sent:52, delivered:52, opens:50, clicks:35, visits:18, purchases:11, revenue:680, cost:5.20,
    template:'Automated · transactional',
    langs:{ it:36, en:14, fr:2 },
    miniTrend:null,
    segPerf:[{ name:'All', open:96, click:68, color:'var(--gold)' }],
    linkClicks:null,
  },
  'winback': {
    name:'Win Back — 60-Day Lapsed Customers', channel:'email', icon:'mail',
    date:'28 April 2026', segments:['Lapsed'],
    sent:186, delivered:178, opens:78, clicks:15, visits:3, purchases:1, revenue:180, cost:0,
    template:'Win-Back · 10% gift',
    langs:{ it:84, en:78, fr:18, de:6 },
    miniTrend:[14,18,22,24,22,18,14,10,8,6,4,3,2,1,1],
    segPerf:[{ name:'Lapsed', open:42, click:8, color:'var(--stone)' }],
    linkClicks:[
      { label:'Claim 10% gift',   clicks:11, pct:73 },
      { label:'See new arrivals', clicks:3,  pct:20 },
      { label:'Unsubscribe',      clicks:1,  pct:7  },
    ],
  },
  'spring-lookbook': {
    name:'Spring lookbook · in-store insert', channel:'print', icon:'description',
    date:'12 April 2026', segments:['All recent purchasers'],
    sent:68, delivered:68, opens:null, clicks:10, visits:6, purchases:4, revenue:450, cost:12.24,
    template:'Printed insert · QR-driven',
    langs:{ it:38, en:24, fr:6 },
    miniTrend:null, segPerf:null, linkClicks:null,
  },
  'ramadan': {
    name:'Ramadan Gifting — Curated Selection', channel:'wa', icon:'chat',
    date:'19 March 2026', segments:['Active customers'],
    sent:112, delivered:112, opens:76, clicks:13, visits:1, purchases:0, revenue:0, cost:11.20,
    template:'Seasonal · gifting',
    langs:{ it:34, en:48, ar:30 },
    miniTrend:[16,22,28,24,18,14,10,8,6,4,3,2,1,1,1],
    segPerf:[{ name:'Active', open:68, click:12, color:'var(--gold-light)' }],
    linkClicks:null,
  },
}


const COMPARE_DELTAS_PREVYEAR = {
  mtd:    { idrateDelta:'+22pt', revenueDelta:'+148%', roiDelta:'+412pt', engagedDelta:'+478', ltvDelta:'+€186' },
  ytd:    { idrateDelta:'+24pt', revenueDelta:'+184%', roiDelta:'+541pt', engagedDelta:'+612', ltvDelta:'+€224' },
  '7d':   { idrateDelta:'+19pt', revenueDelta:'+96%',  roiDelta:'+312pt', engagedDelta:'+186', ltvDelta:'+€132' },
  '30d':  { idrateDelta:'+22pt', revenueDelta:'+142%', roiDelta:'+438pt', engagedDelta:'+392', ltvDelta:'+€198' },
  '90d':  { idrateDelta:'+25pt', revenueDelta:'+168%', roiDelta:'+520pt', engagedDelta:'+546', ltvDelta:'+€215' },
  '12m':  { idrateDelta:'+28pt', revenueDelta:'+212%', roiDelta:'+684pt', engagedDelta:'+892', ltvDelta:'+€286' },
  custom: { idrateDelta:'+20pt', revenueDelta:'+140%', roiDelta:'+420pt', engagedDelta:'+380', ltvDelta:'+€185' },
}





function mapCustomer(c, t) {
  const name = (c.name || '').trim() || t('eng.ct.unnamed', 'Unnamed')
  const code = c.language?.code
  const langInfo = code ? { flag: LANG_MAP[code]?.flag ?? code.toUpperCase(), name: langDisplayName(code, t) } : null
  const src = c.language?.source
  const langSrc =
    src === 'user_set' ? t('eng.ct.lang_src_user_set', 'User-set') :
    src === 'detected' ? t('eng.ct.lang_src_detected', 'Detected') :
    src === 'unknown' || !src ? t('eng.ct.lang_src_fallback', 'Fallback · EN') :
    src
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
  translate: (id) => apiFetch(`${API}/boutique/email-templates/${id}/translate`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    }).then(r => r.json()),
  delete:    (id)       => apiFetch(`${API}/boutique/email-templates/${id}`, {
                            method: 'DELETE',
                          }).then(r => r.json()),
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

  const autoRunning = [
    { icon:'bolt',     iconColor:'var(--gold)',  name:'Welcome — First Purchase', sent:'143 sent', status:'on' },
    { icon:'favorite', iconColor:'var(--gold)',  name:'Back in Stock Alerts',     sent:'67 sent',  status:'on' },
    { icon:'schedule', iconColor:'var(--stone)', name:'Lapsed Re-engagement Flow',sent:null,       status:'paused' },
  ]
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
          <div className="stat-change up">{t('eng.ov.contacts_delta', '↑ +34 this month')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-email">mail</span>{t('eng.ov.email_reach', 'Email Reach')}
          </div>
          <div className="stat-val">{emailR}</div>
          <div className="stat-sub">{t('eng.ov.email_sub', '72% opted in · Avg open 44%')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-wa">chat</span>{t('eng.ov.wa_reach', 'WhatsApp Reach')}
          </div>
          <div className="stat-val">{waR}</div>
          <div className="stat-sub">{t('eng.ov.wa_sub', '46% opted in · Avg read 78%')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-print">description</span>{t('eng.ov.print_insert', 'Printed insert')}
          </div>
          <div className="stat-val">{printR}</div>
          <div className="stat-sub">{t('eng.ov.print_sub', 'Addresses on file · 15% QR scan rate')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('eng.ov.revenue_attr', 'Revenue Attributed')}</div>
          <div className="stat-val">{revenue !== '—' ? `€${revenue}` : '—'}</div>
          <div className="stat-change up">{t('eng.ov.revenue_delta', '↑ +12% this month')}</div>
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
              {segsArr.map((s,i) => {
                const engPct   = s.engagedPct ?? 0
                const engCls   = engPct >= 70 ? 'eng-pct-green' : engPct >= 40 ? 'eng-pct-gold' : 'eng-pct-red'
                return (
                  <tr key={s.key}>
                    <td><SegBadge seg={s.key} /></td>
                    <td className="tbl-num-bold">{s.customers ?? 0}</td>
                    <td className={engCls}>{engPct}%</td>
                    <td><LangBar languages={s.languages} /></td>
                    <td className="tbl-meta">{s.lastCampaign ?? '—'}</td>
                    <td>
                      <button
                        className={`btn btn-xs ${
                          s.key === 'lapsed' ? 'btn-red' :
                          i === 0            ? 'btn-primary' : 'btn-outline'
                        }`}
                        onClick={onNewCampaign}
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
function ContactsView() {
  const { t, i18n } = useTranslation()
  const [contacts,       setContacts]       = useState([])
  const [loadingList,    setLoadingList]    = useState(true)
  const [showImport,     setShowImport]     = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [showPanel,      setShowPanel]      = useState(false)
  const [panelContact,   setPanelContact]   = useState(null)
  const [panelDetail,    setPanelDetail]    = useState(null)
  const [panelLoading,   setPanelLoading]   = useState(false)
  const [panelFavorites,        setPanelFavorites]        = useState([])
  const [panelFavoritesLoading, setPanelFavoritesLoading] = useState(false)
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
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkNote,    setBulkNote]    = useState('')
  const [bulkBusy,    setBulkBusy]    = useState(false)
  const [bulkSegment, setBulkSegment] = useState('')
  const [showBulkMessage, setShowBulkMessage] = useState(false)
  const [bulkMsgSubject,  setBulkMsgSubject]  = useState('')
  const [bulkMsgBody,     setBulkMsgBody]     = useState('')
  const [bulkMsgResult,   setBulkMsgResult]   = useState(null)

  const langOptions = Array.from(new Set(contacts.map(c => c.langName))).sort()

  const filteredContacts = contacts.filter(c => {
    if (searchQuery.trim() && !c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false
    if (segFilter && c.seg !== segFilter) return false
    if (langFilter && c.langName !== langFilter) return false
    return true
  })

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
  const refetchContacts = () => {
    setLoadingList(true)
    apiFetch(`${API}/boutique/customers?page=1&limit=20`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setContacts((res.data?.customers ?? []).map(c => mapCustomer(c, t)))
      })
      .catch(() => {})
      .finally(() => setLoadingList(false))
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
        if (res?.success) refetchContacts()
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

  const handleBulkMessage = () => {
    if (!bulkMsgBody.trim()) return
    setBulkBusy(true)
    bulkAction('message', { subject: bulkMsgSubject, message: bulkMsgBody })
      .then(res => {
        if (res?.success) setBulkMsgResult(res.data)
        else setBulkNote(res?.message || t('eng.ct.bulk_failed', 'Bulk action failed.'))
      })
      .catch(() => setBulkNote(t('eng.ct.err_network', 'Network error')))
      .finally(() => setBulkBusy(false))
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
        refetchContacts()
      } else setAddError(res.message ?? t('eng.ct.err_add_failed', 'Failed to add contact'))
    }).catch(() => setAddError(t('eng.ct.err_network', 'Network error')))
  }

  // Fetch contact list on mount
  useEffect(() => {
    refetchContacts()
  }, [i18n.language])

  // Fetch full profile whenever the panel opens
  useEffect(() => {
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
    if (!showPanel || !panelContact?.id) { setPanelFavorites([]); return }
    setPanelFavoritesLoading(true)
    favoritesApi.customer(panelContact.id)
      .then(res => { if (res?.success) setPanelFavorites(res.data?.favorites ?? []) })
      .catch(() => {})
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
              {s.icon} {s.label} ({contacts.filter(c => c.seg === s.key).length})
            </span>
          ))}
          <span className="ct-lang-btn" style={{ display:'inline-flex', alignItems:'center' }}>
            <span className="material-symbols-outlined ct-lang-icon">translate</span>
            <select value={langFilter || ''} onChange={e => setLangFilter(e.target.value || null)}
              style={{ border:'none', background:'transparent', font:'inherit', color:'inherit', cursor:'pointer', outline:'none' }}>
              <option value="">{t('eng.ct.language', 'Language')}</option>
              {langOptions.map(l => <option key={l} value={l}>{l}</option>)}
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
          <button className="btn btn-outline btn-xs" disabled={bulkBusy} onClick={() => { setBulkMsgResult(null); setShowBulkMessage(true) }}>{t('eng.ct.message', 'Message')}</button>
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
                    ? <button className="btn btn-primary btn-xs">{t('eng.ov.reengage', 'Re-engage')}</button>
                    : <button className="btn btn-outline btn-xs">{t('eng.ct.message', 'Message')}</button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ct-table-footer">
          <span>{t('eng.ct.showing_loaded', { shown: filteredContacts.length, total: contacts.length, defaultValue: 'Showing {{shown}} of {{total}} loaded contacts' })}</span>
          <div className="ct-footer-btns">
            <button className="btn btn-outline btn-xs" disabled>{t('eng.ct.prev', '← Prev')}</button>
            <button className="btn btn-outline btn-xs">{t('eng.ct.next', 'Next →')}</button>
          </div>
        </div>
      </div>
      {/* Import CSV Modal */}
      {showImport && (
        <div className="modal-backdrop" onClick={() => setShowImport(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('eng.ct.import_title', 'Import')} <em>{t('eng.ct.import_title_em', 'Contacts')}</em></div>
              <div className="modal-close" onClick={() => setShowImport(false)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>
            <div className="ct-drop-zone">
              <span className="material-symbols-outlined ct-drop-icon">upload_file</span>
              <div className="ct-drop-title">{t('eng.ct.drop_title', 'Drop your CSV here or click to browse')}</div>
              <div className="ct-drop-sub">{t('eng.ct.drop_sub', 'Required columns: First Name, Last Name, Email. Optional: Phone, Segment')}</div>
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('eng.ct.assign_import_label', 'Assign imported contacts to segment')}</label>
              <div className="select-wrap">
                <select className="form-select">
                  <option>{t('eng.ct.csv_auto', 'Auto-detect from CSV')}</option>
                  <option>✦ {t('eng.camp.seg_new', 'New')}</option>
                  <option>🔥 {t('eng.camp.seg_warm', 'Warm')}</option>
                  <option>⭐ {t('eng.camp.seg_vip', 'VIP')}</option>
                </select>
                <span className="material-symbols-outlined select-arrow">expand_more</span>
              </div>
            </div>
            <div className="ct-consent-toggle-row">
              <Toggle on={true} onToggle={() => {}} />
              <div>
                <div className="ct-consent-toggle-title">{t('eng.ct.import_consent_title', 'Send GDPR consent request to all imported contacts')}</div>
                <div className="ct-consent-toggle-sub">{t('eng.ct.import_consent_sub', 'Contacts will receive an opt-in email before any marketing is sent')}</div>
              </div>
            </div>
            <div className="alert-gdpr-blue">
              <span className="material-symbols-outlined">verified_user</span>
              <div dangerouslySetInnerHTML={{ __html: t('eng.ct.import_note', 'Imported contacts are added in <strong>pending consent</strong> status. They cannot be messaged until they opt in. Duplicate emails are automatically merged with existing contacts.') }} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowImport(false)}>{t('common.cancel', 'Cancel')}</button>
              <button className="btn btn-primary">
                <span className="material-symbols-outlined">upload</span>{t('eng.ct.import_send_btn', 'Import & Send Consent Requests')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="modal-backdrop" onClick={() => setShowAddContact(false)}>
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
        <div className="modal-backdrop" onClick={() => setShowBulkMessage(false)}>
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
              <button className="btn btn-primary btn-sm">
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
              {[
                {label:t('eng.ct.cat_rtw', 'Ready-to-wear'), val:'€868', pct:70},
                {label:t('eng.ct.cat_accessories', 'Accessories'),   val:'€248', pct:20},
                {label:t('eng.ct.cat_other', 'Other'),         val:'€124', pct:10},
              ].map(s => (
                <div key={s.label} className="ct-panel-spend-row">
                  <div className="ct-panel-spend-lbl">{s.label}</div>
                  <div className="ct-panel-spend-bar-wrap">
                    <div className="ct-panel-spend-bar" style={{width:`${s.pct}%`}} />
                  </div>
                  <div className="ct-panel-spend-val">{s.val}</div>
                </div>
              ))}

              {/* Language */}
              <div className="ct-panel-section-lbl">{t('eng.ct.lang_section', 'Language & Localization')}</div>
              <div className="ct-panel-lang-row">
                <span className="ct-panel-lang-flag">{panelContact.lang}</span>
                <div>
                  <div className="ct-panel-lang-name">{panelContact.langName}</div>
                  <div className="ct-panel-lang-src">{panelContact.langSrc}</div>
                </div>
                <button className="btn btn-outline btn-xs ct-panel-lang-change">
                  <span className="material-symbols-outlined">edit</span>{t('common.change', 'Change')}
                </button>
              </div>
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
                return <div className="eng-loading-sm">{t('eng.ct.activity_shape_tbd', { count: orders.length + reservs.length, defaultValue: '{{count}} recent item(s) — shape TBD' })}</div>
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CAMPAIGNS — HUB ──────────────────────────────────────
function CampaignsView({ campaigns: rawCampaigns, segments, dashboard, refetchCampaigns, campaignsLoading, emailSettings, initialSub = 'hub' }) {
  const { t } = useTranslation()
  const [campSub,        setCampSub]        = useState(initialSub || 'hub')
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
      segments={segments}
      emailSettings={emailSettings}
      onBack={() => { refetchCampaigns(); setEditingId(null); setCampSub('hub') }}
      onReview={(savedId) => { setEditingId(savedId); setCampSub('review') }}
    />
  )
  if (campSub === 'review') return (
    <CampaignReview
      campaignId={editingId}
      segments={segments}
      onBack={() => setCampSub('builder')}
      onSubmit={() => { refetchCampaigns(); setEditingId(null); setCampSub('hub') }}
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
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setCampSub('builder') }}>
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
function CampaignBuilder({ campaignId: initialId, segments: segArr, emailSettings, onBack, onReview }) {
  const { t, i18n } = useTranslation()
  const [campaignId,      setCampaignId]      = useState(initialId || null)
  const [campaignName,    setCampaignName]    = useState(t('eng.camp.untitled', 'Untitled draft'))
  const [channel,         setChannel]         = useState('email')
  const [template,        setTemplate]        = useState(null)
  const [subject,         setSubject]         = useState('')
  const [previewText,     setPreviewText]     = useState('')                     // UI-only, no API field
  const [body,            setBody]            = useState('')
  const [segment,         setSegment]         = useState('all')
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
      if (template)         payload.template_id = template
      if (subject.trim())   payload.subject     = subject
      if (body.trim())      payload.message     = body
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
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('eng.camp.subject', 'Subject Line')}</label>
                <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('eng.camp.preview_text', 'Preview Text')}</label>
                <input className="form-input" value={previewText} onChange={e => setPreviewText(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('eng.camp.body', 'Message Body')}</label>
              <textarea className="form-textarea camp-body-textarea" value={body} onChange={e => setBody(e.target.value)} />
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
  const [retranslating,   setRetranslating]         = useState(null)   // holds the template id while in flight
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

  const handleRetranslate = async () => {
    if (!template?.id) {
      setErrorMsg(t('eng.rev.err_no_template', 'No template attached — translations can only be regenerated from a template.'))
      return
    }
    setRetranslating(template.id)
    setErrorMsg(null)
    try {
      const res = await templateApi.translate(template.id)
      if (res?.success) {
        setSuccessMsg(t('eng.rev.retranslate_queued', { count: res.data?.targets?.length || 0, defaultValue: 'Translation queued for {{count}} language(s).' }))
        // Refresh template to pick up new translations_pending state
        const tres = await templateApi.get(template.id)
        if (tres?.success) setTemplate(tres.data?.template)
      } else {
        setErrorMsg(res?.message || t('eng.rev.err_retranslate', 'Re-translate failed.'))
      }
    } catch (e) {
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
                      <button className="btn btn-outline btn-xs" onClick={handleRetranslate} disabled={retranslating === template?.id}>
                        <span className="material-symbols-outlined">refresh</span>{retranslating === template?.id ? t('eng.rev.queuing', 'Queuing…') : t('eng.rev.retranslate', 'Re-translate')}
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
          <button className="btn btn-outline btn-sm" onClick={e => e.stopPropagation()}>
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

// ─── MAIN: AnalyticsView ─────────────────────────────────────

// Per-recipient channel cost — matches the real pricing shown in CampaignBuilder step 1 (email is free).
const CHANNEL_UNIT_COST = { email: 0, wa: 0.10, print: 0.18, insta: 0 }
const fmtROI = (revenue, cost) => {
  if (cost <= 0) return revenue > 0 ? '∞' : '—'
  const pct = ((revenue - cost) / cost) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toLocaleString(undefined, { maximumFractionDigits: 0 })}%`
}

function AnalyticsView() {
  const { t, i18n } = useTranslation()
  const [range,         setRange]         = useState('30d')
  const [compare,       setCompare]       = useState('none')
  const [customRange,   setCustomRange]   = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [topCampaigns,        setTopCampaigns]        = useState([])
  const [topCampaignsLoading, setTopCampaignsLoading] = useState(true)

  useEffect(() => {
    setTopCampaignsLoading(true)
    apiFetch(`${API}/boutique/marketing/campaigns/top-performers?limit=10`)
      .then(r => r.json())
      .then(res => { if (res?.success) setTopCampaigns(res.data?.campaigns ?? []) })
      .catch(() => {})
      .finally(() => setTopCampaignsLoading(false))
  }, [i18n.language])

  const roiRows = topCampaigns.map(c => {
    const ch   = channelKey(c.channel)
    const cost = (c.recipients ?? 0) * (CHANNEL_UNIT_COST[ch] ?? 0)
    return {
      id: c.id, ch, name: c.campaign_name,
      date: c.sent_at ? formatDate(c.sent_at) : '—',
      sent: c.recipients ?? 0,
      open: c.open_rate != null ? `${c.open_rate}%` : '—',
      click: c.click_rate != null ? `${c.click_rate}%` : '—',
      rev: `€${(c.revenue ?? 0).toLocaleString()}`,
      cost: `€${cost.toFixed(2)}`,
      roi: fmtROI(c.revenue ?? 0, cost),
      revenue: c.revenue ?? 0, costVal: cost,
      pos: (c.revenue ?? 0) >= cost,
    }
  })
  const roiTotals = roiRows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, cost: a.cost + r.costVal, profitable: a.profitable + (r.pos ? 1 : 0) }), { revenue: 0, cost: 0, profitable: 0 })

  const data       = ANALYTICS_DATA[range] || ANALYTICS_DATA['30d']
  const cmpDeltas  = compare === 'prevyear' ? COMPARE_DELTAS_PREVYEAR[range] : null
  const prevYear   = PR_TODAY.getFullYear() - 1

  // Custom range overrides the period label dynamically
  const periodLabel = (() => {
    let base = data.period
    if (range === 'custom' && customRange) base = `${fmtDate(customRange.start)} — ${fmtDate(customRange.end)} · custom range`
    if (compare === 'prev')     return `${base} · vs prev period`
    if (compare === 'prevyear') return `${base} · vs ${prevYear}`
    return base
  })()

  const kpiCards = [
    { lbl:t('eng.an.kpi_idrate', 'Identification rate'), num:data.idrate,  prefix:'',  suffix:'%', delta:cmpDeltas?.idrateDelta  ?? data.idrateDelta,  spark:'0,22 10,20 21,16 32,11 43,8 54,6 64,4' },
    { lbl:t('eng.an.kpi_revenue', 'Revenue attributed'),  num:data.revenue, prefix:'€', suffix:'',  delta:cmpDeltas?.revenueDelta ?? data.revenueDelta, spark:'0,21 10,19 21,17 32,14 43,9 54,7 64,5' },
    { lbl:t('eng.an.campaign_roi', 'Campaign ROI'),        num:data.roi,     prefix:'',  suffix:'%', delta:cmpDeltas?.roiDelta     ?? data.roiDelta,     spark:'0,20 10,18 21,17 32,13 43,11 54,7 64,5' },
    { lbl:t('eng.an.engaged', 'Engaged Contacts'),    num:data.engaged, prefix:'',  suffix:'',  delta:cmpDeltas?.engagedDelta ?? data.engagedDelta, spark:'0,18 10,16 21,15 32,12 43,11 54,8 64,6' },
    { lbl:t('eng.an.kpi_avg_ltv', 'Avg LTV · 12mo'),      num:data.ltv,     prefix:'€', suffix:'',  delta:cmpDeltas?.ltvDelta     ?? data.ltvDelta,     spark:'0,20 10,17 21,16 32,13 43,12 54,9 64,7' },
  ]
  const onOpenCampaignDetail = (id) => setDetailId(id)

  return (
    <div>
      {/* ── Range bar (shared component) ── */}
      <RangeBar
        range={range}
        compare={compare}
        customRange={customRange}
        periodLabel={periodLabel}
        onRangeChange={setRange}
        onCompareChange={setCompare}
        onCustomApply={r => { setCustomRange(r); setRange('custom') }}
        onExport={() => {}}
      />

      {/* ── KPI hero strip ── */}
      <div className="an-kpi-grid">
        {kpiCards.map(k => {
          const isFlat = k.delta === '—'
          return (
            <div key={k.lbl} className="kpi-an">
              <div className="kpi-an-lbl">{k.lbl}</div>
              <div className="kpi-an-val">{k.prefix}<em>{k.num}</em>{k.suffix}</div>
              <div className={`kpi-an-delta ${isFlat ? 'flat' : 'up'}`}>
                <span className="material-symbols-outlined">{isFlat ? 'remove' : 'trending_up'}</span>{k.delta}
              </div>
              <svg className="kpi-an-spark" width="64" height="28" viewBox="0 0 64 28">
                <polyline points={k.spark} fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )
        })}
      </div>

      {/* ── Identification Rate trend hero chart ── */}
      <div className="chart-card eng-mb18">
        <div className="chart-hd">
          <div className="chart-hd-l">
            <span className="material-symbols-outlined">monitoring</span>
            <div>
              <div className="chart-hd-ttl">{t('eng.an.id_trend', 'Identification')} <em>{t('eng.an.id_trend_em', 'rate trend')}</em></div>
              <div className="chart-hd-sub">{t('eng.an.id_trend_sub', 'Your commission tier depends on this. Each tier crossing earns Atelier Bianchi a lower rate on Connect plan.')}</div>
            </div>
          </div>
          <div className="chart-hd-rt">
            <div className="chart-legend">
              <div className="chart-legend-itm"><div className="chart-legend-sw" style={{ background:'var(--gold)' }} /><span>{t('eng.an.your_rate', 'Your rate')}</span></div>
              <div className="chart-legend-itm"><div className="chart-legend-sw" style={{ background:'rgba(184,149,90,0.13)' }} /><span>{t('eng.an.platinum_zone', 'Platinum tier zone')}</span></div>
            </div>
            <button className="btn btn-ghost btn-xs"><span className="material-symbols-outlined">download</span></button>
          </div>
        </div>

        <div className="idr-chart">
          <svg viewBox="0 0 800 280" preserveAspectRatio="none" className="idr-chart-svg">
            <defs>
              <linearGradient id="idrGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--gold)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Tier zone bands */}
            <rect className="idr-band-platinum" x="60" y="20"  width="720" height="77" />
            <rect className="idr-band-gold"     x="60" y="97"  width="720" height="35" />
            <rect className="idr-band-silver"   x="60" y="132" width="720" height="46" />
            <rect className="idr-band-base"     x="60" y="178" width="720" height="62" />

            {/* Tier labels */}
            <text className="idr-tier-lbl" x="68" y="50">Platinum · 5%</text>
            <text className="idr-tier-lbl" x="68" y="116">Gold · 6%</text>
            <text className="idr-tier-lbl" x="68" y="157">Silver · 7%</text>
            <text className="idr-tier-lbl" x="68" y="198">Base · 8%</text>

            {/* Floor + grid */}
            <line className="idr-grid" x1="60" y1="205" x2="780" y2="205" strokeDasharray="4,4" />
            <text className="idr-axis" x="775" y="201" textAnchor="end">Floor · 15%</text>
            <line className="idr-grid" x1="60" y1="185" x2="780" y2="185" />
            <line className="idr-grid" x1="60" y1="130" x2="780" y2="130" />
            <line className="idr-grid" x1="60" y1="75"  x2="780" y2="75"  />

            {/* Y axis labels */}
            <text className="idr-axis" x="55" y="244" textAnchor="end">0%</text>
            <text className="idr-axis" x="55" y="189" textAnchor="end">25%</text>
            <text className="idr-axis" x="55" y="134" textAnchor="end">50%</text>
            <text className="idr-axis" x="55" y="79"  textAnchor="end">75%</text>
            <text className="idr-axis" x="55" y="24"  textAnchor="end">100%</text>

            {/* Filled area + line + dots */}
            <path className="idr-fill" d="M 60 213 L 125 209 L 190 200 L 255 191 L 320 183 L 385 178 L 450 174 L 515 170 L 580 167 L 645 167 L 710 165 L 775 165 L 775 240 L 60 240 Z" />
            <polyline className="idr-line" points="60,213 125,209 190,200 255,191 320,183 385,178 450,174 515,170 580,167 645,167 710,165 775,165" />
            {[[60,213],[125,209],[190,200],[255,191],[320,183],[385,178],[450,174],[515,170],[580,167],[645,167],[710,165]].map(([x,y],i) => (
              <circle key={i} className="idr-dot" cx={x} cy={y} r="3.5" />
            ))}
            <circle className="idr-current-dot" cx="775" cy="165" r="5" />

            {/* Tier-crossing annotation */}
            <line className="idr-anno-arrow" x1="255" y1="191" x2="255" y2="158" strokeDasharray="2,2" />
            <text className="idr-anno" x="259" y="155">Silver · saved €504/yr</text>

            {/* Current value callout */}
            <rect x="710" y="138" width="68" height="22" rx="5" fill="var(--gold)" />
            <text x="744" y="153" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="Jost, sans-serif">34% · Silver</text>

            {/* X axis labels */}
            {['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'].map((m, i) => (
              <text key={m} className="idr-axis" x={60 + i*65} y="260" textAnchor="middle">{m}</text>
            ))}
          </svg>
        </div>

        <div className="eng-card-footer-row">
          <div className="an-tier-item">
            <span className="material-symbols-outlined eng-icon-sm eng-green">arrow_upward</span>
            <strong className="eng-strong">{t('eng.an.pts_to_gold', { count: 11, defaultValue: '{{count}}pt to Gold tier' })}</strong>
            <span> · {t('eng.an.would_save_at_current', { amount: '€1,008/yr', defaultValue: 'would save {{amount}} at current revenue' })}</span>
          </div>
          <div className="an-tier-item eng-ml-auto">
            <span className="material-symbols-outlined eng-icon-sm">timeline</span>
            <span>{t('eng.an.month_trend', { count: 3, defaultValue: '{{count}}-month trend:' })} </span><strong className="eng-green">+5pt</strong>
          </div>
        </div>
      </div>

      {/* ── Row 1: Revenue by channel + Funnel ── */}
      <div className="an-grid2">
        <div className="chart-card">
          <div className="chart-hd">
            <div className="chart-hd-l">
              <span className="material-symbols-outlined">euro</span>
              <div>
                <div className="chart-hd-ttl">{t('eng.an.rev_channel', 'Revenue by')} <em>{t('eng.an.rev_channel_em', 'channel')}</em></div>
                <div className="chart-hd-sub">{t('eng.an.rev_channel_sub', 'App-attributed revenue from campaign touches. Cost shown as net after channel fees.')}</div>
              </div>
            </div>
          </div>

          <div className="rev-chan">
            {[
              { name:t('eng.channels.email', 'Email'),     ch:'email', icon:'mail',         iconColor:'var(--gold-dk)', pct:'100%',  label:'58.3%', val:'€2,810', fee:t('eng.camp.free', 'FREE')         },
              { name:t('eng.channels.wa', 'WhatsApp'),  ch:'wa',    icon:'chat',         iconColor:'#1a9e4d',         pct:'55.5%', label:'32.4%', val:'€1,560', fee:t('eng.an.fee_amount', { amount: '31', defaultValue: '−€{{amount}} fees' })    },
              { name:t('eng.channels.print', 'Print'),     ch:'print', icon:'description',  iconColor:'var(--stone)',    pct:'16%',   label:'9.3%',  val:'€450',   fee:t('eng.an.print_fee_amount', { amount: '12', defaultValue: '−€{{amount}} print' })   },
            ].map(r => (
              <div key={r.name} className="rev-chan-row">
                <div className="rev-chan-name">
                  <span className="material-symbols-outlined" style={{ color:r.iconColor }}>{r.icon}</span>
                  <span>{r.name}</span>
                </div>
                <div className="rev-chan-bar"><div className={`rev-chan-fill ${r.ch}`} style={{ width:r.pct }}>{r.label}</div></div>
                <div className="rev-chan-val">{r.val}<span className="sub">{r.fee}</span></div>
              </div>
            ))}
            <div className="rev-chan-row eng-row-muted">
              <div className="rev-chan-name">
                <span className="material-symbols-outlined" style={{color:'#DD2A7B'}}>photo_camera</span>
                <span>{t('eng.channels.insta', 'Instagram')}</span>
              </div>
              <div className="rev-chan-bar"><div className="rev-chan-fill insta" style={{ width:'4%' }} /></div>
              <div className="rev-chan-val eng-soon-val">{t('eng.an.soon', 'Soon')}</div>
            </div>
          </div>

          <div className="eng-card-footer">
            <strong className="eng-strong">{t('eng.an.email_highest_roi', 'Email is your highest ROI channel')}</strong>
            <span> — {t('eng.an.email_highest_roi_sub', '58% of attributed revenue at zero cost. Consider running more email-led campaigns to VIPs.')}</span>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-hd">
            <div className="chart-hd-l">
              <span className="material-symbols-outlined">filter_alt</span>
              <div>
                <div className="chart-hd-ttl">{t('eng.an.eng_funnel', 'Engagement')} <em>{t('eng.an.eng_funnel_em', 'funnel')}</em></div>
                <div className="chart-hd-sub">{t('eng.an.eng_funnel_sub', 'From contact to purchase. Drop-off rates between stages — where to focus next.')}</div>
              </div>
            </div>
          </div>

          <div className="funnel">
            {[
              { icon:'groups',     label:t('eng.an.funnel_engaged', 'Engaged contacts'), pct:100,  val:'1,184', sub:t('eng.an.in_audience', 'in audience') },
              { drop:'−22%',       text:t('eng.an.drop_no_open', "didn't open") },
              { icon:'drafts',     label:t('eng.an.opened_read', 'Opened / read'),    pct:78,   val:'921',   sub:t('eng.an.of_count', { count: '1,184', defaultValue: 'of {{count}}' }) },
              { drop:'−71%',       text:t('eng.an.drop_no_click', "opened but didn't click") },
              { icon:'touch_app',  label:t('eng.an.clicked_replied', 'Clicked / replied'), pct:22.3, val:'264',   sub:t('eng.an.of_count', { count: 921, defaultValue: 'of {{count}}' }) },
              { drop:'−68%',       text:t('eng.an.drop_no_visit', "clicked but didn't visit store") },
              { icon:'store',      label:t('eng.an.visited_store', 'Visited store'),     pct:7.1,  val:'84',    sub:t('eng.an.of_count', { count: 264, defaultValue: 'of {{count}}' }) },
              { drop:'−55%',       text:t('eng.an.drop_no_buy', "visited but didn't buy") },
              { icon:'check_circle', label:t('eng.an.action_purchased', 'Purchased'),       pct:3.2,  val:'38',    sub:t('eng.an.of_visits', { count: 84, defaultValue: 'of {{count}} visits' }), success:true },
            ].map((r, i) => {
              if (r.drop) {
                return (
                  <div key={i} className="funnel-drop">
                    <span className="material-symbols-outlined eng-icon-xs">south</span>
                    <strong>{r.drop}</strong>&nbsp;<span>{r.text}</span>
                  </div>
                )
              }
              return (
                <div key={i} className="funnel-step">
                  <div className="funnel-lbl">
                    <span className="material-symbols-outlined" style={r.success ? { color:'var(--green)' } : undefined}>{r.icon}</span>
                    <span>{r.label}</span>
                  </div>
                  <div className="funnel-bar-wrap">
                    <div className={`funnel-bar${r.success ? ' funnel-bar-success' : ''}`} style={{ width:`${r.pct}%` }}>{r.pct}%</div>
                  </div>
                  <div className="funnel-val" style={r.success ? { color:'var(--green)' } : undefined}>
                    {r.val}<span className="sub" style={r.success ? { color:'var(--green)' } : undefined}>{r.sub}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="eng-card-footer">
            <strong className="eng-strong">{t('eng.an.biggest_drop', 'Biggest drop: opened → clicked (71%).')}</strong>
            <span> {t('eng.an.biggest_drop_sub', 'A/B test stronger calls-to-action or more visual previews in your next campaign.')}</span>
          </div>
        </div>
      </div>

      {/* ── Campaign ROI table ── */}
      <div className="chart-card eng-mb18">
        <div className="chart-hd">
          <div className="chart-hd-l">
            <span className="material-symbols-outlined">leaderboard</span>
            <div>
              <div className="chart-hd-ttl">{t('eng.an.campaign_roi_title', 'Campaign')} <em>{t('eng.an.col_roi', 'ROI')}</em></div>
              <div className="chart-hd-sub">{t('eng.an.roi_table_sub', 'Every campaign in the selected range, ranked by ROI. Cost includes channel fees only — not your time.')}</div>
            </div>
          </div>
          <div className="chart-hd-rt">
            <button className="btn btn-ghost btn-xs"><span className="material-symbols-outlined">download</span>{t('common.export', 'Export')}</button>
          </div>
        </div>

        {topCampaignsLoading ? (
          <div className="eng-loading">{t('eng.an.loading_top', 'Loading top campaigns…')}</div>
        ) : roiRows.length === 0 ? (
          <div className="eng-loading">{t('eng.an.no_sent_campaigns', 'No sent campaigns yet.')}</div>
        ) : (
          <>
            <table className="croi-tbl">
              <thead>
                <tr>
                  <th>{t('eng.an.col_campaign', 'Campaign')}</th><th>{t('eng.an.col_date', 'Date')}</th>
                  <th className="num">{t('eng.an.col_sent', 'Sent')}</th><th className="num">{t('eng.an.col_open_short', 'Open')}</th><th className="num">{t('eng.an.col_click', 'Click')}</th>
                  <th className="num">{t('eng.an.col_revenue', 'Revenue')}</th><th className="num">{t('eng.an.col_cost', 'Cost')}</th><th className="num">{t('eng.an.col_roi', 'ROI')}</th>
                </tr>
              </thead>
              <tbody>
                {roiRows.map(c => (
                  <tr key={c.id} onClick={() => onOpenCampaignDetail(c.id)}>
                    <td>
                      <div className="croi-name">
                        <div className={`cn-ico ${c.ch}`}><span className="material-symbols-outlined">{c.ch === 'wa' ? 'chat' : c.ch === 'print' ? 'description' : 'mail'}</span></div>
                        <span>{c.name}</span>
                      </div>
                    </td>
                    <td className="eng-meta-sm">{c.date}</td>
                    <td className="num">{c.sent}</td>
                    <td className="num">{c.open}</td>
                    <td className="num">{c.click}</td>
                    <td className="num"><strong>{c.rev}</strong></td>
                    <td className="num">{c.cost}</td>
                    <td className={`num croi-roi ${c.pos ? 'pos' : 'neg'}`}>{c.roi}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="eng-card-footer-row">
              <div>
                <strong className="eng-strong">{t('eng.an.profitable_count', { count: roiTotals.profitable, total: roiRows.length, defaultValue: '{{count}} of {{total}} campaigns profitable.' })}</strong>
              </div>
              <div className="eng-ml-auto eng-tnum">
                <span>{t('eng.an.total_label', 'Total:')} </span>
                <strong className="eng-strong">€{roiTotals.revenue.toLocaleString()}</strong><span> {t('eng.an.attributed', 'attributed')} · </span>
                <strong className="eng-strong">€{roiTotals.cost.toFixed(2)}</strong><span> {t('eng.an.cost_label', 'cost')} · </span>
                <strong className="eng-green">{fmtROI(roiTotals.revenue, roiTotals.cost)}<span> {t('eng.an.col_roi', 'ROI')}</span></strong>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Row 2: Segment health stacked + Cohort retention ── */}
      <div className="an-grid2-even">
        <div className="chart-card">
          <div className="chart-hd">
            <div className="chart-hd-l">
              <span className="material-symbols-outlined">stacked_bar_chart</span>
              <div>
                <div className="chart-hd-ttl">{t('eng.an.seg_health', 'Segment')} <em>{t('eng.an.seg_health_em', 'health')}</em></div>
                <div className="chart-hd-sub">{t('eng.an.seg_health_sub', 'How your customer mix has shifted over the last 6 months.')}</div>
              </div>
            </div>
            <div className="chart-hd-rt">
              <div className="chart-legend">
                {[
                  { sw:'var(--gold)',                 label:t('eng.camp.seg_vip', 'VIP') },
                  { sw:'var(--gold-light)',           label:t('eng.an.seg_returning', 'Returning') },
                  { sw:'var(--gold-soft)',            label:t('eng.camp.seg_new', 'New') },
                  { sw:'rgba(140,123,107,0.4)',       label:t('eng.camp.seg_lapsed', 'Lapsed') },
                ].map(l => (
                  <div key={l.label} className="chart-legend-itm">
                    <div className="chart-legend-sw" style={{ background:l.sw }} />
                    <span>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="seg-area">
            <svg viewBox="0 0 600 240" preserveAspectRatio="none" className="seg-area-svg">
              <line className="idr-grid" x1="40" y1="40"  x2="580" y2="40"  />
              <line className="idr-grid" x1="40" y1="90"  x2="580" y2="90"  />
              <line className="idr-grid" x1="40" y1="140" x2="580" y2="140" />
              <line className="idr-grid" x1="40" y1="190" x2="580" y2="190" />

              <text className="idr-axis" x="36" y="44"  textAnchor="end">1,200</text>
              <text className="idr-axis" x="36" y="94"  textAnchor="end">900</text>
              <text className="idr-axis" x="36" y="144" textAnchor="end">600</text>
              <text className="idr-axis" x="36" y="194" textAnchor="end">300</text>
              <text className="idr-axis" x="36" y="214" textAnchor="end">0</text>

              <path className="sh-vip"       d="M 40 210 L 148 210 L 256 210 L 364 210 L 472 210 L 580 210 L 580 170.82 L 472 172.87 L 364 175.24 L 256 176.82 L 148 179.19 L 40 181.56 Z" />
              <path className="sh-returning" d="M 40 181.56 L 148 179.19 L 256 176.82 L 364 175.24 L 472 172.87 L 580 170.82 L 580 103.51 L 472 108.09 L 364 113.94 L 256 119.15 L 148 125.47 L 40 131 Z" />
              <path className="sh-new"       d="M 40 131 L 148 125.47 L 256 119.15 L 364 113.94 L 472 108.09 L 580 103.51 L 580 46.94 L 472 55.95 L 364 67.33 L 256 78.07 L 148 90.71 L 40 102.56 Z" />
              <path className="sh-lapsed"    d="M 40 102.56 L 148 90.71 L 256 78.07 L 364 67.33 L 472 55.95 L 580 46.94 L 580 22.93 L 472 32.57 L 364 45.21 L 256 56.74 L 148 70.17 L 40 83.6 Z" />

              {['Dec','Jan','Feb','Mar','Apr','May'].map((m, i) => (
                <text key={m} className="idr-axis" x={40 + i*108} y="230" textAnchor="middle">{m}</text>
              ))}
            </svg>
          </div>

          <div className="an-seg-footer">
            {[
              { lbl:t('eng.camp.seg_vip', 'VIP'),       val:'248', delta:'↑ +38%', color:'var(--green)' },
              { lbl:t('eng.an.seg_returning', 'Returning'), val:'426', delta:'↑ +33%', color:'var(--green)' },
              { lbl:t('eng.camp.seg_new', 'New'),       val:'358', delta:'↑ +99%', color:'var(--green)' },
              { lbl:t('eng.camp.seg_lapsed', 'Lapsed'),    val:'152', delta:'↑ +27%', color:'#B45309' },
            ].map(s => (
              <div key={s.lbl}>
                <div className="an-seg-footer-lbl">{s.lbl}</div>
                <div className="an-seg-footer-val">{s.val}</div>
                <div className="an-seg-delta" style={{color:s.color}}>{s.delta}</div>
              </div>
            ))}
          </div>
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

          <div className="cohort">
            <div className="cohort-hd cohort-row-lbl">{t('eng.an.acquired_in', 'Acquired in')}</div>
            {['M+0','M+1','M+2','M+3','M+4','M+5'].map(h => <div key={h} className="cohort-hd">{h}</div>)}

            {[
              { name:"Dec '25", contacts:'84',  cells:[['c5','100%'],['c3','42%'],['c2','31%'],['c2','29%'],['c2','26%'],['c2','24%']] },
              { name:"Jan '26", contacts:'112', cells:[['c5','100%'],['c3','46%'],['c2','33%'],['c2','28%'],['c2','25%'],['empty','—']] },
              { name:"Feb '26", contacts:'148', cells:[['c5','100%'],['c3','51%'],['c3','38%'],['c2','31%'],['empty','—'],['empty','—']] },
              { name:"Mar '26", contacts:'196', cells:[['c5','100%'],['c4','58%'],['c3','42%'],['empty','—'],['empty','—'],['empty','—']] },
              { name:"Apr '26", contacts:'221', cells:[['c5','100%'],['c4','62%'],['empty','—'],['empty','—'],['empty','—'],['empty','—']] },
              { name:"May '26", contacts:'234', cells:[['c5','100%'],['empty','—'],['empty','—'],['empty','—'],['empty','—'],['empty','—']] },
            ].flatMap(row => [
              <div key={`${row.name}-name`} className="cohort-row-name">{row.name}<span className="sub">{t('eng.an.contacts_count', { count: row.contacts, defaultValue: '{{count}} contacts' })}</span></div>,
              ...row.cells.map(([cls, v], i) => <div key={`${row.name}-${i}`} className={`cohort-cell ${cls}`}>{v}</div>),
            ])}
          </div>

          <div className="eng-card-footer">
            <strong className="eng-strong">{t('eng.an.retention_improving', 'Retention is improving')}</strong>
            <span> — {t('eng.an.retention_improving_sub', 'M+1 went from 42% (Dec) to 62% (Apr). Your engagement work is paying off in repeat visits.')}</span>
          </div>
        </div>
      </div>

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
    <div className="modal-backdrop" onClick={() => !saving && onClose()}>
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
  const [notifyTarget,   setNotifyTarget]  = useState(null)
  const [notifyMsg,      setNotifyMsg]     = useState('')
  const [notifying,      setNotifying]     = useState(false)
  const [notifyResult,   setNotifyResult]  = useState(null)

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
    setSaversFor(p); setSavers([]); setSaversLoading(true)
    favoritesApi.savers(p.product_id)
      .then(res => { if (res?.success) setSavers(res.data?.savers ?? []) })
      .catch(() => {})
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

  return (
    <div>
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
                <button className="btn btn-outline btn-sm" onClick={() => openSavers(p)}>
                  <span className="material-symbols-outlined">people</span>{t('eng.fav.view_savers', { count: p.saver_count ?? 0, defaultValue: 'View all {{count}} savers' })}
                </button>
              </div>
            </div>
          )
        })
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
        <div className="modal-backdrop" onClick={() => !notifying && setNotifyTarget(null)}>
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
    </div>
  )
}



// ── TEMPLATES VIEW ─────────────────────────────────────
// Stage 1: Library + Detail header/stats + Structure + Preview tabs
// Stage 2: Variables + Performance + Languages + Versions + Modals

const TEMPLATES = {
  'new-arrivals': {
    emoji:'👗', name:<>New <em>Arrivals</em></>, plainName:'New Arrivals', grad:'linear-gradient(135deg,#2A1510,#1A0D07)',
    desc:'Announce a new collection or drop with a hero visual, editorial body, and a single clear action. Built for Email, with streamlined WhatsApp and Push variants.',
    status:'approved', statusText:'Approved · All channels', channels:['email','wa','push'], version:'v2.1', category:'announcements',
    stats:['4×','44%','12%','€1,940'], statSub:['by Sartoria Belloni','Avg open · Email','Avg click · Email','Attributed'],
    subjectEx:'Your subject, e.g. "The Spring edit is in Brera"',
    bodyEx:'2 to 4 sentences introducing the arrival. Editorial, specific, Italian in spirit. No exclamation marks, no discount language.',
    ctaEx:'e.g. "View the collection" or "Scopri la collezione"',
    pv:{ subject:'The Spring edit is in Brera', preview:'New arrivals from our Spring/Summer 2026 edit…', heroEmoji:'👗', heroLabel:'Spring · Summer 2026',
      greeting:'Dear Sofia,', body:'The Spring/Summer 2026 collection is now in the boutique. A considered selection from Italian artisans we trust: silk blouses, hand-tailored trousers, each chosen for its craft and quiet elegance.\n\nSee it in Brera, or reserve a private appointment through Mi Italia.',
      cta:'View the collection →', waHdr:'The Spring edit at Sartoria Belloni', waBody:'Dear Sofia,\n\nThe Spring/Summer 2026 collection is now in the boutique. A considered selection from Italian artisans we trust. See it in Brera or reserve through Mi Italia.',
      pushTitle:'The Spring edit at Sartoria Belloni', pushBody:'The S/S 2026 collection is now in the boutique on Corso Venezia.' },
    perf:[
      { date:'24 Mar 2026', name:'Spring Collection — New Arrivals', meta:'📧 Email · 612 sent · Loyal + New', open:'44%', click:'12%', revenue:'€640', barPct:44 },
      { date:'10 Jan 2026', name:'Inverno 2026 — Nuovi Arrivi', meta:'📧 Email · 588 sent · All contacts', open:'41%', click:'10%', revenue:'€820', barPct:41 },
      { date:'15 Sep 2025', name:'Autunno / Inverno 2025 Collection', meta:'📧 Email · 421 sent · All contacts', open:'48%', click:'14%', revenue:'€340', barPct:48 },
      { date:'2 Jun 2025', name:'Estate 2025 — Primissimi Arrivi', meta:'📧 Email · 310 sent · All contacts', open:'42%', click:'11%', revenue:'€140', barPct:42 },
    ],
    bestSubjects:[
      { pct:'48%', name:'Autunno / Inverno 2025 Collection', meta:'Sep 2025 · 421 sent', top:true },
      { pct:'44%', name:'Our Spring Collection Has Arrived 🌸', meta:'Mar 2026 · 612 sent' },
      { pct:'42%', name:'Estate 2025 — Primissimi Arrivi', meta:'Jun 2025 · 310 sent' },
    ],
    langContent:{ subject:'La Nostra Collezione Primavera è Arrivata 🌸', preview:'Nuovi arrivi dalla nostra selezione P/E 2026…',
      body:'Cara {{first_name}},\n\nLa nostra collezione Primavera/Estate 2026 è finalmente arrivata da Sartoria Belloni. Scopri pezzi selezionati con cura dai migliori artigiani italiani — dalle bluse in seta ai pantaloni sartoriali.\n\nDisponibile in boutique su Corso Venezia o prenota il tuo appuntamento su Mi Italia.' },
    versions:[
      { ver:'Version 2.1', badge:'current', desc:'Updated 1 Mar 2026 · Body character limit increased 300→400 · WhatsApp CTA button added' },
      { ver:'Version 2.0', badge:'archived', desc:'Updated 15 Jan 2026 · Hero image section added · Push notification variant added' },
      { ver:'Version 1.0', badge:'archived', desc:'Original · Launched Jun 2025 · Email only · Body max 300 chars' },
    ],
  },
  'vip-access': {
    emoji:'⭐', name:<>VIP Early <em>Access</em></>, plainName:'VIP Early Access', grad:'linear-gradient(135deg,#1A1005,#0D0A03)',
    desc:'Offer your best clients a private window before a launch opens to everyone. Warm, exclusive, and personal in tone.',
    status:'approved', statusText:'Approved · Email + WhatsApp', channels:['email','wa'], version:'v1.4', category:'announcements',
    stats:['2×','61%','19%','€4,820'], statSub:['by Sartoria Belloni','Avg open · Email','Avg click · Email','Attributed'],
    subjectEx:'Your subject, e.g. "A private preview, before anyone else"',
    bodyEx:'2 to 3 sentences making the client feel chosen. Name the window and how to reserve. Keep it confidential in tone.',
    ctaEx:'e.g. "Reserve your preview" or "Prenota l\'anteprima"',
    pv:{ subject:'A private preview, before anyone else', preview:'Your early window opens Thursday…', heroEmoji:'⭐', heroLabel:'Private Preview',
      greeting:'Cara Sofia,', body:'As one of our closest clients, you are invited to view the new arrivals on Thursday evening, before the collection opens to everyone.\n\nA glass of something and an unhurried hour in Brera. Reply, or reserve through Mi Italia.',
      cta:'Reserve your preview →', waHdr:'A private preview for you', waBody:'Cara Sofia,\n\nYou are invited to view the new arrivals on Thursday evening, before they open to everyone. An unhurried hour in Brera. Reserve through Mi Italia.',
      pushTitle:'Your private preview', pushBody:'Thursday evening in Brera, before the collection opens to all.' },
    perf:[], bestSubjects:[], langContent:null, versions:[{ ver:'Version 1.4', badge:'current', desc:'Current version' }],
  },
  'back-in-stock': {
    emoji:'📦', name:<>Back in <em>Stock</em></>, plainName:'Back in Stock', grad:'linear-gradient(135deg,#0A1A10,#051008)',
    desc:'Tell a customer that a piece they saved is available again. Fires from the Favorites automation. Short and useful.',
    status:'approved', statusText:'Approved · Push + WhatsApp', channels:['push','wa'], version:'v1.2', category:'announcements',
    stats:['3×','38%','—','€2,110'], statSub:['by Sartoria Belloni','Avg tap · Push','No click data','Attributed'],
    subjectEx:'Not used for Push. WhatsApp header, e.g. "Back in your size"',
    bodyEx:'One or two sentences. Name the item and the size. Say where to find it.',
    ctaEx:'e.g. "See it" or "Riservalo"',
    pv:{ subject:'The piece you saved is back', preview:'Available again in your size…', heroEmoji:'📦', heroLabel:'Back in Stock',
      greeting:'Dear Sofia,', body:'The Cashmere Trench you saved is available again in your size.\n\nWe can hold it for 24 hours if you would like to see it in Brera.',
      cta:'See it on Mi Italia →', waHdr:'Back in your size', waBody:'Dear Sofia,\n\nThe Cashmere Trench you saved is back in your size. We can hold it for 24 hours if you would like to come to Brera.',
      pushTitle:'A saved piece is back', pushBody:'The Cashmere Trench you saved is available again in your size.' },
    perf:[], bestSubjects:[], langContent:null, versions:[{ ver:'Version 1.2', badge:'current', desc:'Current version' }],
  },
  'win-back': {
    emoji:'💌', name:<>Win-<em>Back</em></>, plainName:'Win-Back', grad:'linear-gradient(135deg,#1A0A0A,#100505)',
    desc:'Reach a client you have not seen in a while, warmly and without pressure. Reference their history, invite them back.',
    status:'approved', statusText:'Approved · Email', channels:['email'], version:'v1.0', category:'engagement',
    stats:['—','—','—','—'], statSub:['Not yet used','No data','No data','No data'],
    subjectEx:'Your subject, e.g. "It has been a while"',
    bodyEx:'2 to 3 sentences. Acknowledge the gap gently, reference a past purchase, extend a warm invitation.',
    ctaEx:'e.g. "Come see us" or "Torna a trovarci"',
    pv:{ subject:'It has been a while', preview:'We saved a few things we think you would like…', heroEmoji:'💌', heroLabel:'We miss you',
      greeting:'Cara Sofia,', body:'It has been a few months since your last visit, when you found the silk blouse you liked so much.\n\nThe new season has brought in pieces in the same spirit. We would love to show you, whenever you are next in Brera.',
      cta:'Come see us →', waHdr:'It has been a while', waBody:'Cara Sofia,\n\nIt has been a few months since we saw you. The new season has pieces in the spirit of the silk blouse you liked. Come by Brera whenever suits you.',
      pushTitle:'It has been a while', pushBody:'New pieces in the spirit of what you loved. Come see us in Brera.' },
    perf:[], bestSubjects:[], langContent:null, versions:[{ ver:'Version 1.0', badge:'current', desc:'Original version' }],
  },
  'birthday': {
    emoji:'🎂', name:<>Birthday <em>Greeting</em></>, plainName:'Birthday Greeting', grad:'linear-gradient(135deg,#1A100A,#0D0805)',
    desc:'A warm birthday note, sent automatically on the day. No hard sell, just a gesture. Highest read rate of any template.',
    status:'approved', statusText:'Approved · WhatsApp', channels:['wa'], version:'v1.6', category:'engagement',
    stats:['12×','100%','—','—'], statSub:['by Sartoria Belloni','Read rate · WhatsApp','No click data','Gesture, not sale'],
    subjectEx:'Not used for WhatsApp. Header, e.g. "Buon compleanno"',
    bodyEx:'One or two warm sentences. A genuine wish. Optionally a small gesture, never a discount code.',
    ctaEx:'Optional, e.g. "Come celebrate with us"',
    pv:{ subject:'Buon compleanno, Sofia', preview:'A small note from all of us…', heroEmoji:'🎂', heroLabel:'Buon Compleanno',
      greeting:'Cara Sofia,', body:'Buon compleanno from all of us in Brera.\n\nWe hope the day is a lovely one. Should you wish to mark it with something, we would be delighted to welcome you.',
      cta:'', waHdr:'Buon compleanno, Sofia', waBody:'Cara Sofia,\n\nBuon compleanno from all of us in Brera. We hope the day is a lovely one, and we would be delighted to welcome you whenever you wish.',
      pushTitle:'Buon compleanno, Sofia', pushBody:'A warm birthday wish from all of us at Sartoria Belloni.' },
    perf:[], bestSubjects:[], langContent:null, versions:[{ ver:'Version 1.6', badge:'current', desc:'Current version' }],
  },
  'reservation-reminder': {
    emoji:'📅', name:<>Reservation <em>Reminder</em></>, plainName:'Reservation Reminder', grad:'linear-gradient(135deg,#0A0A1A,#060610)',
    desc:'Remind a client of an upcoming reservation or a hold that is about to expire. Automation only. Practical and precise.',
    status:'approved', statusText:'Approved · WhatsApp · Automation only', channels:['wa'], version:'v2.0', category:'engagement',
    stats:['—','94%','—','—'], statSub:['Automation','Show rate','No click data','Operational'],
    subjectEx:'Not used. WhatsApp header, e.g. "Your reservation tomorrow"',
    bodyEx:'One or two sentences. State the date, time, and what is held. Give a simple way to change it.',
    ctaEx:'e.g. "Confirm" or "Reschedule"',
    pv:{ subject:'Your reservation tomorrow', preview:'A quick reminder…', heroEmoji:'📅', heroLabel:'Reservation',
      greeting:'Dear Sofia,', body:'A reminder that we are holding the Cashmere Trench for you until tomorrow at 18:00.\n\nDo let us know if you would like more time, or a different day.',
      cta:'Confirm →', waHdr:'Your reservation tomorrow', waBody:'Dear Sofia,\n\nWe are holding the Cashmere Trench for you until tomorrow at 18:00. Let us know if you need more time or a different day.',
      pushTitle:'Reservation tomorrow', pushBody:'We are holding your piece until tomorrow at 18:00 in Brera.' },
    perf:[], bestSubjects:[], langContent:null, versions:[{ ver:'Version 2.0', badge:'current', desc:'Current version' }],
  },
  'seasonal': {
    emoji:'🎁', name:<>Seasonal <em>Promotion</em></>, plainName:'Seasonal Promotion', grad:'linear-gradient(135deg,#1A1205,#100C03)',
    desc:'Mark a moment in the calendar with restraint. Currently awaiting Mi Italia review.',
    status:'pending', statusText:'Review required · Email', channels:['email'], version:'draft', category:'seasonal',
    stats:['—','—','—','—'], statSub:['Draft','No data','No data','No data'],
    subjectEx:'Your subject, e.g. "For the season ahead"',
    bodyEx:'2 to 3 sentences tied to the moment. Editorial, never shouty.',
    ctaEx:'e.g. "Explore the edit" or "Scopri"',
    pv:{ subject:'For the season ahead', preview:'A small selection for the festive weeks…', heroEmoji:'🎁', heroLabel:'The Season',
      greeting:'Cara Sofia,', body:'For the weeks ahead we have brought together a small edit of pieces that carry well through the season, from evening silk to winter tailoring.\n\nCome see them in Brera, or explore the edit on Mi Italia.',
      cta:'Explore the edit →', waHdr:'For the season ahead', waBody:'Cara Sofia,\n\nA small edit for the festive weeks, from evening silk to winter tailoring. Come see it in Brera or on Mi Italia.',
      pushTitle:'For the season ahead', pushBody:'A small edit for the festive weeks, in Brera and on Mi Italia.' },
    perf:[], bestSubjects:[], langContent:null, versions:[],
  },
  'event-invite': {
    emoji:'🎭', name:<>Event <em>Invite</em></>, plainName:'Event Invite', grad:'linear-gradient(135deg,#0A0A2A,#050518)',
    desc:'Invite clients to an in-boutique moment. Sent across Email and Push.',
    status:'approved', statusText:'Approved · Email + Push', channels:['email','push'], version:'v1.3', category:'seasonal',
    stats:['—','52%','—','—'], statSub:['by Sartoria Belloni','Avg open · Email','No click data','RSVP tracked'],
    subjectEx:'Your subject, e.g. "An evening with the atelier"',
    bodyEx:'2 to 3 sentences. Name the occasion, the date, and how to RSVP. Make it feel like an invitation, not a flyer.',
    ctaEx:'e.g. "RSVP" or "Confermare"',
    pv:{ subject:'An evening with the atelier', preview:'Thursday the 22nd, from 18:00…', heroEmoji:'🎭', heroLabel:'You are invited',
      greeting:'Cara Sofia,', body:'We are hosting an evening in Brera on Thursday the 22nd, from 18:00, with the maker of our knitwear line and a few of the season\'s best pieces.\n\nWe would be glad to see you there. Kindly let us know if you can come.',
      cta:'RSVP →', waHdr:'An evening with the atelier', waBody:'Cara Sofia,\n\nAn evening in Brera, Thursday the 22nd from 18:00, with the maker of our knitwear line. We would be glad to see you. Let us know if you can come.',
      pushTitle:'An evening in Brera', pushBody:'Thursday the 22nd from 18:00, with the maker of our knitwear line.' },
    perf:[], bestSubjects:[], langContent:null, versions:[{ ver:'Version 1.3', badge:'current', desc:'Current version' }],
  },
  'custom-1': {
    emoji:'✨', name:<>Exclusive <em>Pre-Order</em></>, plainName:'Exclusive Pre-Order', grad:'linear-gradient(135deg,#1A0508,#100305)',
    desc:'A custom template for offering a made-to-order or pre-release piece. Currently in Mi Italia review.',
    status:'review', statusText:'In Mi Italia review · Email', channels:['email'], version:'draft', category:'custom',
    stats:['—','—','—','—'], statSub:['In review','No data','No data','No data'],
    subjectEx:'Your subject, e.g. "Reserve yours before production"',
    bodyEx:'2 to 3 sentences. Explain what is being pre-offered, the window, and how to reserve. Exclusive, not urgent.',
    ctaEx:'e.g. "Reserve yours" or "Prenota"',
    pv:{ subject:'Reserve yours before production', preview:'A limited made-to-order run…', heroEmoji:'✨', heroLabel:'Pre-Order',
      greeting:'Cara Sofia,', body:'We are opening a small made-to-order run of the Bordeaux silk dress, in your size, before production is confirmed.\n\nReservations are open this week only. We would be glad to hold one for you.',
      cta:'Reserve yours →', waHdr:'Reserve before production', waBody:'Cara Sofia,\n\nA small made-to-order run of the Bordeaux silk dress, in your size, before production is confirmed. Reservations open this week. We would be glad to hold one.',
      pushTitle:'Pre-order open this week', pushBody:'A made-to-order run of the Bordeaux silk dress, in your size.' },
    perf:[], bestSubjects:[], langContent:null, versions:[],
  },
}

function getTplKeysByCat(t) {
  return [
    { label:t('eng.tpl.cat_announcements', 'Announcements'), keys:['new-arrivals','vip-access','back-in-stock'] },
    { label:t('eng.tpl.cat_engagement', 'Engagement'),    keys:['win-back','birthday','reservation-reminder'] },
    { label:t('eng.tpl.cat_seasonal', 'Seasonal'),      keys:['seasonal','event-invite'] },
    { label:t('eng.tpl.cat_custom', { name: 'Sartoria Belloni', defaultValue: 'Custom ({{name}})' }), keys:['custom-1'] },
  ]
}

function getTplStatLabels(t) {
  return [t('eng.tpl.stat_times_used', 'Times Used'), t('eng.tpl.stat_avg_open', 'Avg Open Rate'), t('eng.tpl.stat_avg_click', 'Avg Click Rate'), t('eng.tpl.stat_total_revenue', 'Total Revenue')]
}

const TPL_VARIABLES = {
  contact: [
    { token:'{{first_name}}',       desc:'Customer\'s first name from their Mi Italia profile.',                    fb:'Fallback: "Gentile Cliente" (or "Dear Customer" if English)', ex:'Example: "Dear Sofia,"' },
    { token:'{{full_name}}',         desc:'Customer\'s full name. Use in formal or luxury context.',                 fb:'Fallback: "Gentile Cliente"',                                 ex:'Example: "Cara Sofia Marchetti,"' },
    { token:'{{last_purchase_date}}',desc:'Date of the contact\'s most recent purchase from your boutique.',         fb:'Fallback: not recommended if contact may have never purchased',ex:'Example: "24 March 2026"' },
    { token:'{{last_purchase_item}}',desc:'Name of the most recently purchased item from your boutique.',            fb:'Fallback: "your last purchase"',                              ex:'Example: "your Silk Blouse"' },
  ],
  boutique: [
    { token:'{{boutique_name}}',    desc:'Your boutique name as set in Store Profile.',                              fb:'Always present — no fallback needed', fbOk:true,              ex:'Example: "Sartoria Belloni"' },
    { token:'{{boutique_address}}', desc:'Street address from Store Profile. Used in footers automatically.',        fb:'Always present — no fallback needed', fbOk:true,              ex:'Example: "Corso Venezia 15, Milano"' },
    { token:'{{boutique_phone}}',   desc:'Boutique contact number. Useful in WhatsApp and event templates.',         fb:'Fallback: omitted if not set in Store Profile',               ex:'Example: "+39 02 7600 0000"' },
    { token:'{{mi_italia_url}}',    desc:'Direct link to your Sartoria Belloni page on Mi Italia.',                  fb:'Always present — generated automatically', fbOk:true,         ex:'Example: "miitalia.com/boutique/neglia"' },
  ],
  product: [
    { token:'{{product_name}}',     desc:'Name of a specific product. Used in Back in Stock, Win-Back, and personalised campaigns.', fb:'Fallback: "a product you love"',           ex:'Example: "Cashmere Trench Coat"' },
    { token:'{{product_price}}',    desc:'Product price. Only available if price is not hidden.',                     fb:'Fallback: omitted entirely if price is hidden',               ex:'Example: "€1,290"' },
    { token:'{{saved_item_count}}', desc:'Number of items this contact has saved from your boutique.',                fb:'Fallback: "some items" — only use if contact has saves',      ex:'Example: "7 pieces"' },
    { token:'{{product_url}}',      desc:'Direct link to a specific product on Mi Italia.',                           fb:'Falls back to boutique page URL automatically', fbOk:true,   ex:'Example: "miitalia.com/…/cashmere-trench"' },
  ],
}

function getTplLanguages(t) {
  return [
    { code:'it', flag:'🇮🇹', name:langDisplayName('it', t),  status:t('eng.tpl.status_primary_ready', 'Primary · Ready'),    ready:true,  sel:true },
    { code:'en', flag:'🇬🇧', name:langDisplayName('en', t),  status:t('eng.tpl.status_approved_ready', 'Approved · Ready'),   ready:true,  sel:true },
    { code:'fr', flag:'🇫🇷', name:langDisplayName('fr', t),   status:t('eng.tpl.status_approved_ready', 'Approved · Ready'),   ready:true,  sel:true },
    { code:'de', flag:'🇩🇪', name:langDisplayName('de', t),   status:t('eng.tpl.status_approved_ready', 'Approved · Ready'),   ready:true,  sel:true },
    { code:'es', flag:'🇪🇸', name:langDisplayName('es', t),  status:t('eng.tpl.status_approved_ready', 'Approved · Ready'),   ready:true,  sel:true },
    { code:'ar', flag:'🇸🇦', name:langDisplayName('ar', t),   status:t('eng.tpl.status_not_available', 'Not yet available'),  ready:false, sel:false },
    { code:'zh', flag:'🇨🇳', name:langDisplayName('zh', t), status:t('eng.tpl.status_not_available', 'Not yet available'),  ready:false, sel:false },
    { code:'ja', flag:'🇯🇵', name:langDisplayName('ja', t), status:t('eng.tpl.status_not_available', 'Not yet available'),  ready:false, sel:false },
  ]
}

function TemplatesView({ onNavigateToBuilder, emailSettings }) {
  const { t } = useTranslation()
  const [selId, setSelId]             = useState('new-arrivals')
  const [activeTab, setActiveTab]     = useState('structure')
  const [structCh, setStructCh]       = useState('email')
  const [prevCh, setPrevCh]           = useState('email')
  const [showUseModal, setShowUseModal]       = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [searchQ, setSearchQ]         = useState('')
  const [langNote, setLangNote]       = useState('')
  const [langRequesting, setLangRequesting] = useState(false)

  const tpl = TEMPLATES[selId]
  const pv = tpl?.pv || {}

  async function handleRequestTranslation() {
    // This library is currently mock data (no real template id from the backend) — see docs/engagement-gaps.md
    // case 10. Once TemplatesView is wired to GET /boutique/email-templates, this should call
    // templateApi.translate(tpl.id) exactly like the retranslate flow in CampaignReview does.
    if (!tpl?.id) {
      setLangNote(t('eng.tpl.err_not_connected', "This template isn't connected to the live library yet, so a real translation request can't be sent — ask your dev to wire the Templates tab to the backend first."))
      return
    }
    setLangRequesting(true)
    const res = await templateApi.translate(tpl.id).catch(() => ({ success:false, message:t('eng.tpl.err_network', 'Network error') }))
    setLangRequesting(false)
    setLangNote(res?.success ? (res.message || t('eng.tpl.translation_requested', 'Translation requested.')) : (res?.message || t('eng.tpl.err_request_failed', 'Request failed.')))
  }

  const TABS = [
    { key:'structure',   label:t('eng.tpl.tab_structure', 'Structure') },
    { key:'preview',     label:t('common.preview', 'Preview') },
    { key:'variables',   label:t('eng.tpl.tab_variables', 'Variables') },
    { key:'performance', label:t('eng.tpl.tab_performance', 'Performance') },
    { key:'languages',   label:t('eng.tpl.tab_languages', 'Languages') },
    { key:'versions',    label:t('eng.tpl.versions', 'Versions') },
  ]

  const selectTemplate = (id) => {
    setSelId(id)
    setActiveTab('structure')
    setStructCh('email')
    setPrevCh('email')
  }

  // ── Render helpers ──

  const StatusBadge = ({ status, text }) => {
    const cls = status === 'approved' ? 'tpl-sb-approved' : status === 'pending' ? 'tpl-sb-pending' : 'tpl-sb-review'
    const icon = status === 'approved' ? 'check_circle' : status === 'pending' ? 'pending' : 'hourglass_top'
    return <div className={`tpl-sb ${cls}`}><span className="material-symbols-outlined">{icon}</span>{text}</div>
  }

  const ChannelTag = ({ ch }) => <div className={`tpl-det-tag ${ch}`}>{ch === 'email' ? `📧 ${t('eng.channels.email', 'Email')}` : ch === 'wa' ? `💬 ${t('eng.channels.wa', 'WhatsApp')}` : `🔔 ${t('eng.tpl.push', 'Push')}`}</div>

  // ── Structure section renderer ──
  const TsSection = ({ type, icon, name, children }) => (
    <div className={`tpl-ts-sec ${type}`}>
      <div className="tpl-ts-hdr">
        <div className={`tpl-ts-ico ${type}`}><span className="material-symbols-outlined">{icon}</span></div>
        <div className="tpl-ts-name">{name}</div>
        <span className={`tpl-ts-type ${type}`}>{type === 'editable' ? t('eng.tpl.editable', 'Editable') : t('eng.tpl.fixed', 'Fixed')}</span>
      </div>
      <div className="tpl-ts-body">{children}</div>
    </div>
  )

  const TsField = ({ label, val, editable, limit }) => (
    <div className="tpl-ts-field">
      {label && <div className="tpl-ts-field-lbl">{label}</div>}
      <div className={`tpl-ts-field-val${editable ? ' editable' : ' fixed-val'}`}>{val}</div>
      {limit && <div className="tpl-ts-limit"><span className="material-symbols-outlined">straighten</span>{limit}</div>}
    </div>
  )

  // ── TAB: Structure ──
  const StructureTab = () => (
    <div>
      <div className="alert alert-info">
        <span className="material-symbols-outlined">info</span>
        <div dangerouslySetInnerHTML={{ __html: t('eng.tpl.structure_hint', '<strong>Green sections</strong> are yours to edit — fill in your content within the character limits shown. <strong>Grey sections</strong> are fixed by Mi Italia and cannot be changed.') }} />
      </div>

      <div className="tpl-ch-switch">
        {['email','wa','push'].map(ch => (
          <button key={ch} className={`btn btn-outline btn-sm tpl-ch-btn${structCh === ch ? ' act' : ''}`} onClick={() => setStructCh(ch)}>
            {ch === 'email' ? `📧 ${t('eng.channels.email', 'Email')}` : ch === 'wa' ? `💬 ${t('eng.channels.wa', 'WhatsApp')}` : `🔔 ${t('eng.tpl.push', 'Push')}`} {t('eng.tpl.structure', 'Structure')}
          </button>
        ))}
      </div>

      {structCh === 'email' && (
        <div className="tpl-ts">
          <div className="cdp-sec-title">{t('eng.tpl.email_structure_title', { name: tpl.plainName, defaultValue: 'Email Template Structure — {{name}}' })}</div>
          <TsSection type="fixed" icon="lock" name={t('eng.tpl.sec_header', 'Header — Mi Italia × Boutique Brand Bar')}>
            <TsField val="Mi Italia logo + Sartoria Belloni boutique name, pulled automatically from your Store Profile. Black background, gold accents." />
          </TsSection>
          <TsSection type="editable" icon="edit" name={t('eng.tpl.sec_hero', 'Hero Visual')}>
            <TsField label="Image / Emoji" val="Upload a JPG or PNG (600px wide, 4:3 ratio recommended). Or leave the emoji placeholder." editable limit="Max file size: 2MB · Formats: JPG, PNG, WebP" />
          </TsSection>
          <TsSection type="editable" icon="edit" name={t('eng.tpl.sec_subject_preview', 'Subject Line & Preview Text')}>
            <TsField label="Subject Line" val={tpl.subjectEx} editable limit="40–80 characters recommended · No ALL CAPS · Max 1 emoji" />
            <TsField label="Preview Text" val="Short supporting text visible in the inbox before opening" editable limit="Max 120 characters" />
          </TsSection>
          <TsSection type="editable" icon="edit" name={t('eng.tpl.sec_body', 'Body Copy')}>
            <TsField label="Greeting" val={<>Personalised greeting — e.g. "Dear <span className="tpl-ts-var">{'{{first_name}}'}</span>,"</>} editable />
            <TsField label="Main Body" val={tpl.bodyEx} editable limit="Max 400 characters · Plain text only · No markdown" />
          </TsSection>
          <TsSection type="editable" icon="edit" name={t('eng.tpl.sec_cta', 'Call to Action Button')}>
            <TsField label="Button Label" val={tpl.ctaEx} editable limit="Max 24 characters" />
            <TsField label="Destination" val="Your boutique page on Mi Italia, a specific product, or the new arrivals filter. All links must stay within Mi Italia." editable />
          </TsSection>
          <TsSection type="fixed" icon="lock" name={t('eng.tpl.sec_footer', 'Footer — Legal & Compliance')}>
            <TsField val={<>Boutique address (from Store Profile) · Unsubscribe link (GDPR required) · Privacy Policy link · Mi Italia terms. <strong>This cannot be removed or modified.</strong></>} />
          </TsSection>
        </div>
      )}

      {structCh === 'wa' && (
        <div className="tpl-ts">
          <div className="cdp-sec-title">{t('eng.tpl.wa_structure_title', { name: tpl.plainName, defaultValue: 'WhatsApp Template Structure — {{name}}' })}</div>
          <div className="alert alert-warn">
            <span className="material-symbols-outlined">warning</span>
            <div dangerouslySetInnerHTML={{ __html: t('eng.tpl.wa_structure_hint', 'WhatsApp template structure is set by Meta, not Mi Italia. Only the variable fields (shown in <span class="tpl-ts-var">purple</span>) can be changed per campaign.') }} />
          </div>
          <TsSection type="editable" icon="edit" name={t('eng.tpl.sec_header_short', 'Header')}><TsField label="Header Text" val='e.g. "🌸 New Collection at Sartoria Belloni"' editable limit="Max 60 chars · No variables allowed in header" /></TsSection>
          <TsSection type="editable" icon="edit" name={t('eng.tpl.sec_body_short', 'Body')}><TsField label="Body Text with Variables" val={<>Dear <span className="tpl-ts-var">{'{{1}}'}</span>, [your message]. Variable <span className="tpl-ts-var">{'{{1}}'}</span> = First Name, <span className="tpl-ts-var">{'{{2}}'}</span> = Product Name.</>} editable limit="Max 1,024 chars · Up to 5 variables" /></TsSection>
          <TsSection type="editable" icon="edit" name={t('eng.tpl.sec_footer_short', 'Footer')}><TsField label="Footer Text" val='Boutique name, e.g. "Sartoria Belloni · Milano"' editable limit="Max 60 chars" /></TsSection>
          <TsSection type="editable" icon="edit" name={t('eng.tpl.sec_cta_btn', 'CTA Button')}><TsField label="Button Label & URL" val="Button text: max 20 chars. URL: must be an approved Mi Italia domain." editable /></TsSection>
          <TsSection type="fixed" icon="lock" name={t('eng.tpl.sec_meta_optout', 'Meta Opt-Out Text')}><TsField val='WhatsApp automatically appends opt-out instructions ("Reply STOP to unsubscribe"). You cannot change this.' /></TsSection>
        </div>
      )}

      {structCh === 'push' && (
        <div className="tpl-ts">
          <div className="cdp-sec-title">{t('eng.tpl.push_structure_title', { name: tpl.plainName, defaultValue: 'Push Notification Structure — {{name}}' })}</div>
          <TsSection type="editable" icon="edit" name={t('eng.tpl.sec_title', 'Title')}><TsField label="Notification Title" val='e.g. "New arrivals at Sartoria Belloni 🌸" — shown in bold on the lock screen' editable limit="Max 65 chars · iOS truncates at ~50 chars · 1 emoji max" /></TsSection>
          <TsSection type="editable" icon="edit" name={t('eng.tpl.sec_body_short', 'Body')}><TsField label="Body Text" val='One or two sentences max — e.g. "Our S/S 2026 collection has arrived in store."' editable limit="Max 240 chars · ~2 lines visible before truncation" /></TsSection>
          <TsSection type="editable" icon="edit" name={t('eng.tpl.sec_action_deeplink', 'Action Button & Deep Link')}>
            <TsField label="Button Label" val='e.g. "View Collection" — max 20 chars.' editable />
            <TsField label="Deep Link" val="Where tapping opens in Mi Italia — your boutique page, a product, or a filtered collection." editable />
          </TsSection>
          <TsSection type="fixed" icon="lock" name={t('eng.tpl.sec_app_badge', 'App Badge & Icon')}><TsField val="Mi Italia app icon shown automatically by iOS/Android. Cannot be changed per notification." /></TsSection>
        </div>
      )}
    </div>
  )

  // ── TAB: Preview ──
  const PreviewTab = () => (
    <div>
      <div className="tpl-ch-switch">
        {['email','wa','push'].map(ch => (
          <button key={ch} className={`btn btn-outline btn-sm tpl-ch-btn${prevCh === ch ? ' act' : ''}`} onClick={() => setPrevCh(ch)}>
            {ch === 'email' ? `📧 ${t('eng.channels.email', 'Email')}` : ch === 'wa' ? `💬 ${t('eng.channels.wa', 'WhatsApp')}` : `🔔 ${t('eng.tpl.push', 'Push')}`} {t('common.preview', 'Preview')}
          </button>
        ))}
      </div>

      {prevCh === 'email' && (
        <>
          <div className="tpl-email-frame">
            <div className="tpl-ef-topbar">
              <div className="tpl-ef-dots"><div className="tpl-ef-dot" style={{background:'#FF5F57'}} /><div className="tpl-ef-dot" style={{background:'#FFBD2E'}} /><div className="tpl-ef-dot" style={{background:'#28C840'}} /></div>
              <div className="tpl-ef-urlbar">mail.google.com</div>
            </div>
            <div className="tpl-ef-subj-bar">
              <div className="tpl-ef-from">From: {emailSettings
                ? `${emailSettings.sender_display_name} via Mi Italia <${emailSettings.reply_to_email || `${emailSettings.sender_local_part}@${emailSettings.sender_domain}`}>`
                : t('common.loading', 'Loading...')}</div>
              <div className="tpl-ef-subj">{pv.subject}</div>
              <div className="tpl-ef-preview">{pv.preview}</div>
            </div>
            <div className="tpl-ef-body">
              <div className="tpl-ef-hdr"><div className="tpl-ef-logo">MI</div><div className="tpl-ef-brand">NEGLIA</div></div>
              <div className="tpl-ef-hero">
                <div className="tpl-ef-hero-overlay" />
                <span className="tpl-ef-hero-emoji">{pv.heroEmoji}</span>
                <div className="tpl-ef-hero-label">{pv.heroLabel}</div>
              </div>
              <div className="tpl-ef-content">
                <div className="tpl-ef-greeting">{pv.greeting}</div>
                <div className="tpl-ef-txt">{pv.body?.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</div>
                {pv.cta && <button className="tpl-ef-cta">{pv.cta}</button>}
                <div className="tpl-ef-divider" />
                <div className="tpl-ef-footer-txt">{t('eng.tpl.email_follow_footer', "You're receiving this because you follow Sartoria Belloni on Mi Italia.")}</div>
              </div>
              <div className="tpl-ef-footer">
                <div className="tpl-ef-footer-txt">Sartoria Belloni · Corso Venezia 15 · 20121 Milano MI, Italy<br /><a>{t('eng.tpl.unsubscribe', 'Unsubscribe')}</a> · <a>{t('eng.tpl.privacy_policy', 'Privacy Policy')}</a> · <a>{t('eng.tpl.mi_italia_terms', 'Mi Italia Terms')}</a></div>
              </div>
            </div>
          </div>
          <div className="tpl-ef-note">{t('eng.tpl.showing_preview_for', 'Showing preview for')} <strong>Sofia Marchetti</strong> ({t('eng.camp.seg_vip', 'VIP')}) · <a>{t('eng.tpl.change_preview_contact', 'Change preview contact →')}</a></div>
        </>
      )}

      {prevCh === 'wa' && (
        <div className="tpl-wa-frame">
          <div className="tpl-wa-top">
            <div className="tpl-wa-av">N</div>
            <div><div className="tpl-wa-biz">Sartoria Belloni</div><div className="tpl-wa-verified">{t('eng.tpl.wa_verified', '✓ Official Business · Verified')}</div></div>
          </div>
          <div className="tpl-wa-chat">
            <div className="tpl-wa-bubble">
              <div className="tpl-wa-bub-hdr"><div className="tpl-wa-bub-hdr-txt">{pv.waHdr}</div></div>
              <div className="tpl-wa-bub-body"><div className="tpl-wa-bub-txt">{pv.waBody?.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</div></div>
              <div className="tpl-wa-bub-footer"><div className="tpl-wa-bub-footer-txt">Sartoria Belloni · Milano</div></div>
              <div className="tpl-wa-time"><span className="tpl-wa-time-txt">10:24</span><span className="tpl-wa-ticks">✓✓</span></div>
              <div className="tpl-wa-cta-div" />
              <button className="tpl-wa-cta-btn"><span className="material-symbols-outlined">open_in_new</span>{t('eng.tpl.view_collection_mi', 'View Collection on Mi Italia')}</button>
            </div>
          </div>
        </div>
      )}

      {prevCh === 'push' && (
        <div className="tpl-push-wrap">
          <div className="tpl-push-device">
            <div className="tpl-push-bg">
              <div className="tpl-push-clock"><div className="tpl-push-time">10:24</div><div className="tpl-push-date">Tuesday, 5 May · Milano</div></div>
              <div className="tpl-push-notif">
                <div className="tpl-pn-row1"><div className="tpl-pn-app-ico">MI</div><div className="tpl-pn-app-name">Mi Italia</div><div className="tpl-pn-time">now</div></div>
                <div className="tpl-pn-title">{pv.pushTitle}</div>
                <div className="tpl-pn-body">{pv.pushBody}</div>
                <div className="tpl-pn-actions"><div className="tpl-pn-btn">{t('eng.tpl.dismiss', 'Dismiss')}</div><div className="tpl-pn-btn primary">{t('eng.tpl.view_collection_arrow', 'View Collection →')}</div></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── TAB: Variables ──
  const VariablesTab = () => (
    <div>
      <div className="alert alert-info">
        <span className="material-symbols-outlined">data_object</span>
        <div>{t('eng.tpl.variables_hint', 'Variables are pulled automatically from your Mi Italia data at send time. If a value is missing for a contact, the fallback is used instead.')}</div>
      </div>
      {Object.entries(TPL_VARIABLES).map(([cat, vars]) => (
        <div key={cat}>
          <div className="cdp-sec-title">{t(`eng.tpl.varcat_${cat}`, { defaultValue: `${cat.charAt(0).toUpperCase() + cat.slice(1)} Variables` })}</div>
          <div className="tpl-var-grid">
            {vars.map(v => (
              <div key={v.token} className={`tpl-var-card ${cat}`}>
                <div className="tpl-var-token">{v.token}</div>
                <div className="tpl-var-desc">{v.desc}</div>
                <div className={`tpl-var-fb${v.fbOk ? ' tpl-var-fb-ok' : ''}`}><span className="material-symbols-outlined">{v.fbOk ? 'check_circle' : 'warning'}</span>{v.fb}</div>
                <div className="tpl-var-ex"><span className="material-symbols-outlined">check_circle</span>{v.ex}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  // ── TAB: Performance ──
  const PerformanceTab = () => (
    <div>
      <div className="cdp-sec-title">{t('eng.tpl.perf_title', { name: tpl.plainName, defaultValue: 'Campaign Performance — {{name}} Template' })}</div>
      {tpl.perf.length > 0 ? (
        <div className="tpl-perf-card">
          <div className="tpl-perf-hdr">
            <div className="tpl-perf-hdr-txt">{t('eng.tpl.perf_count', { count: tpl.perf.length, defaultValue: '{{count}} campaigns using this template · Sorted by date' })}</div>
          </div>
          {tpl.perf.map((p, i) => (
            <div key={i} className="tpl-perf-row">
              <div className="tpl-perf-date">{p.date}</div>
              <div className="tpl-perf-camp">
                <div className="tpl-perf-camp-name">{p.name}</div>
                <div className="tpl-perf-camp-meta">{p.meta}</div>
                <div className="tpl-perf-bar-wrap"><div className="tpl-perf-bar" style={{width:`${p.barPct}%`}} /></div>
              </div>
              <div className="tpl-perf-stats">
                <div className="tpl-perf-stat"><div className="tpl-perf-stat-v">{p.open}</div><div className="tpl-perf-stat-l">{t('eng.an.col_open_short', 'Open')}</div></div>
                <div className="tpl-perf-stat"><div className="tpl-perf-stat-v">{p.click}</div><div className="tpl-perf-stat-l">{t('eng.an.col_click', 'Click')}</div></div>
                <div className="tpl-perf-stat"><div className="tpl-perf-stat-v eng-green">{p.revenue}</div><div className="tpl-perf-stat-l">{t('eng.an.col_revenue', 'Revenue')}</div></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="eng-loading">{t('eng.tpl.no_perf_data', 'No performance data yet — this template has not been used in a campaign.')}</div>
      )}

      {tpl.bestSubjects.length > 0 && (
        <div className="card card-flush">
          <div className="card-hdr"><div className="card-title">{t('eng.tpl.best_subjects', 'Best Subject Lines')} <em>{t('eng.tpl.best_subjects_em', 'for this Template')}</em></div></div>
          {tpl.bestSubjects.map((s, i) => (
            <div key={i} className="tpl-subject-row">
              <div className={`tpl-subject-pct${s.top ? ' eng-green' : ''}`}>{s.pct}</div>
              <div><div className="tpl-subject-name">{s.name}</div><div className="tpl-subject-meta">{s.meta}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── TAB: Languages ──
  const LanguagesTab = () => (
    <div>
      <div className="alert alert-info">
        <span className="material-symbols-outlined">translate</span>
        <div dangerouslySetInnerHTML={{ __html: t('eng.tpl.langs_hint', 'Mi Italia supports 8 languages. When you send a campaign, each contact receives it in <strong>their preferred language</strong> automatically. You write once — Mi Italia handles translation.') }} />
      </div>
      <div className="cdp-sec-title">{t('eng.tpl.available_langs_title', { name: tpl.plainName, defaultValue: 'Available Language Versions — {{name}} Template' })}</div>
      <div className="tpl-lang-grid">
        {getTplLanguages(t).map(l => (
          <div key={l.code} className={`tpl-lang-card${l.sel ? ' sel' : ''}${!l.ready ? ' unavail' : ''}`}>
            <div className="tpl-lang-flag">{l.flag}</div>
            <div className="tpl-lang-name">{l.name}</div>
            <div className={`tpl-lang-status${l.ready ? ' ready' : ' unavail'}`}>
              {l.ready ? `✓ ${l.status}` : l.status}
            </div>
          </div>
        ))}
      </div>

      {tpl.langContent && (
        <div className="card card-flush">
          <div className="card-hdr"><div className="card-title">{langDisplayName('it', t)} <em>{t('eng.tpl.version', 'Version')}</em></div><button className="btn btn-outline btn-sm">{t('eng.tpl.edit_content', 'Edit content')}</button></div>
          <div className="tpl-lang-content">
            <div className="tpl-lang-subj">{t('eng.tpl.oggetto', 'Oggetto:')} {tpl.langContent.subject}</div>
            <div className="tpl-lang-prev">{t('eng.tpl.anteprima', 'Anteprima:')} {tpl.langContent.preview}</div>
            <div>{tpl.langContent.body?.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</div>
          </div>
        </div>
      )}

      <div className="alert alert-warn">
        <span className="material-symbols-outlined">translate</span>
        <div>{t('eng.tpl.langs_not_available', 'Arabic, Mandarin, and Japanese versions are not yet available for this template. Contacts with these preferences will receive the English version.')}</div>
      </div>
      <button className="btn btn-outline btn-sm" disabled={langRequesting} onClick={handleRequestTranslation}>
        <span className="material-symbols-outlined">add</span>{langRequesting ? t('eng.tpl.requesting', 'Requesting…') : t('eng.tpl.request_translation_btn', 'Request Arabic / Mandarin / Japanese translation')}
      </button>
      {langNote && <div className="alert alert-warn" style={{ marginTop:10 }}>{langNote}</div>}
    </div>
  )

  // ── TAB: Versions ──
  const VersionsTab = () => (
    <div>
      <div className="cdp-sec-title">{t('eng.tpl.version_history_title', { name: tpl.plainName, defaultValue: 'Version History — {{name}} Template' })}</div>
      <div className="alert alert-info">
        <span className="material-symbols-outlined">history</span>
        <div>{t('eng.tpl.version_hint', 'When Mi Italia updates a template, a new version is created. Your campaigns always use the version active at send time. You can view past versions but cannot revert.')}</div>
      </div>
      {(tpl.versions || []).map((v, i) => (
        <div key={i} className="tpl-ver-row">
          <div>
            <div className="tpl-ver-name">{v.ver} <span className={`tpl-ver-badge ${v.badge}`}>{v.badge === 'current' ? t('eng.tpl.current', 'Current') : t('eng.tpl.archived', 'Archived')}</span></div>
            <div className="tpl-ver-meta">{v.desc}</div>
          </div>
          <button className="btn btn-outline btn-xs">{t('eng.tpl.view', 'View')}</button>
        </div>
      ))}
      {(!tpl.versions || tpl.versions.length === 0) && (
        <div className="eng-loading">{t('eng.tpl.no_version_history', 'No version history — this template is still in draft.')}</div>
      )}

      <div className="eng-card-footer">
        <div className="cdp-sec-title">{t('eng.tpl.request_change', 'Request a Change')}</div>
        <div className="card card-flush">
          <div className="tpl-perf-hdr-txt">{t('eng.tpl.request_custom_hint', "Need something this template can't do? Submit a change request to Mi Italia.")}</div>
          <div className="form-group"><label className="form-lbl">{t('eng.tpl.what_change', 'What would you like to change?')}</label><textarea className="form-textarea" placeholder={t('eng.tpl.what_change_placeholder', "e.g. I'd like to add a second CTA button…")} /></div>
          <button className="btn btn-outline btn-sm"><span className="material-symbols-outlined">send</span>{t('eng.tpl.submit_change_request', 'Submit Change Request')}</button>
        </div>
      </div>
    </div>
  )

  // ── MODALS ──
  const UseTemplateModal = () => (
    <div className="modal-backdrop" onClick={() => setShowUseModal(false)}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('eng.tpl.use_template_title', 'Use')} <em>{tpl.plainName}</em> {t('eng.tpl.use_template_title_em', 'Template')}</div>
          <div className="modal-close" onClick={() => setShowUseModal(false)}><span className="material-symbols-outlined">close</span></div>
        </div>
        <div className="form-row2">
          <div className="form-group"><label className="form-lbl">{t('eng.camp.name_label', 'Campaign Name')}</label><input className="form-input" placeholder="e.g. Spring 2026 — New Arrivals" /></div>
          <div className="form-group"><label className="form-lbl">{t('eng.camp.channel', 'Channel')}</label><div className="select-wrap"><select className="form-select"><option>📧 {t('eng.tpl.reachable_email', { count: 612, defaultValue: 'Email ({{count}} reachable)' })}</option><option>💬 {t('eng.tpl.reachable_wa', { count: 389, defaultValue: 'WhatsApp ({{count}} reachable)' })}</option><option>🔔 {t('eng.tpl.reachable_push', { count: 501, defaultValue: 'Push ({{count}} reachable)' })}</option></select><span className="material-symbols-outlined select-arrow">expand_more</span></div></div>
        </div>
        <div className="form-group"><label className="form-lbl">{t('eng.ct.language', 'Language')}</label><div className="select-wrap"><select className="form-select"><option>{t('eng.tpl.lang_primary', { lang: langDisplayName('it', t), defaultValue: '{{lang}} (primary)' })}</option><option>{langDisplayName('en', t)}</option><option>{langDisplayName('fr', t)}</option><option>{langDisplayName('de', t)}</option><option>{langDisplayName('es', t)}</option><option>{t('eng.tpl.lang_auto_detect', 'All languages — auto-detect per contact')}</option></select><span className="material-symbols-outlined select-arrow">expand_more</span></div></div>
        <div className="alert alert-info"><span className="material-symbols-outlined">arrow_forward</span><div dangerouslySetInnerHTML={{ __html: t('eng.tpl.use_modal_hint', 'Clicking "Continue to Builder" opens the Campaign Builder — pick this template from the template picker in Step 3.') }} /></div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => setShowUseModal(false)}>{t('common.cancel', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={() => { setShowUseModal(false); onNavigateToBuilder && onNavigateToBuilder() }}><span className="material-symbols-outlined">arrow_forward</span>{t('eng.tpl.continue_to_builder', 'Continue to Builder')}</button>
        </div>
      </div>
    </div>
  )

  const RequestModal = () => (
    <div className="modal-backdrop" onClick={() => setShowRequestModal(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('eng.tpl.request_title', 'Request a')} <em>{t('eng.tpl.request_title_em', 'Custom Template')}</em></div>
          <div className="modal-close" onClick={() => setShowRequestModal(false)}><span className="material-symbols-outlined">close</span></div>
        </div>
        <div className="alert alert-info"><span className="material-symbols-outlined">info</span><div dangerouslySetInnerHTML={{ __html: t('eng.tpl.request_timeline_hint', 'Mi Italia will build, translate, and submit your custom template. Timeline: <strong>3–5 business days</strong> for Email/Push · <strong>5–10 days</strong> for WhatsApp (Meta review).') }} /></div>
        <div className="form-group"><label className="form-lbl">{t('eng.tpl.template_name', 'Template Name')}</label><input className="form-input" placeholder="e.g. Post-Purchase Thank You" /></div>
        <div className="form-row2">
          <div className="form-group"><label className="form-lbl">{t('eng.tpl.channels_needed', 'Channels Needed')}</label><div className="select-wrap"><select className="form-select"><option>{t('eng.tpl.email_only', 'Email only')}</option><option>{t('eng.tpl.wa_only', 'WhatsApp only')}</option><option>{t('eng.tpl.push_only', 'Push only')}</option><option>{t('eng.tpl.all_three', 'All three')}</option><option>{t('eng.tpl.email_wa', 'Email + WhatsApp')}</option></select><span className="material-symbols-outlined select-arrow">expand_more</span></div></div>
          <div className="form-group"><label className="form-lbl">{t('eng.tpl.category', 'Category')}</label><div className="select-wrap"><select className="form-select"><option>{t('eng.tpl.cat_customer_engagement', 'Customer engagement')}</option><option>{t('eng.tpl.cat_product_announcement', 'Product announcement')}</option><option>{t('eng.tpl.cat_transactional', 'Transactional')}</option><option>{t('eng.tpl.cat_reengagement', 'Re-engagement')}</option><option>{t('eng.tpl.cat_seasonal_event', 'Seasonal / event')}</option></select><span className="material-symbols-outlined select-arrow">expand_more</span></div></div>
        </div>
        <div className="form-group"><label className="form-lbl">{t('eng.tpl.describe_need', 'Describe what you need')}</label><textarea className="form-textarea" rows={4} placeholder="Purpose, audience, sections, specific requirements…" /></div>
        <div className="form-group"><label className="form-lbl">{t('eng.tpl.reference_examples', 'Reference examples?')}</label><input className="form-input" placeholder="Paste a URL or describe a campaign that inspired this" /></div>
        <div className="form-row2">
          <div className="form-group"><label className="form-lbl">{t('eng.tpl.priority', 'Priority')}</label><div className="select-wrap"><select className="form-select"><option>{t('eng.tpl.priority_standard', 'Standard (3–5 days)')}</option><option>{t('eng.tpl.priority_urgent', 'Urgent (+50% fee — 1–2 days)')}</option></select><span className="material-symbols-outlined select-arrow">expand_more</span></div></div>
          <div className="form-group"><label className="form-lbl">{t('eng.tpl.target_send_date', 'Target Send Date')}</label><input className="form-input" type="date" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => setShowRequestModal(false)}>{t('common.cancel', 'Cancel')}</button>
          <button className="btn btn-primary"><span className="material-symbols-outlined">send</span>{t('eng.tpl.submit_template_request', 'Submit Template Request')}</button>
        </div>
      </div>
    </div>
  )

  // ── MAIN RENDER ──
  return (
    <>
    <RealTemplatesPanel />
    <div className="tpl-wrap">
      {/* ── LIBRARY PANEL ── */}
      <div className="tpl-library">
        <div className="tpl-lib-hdr">
          <div className="tpl-lib-title">{t('eng.tpl.lib_title', 'Campaign')} <em>{t('eng.tpl.lib_title_em', 'Templates')}</em></div>
          <div className="tpl-lib-count">{t('eng.tpl.lib_count', { count: Object.keys(TEMPLATES).length, pending: 2, defaultValue: '{{count}} templates available · {{pending}} pending approval' })}</div>
        </div>

        <div className="tpl-lib-search">
          <span className="material-symbols-outlined">search</span>
          <input placeholder={t('eng.tpl.search_templates', 'Search templates…')} value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>

        <div className="tpl-filters">
          <div className="tpl-filter-row">
            <div className="tpl-chip on">{t('eng.camp.ch_all', 'All')}</div>
            <div className="tpl-chip email-on">📧 {t('eng.channels.email', 'Email')}</div>
            <div className="tpl-chip wa-on">💬 {t('eng.channels.wa', 'WhatsApp')}</div>
            <div className="tpl-chip push-on">🔔 {t('eng.tpl.push', 'Push')}</div>
          </div>
          <div className="tpl-filter-row">
            <div className="tpl-chip off">✓ {t('eng.tpl.approved', 'Approved')}</div>
            <div className="tpl-chip off">⏳ {t('common.pending', 'Pending')}</div>
            <div className="tpl-chip off">{t('eng.tpl.used_before', 'Used before')}</div>
            <div className="tpl-chip off">{t('eng.tpl.cat_seasonal', 'Seasonal')}</div>
          </div>
        </div>

        <div className="tpl-lib-list">
          {getTplKeysByCat(t).map(cat => {
            const visibleKeys = cat.keys.filter(k => {
              if (!searchQ.trim()) return true
              const tpl = TEMPLATES[k]
              return tpl.plainName.toLowerCase().includes(searchQ.toLowerCase())
            })
            if (visibleKeys.length === 0) return null
            return (
              <div key={cat.label}>
                <div className="tpl-sec-label">{cat.label}</div>
                {visibleKeys.map(k => {
                  const tpl = TEMPLATES[k]
                  return (
                    <div key={k} className={`tpl-row${selId === k ? ' sel' : ''}`} onClick={() => selectTemplate(k)}>
                      <div className="tpl-row-thumb" style={{background:tpl.grad}}>
                        {tpl.emoji}
                        <div className={`tpl-row-status ${tpl.status === 'review' ? 'review' : tpl.status}`}>
                          {tpl.status === 'approved' ? '✓' : tpl.status === 'pending' ? '!' : '↻'}
                        </div>
                      </div>
                      <div className="tpl-row-body">
                        <div className="tpl-row-name">{tpl.plainName}</div>
                        <div className="tpl-row-meta">
                          {tpl.channels.map(ch => <span key={ch} className="tpl-row-meta"><span className={`tpl-ch-dot ${ch}`} />{ch === 'email' ? t('eng.channels.email', 'Email') : ch === 'wa' ? t('eng.channels.wa', 'WhatsApp') : t('eng.tpl.push', 'Push')}</span>)}
                          {tpl.status === 'pending' && <span className="tpl-review-txt">{t('eng.tpl.review_required', 'Review required')}</span>}
                          {tpl.status === 'review' && <span className="tpl-in-review-txt">{t('eng.tpl.in_review', 'In Mi Italia review')}</span>}
                        </div>
                      </div>
                      <div className="tpl-row-perf">
                        <div className="tpl-row-perf-val">{tpl.stats[1]}</div>
                        <div className="tpl-row-perf-lbl">{tpl.statSub[1]?.replace(/Avg |· Email| · WhatsApp| · Push/g, '') || t('eng.tpl.no_data', 'no data')}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

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
          {/* Header */}
          <div className="tpl-det-hdr">
            <div className="tpl-det-top">
              <div className="tpl-det-thumb" style={{background:tpl.grad}}>{tpl.emoji}</div>
              <div className="tpl-det-title-block">
                <div className="tpl-det-name">{tpl.name}</div>
                <div className="tpl-det-desc">{tpl.desc}</div>
                <div className="tpl-det-tags">
                  <StatusBadge status={tpl.status} text={tpl.statusText} />
                  {tpl.channels.map(ch => <ChannelTag key={ch} ch={ch} />)}
                  <div className="tpl-det-tag ver">{tpl.version}</div>
                </div>
              </div>
              <div className="tpl-det-actions">
                <button className="btn btn-outline btn-sm"><span className="material-symbols-outlined">history</span>{t('eng.tpl.versions', 'Versions')}</button>
                <button className="btn btn-primary" onClick={() => setShowUseModal(true)}><span className="material-symbols-outlined">edit</span>{t('eng.tpl.use_template', 'Use Template')}</button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="tpl-stats">
            {tpl.stats.map((v, i) => (
              <div key={i} className="tpl-stat">
                <div className="tpl-stat-val">{v}</div>
                <div className="tpl-stat-lbl">{getTplStatLabels(t)[i]}</div>
                <div className="tpl-stat-sub">{tpl.statSub[i]}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="tpl-tabs">
            {TABS.map(tab => (
              <div key={tab.key} className={`tpl-tab${activeTab === tab.key ? ' act' : ''}`} onClick={() => setActiveTab(tab.key)}>
                {tab.label}
              </div>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'structure'   && <StructureTab />}
          {activeTab === 'preview'     && <PreviewTab />}
          {activeTab === 'variables'   && <VariablesTab />}
          {activeTab === 'performance' && <PerformanceTab />}
          {activeTab === 'languages'   && <LanguagesTab />}
          {activeTab === 'versions'    && <VersionsTab />}
        </div>
      </div>

      {/* Modals */}
      {showUseModal && <UseTemplateModal />}
      {showRequestModal && <RequestModal />}
    </div>
    </>
  )
}

// ── REAL TEMPLATES (separate from the mock catalog above) ──
function RealTemplatesPanel() {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,     setDeleting]     = useState(false)

  const refetch = () => {
    setLoading(true)
    templateApi.list()
      .then(res => { if (res?.success) setTemplates(res.data?.templates ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { refetch() }, [])

  const openEdit = async (tpl) => {
    const res = await templateApi.get(tpl.id).catch(() => null)
    setEditing(res?.success ? res.data?.template : tpl)
    setShowForm(true)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setDeleting(true)
    templateApi.delete(deleteTarget.id)
      .then(res => { if (res?.success) { setDeleteTarget(null); refetch() } })
      .catch(() => {})
      .finally(() => setDeleting(false))
  }

  return (
    <div className="card eng-mb18">
      <div className="card-hdr">
        <div className="card-title">{t('eng.tpl.real_title', 'Your')} <em>{t('eng.tpl.real_title_em', 'Templates')}</em></div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowForm(true) }}>
          <span className="material-symbols-outlined">add</span>{t('eng.tpl.create_real', 'Create Template')}
        </button>
      </div>
      {loading ? (
        <div className="eng-loading">{t('eng.tpl.loading_real', 'Loading templates…')}</div>
      ) : templates.length === 0 ? (
        <div className="eng-loading">{t('eng.tpl.no_real_templates', 'No templates yet.')}</div>
      ) : (
        templates.map(tpl => (
          <div key={tpl.id} className="rc-item">
            <div className="rc-icon email"><span className="material-symbols-outlined">description</span></div>
            <div className="rc-body">
              <div className="rc-name">{templateDisplayName(tpl.template_key, t)}</div>
              <div className="rc-meta">
                <span className="rc-meta-txt">{langDisplayName(tpl.primary_language, t)}</span>
                {tpl.translations_pending && <span className="rc-meta-txt">{t('eng.tpl.translations_pending', 'Translations pending')}</span>}
              </div>
            </div>
            <button className="btn btn-outline btn-xs" onClick={() => openEdit(tpl)}>{t('common.edit', 'Edit')}</button>
            <button className="btn btn-outline btn-xs btn-red" onClick={() => setDeleteTarget(tpl)}>{t('common.delete', 'Delete')}</button>
          </div>
        ))
      )}
      {showForm && (
        <RealTemplateFormModal
          template={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch() }}
        />
      )}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('eng.tpl.delete_title', 'Delete')} <em>{t('eng.tpl.delete_title_em', 'Template')}</em></div>
              <div className="modal-close" onClick={() => !deleting && setDeleteTarget(null)}><span className="material-symbols-outlined">close</span></div>
            </div>
            <div>{t('eng.tpl.confirm_delete', { name: templateDisplayName(deleteTarget.template_key, t), defaultValue: 'Delete "{{name}}"? This cannot be undone.' })}</div>
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

function RealTemplateFormModal({ template, onClose, onSaved }) {
  const { t } = useTranslation()
  const isEdit = !!template?.id
  const primaryContent = template?.content?.[template?.primary_language] ?? {}
  const [templateKey, setTemplateKey] = useState(template?.template_key ?? '')
  const [primaryLang, setPrimaryLang] = useState(template?.primary_language ?? 'it')
  const [subject,     setSubject]     = useState(primaryContent.subject ?? '')
  const [text,        setText]        = useState(primaryContent.text ?? '')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const handleSave = async () => {
    if (!isEdit && !templateKey.trim()) { setError(t('eng.tpl.err_key_required', 'Template key is required.')); return }
    if (!subject.trim() || !text.trim()) { setError(t('eng.tpl.err_content_required', 'Subject and body are required.')); return }
    setSaving(true); setError('')
    const content = { subject: subject.trim(), html: `<p>${text.trim()}</p>`, text: text.trim() }
    try {
      const res = isEdit
        ? await templateApi.update(template.id, { content })
        : await templateApi.create({ templateKey: templateKey.trim(), primaryLanguage: primaryLang, content })
      if (res?.success) onSaved()
      else setError(res?.message || t('eng.tpl.err_save', 'Failed to save template.'))
    } catch { setError(t('eng.tpl.err_network', 'Network error.')) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={() => !saving && onClose()}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{isEdit ? t('eng.tpl.edit_real_title', 'Edit') : t('eng.tpl.create_real_title', 'Create')} <em>{t('eng.tpl.form_title_em', 'Template')}</em></div>
          <div className="modal-close" onClick={() => !saving && onClose()}><span className="material-symbols-outlined">close</span></div>
        </div>
        {error && <div className="eng-error">{error}</div>}
        {!isEdit ? (
          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">{t('eng.tpl.template_key', 'Template key')}</label>
              <input className="form-input" placeholder="aw25_new_arrivals" value={templateKey} onChange={e => setTemplateKey(e.target.value)} />
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
        ) : (
          <div className="form-hint eng-mb18">{t('eng.tpl.editing_primary_hint', { lang: langDisplayName(template.primary_language, t), defaultValue: 'Editing the {{lang}} (primary) content. Saving invalidates existing translations — re-translate afterward.' })}</div>
        )}
        <div className="form-group">
          <label className="form-lbl">{t('eng.rev.subject', 'SUBJECT')}</label>
          <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-lbl">{t('eng.rev.body', 'BODY')}</label>
          <textarea className="form-textarea ct-notes-textarea" value={text} onChange={e => setText(e.target.value)} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>{t('common.cancel', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('eng.set.saving', 'Saving…') : t('common.save', 'Save')}</button>
        </div>
      </div>
    </div>
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
    { key:'analytics',   icon:'monitoring', label:t('eng.nav.analytics', 'Analytics'), tag:t('eng.nav.new_tag', 'NEW') },
    { key:'settings',    icon:'settings',   label:t('eng.nav.settings', 'Settings') },
  ]

  return (
    <>
      <div className="crm-subnav">
        {VIEWS.map(v => (
          <div key={v.key} className={`sni${activeView === v.key ? ' act' : ''}`} onClick={() => {
            if (v.key === 'campaigns') setCampaignsStart('hub')
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
            onNewCampaign={() => { setCampaignsStart('builder'); setActiveView('campaigns') }}
            onViewAllCampaigns={() => { setCampaignsStart('hub'); setActiveView('campaigns') }}
            onManageContacts={() => setActiveView('contacts')}
            onManageAutomations={() => setActiveView('automations')}
          />
        )}
        {activeView === 'contacts'    && <ContactsView />}
        {activeView === 'favorites'   && <FavoritesView />}
        {activeView === 'campaigns'   && <CampaignsView  campaigns={campaigns} segments={segments} dashboard={dashboard} refetchCampaigns={refetchCampaigns} campaignsLoading={campaignsLoading} emailSettings={emailSettings} initialSub={campaignsStart} key={campaignsStart} />}
        {activeView === 'templates'   && <TemplatesView emailSettings={emailSettings} onNavigateToBuilder={() => { setCampaignsStart('builder'); setActiveView('campaigns') }} />}
        {activeView === 'automations' && <AutomationsView />}
        {activeView === 'analytics'   && <AnalyticsView />}
        {activeView === 'settings'    && <SenderSettingsView emailSettings={emailSettings} refetchEmailSettings={refetchEmailSettings} />}
      </div>
    </>
  )
}
