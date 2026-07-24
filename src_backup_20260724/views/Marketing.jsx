import { useState, useEffect } from 'react'
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
}
const SEG_AVATAR = {
  vip:    { bg:'rgba(184,149,90,0.12)', color:'var(--gold-dk)' },
  loyal:  { bg:'rgba(99,91,255,0.1)',   color:'var(--stripe)'   },
  new:    { bg:'rgba(0,108,53,0.08)',   color:'var(--green)'    },
  warm:   { bg:'rgba(217,119,6,0.1)',   color:'#B45309'         },
  lapsed: { bg:'rgba(197,0,26,0.07)',   color:'var(--red)'      },
}
const SOURCE_LABEL = {
  walkin:'In-store', csv:'CSV Import', mi_italia:'Mi Italia', online:'Online',
}

function timeAgo(iso) {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0)    return 'Today'
  if (days === 1)   return 'Yesterday'
  if (days < 7)     return `${days} days ago`
  if (days < 30)    return `${Math.floor(days/7)} week${Math.floor(days/7) === 1 ? '' : 's'} ago`
  if (days < 365)   return `${Math.floor(days/30)} month${Math.floor(days/30) === 1 ? '' : 's'} ago`
  return `${Math.floor(days/365)} year${Math.floor(days/365) === 1 ? '' : 's'} ago`
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

const ROI_CAMPAIGNS = [
  { id:'spring-new',      ch:'email', name:'Spring Collection — New Arrivals',     date:'3 May',     sent:'416', open:'82%',     click:'31%', visits:22, rev:'€1,840', cost:'€0',     roi:'∞',         pos:true  },
  { id:'brera-vips',      ch:'wa',    name:'Brera shop visit — returning VIPs',    date:'22 Mar',    sent:'86',  open:'81%',     click:'40%', visits:11, rev:'€1,860', cost:'€8.60',  roi:'+21,535%',  pos:true  },
  { id:'vip-capsule',     ch:'wa',    name:'VIP Early Access — Capsule Drop',      date:'14 Apr',    sent:'48',  open:'94%',     click:'42%', visits:9,  rev:'€1,120', cost:'€4.80',  roi:'+23,233%',  pos:true  },
  { id:'ss26-bordeaux',   ch:'email', name:'SS26 · Bordeaux silk drop',            date:'9 Apr',     sent:'352', open:'71%',     click:'19%', visits:7,  rev:'€420',   cost:'€0',     roi:'∞',         pos:true  },
  { id:'res-reminder',    ch:'wa',    name:'Reservation expiring · 24h reminder',  date:'Recurring', sent:'52',  open:'96%',     click:'68%', visits:14, rev:'€680',   cost:'€5.20',  roi:'+12,977%',  pos:true  },
  { id:'winback',         ch:'email', name:'Win Back — 60-Day Lapsed Customers',   date:'28 Apr',    sent:'186', open:'42%',     click:'8%',  visits:2,  rev:'€180',   cost:'€0',     roi:'∞',         pos:true  },
  { id:'spring-lookbook', ch:'print', name:'Spring lookbook · in-store insert',    date:'12 Apr',    sent:'68',  open:'QR · 15%',click:'15%', visits:10, rev:'€450',   cost:'€12.24', roi:'+3,576%',   pos:true  },
  { id:'ramadan',         ch:'wa',    name:'Ramadan Gifting — Curated Selection',  date:'19 Mar',    sent:'112', open:'68%',     click:'12%', visits:1,  rev:'€0',     cost:'€11.20', roi:'−100%',     pos:false },
]




function mapCustomer(c) {
  const name = (c.name || '').trim() || 'Unnamed'
  const code = c.language?.code
  const langInfo = code ? (LANG_MAP[code] || { flag:code.toUpperCase(), name:code }) : null
  const src = c.language?.source
  const langSrc =
    src === 'user_set' ? 'User-set' :
    src === 'detected' ? 'Detected' :
    src === 'unknown' || !src ? 'Fallback · EN' :
    src
  const av = SEG_AVATAR[c.segment] || SEG_AVATAR.new
  const cn = c.consent || {}
  const yn = (b) => b ? 'yes' : 'no'
  const spend = Number(c.total_spend || 0)
  return {
    id:           c.id,
    name,
    init:         name.charAt(0).toUpperCase() || '?',
    initBg:       av.bg,
    initColor:    av.color,
    seg:          c.segment || 'new',
    lang:         langInfo ? langInfo.flag : '?',
    langName:     langInfo ? langInfo.name : 'Unknown',
    langSrc,
    purchases:    c.purchase_count || 0,
    favorites:    c.favorite_count || 0,
    interactions: `${c.purchase_count || 0} purchases · ${c.favorite_count || 0} favorites`,
    ltv:          spend > 0 ? `€${spend.toLocaleString()}` : '—',
    email:        yn(cn.email),
    wa:           yn(cn.whatsapp),
    print:        yn(cn.print),
    src:          SOURCE_LABEL[c.source] || c.source || 'Unknown',
    last:         timeAgo(c.last_visit_at || c.created_at),
  }
}


const campaignApi = {
  list:   ()         => apiFetch(`${API}/boutique/marketing/campaigns?page=1&limit=20`).then(r => r.json()),
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

// Convert "aw25_new_arrivals" → "AW25 New Arrivals"
const templateDisplayName = (key) => {
  if (!key) return 'Untitled template'
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

const SEG_LABELS = { vip:'VIP', loyal:'Loyal', new:'New', warm:'Warm', lapsed:'Lapsed', all:'All contacts' }

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}
const hashStr = (s) => {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) h = ((h << 5) - h) + s.charCodeAt(i)
  return Math.abs(h)
}

const mockCampaignStats = (id, channel) => {
  const h = hashStr(id || '')
  const openRate  = 35  + (h % 45)             // 35–79
  const clickRate = 5   + ((h >> 3) % 25)      // 5–29
  const purchases = 1   + ((h >> 6) % 12)      // 1–12
  const revenue   = 200 + ((h >> 9) % 2500)    // 200–2699

  if (channel === 'wa') return [
    { val:`${openRate}%`,                lbl:'read'      },
    { val:`${clickRate}%`,               lbl:'replied'   },
    { val:`${purchases}`,                lbl:'purchases' },
    { val:`€${revenue.toLocaleString()}`, lbl:'revenue'  },
  ]
  if (channel === 'print') return [
    { val:`${purchases * 8}`,            lbl:'qr scans'  },
    { val:`${clickRate}%`,               lbl:'scan rate' },
    { val:`${purchases}`,                lbl:'purchases' },
    { val:`€${revenue.toLocaleString()}`, lbl:'revenue'  },
  ]
  return [
    { val:`${openRate}%`,                lbl:'opened'    },
    { val:`${clickRate}%`,               lbl:'clicked'   },
    { val:`${purchases}`,                lbl:'purchases' },
    { val:`€${revenue.toLocaleString()}`, lbl:'revenue'  },
  ]
}


function mapApiCampaignCard(c) {
  const ch     = channelKey(c.channel)
  const status = c.status
  const statusLabel = c.status === 'sent'      ? 'Sent'
           : c.status === 'draft'     ? 'Draft'
           : c.status === 'scheduled' ? 'Scheduled'
           : c.status === 'in_review' ? 'In Review'
           : c.status === 'recurring' ? 'Recurring'
           : c.status

  const date = c.sent_at      ? formatDate(c.sent_at)
             : c.scheduled_at ? `Scheduled ${formatDate(c.scheduled_at)}`
             : c.created_at   ? `Created ${formatDate(c.created_at)}`
             : null

  const seg = c.target_segment
  const segs = !seg ? []
             : seg === 'all' ? [{ key:'neutral', label:'All contacts' }]
             : [{ key: seg, label: SEG_LABELS[seg] || seg }]

  return {
    id:          c.id,
    ch,
    name:        c.campaign_name,
    status,
    statusLabel,
    date,
    segs,
    recipients:  0,
    extra:       null,
    langs:       [],
    stats: c.status === 'sent' ? mockCampaignStats(c.id, channelKey(c.channel)) : null,
    actions: status === 'draft'
      ? [{ label:'Edit', cls:'btn-outline', action:'edit' }, { label:'Submit', cls:'btn-primary', action:'submit' }]
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
  const map = {
    vip:    { cls:'seg-vip',    label:'★ VIP' },
    loyal:  { cls:'seg-loyal',  label:'♻ Loyal' },
    new:    { cls:'seg-new',    label:'✦ New' },
    warm:   { cls:'seg-warm',   label:'🔥 Warm' },
    lapsed: { cls:'seg-lapsed', label:'⏱ Lapsed' },
  }
  const s = map[seg] || { cls:'seg-new', label:seg }
  return <span className={`seg ${s.cls}`}>{s.label}</span>
}

function ChTag({ ch }) {
  const map = {
    email: ['ch-email', 'mail',         'Email'],
    wa:    ['ch-wa',    'chat',         'WhatsApp'],
    print: ['ch-print', 'description',  'Print'],
    insta: ['ch-insta', 'photo_camera', 'Instagram'],
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
  return (
    <div className={`eng-ch-item${soon ? ' eng-ch-soon' : ''}`}>
      <div className="eng-ch-header">
        <span className="eng-ch-label">
          <span className="material-symbols-outlined eng-ch-icon" style={{color:iconColor}}>{icon}</span>
          {label}
          {soon && <span className="eng-soon-tag">SOON</span>}
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
  const segsArr = Array.isArray(segments) ? segments : []
  const total   = segsArr.reduce((s, sg) => s + (sg.customers ?? 0), 0)
  const emailR  = dashboard?.email_reach  ?? '—'
  const waR     = dashboard?.wa_reach     ?? '—'
  const printR  = dashboard?.print_reach  ?? '—'
  const revenue = dashboard?.revenue ?? '—'

  const liveActivity = [
    { dot:'var(--green)',  text:'Sofia M.',  action:'made a purchase',                    sub:'Silk Blouse',            meta:'2 minutes ago · Added to VIP segment',  tags:[] },
    { dot:'var(--gold)',   text:'Chiara D.', action:'favorited',                          sub:'Cashmere Coat',           meta:'14 minutes ago · Warm segment',         tags:[] },
    { dot:'#1a9e4d',       text:'WhatsApp delivered to Marco R.', action:'',              sub:'Campaign reply received', meta:'1 hour ago · sent in Italian',          tags:[{label:'IT', type:'lang'}] },
    { dot:'var(--stripe)', text:'Luca F.',   action:'viewed 3 products from your boutique', sub:null,                   meta:'3 hours ago · Lapsed segment',          tags:[] },
    { dot:'var(--gold)',   text:'Spring Collection email opened by Claire D.', action:'', sub:null,                     meta:'5 hours ago · sent in French',          tags:[{label:'FR', type:'lang'}] },
    { dot:'var(--stone)',  text:'Alessia B.',action:'opted in to Email',                  sub:null,                     meta:'Yesterday · New segment',               tags:[{label:'language unknown · fallback EN', type:'info'}] },
  ]

  const autoRunning = [
    { icon:'bolt',     iconColor:'var(--gold)',  name:'Welcome — First Purchase', sent:'143 sent', status:'on' },
    { icon:'favorite', iconColor:'var(--gold)',  name:'Back in Stock Alerts',     sent:'67 sent',  status:'on' },
    { icon:'schedule', iconColor:'var(--stone)', name:'Lapsed Re-engagement Flow',sent:null,       status:'paused' },
  ]
  const mockCampaigns = [
    { campaign_name:'Spring Collection — New Arrivals', channel:'email', status:'sent', date:'24 Mar', seg:'Loyal + New', sent:612, langs:['IT','EN','FR'], extra:'+2',  open:'44%', clicked:'12%' },
    { campaign_name:'VIP Early Access — Capsule Drop',  channel:'wa',    status:'sent', date:'18 Mar', seg:'VIP',         sent:89,  langs:['IT','EN'],      extra:null, open:'78%', metric:'8',  metricLbl:'PURCHASES' },
    { campaign_name:'Brera shop visit — returning VIPs',channel:'wa',    status:'sent', date:'22 Mar', seg:'VIP',         sent:86,  langs:['IT'],           extra:null, open:'81%', metric:'11', metricLbl:'VISITS' },
  ]
  const campList = mockCampaigns
  return (
    <div>
      <div className="alert alert-gdpr mkt-gdpr-alert">
        <span className="material-symbols-outlined">gpp_good</span>
        <div><strong>GDPR Compliant.</strong> Mi Italia manages per-channel consent for every customer. You can only reach customers who have explicitly opted in for each channel. Consent records are stored and auditable.</div>
      </div>

      {/* KPI Row */}
      <div className="stat-row col5">
        <div className="stat-card">
          <div className="stat-lbl">Total Contacts</div>
          <div className="stat-val">{total || '—'}</div>
          <div className="stat-change up">↑ +34 this month</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-email">mail</span>Email Reach
          </div>
          <div className="stat-val">{emailR}</div>
          <div className="stat-sub">72% opted in · Avg open 44%</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-wa">chat</span>WhatsApp Reach
          </div>
          <div className="stat-val">{waR}</div>
          <div className="stat-sub">46% opted in · Avg read 78%</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-print">description</span>Printed insert
          </div>
          <div className="stat-val">{printR}</div>
          <div className="stat-sub">Addresses on file · 15% QR scan rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Revenue Attributed</div>
          <div className="stat-val">{revenue !== '—' ? `€${revenue}` : '—'}</div>
          <div className="stat-change up">↑ +12% this month</div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid2 mkt-row2">
        <div className="card card-flush">
          <div className="card-hdr">
            <div className="card-title">Channel <em>Performance</em></div>
            <select className="mkt-period-select">
              <option>Last 30 days</option><option>Last 90 days</option>
            </select>
          </div>
          <div className="eng-section-lbl">Open / Read Rate</div>
          <div className="eng-ch-row mkt-ch-block">
            <ChBar icon="mail"         iconColor="var(--gold-dk)" label="Email"          val="44%"      pct={44} barColor="var(--gold)"  />
            <ChBar icon="chat"         iconColor="#1a9e4d"        label="WhatsApp"       val="78%"      pct={78} barColor="var(--wa)"    />
            <ChBar icon="photo_camera" iconColor="#DD2A7B"        label="Instagram DM"   val="—"        pct={0}  barColor="transparent"  soon />
            <ChBar icon="description"  iconColor="var(--stone)"   label="Printed insert" val="QR · 15%" pct={15} barColor="var(--stone)" />
          </div>
          <div className="eng-section-lbl">Click-through / Reply Rate</div>
          <div className="eng-ch-row">
            <ChBar icon="mail"         iconColor="var(--gold-dk)" label="Email click"     val="12%" pct={12} barColor="var(--gold)"  />
            <ChBar icon="chat"         iconColor="#1a9e4d"        label="WhatsApp reply"  val="31%" pct={31} barColor="var(--wa)"    />
            <ChBar icon="photo_camera" iconColor="#DD2A7B"        label="Instagram reply" val="—"   pct={0}  barColor="transparent"  soon />
            <ChBar icon="description"  iconColor="var(--stone)"   label="Print QR scan"   val="15%" pct={15} barColor="var(--stone)" />
          </div>
        </div>

        <div className="card card-flush">
          <div className="card-hdr">
            <div className="card-title">Segment <em>Health</em></div>
            <button className="card-action" onClick={onManageContacts}>→ Manage</button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Segment</th><th>Contacts</th><th>Engaged</th><th>Languages</th><th>Last Campaign</th><th></th>
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
                        {s.key === 'lapsed' ? 'Re-engage' : 'Send'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {segsArr.length === 0 && (
                <tr><td colSpan={6} className="empty">No segments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3 */}
      <div className="grid2">
        <div className="card card-flush">
          <div className="card-hdr">
            <div className="card-title">Recent <em>Campaigns</em></div>
            <button className="card-action" onClick={onViewAllCampaigns}>→ All campaigns</button>
          </div>
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
                  {c.sent > 0 && <span className="rc-meta-txt">{c.sent} sent</span>}
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
                    <div className="rc-stat-lbl">{c.channel === 'wa' ? 'READ' : 'OPENED'}</div>
                  </div>
                  <div className="rc-stat">
                    <div className="rc-stat-val">{c.metric ?? c.clicked}</div>
                    <div className="rc-stat-lbl">{c.metricLbl ?? 'CLICKED'}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="overview-right-col">
          <div className="card card-flush">
            <div className="card-hdr">
              <div className="card-title">Live <em>Activity</em></div>
            </div>
            {liveActivity.map((a, i) => (
              <div key={i} className="live-act-item">
                <div className="live-act-dot" style={{background:a.dot}} />
                <div>
                  <div className="live-act-text">
                    <strong>{a.text}</strong>
                    {a.action && <span className="live-act-action"> {a.action}</span>}
                    {a.sub && <span className="live-act-sub"> — {a.sub}</span>}
                    {a.tags.map(t => (
                      t.type === 'lang'
                        ? <span key={t.label} className="rc-lang-tag rc-lang-en">{t.label}</span>
                        : <span key={t.label} className="live-act-tag-info">{t.label}</span>
                    ))}
                  </div>
                  <div className="live-act-meta">{a.meta}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card card-flush">
            <div className="card-hdr">
              <div className="card-title">Automations <em>Running</em></div>
              <span className="material-symbols-outlined auto-running-fwd" onClick={onManageAutomations} style={{ cursor:'pointer' }}>arrow_forward</span>
            </div>
            {autoRunning.map((a, i) => (
              <div key={i} className="auto-running-row">
                <span className="material-symbols-outlined auto-running-icon" style={{color:a.iconColor}}>{a.icon}</span>
                <span className="auto-running-name">{a.name}</span>
                {a.sent && <span className="auto-running-sent">{a.sent}</span>}
                <span className={`auto-running-badge ${a.status}`}>{a.status === 'on' ? 'On' : 'Paused'}</span>
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
  const [contacts,       setContacts]       = useState([])
  const [loadingList,    setLoadingList]    = useState(true)
  const [showImport,     setShowImport]     = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [showPanel,      setShowPanel]      = useState(false)
  const [panelContact,   setPanelContact]   = useState(null)
  const [panelDetail,    setPanelDetail]    = useState(null)
  const [panelLoading,   setPanelLoading]   = useState(false)

  // Fetch contact list on mount
  useEffect(() => {
    setLoadingList(true)
    apiFetch(`${API}/boutique/customers?page=1&limit=20`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setContacts((res.data?.customers ?? []).map(mapCustomer))
      })
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }, [])

  // Fetch full profile whenever the panel opens
  useEffect(() => {
    if (!showPanel || !panelContact?.id) { setPanelDetail(null); return }
    setPanelLoading(true)
    apiFetch(`${API}/boutique/customers/${panelContact.id}`)
      .then(r => r.json())
      .then(res => { if (res.success) setPanelDetail(res.data) })
      .catch(() => {})
      .finally(() => setPanelLoading(false))
  }, [showPanel, panelContact?.id])

  return (
    <div>
      <div className="ct-toolbar">
        <div className="ct-search">
          <span className="material-symbols-outlined">search</span>
          <input placeholder="Search by name…" />
        </div>
        <div className="ct-seg-filters">
          {[
            { key:'vip',    cls:'seg-vip',    label:'⭐ VIP',    count:89 },
            { key:'loyal',  cls:'seg-loyal',  label:'♻ Loyal',  count:214 },
            { key:'new',    cls:'seg-new',    label:'✦ New',    count:178 },
            { key:'warm',   cls:'seg-warm',   label:'🔥 Warm',  count:241 },
            { key:'lapsed', cls:'seg-lapsed', label:'⏱ Lapsed', count:125 },
          ].map(s => (
            <span key={s.key} className={`seg ${s.cls} ct-seg-btn`}>
              {s.label} ({s.count})
            </span>
          ))}
          <span className="ct-lang-btn">
            <span className="material-symbols-outlined ct-lang-icon">translate</span>
            Language
            <span className="material-symbols-outlined ct-lang-chevron">expand_more</span>
          </span>
        </div>
        <div className="ct-toolbar-right">
          <button className="btn btn-outline btn-sm" onClick={() => setShowImport(true)}>
            <span className="material-symbols-outlined">upload</span>Import CSV
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowAddContact(true)}>
            <span className="material-symbols-outlined">person_add</span>Add Contact
          </button>
        </div>
      </div>

      <div className="card ct-table-card">
        <table className="tbl">
          <thead>
            <tr>
              <th className="tbl-cb-col"><input type="checkbox" className="tbl-cb" /></th>
              <th>Contact</th><th>Segment</th><th>Language</th><th>Interactions</th><th>LTV</th><th>Consent</th><th>Source</th><th>Last Seen</th><th></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c, i) => (
              <tr key={i}>
                <td><input type="checkbox" className="tbl-cb" /></td>
                <td>
                  <div className="ct-contact-cell" onClick={() => { setPanelContact(c); setShowPanel(true) }} style={{cursor:'pointer'}}>
                    <div className="ct-av" style={{background:c.initBg, color:c.initColor}}>{c.init}</div>
                    <div>
                      <div className="ct-name">{c.name}</div>
                      <div className={`ct-consent-sub ${c.email === 'pend' ? 'pend' : 'ok'}`}>
                        {c.email === 'pend' ? 'Opt-in request pending' : '2 of 3 channels opted in'}
                      </div>
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
                  {c.email === 'pend'
                    ? <button className="btn btn-outline btn-xs" disabled>Pending</button>
                    : c.seg === 'lapsed'
                    ? <button className="btn btn-primary btn-xs">Re-engage</button>
                    : <button className="btn btn-outline btn-xs">Message</button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ct-table-footer">
          <span>Showing ${contacts.length} contacts</span>
          <div className="ct-footer-btns">
            <button className="btn btn-outline btn-xs" disabled>← Prev</button>
            <button className="btn btn-outline btn-xs">Next →</button>
          </div>
        </div>
      </div>
      {/* Import CSV Modal */}
      {showImport && (
        <div className="modal-backdrop" onClick={() => setShowImport(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">Import <em>Contacts</em></div>
              <div className="modal-close" onClick={() => setShowImport(false)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>
            <div className="ct-drop-zone">
              <span className="material-symbols-outlined ct-drop-icon">upload_file</span>
              <div className="ct-drop-title">Drop your CSV here or click to browse</div>
              <div className="ct-drop-sub">Required columns: First Name, Last Name, Email. Optional: Phone, Segment</div>
            </div>
            <div className="form-group">
              <label className="form-lbl">Assign imported contacts to segment</label>
              <div className="select-wrap">
                <select className="form-select">
                  <option>Auto-detect from CSV</option>
                  <option>✦ New</option>
                  <option>🔥 Warm</option>
                  <option>⭐ VIP</option>
                </select>
                <span className="material-symbols-outlined select-arrow">expand_more</span>
              </div>
            </div>
            <div className="ct-consent-toggle-row">
              <Toggle on={true} onToggle={() => {}} />
              <div>
                <div className="ct-consent-toggle-title">Send GDPR consent request to all imported contacts</div>
                <div className="ct-consent-toggle-sub">Contacts will receive an opt-in email before any marketing is sent</div>
              </div>
            </div>
            <div className="alert-gdpr-blue">
              <span className="material-symbols-outlined">verified_user</span>
              <div>Imported contacts are added in <strong>pending consent</strong> status. They cannot be messaged until they opt in. Duplicate emails are automatically merged with existing contacts.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowImport(false)}>Cancel</button>
              <button className="btn btn-primary">
                <span className="material-symbols-outlined">upload</span>Import & Send Consent Requests
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
              <div className="modal-title">Add <em>Contact</em></div>
              <div className="modal-close" onClick={() => setShowAddContact(false)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">First Name</label>
                <input className="form-input" placeholder="Sofia" />
              </div>
              <div className="form-group">
                <label className="form-lbl">Last Name</label>
                <input className="form-input" placeholder="Marchetti" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-lbl">Email Address</label>
              <input className="form-input" placeholder="sofia@example.com" type="email" />
            </div>
            <div className="form-group">
              <label className="form-lbl">Phone (for WhatsApp)</label>
              <input className="form-input" placeholder="+39 333 000 0000" />
            </div>
            <div className="form-group">
              <label className="form-lbl">Assign to Segment</label>
              <div className="select-wrap">
                <select className="form-select">
                  <option>⭐ VIP</option>
                  <option>♻ Loyal</option>
                  <option>✦ New</option>
                  <option>🔥 Warm</option>
                  <option>⏱ Lapsed</option>
                </select>
                <span className="material-symbols-outlined select-arrow">expand_more</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-lbl">Notes</label>
              <textarea className="form-textarea ct-notes-textarea" placeholder="Any relevant notes about this customer…" />
            </div>
            <div className="alert-gdpr-blue">
              <span className="material-symbols-outlined">gpp_good</span>
              <div>A consent request will be sent to this contact via email before any marketing is delivered. You cannot message manually added contacts until they opt in.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddContact(false)}>Cancel</button>
              <button className="btn btn-primary">
                <span className="material-symbols-outlined">person_add</span>Add & Send Consent Request
              </button>
            </div>
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
              <div className="ct-panel-title">Contact Profile</div>
              <button className="btn btn-primary btn-sm">
                <span className="material-symbols-outlined">campaign</span>Message
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
                  <span className="material-symbols-outlined">mail</span>Email
                </div>
                <div className="ct-panel-ch">
                  <span className="material-symbols-outlined">chat</span>WhatsApp
                </div>
                <div className="ct-panel-ch ct-panel-ch-soon">
                  <span className="material-symbols-outlined">photo_camera</span>Instagram DM
                  <span className="ct-soon-badge">SOON</span>
                </div>
              </div>

              {/* Boutique Interactions */}
              <div className="ct-panel-section-lbl">Boutique Interactions</div>
              <div className="ct-panel-rows">
                <div className="ct-panel-row"><span>Purchases</span><strong>{panelContact.purchases}</strong></div>
                <div className="ct-panel-row"><span>Items Favorited</span><strong>{panelContact.favorites}</strong></div>
                <div className="ct-panel-row"><span>Total Spent at Atelier Bianchi</span><strong>{panelContact.ltv}</strong></div>
                <div className="ct-panel-row"><span>Source</span><span>{panelContact.src}</span></div>
                <div className="ct-panel-row"><span>Last Active</span><span>{panelContact.last}</span></div>
              </div>

              {/* Spend by Category */}
              <div className="ct-panel-section-lbl">Spend by Category</div>
              {[
                {label:'Ready-to-wear', val:'€868', pct:70},
                {label:'Accessories',   val:'€248', pct:20},
                {label:'Other',         val:'€124', pct:10},
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
              <div className="ct-panel-section-lbl">Language & Localization</div>
              <div className="ct-panel-lang-row">
                <span className="ct-panel-lang-flag">{panelContact.lang}</span>
                <div>
                  <div className="ct-panel-lang-name">{panelContact.langName}</div>
                  <div className="ct-panel-lang-src">{panelContact.langSrc}</div>
                </div>
                <button className="btn btn-outline btn-xs ct-panel-lang-change">
                  <span className="material-symbols-outlined">edit</span>Change
                </button>
              </div>
                            <div className="ct-panel-lang-note">All campaign translations target this language. Set explicitly by customer or staff.</div>

              {/* GDPR Consent */}
              <div className="ct-panel-section-lbl">GDPR Consent — Per Channel</div>
              {[
                { icon:'mail',         label:'Email',          state:panelContact.email },
                { icon:'chat',         label:'WhatsApp',        state:panelContact.wa    },
                { icon:'photo_camera', label:'Instagram DM',    soon:true                },
                { icon:'description',  label:'Printed insert',  state:panelContact.print },
              ].map(ch => {
                const status   = ch.soon ? 'soon' : ch.state === 'yes' ? 'opted_in' : 'no'
                const statusTxt = ch.soon ? 'Not yet available' : ch.state === 'yes' ? '✓ Opted in' : 'Not opted in'
                return (
                  <div key={ch.label} className="ct-panel-consent-row">
                    <span className="material-symbols-outlined ct-panel-consent-icon">{ch.icon}</span>
                    <div className="ct-panel-consent-label">
                      {ch.label}
                      {ch.soon && <span className="ct-soon-badge">SOON</span>}
                    </div>
                    <span className={`ct-panel-consent-status ${status}`}>{statusTxt}</span>
                  </div>
                )
              })}
              <div className="ct-panel-consent-note">Consent managed by Mi Italia. You cannot modify consent status directly.</div>

              {/* Activity Timeline */}
              <div className="ct-panel-section-lbl">Activity Timeline</div>
              {panelLoading ? (
                <div style={{padding:'10px 2px', fontSize:11, color:'var(--stone)', fontStyle:'italic'}}>Loading activity…</div>
              ) : (() => {
                const orders  = panelDetail?.recent_orders       ?? []
                const reservs = panelDetail?.recent_reservations ?? []
                if (orders.length === 0 && reservs.length === 0) {
                  return <div style={{padding:'10px 2px', fontSize:11, color:'var(--stone)', fontStyle:'italic'}}>No recent activity yet.</div>
                }
                return <div style={{padding:'10px 2px', fontSize:11, color:'var(--stone)'}}>{orders.length + reservs.length} recent item(s) — shape TBD</div>
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CAMPAIGNS — HUB ──────────────────────────────────────
function CampaignsView({ campaigns: _ignored, segments, dashboard, initialSub = 'hub' }) {
  const [campSub,        setCampSub]        = useState(initialSub || 'hub')
  const [channelFilter,  setChannelFilter]  = useState('all')
  const [list,           setList]           = useState([])
  const [loadingList,    setLoadingList]    = useState(true)
  const [editingId,      setEditingId]      = useState(null)
  const [analyticsModalId, setAnalyticsModalId] = useState(null)

  const refetchList = () => {
    setLoadingList(true)
    campaignApi.list()
      .then(res => {
        if (res?.success) setList((res.data?.campaigns ?? []).map(mapApiCampaignCard))
      })
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }
  useEffect(() => { refetchList() }, [])

  if (campSub === 'builder') return (
    <CampaignBuilder
      campaignId={editingId}
      segments={segments}
      onBack={() => { refetchList(); setEditingId(null); setCampSub('hub') }}
      onReview={(savedId) => { setEditingId(savedId); setCampSub('review') }}
    />
  )
  if (campSub === 'review') return (
    <CampaignReview
      campaignId={editingId}
      onBack={() => setCampSub('builder')}
      onSubmit={() => { refetchList(); setEditingId(null); setCampSub('hub') }}
    />
  )


  // Hub view
  const openDraft = (id) => { setEditingId(id); setCampSub('builder') }
  const openCard = (c) => {
    if (c.status === 'draft') openDraft(c.id)
    else                      setAnalyticsModalId(c.id)   
  }
  const handleAction = (c, action) => {
    if (action === 'edit')        openDraft(c.id)
    else if (action === 'submit') { setEditingId(c.id); setCampSub('review') }
  }

  const counts = {
    all:   list.length,
    email: list.filter(c => c.ch === 'email').length,
    wa:    list.filter(c => c.ch === 'wa').length,
    print: list.filter(c => c.ch === 'print').length,
  }
  const filtered = channelFilter === 'all' || channelFilter === 'perf'
    ? list
    : list.filter(c => c.ch === channelFilter)

  const tabs = [
    { key:'all',   label:'All',         count:counts.all },
    { key:'email', icon:'mail',         color:'var(--gold-dk)', label:'Email',     count:counts.email, ctBg:'var(--gold)' },
    { key:'wa',    icon:'chat',         color:'#1a9e4d',         label:'WhatsApp',  count:counts.wa,    ctBg:'var(--wa)' },
    { key:'print', icon:'description',  color:'var(--stone)',    label:'Print',     count:counts.print, ctBg:'var(--stone)' },
    { key:'perf',  icon:'analytics',    color:'var(--gold)',     label:'Performance' },
  ]

  const segStyleNeutral = { fontSize:8, padding:'1px 6px', background:'var(--mist)', color:'var(--stone)' }

  return (
    <div>
      {/* Info banner */}
      <div className="camp-info-banner">
        <span className="material-symbols-outlined camp-info-icon">verified</span>
        <div className="camp-info-body">
          <div className="camp-info-title">Mi Italia reviews all campaigns before sending</div>
          <div className="camp-info-sub">Choose a channel &amp; language → write your content → translations auto-generate → review and submit. Mi Italia approves for brand standards within 4 hours Mon–Fri.</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setCampSub('builder') }}>
          <span className="material-symbols-outlined">add</span>New Campaign
        </button>
      </div>

      {/* KPI Row — wired to dashboard */}
      <div className="stat-row col4 camp-kpi-row">
        <div className="stat-card">
          <div className="stat-lbl">Active Campaigns</div>
          <div className="stat-val">{dashboard?.totalCampaigns ?? '—'}</div>
          <div className="stat-sub">{dashboard
            ? `${dashboard.sentCampaigns ?? 0} sent · ${dashboard.draftCampaigns ?? 0} draft · ${dashboard.scheduledCampaigns ?? 0} scheduled`
            : 'Loading…'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Campaigns Sent · 30d</div>
          <div className="stat-val">{dashboard?.campaignsSent30d ?? '—'}</div>
          <div className="stat-sub">Last 30 days</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Avg Open Rate</div>
          <div className="stat-val">{dashboard?.avgOpenRate != null ? `${dashboard.avgOpenRate}%` : '—'}</div>
          <div className="stat-sub">Across all channels</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Revenue Attributed</div>
          <div className="stat-val">{dashboard?.revenue != null ? `€${Number(dashboard.revenue).toLocaleString()}` : '—'}</div>
          <div className="stat-sub">From attributed purchases</div>
        </div>
      </div>

      {/* Channel filter tabs */}
      <div className="tabs">
        {tabs.map(t => (
          <div key={t.key} className={`tab${channelFilter === t.key ? ' act' : ''}`} onClick={() => setChannelFilter(t.key)}>
            {t.icon && <span className="material-symbols-outlined tab-icon" style={{ color:t.color }}>{t.icon}</span>}
            {t.label}
            {t.count !== undefined && (
              <span className="tab-ct" style={t.ctBg && channelFilter === t.key ? { background:t.ctBg } : undefined}>{t.count}</span>
            )}
          </div>
        ))}
      </div>

      {/* Campaign cards */}
      {loadingList ? (
        <div style={{ padding:'18px 2px', fontSize:11, color:'var(--stone)', fontStyle:'italic' }}>Loading campaigns…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:'18px 2px', fontSize:11, color:'var(--stone)', fontStyle:'italic' }}>
          No campaigns yet — click "New Campaign" to start.
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
                  : <span key={i} className={`seg seg-${s.key}`} style={{ fontSize:8, padding:'1px 6px' }}>{s.label}</span>
              )}
            </div>
          </div>

          <div className="cc-stats">
            {c.actions ? (
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
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
        onClose={() => { setAnalyticsModalId(null); refetchList() }}
      />
    </div>
  )
}


// ── CAMPAIGNS — BUILDER (5-step) ─────────────────────────
function CampaignBuilder({ campaignId: initialId, segments: segArr, onBack, onReview }) {
  const [campaignId,      setCampaignId]      = useState(initialId || null)
  const [campaignName,    setCampaignName]    = useState('Untitled draft')
  const [channel,         setChannel]         = useState('email')
  const [selectedLangs,   setSelectedLangs]   = useState(new Set(['en','fr']))   // UI-only, not persisted
  const [template,        setTemplate]        = useState(null)             
  const [subject,         setSubject]         = useState('')
  const [previewText,     setPreviewText]     = useState('')                     // UI-only, no API field
  const [body,            setBody]            = useState('')
  const [segment,         setSegment]         = useState('all')
  const [excludeRecent,   setExcludeRecent]   = useState(true)                   // UI-only, not persisted
  const [matchLang,       setMatchLang]       = useState(true)                   // UI-only, not persisted
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
  }, [])

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
          setCampaignName(c.campaign_name || 'Untitled draft')
          setChannel(channelKey(c.channel))
          setSubject(c.subject || '')
          setBody(c.message || '')
          setSegment(c.target_segment || 'all')
          setTemplate(c.template_id || null)
        } else {
          setErrorMsg(res?.message || 'Failed to load campaign')
        }
      })
      .catch(() => setErrorMsg('Failed to load campaign'))
      .finally(() => setLoadingCampaign(false))
  }, [initialId])

  // POST if new, PUT if existing. Returns the saved id (or null on failure).
  const saveDraft = async () => {
    const name = campaignName.trim() || 'Untitled draft'
    setSaving(true)
    setErrorMsg(null)
    try {
      const payload = {
        campaign_name:  name,
        channel,
        target_segment: segment,
      }
      if (template)         payload.template_id = template
      if (subject.trim())   payload.subject     = subject
      if (body.trim())      payload.message     = body
      const res = campaignId
        ? await campaignApi.update(campaignId, payload)
        : await campaignApi.create(payload)
      if (!res?.success) {
        setErrorMsg(res?.message || 'Save failed')
        return null
      }
      const savedId = res.data?.id || campaignId
      if (!campaignId && savedId) setCampaignId(savedId)
      return savedId
    } catch (e) {
      setErrorMsg('Save failed — check your connection and try again.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndClose = async () => { const id = await saveDraft(); if (id) onBack() }
  const handleReview       = async () => { const id = await saveDraft(); if (id) onReview(id) }

  const channels = [
    { key:'email', icon:'mail',         color:'var(--gold-dk)', label:'Email',     priceLbl:'FREE' },
    { key:'wa',    icon:'chat',         color:'#1a9e4d',        label:'WhatsApp',  priceLbl:'€0.10' },
    { key:'insta', icon:'photo_camera', color:'#DD2A7B',        label:'Instagram', priceLbl:'COMING SOON', disabled:true },
    { key:'print', icon:'description',  color:'var(--stone)',   label:'Print',     priceLbl:'€0.18' },
  ]

  const LANGS = [
    { code:'it', flag:'🇮🇹', name:'Italian', share:'SOURCE · 87%', locked:true },
    { code:'en', flag:'EN',  name:'English', share:'8%', isBadge:true },
    { code:'fr', flag:'🇫🇷', name:'French',  share:'5%' },
    { code:'ar', flag:'🇸🇦', name:'Arabic' },
    { code:'zh', flag:'🇨🇳', name:'Mandarin' },
    { code:'es', flag:'🇪🇸', name:'Spanish' },
    { code:'de', flag:'🇩🇪', name:'German' },
    { code:'ja', flag:'🇯🇵', name:'Japanese' },
  ]

  // Segment cards — keys match the API enum
  const segCountFor = (key) => {
    if (key === 'all') return (segArr || []).reduce((s, x) => s + (x.customers ?? 0), 0)
    return (segArr || []).find(x => x.key === key)?.customers ?? 0
  }
  const segmentCards = [
    { key:'all',    emoji:'👥', name:'All contacts', desc:'Everyone reachable on this channel' },
    { key:'vip',    emoji:'⭐', name:'VIP',          desc:'Platino tier · spend €5k+ lifetime' },
    { key:'loyal',  emoji:'♻', name:'Loyal',        desc:'Oro+ tier · 3+ purchases · visited 90d' },
    { key:'new',    emoji:'✦', name:'New',          desc:'Argento · 1 purchase · joined 90d' },
    { key:'warm',   emoji:'🔥', name:'Warm',         desc:'Has favorited but not purchased' },
    { key:'lapsed', emoji:'⏱', name:'Lapsed',       desc:'Has purchased · no visit 180d' },
  ]

  const toggleLang = (code) => {
    setSelectedLangs(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code); else next.add(code)
      return next
    })
  }
  const langCount = selectedLangs.size + 1 // +1 for Italian (locked)

  const steps = ['Channel & Languages', 'Template', 'Content', 'Audience & Schedule', 'Translation Review']

  return (
    <div className="camp-sub-wrap">
      {loadingCampaign && (
        <div style={{ padding:'10px 0', fontSize:11, color:'var(--stone)', fontStyle:'italic' }}>Loading campaign…</div>
      )}
      {errorMsg && (
        <div style={{ padding:'10px 14px', background:'rgba(197,0,26,0.06)', border:'1px solid rgba(197,0,26,0.3)', borderRadius:8, fontSize:11, color:'var(--red)', marginBottom:12 }}>{errorMsg}</div>
      )}

      {/* Top bar */}
      <div className="camp-builder-top">
        <button className="btn btn-outline btn-sm" onClick={onBack} disabled={saving}>
          <span className="material-symbols-outlined">arrow_back</span>Hub
        </button>
        <div className="camp-builder-title-wrap">
          <input
            value={campaignName}
            onChange={e => setCampaignName(e.target.value)}
            placeholder="Untitled draft"
            style={{
              fontFamily:"'Cormorant Garamond', serif",
              fontSize:24, fontWeight:500, lineHeight:1.1,
              border:'none', outline:'none', background:'transparent',
              width:'100%', padding:0, color:'var(--deep)',
            }}
          />
          <div className="camp-builder-sub">
            {campaignId ? `Draft · click Save or Translation Review to persist` : `Untitled draft · click Save to persist`}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleSaveAndClose} disabled={saving}>
          {saving ? 'Saving…' : 'Save & close'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleReview} disabled={saving}>
          {saving ? 'Saving…' : 'Translation Review'}<span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>

      {/* 5-step progress */}
      <div className="prog">
        {steps.map((step, i) => (
          <div key={step} className="prog-item">
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
            <div className="form-lbl">Step 1 — Channel</div>
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
            <div className="form-lbl">Step 2 — Languages to translate into</div>
            <div className="camp-tip">
              <span className="material-symbols-outlined">tips_and_updates</span>
              Based on the language distribution of your selected segment, we pre-selected the top 3.
            </div>
            <div className="lang-pills">
              {LANGS.map(l => {
                const isSel = l.locked || selectedLangs.has(l.code)
                return (
                  <div key={l.code}
                    className={`lang-pill${isSel ? ' sel' : ''}${l.locked ? ' locked' : ''}`}
                    onClick={() => !l.locked && toggleLang(l.code)}>
                    {l.isBadge ? <span className="lang-text-badge">{l.flag}</span> : <span>{l.flag}</span>}
                    {l.name}
                    {l.share && <span className="lang-pill-share">{l.share}</span>}
                  </div>
                )
              })}
            </div>
            <div className="form-hint">Auto-translated on save · review each before send. {langCount} language{langCount === 1 ? '' : 's'} selected.</div>
          </div>

          {/* Step 3: Template */}
          <div className="camp-step">
            <div className="form-lbl">Step 3 — Template</div>
            <div className="tmpl-grid">
              {templatesLoading ? (
                <div style={{ gridColumn:'1/-1', padding:'14px 2px', fontSize:11, color:'var(--stone)', fontStyle:'italic' }}>Loading templates…</div>
              ) : apiTemplates.length === 0 ? (
                <div style={{ gridColumn:'1/-1', padding:'14px 2px', fontSize:11, color:'var(--stone)', fontStyle:'italic' }}>
                  No templates yet — campaigns will use the message body below.
                </div>
              ) : (
                <>
                  <div className={`tmpl-pick${template === null ? ' sel' : ''}`} onClick={() => setTemplate(null)}>
                    <div className="tmpl-pick-emoji">✏️</div>
                    <div className="tmpl-pick-label">No template<br/><span style={{fontSize:8.5,color:'var(--stone)',fontWeight:500}}>Use message below</span></div>
                  </div>
                  {apiTemplates.map(t => (
                    <div key={t.id}
                      className={`tmpl-pick${template === t.id ? ' sel' : ''}`}
                      onClick={() => setTemplate(t.id)}>
                      <div className="tmpl-pick-emoji">{templateEmoji(t.template_key)}</div>
                      <div className="tmpl-pick-label">{templateDisplayName(t.template_key)}</div>
                      {t.translations_pending && (
                        <div style={{fontSize:8, fontWeight:700, color:'var(--gold-dk)', marginTop:3, letterSpacing:0.3}}>TRANSLATIONS PENDING</div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Step 4: Content */}
          <div className="camp-step">
            <div className="form-lbl">Step 4 — Content · Italian (source)</div>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">Subject Line</label>
                <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">Preview Text</label>
                <input className="form-input" value={previewText} onChange={e => setPreviewText(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-lbl">Message Body</label>
              <textarea className="form-textarea camp-body-textarea" value={body} onChange={e => setBody(e.target.value)} />
              <div className="form-hint">Write in Italian. The other languages auto-translate on save — review each in step 5 before send.</div>
            </div>
          </div>

          {/* Step 5: Audience & schedule */}
          <div className="camp-step">
            <div className="form-lbl">Step 5 — Audience &amp; schedule</div>
            <div className="camp-tip">
              <span className="material-symbols-outlined">groups</span>
              Pick a segment from your <strong>Contacts</strong>. Manage standing segments once — target them everywhere.
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
              Create or edit segments in Contacts
            </div>

            <div className="refine-row">
              <span className="material-symbols-outlined refine-icon">filter_alt</span>
              <div className="refine-body">
                <div className="refine-title">Exclude recent recipients</div>
                <div className="refine-sub">Skip anyone who got another campaign in the last 7 days. <strong>−85 contacts</strong></div>
              </div>
              <Toggle on={excludeRecent} onToggle={() => setExcludeRecent(v => !v)} />
            </div>
            <div className="refine-row">
              <span className="material-symbols-outlined refine-icon">translate</span>
              <div className="refine-body">
                <div className="refine-title">Match recipient language</div>
                <div className="refine-sub">Only send to contacts whose language is in your selected languages. Unmatched fall back to English.</div>
              </div>
              <Toggle on={matchLang} onToggle={() => setMatchLang(v => !v)} />
            </div>

            <div className="form-row2" style={{ marginTop:14 }}>
              <div className="form-group">
                <label className="form-lbl">When to send</label>
                <select className="form-select">
                  <option>Send when approved</option>
                  <option>Schedule for specific time</option>
                  <option>Send during optimal engagement window (AI)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-lbl">Time zone</label>
                <select className="form-select"><option>Europe/Rome (recipient local)</option></select>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live preview */}
        <div>
          <div className="camp-preview-wrap">
            <div className="camp-preview-head">
              <div className="camp-preview-label">Live preview · {channels.find(c => c.key === channel)?.label || 'Email'} · Italian</div>
              <div className="camp-preview-sub">
                <span className="material-symbols-outlined">visibility</span>Recipient view
              </div>
            </div>
            <div className="email-preview">
              <div className="email-preview-head">
                From: <strong>Atelier Bianchi</strong> &lt;giulia@atelierbianchi.it&gt;<br />
                Subject: <strong>{subject}</strong>
              </div>
              <div className="email-preview-body">
                <div className="email-preview-brand">Atelier Bianchi</div>
                <div className="email-preview-title">{campaignName || 'Untitled'}</div>
                <div className="email-preview-tag">Seta italiana · SS26</div>
                <div className="email-preview-hero">👗</div>
                <div className="email-preview-text">{body}</div>
                <a className="email-preview-cta">Reserve at Brera</a>
              </div>
              <div className="email-preview-foot">Atelier Bianchi · Milano Brera · Mi Italia<br />Unsubscribe anytime</div>
            </div>
            <div className="camp-preview-note">Preview shows Italian (source). After save, translations generate and you'll review each in step 5.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CAMPAIGNS — TRANSLATION REVIEW ───────────────────────
function CampaignReview({ campaignId, onBack, onSubmit }) {
  const [enConfirmed, setEnConfirmed] = useState(true)
  const [frConfirmed, setFrConfirmed] = useState(false)
  const [enSubject,   setEnSubject]   = useState('The new Bordeaux dress has arrived')
  const [enBody,      setEnBody]      = useState('Dear Sofia, our new Bordeaux silk midi dress is the signature piece of the SS26 collection — a clean silhouette, a fit that falls naturally, and that wine-red that pairs perfectly with leather. Only 12 pieces available in sizes 38, 40, 42. Try it in Brera or reserve via the app.')
  const [frSubject,   setFrSubject]   = useState('La nouvelle robe Bordeaux est arrivée')
  const [frBody,      setFrBody]      = useState("Chère Sofia, notre nouvelle robe midi en soie Bordeaux est la pièce phare de la collection SS26 — une silhouette pure, une coupe qui tombe avec naturel, et ce rouge vin qui se marie à merveille avec le cuir. Seulement 12 pièces disponibles en tailles 38, 40, 42. Essayez-la à Brera ou réservez-la via l'app.")
  const [sending,     setSending]     = useState(false)
  const [errorMsg,    setErrorMsg]    = useState(null)
  const [successMsg,  setSuccessMsg]  = useState(null)

  const allConfirmed   = enConfirmed && frConfirmed
  const confirmedCount = (enConfirmed ? 1 : 0) + (frConfirmed ? 1 : 0)
  const [campaign,      setCampaign]      = useState(null)
  const [template,      setTemplate]      = useState(null)
  const [loadingTpl,    setLoadingTpl]    = useState(false)
  const [retranslating, setRetranslating] = useState(null)   // holds the template id while in flight

  useEffect(() => {
    if (!campaignId) return
    setLoadingTpl(true)
    campaignApi.get(campaignId)
      .then(res => {
        if (!res?.success) return null
        setCampaign(res.data)
        return res.data?.template_id ? templateApi.get(res.data.template_id) : null
      })
      .then(tres => {
        if (tres?.success) setTemplate(tres.data?.template)
      })
      .catch(() => {})
      .finally(() => setLoadingTpl(false))
  }, [campaignId])

  const handleRetranslate = async () => {
    if (!template?.id) {
      setErrorMsg('No template attached — translations can only be regenerated from a template.')
      return
    }
    setRetranslating(template.id)
    setErrorMsg(null)
    try {
      const res = await templateApi.translate(template.id)
      if (res?.success) {
        setSuccessMsg(`Translation queued for ${res.data?.targets?.length || 0} language${(res.data?.targets?.length || 0) === 1 ? '' : 's'}.`)
        // Refresh template to pick up new translations_pending state
        const tres = await templateApi.get(template.id)
        if (tres?.success) setTemplate(tres.data?.template)
      } else {
        setErrorMsg(res?.message || 'Re-translate failed.')
      }
    } catch (e) {
      setErrorMsg('Re-translate failed — check your connection.')
    } finally {
      setRetranslating(null)
    }
  }

  const handleSubmit = async () => {
    if (!campaignId) {
      setErrorMsg('No campaign id — save the campaign first.')
      return
    }
    setSending(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const res = await campaignApi.send(campaignId)
      if (res?.success) {
        setSuccessMsg(res.message || 'Campaign sent.')
        // Small delay so user sees the success state, then exit
        setTimeout(() => { onSubmit() }, 800)
      } else {
        setErrorMsg(res?.message || 'Send failed.')
      }
    } catch (e) {
      setErrorMsg('Send failed — check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="camp-sub-wrap">
      {/* Top bar */}
      <div className="camp-builder-top">
        <button className="btn btn-outline btn-sm" onClick={onBack} disabled={sending}>
          <span className="material-symbols-outlined">arrow_back</span>Back to Builder
        </button>
        <div className="camp-builder-title-wrap">
          <div className="camp-builder-title">Translation <em>Review</em></div>
          <div className="camp-builder-sub">SS26 · Bordeaux silk drop · {confirmedCount + 1} of 3 languages ready</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onBack} disabled={sending}>Save draft</button>
        <button className={`btn btn-primary${sending || !campaignId ? ' btn-disabled' : ''}`} disabled={sending || !campaignId} onClick={handleSubmit}>
          <span className="material-symbols-outlined">check</span>{sending ? 'Sending…' : 'Submit for review'}
        </button>
      </div>

      {errorMsg && (
        <div style={{ padding:'10px 14px', background:'rgba(197,0,26,0.06)', border:'1px solid rgba(197,0,26,0.3)', borderRadius:8, fontSize:11, color:'var(--red)', marginBottom:12 }}>{errorMsg}</div>
      )}
      {successMsg && (
        <div style={{ padding:'10px 14px', background:'rgba(0,108,53,0.06)', border:'1px solid rgba(0,108,53,0.3)', borderRadius:8, fontSize:11, color:'var(--green)', marginBottom:12 }}>{successMsg}</div>
      )}

      {/* Source banner */}
      <div className="cr-banner">
        <div className="cr-banner-icon"><span className="material-symbols-outlined">translate</span></div>
        <div className="cr-banner-body">
          <div className="cr-banner-title">Source: 🇮🇹 Italian · written by Giulia · 2 translations generated by Claude</div>
          <div className="cr-banner-sub">Review each translation. Edit any wording that doesn't sound right. <strong>Confirm</strong> each one before submitting — the Send button only unlocks when all are confirmed.</div>
        </div>
      </div>

      {/* Italian source reference card */}
      <div className="card cr-source-card">
        <div className="cr-source-head">
          <span style={{ fontSize:16 }}>🇮🇹</span>
          <div className="cr-source-title">Italian — SOURCE</div>
          <span className="cr-source-locked">CANNOT EDIT HERE</span>
        </div>
        <div className="cr-source-subject">Subject: Il nuovo abito Bordeaux è arrivato</div>
        <div className="cr-source-body">Cara Sofia, il nostro nuovo abito midi in seta Bordeaux è la firma della collezione SS26 — una silhouette pulita, una vestibilità che cade naturalmente, e quel rosso vino che si abbina perfettamente al cuoio. Solo 12 pezzi disponibili nelle taglie 38, 40, 42. Provalo in Brera o riservalo dall'app.</div>
      </div>

      {/* Translation cards */}
      <div className="cr-grid">
        {/* English */}
        <div className="card cr-card">
          <div className="cr-card-head">
            <span className="lang-text-badge">EN</span>
            <div className="cr-card-lang">English</div>
            <span className={`cr-card-status ${enConfirmed ? 'confirmed' : 'edited'}`}>
              {enConfirmed ? 'CONFIRMED' : 'EDITED · 1 FIELD'}
            </span>
          </div>
          <div className="cr-card-label">SUBJECT</div>
          <input
            className={`form-input cr-input${!enConfirmed ? ' cr-input-edited' : ''}`}
            value={enSubject}
            onChange={e => { setEnSubject(e.target.value); setEnConfirmed(false) }} />
          <div className="cr-card-label">BODY</div>
          <textarea
            className="form-textarea cr-card-textarea"
            value={enBody}
            onChange={e => { setEnBody(e.target.value); setEnConfirmed(false) }} />
          <div className="cr-card-foot">
            {enConfirmed
              ? <span className="cr-card-foot-txt">147 recipients · Confirmed by Giulia</span>
              : <button className="btn btn-primary btn-xs" onClick={() => setEnConfirmed(true)}>
                  <span className="material-symbols-outlined">check</span>Confirm changes
                </button>
            }
           <button className="btn btn-outline btn-xs" onClick={handleRetranslate} disabled={retranslating === template?.id}>
            <span className="material-symbols-outlined">refresh</span>{retranslating === template?.id ? 'Queuing…' : 'Re-translate'}
           </button>
          </div>
        </div>

        {/* French */}
        <div className="card cr-card">
          <div className="cr-card-head">
            <span style={{ fontSize:16 }}>🇫🇷</span>
            <div className="cr-card-lang">French</div>
            <span className={`cr-card-status ${frConfirmed ? 'confirmed' : 'edited'}`}>
              {frConfirmed ? 'CONFIRMED' : 'EDITED · 1 FIELD'}
            </span>
          </div>
          <div className="cr-card-label">SUBJECT</div>
          <input
            className={`form-input cr-input${!frConfirmed ? ' cr-input-edited' : ''}`}
            value={frSubject}
            onChange={e => { setFrSubject(e.target.value); setFrConfirmed(false) }} />
          <div className="cr-card-label">BODY</div>
          <textarea
            className="form-textarea cr-card-textarea"
            value={frBody}
            onChange={e => { setFrBody(e.target.value); setFrConfirmed(false) }} />
          <div className="cr-card-foot">
            {frConfirmed
              ? <span className="cr-card-foot-txt">189 recipients · Confirmed</span>
              : <button className="btn btn-primary btn-xs" onClick={() => setFrConfirmed(true)}>
                  <span className="material-symbols-outlined">check</span>Confirm changes
                </button>
            }
           <button className="btn btn-outline btn-xs" onClick={handleRetranslate} disabled={retranslating === template?.id}>
            <span className="material-symbols-outlined">refresh</span>{retranslating === template?.id ? 'Queuing…' : 'Re-translate'}
           </button>
          </div>
        </div>
      </div>

      {/* Send bar */}
      <div className="cr-send-bar">
        <span className="material-symbols-outlined cr-send-icon">verified</span>
        <div className="cr-send-body">
          <div className="cr-send-title">{confirmedCount} of 2 translations confirmed</div>
          <div className="cr-send-sub">
            {allConfirmed
              ? 'All translations confirmed — ready to submit for Mi Italia review.'
              : 'French still has edits — confirm it to unlock the send button.'}
          </div>
        </div>
        <button className={`btn btn-primary${sending || !campaignId ? ' btn-disabled' : ''}`} disabled={sending || !campaignId} onClick={handleSubmit}>
          <span className="material-symbols-outlined">check</span>{sending ? 'Sending…' : 'Submit for review'}
        </button>
      </div>
    </div>
  )
}

function mockLangBreakdown(campaignId, totalSent, overallOpenRate, overallClickRate, overallRevenue) {
  const h = hashStr(campaignId || 'default')
  // Language mix: IT source (60%), EN (25%), FR (10%), AR (3%), ZH (2%)
  const mix = [
    { code:'it', pct:0.60, label:'Italian',  note:'Best performing',           source:true,  bar:'var(--green)'  },
    { code:'en', pct:0.25, label:'English',  note:'Confirmed by Giulia',       source:false, bar:'var(--gold)'   },
    { code:'fr', pct:0.10, label:'French',   note:'EDITED · 3 fields',         source:false, bar:'#0055A4', edited:true },
    { code:'ar', pct:0.03, label:'Arabic',   note:'Low engagement · review',   sub:'RTL · MSA register', bar:'#006C35', low:true },
    { code:'zh', pct:0.02, label:'Mandarin', note:'Small sample',              bar:'#DE2910' },
  ]
  const t = totalSent || 100
  return mix.map((m, i) => {
    const sent = Math.max(1, Math.round(t * m.pct))
    const variance = 0.85 + ((h >> (i * 3)) % 30) / 100    // 0.85–1.15
    const openRate = Math.min(99, Math.max(15, overallOpenRate * variance))
    const clickRate = Math.min(30, Math.max(2, overallClickRate * variance))
    const revShare = m.pct * overallRevenue
    return {
      ...m,
      sent,
      openRate: openRate.toFixed(1),
      clickRate: clickRate.toFixed(1),
      revenue: Math.round(revShare),
    }
  })
}

function mockOpensOverTime(campaignId) {
  const h = hashStr(campaignId || 'default')
  // 7 buckets: 1h, 3h, 6h, 12h, 24h, 48h, +
  // Typical curve: early spike, tail off
  const shape = [60, 90, 75, 40, 20, 10, 5]
  return shape.map((base, i) => Math.max(2, base + ((h >> (i * 2)) % 15) - 7))
}

function mockTopPerformers(campaignId) {
  const h = hashStr(campaignId || 'default')
  const namesPool = [
    ['Sofia M.',  'Marco R.',    'Chiara D.',  'Valeria T.'],
    ['Luca B.',   'Isabella F.', 'Alessandro G.', 'Giulia P.'],
    ['Matteo S.', 'Elena V.',    'Francesco N.',  'Beatrice L.'],
  ]
  const names = namesPool[h % namesPool.length]
  const actions = ['purchased', 'clicked', 'clicked', 'purchased']
  const times = ['2h after send', '45min after send', '1h after send', '4h after send']
  return names.map((n, i) => ({
    name: n,
    action: actions[i],
    actionLabel: actions[i] === 'purchased' ? 'Purchased' : 'Clicked link',
    time: times[i],
  }))
}

function CampaignAnalyticsModal({ campaignId, onClose }) {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    if (!campaignId) return
    setLoading(true)
    setErrorMsg(null)
    apiFetch(`${API}/boutique/marketing/campaigns/${campaignId}/analytics`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) setData(res.data)
        else setErrorMsg(res?.message || 'Failed to load analytics')
      })
      .catch(() => setErrorMsg('Failed to load analytics'))
      .finally(() => setLoading(false))
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

  const displayName = c.campaign_name || 'Campaign'
  const dateLbl     = c.sent_at ? formatDate(c.sent_at) : c.status === 'draft' ? 'Draft · not yet sent' : ''

  // Estimated revenue — API doesn't provide, use conversion from purchases * avg order
  // Fallback: rough estimate = clicks * 3% * 200€ avg order (deterministic-ish)
  const estRevenue = counts.clicked ? Math.round(counts.clicked * 0.03 * 200) : 0
  const estPurchases = counts.clicked ? Math.max(1, Math.round(counts.clicked * 0.03)) : 0

  const langRows      = counts.sent ? mockLangBreakdown(campaignId, counts.sent, +rates.open || 40, +rates.click || 10, estRevenue) : []
  const timeBars      = mockOpensOverTime(campaignId)
  const topPerformers = mockTopPerformers(campaignId)
  const totalLangs    = langRows.length

  return (
    <>
      <div className="cam-modal-overlay" onClick={onClose} />
      <div className="cam-modal" role="dialog" aria-modal="true">
        <div className="cam-modal-hdr">
          <div className="cam-modal-title">{displayName} <em>— Analytics</em></div>
          <button className="cam-modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="cam-modal-body">
          {loading && (
            <div style={{ padding:'20px 2px', fontSize:11, color:'var(--stone)', fontStyle:'italic' }}>Loading analytics…</div>
          )}
          {errorMsg && (
            <div style={{ padding:'12px 14px', background:'rgba(197,0,26,0.06)', border:'1px solid rgba(197,0,26,0.3)', borderRadius:8, fontSize:11, color:'var(--red)', marginBottom:14 }}>{errorMsg}</div>
          )}

          {!loading && !errorMsg && (
            <>
              {/* Top 4 KPI cards */}
              <div className="cam-modal-stats">
                <div className="cam-modal-stat">
                  <div className="cam-modal-stat-lbl">Sent</div>
                  <div className="cam-modal-stat-val">{fmt(counts.sent)}</div>
                  <div className="cam-modal-stat-sub">{dateLbl}</div>
                </div>
                <div className="cam-modal-stat">
                  <div className="cam-modal-stat-lbl">Opened</div>
                  <div className="cam-modal-stat-val">{fmt(counts.opened)}</div>
                  <div className="cam-modal-stat-sub up">{fmtPct(rates.open)} open rate</div>
                </div>
                <div className="cam-modal-stat">
                  <div className="cam-modal-stat-lbl">Clicked</div>
                  <div className="cam-modal-stat-val">{fmt(counts.clicked)}</div>
                  <div className="cam-modal-stat-sub">{fmtPct(rates.click)} CTR</div>
                </div>
                <div className="cam-modal-stat">
                  <div className="cam-modal-stat-lbl">Revenue</div>
                  <div className="cam-modal-stat-val">€{fmt(estRevenue)}</div>
                  <div className="cam-modal-stat-sub up">{estPurchases} {estPurchases === 1 ? 'purchase' : 'purchases'} attributed</div>
                </div>
              </div>

              {/* Performance by language — MOCK */}
              {langRows.length > 0 && (
                <div className="cam-modal-card">
                  <div className="cam-modal-card-hdr">
                    <div className="cam-modal-card-title">Performance by <em>language</em></div>
                    <div className="cam-modal-card-meta">{totalLangs} LANGUAGES · TRANSLATED VIA CLAUDE</div>
                  </div>
                  <table className="cam-modal-tbl">
                    <thead>
                      <tr>
                        <th>Language</th>
                        <th>Sent</th>
                        <th>Open Rate</th>
                        <th>CTR</th>
                        <th>Revenue</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {langRows.map(r => (
                        <tr key={r.code}>
                          <td>
                            <div className="cam-modal-lang-cell">
                              {LANG_META[r.code]?.flag
                                ? <span className="cam-modal-lang-flag">{LANG_META[r.code].flag}</span>
                                : <span className="cam-modal-lang-code">{LANG_META[r.code]?.code || r.code.toUpperCase()}</span>
                              }
                              <div>
                                <div className="cam-modal-lang-name">{r.label}</div>
                                {r.source && <div className="cam-modal-lang-badge">SOURCE</div>}
                                {r.sub    && <div className="cam-modal-lang-sub">{r.sub}</div>}
                              </div>
                            </div>
                          </td>
                          <td><strong>{r.sent}</strong></td>
                          <td>
                            <div className={`cam-modal-rate ${r.low ? 'low' : 'good'}`}>{r.openRate}%</div>
                            <div className="cam-modal-rate-track"><div className="cam-modal-rate-fill" style={{ width:`${r.openRate}%`, background:r.bar }} /></div>
                          </td>
                          <td><strong>{r.clickRate}%</strong></td>
                          <td><strong>€{r.revenue}</strong></td>
                          <td>
                            <span className={`cam-modal-note${r.edited ? ' edited' : ''}`}>{r.note}</span>
                          </td>
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
                    <div className="cam-modal-card-title">Opens <em>Over Time</em></div>
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

                <div className="cam-modal-card">
                  <div className="cam-modal-card-hdr">
                    <div className="cam-modal-card-title">Top <em>Performers</em></div>
                  </div>
                  <table className="cam-modal-tbl compact">
                    <thead>
                      <tr>
                        <th>Contact</th>
                        <th>Action</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPerformers.map((p, i) => (
                        <tr key={i}>
                          <td>{p.name}</td>
                          <td>
                            <span className={`cam-modal-action ${p.action}`}>{p.actionLabel}</span>
                          </td>
                          <td style={{ fontSize:10, color:'var(--stone)' }}>{p.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
    <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
      <span style={{ fontSize:14 }}>{m.flag}</span><span>{m.name}</span>
    </span>
  )
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
      <span style={{
        display:'inline-flex', width:22, height:14, background:'transparent',
        border:'1.2px solid var(--gold)', borderRadius:3, fontSize:8, fontWeight:700,
        color:'var(--gold-dk)', alignItems:'center', justifyContent:'center', letterSpacing:0.5,
      }}>{m.code}</span>
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
        <text x={padL - 5} y={padT + 4}          fontSize="9" fill="var(--stone)" textAnchor="end" fontFamily="Montserrat">{Math.round(max)}</text>
        <text x={padL - 5} y={padT + cH/2 + 3}   fontSize="9" fill="var(--stone)" textAnchor="end" fontFamily="Montserrat">{Math.round(max/2)}</text>
        <text x={padL - 5} y={padT + cH + 3}     fontSize="9" fill="var(--stone)" textAnchor="end" fontFamily="Montserrat">0</text>
        <path d={fillStr} fill="url(#cdpMiniGrad)" />
        <path d={lineStr} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--white)" stroke="var(--gold)" strokeWidth="1.5" />
        ))}
        <text x={padL}       y={H - 6} fontSize="9" fill="var(--stone)"                  fontFamily="Montserrat">0h</text>
        <text x={W - padR}   y={H - 6} fontSize="9" fill="var(--stone)" textAnchor="end" fontFamily="Montserrat">{endLabel || '15h'}</text>
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
            <div className="cdp-heat-cta-wrap" style={{ marginBottom:6 }}>
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
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'var(--stone)', marginBottom:10 }}>Click breakdown</div>
          <div className="cdp-click-list">
            {linkClicks.map((l, i) => (
              <div key={i} className="cdp-click-row">
                <div className="cdp-click-row-hdr">
                  <span>{l.label}</span>
                  <span style={{ fontWeight:700, color:'var(--deep)' }}>
                    {l.clicks} <span style={{ color:'var(--stone)', fontWeight:400 }}>({l.pct}%)</span>
                  </span>
                </div>
                <div className="cdp-click-row-track">
                  <div className="cdp-click-row-fill" style={{ width:`${l.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:9, color:'var(--stone)', marginTop:12, lineHeight:1.55, fontStyle:'italic' }}>
            {totalClicks} clicks across {linkClicks.length} tracked links.
          </div>
        </div>
      </div>
    </>
  )
}

// ─── MAIN: AnalyticsView ─────────────────────────────────────

function AnalyticsView() {
  const [range,         setRange]         = useState('30d')
  const [compare,       setCompare]       = useState('none')
  const [customRange,   setCustomRange]   = useState(null)
  const [detailId, setDetailId] = useState(null)

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
    { lbl:'Identification rate', num:data.idrate,  prefix:'',  suffix:'%', delta:cmpDeltas?.idrateDelta  ?? data.idrateDelta,  spark:'0,22 10,20 21,16 32,11 43,8 54,6 64,4' },
    { lbl:'Revenue attributed',  num:data.revenue, prefix:'€', suffix:'',  delta:cmpDeltas?.revenueDelta ?? data.revenueDelta, spark:'0,21 10,19 21,17 32,14 43,9 54,7 64,5' },
    { lbl:'Campaign ROI',        num:data.roi,     prefix:'',  suffix:'%', delta:cmpDeltas?.roiDelta     ?? data.roiDelta,     spark:'0,20 10,18 21,17 32,13 43,11 54,7 64,5' },
    { lbl:'Engaged contacts',    num:data.engaged, prefix:'',  suffix:'',  delta:cmpDeltas?.engagedDelta ?? data.engagedDelta, spark:'0,18 10,16 21,15 32,12 43,11 54,8 64,6' },
    { lbl:'Avg LTV · 12mo',      num:data.ltv,     prefix:'€', suffix:'',  delta:cmpDeltas?.ltvDelta     ?? data.ltvDelta,     spark:'0,20 10,17 21,16 32,13 43,12 54,9 64,7' },
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
        onExport={() => console.log('[Marketing] Export clicked')}
      />

      {/* ── KPI hero strip ── */}
      <div className="stat-row" style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:14, marginBottom:18 }}>
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
      <div className="chart-card" style={{ marginBottom:18 }}>
        <div className="chart-hd">
          <div className="chart-hd-l">
            <span className="material-symbols-outlined">monitoring</span>
            <div>
              <div className="chart-hd-ttl">Identification <em>rate trend</em></div>
              <div className="chart-hd-sub">Your commission tier depends on this. Each tier crossing earns Atelier Bianchi a lower rate on Connect plan.</div>
            </div>
          </div>
          <div className="chart-hd-rt">
            <div className="chart-legend">
              <div className="chart-legend-itm"><div className="chart-legend-sw" style={{ background:'var(--gold)' }} /><span>Your rate</span></div>
              <div className="chart-legend-itm"><div className="chart-legend-sw" style={{ background:'rgba(184,149,90,0.13)' }} /><span>Platinum tier zone</span></div>
            </div>
            <button className="btn btn-ghost btn-xs"><span className="material-symbols-outlined">download</span></button>
          </div>
        </div>

        <div className="idr-chart">
          <svg viewBox="0 0 800 280" preserveAspectRatio="none" style={{ width:'100%', height:280 }}>
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
            <text x="744" y="153" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="Montserrat, sans-serif">34% · Silver</text>

            {/* X axis labels */}
            {['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'].map((m, i) => (
              <text key={m} className="idr-axis" x={60 + i*65} y="260" textAnchor="middle">{m}</text>
            ))}
          </svg>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:18, marginTop:14, paddingTop:14, borderTop:'1px solid var(--mist)', fontSize:10.5, color:'var(--stone)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span className="material-symbols-outlined" style={{ color:'var(--green)', fontSize:14 }}>arrow_upward</span>
            <strong style={{ color:'var(--deep)', fontWeight:700 }}>11pt to Gold tier</strong>
            <span> · would save €1,008/yr at current revenue</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginLeft:'auto' }}>
            <span className="material-symbols-outlined" style={{ fontSize:14 }}>timeline</span>
            <span>3-month trend: </span><strong style={{ color:'var(--green)' }}>+5pt</strong>
          </div>
        </div>
      </div>

      {/* ── Row 1: Revenue by channel + Funnel ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr', gap:18, marginBottom:18 }}>
        <div className="chart-card">
          <div className="chart-hd">
            <div className="chart-hd-l">
              <span className="material-symbols-outlined">euro</span>
              <div>
                <div className="chart-hd-ttl">Revenue by <em>channel</em></div>
                <div className="chart-hd-sub">App-attributed revenue from campaign touches. Cost shown as net after channel fees.</div>
              </div>
            </div>
          </div>

          <div className="rev-chan">
            {[
              { name:'Email',     ch:'email', icon:'mail',         iconColor:'var(--gold-dk)', pct:'100%',  label:'58.3%', val:'€2,810', fee:'FREE'         },
              { name:'WhatsApp',  ch:'wa',    icon:'chat',         iconColor:'#1a9e4d',         pct:'55.5%', label:'32.4%', val:'€1,560', fee:'−€31 fees'    },
              { name:'Print',     ch:'print', icon:'description',  iconColor:'var(--stone)',    pct:'16%',   label:'9.3%',  val:'€450',   fee:'−€12 print'   },
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
            <div className="rev-chan-row" style={{ opacity:0.55 }}>
              <div className="rev-chan-name">
                <span className="material-symbols-outlined" style={{ color:'#DD2A7B' }}>photo_camera</span>
                <span>Instagram</span>
              </div>
              <div className="rev-chan-bar"><div className="rev-chan-fill insta" style={{ width:'4%' }} /></div>
              <div className="rev-chan-val" style={{ fontSize:10, fontWeight:600, color:'var(--gold-dk)', textTransform:'uppercase', letterSpacing:0.5 }}>Soon</div>
            </div>
          </div>

          <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--mist)', fontSize:10.5, lineHeight:1.6, color:'var(--stone)' }}>
            <strong style={{ color:'var(--deep)', fontWeight:700 }}>Email is your highest ROI channel</strong>
            <span> — 58% of attributed revenue at zero cost. Consider running more email-led campaigns to VIPs.</span>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-hd">
            <div className="chart-hd-l">
              <span className="material-symbols-outlined">filter_alt</span>
              <div>
                <div className="chart-hd-ttl">Engagement <em>funnel</em></div>
                <div className="chart-hd-sub">From contact to purchase. Drop-off rates between stages — where to focus next.</div>
              </div>
            </div>
          </div>

          <div className="funnel">
            {[
              { icon:'groups',     label:'Engaged contacts', pct:100,  val:'1,184', sub:'in audience' },
              { drop:'−22%',       text:"didn't open" },
              { icon:'drafts',     label:'Opened / read',    pct:78,   val:'921',   sub:'of 1,184' },
              { drop:'−71%',       text:"opened but didn't click" },
              { icon:'touch_app',  label:'Clicked / replied', pct:22.3, val:'264',   sub:'of 921' },
              { drop:'−68%',       text:"clicked but didn't visit store" },
              { icon:'store',      label:'Visited store',     pct:7.1,  val:'84',    sub:'of 264' },
              { drop:'−55%',       text:"visited but didn't buy" },
              { icon:'check_circle', label:'Purchased',       pct:3.2,  val:'38',    sub:'of 84 visits', success:true },
            ].map((r, i) => {
              if (r.drop) {
                return (
                  <div key={i} className="funnel-drop">
                    <span className="material-symbols-outlined" style={{ fontSize:13 }}>south</span>
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

          <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--mist)', fontSize:10.5, lineHeight:1.6, color:'var(--stone)' }}>
            <strong style={{ color:'var(--deep)', fontWeight:700 }}>Biggest drop: opened → clicked (71%).</strong>
            <span> A/B test stronger calls-to-action or more visual previews in your next campaign.</span>
          </div>
        </div>
      </div>

      {/* ── Campaign ROI table ── */}
      <div className="chart-card" style={{ marginBottom:18 }}>
        <div className="chart-hd">
          <div className="chart-hd-l">
            <span className="material-symbols-outlined">leaderboard</span>
            <div>
              <div className="chart-hd-ttl">Campaign <em>ROI</em></div>
              <div className="chart-hd-sub">Every campaign in the selected range, ranked by ROI. Cost includes channel fees only — not your time.</div>
            </div>
          </div>
          <div className="chart-hd-rt">
            <button className="btn btn-ghost btn-xs"><span className="material-symbols-outlined">download</span>Export</button>
          </div>
        </div>

        <table className="croi-tbl">
          <thead>
            <tr>
              <th>Campaign</th><th>Date</th>
              <th className="num">Sent</th><th className="num">Open</th><th className="num">Click</th><th className="num">Visits</th>
              <th className="num">Revenue</th><th className="num">Cost</th><th className="num">ROI</th>
            </tr>
          </thead>
          <tbody>
            {ROI_CAMPAIGNS.map(c => (
              <tr key={c.id} onClick={() => onOpenCampaignDetail(c.id)} style={{ cursor:'pointer' }}>
                <td>
                  <div className="croi-name">
                    <div className={`cn-ico ${c.ch}`}><span className="material-symbols-outlined">{c.ch === 'wa' ? 'chat' : c.ch === 'print' ? 'description' : 'mail'}</span></div>
                    <span>{c.name}</span>
                  </div>
                </td>
                <td style={{ fontSize:10, color:'var(--stone)' }}>{c.date}</td>
                <td className="num">{c.sent}</td>
                <td className="num">{c.open}</td>
                <td className="num">{c.click}</td>
                <td className="num">{c.visits}</td>
                <td className="num"><strong>{c.rev}</strong></td>
                <td className="num">{c.cost}</td>
                <td className={`num croi-roi ${c.pos ? 'pos' : 'neg'}`}>{c.roi}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display:'flex', alignItems:'center', gap:18, marginTop:14, paddingTop:14, borderTop:'1px solid var(--mist)', fontSize:10.5, color:'var(--stone)' }}>
          <div>
            <strong style={{ color:'var(--deep)', fontWeight:700 }}>7 of 8 campaigns profitable.</strong>
            <span> Ramadan Gifting drove no purchases — consider testing different copy or audience next year.</span>
          </div>
          <div style={{ marginLeft:'auto', fontFeatureSettings:"'tnum' 1" }}>
            <span>Total: </span>
            <strong style={{ color:'var(--deep)' }}>€6,550</strong><span> attributed · </span>
            <strong style={{ color:'var(--deep)' }}>€42</strong><span> cost · </span>
            <strong style={{ color:'var(--green)' }}>+15,495%<span> ROI</span></strong>
          </div>
        </div>
      </div>

      {/* ── Row 2: Segment health stacked + Cohort retention ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:18 }}>
        <div className="chart-card">
          <div className="chart-hd">
            <div className="chart-hd-l">
              <span className="material-symbols-outlined">stacked_bar_chart</span>
              <div>
                <div className="chart-hd-ttl">Segment <em>health</em></div>
                <div className="chart-hd-sub">How your customer mix has shifted over the last 6 months.</div>
              </div>
            </div>
            <div className="chart-hd-rt">
              <div className="chart-legend">
                {[
                  { sw:'var(--gold)',                 label:'VIP' },
                  { sw:'var(--gold-light)',           label:'Returning' },
                  { sw:'var(--gold-soft)',            label:'New' },
                  { sw:'rgba(140,123,107,0.4)',       label:'Lapsed' },
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
            <svg viewBox="0 0 600 240" preserveAspectRatio="none" style={{ width:'100%', height:240 }}>
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

          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginTop:14, paddingTop:14, borderTop:'1px solid var(--mist)' }}>
            {[
              { lbl:'VIP',       val:'248', delta:'↑ +38%', color:'var(--green)' },
              { lbl:'Returning', val:'426', delta:'↑ +33%', color:'var(--green)' },
              { lbl:'New',       val:'358', delta:'↑ +99%', color:'var(--green)' },
              { lbl:'Lapsed',    val:'152', delta:'↑ +27%', color:'#B45309' },
            ].map(s => (
              <div key={s.lbl}>
                <div style={{ fontSize:8.5, fontWeight:700, letterSpacing:1, color:'var(--stone)', textTransform:'uppercase', marginBottom:3 }}>{s.lbl}</div>
                <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:18, fontWeight:500 }}>{s.val}</div>
                <div style={{ fontSize:9, color:s.color, fontWeight:700 }}>{s.delta}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-hd">
            <div className="chart-hd-l">
              <span className="material-symbols-outlined">grid_on</span>
              <div>
                <div className="chart-hd-ttl">Cohort <em>retention</em></div>
                <div className="chart-hd-sub">% of customers from each month who returned in subsequent months. Higher numbers later = healthier base.</div>
              </div>
            </div>
          </div>

          <div className="cohort">
            <div className="cohort-hd cohort-row-lbl">Acquired in</div>
            {['M+0','M+1','M+2','M+3','M+4','M+5'].map(h => <div key={h} className="cohort-hd">{h}</div>)}

            {[
              { name:"Dec '25", contacts:'84',  cells:[['c5','100%'],['c3','42%'],['c2','31%'],['c2','29%'],['c2','26%'],['c2','24%']] },
              { name:"Jan '26", contacts:'112', cells:[['c5','100%'],['c3','46%'],['c2','33%'],['c2','28%'],['c2','25%'],['empty','—']] },
              { name:"Feb '26", contacts:'148', cells:[['c5','100%'],['c3','51%'],['c3','38%'],['c2','31%'],['empty','—'],['empty','—']] },
              { name:"Mar '26", contacts:'196', cells:[['c5','100%'],['c4','58%'],['c3','42%'],['empty','—'],['empty','—'],['empty','—']] },
              { name:"Apr '26", contacts:'221', cells:[['c5','100%'],['c4','62%'],['empty','—'],['empty','—'],['empty','—'],['empty','—']] },
              { name:"May '26", contacts:'234', cells:[['c5','100%'],['empty','—'],['empty','—'],['empty','—'],['empty','—'],['empty','—']] },
            ].flatMap(row => [
              <div key={`${row.name}-name`} className="cohort-row-name">{row.name}<span className="sub">{row.contacts} contacts</span></div>,
              ...row.cells.map(([cls, v], i) => <div key={`${row.name}-${i}`} className={`cohort-cell ${cls}`}>{v}</div>),
            ])}
          </div>

          <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--mist)', fontSize:10.5, lineHeight:1.6, color:'var(--stone)' }}>
            <strong style={{ color:'var(--deep)', fontWeight:700 }}>Retention is improving</strong>
            <span> — M+1 went from 42% (Dec) to 62% (Apr). Your engagement work is paying off in repeat visits.</span>
          </div>
        </div>
      </div>

      {/* ── Footer note ── */}
      <div style={{ background:'rgba(184,149,90,0.05)', border:'1px solid rgba(184,149,90,0.18)', borderRadius:'var(--radius)', padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:10, fontSize:10.5, color:'var(--gold-dk)', lineHeight:1.55 }}>
        <span className="material-symbols-outlined" style={{ fontSize:16, color:'var(--gold-dk)', flexShrink:0, marginTop:1 }}>tips_and_updates</span>
        <div>
          <strong style={{ color:'var(--gold-dk)' }}>All Engagement metrics shown.</strong>
          <span> For store-wide analytics — POS revenue, product velocity, order volume — see </span>
          <span style={{ textDecoration:'underline', cursor:'pointer', fontWeight:600 }}>Insights → Analytics</span>
          <span> in the sidebar.</span>
        </div>
      </div>
      <CampaignDetailPanel campaignId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}


// ── AUTOMATIONS ──────────────────────────────────────────
function AutomationsView() {
  const [flows, setFlows] = useState([
    { icon:'shopping_bag',   iconBg:'rgba(0,108,53,0.08)',  iconColor:'var(--green)',  title:'Welcome Message — First Purchase',  desc:'Channel: WhatsApp · Sends within 15 min of first confirmed purchase · Template: "Grazie per il tuo acquisto da Atelier Bianchi…"',          stats:[{val:'143',lbl:'Sent'},{val:'89%',lbl:'Read'},{val:'24%',lbl:'Replied'}], on:true },
    { icon:'favorite',       iconBg:'rgba(184,149,90,0.1)', iconColor:'var(--gold)',   title:'Back in Stock — Favorited Items',   desc:'Channel: WhatsApp · Fires when a favorited product is restocked · Template: "Your saved item is back at Atelier Bianchi"',               stats:[{val:'67',lbl:'Sent'},{val:'34%',lbl:'Purchased'}],                        on:true },
    { icon:'calendar_month', iconBg:'rgba(99,91,255,0.08)', iconColor:'var(--stripe)', title:'Reservation Reminder',              desc:'Channel: WhatsApp · Fires 24 hours before confirmed Reserve & Pick Up · Template: "Your appointment at Atelier Bianchi is tomorrow…"', stats:[{val:'38',lbl:'Sent'},{val:'94%',lbl:'Showed up'}],                        on:true },
    { icon:'schedule',       iconBg:'rgba(217,119,6,0.08)', iconColor:'#B45309',       title:'Lapsed Customer Re-engagement',     desc:"Channel: Email · Fires when customer inactive for 60+ days · Template: \"We haven't seen you at Atelier Bianchi in a while…\"",         stats:[{val:'0',lbl:'Sent'}],                                                     on:false },
    { icon:'celebration',    iconBg:'rgba(99,91,255,0.08)', iconColor:'var(--stripe)', title:'Birthday Greeting',                 desc:'Channel: WhatsApp · Fires on customer birthday if shared · Template: "Tanti auguri da tutto il team Atelier Bianchi 🎂"',              stats:[{val:'12',lbl:'Sent'},{val:'100%',lbl:'Read'}],                            on:true },
  ])

  function toggleFlow(i) {
    setFlows(prev => prev.map((f, idx) => idx === i ? { ...f, on: !f.on } : f))
  }

  return (
    <div>
      <div className="auto-header">
        <div className="auto-intro">Set triggers once — Mi Italia sends on your behalf whenever conditions are met. All automated messages use approved templates. No content goes out without prior template approval.</div>
        <button className="btn btn-primary"><span className="material-symbols-outlined">add</span>New Flow</button>
      </div>

      <div className="eng-section-lbl auto-section-lbl">Trigger-Based Automations</div>
      <div className="auto-flow-list">
        {flows.map((f, i) => (
          <div key={i} className="auto-flow-card">
            <div className="auto-flow-icon" style={{background:f.iconBg}}>
              <span className="material-symbols-outlined" style={{color:f.iconColor}}>{f.icon}</span>
            </div>
            <div className="auto-flow-body">
              <div className="auto-flow-title">{f.title}</div>
              <div className="auto-flow-sub">{f.desc}</div>
            </div>
            <div className="auto-flow-stats">
              {f.stats.map(s => (
                <div key={s.lbl}>
                  <div className="auto-flow-stat-val">{s.val}</div>
                  <div className="auto-flow-stat-lbl">{s.lbl}</div>
                </div>
              ))}
            </div>
            <Toggle on={f.on} onToggle={() => toggleFlow(i)} />
          </div>
        ))}
      </div>

      <div className="eng-section-lbl auto-section-lbl">Custom Flows</div>
      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">VIP <em>Win-Back Flow</em></div>
            <div className="auto-flow-meta">Applies to: VIP segment · Trigger: 45 days inactive</div>
          </div>
          <div className="auto-flow-hdr-actions">
            <span className="status paused">Paused</span>
            <button className="btn btn-outline btn-sm"><span className="material-symbols-outlined">edit</span>Edit Flow</button>
            <Toggle on={false} onToggle={() => {}} />
          </div>
        </div>

        <div className="flow-wrap">
          <div className="flow-step trigger">
            <div className="flow-type trigger">⚡ Trigger</div>
            <div className="flow-name">Customer inactive for 45 days</div>
            <div className="flow-desc">Applies to: VIP segment only</div>
          </div>
          <div className="flow-conn"><div className="flow-conn-txt">then</div></div>
          <div className="flow-step delay">
            <div className="flow-type delay">⏱ Wait</div>
            <div className="flow-name">1 day</div>
            <div className="flow-desc">Allows time before first contact</div>
          </div>
          <div className="flow-conn"><div className="flow-conn-txt">then</div></div>
          <div className="flow-step action">
            <div className="flow-type action">📤 Send</div>
            <div className="flow-name">WhatsApp — Personal re-engagement</div>
            <div className="flow-desc">Template: "We miss you at Atelier Bianchi, [First Name]…"</div>
          </div>
          <div className="flow-conn"><div className="flow-conn-txt">then</div></div>
          <div className="flow-step condition">
            <div className="flow-type condition">🔀 Condition</div>
            <div className="flow-name">Did they reply or make a purchase?</div>
            <div className="flow-desc">Check window: 7 days</div>
          </div>
          <div className="flow-conn flow-conn-short" />
          <div className="flow-branch">
            <div className="flow-branch-side">
              <div className="flow-branch-yes">YES →</div>
              <div className="flow-step end">
                <div className="flow-type end">✓ End flow</div>
                <div className="flow-name">Remove from sequence</div>
              </div>
            </div>
            <div className="flow-branch-side">
              <div className="flow-branch-no">NO →</div>
              <div className="flow-step delay">
                <div className="flow-type delay">⏱ Wait 7 days</div>
              </div>
              <div className="flow-conn flow-conn-short" />
              <div className="flow-step action">
                <div className="flow-type action">📤 Send</div>
                <div className="flow-name">Email — Special offer</div>
                <div className="flow-desc">Template: "A gift for you from Atelier Bianchi"</div>
              </div>
              <div className="flow-conn flow-conn-short" />
              <div className="flow-step end">
                <div className="flow-type end">✓ End flow</div>
                <div className="flow-name">Exit regardless of response</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── FAVORITES ────────────────────────────────────────────
function FavoritesView() {
  const [favTab, setFavTab] = useState('contacts')

  const contactRows = [
    { init:'S', initBg:'rgba(184,149,90,0.15)', initColor:'var(--gold-dk)', name:'Sofia Marchetti',    sub:'Also follows the boutique', seg:'vip',    lang:'🇮🇹', langName:'Italian', langSrc:'User-set',           saved:7,  thumbs:['👗','🧥','👡'], extra:4, oos:2, email:'yes', wa:'yes',  print:'yes', last:'2 days ago' },
    { init:'M', initBg:'rgba(99,91,255,0.1)',   initColor:'var(--stripe)',   name:'Marco Rossi',       sub:'Also follows the boutique', seg:'loyal',  lang:'🇮🇹', langName:'Italian', langSrc:'Detected · 5 orders', saved:12, thumbs:['👔','🧥','👞'], extra:9, oos:1, email:'yes', wa:'no',   print:'yes', last:'Today' },
    { init:'C', initBg:'rgba(217,119,6,0.1)',   initColor:'#B45309',         name:'Chiara De Luca',    sub:'Also follows the boutique', seg:'warm',   lang:'🇫🇷', langName:'French',  langSrc:'Detected · browser',  saved:9,  thumbs:['🧥','👗','👜'], extra:6, oos:0, email:'yes', wa:'yes',  print:'no',  last:'3 days ago' },
    { init:'F', initBg:'rgba(0,108,53,0.08)',   initColor:'var(--green)',    name:'Francesca Bianchi', sub:'2 purchases',               seg:'loyal',  lang:'🇮🇹', langName:'Italian', langSrc:'Detected · 2 orders', saved:5,  thumbs:['👗','👠','👜'], extra:2, oos:0, email:'yes', wa:'yes',  print:'yes', last:'5 days ago' },
  ]

  const productRows = [
    {
      emoji:'🧥', badge:'OUT OF STOCK', badgeBg:'rgba(197,0,26,0.9)',
      name:'Cashmere Trench', nameEm:'Camel',
      cat:'Outerwear', price:'€1,290', stockStatus:'out', stockTxt:'Out of stock',
      saverAvatars:[
        {init:'S',bg:'rgba(184,149,90,0.2)',color:'var(--gold-dk)'},
        {init:'M',bg:'rgba(99,91,255,0.1)',color:'var(--stripe)'},
        {init:'C',bg:'rgba(217,119,6,0.1)',color:'#B45309'},
        {init:'L',bg:'rgba(197,0,26,0.08)',color:'var(--red)'},
        {init:'+14',bg:'var(--mist)',color:'var(--stone)',small:true},
      ],
      saverCount:'18 customers have this saved',
      saverSub:'14 have consent on at least one channel · spans 4 languages',
      actions:[
        {cls:'btn-primary', icon:'notifications_active', label:'Notify 14 savers when restocked'},
        {cls:'btn-outline', icon:'people', label:'View all 18 savers'},
      ]
    },
    {
      emoji:'👗', badge:'2 LEFT', badgeBg:'rgba(217,119,6,0.9)',
      name:'Silk Slip Dress', nameEm:'Ivory',
      cat:'Ready-to-wear', price:'€680', stockStatus:'low', stockTxt:'Low stock · 2 left',
      saverAvatars:[
        {init:'S',bg:'rgba(184,149,90,0.2)',color:'var(--gold-dk)'},
        {init:'F',bg:'rgba(0,108,53,0.1)',color:'var(--green)'},
        {init:'+9',bg:'var(--mist)',color:'var(--stone)',small:true},
      ],
      saverCount:'11 customers have this saved',
      saverSub:'9 have consent · only 2 units remaining',
      actions:[
        {cls:'btn-red', icon:'warning', label:'Alert 9 savers — only 2 left'},
        {cls:'btn-outline', icon:'people', label:'View all 11 savers'},
      ]
    },
    {
      emoji:'👔', badge:'IN STOCK', badgeBg:'rgba(0,108,53,0.9)',
      name:'Tailored Linen Blazer', nameEm:'Navy',
      cat:'Menswear', price:'€890', stockStatus:'in-stock', stockTxt:'In stock',
      saverAvatars:[
        {init:'M',bg:'rgba(99,91,255,0.1)',color:'var(--stripe)'},
        {init:'+6',bg:'var(--mist)',color:'var(--stone)',small:true},
      ],
      saverCount:'7 customers have this saved',
      saverSub:'5 have consent · evergreen styling',
      actions:[
        {cls:'btn-outline', icon:'campaign', label:'Campaign to 5 savers'},
        {cls:'btn-outline', icon:'people', label:'View all 7 savers'},
      ]
    },
    {
      emoji:'👜', badge:'OUT OF STOCK', badgeBg:'rgba(197,0,26,0.9)',
      name:'Leather Tote', nameEm:'Bordeaux',
      cat:'Accessories', price:'€520', stockStatus:'out', stockTxt:'Out of stock',
      saverAvatars:[
        {init:'C',bg:'rgba(217,119,6,0.1)',color:'#B45309'},
        {init:'+8',bg:'var(--mist)',color:'var(--stone)',small:true},
      ],
      saverCount:'9 customers have this saved',
      saverSub:'6 have consent · 3 unknown language',
      actions:[
        {cls:'btn-primary', icon:'notifications_active', label:'Notify 6 savers when restocked'},
      ]
    },
  ]

  return (
    <div>
      {/* KPI Row */}
      <div className="stat-row col4" style={{marginBottom:18}}>
        <div className="stat-card">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-email">favorite</span>
            Item Savers
          </div>
          <div className="stat-val">541</div>
          <div className="stat-sub">63.9% of contacts · ≥1 item saved</div>
        </div>
        <div className="stat-card fav-out">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined fav-oos-icon">inventory_2</span>
            Out-of-Stock Saves
          </div>
          <div className="stat-val">73</div>
          <div className="stat-sub">Saves on items currently OOS</div>
        </div>
        <div className="stat-card fav-most">
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined stat-icon-email">star</span>
            Most-Saved Product
          </div>
          <div className="stat-val fav-most-val">Cashmere<br /><em>Trench</em></div>
          <div className="stat-sub">18 customers · 14 with consent</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Avg Saves per Saver</div>
          <div className="stat-val">4.2</div>
          <div className="stat-change up">↑ +0.6 vs last month</div>
        </div>
      </div>

      {/* Banner */}
      <div className="notify-banner">
        <div className="nb-ico">❤️</div>
        <div className="nb-body">
          <div className="nb-title">541 contacts have saved items from Atelier Bianchi</div>
          <div className="nb-sub">Every saved item is a buying signal. <strong>389</strong> of these contacts have opted in to at least one channel — reachable now. When a saved item restocks, the Back-in-Stock automation fires automatically.</div>
        </div>
        <button className="btn btn-primary btn-sm">
          <span className="material-symbols-outlined">campaign</span>Campaign to all savers
        </button>
      </div>

      {/* Sub tabs */}
      <div className="fav-subnav">
        <div className={`ctab${favTab === 'contacts' ? ' act' : ''}`} onClick={() => setFavTab('contacts')}>
          <span className="material-symbols-outlined">favorite</span>
          Item Favorites
          <span className="ctab-ct">541</span>
        </div>
        <div className={`ctab${favTab === 'products' ? ' act' : ''}`} onClick={() => setFavTab('products')}>
          <span className="material-symbols-outlined">inventory_2</span>
          Most-Favorited Products
          <span className="ctab-ct">24</span>
        </div>
      </div>

      {/* BY CONTACT */}
      {favTab === 'contacts' && (
        <div>
          <div className="fav-toolbar">
            <div className="ct-search">
              <span className="material-symbols-outlined">search</span>
              <input placeholder="Search savers…" />
            </div>
            <div className="select-wrap">
              <select className="ct-select">
                <option>All item savers</option>
                <option>3+ items saved</option>
                <option>Saved but never purchased</option>
                <option>Saved an out-of-stock item</option>
                <option>Saved in last 7 days</option>
              </select>
              <span className="material-symbols-outlined select-arrow">expand_more</span>
          </div>
          <div className="select-wrap">
            <select className="ct-select">
              <option>Sort: Most items saved</option>
              <option>Sort: Recently saved</option>
              <option>Sort: Total spent</option>
            </select>
            <span className="material-symbols-outlined select-arrow">expand_more</span>
          </div>
            <div className="fav-toolbar-spacer" />
            <button className="btn btn-outline btn-sm">
              <span className="material-symbols-outlined">download</span>Export
            </button>
          </div>

          <div className="card ct-table-card">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="tbl-cb-col"><input type="checkbox" className="tbl-cb" /></th>
                  <th>Customer</th>
                  <th>Segment</th>
                  <th>Language</th>
                  <th>Items Saved</th>
                  <th>Favorited</th>
                  <th>OOS Saves</th>
                  <th>Consent · 3 channels</th>
                  <th>Last Saved</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contactRows.map((c, i) => (
                  <tr key={i} className="tbl-row-click">
                    <td><input type="checkbox" className="tbl-cb" onClick={e => e.stopPropagation()} /></td>
                    <td>
                      <div className="ct-contact-cell">
                        <div className="ct-av" style={{background:c.initBg, color:c.initColor}}>{c.init}</div>
                        <div>
                          <div className="ct-name">{c.name}</div>
                          <div className="ct-consent-sub ok">{c.sub}</div>
                        </div>
                      </div>
                    </td>
                    <td><SegBadge seg={c.seg} /></td>
                    <td>
                      <div className="ct-lang-wrap">
                        <span className="ct-flag">{c.lang}</span>
                        <div>
                          <div className="ct-lang-name">{c.langName}</div>
                          <div className="ct-lang-src">{c.langSrc}</div>
                        </div>
                      </div>
                    </td>
                    <td><strong>{c.saved}</strong></td>
                    <td>
                      <div className="fav-thumb-row">
                        {c.thumbs.map((t, ti) => (
                          <div key={ti} className="fav-thumb-tiny">{t}</div>
                        ))}
                        <div className="fav-thumb-more">+{c.extra}</div>
                      </div>
                    </td>
                    <td>
                      {c.oos > 0
                        ? <span className="fav-oos-count">{c.oos} OOS</span>
                        : <span className="tbl-meta">0</span>
                      }
                    </td>
                    <td>
                      <div className="cd-row">
                        <ConsentDot channel="email" state={c.email} />
                        <ConsentDot channel="wa"    state={c.wa} />
                        <ConsentDot channel="print" state={c.print} />
                      </div>
                    </td>
                    <td className="tbl-meta">{c.last}</td>
                    <td>
                      <button className="btn btn-outline btn-xs" onClick={e => e.stopPropagation()}>Message</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ct-table-footer">
              <span>Showing 4 of 541 item savers</span>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <button className="btn btn-outline btn-xs" disabled>‹ Previous</button>
                <span className="tbl-meta">Page 1 of 136</span>
                <button className="btn btn-outline btn-xs">Next ›</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BY PRODUCT */}
      {favTab === 'products' && (
        <div>
          <div className="notify-banner">
            <div className="nb-ico">📦</div>
            <div className="nb-body">
              <div className="nb-title">24 products have been saved by customers</div>
              <div className="nb-sub">See exactly who saved each item. When a product is back in stock, fire a targeted campaign to everyone who saved it — in one click.</div>
            </div>
            <div className="fav-bp-filters">
              <select className="fav-bp-select">
                <option>All products</option>
                <option>Out of stock</option>
                <option>Low stock</option>
                <option>In stock</option>
              </select>
              <select className="fav-bp-select">
                <option>Sort: Most saved</option>
                <option>Sort: Recently saved</option>
              </select>
            </div>
          </div>

          {productRows.map((p, i) => (
            <div key={i} className="pfav-card">
              <div className="pfav-inner">
                <div className="pfav-img">
                  {p.emoji}
                  <div className="pfav-stock-badge" style={{background:p.badgeBg, color:'white'}}>{p.badge}</div>
                </div>
                <div className="pfav-body">
                  <div className="pfav-name">{p.name} — <em>{p.nameEm}</em></div>
                  <div className="pfav-meta">
                    <span>{p.cat}</span>
                    <span>·</span>
                    <span><strong>{p.price}</strong></span>
                    <span>·</span>
                    <span className={`status ${p.stockStatus}`}>{p.stockTxt}</span>
                  </div>
                  <div className="pfav-savers">
                    <div className="saver-avatars">
                      {p.saverAvatars.map((a, ai) => (
                        <div key={ai} className={`saver-av${a.small ? ' saver-av-sm' : ''}`} style={{background:a.bg, color:a.color}}>
                          {a.init}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="saver-count">{p.saverCount}</div>
                      <div className="saver-lbl">{p.saverSub}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pfav-actions">
                {p.actions.map((a, ai) => (
                  <button key={ai} className={`btn ${a.cls} btn-sm`}>
                    <span className="material-symbols-outlined">{a.icon}</span>{a.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── MAIN ─────────────────────────────────────────────────
export default function Marketing() {
  const [activeView, setActiveView] = useState('overview')
  const [campaigns,  setCampaigns]  = useState([])
  const [segments,   setSegments]   = useState([])
  const [dashboard,  setDashboard]  = useState(null)
  const [campaignsStart, setCampaignsStart] = useState('hub')

  useEffect(() => {
    apiFetch(`${API}/boutique/marketing/segments`)
      .then(r => r.json())
      .then(res => { if (res.success) setSegments(res.data?.segments ?? []) })
      .catch(() => {})

    apiFetch(`${API}/boutique/marketing/dashboard`)
      .then(r => r.json())
      .then(res => { if (res.success) setDashboard(res.data) })
      .catch(() => {})

    apiFetch(`${API}/boutique/marketing/campaigns`)
      .then(r => r.json())
      .then(res => { if (res.success) setCampaigns(res.data?.campaigns ?? []) })
      .catch(() => {})
  }, [])

  const VIEWS = [
    { key:'overview',    icon:'dashboard',  label:'Overview' },
    { key:'contacts',    icon:'people',     label:'Contacts' },
    { key:'favorites',   icon:'favorite',   label:'Favorites' },
    { key:'campaigns',   icon:'campaign',   label:'Campaigns' },
    { key:'automations', icon:'bolt',       label:'Automations' },
    { key:'analytics',   icon:'monitoring', label:'Analytics', tag:'NEW' },
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
        {activeView === 'campaigns'   && <CampaignsView  campaigns={campaigns} initialSub={campaignsStart} key={campaignsStart} />}
        {activeView === 'automations' && <AutomationsView />}
        {activeView === 'analytics'   && <AnalyticsView />}
      </div>
    </>
  )
}
