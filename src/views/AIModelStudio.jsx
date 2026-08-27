import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import useLangStore from '../store/langStore'
import Toast, { useToast } from '../components/ui/Toast'

const API    = import.meta.env.VITE_API_URL
const STUDIO = `${API}/boutique/ai-studio`

// ── API plumbing ──────────────────────────────────────────
// Bodyless POSTs must still send `{}`: apiFetch always sets Content-Type:
// application/json on non-DELETE requests, and the API rejects that header
// with an empty body ("Body cannot be empty when content-type is set…").
async function apiJson(url, method = 'GET', body) {
  const init = { method }
  if (method !== 'GET' && method !== 'DELETE') init.body = JSON.stringify(body || {})
  return apiFetch(url, init)
    .then(r => r.json())
    .catch(() => ({ success:false, message:'Network error' }))
}

// Short labels for the three aspect ratios. Detailed spells these out in its own
// toggle; Quick needs them as prose.
const ASPECT_LABEL = { '3:4':'Store', '1:1':'Catalogue', '9:16':'Social' }
// The standard shoot — 3:4 at 3 poses. Only decides whether Quick's format row
// reads STANDARD or CUSTOM; never applied to anything.
const isStandardShoot = (aspect, variants) => aspect === '3:4' && variants === 3

// ── Photo helpers ─────────────────────────────────────────
// Uploads come back as app-relative paths ("/uploads/…"); these render straight
// into background-image, so they need the image host prefixed. An absolute URL
// (a pasted external link) passes through untouched.
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL || ''
function toDisplayUrl(url) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `${IMG_BASE}${url}`
}

// Mirrors the backend's own upload guard (aiStudio.controller parseModelBody
// allows exactly these three types) so the user is told before a bad file is
// sent and bounced with a 400.
const PHOTO_TYPES     = ['image/jpeg','image/png','image/webp']
const PHOTO_MAX_BYTES = 10 * 1024 * 1024

// Reads the picked file's real pixel size. FASHN reads the body pose from this
// photo, so a head-and-shoulders crop fails outright — worth warning about
// before a generation is spent on it.
function inspectPhoto(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => resolve({ url, w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ url, w: 0, h: 0 }) }
    img.src = url
  })
}
function photoWarning(info, t) {
  if (!info.w || !info.h) return ''
  if (info.h / info.w < 1.15) return t ? t('ais.photo.warn_crop', 'This looks like a wide or square crop. Full-body shots are usually tall — pose detection fails on head-and-shoulders framing.') : 'This looks square or landscape. A full-body portrait poses far more reliably.'
  if (info.w < 500)           return t ? t('ais.photo.warn_small', 'This image is only {{w}}×{{h}}. Small photos often lose the body detail the AI needs — 900px tall or more works best.', { w: info.w, h: info.h }) : 'This image is small — above 800px wide gives noticeably better detail.'
  return ''
}

// ── Generation helpers ────────────────────────────────────
const TERMINAL_STATUSES = ['completed','failed','cancelled']
const isTerminal = g => TERMINAL_STATUSES.includes(g?.status)

// A failed generation's `error` is itself a JSON-stringified object, e.g.
// '{"name":"PoseError","message":"Failed to detect body pose in model image."}'
// — surface the message, never the raw blob.
function generationError(g) {
  const raw = g?.error
  if (!raw) return ''
  if (typeof raw === 'object') return raw.message || raw.name || ''
  try {
    const parsed = JSON.parse(raw)
    return parsed?.message || parsed?.name || raw
  } catch { return raw }
}

// output_urls carries the multi-pose set; output_url is the single-pose case.
function generationOutputs(g) {
  if (Array.isArray(g?.output_urls) && g.output_urls.length) return g.output_urls
  return g?.output_url ? [g.output_url] : []
}

function generationBriefLine(g) {
  return [g?.look_snapshot?.name, g?.model_snapshot?.name || (g?.model_snapshot?.custom_photo_url ? 'Custom photo' : null), g?.aspect]
    .filter(Boolean).join(' · ')
}

// ── Formatting ────────────────────────────────────────────
function resetLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `resets ${d.getDate()} ${d.toLocaleString('en', { month:'short' })}`
}

function timeAgo(iso) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

// Batch sheets carry display labels ('3:4 STORE', '4 at a time'); the API wants
// the bare value.
const aspectValue   = label => (label || '3:4').split(' ')[0]
const parallelValue = label => parseInt(label, 10) || 1

// …and back again, for hydrating a saved batch into the sheets.
const ASPECT_WORDS  = { '3:4':'STORE', '1:1':'CATALOGUE', '9:16':'SOCIAL', '4:5':'INSTAGRAM' }
const aspectLabel   = (value, t) => `${value} ${t ? t(`ais.aspect_word.${value}`, ASPECT_WORDS[value] || 'STORE') : (ASPECT_WORDS[value] || 'STORE')}`

// ── Product helpers ───────────────────────────────────────
function productPhotos(p) { return Array.isArray(p?.photos) ? p.photos : [] }
function productSubtitle(p) {
  if (!p) return ''
  return [
    p.brand_name,
    p.sku || null,
    p.retail_price ? `€${p.retail_price}` : null,
    p.variants?.length ? `${p.variants.length} variant${p.variants.length !== 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ')
}
function productStock(p) {
  if (typeof p?.total_stock === 'number') return p.total_stock
  return (p?.variants || []).reduce((s, v) => s + Math.max(0, v.stock_qty || 0), 0)
}

// Studio look attribute vocabulary — mirrors the real /boutique/ai-studio/looks schema.
// NOTE: values below are inferred/extracted from a reference build; the sample look
// returned by GET /looks (tungsten · studio-dark · candid · warm · neutral) matches
// this vocabulary, but the full enum per field hasn't been confirmed against the API contract.
const LOOK_OPTIONS = {
  lighting: [
    { v:'window',      label:'Soft window light' },
    { v:'tungsten',    label:'Warm tungsten' },
    { v:'golden-hour', label:'Golden hour' },
    { v:'ringlight',   label:'Ringlight / clean' },
    { v:'overcast',    label:'Overcast diffuse' },
  ],
  setting: [
    { v:'studio-white',   label:'Studio · white' },
    { v:'studio-dark',    label:'Studio · dark' },
    { v:'interior-cream', label:'Interior · cream' },
    { v:'street-milano',  label:'Street · Milano' },
    { v:'atelier',        label:'Atelier / boutique' },
  ],
  mood: [
    { v:'clean',    label:'Clean / catalogue' },
    { v:'candid',   label:'Candid / relaxed' },
    { v:'dramatic', label:'Dramatic / editorial' },
    { v:'romantic', label:'Romantic / soft' },
  ],
  color_grade: [
    { v:'neutral', label:'Neutral' },
    { v:'warm',    label:'Warm' },
    { v:'cool',    label:'Cool' },
    { v:'filmic',  label:'Filmic / muted' },
  ],
  palette: [
    { v:'neutral',   label:'Neutral',   swatch:['#EDE8DF','#8C7B6B','#3D2A14'] },
    { v:'warm',      label:'Warm',      swatch:['#F5E6D3','#C89B6A','#8A5A2B'] },
    { v:'cool',      label:'Cool',      swatch:['#E4E9ED','#8FA3B0','#3D5866'] },
    { v:'tricolore', label:'Tricolore', swatch:['#008C45','#F5F0E8','#CD212A'] },
  ],
}

const LOOK_GRADE_GRADIENTS = {
  warm:    'linear-gradient(135deg,#3a2a18,#6b4a22)',
  cool:    'linear-gradient(135deg,#22303a,#3d5866)',
  neutral: 'linear-gradient(135deg,#2a2018,#4a4038)',
  filmic:  'linear-gradient(135deg,#2c2c28,#4a4842)',
}
function lookOptionLabel(group, v, t) {
  const fallback = (LOOK_OPTIONS[group] || []).find(o => o.v === v)?.label || v
  return t ? t(`ais.look_opt.${group}.${v}`, fallback) : fallback
}
function lookPreviewGradient(l)    { return LOOK_GRADE_GRADIENTS[l?.color_grade] || LOOK_GRADE_GRADIENTS.neutral }
function lookThumbStyle(l) {
  return l?.ref_image_url
    ? { backgroundImage:`url('${toDisplayUrl(l.ref_image_url)}')`, backgroundSize:'cover', backgroundPosition:'center' }
    : { background: lookPreviewGradient(l) }
}
function lookDescLine(l, t) {
  if (!l) return ''
  return [lookOptionLabel('lighting', l.lighting, t), lookOptionLabel('setting', l.setting, t), lookOptionLabel('mood', l.mood, t)]
    .filter(Boolean).join(' · ')
}

// Model attribute vocabulary — matches the real /boutique/ai-studio/models schema (skin/age/body/hair/pose).
const MODEL_OPTIONS = {
  skin: ['Pale','Light','Mediterranean','Olive','Brown','Deep brown','Dark'],
  age:  ['18-22','22-28','28-32','32-40','40-48','48-60','60+'],
  body: ['Petite','Slim','Athletic','Mid-size','Curve','Plus','Tall'],
  hair: ['Dark · long','Dark · short','Brown · medium','Blonde · long','Red · medium','Grey · bob','Black · curly','Natural texture · short'],
  pose: ['Relaxed','Editorial · static','Confident stride','Candid · in motion','Quiet · contemplative'],
}

// Reference-photo library used purely to render a "representative preview" photo for a
// model brief (skin/age/body/hair combination) — never sent to the AI generation itself.
const PERSONAS = [
  { id:'ab-default',      name:'Sartoria Belloni · house', photo:'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80&fit=crop&crop=faces', skin:'Mediterranean', age:'28-32', body:'Athletic',  hair:'Dark · long',                   region:'Mediterranean Italian' },
  { id:'sicilian',        name:'Southern Italian',          photo:'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&q=80&fit=crop&crop=faces', skin:'Olive',         age:'22-28', body:'Slim',      hair:'Black · curly',                 region:'Sicilian' },
  { id:'european-mature', name:'Editorial · mature',        photo:'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=80&fit=crop&crop=faces', skin:'Light',       age:'40-48', body:'Slim',      hair:'Grey · bob',                    region:'Northern European' },
  { id:'east-african',    name:'East African',              photo:'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80&fit=crop&crop=faces', skin:'Deep brown',  age:'25-32', body:'Tall',      hair:'Natural texture · short',       region:'East African' },
  { id:'northern-eu',     name:'Northern European',         photo:'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&q=80&fit=crop&crop=faces', skin:'Pale',        age:'28-32', body:'Slim',      hair:'Blonde · long',                 region:'Nordic' },
  { id:'east-asian',      name:'East Asian',                photo:'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=80&fit=crop&crop=faces', skin:'Light',       age:'22-28', body:'Petite',    hair:'Dark · long',                   region:'East Asian' },
  { id:'middle-eastern',  name:'Middle Eastern',            photo:'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80&fit=crop&crop=faces', skin:'Olive',       age:'25-32', body:'Mid-size',  hair:'Dark · long',                   region:'Middle Eastern' },
  { id:'south-asian',     name:'South Asian',               photo:'https://images.unsplash.com/photo-1601412436009-d964bd02edbc?w=400&q=80&fit=crop&crop=faces', skin:'Brown',       age:'28-32', body:'Curve',     hair:'Brown · medium',                region:'South Asian' },
  { id:'afro-european',   name:'Afro-European',             photo:'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&q=80&fit=crop&crop=faces', skin:'Brown',       age:'25-32', body:'Athletic',  hair:'Black · curly',                 region:'Afro-European' },
  { id:'latin-american',  name:'Latin American',            photo:'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80&fit=crop&crop=faces', skin:'Olive',       age:'28-32', body:'Curve',     hair:'Brown · medium',                region:'Latin American' },
]

function attrDist(a, b, order) {
  if (a === b) return 0
  const ia = order.indexOf(a), ib = order.indexOf(b)
  if (ia === -1 || ib === -1) return 2
  return Math.abs(ia - ib)
}
function personaDistance(brief, persona) {
  const skinD = attrDist(brief.skin, persona.skin, MODEL_OPTIONS.skin) * 3.0
  const ageD  = attrDist(brief.age,  persona.age,  MODEL_OPTIONS.age)  * 1.5
  const bodyD = attrDist(brief.body, persona.body, MODEL_OPTIONS.body) * 1.0
  const hairD = brief.hair === persona.hair ? 0 : 0.7
  return skinD + ageD + bodyD + hairD
}
function matchPersona(brief) {
  let best = PERSONAS[0], bestDist = Infinity
  for (const p of PERSONAS) {
    const d = personaDistance(brief, p)
    if (d < bestDist) { bestDist = d; best = p }
  }
  return { persona: best, distance: bestDist, exactMatch: bestDist === 0 }
}
function modelInitials(name) { return (name || '').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || '??' }
function modelTraitsLine(m) { return [m?.skin, m?.age, m?.body, m?.hair].filter(Boolean).join(' · ') }

// Pose vocabulary for the batch "Poses per product" picker — maps directly to the `poses`
// string array the real /boutique/ai-studio/generate endpoint expects. Library/presets are
// session-local (no backend endpoint for custom poses yet), same treatment as everything else
// that has no confirmed persistence contract.
const POSE_CAP = 4
const POSE_LIBRARY_DEFAULT = [
  { id:'three-quarter', name:'Three-quarter', desc:'Angled hero shot · leads the listing', builtin:true },
  { id:'full-body',     name:'Full body',     desc:'Head-to-toe · silhouette & length',    builtin:true },
  { id:'detail',        name:'Detail crop',   desc:'Close on fabric, drape, or feature',    builtin:true },
  { id:'back',          name:'Back view',     desc:'Rear of the garment · coats, dresses',  builtin:true },
  { id:'seated',        name:'Seated',        desc:'Relaxed, editorial · lifestyle feel',   builtin:true },
  { id:'walking',       name:'Walking',       desc:'In motion · movement & drape',           builtin:true },
]
const POSE_PRESETS_DEFAULT = [
  { id:'editorial-trio', name:'Editorial trio', poseIds:['three-quarter','full-body','detail'],          builtin:true },
  { id:'ecommerce',      name:'E-commerce set', poseIds:['three-quarter','back','detail'],                builtin:true },
  { id:'lookbook',       name:'Lookbook',       poseIds:['three-quarter','full-body','walking','detail'], builtin:true },
]
const POSE_QUICK_ORDER = ['three-quarter','full-body','detail','back','walking','seated']

// Generations store pose ids; render the library's label when we recognise one,
// otherwise fall back to the raw id (custom poses are session-local).
function poseLabel(id, t) {
  if (!id) return ''
  const fallback = POSE_LIBRARY_DEFAULT.find(p => p.id === id)?.name || id
  return t ? t(`ais.pose_lib.${id}.name`, fallback) : fallback
}

// Poll cadence for generation / batch status. FASHN shoots typically land in
// 20–60s, so a 2.5s tick keeps the modal responsive without hammering the API.
const POLL_MS = 2500

// ── Shared Sheet Component ────────────────────────────────
// `wide` opts a sheet into the roomier drawer needed for a two-panel body.
// Opt-in on purpose: every other sheet keeps the default 420px column.
function Sheet({ t, open, onClose, tag, title, sub, children, foot, confirmLabel, onConfirm, hideConfirm, confirmDisabled, wide }) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet${wide ? ' sheet-wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="sheet-hdr">
          <div>
            <div className="sheet-tag">{tag}</div>
            <div className="sheet-title" dangerouslySetInnerHTML={{__html: title}} />
            {sub && <div className="sheet-sub">{sub}</div>}
          </div>
          <div className="sheet-close" onClick={onClose}><span className="material-symbols-outlined">close</span></div>
        </div>
        <div className="sheet-body">{children}</div>
        <div className="sheet-foot">
          <div className="sheet-foot-note" dangerouslySetInnerHTML={{__html: foot || ''}} />
          <button className="btn btn-outline" onClick={onClose}>{t('ais.common.cancel', 'Cancel')}</button>
          {!hideConfirm && <button className="btn btn-primary" onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel || t('ais.common.apply', 'Apply')}</button>}
        </div>
      </div>
    </div>
  )
}

// ── Studio Look Editor (create + edit) ────────────────────
// Fields map 1:1 to POST/PUT /boutique/ai-studio/looks. Reference-image upload has
// no backend endpoint yet, so that zone is display-only (shows ref_image_url when
// already set on the server record, but cannot upload a new one from here).
function LookEditorSheet({ t, open, onClose, editingLook, createLook, updateLook, deleteLook, createLookWithPhoto, updateLookWithPhoto, show, onSaved, onDeleted }) {
  const isEdit = !!editingLook

  const [name,       setName]       = useState('')
  const [lighting,   setLighting]   = useState('window')
  const [setting,    setSetting]    = useState('studio-white')
  const [mood,       setMood]       = useState('clean')
  const [colorGrade, setColorGrade] = useState('neutral')
  const [palette,    setPalette]    = useState('neutral')
  const [intensity,  setIntensity]  = useState(50)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  // Optional reference image — anchors the mood in the preview card. Mirrors the
  // model-photo picker exactly; the backend parses multipart on looks too.
  const [refUrl,      setRefUrl]      = useState('')
  const [refFile,     setRefFile]     = useState(null)
  const [refPreview,  setRefPreview]  = useState('')
  const [changingRef, setChangingRef] = useState(false)
  const [linkMode,    setLinkMode]    = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setRefUrl(editingLook?.ref_image_url || '')
    setRefFile(null); setRefPreview(''); setChangingRef(false); setLinkMode(false)
    if (editingLook) {
      setName(editingLook.name || '')
      setLighting(editingLook.lighting || 'window')
      setSetting(editingLook.setting || 'studio-white')
      setMood(editingLook.mood || 'clean')
      setColorGrade(editingLook.color_grade || 'neutral')
      setPalette(editingLook.palette || 'neutral')
      setIntensity(typeof editingLook.intensity === 'number' ? editingLook.intensity : 50)
    } else {
      setName(''); setLighting('window'); setSetting('studio-white'); setMood('clean')
      setColorGrade('neutral'); setPalette('neutral'); setIntensity(50)
    }
    setError('')
  }, [open, editingLook])

  if (!open) return null

  // The preview card shows whatever is picked right now, not just what's saved.
  const heroRefImage = refPreview || toDisplayUrl(refUrl.trim())
  const hasRef       = !!(refFile || refUrl.trim())
  const pickerOpen   = !isEdit || !refUrl.trim() || changingRef || !!refFile
  const previewLook  = { name, lighting, setting, mood, color_grade:colorGrade, palette, intensity, ref_image_url: heroRefImage || null }

  async function handlePickRef(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (!PHOTO_TYPES.includes(file.type)) { setError(t('ais.photo.err_type', 'Choose a JPEG, PNG, or WebP image.')); return }
    if (file.size > PHOTO_MAX_BYTES) {
      setError(t('ais.photo.err_size', 'That file is {{mb}}MB — the limit is 10MB.', { mb: (file.size/1024/1024).toFixed(1) })); return
    }
    const info = await inspectPhoto(file)
    if (refPreview) URL.revokeObjectURL(refPreview)
    setRefFile(file)
    setRefPreview(info.url)
    setLinkMode(false)
  }

  function clearRef() {
    if (refPreview) URL.revokeObjectURL(refPreview)
    setRefFile(null); setRefPreview('')
  }

  async function handleSave() {
    if (!name.trim()) { setError(t('ais.look_sheet.err_name', 'Give the look a name before saving.')); return }
    setSaving(true)
    setError('')
    const body = {
      name: name.trim(),
      description: lookDescLine(previewLook, t),
      lighting, setting, mood,
      color_grade: colorGrade,
      palette, intensity,
      is_default: editingLook?.is_default || false,
    }
    const link = refUrl.trim()
    const res = refFile
      ? (isEdit ? await updateLookWithPhoto(editingLook.id, body, refFile)
                : await createLookWithPhoto(body, refFile))
      : (isEdit ? await updateLook(editingLook.id, { ...body, ref_image_url: link || null })
                : await createLook({ ...body, ref_image_url: link || null }))
    setSaving(false)
    if (res.success) {
      show(res.message || (isEdit ? t('ais.look_sheet.toast_updated', 'Studio look updated') : t('ais.look_sheet.toast_created', 'Studio look created')), 'success')
      onSaved && onSaved(res.data)
      onClose()
    } else {
      setError(res.message || t('ais.look_sheet.err_save', 'Failed to save look.'))
    }
  }

  async function handleDelete() {
    if (!editingLook || !deleteLook) return
    setSaving(true)
    const res = await deleteLook(editingLook.id)
    setSaving(false)
    if (res.success) {
      show(t('ais.look_sheet.toast_removed', 'Studio look removed'), 'success')
      onDeleted && onDeleted()
      onClose()
    } else {
      setError(res.message || t('ais.look_sheet.err_delete', 'Failed to delete look.'))
    }
  }

  const segs = (group, val, setter) => LOOK_OPTIONS[group].map(o => (
    <button type="button" key={o.v} className={`look-seg${val===o.v?' on':''}`} onClick={() => setter(o.v)}>{o.label}</button>
  ))

  return (
    <Sheet
      t={t}
      open={open}
      onClose={onClose}
      tag={isEdit ? t('ais.look_sheet.tag_edit', 'EDIT · STUDIO LOOK') : t('ais.look_sheet.tag_new', 'NEW · STUDIO LOOK')}
      title={isEdit ? t('ais.look_sheet.title_edit', 'Refine <em>look</em>') : t('ais.look_sheet.title_new', 'Create a <em>look</em>')}
      sub={t('ais.look_sheet.sub', 'Define the light, setting, mood, grade, and palette. The preview reflects your choices.')}
      confirmLabel={saving ? t('ais.common.saving', 'Saving…') : (isEdit ? t('ais.look_sheet.save_changes', 'Save changes') : t('ais.look_sheet.create', 'Create look'))}
      onConfirm={handleSave}
      confirmDisabled={saving}
      wide
    >
      <div className="look-editor">
        <div className="look-editor-preview">
          <div className="look-preview-label">{t('ais.look_sheet.live_preview', 'Live preview')}</div>
          <div className="look-preview-card" style={{background: lookPreviewGradient(previewLook)}}>
            {previewLook.ref_image_url && <div className="look-preview-ref" style={{backgroundImage:`url('${previewLook.ref_image_url}')`}} />}
            <div className="look-preview-name">{name || t('ais.look_sheet.untitled', 'Untitled look')}</div>
            <div className="look-preview-chips">
              <span className="look-chip">{lookOptionLabel('lighting', lighting, t)}</span>
              <span className="look-chip">{lookOptionLabel('setting', setting, t)}</span>
              <span className="look-chip">{lookOptionLabel('mood', mood, t)}</span>
              <span className="look-chip">{t('ais.look_sheet.grade_chip', '{{grade}} grade', { grade: lookOptionLabel('color_grade', colorGrade, t) })}</span>
              <span className="look-chip look-chip-int">{t('ais.look_sheet.intensity_chip', 'intensity {{n}}', { n: intensity })}</span>
              <span className="look-chip-pal">{LOOK_OPTIONS.palette.find(p=>p.v===palette)?.swatch.map((c,i) => <i key={i} style={{background:c}} />)}</span>
            </div>
          </div>
          <div className="look-preview-note">{t('ais.look_sheet.preview_note', 'This preview is illustrative. Final generations apply the look through Mi Italia AI.')}</div>
        </div>
        <div className="look-editor-form">
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.look_sheet.name_pre', 'Look')} <em>{t('ais.look_sheet.name_em', 'name')}</em></div>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{width:'100%',padding:'10px 13px',border:'1.5px solid var(--mist)',borderRadius: 0,fontSize:11.5,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
              placeholder={t('ais.look_sheet.name_ph', "e.g. 'Brera afternoon'")} />
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.look_sheet.lighting', 'Lighting')}</div>
            <div className="look-segs">{segs('lighting', lighting, setLighting)}</div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.look_sheet.setting', 'Setting')}</div>
            <div className="look-segs">{segs('setting', setting, setSetting)}</div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.look_sheet.mood', 'Mood')}</div>
            <div className="look-segs">{segs('mood', mood, setMood)}</div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.look_sheet.color_grade', 'Colour grade')}</div>
            <div className="look-segs">{segs('color_grade', colorGrade, setColorGrade)}</div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.look_sheet.palette', 'Palette')}</div>
            <div className="look-pals">
              {LOOK_OPTIONS.palette.map(o => (
                <button type="button" key={o.v} className={`look-pal${palette===o.v?' on':''}`} onClick={() => setPalette(o.v)} title={lookOptionLabel('palette', o.v, t)}>
                  <span className="look-pal-sw">{o.swatch.map((c,i) => <i key={i} style={{background:c}} />)}</span>
                  <span className="look-pal-lb">{lookOptionLabel('palette', o.v, t)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.look_sheet.intensity', 'Intensity')} <span style={{color:'var(--gold-dk,#8A6A30)',fontWeight:700}}>{intensity}</span></div>
            <input type="range" min="0" max="100" value={intensity} className="look-range" onChange={e => setIntensity(parseInt(e.target.value, 10))} />
            <div className="look-range-ends"><span>{t('ais.look_sheet.subtle', 'Subtle')}</span><span>{t('ais.look_sheet.bold', 'Bold')}</span></div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.look_sheet.ref_image', 'Reference image')} <span style={{color:'var(--stone)',fontWeight:400,textTransform:'none',letterSpacing:0}}>{t('ais.look_sheet.ref_image_note', 'optional, anchors the mood')}</span></div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{display:'none'}} onChange={handlePickRef} />

            {!pickerOpen && (
              <div style={{padding:'10px 12px',background:'var(--cream)',border:'1px solid var(--mist)'}}>
                <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:8}}>
                  <div style={{width:40,height:40,flexShrink:0,background:`url('${heroRefImage}') center/cover`,border:'1px solid var(--mist)'}} />
                  <div style={{flex:1,minWidth:0,fontSize:10,color:'var(--stone)',lineHeight:1.4}}>{t('ais.look_sheet.has_ref', 'This look has a reference image on file.')}</div>
                </div>
                <button type="button" className="btn btn-outline btn-sm" style={{width:'100%'}} onClick={() => setChangingRef(true)}>
                  <span className="material-symbols-outlined">swap_horiz</span>{t('ais.look_sheet.change_image', 'Change image')}
                </button>
              </div>
            )}

            {pickerOpen && !refFile && !linkMode && (
              <div className="look-ref" onClick={() => fileRef.current?.click()}>
                <span className="material-symbols-outlined" style={{fontSize:22,color:'var(--gold)'}}>add_photo_alternate</span>
                <div style={{fontSize:11,fontWeight:600,marginTop:5}}>{t('ais.look_sheet.upload_ref', 'Upload a reference image')}</div>
                <div style={{fontSize:9,color:'var(--stone)',marginTop:3}}>{t('ais.photo.filetypes', 'JPEG, PNG, or WebP · up to 10MB')}</div>
              </div>
            )}

            {pickerOpen && refFile && (
              <div className="look-ref has-file" style={{cursor:'default',textAlign:'left'}}>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <div style={{width:40,height:40,flexShrink:0,background:`url('${refPreview}') center/cover`,border:'1px solid var(--mist)'}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{refFile.name}</div>
                    <div style={{fontSize:9.5,color:'var(--stone)',marginTop:2}}>{t('ais.model_sheet.uploads_on_save', '{{mb}}MB · uploads when you save', { mb: (refFile.size/1024/1024).toFixed(1) })}</div>
                  </div>
                  <span className="material-symbols-outlined" style={{cursor:'pointer',color:'var(--stone)'}} onClick={clearRef}>close</span>
                </div>
              </div>
            )}

            {pickerOpen && linkMode && (
              <input value={refUrl} onChange={e=>setRefUrl(e.target.value)}
                style={{width:'100%',padding:'10px 13px',border:'1.5px solid var(--mist)',borderRadius:0,fontSize:11.5,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
                placeholder={t('ais.look_sheet.link_ph', 'https://… link to a reference image')} />
            )}

            {pickerOpen && !refFile && (
              <button type="button" onClick={() => setLinkMode(m => !m)}
                style={{background:'none',border:'none',padding:0,marginTop:8,fontSize:10,fontWeight:600,color:'var(--gold)',cursor:'pointer',fontFamily:'inherit'}}>
                {linkMode ? t('ais.look_sheet.use_upload', '← Upload a file instead') : t('ais.look_sheet.use_link', 'Or paste a link instead →')}
              </button>
            )}
          </div>
          {error && (
            <div className="alert alert-red" style={{marginTop:4}}>
              <span className="material-symbols-outlined">error</span>{error}
            </div>
          )}
          {/* Destructive + default-state actions sit at the end of the form,
              matching the house model editor. */}
          {isEdit && !editingLook.is_default && deleteLook && (
            <button type="button" className="look-danger" onClick={handleDelete} disabled={saving}>
              <span className="material-symbols-outlined">delete</span>{t('ais.look_sheet.delete', 'Delete this look')}
            </button>
          )}
          {isEdit && editingLook.is_default && (
            <div className="look-default-note">
              <span className="material-symbols-outlined">star</span>{t('ais.look_sheet.default_note', 'Default look, used by Quick Generate. Set another as default to delete this one.')}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}

// ── Processing Modal ──────────────────────────────────────
// Purely presentational — the caller polls the API and feeds it real state.
// `progressPct` is only passed for batches, where the API reports item counts;
// a single generation has no granular progress, so it shows elapsed time and
// the scanning hero instead of inventing a percentage.
function ProcessingModal({ t, open, hero, lead, em, statusLine, progressPct, note, onCancel, cancelDisabled, cancelLabel }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!open) { setElapsed(0); return }
    setElapsed(0)
    const started = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(t)
  }, [open])

  if (!open) return null

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2,'0')}`

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(26,18,9,0.7)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'var(--white)',borderRadius: 0,width:380,overflow:'hidden',boxShadow:'0 20px 60px rgba(26,18,9,0.3)'}}>
        <div style={{height:200,background:hero?`url('${hero}') center/cover`:'linear-gradient(135deg,#2a2018,#4a4038)',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:'linear-gradient(90deg,transparent,var(--gold),transparent)',animation:'scan 2s linear infinite'}} />
          <div style={{position:'absolute',inset:0,background:'rgba(26,18,9,0.4)'}} />
        </div>
        <div style={{padding:'24px 28px'}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:500,marginBottom:6}}>
            {lead} <em style={{color:'var(--gold)',fontStyle:'italic'}}>{em}</em>…
          </div>
          <div style={{fontSize:11,color:'var(--stone)',marginBottom:14}}>{statusLine}</div>
          {typeof progressPct === 'number' && (
            <div style={{height:5,background:'var(--mist)',borderRadius: 0,overflow:'hidden',marginBottom:8}}>
              <div style={{height:'100%',background:'linear-gradient(90deg,var(--gold),var(--gold-light))',borderRadius: 0,width:`${progressPct}%`,transition:'width 0.3s ease'}} />
            </div>
          )}
          <div style={{fontSize:10,color:'var(--stone)',marginBottom:16}}>{t('ais.processing.elapsed', 'Elapsed {{mmss}}', { mmss })}{note ? ` · ${note}` : ''}</div>
          <button style={{fontSize:10,color:'var(--stone)',background:'none',border:'none',cursor:cancelDisabled?'default':'pointer',opacity:cancelDisabled?0.5:1}}
            onClick={onCancel} disabled={cancelDisabled}>
            {cancelDisabled ? t('ais.processing.cancelling', 'Cancelling…') : (cancelLabel || t('ais.common.cancel', 'Cancel'))}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Results Modal ─────────────────────────────────────────
const RETOUCH_TOOLS = [
  { tool:'lighting',   icon:'brightness_6', name:'Lighting',       desc:'Warmer, cooler, brighter, more contrast', placeholder:'e.g. "warmer, slightly brighter"' },
  { tool:'crop',       icon:'crop',         name:'Crop & reframe', desc:'Adjust composition without re-generating', placeholder:'e.g. "tighter crop, centre the hem"' },
  { tool:'artefact',   icon:'healing',      name:'Remove artefact',desc:'Describe the glitch — the AI repaints it',  placeholder:'e.g. "remove the smudge on the left sleeve"' },
  { tool:'background', icon:'format_paint', name:'Background',     desc:'Describe the background you want instead',  placeholder:'e.g. "a warm minimalist studio wall"' },
]

// POST /generations/:id/retouch replaces output_url/output_urls in place with a
// new `-retouch-<ts>.png` file. Only `lighting` is confirmed server-side; the
// other three are offered optimistically and surface the API's error if rejected.
function RetouchSheet({ t, open, onClose, generation, variantIndex, retouchGeneration, quota, show, onRetouched }) {
  const [activeToolIdx, setActiveToolIdx] = useState(0)
  const [instruction,   setInstruction]   = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  useEffect(() => {
    if (!open) return
    setActiveToolIdx(0); setInstruction(''); setError('')
  }, [open, variantIndex])

  if (!open) return null

  const outputs = generationOutputs(generation)
  const image   = outputs[variantIndex] || outputs[0] || null
  const active  = RETOUCH_TOOLS[activeToolIdx]

  async function handleSave() {
    if (!instruction.trim()) { setError(t('ais.retouch.err_instruction', 'Describe the adjustment you want.')); return }
    setSaving(true); setError('')
    const res = await retouchGeneration(generation.id, {
      tool: active.tool,
      instruction: instruction.trim(),
      variantIndex,
    })
    setSaving(false)
    if (res.success) {
      show(res.message || t('ais.retouch.toast_saved', 'Retouch saved'), 'success')
      onRetouched && onRetouched(res.data)
      onClose()
    } else {
      setError(res.message || t('ais.retouch.err_failed', 'Retouch failed.'))
    }
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',justifyContent:'flex-end'}} onClick={onClose}>
      <div style={{width:420,background:'var(--white)',height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-8px 0 40px rgba(26,18,9,0.12)',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div className="sheet-hdr">
          <div>
            <div className="sheet-tag">{t('ais.retouch.tag', 'RETOUCH · VARIANT {{n}}', { n: variantIndex+1 })}</div>
            <div className="sheet-title">{t('ais.retouch.title_pre', 'Retouch')} <em>{t('ais.retouch.title_em', 'variant {{n}}', { n: variantIndex+1 })}</em></div>
            <div className="sheet-sub">{t('ais.retouch.sub', 'Tweak the generated image before publishing. Retouches replace the stored file — the shoot brief itself is untouched.')}</div>
          </div>
          <div className="sheet-close" onClick={onClose}><span className="material-symbols-outlined">close</span></div>
        </div>
        <div className="sheet-body">
          <div style={{width:'100%',aspectRatio:'3/4',background:image?`url('${image}') center/cover`:'var(--cream)',borderRadius: 0,marginBottom:20,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {!image && <div style={{fontSize:11,color:'var(--stone)'}}>{t('ais.retouch.no_image', 'No image on this variant yet')}</div>}
          </div>

          <div className="sheet-section-label" style={{marginBottom:10}}>{t('ais.retouch.tools_pre', 'Retouch')} <em>{t('ais.retouch.tools_em', 'tools')}</em></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
            {RETOUCH_TOOLS.map((rt,i) => (
              <div key={rt.tool} onClick={() => setActiveToolIdx(i)}
                style={{padding:'14px',background:activeToolIdx===i?'rgba(184,149,90,0.08)':'var(--cream)',border:`1.5px solid ${activeToolIdx===i?'var(--gold)':'var(--mist)'}`,borderRadius: 0,cursor:'pointer',transition:'all 0.15s'}}>
                <div style={{width:32,height:32,borderRadius: 0,background:activeToolIdx===i?'rgba(184,149,90,0.15)':'var(--white)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8}}>
                  <span className="material-symbols-outlined" style={{fontSize:16,color:'var(--gold)'}}>{rt.icon}</span>
                </div>
                <div style={{fontSize:11.5,fontWeight:700,marginBottom:3}}>{t(`ais.retouch_tool.${rt.tool}.name`, rt.name)}</div>
                <div style={{fontSize:9.5,color:'var(--stone)',lineHeight:1.4}}>{t(`ais.retouch_tool.${rt.tool}.desc`, rt.desc)}</div>
              </div>
            ))}
          </div>

          <div className="sheet-section-label" style={{marginBottom:8}}>{t('ais.retouch.instruction_pre', 'Your')} <em>{t('ais.retouch.instruction_em', 'instruction')}</em></div>
          <textarea value={instruction} onChange={e => setInstruction(e.target.value)} rows={3} placeholder={t(`ais.retouch_tool.${active.tool}.placeholder`, active.placeholder)}
            style={{width:'100%',padding:'10px 12px',border:'1.5px solid var(--mist)',borderRadius: 0,fontSize:11,fontFamily:'inherit',lineHeight:1.5,resize:'none',outline:'none',boxSizing:'border-box',marginBottom:14}} />

          {error && (
            <div className="alert alert-red" style={{marginBottom:14}}>
              <span className="material-symbols-outlined">error</span>{error}
            </div>
          )}

          <div style={{padding:'13px 14px',background:'rgba(184,149,90,0.06)',borderRadius: 0,fontSize:11,lineHeight:1.5,color:'var(--deep)'}}>
            <strong>{t('ais.retouch.fresh_take_q', 'Prefer a fresh take?')}</strong> {t('ais.retouch.fresh_take_note', 'Use the tools above for fine adjustments, or hit Regenerate to run the whole shoot again')}
            {quota ? <> — {t('ais.retouch.fresh_take_cost', 'that costs')} <strong>{t('ais.retouch.fresh_take_cost_n', '1 of {{n}}', { n: Math.max(0, (quota.limit ?? 0) - (quota.used ?? 0)) })}</strong> {t('ais.retouch.fresh_take_remaining', 'remaining')}</> : null}.
          </div>
        </div>
        <div className="sheet-foot">
          <div className="sheet-foot-note">{t('ais.retouch.foot_pre', 'Retouch')} <strong>{t('ais.retouch.foot_em', 'does not cost quota')}</strong> {t('ais.retouch.foot_post', '— only Regenerate does.')}</div>
          <button className="btn btn-outline" onClick={onClose}>{t('ais.common.cancel', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('ais.retouch.saving', 'Retouching…') : t('ais.retouch.save', 'Save retouched')}</button>
        </div>
      </div>
    </div>
  )
}

function SocialSheet({ t, open, onClose }) {
  if (!open) return null
  const CHANNELS = [
    {icon:'photo_camera', name:'Instagram', note:'Meta App Review · 12+ weeks'},
    {icon:'music_video',  name:'TikTok',    note:'Scoped after Instagram'},
    {icon:'push_pin',     name:'Pinterest', note:'Tell us if this is a priority'},
  ]
  return (
    <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',justifyContent:'flex-end'}} onClick={onClose}>
      <div style={{width:420,background:'var(--white)',height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-8px 0 40px rgba(26,18,9,0.12)',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div className="sheet-hdr">
          <div>
            <div className="sheet-tag">{t('ais.social.tag', 'PREVIEW · COMING SOON')}</div>
            <div className="sheet-title">{t('ais.social.title_pre', 'Schedule')} <em>{t('ais.social.title_em', 'social posts')}</em></div>
            <div className="sheet-sub">{t('ais.social.sub', 'Cross-posting from AI Model Studio to social platforms is coming. Below is the planned experience.')}</div>
          </div>
          <div className="sheet-close" onClick={onClose}><span className="material-symbols-outlined">close</span></div>
        </div>
        <div className="sheet-body">
          <div style={{background:'rgba(184,149,90,0.08)',border:'1px solid rgba(184,149,90,0.25)',borderRadius: 0,padding:'13px 15px',fontSize:11,lineHeight:1.6,marginBottom:18,display:'flex',gap:10,alignItems:'flex-start'}}>
            <span className="material-symbols-outlined" style={{fontSize:16,flexShrink:0,color:'var(--gold)'}}>schedule_send</span>
            <div><strong>{t('ais.social.dev_bold', 'Direct social posting is in development.')}</strong> {t('ais.social.dev_note', 'Instagram (Meta App Review), TikTok and Pinterest will arrive in stages. For now,')} <strong>{t('ais.social.save_gallery', 'Save to gallery')}</strong> {t('ais.social.dev_note2', 'and download to post manually.')}</div>
          </div>
          <div className="sheet-section-label" style={{marginBottom:10}}>{t('ais.social.posting_pre', 'Posting')} <em>{t('ais.social.posting_em', 'to')}</em></div>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:18}}>
            {CHANNELS.map(c => (
              <div key={c.name} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--cream)',borderRadius: 0,opacity:0.7}}>
                <span className="material-symbols-outlined" style={{color:'var(--stone)',fontSize:18}}>{c.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600}}>{c.name}</div>
                  <div style={{fontSize:9.5,color:'var(--stone)'}}>{t(`ais.social_channel.${c.name}`, c.note)}</div>
                </div>
                <div style={{fontSize:7,fontWeight:700,letterSpacing:'0.8px',background:'var(--mist)',color:'var(--stone)',padding:'2px 6px',borderRadius: 0}}>{t('ais.social.coming_soon', 'COMING SOON')}</div>
              </div>
            ))}
          </div>
          <div className="sheet-section-label" style={{marginBottom:8}}>{t('ais.social.caption_pre', 'Caption')} <em>{t('ais.social.caption_em', 'preview')}</em></div>
          <textarea readOnly style={{width:'100%',padding:'10px 12px',background:'var(--cream)',border:'1px solid var(--mist)',borderRadius: 0,fontSize:11,fontFamily:'inherit',lineHeight:1.5,resize:'none',opacity:0.7,marginBottom:10}} rows={4} defaultValue="Silk midi in Bordeaux. SS26 collection · made in Italy. Sizes 38–46 available in store and at miitalia.com/atelier-bianchi" />
          <input readOnly style={{width:'100%',padding:'10px 12px',background:'var(--cream)',border:'1px solid var(--mist)',borderRadius: 0,fontSize:11,fontFamily:'inherit',opacity:0.7}} defaultValue="#atelierbianchi #miitalia #silkdress #ss26 #madeinitaly" />
          <div style={{fontSize:10,color:'var(--stone)',lineHeight:1.55,marginTop:8,fontStyle:'italic'}}>{t('ais.social.footnote', 'When social posting goes live, captions will be drafted from your product description and stay editable.')}</div>
        </div>
        <div className="sheet-foot">
          <div className="sheet-foot-note">{t('ais.social.foot_pre', 'For now:')} <strong>{t('ais.social.save_gallery', 'Save to gallery')}</strong>{t('ais.social.foot_post', ', then download to post manually.')}</div>
          <button className="btn btn-outline" onClick={onClose}>{t('ais.common.cancel', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={onClose}>{t('ais.social.save_instead', 'Save to gallery instead')}</button>
        </div>
      </div>
    </div>
  )
}

function ResultsModal({ t, open, onClose, generation, productName, quota, retouchGeneration, regenerateGeneration, saveToGallery, pushToProduct, show, onRegenerated, onUpdated, onPushed }) {
  const [selectedCards, setSelectedCards] = useState([0])
  const [showPublish,  setShowPublish]  = useState(false)
  const [showRetouch,  setShowRetouch]  = useState(false)
  const [retouchIdx,   setRetouchIdx]   = useState(0)
  const [showSocial,   setShowSocial]   = useState(false)
  const [busy,         setBusy]         = useState('')

  useEffect(() => { if (open) setSelectedCards([0]) }, [open, generation?.id])

  if (!open || !generation) return null

  const outputs = generationOutputs(generation)
  const poses   = Array.isArray(generation.poses) ? generation.poses : []
  const failure = generationError(generation)
  const brief   = generationBriefLine(generation)
  const heroName = productName || t('ais.results.shoot_fallback', 'shoot')

  const results = outputs.map((img, i) => ({
    img,
    pose: poseLabel(poses[i], t) || t('ais.results.variant_n', 'Variant {{n}}', { n: i+1 }),
    desc: brief,
  }))

  function toggleCard(i) {
    setSelectedCards(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  async function handleRegenerate() {
    setBusy('regenerate')
    const res = await regenerateGeneration(generation.id)
    setBusy('')
    if (res.success) {
      show(res.message || t('ais.results.toast_regen_started', 'Regeneration started'), 'success')
      onRegenerated && onRegenerated(res.data)
    } else {
      show(res.message || t('ais.results.err_regen', 'Could not start a regeneration'))
    }
  }

  async function handleSaveToGallery() {
    setBusy('gallery')
    const res = await saveToGallery(generation.id)
    setBusy('')
    if (res.success) { show(res.message || t('ais.results.toast_saved_gallery', 'Saved to gallery'), 'success'); onUpdated && onUpdated(res.data) }
    else show(res.message || t('ais.results.err_gallery', 'Could not save to gallery'))
  }

  // Pushes only the ticked variants onto the product gallery.
  async function handlePushToProduct() {
    const urls = selectedCards.map(i => outputs[i]).filter(Boolean)
    if (!urls.length) { show(t('ais.results.err_select_one', 'Select at least one variant to push.')); return }
    if (!generation.product_id) { show(t('ais.results.err_no_product', 'This shoot is not linked to a product.')); return }
    setBusy('push')
    const res = await pushToProduct(generation.product_id, urls)
    setBusy('')
    if (res.success) {
      show(res.message || t('ais.results.toast_pushed', '{{count}} image(s) added to the product', { count: urls.length }), 'success')
      setShowPublish(false)
      onPushed && onPushed()
    } else {
      show(res.message || t('ais.results.err_push', 'Could not push to the product'))
    }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(26,18,9,0.7)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:24,overflowY:'auto'}}>
      <div style={{background:'var(--white)',borderRadius: 0,width:'100%',maxWidth:900,boxShadow:'0 20px 60px rgba(26,18,9,0.3)'}}>
        {/* Head */}
        <div style={{padding:'24px 28px',borderBottom:'1px solid var(--mist)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:14}}>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:500}}>
              {results.length ? `${t('ais.results.head_takes', '{{count}} take(s) of your', { count: results.length })} ` : `${t('ais.results.head_shoot_of', 'Your shoot of')} `}
              <em style={{color:'var(--gold)',fontStyle:'italic'}}>{heroName}</em>
            </div>
            <div style={{fontSize:11,color:'var(--stone)',marginTop:3}}>
              {failure ? t('ais.results.head_failed', 'This shoot did not complete.') : t('ais.results.head_ok', 'Pick a hero, retouch any variant, or run the shoot again.')}
            </div>
          </div>
          <div style={{width:32,height:32,borderRadius: 0,background:'var(--cream)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}} onClick={onClose}>
            <span className="material-symbols-outlined" style={{fontSize:18,color:'var(--stone)'}}>close</span>
          </div>
        </div>

        {/* Body */}
        <div style={{padding:'24px 28px'}}>
          {failure && (
            <div className="alert alert-red" style={{marginBottom:20}}>
              <span className="material-symbols-outlined">error</span>{failure}
            </div>
          )}

          {/* Result cards */}
          {results.length > 0 && (
            <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(3, results.length)},1fr)`,gap:16,marginBottom:28}}>
              {results.map((r,i) => (
                <div key={i} onClick={() => toggleCard(i)}
                  style={{borderRadius: 0,border:`2px solid ${selectedCards.includes(i)?'var(--gold)':'var(--mist)'}`,overflow:'hidden',cursor:'pointer',background:'var(--white)',transition:'all 0.15s'}}>
                  <div style={{background:`url('${r.img}') center/cover`,aspectRatio:'3/4',position:'relative'}}>
                    <div style={{position:'absolute',top:8,right:8,width:22,height:22,borderRadius: 0,background:'rgba(255,255,255,0.95)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'var(--deep)'}}>{i+1}</div>
                  </div>
                  <div style={{padding:'11px 13px'}}>
                    <div style={{fontSize:11.5,fontWeight:700,marginBottom:2}}>{t('ais.results.variant_of_pose', 'Variant {{n}} · {{pose}}', { n: i+1, pose: r.pose })}</div>
                    <div style={{fontSize:9.5,color:'var(--stone)',marginBottom:8}}>{r.desc}</div>
                    <div style={{display:'flex',gap:6}}>
                      <div style={{flex:1,padding:'5px',background:'var(--cream)',borderRadius: 0,fontSize:9.5,fontWeight:600,textAlign:'center',cursor:'pointer'}}
                        onClick={e=>{e.stopPropagation();setRetouchIdx(i);setShowRetouch(true)}}>{t('ais.results.card_retouch', 'Retouch')}</div>
                      <a href={r.img} target="_blank" rel="noreferrer" download onClick={e=>e.stopPropagation()}
                        style={{flex:1,padding:'5px',background:'var(--cream)',borderRadius: 0,fontSize:9.5,fontWeight:600,textAlign:'center',cursor:'pointer',color:'var(--deep)',textDecoration:'none'}}>{t('ais.results.card_download', 'Download')}</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Post-gen actions */}
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:500,marginBottom:4}}>{t('ais.results.next_pre', "What's")} <em style={{color:'var(--gold)',fontStyle:'italic'}}>{t('ais.results.next_em', 'next')}</em>?</div>
            <div style={{fontSize:11,color:'var(--stone)',marginBottom:14}}>
              {results.length
                ? t('ais.results.selected_note', '{{count}} variant(s) selected. Pick how to use them — you can do more than one.', { count: selectedCards.length })
                : t('ais.results.no_results_note', 'Adjust the brief and run the shoot again.')}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
              {[
                { icon:'storefront',          key:'push',       name:t('ais.results.action.push.name', 'Push to product'),  desc:t('ais.results.action.push.desc', "Add the selected variants to this product's gallery."), primary:true, disabled:!results.length, onClick:()=>setShowPublish(true) },
                { icon:'tune',                key:'retouch',    name:t('ais.results.action.retouch.name', 'Retouch'),          desc:t('ais.results.action.retouch.desc', 'Tweak lighting, crop, or remove an artefact.'), disabled:!results.length, onClick:()=>{setRetouchIdx(0);setShowRetouch(true)} },
                { icon:'autorenew',           key:'regenerate', name:t('ais.results.action.regenerate.name', 'Regenerate'),       desc:t('ais.results.action.regenerate.desc', 'Run the whole shoot again on the same brief. Costs 1 quota unit.'), onClick:handleRegenerate,
                  label: busy==='regenerate' ? t('ais.results.action_starting', 'Starting…') : null },
                { icon:'collections_bookmark',key:'save',       name:t('ais.results.action.save.name', 'Save to gallery'),  desc:t('ais.results.action.save.desc', 'Mark this shoot as a keeper in your brand assets.'), disabled:!results.length||generation.saved_to_gallery, onClick:handleSaveToGallery,
                  label: generation.saved_to_gallery ? t('ais.results.action_saved', 'Saved to gallery') : (busy==='gallery' ? t('ais.results.action_saving', 'Saving…') : null) },
                // SocialSheet was fully built but unreachable — nothing called
                // setShowSocial. The comingSoon ribbon branch below already
                // existed and had never been used either.
                { icon:'share',               key:'social',     name:t('ais.results.action.social.name', 'Share to social'),  desc:t('ais.results.action.social.desc', 'Preview the planned Instagram/TikTok/Pinterest posting flow.'), comingSoon:true, disabled:!results.length, onClick:()=>setShowSocial(true) },
              ].map((a,i) => (
                <div key={i} onClick={() => !a.disabled && a.onClick()}
                  style={{position:'relative',padding:'16px 14px',background:a.primary?'var(--deep)':'var(--cream)',border:`1.5px solid ${a.primary?'var(--deep)':'var(--mist)'}`,borderRadius: 0,cursor:a.disabled?'default':'pointer',opacity:a.disabled?0.45:1,transition:'all 0.15s'}}>
                  {a.comingSoon && <div style={{position:'absolute',top:8,right:8,fontSize:7,fontWeight:700,letterSpacing:'0.8px',background:'var(--mist)',color:'var(--stone)',padding:'2px 5px',borderRadius: 0}}>{t('ais.social.coming_soon', 'COMING SOON')}</div>}
                  <div style={{width:36,height:36,borderRadius: 0,background:a.primary?'rgba(184,149,90,0.2)':'var(--white)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10}}>
                    <span className="material-symbols-outlined" style={{fontSize:18,color:'var(--gold)'}}>{a.icon}</span>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:4,color:a.primary?'var(--gold)':'var(--deep)'}}>{a.label || a.name}</div>
                  <div style={{fontSize:10,color:a.primary?'rgba(245,240,232,0.65)':'var(--stone)',lineHeight:1.5}}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Publish sheet — appends the ticked variants to the product gallery via
          POST /products/:id/photos/from-ai-studio. */}
      {showPublish && (
        <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',justifyContent:'flex-end'}} onClick={() => setShowPublish(false)}>
          <div style={{width:420,background:'var(--white)',height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-8px 0 40px rgba(26,18,9,0.12)'}} onClick={e=>e.stopPropagation()}>
            <div className="sheet-hdr">
              <div>
                <div className="sheet-tag">{t('ais.publish.tag', 'PUBLISH · TO PRODUCT')}</div>
                <div className="sheet-title">{t('ais.publish.title_pre', 'Push to')} <em>{heroName}</em></div>
                <div className="sheet-sub">{t('ais.publish.sub', "Adds the selected variants to this product's photo gallery. Existing photos are kept — nothing is replaced.")}</div>
              </div>
              <div className="sheet-close" onClick={()=>setShowPublish(false)}><span className="material-symbols-outlined">close</span></div>
            </div>
            <div className="sheet-body">
              <div className="sheet-section">
                <div className="sheet-section-label">{t('ais.publish.pushing', 'Pushing')} <em>{t('ais.publish.pushing_count', '{{sel}} of {{total}}', { sel: selectedCards.length, total: results.length })}</em> {t('ais.publish.variants', 'variants')}</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                  {results.map((r,i) => (
                    <div key={i} onClick={() => toggleCard(i)} style={{cursor:'pointer'}}>
                      <div style={{aspectRatio:'3/4',background:`url('${r.img}') center/cover`,borderRadius: 0,border:`2px solid ${selectedCards.includes(i)?'var(--gold)':'transparent'}`,opacity:selectedCards.includes(i)?1:0.5}} />
                      <div style={{fontSize:9,fontWeight:700,textAlign:'center',marginTop:5,color:selectedCards.includes(i)?'var(--gold)':'var(--stone)'}}>
                        {selectedCards.includes(i) ? t('ais.publish.included', 'INCLUDED') : t('ais.publish.skipped', 'SKIPPED')}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:'var(--stone)',lineHeight:1.5,marginTop:10}}>{t('ais.publish.tap_note', 'Tap a variant to include or skip it.')}</div>
              </div>
            </div>
            <div className="sheet-foot">
              <div className="sheet-foot-note">{t('ais.publish.foot_pre', 'Photos are appended to the gallery —')} <strong>{t('ais.publish.foot_em', 'nothing is overwritten')}</strong>.</div>
              <button className="btn btn-outline" onClick={()=>setShowPublish(false)}>{t('ais.common.cancel', 'Cancel')}</button>
              <button className="btn btn-primary" onClick={handlePushToProduct} disabled={busy==='push'||!selectedCards.length}>
                {busy==='push' ? t('ais.publish.pushing_btn', 'Pushing…') : t('ais.publish.push_n', 'Push {{n}} to product', { n: selectedCards.length })}
              </button>
            </div>
          </div>
        </div>
      )}

      <RetouchSheet
        t={t}
        open={showRetouch}
        onClose={()=>setShowRetouch(false)}
        generation={generation}
        variantIndex={retouchIdx}
        retouchGeneration={retouchGeneration}
        quota={quota}
        show={show}
        onRetouched={onUpdated}
      />
      <SocialSheet t={t} open={showSocial} onClose={()=>setShowSocial(false)} />
    </div>
  )
}

// ── Model Brief Editor (apply-to-shoot + save-as-preset) ──
// Hero preview uses matchPersona() purely for a representative stock photo — the persona_id
// sent on save is null (no confirmed backend persona vocabulary yet), same as Brand setup's
// existing Add Model sheet. Photo upload is display-only, no upload endpoint this pass.
function ModelBriefSheet({ t, open, onClose, models, modelsLoading, brief, createModel, show, onApply, onNavigateToBrand, tag, sub, foot }) {
  const [draftId,   setDraftId]   = useState(null)
  const [skin,      setSkin]      = useState('Mediterranean')
  const [age,       setAge]       = useState('28-32')
  const [body,      setBody]      = useState('Athletic')
  const [hair,      setHair]      = useState('Dark · long')
  const [pose,      setPose]      = useState('Editorial · static')
  const [presetName, setPresetName] = useState('')
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    if (!open) return
    setDraftId(brief?.id || null)
    setSkin(brief?.skin || 'Mediterranean')
    setAge(brief?.age || '28-32')
    setBody(brief?.body || 'Athletic')
    setHair(brief?.hair || 'Dark · long')
    setPose(brief?.pose || 'Editorial · static')
    setPresetName('')
  }, [open, brief])

  if (!open) return null

  const draft = { skin, age, body, hair, pose }
  const match = matchPersona(draft)
  const savedModel = draftId ? models.find(m => m.id === draftId) : null
  // A real uploaded photo beats the persona stand-in, and changes what the
  // caption below can honestly claim.
  const basePhoto = savedModel?.custom_photo_url ? toDisplayUrl(savedModel.custom_photo_url) : ''

  function pick(setter, key, value) {
    setter(value)
    // Straying from a saved model's exact attributes detaches it from that preset.
    if (draftId) {
      const saved = models.find(m => m.id === draftId)
      const next = { ...draft, [key]: value }
      if (!saved || ['skin','age','body','hair'].some(k => saved[k] !== next[k])) setDraftId(null)
    }
  }

  function pickSaved(m) {
    setDraftId(m.id)
    setSkin(m.skin || 'Mediterranean')
    setAge(m.age || '28-32')
    setBody(m.body || 'Athletic')
    setHair(m.hair || 'Dark · long')
    setPose(m.pose || 'Editorial · static')
  }

  async function handleSaveAsPreset() {
    if (!presetName.trim()) { show(t('ais.brief.err_name', 'Give the preset a name before saving.')); return }
    setSaving(true)
    const res = await createModel({ name: presetName.trim(), persona_id: null, skin, age, body, hair, pose, is_default: false })
    setSaving(false)
    if (res.success) { show(res.message || t('ais.brief.toast_saved', 'Preset saved'), 'success'); setPresetName('') }
    else show(res.message || t('ais.brief.err_save', 'Failed to save preset'))
  }

  function handleApply() {
    onApply({ id: draftId, skin, age, body, hair, pose })
    onClose()
  }

  const pillGroup = (key, val, setter) => MODEL_OPTIONS[key].map(v => (
    <button type="button" key={v} className={`opt-pill${val===v?' selected':''}`} onClick={() => pick(setter, key, v)}>{v}</button>
  ))

  return (
    <Sheet
      t={t}
      open={open}
      onClose={onClose}
      tag={tag || t('ais.brief.tag_default', 'EDIT · MODEL BRIEF')}
      title={t('ais.brief.title', 'Model <em>brief</em>')}
      sub={sub || t('ais.brief.sub_default', 'Tap a saved model or adjust attributes. The hero photo on the left updates as you go.')}
      confirmLabel={t('ais.brief.apply', 'Apply brief')}
      onConfirm={handleApply}
      foot={foot || t('ais.brief.foot_default', 'A model brief never overrides your editorial judgement, it just gives the AI a clear starting point.')}
      wide
    >
      <div className="model-editor">

      {/* Same two-panel shape as the house model and studio look editors:
          preview pinned left, everything you can change on the right. */}
      <div className="model-editor-preview">
        <div className="look-preview-label">{t('ais.look_sheet.live_preview', 'Live preview')}</div>
        <div className="model-hero-photo" style={{backgroundImage:`url('${basePhoto || match.persona.photo}')`}}>
          <div className="model-hero-photo-tag" style={basePhoto ? {background:'rgba(0,108,53,0.85)',color:'var(--cream)'} : undefined}>
            {basePhoto ? t('ais.brief.actual_photo', 'ACTUAL MODEL PHOTO') : t('ais.brief.representative_preview', 'REPRESENTATIVE PREVIEW')}
          </div>
        </div>
        <div className="model-editor-preview-body">
          {/* The persona/closest-match caption is misleading once a real photo
              is on file — the output really does follow that exact image. */}
          {!basePhoto && (
            <div className="model-hero-persona">{match.persona.region} · {match.exactMatch ? t('ais.brief.exact_match', 'exact match') : t('ais.brief.closest_match', 'closest match')}</div>
          )}
          <div className="model-hero-name">{savedModel ? savedModel.name : <>{t('ais.brief.custom_pre', 'Custom')} · <em>{match.persona.region}</em></>}</div>
          <div className="model-hero-traits">
            {[skin, age, body, hair, pose].filter(Boolean).map(trait => <span key={trait} className="model-hero-trait">{trait}</span>)}
          </div>
          <div className="model-hero-note">
            <span className="material-symbols-outlined">info</span>
            <span>{basePhoto
              ? t('ais.brief.note_has_photo', 'Your final output follows this exact photo, posed and dressed per the brief beside it.')
              : t('ais.brief.note_no_photo', 'Preview snaps to the closest match in our reference library. Your final output will follow this brief, not this exact face.')}</span>
          </div>
          {/* This sheet only picks and tweaks a brief for one shoot — photos
              belong to the saved model, so it points at Brand setup. */}
          <div className="hero-upload-row" onClick={onNavigateToBrand}>
            <label className="hero-upload-link" style={{cursor:'pointer'}}>
              <span className="material-symbols-outlined">add_a_photo</span>
              <span>{t('ais.brief.set_photo_brand', 'Set a model photo in Brand setup')}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="model-editor-form">

      <div className="sheet-section" style={{paddingBottom:8}}>
        <div className="sheet-section-label">{t('ais.brief.saved_models_pre', 'Saved')} <em>{t('ais.brief.saved_models_em', 'house models')}</em> · {t('ais.brief.tap_to_pick', 'tap to pick')}</div>
        <div className="persona-strip">
          {modelsLoading && models.length === 0 && <div className="brief-row-sub">{t('ais.brief.loading_models', 'Loading models…')}</div>}
          {models.map(m => (
            <div key={m.id} className={`persona-chip${draftId===m.id?' selected':''}`} onClick={() => pickSaved(m)}>
              <div className="persona-chip-photo"
                   style={m.custom_photo_url ? {backgroundImage:`url('${toDisplayUrl(m.custom_photo_url)}')`} : undefined}>
                {!m.custom_photo_url && <div className="persona-chip-photo-init">{modelInitials(m.name)}</div>}
                {m.is_default && <div className="persona-chip-default-mark">★</div>}
              </div>
              <div className="persona-chip-name">{m.name.replace(/·.*/,'').trim()}</div>
            </div>
          ))}
          <div className="persona-chip" onClick={onNavigateToBrand}>
            <div className="persona-chip-photo" style={{background:'var(--cream)',border:'2px dashed var(--mist)'}}>
              <div className="persona-chip-photo-init" style={{color:'var(--gold)'}}><span className="material-symbols-outlined" style={{fontSize:24}}>add</span></div>
            </div>
            <div className="persona-chip-name" style={{color:'var(--gold)'}}>{t('ais.brief.new_model', 'New model')}</div>
          </div>
        </div>
      </div>

      <div className="sheet-section">
        <div className="sheet-section-label">{t('ais.brief.skin_pre', 'Skin')} <em>{t('ais.brief.skin_em', 'tone')}</em></div>
        <div className="opt-pills">{pillGroup('skin', skin, setSkin)}</div>
        <div style={{fontSize:9.5,color:'var(--stone)',marginTop:7,lineHeight:1.5}}>{t('ais.brief.skin_note', 'Specify directly, never default silently. Mi Italia is committed to authentic representation.')}</div>
      </div>

      <div className="sheet-section">
        <div className="sheet-section-label">{t('ais.brief.age_pre', 'Apparent')} <em>{t('ais.brief.age_em', 'age')}</em></div>
        <div className="opt-pills">{pillGroup('age', age, setAge)}</div>
      </div>

      <div className="sheet-section">
        <div className="sheet-section-label">{t('ais.brief.body_pre', 'Body')} <em>{t('ais.brief.body_em', 'type')}</em></div>
        <div className="opt-pills">{pillGroup('body', body, setBody)}</div>
        <div style={{fontSize:9.5,color:'var(--stone)',marginTop:7,lineHeight:1.5}}>{t('ais.brief.body_note', 'Italian fashion is increasingly inclusive. Choose the body type your actual customers see themselves in.')}</div>
      </div>

      <div className="sheet-section">
        <div className="sheet-section-label">{t('ais.brief.hair', 'Hair')}</div>
        <div className="opt-pills">{pillGroup('hair', hair, setHair)}</div>
      </div>

      <div className="sheet-section">
        <div className="sheet-section-label">{t('ais.brief.pose_pre', 'Pose')} <em>{t('ais.brief.pose_em', 'energy')}</em></div>
        <div className="opt-pills">{pillGroup('pose', pose, setPose)}</div>
      </div>

      <div className="save-preset-bar">
        <span className="material-symbols-outlined" style={{color:'var(--gold)'}}>bookmark_add</span>
        <input value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder={t('ais.brief.preset_ph', "Save edits as new preset, e.g. 'Bridal · soft'")} disabled={saving} />
        <button className="save-preset-btn" onClick={handleSaveAsPreset} disabled={saving}>{saving ? t('ais.common.saving', 'Saving…') : t('ais.brief.save_preset', 'Save as preset')}</button>
      </div>

      </div>{/* .model-editor-form */}
      </div>{/* .model-editor */}
    </Sheet>
  )
}

// ── HUB SCREEN ────────────────────────────────────────────
const GEN_STATUS_UI = {
  processing: { icon:'pending',      label:'Processing', cls:' processing' },
  completed:  { icon:'check_circle', label:'Ready',      cls:'' },
  failed:     { icon:'error',        label:'Failed',     cls:' processing' },
  cancelled:  { icon:'cancel',       label:'Cancelled',  cls:' processing' },
}
function genStatusLabel(status, t) {
  const ui = GEN_STATUS_UI[status] || GEN_STATUS_UI.processing
  return t ? t(`ais.gen_status.${status}`, ui.label) : ui.label
}

function HubScreen({ t, onNavigate, onQuickGenerate, quota, products, listGenerations, getNetworkTrends }) {
  const [recent,        setRecent]        = useState([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [trends,        setTrends]        = useState(null)

  useEffect(() => {
    let alive = true
    listGenerations(8).then(res => {
      if (!alive) return
      if (res.success) setRecent(res.data || [])
      setRecentLoading(false)
    })
    getNetworkTrends().then(res => { if (alive && res.success) setTrends(res.data || null) })
    return () => { alive = false }
  }, [])

  const productById = id => products.find(p => p.id === id)
  const usedPct = quota && quota.limit ? Math.min(100, Math.round(((quota.used || 0) / quota.limit) * 100)) : 0
  const quotaLeft = quota ? Math.max(0, (quota.limit ?? 0) - (quota.used ?? 0)) : 0

  const topLook = trends?.trending_looks?.[0]
  const hasTrends = !!(trends && (trends.boutiques_active > 0 || trends.trending_looks?.length))

  return (
    <div>
      <div className="hub-hero">
        <div className="hub-hero-tag">{t('ais.hub.tag', 'AI MODEL STUDIO')}</div>
        <h1>{t('ais.hub.h1_pre', 'Photograph your collection')} <em>{t('ais.hub.h1_em', 'without')}<br />{t('ais.hub.h1_em2', 'a camera.')}</em></h1>
        <p className="hub-hero-sub">{t('ais.hub.sub', "Turn any hanger, flat-lay, or mannequin shot into editorial on-model imagery in under a minute. Powered by FASHN, scoped to your boutique's brand.")}</p>
        <div className="hub-quota-row">
          <div className="hub-quota">
            <div className="hub-quota-label">{quota?.plan ? t('ais.hub.quota_plan_month', '{{plan}} · THIS MONTH', { plan: quota.plan.toUpperCase() }) : t('ais.hub.this_month', 'THIS MONTH')}</div>
            <div className="hub-quota-bar"><div className="hub-quota-fill" style={{width:`${usedPct}%`}} /></div>
            <div className="hub-quota-stats">
              {quota ? (
                <>
                  <span><strong>{quota.used ?? 0}</strong> {t('ais.hub.quota_used', '{{used}} of {{limit}} generations used', { used: quota.used ?? 0, limit: quota.limit ?? 0 })}</span>
                  <span><strong>{t('ais.hub.quota_left', '{{n}} left', { n: quotaLeft })}</strong> · {resetLabel(quota.resetsAt)}</span>
                </>
              ) : <span>{t('ais.hub.loading_quota', 'Loading quota…')}</span>}
            </div>
          </div>
          <button className="hub-quick-gen" onClick={onQuickGenerate}>
            <span className="material-symbols-outlined">bolt</span>{t('ais.hub.quick_generate', 'Quick generate')}
          </button>
        </div>
      </div>

      <div className="hub-paths">
        {[
          {tag:t('ais.hub.path.single.tag', '+30s'),    icon:'photo_camera', title:t('ais.hub.path.single.title', 'Single'),  em:t('ais.hub.path.single.em', 'shoot'),   desc:t('ais.hub.path.single.desc', 'One product, three on-model variants. Best for hero pieces or new arrivals you want to feature.'),           cta:t('ais.hub.path.single.cta', 'Start a shoot'),   nav:'generate'},
          {tag:t('ais.hub.path.batch.tag', '2-15min'), icon:'grid_view',    title:t('ais.hub.path.batch.title', 'Batch'),   em:t('ais.hub.path.batch.em', 'session'), desc:t('ais.hub.path.batch.desc', 'Process 5–50 products at once with shared model and look. Best when refreshing a season or onboarding new stock.'), cta:t('ais.hub.path.batch.cta', 'Open batch mode'), nav:'batch'},
          {tag:t('ais.hub.path.brand.tag', 'SET ONCE'),icon:'styler',       title:t('ais.hub.path.brand.title', 'Brand'),   em:t('ais.hub.path.brand.em', 'setup'),   desc:t('ais.hub.path.brand.desc', "Save house models and studio looks so every shoot feels like Atelier Bianchi — not a stock catalogue."),          cta:t('ais.hub.path.brand.cta', 'Manage brand'),    nav:'brand'},
        ].map(p => (
          <div key={p.nav} className="hub-path" onClick={() => onNavigate(p.nav)}>
            <div className="hub-path-tag">{p.tag}</div>
            <div className="hub-path-icon"><span className="material-symbols-outlined">{p.icon}</span></div>
            <h3>{p.title} <em>{p.em}</em></h3>
            <p className="hub-path-desc">{p.desc}</p>
            <div className="hub-path-cta">{p.cta} <span className="material-symbols-outlined">arrow_forward</span></div>
          </div>
        ))}
      </div>

      <div className="hub-section-head">
        <div className="hub-section-title">{t('ais.hub.recent_pre', 'Recent')} <em>{t('ais.hub.recent_em', 'generations')}</em></div>
        <div className="hub-section-link" onClick={() => onNavigate('generate')}>{t('ais.common.view_all', 'View all')} <span className="material-symbols-outlined">arrow_forward</span></div>
      </div>
      {recentLoading ? (
        <div style={{padding:'28px 0',fontSize:11,color:'var(--stone)'}}>{t('ais.hub.loading_recent', 'Loading recent generations…')}</div>
      ) : recent.length === 0 ? (
        <div style={{padding:'32px 24px',background:'var(--cream)',textAlign:'center'}}>
          <span className="material-symbols-outlined" style={{fontSize:28,color:'var(--gold)'}}>auto_awesome</span>
          <div style={{fontSize:12,fontWeight:700,marginTop:8}}>{t('ais.hub.no_generations', 'No generations yet')}</div>
          <div style={{fontSize:10.5,color:'var(--stone)',marginTop:4,lineHeight:1.5}}>{t('ais.hub.no_generations_note', 'Run your first shoot and it appears here.')}</div>
          <button className="btn btn-primary btn-sm" style={{marginTop:14}} onClick={() => onNavigate('generate')}>{t('ais.hub.start_shoot', 'Start a shoot')}</button>
        </div>
      ) : (
        <div className="hub-gallery">
          {recent.map(g => {
            const product = productById(g.product_id)
            const ui      = GEN_STATUS_UI[g.status] || GEN_STATUS_UI.processing
            const img     = generationOutputs(g)[0] || product?.main_photo || g.source_image_url
            const failure = generationError(g)
            return (
              <div key={g.id} className="gen-card" onClick={() => onNavigate('generate')}>
                <div className="gen-card-img" style={img ? {backgroundImage:`url('${img}')`} : {background:'var(--cream)'}}>
                  <div className={`gen-card-status${ui.cls}`}>
                    <span className="material-symbols-outlined">{ui.icon}</span>{genStatusLabel(g.status, t)}
                  </div>
                  {img && (
                    <div className="gen-card-overlay">
                      <div className="gen-card-actions">
                        <a className="gen-card-action" href={img} target="_blank" rel="noreferrer" download onClick={e=>e.stopPropagation()}>
                          <span className="material-symbols-outlined">download</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                <div className="gen-card-body">
                  <div className="gen-card-name">{product?.name || t('ais.hub.untitled_product', 'Untitled product')}</div>
                  <div className="gen-card-meta">
                    <span className="material-symbols-outlined">auto_awesome</span>
                    {failure || generationBriefLine(g) || timeAgo(g.created_at)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="hub-spotlight">
        <div className="spotlight-left">
          <div className="spotlight-tag">{t('ais.hub.network_insight', 'NETWORK INSIGHT · LAST {{days}} DAYS', { days: trends?.window_days || 30 })}</div>
          {hasTrends ? (
            <>
              <h3>{topLook?.name || t('ais.hub.your_network', 'Your network')}<br /><em>{t('ais.hub.is_trending', 'is trending')}</em></h3>
              <p>
                {t('ais.hub.trend_across', 'Across {{n}} active Mi Italia boutique(s)', { n: trends.boutiques_active })}
                {topLook ? <>, <strong>{t('ais.hub.trend_top_look', '{{name}} is the most-used studio look right now.', { name: topLook.name })}</strong></> : '.'}
                {' '}{t('ais.hub.trend_privacy', 'Anonymous aggregate only — individual generations are never shared.')}
              </p>
            </>
          ) : (
            <>
              <h3>{t('ais.hub.trends_gathering_pre', 'Network trends')}<br /><em>{t('ais.hub.trends_gathering_em', 'are still gathering')}</em></h3>
              <p>{t('ais.hub.trends_gathering_note', "There isn't enough cross-boutique activity yet to surface a trend. As more Mi Italia boutiques generate imagery, aggregate insights will appear here — always anonymous, never per-generation.")}</p>
            </>
          )}
          <span className="btn-text" onClick={() => onNavigate('brand')}>
            {t('ais.hub.see_network_trends', 'See network trends')} <span className="material-symbols-outlined">arrow_forward</span>
          </span>
        </div>
        <div className="spotlight-right">
          {(trends?.trending_looks || []).slice(0,3).map((l,i) => (
            <div key={l.name || i} className="spotlight-thumb" style={{background:'linear-gradient(135deg,#2a2018,#4a4038)',display:'flex',alignItems:'flex-end',padding:10}}>
              <span style={{fontSize:10,fontWeight:700,color:'var(--cream)'}}>{l.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── GENERATE SCREEN ───────────────────────────────────────
// The /tryon route carries no product, so the shoot picks one itself: a picker
// sheet over the catalogue list, then GET /products/:id for the photos[] that
// become the source-image strip.
// The generate button is disabled whenever the chosen model has no photo. That
// explanation used to live only inside Detailed's model card, so Quick mode
// would show a dead button with no visible reason — hence one shared component.
//
// The markup keeps `alert-red` for consistency with the rest of the codebase,
// but that class has no CSS definition anywhere; `.alert.quick-warn` is what
// actually supplies the red treatment, scoped to this screen on purpose.
function ModelPhotoWarning({ t, onFix, style }) {
  return (
    <div className="alert alert-red quick-warn" style={{alignItems:'flex-start', ...style}}>
      <span className="material-symbols-outlined">error</span>
      <div>
        <strong>{t('ais.model_warn.bold', 'This model has no photo.')}</strong> {t('ais.model_warn.note_pre', 'The AI reads the body pose from a real photo — without one every shoot fails. Add a full-body photo to this model in')} <strong>{t('ais.model_warn.brand_setup', 'Brand setup')}</strong>.
        {onFix && <> <button type="button" className="quick-link" onClick={onFix}>{t('ais.model_warn.open_brand', 'Open Brand setup')}</button></>}
      </div>
    </div>
  )
}

// Quick mode's entire right-hand column: read-only, zero editable inputs. It
// mirrors the brief Detailed edits — it never substitutes defaults, so switching
// modes cannot change what gets generated. Only the render tier differs.
function QuickBriefPanel({ t, look, model, brief, aspect, variants, poses, loading, onSwitchToDetailed, onOpenBrandSetup }) {
  const standard = isStandardShoot(aspect, variants)
  const noPhoto  = !model?.custom_photo_url
  return (
    <div className="quick-panel">
      <div className="quick-panel-head">
        <div className="quick-panel-tag"><span className="material-symbols-outlined">bolt</span>{t('ais.gen.quick_mode_tag', 'QUICK MODE')}</div>
        <div className="quick-panel-title">{t('ais.gen.quick_title_pre', 'Shoot the brief')} <em>{t('ais.gen.quick_title_em', 'as it stands')}</em></div>
        <div className="quick-panel-sub">
          {t('ais.gen.quick_sub', "Quick uses exactly what's selected in Detailed — same look, same model, same format. Nothing is swapped. It just renders at a lighter setting: back faster, with slightly softer detail than a Detailed shoot.")}
        </div>
      </div>

      <div className="quick-rows">
        {loading && !look ? (
          <div className="quick-row quick-row-empty">{t('ais.gen.loading_looks', 'Loading your studio looks…')}</div>
        ) : look ? (
          <div className="quick-row">
            <div className="quick-row-thumb" style={lookThumbStyle(look)} />
            <div className="quick-row-body">
              <div className="quick-row-label">{t('ais.gen.studio_look', 'Studio look')}</div>
              <div className="quick-row-name">
                {look.name}
                {look.is_default && <span className="quick-badge">{t('ais.common.default_badge', 'DEFAULT')}</span>}
              </div>
              <div className="quick-row-sub">{lookDescLine(look, t) || t('ais.gen.no_lighting_notes', 'No lighting notes on this look')}</div>
            </div>
          </div>
        ) : (
          <div className="quick-row quick-row-empty">
            {t('ais.gen.no_look_yet', 'No studio look yet.')}{' '}
            <button type="button" className="quick-link" onClick={onSwitchToDetailed}>{t('ais.gen.create_in_detailed', 'Create one in Detailed')}</button>
          </div>
        )}

        {loading && !model ? (
          <div className="quick-row quick-row-empty">{t('ais.gen.loading_house_models', 'Loading your house models…')}</div>
        ) : (model || brief) ? (
          <div className="quick-row">
            <div className="quick-row-thumb quick-row-thumb-model"
                 style={model?.custom_photo_url
                   ? {backgroundImage:`url('${toDisplayUrl(model.custom_photo_url)}')`,backgroundSize:'cover',backgroundPosition:'center'}
                   : undefined}>
              {!model?.custom_photo_url && (
                <span className="quick-row-init">{modelInitials(model?.name || t('ais.gen.custom_brief', 'Custom brief'))}</span>
              )}
            </div>
            <div className="quick-row-body">
              <div className="quick-row-label">{t('ais.gen.model', 'Model')}</div>
              <div className="quick-row-name">
                {model?.name || t('ais.gen.custom_brief', 'Custom brief')}
                {model?.is_default && <span className="quick-badge">{t('ais.common.default_badge', 'DEFAULT')}</span>}
              </div>
              <div className="quick-row-sub">{modelTraitsLine(brief) || t('ais.gen.no_attributes', 'No attributes set')}</div>
            </div>
          </div>
        ) : (
          <div className="quick-row quick-row-empty">
            {t('ais.gen.no_model_yet', 'No house model yet.')}{' '}
            <button type="button" className="quick-link" onClick={onOpenBrandSetup}>{t('ais.gen.add_in_brand', 'Add one in Brand setup')}</button>
          </div>
        )}

        <div className="quick-row">
          <div className="quick-row-thumb quick-row-thumb-fmt">
            <div className={`ar-icon ar-${aspect.replace(':','-')}`} />
          </div>
          <div className="quick-row-body">
            <div className="quick-row-label">{t('ais.gen.format_output', 'Format & output')}</div>
            <div className="quick-row-name">
              {aspect} · {t('ais.gen.n_poses', '{{n}} pose(s)', { n: variants })}
              <span className={`quick-badge${standard ? '' : ' alt'}`}>{standard ? t('ais.gen.standard', 'STANDARD') : t('ais.gen.custom_badge', 'CUSTOM')}</span>
            </div>
            <div className="quick-row-sub">{t(`ais.aspect.${aspect}`, ASPECT_LABEL[aspect] || 'Custom')} @ 2K · {poses.map(id => poseLabel(id, t)).join(' · ')}</div>
          </div>
        </div>
      </div>

      {noPhoto && !loading && <ModelPhotoWarning t={t} onFix={onOpenBrandSetup} style={{margin:'0 20px 16px'}} />}

      <div className="quick-foot">
        <span className="material-symbols-outlined">tune</span>
        {t('ais.gen.need_change', 'Need to change any of this?')}
        <button type="button" className="quick-link" onClick={onSwitchToDetailed}>{t('ais.gen.switch_detailed', 'Switch to Detailed')}</button>
      </div>
    </div>
  )
}

function GenerateScreen({
  t, onNavigate, mode, setMode,
  looks, looksLoading, createLook, createLookWithPhoto, updateLookWithPhoto,
  models, modelsLoading, createModel,
  products, productsLoading, getProduct, uploadProductPhoto, quota,
  startGeneration, pollGeneration, cancelGeneration, regenerateGeneration,
  saveToGallery, retouchGeneration, productGenerations, pushToProduct, show,
}) {
  const [productId,      setProductId]      = useState(null)
  const [product,        setProduct]        = useState(null)
  const [productLoading, setProductLoading] = useState(false)
  const [sourcePhotoId,  setSourcePhotoId]  = useState(null)

  const [selectedLook,      setSelectedLook]      = useState(null)
  const [modelBrief,        setModelBrief]        = useState(null)
  const [selectedAspect,    setSelectedAspect]    = useState('3:4')
  const [variants,          setVariants]          = useState(3)
  // `mode` is owned by the parent — the Hub's "Quick generate" sets it while
  // navigating, and this screen unmounts on every tab switch.

  const [generation, setGeneration] = useState(null)
  const [starting,   setStarting]   = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showResults,setShowResults]= useState(false)

  const [uploading,  setUploading]  = useState(false)
  const fileRef = useRef(null)

  const [showProductPicker, setShowProductPicker] = useState(false)
  const [productQuery,      setProductQuery]      = useState('')
  const [showModelSheet,    setShowModelSheet]    = useState(false)
  const [showVariantsSheet, setShowVariantsSheet] = useState(false)
  const [draftVariants,     setDraftVariants]     = useState(3)
  const [showLookEditor,    setShowLookEditor]    = useState(false)

  const [showHistory,   setShowHistory]   = useState(false)
  const [history,       setHistory]       = useState([])
  const [historyLoading,setHistoryLoading]= useState(false)

  // Default to the first product that already has a photo — a product with no
  // source image can't be shot without an upload first.
  useEffect(() => {
    if (productId || products.length === 0) return
    setProductId((products.find(p => p.main_photo) || products[0]).id)
  }, [products, productId])

  // Load the full record whenever the chosen product changes — the list
  // endpoint only carries main_photo, not the full photos[] array.
  useEffect(() => {
    if (!productId) return
    let alive = true
    setProductLoading(true)
    getProduct(productId).then(res => {
      if (!alive) return
      if (res.success) {
        setProduct(res.data)
        const photos = productPhotos(res.data)
        const main   = photos.find(p => p.is_main) || photos[0]
        setSourcePhotoId(main?.id || null)
      } else {
        setProduct(null)
        setSourcePhotoId(null)
      }
      setProductLoading(false)
    })
    return () => { alive = false }
  }, [productId])

  useEffect(() => {
    if (selectedLook || looks.length === 0) return
    setSelectedLook((looks.find(l => l.is_default) || looks[0]).id)
  }, [looks, selectedLook])

  useEffect(() => {
    if (modelBrief || models.length === 0) return
    const def = models.find(m => m.is_default) || models[0]
    setModelBrief({ id: def.id, skin: def.skin, age: def.age, body: def.body, hair: def.hair, pose: def.pose })
  }, [models, modelBrief])

  // Poll until the shoot reaches a terminal status.
  useEffect(() => {
    if (!generation || isTerminal(generation)) return
    let alive = true
    const timer = setInterval(async () => {
      const res = await pollGeneration(generation.id)
      if (!alive) return
      if (res.success && res.data) setGeneration(res.data)
    }, POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [generation?.id, generation?.status])

  // Surface the outcome once it lands. A cancelled shoot just clears — the
  // user asked for it to stop, so there is nothing to review.
  useEffect(() => {
    if (!generation || !isTerminal(generation)) return
    if (generation.status === 'cancelled') { setGeneration(null); return }
    setShowResults(true)
  }, [generation?.id, generation?.status])

  const photos       = productPhotos(product)
  const sourcePhoto  = photos.find(p => p.id === sourcePhotoId) || photos[0] || null
  const sourceUrl    = sourcePhoto?.url || null
  const currentLook  = looks.find(l => l.id === selectedLook)
  const currentModel = modelBrief?.id ? models.find(m => m.id === modelBrief.id) : null
  const quotaLeft    = quota ? Math.max(0, (quota.limit ?? 0) - (quota.used ?? 0)) : null
  const processing   = !!generation && !isTerminal(generation)

  const modelPhotoMissing = !currentModel?.custom_photo_url

  // One ordered list of reasons a shoot can't run. The generate button's
  // disabled state, its label and runGeneration()'s guards all read this, so
  // they can't drift apart — previously `disabled` ignored the missing-look
  // case that runGeneration checked, leaving a live button that failed on a toast.
  const blocker =
    !sourceUrl        ? { label:t('ais.gen.blocker.no_source', 'Upload a source image first'), toast:t('ais.gen.blocker_toast.no_source', 'This product has no source image — upload one first.') } :
    !currentLook      ? { label:t('ais.gen.blocker.no_look', 'No studio look yet'),          toast:t('ais.gen.blocker_toast.no_look', 'Create a studio look in Brand setup first.') } :
    !currentModel     ? { label:t('ais.gen.blocker.no_model', 'No house model yet'),          toast:t('ais.gen.blocker_toast.no_model', 'Create a house model in Brand setup first.') } :
    modelPhotoMissing ? { label:t('ais.gen.blocker.no_photo', 'Model needs a photo'),         toast:t('ais.gen.blocker_toast.no_photo', 'This house model has no photo yet — add one in Brand setup before generating.') } :
    quotaLeft === 0   ? { label:t('ais.gen.blocker.no_quota', 'No quota left'),               toast:t('ais.gen.blocker_toast.no_quota', 'No generations left this month.') } :
    null

  // `starting` covers the gap before ProcessingModal (a fixed full-screen
  // overlay) goes up and makes the toggle physically unreachable.
  function switchMode(next) {
    if (next === mode) return
    if (starting || processing) { show(t('ais.gen.err_finish_first', 'Finish or cancel the shoot in progress first.')); return }
    setMode(next)
  }

  const filteredProducts = products.filter(p => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return true
    return [p.name, p.sku, p.brand_name].filter(Boolean).some(v => v.toLowerCase().includes(q))
  })

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !productId) return
    setUploading(true)
    const res = await uploadProductPhoto(productId, file)
    setUploading(false)
    if (res.success) {
      const added = res.data?.photos?.[0]
      show(res.message || t('ais.gen.toast_photo_uploaded', 'Photo uploaded'), 'success')
      const fresh = await getProduct(productId)
      if (fresh.success) {
        setProduct(fresh.data)
        setSourcePhotoId(added?.id || productPhotos(fresh.data)[0]?.id || null)
      }
    } else {
      show(res.message || t('ais.gen.err_upload_failed', 'Upload failed'))
    }
  }

  async function runGeneration() {
    if (!product) { show(t('ais.gen.err_pick_product', 'Pick a product to shoot first.')); return }
    // Without a model photo the backend has no human image to send FASHN and
    // the shoot always fails with PoseError — refuse rather than spend a unit.
    if (blocker)  { show(blocker.toast); return }

    setStarting(true)
    setShowResults(false)
    const res = await startGeneration({
      source_image_url: sourceUrl,
      look_id:          selectedLook,
      model_id:         modelBrief?.id || null,
      aspect:           selectedAspect,
      mode,
      poses:            POSE_QUICK_ORDER.slice(0, variants),
      product_id:       product.id,
    })
    setStarting(false)
    if (res.success) setGeneration(res.data)
    else show(res.message || t('ais.gen.err_start_failed', 'Could not start the shoot'))
  }

  async function handleCancel() {
    if (!generation) return
    setCancelling(true)
    const res = await cancelGeneration(generation.id)
    setCancelling(false)
    if (res.success) { show(res.message || t('ais.gen.toast_cancelled', 'Cancelled — quota was not charged'), 'success'); setGeneration(null) }
    else show(res.message || t('ais.gen.err_cancel_failed', 'Could not cancel this shoot'))
  }

  function openHistory() {
    if (!productId) { show(t('ais.gen.err_pick_product_first', 'Pick a product first.')); return }
    setShowHistory(true)
    setHistoryLoading(true)
    productGenerations(productId).then(res => {
      setHistory(res.success ? (res.data || []) : [])
      setHistoryLoading(false)
    })
  }

  // Reloads a past shoot's brief back into the form.
  function reopenShoot(g) {
    if (g.look_id)  setSelectedLook(g.look_id)
    if (g.aspect)   setSelectedAspect(g.aspect)
    if (g.mode)     setMode(g.mode)
    if (Array.isArray(g.poses) && g.poses.length) setVariants(Math.min(5, g.poses.length))
    if (g.model_id) {
      const m = models.find(x => x.id === g.model_id)
      if (m) setModelBrief({ id:m.id, skin:m.skin, age:m.age, body:m.body, hair:m.hair, pose:m.pose })
    }
    const src = photos.find(p => p.url === g.source_image_url)
    if (src) setSourcePhotoId(src.id)
    setShowHistory(false)
    show(t('ais.gen.toast_reloaded', 'Brief reloaded from that shoot'), 'success')
  }

  return (
    <div>
      <div className="gen-head">
        <div className="gen-head-left">
          <div className="gen-product-img" style={sourceUrl ? {backgroundImage:`url('${sourceUrl}')`,backgroundSize:'cover',backgroundPosition:'center'} : undefined} />
          <div>
            <div className="gen-product-name">
              {productLoading ? t('ais.common.loading', 'Loading…') : (product?.name || (productsLoading ? t('ais.gen.loading_catalogue', 'Loading catalogue…') : t('ais.gen.no_product_selected', 'No product selected')))}
            </div>
            <div className="gen-product-meta">{productSubtitle(product) || t('ais.gen.pick_product', 'Pick a product to shoot')}</div>
          </div>
          <button className="btn btn-outline btn-sm" style={{marginLeft:14}} onClick={() => { setProductQuery(''); setShowProductPicker(true) }}>
            <span className="material-symbols-outlined">swap_horiz</span>{t('ais.common.change', 'Change')}
          </button>
        </div>
        <div className="gen-head-right">
          <div className={`gen-mode-toggle${(starting||processing)?' locked':''}`}>
            <div className={`gen-mode-btn${mode==='detailed'?' active':''}`} onClick={() => switchMode('detailed')}
                 title={t('ais.gen.detailed_title', 'Detailed — full-quality render, all controls')}>
              <span className="material-symbols-outlined">tune</span>{t('ais.gen.detailed', 'Detailed')}
            </div>
            <div className={`gen-mode-btn${mode==='quick'?' active':''}`} onClick={() => switchMode('quick')}
                 title={t('ais.gen.quick_title', 'Quick — same brief, faster render, slightly softer detail')}>
              <span className="material-symbols-outlined">bolt</span>{t('ais.gen.quick', 'Quick')}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={openHistory}><span className="material-symbols-outlined">history</span>{t('ais.gen.history', 'History')}</button>
        </div>
      </div>

      <div className="gen-layout">
        <div className="gen-canvas">
          <div className="gen-canvas-source">
            <div className="canvas-corner tl"/><div className="canvas-corner tr"/>
            <div className="canvas-corner bl"/><div className="canvas-corner br"/>
            {sourceUrl
              ? <img src={sourceUrl} alt="source" style={{maxWidth:'80%',maxHeight:'80%',objectFit:'contain'}} />
              : (
                <div style={{textAlign:'center',padding:24}}>
                  <span className="material-symbols-outlined" style={{fontSize:34,color:'var(--gold)'}}>add_photo_alternate</span>
                  <div style={{fontSize:12,fontWeight:700,marginTop:8}}>{t('ais.gen.no_source', 'No source image')}</div>
                  <div style={{fontSize:10.5,color:'var(--stone)',marginTop:4,lineHeight:1.5,maxWidth:260}}>
                    {t('ais.gen.no_source_note', 'A shoot needs a hanger, flat-lay, or mannequin shot to work from. Upload one below.')}
                  </div>
                </div>
              )}
          </div>
          <div className="gen-canvas-footer">
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {photos.map((p, i) => (
                <div key={p.id} className={`source-tab${sourcePhotoId===p.id?' active':''}`} onClick={() => setSourcePhotoId(p.id)}>
                  <span className="material-symbols-outlined">{p.is_main ? 'star' : 'image'}</span>
                  {p.is_main ? t('ais.gen.main_photo', 'Main photo') : t('ais.gen.photo_n', 'Photo {{n}}', { n: i+1 })}
                </div>
              ))}
              <div className="source-tab" onClick={() => !uploading && fileRef.current?.click()}>
                <span className="material-symbols-outlined">add_photo_alternate</span>{uploading ? t('ais.gen.uploading', 'Uploading…') : t('ais.gen.upload_new', 'Upload new')}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{display:'none'}} onChange={handleUpload} />
            </div>
            <div style={{fontSize:'9.5px',color:'var(--stone)'}}>
              {photos.length ? t('ais.gen.photo_count', '{{n}} photo(s) on this product', { n: photos.length }) : t('ais.gen.no_photos', 'No photos yet')}
            </div>
          </div>
        </div>

        <div className={`gen-rhs${mode==='quick' ? ' gen-rhs-quick' : ''}`}>
          {mode === 'quick' ? (
            <QuickBriefPanel
              t={t}
              look={currentLook} model={currentModel} brief={modelBrief}
              aspect={selectedAspect} variants={variants}
              poses={POSE_QUICK_ORDER.slice(0, variants)}
              loading={(looksLoading && !looks.length) || (modelsLoading && !models.length)}
              onSwitchToDetailed={() => switchMode('detailed')}
              onOpenBrandSetup={() => onNavigate('brand')}
            />
          ) : (<>
          <div className="brief-card">
            <div className="brief-card-head"><div className="brief-card-title">{t('ais.gen.studio_look_pre', 'Studio')} <em>{t('ais.gen.studio_look_em', 'look')}</em></div><div className="brief-card-num">1</div></div>
            <div className="brief-card-body">
              <div className="look-grid">
                {looksLoading && looks.length === 0 && <div className="brief-row-sub">{t('ais.gen.loading_looks2', 'Loading looks…')}</div>}
                {looks.map(l => (
                  <div key={l.id} className={`look-card${selectedLook===l.id?' selected':''}`} onClick={() => setSelectedLook(l.id)}>
                    <div className="look-card-img" style={lookThumbStyle(l)} />
                    <div className="look-card-foot">
                      <div className="look-card-name">{l.name}</div>
                      <div className="look-card-check"><span className="material-symbols-outlined">check</span></div>
                    </div>
                  </div>
                ))}
                <div className="look-card look-card-add" onClick={() => setShowLookEditor(true)} title={t('ais.gen.create_look_title', 'Create a new studio look')}>
                  <div className="look-card-addbox">
                    <span className="material-symbols-outlined">add</span>
                    <div className="look-card-addlabel">{t('ais.gen.create_a_look', 'Create a look')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="brief-card">
            <div className="brief-card-head"><div className="brief-card-title">{t('ais.gen.model_brief_pre', 'Model')} <em>{t('ais.gen.model_brief_em', 'brief')}</em></div><div className="brief-card-num">2</div></div>
            <div className="brief-card-body">
              <div className="brief-saved" onClick={() => setShowModelSheet(true)}>
                <div className="brief-saved-hero"
                     style={currentModel?.custom_photo_url ? {backgroundImage:`url('${toDisplayUrl(currentModel.custom_photo_url)}')`} : undefined}>
                  {!currentModel?.custom_photo_url && (
                    <div className="brief-saved-hero-init">{modelInitials(currentModel?.name || 'Custom')}</div>
                  )}
                </div>
                <div className="brief-saved-body">
                  <div className="brief-saved-name">{currentModel?.name || t('ais.gen.custom_brief', 'Custom brief')}{currentModel?.is_default && <span className="tag">{t('ais.common.default_badge', 'DEFAULT')}</span>}</div>
                  <div className="brief-saved-meta">{modelTraitsLine(modelBrief)}</div>
                </div>
                <span className="material-symbols-outlined brief-saved-chev">expand_more</span>
              </div>
              {modelPhotoMissing && <ModelPhotoWarning t={t} onFix={() => onNavigate('brand')} style={{marginTop:10}} />}
              <div className="diversity-note">
                <div className="diversity-note-icon"><span className="material-symbols-outlined">diversity_3</span></div>
                <div className="diversity-note-body"><strong>{t('ais.gen.diversity_bold', 'Mi Italia model diversity standard.')}</strong> {t('ais.gen.diversity_note', 'Italian fashion is global. Choose authentic combinations that represent your actual customer base.')}</div>
              </div>
            </div>
          </div>

          <div className="brief-card">
            <div className="brief-card-head"><div className="brief-card-title">{t('ais.gen.format_pre', 'Format &')} <em>{t('ais.gen.format_em', 'output')}</em></div><div className="brief-card-num">3</div></div>
            <div className="brief-card-body">
              <div className="brief-row" style={{border:'none',paddingBottom:8}}>
                <div><div className="brief-row-label">{t('ais.gen.aspect_ratio', 'Aspect ratio')}</div><div className="brief-row-sub">{t('ais.gen.aspect_ratio_note', '3:4 for store · 1:1 for catalogue · 9:16 for social')}</div></div>
              </div>
              <div className="aspect-toggle">
                {[{key:'3:4',cls:'ar-3-4'},{key:'1:1',cls:'ar-1-1'},{key:'9:16',cls:'ar-9-16'}].map(a => (
                  <div key={a.key} className={`aspect-btn${selectedAspect===a.key?' selected':''}`} onClick={() => setSelectedAspect(a.key)}>
                    <div className={`ar-icon ${a.cls}`}/>{a.key} {t(`ais.aspect_word.${a.key}`, ASPECT_WORDS[a.key])}
                  </div>
                ))}
              </div>
              <div className="brief-row" style={{marginTop:16}} onClick={() => {setDraftVariants(variants);setShowVariantsSheet(true)}}>
                <div><div className="brief-row-label">{t('ais.gen.variants', 'Variants')}</div><div className="brief-row-sub">{t('ais.gen.variants_note', 'Number of poses generated')}</div></div>
                <div className="brief-row-value">
                  <span>{t('ais.gen.n_poses', '{{n}} pose(s)', { n: variants })}</span>
                  <span className="material-symbols-outlined" style={{fontSize:13,color:'var(--stone)'}}>chevron_right</span>
                </div>
              </div>
            </div>
          </div>
          </>)}

          <div className="gen-footer">
            <div className="gen-summary">
              <div className="gen-summary-stats">
                <div className="gen-summary-stat"><strong>{variants}</strong> {t('ais.gen.variants_lc', 'variants')}</div>
                <div className="gen-summary-stat"><strong>{selectedAspect}</strong> @ 2K</div>
                <div className="gen-summary-stat">{currentLook?.name || '—'} · {currentModel?.name?.split(' ')[0] || t('ais.gen.custom', 'Custom')}</div>
              </div>
              <div className="gen-summary-quota">
                <span className="material-symbols-outlined">data_usage</span>
                {quotaLeft === null ? t('ais.gen.checking_quota', 'Checking quota…') : t('ais.gen.uses_1_of', 'Uses 1 of {{n}} left', { n: quotaLeft })}
              </div>
            </div>
            <button className="btn-generate" onClick={runGeneration} disabled={starting||processing||!!blocker}>
              <span className="material-symbols-outlined">auto_awesome</span>
              {starting     ? t('ais.gen.starting', 'Starting…')
               : processing ? t('ais.gen.in_progress', 'Shoot in progress…')
               : blocker    ? blocker.label
               :              t('ais.gen.generate_shoot', 'Generate the shoot')}
            </button>
          </div>
        </div>
      </div>

      <ProcessingModal
        t={t}
        open={processing}
        hero={sourceUrl}
        lead={t('ais.gen.processing_lead', 'Photographing your')}
        em={product?.name || t('ais.gen.processing_em', 'product')}
        statusLine={t('ais.gen.processing_status', '{{n}} pose(s) · {{look}} · {{aspect}}', { n: variants, look: currentLook?.name || t('ais.gen.look_fallback', 'look'), aspect: selectedAspect })}
        note={t('ais.gen.processing_note', 'this usually takes under a minute')}
        onCancel={handleCancel}
        cancelDisabled={cancelling}
      />

      <ResultsModal
        t={t}
        open={showResults}
        onClose={() => { setShowResults(false); setGeneration(null) }}
        generation={generation}
        productName={product?.name}
        quota={quota}
        retouchGeneration={retouchGeneration}
        regenerateGeneration={regenerateGeneration}
        saveToGallery={saveToGallery}
        pushToProduct={pushToProduct}
        show={show}
        onRegenerated={g => { setShowResults(false); setGeneration(g) }}
        onUpdated={g => setGeneration(g)}
        onPushed={() => { if (productId) getProduct(productId).then(r => r.success && setProduct(r.data)) }}
      />

      <ModelBriefSheet
        t={t}
        open={showModelSheet}
        onClose={() => setShowModelSheet(false)}
        models={models}
        modelsLoading={modelsLoading}
        brief={modelBrief}
        createModel={createModel}
        show={show}
        onApply={setModelBrief}
        onNavigateToBrand={() => { setShowModelSheet(false); show(t('ais.gen.toast_create_from_brand', 'Create new models from Brand setup'), 'info'); onNavigate('brand') }}
      />

      {/* Product picker */}
      <Sheet t={t} open={showProductPicker} onClose={() => setShowProductPicker(false)}
        tag={t('ais.picker.tag', 'SHOOT · PICK PRODUCT')}
        title={t('ais.picker.title', 'Which <em>product</em>?')}
        sub={t('ais.picker.sub', 'Pick the product this shoot is for. Its photos become the source images you generate from.')}
        foot={t('ais.picker.foot', 'Products without a photo need an <strong>upload</strong> before they can be shot.')}
        confirmLabel={t('ais.common.done', 'Done')}
        onConfirm={() => setShowProductPicker(false)}>
        <div className="sheet-section">
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',background:'var(--cream)',borderRadius: 0,marginBottom:12}}>
            <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)'}}>search</span>
            <input value={productQuery} onChange={e => setProductQuery(e.target.value)}
              style={{border:'none',background:'none',outline:'none',flex:1,fontSize:11,fontFamily:'inherit'}} placeholder={t('ais.picker.search_ph', 'Search name, SKU, or brand…')} />
          </div>
          {productsLoading && <div className="brief-row-sub">{t('ais.picker.loading', 'Loading catalogue…')}</div>}
          {!productsLoading && filteredProducts.length === 0 && (
            <div style={{fontSize:11,color:'var(--stone)',textAlign:'center',padding:24}}>{t('ais.picker.no_match', 'No products match that search.')}</div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:420,overflowY:'auto'}}>
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => { setProductId(p.id); setShowProductPicker(false) }}
                style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:productId===p.id?'rgba(184,149,90,0.1)':'var(--cream)',border:`1.5px solid ${productId===p.id?'var(--gold)':'transparent'}`,borderRadius: 0,cursor:'pointer'}}>
                <div style={{width:38,height:48,flexShrink:0,background:p.main_photo?`url('${p.main_photo}') center/cover`:'var(--mist)'}} />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11.5,fontWeight:700,marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                  <div style={{fontSize:9.5,color:'var(--stone)'}}>{[p.brand_name, p.sku, p.retail_price?`€${p.retail_price}`:null].filter(Boolean).join(' · ')}</div>
                </div>
                {!p.main_photo && (
                  <span className="material-symbols-outlined" style={{fontSize:16,color:'var(--gold)'}} title={t('ais.picker.no_photo_yet', 'No photo yet')}>warning</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Sheet>

      {/* Shoot history for this product */}
      <Sheet t={t} open={showHistory} onClose={() => setShowHistory(false)}
        tag={t('ais.history.tag', 'GENERATION HISTORY')}
        title={t('ais.history.title', 'Shoot <em>history</em>')}
        sub={t('ais.history.sub', 'Every shoot run for {{name}}. Newest first.', { name: product?.name || t('ais.history.this_product', 'this product') })}
        foot={t('ais.history.foot', 'Reopening a shoot <strong>reloads its brief</strong> — it does not re-run it.')}
        confirmLabel={t('ais.common.done', 'Done')}
        onConfirm={() => setShowHistory(false)}>
        <div className="sheet-section">
          {historyLoading && <div className="brief-row-sub">{t('ais.history.loading', 'Loading history…')}</div>}
          {!historyLoading && history.length === 0 && (
            <div style={{padding:24,textAlign:'center',color:'var(--stone)',fontSize:11}}>{t('ais.history.empty', 'No shoots yet for this product. Generate one and it appears here.')}</div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {history.map(g => {
              const thumb   = generationOutputs(g)[0] || g.source_image_url
              const failure = generationError(g)
              return (
                <div key={g.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:'var(--cream)',borderRadius: 0}}>
                  <div style={{width:36,height:46,flexShrink:0,background:thumb?`url('${thumb}') center/cover`:'var(--mist)'}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                      <span style={{fontSize:11.5,fontWeight:700}}>{g.look_snapshot?.name || t('ais.history.custom_look', 'Custom look')}</span>
                      <span style={{fontSize:7.5,fontWeight:700,letterSpacing:'0.6px',padding:'2px 5px',background:'var(--mist)',color:'var(--stone)'}}>{(g.mode||'').toUpperCase()}</span>
                      <span style={{fontSize:7.5,fontWeight:700,letterSpacing:'0.6px',color:g.status==='completed'?'var(--green)':g.status==='failed'?'var(--red)':'var(--gold)'}}>{genStatusLabel(g.status, t).toUpperCase()}</span>
                    </div>
                    <div style={{fontSize:9.5,color:'var(--stone)',lineHeight:1.45}}>
                      {failure || t('ais.history.variants_line', '{{n}} variants · {{aspect}} · {{ago}}', { n: g.image_count || generationOutputs(g).length || 0, aspect: g.aspect || '', ago: timeAgo(g.created_at) })}
                    </div>
                  </div>
                  <button className="preset-action" title={t('ais.history.reload_title', 'Reload this brief')} onClick={() => reopenShoot(g)}>
                    <span className="material-symbols-outlined">replay</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </Sheet>

      {/* Variants Sheet */}
      <Sheet t={t} open={showVariantsSheet} onClose={() => setShowVariantsSheet(false)} tag={t('ais.variants.tag', 'EDIT · VARIANTS')} title={t('ais.variants.title', 'Variants <em>per product</em>')} sub={t('ais.variants.sub', 'Number of poses to generate for this shoot.')} foot={t('ais.variants.foot', 'Each <strong>generation</strong> burns 1 quota unit regardless of variant count — variants are bundled.')} confirmLabel={t('ais.common.apply', 'Apply')} onConfirm={() => {setVariants(draftVariants);setShowVariantsSheet(false)}}>
        <div className="sheet-section">
          <div className="num-row">
            <div><div className="num-row-label">{t('ais.variants.poses_generated', 'Poses generated')}</div><div className="num-row-sub">{t('ais.variants.poses_note', '3 is the sweet spot · 4 gives wider variety · 1 saves quota')}</div></div>
            <div className="num-stepper">
              <button className="num-btn" onClick={() => setDraftVariants(v => Math.max(1,v-1))}><span className="material-symbols-outlined">remove</span></button>
              <span className="num-value">{draftVariants}</span>
              <button className="num-btn" onClick={() => setDraftVariants(v => Math.min(4,v+1))}><span className="material-symbols-outlined">add</span></button>
            </div>
          </div>
          <div className="sheet-quota-note">
            <strong>{t('ais.variants.poses_label', 'Poses:')} </strong>{POSE_QUICK_ORDER.slice(0, draftVariants).map(id => poseLabel(id, t)).join(' · ')}
            {quotaLeft !== null && <> · {t('ais.variants.uses_1_of', 'uses 1 of {{n}} left', { n: quotaLeft })}</>}
          </div>
        </div>
      </Sheet>

      <LookEditorSheet
        t={t}
        open={showLookEditor}
        onClose={() => setShowLookEditor(false)}
        editingLook={null}
        createLook={createLook}
        createLookWithPhoto={createLookWithPhoto}
        updateLookWithPhoto={updateLookWithPhoto}
        show={show}
        onSaved={newLook => setSelectedLook(newLook.id)}
      />
    </div>
  )
}

// ── BATCH SCREEN — Full implementation ───────────────────
// Batch lifecycle note: POST /batches creates the items from product_ids, and
// there is no "add item" endpoint afterwards — only DELETE. So the batch is
// created at Run (or Save draft) time from the current selection; per-row
// overrides are held locally until then, and PATCHed straight after creation.
function BatchScreen({
  t, onNavigate, looks, looksLoading, models, modelsLoading, createModel, createLook,
  createLookWithPhoto, updateLookWithPhoto,
  products, productsLoading, filterProducts, quota,
  createBatch, listBatches, pollBatch, patchBatchItem, removeBatchItem, runBatch, show,
}) {
  const [selectedLook,  setSelectedLook]  = useState(null)
  const [modelBrief,    setModelBrief]    = useState(null)
  const [batchAspect,   setBatchAspect]   = useState('3:4 STORE')
  const [batchPoses,    setBatchPoses]    = useState(['three-quarter','full-body','detail'])
  const [batchParallel, setBatchParallel] = useState('4 at a time')
  const [selected,      setSelected]      = useState([])
  const [varyOn,        setVaryOn]        = useState(false)

  // Product rows shown in the table — starts as the whole catalogue, narrowed
  // by the "Add products" quick filters.
  const [rows,        setRows]        = useState([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [rowFilter,   setRowFilter]   = useState('')
  const [sourceFilter,setSourceFilter]= useState('any')

  // productId -> { look_id, model_id, look_override_name, model_override_name }
  const [overrides, setOverrides] = useState({})

  const [batch,      setBatch]      = useState(null)
  const [running,    setRunning]    = useState(false)
  const [savingDraft,setSavingDraft]= useState(false)

  const [poseLibrary,   setPoseLibrary]   = useState(POSE_LIBRARY_DEFAULT)
  const [posePresets,   setPosePresets]   = useState(POSE_PRESETS_DEFAULT)

  const [showLookSheet,    setShowLookSheet]    = useState(false)
  const [showLookEditor,   setShowLookEditor]   = useState(false)
  const [showModelSheet,   setShowModelSheet]   = useState(false)
  const [showAspectSheet,  setShowAspectSheet]  = useState(false)
  const [showVariants,     setShowVariants]     = useState(false)
  const [showParallel,     setShowParallel]     = useState(false)
  const [showVary,         setShowVary]         = useState(false)
  const [rowSheet,         setRowSheet]         = useState(null)
  const [showAddProducts,  setShowAddProducts]  = useState(false)
  const [showSourceFilter, setShowSourceFilter] = useState(false)
  const [showSessions,     setShowSessions]     = useState(false)
  const [sessions,         setSessions]         = useState([])
  const [sessionsLoading,  setSessionsLoading]  = useState(false)
  const [draftPoses,       setDraftPoses]       = useState(['three-quarter','full-body','detail'])
  const [showCustomPoseForm, setShowCustomPoseForm] = useState(false)
  const [customPoseName,    setCustomPoseName]    = useState('')
  const [customPoseDesc,    setCustomPoseDesc]    = useState('')
  const [showSavePresetForm, setShowSavePresetForm] = useState(false)
  const [presetNameDraft,    setPresetNameDraft]    = useState('')
  const [draftAspect,      setDraftAspect]      = useState('3:4 STORE')
  const [draftParallel,    setDraftParallel]    = useState('4 at a time')
  const [draftLook,        setDraftLook]        = useState(null)
  const [draftRowLook,     setDraftRowLook]     = useState(null)
  const [draftRowModel,    setDraftRowModel]    = useState(null)

  // Seed the table from the catalogue, pre-selecting everything that already
  // has a photo to shoot from.
  useEffect(() => {
    if (rows.length || products.length === 0) return
    setRows(products)
    setSelected(products.filter(p => p.main_photo).map(p => p.id))
  }, [products, rows.length])

  useEffect(() => {
    if (selectedLook || looks.length === 0) return
    setSelectedLook((looks.find(l => l.is_default) || looks[0]).id)
  }, [looks, selectedLook])

  useEffect(() => {
    if (modelBrief || models.length === 0) return
    const def = models.find(m => m.is_default) || models[0]
    setModelBrief({ id: def.id, skin: def.skin, age: def.age, body: def.body, hair: def.hair, pose: def.pose })
  }, [models, modelBrief])

  // Poll a running batch until every item settles.
  useEffect(() => {
    if (!batch || !running) return
    let alive = true
    const timer = setInterval(async () => {
      const res = await pollBatch(batch.id)
      if (!alive) return
      if (res.success && res.data) {
        setBatch(res.data)
        const p = res.data.progress || {}
        const outstanding = (p.queued || 0) + (p.processing || 0)
        if (outstanding === 0) setRunning(false)
      }
    }, POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [batch?.id, running])

  const currentLook  = looks.find(l => l.id === selectedLook)
  const currentModel = modelBrief?.id ? models.find(m => m.id === modelBrief.id) : null
  const quotaLeft    = quota ? Math.max(0, (quota.limit ?? 0) - (quota.used ?? 0)) : null
  const steps        = [t('ais.batch.step.pick_products', 'Pick products'), t('ais.batch.step.shared_brief', 'Set shared brief'), t('ais.batch.step.generate', 'Generate'), t('ais.batch.step.review', 'Review & publish')]
  const currentStep  = batch ? (running ? 3 : 4) : 2

  const itemByProduct = pid => (batch?.items || []).find(i => i.product_id === pid)

  const visibleRows = rows.filter(p => {
    const q = rowFilter.trim().toLowerCase()
    if (q && ![p.name, p.sku, p.brand_name].filter(Boolean).some(v => v.toLowerCase().includes(q))) return false
    if (sourceFilter === 'ready'   && !p.main_photo) return false
    if (sourceFilter === 'missing' && p.main_photo)  return false
    return true
  })

  function togglePose(id) {
    setDraftPoses(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= POSE_CAP) { show(t('ais.batch.err_max_poses', 'Max {{n}} poses — deselect one first.', { n: POSE_CAP })); return prev }
      return [...prev, id]
    })
  }

  function handleAddCustomPose() {
    if (!customPoseName.trim()) { show(t('ais.batch.err_pose_name', 'Give the pose a name.')); return }
    if (draftPoses.length >= POSE_CAP) { show(t('ais.batch.err_max_poses_custom', 'Max {{n}} poses — deselect one before adding a custom pose.', { n: POSE_CAP })); return }
    const id = 'pose-' + Date.now()
    setPoseLibrary(prev => [...prev, { id, name: customPoseName.trim(), desc: customPoseDesc.trim() || t('ais.batch.custom_pose_fallback', 'Custom pose'), builtin:false }])
    setDraftPoses(prev => [...prev, id])
    setShowCustomPoseForm(false)
    setCustomPoseName('')
    setCustomPoseDesc('')
    show(t('ais.batch.toast_pose_added', 'Pose added'), 'success')
  }

  function confirmSavePreset() {
    if (draftPoses.length === 0) { show(t('ais.batch.err_select_poses', 'Select some poses first.')); return }
    if (!presetNameDraft.trim()) { show(t('ais.batch.err_preset_name', 'Give the preset a name.')); return }
    setPosePresets(prev => [...prev, { id: 'preset-' + Date.now(), name: presetNameDraft.trim(), poseIds: [...draftPoses], builtin:false }])
    show(t('ais.batch.toast_preset_saved', 'Preset saved'), 'success')
    setShowSavePresetForm(false)
    setPresetNameDraft('')
  }

  function toggleProduct(id) {
    if (batch) { show(t('ais.batch.err_already_created_toggle', 'This session is already created — remove the row instead.')); return }
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function batchPayload(status) {
    return {
      status,
      product_ids: selected,
      look_id:     selectedLook,
      model_id:    modelBrief?.id || null,
      aspect:      aspectValue(batchAspect),
      poses:       batchPoses,
      parallel:    parallelValue(batchParallel),
      vary_model:  varyOn,
    }
  }

  // Creates the batch and flushes any locally-held per-row overrides onto it.
  async function ensureBatch(status = 'draft') {
    if (batch) return batch
    if (selected.length === 0) { show(t('ais.batch.err_select_product', 'Select at least one product.')); return null }
    if (!selectedLook)         { show(t('ais.batch.err_pick_look', 'Pick a studio look first.'));    return null }

    const res = await createBatch(batchPayload(status))
    if (!res.success) { show(res.message || t('ais.batch.err_create', 'Could not create the batch session')); return null }

    const created = res.data
    const pending = Object.entries(overrides).filter(([pid]) => selected.includes(pid))
    for (const [pid, body] of pending) {
      await patchBatchItem(created.id, pid, body)
    }
    const hydrated = pending.length ? await pollBatch(created.id) : null
    const final = hydrated?.success ? hydrated.data : created
    setBatch(final)
    return final
  }

  async function handleSaveDraft() {
    setSavingDraft(true)
    const b = await ensureBatch('draft')
    setSavingDraft(false)
    if (b) show(t('ais.batch.toast_draft_saved', 'Batch session saved as a draft'), 'success')
  }

  async function handleRunBatch() {
    const b = await ensureBatch('draft')
    if (!b) return
    setRunning(true)
    const res = await runBatch(b.id)
    if (res.success) {
      setBatch(res.data)
      const p = res.data?.progress || {}
      if ((p.queued || 0) + (p.processing || 0) === 0) setRunning(false)
      show(res.message || t('ais.batch.toast_run_complete', 'Batch run complete'), 'success')
    } else {
      setRunning(false)
      show(res.message || t('ais.batch.err_run_failed', 'Batch run failed'))
    }
  }

  async function applyQuickFilter(filter, label) {
    setShowAddProducts(false)
    setRowsLoading(true)
    const res = await filterProducts(filter)
    setRowsLoading(false)
    if (!res.success) { show(res.message || t('ais.batch.err_load_list', 'Could not load that list')); return }
    const list = res.data?.products || []
    setRows(list)
    setSelected(list.filter(p => p.main_photo).map(p => p.id))
    setBatch(null)
    show(t('ais.batch.toast_filter_applied', '{{n}} product(s) · {{label}}', { n: list.length, label }), 'success')
  }

  function openSessions() {
    setShowSessions(true)
    setSessionsLoading(true)
    listBatches().then(res => {
      setSessions(res.success ? (res.data || []) : [])
      setSessionsLoading(false)
    })
  }

  // Past-session rows omit items[], so re-fetch the full record before hydrating.
  async function loadSession(row) {
    const res = await pollBatch(row.id)
    if (!res.success) { show(res.message || t('ais.batch.err_open_session', 'Could not open that session')); return }
    const b = res.data
    setBatch(b)
    setShowSessions(false)
    if (b.look_id)  setSelectedLook(b.look_id)
    if (b.aspect)   setBatchAspect(aspectLabel(b.aspect, t))
    if (Array.isArray(b.poses) && b.poses.length) setBatchPoses(b.poses)
    if (b.parallel) setBatchParallel(`${b.parallel} at a time`)
    setVaryOn(!!b.vary_model)
    if (b.model_id) {
      const m = models.find(x => x.id === b.model_id)
      if (m) setModelBrief({ id:m.id, skin:m.skin, age:m.age, body:m.body, hair:m.hair, pose:m.pose })
    }
    const itemIds = (b.items || []).map(i => i.product_id)
    setSelected(itemIds)
    setRows(products.filter(p => itemIds.includes(p.id)))
    setOverrides(Object.fromEntries((b.items || [])
      .filter(i => i.look_id || i.model_id)
      .map(i => [i.product_id, { look_id:i.look_id, model_id:i.model_id, look_override_name:i.look_override_name, model_override_name:i.model_override_name }])))
    const p = b.progress || {}
    setRunning((p.queued || 0) + (p.processing || 0) > 0)
    show(t('ais.batch.toast_session_loaded', 'Session loaded · {{n}} products', { n: itemIds.length }), 'success')
  }

  async function saveRowOverride() {
    const pid = rowSheet.id
    const body = {
      look_id:             draftRowLook,
      model_id:            draftRowModel,
      look_override_name:  draftRowLook  ? looks.find(l => l.id === draftRowLook)?.name  || null : null,
      model_override_name: draftRowModel ? models.find(m => m.id === draftRowModel)?.name || null : null,
    }
    setOverrides(prev => {
      const next = { ...prev }
      if (!draftRowLook && !draftRowModel) delete next[pid]
      else next[pid] = body
      return next
    })
    if (batch) {
      const res = await patchBatchItem(batch.id, pid, body)
      if (!res.success) { show(res.message || t('ais.batch.err_save_override', 'Could not save the override')); return }
      show(res.message || t('ais.batch.toast_override_saved', 'Override saved'), 'success')
    } else {
      show(t('ais.batch.toast_override_pending', 'Override saved — applied when the session is created'), 'success')
    }
    setRowSheet(null)
  }

  async function removeRow(pid) {
    if (batch) {
      const res = await removeBatchItem(batch.id, pid)
      if (!res.success) { show(res.message || t('ais.batch.err_remove_product', 'Could not remove that product')); return }
      setBatch(prev => prev ? { ...prev, items: (prev.items || []).filter(i => i.product_id !== pid) } : prev)
    }
    setSelected(prev => prev.filter(x => x !== pid))
    setOverrides(prev => { const n = { ...prev }; delete n[pid]; return n })
    setRowSheet(null)
    show(t('ais.batch.toast_removed', 'Removed from this batch'), 'success')
  }

  const ASPECT_OPTS = [
    { val:'3:4 STORE',    desc:t('ais.batch.aspect_opt.3:4.desc', 'Default for product pages. Reads well on phone and tablet.') },
    { val:'1:1 CATALOGUE',desc:t('ais.batch.aspect_opt.1:1.desc', 'Square format for uniform catalogue grids.') },
    { val:'9:16 SOCIAL',  desc:t('ais.batch.aspect_opt.9:16.desc', 'Vertical for Instagram Stories, Reels, TikTok.') },
    { val:'4:5 INSTAGRAM',desc:t('ais.batch.aspect_opt.4:5.desc', 'Optimal feed crop for Instagram posts.') },
  ]

  const PARALLEL_OPTS = [
    { val:'1 at a time', desc:t('ais.batch.parallel_opt.1.desc', 'Slowest but most forgiving of rate limits') },
    { val:'2 at a time', desc:t('ais.batch.parallel_opt.2.desc', 'Balanced throughput') },
    { val:'4 at a time', desc:t('ais.batch.parallel_opt.4.desc', 'Recommended for most sessions') },
    { val:'8 at a time', desc:t('ais.batch.parallel_opt.8.desc', 'Fastest · may hit FASHN rate limits') },
  ]

  const progress = batch?.progress || null

  return (
    <div>
      <div className="batch-head">
        <div>
          <h1>{t('ais.batch.h1_pre', 'Batch')} <em>{t('ais.batch.h1_em', 'session')}</em></h1>
          <p className="batch-head-sub">{t('ais.batch.h1_sub', 'Generate on-model images for many products at once. Pick a shared studio look and model — adjust per-product before you run.')}</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          {batch ? (
            <button className="btn btn-outline btn-sm" disabled={running}
              onClick={() => { setBatch(null); setOverrides({}); setRunning(false); show(t('ais.batch.toast_new_session', 'New session — pick products and a brief, then run'), 'success') }}>
              <span className="material-symbols-outlined">add</span>{t('ais.batch.new_session', 'New session')}
            </button>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={handleSaveDraft} disabled={savingDraft}>
              <span className="material-symbols-outlined">save</span>{savingDraft ? t('ais.common.saving', 'Saving…') : t('ais.batch.save_draft', 'Save draft')}
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={openSessions}><span className="material-symbols-outlined">history</span>{t('ais.batch.past_sessions', 'Past sessions')}</button>
        </div>
      </div>

      <div className="batch-stepper">
        {steps.map((s,i) => (
          <div key={s} style={{display:'flex',alignItems:'center',flex:i<steps.length-1?1:'auto'}}>
            <div className={`bstep${i+1<currentStep?' done':''}${i+1===currentStep?' active':''}`}>
              <div className="bstep-num">{i+1<currentStep?<span className="material-symbols-outlined" style={{fontSize:14}}>check</span>:i+1}</div>
              <div className="bstep-label">{s}</div>
            </div>
            {i<steps.length-1&&<div className={`bstep-sep${i+1<currentStep?' done':''}`}/>}
          </div>
        ))}
      </div>

      <div className="batch-layout">
        <div className="batch-side">
          <div className="batch-side-title">{t('ais.batch.shared_pre', 'Shared')} <em>{t('ais.batch.shared_em', 'brief')}</em></div>
          <div className="batch-shared">
            <span className="material-symbols-outlined">{batch ? 'lock' : 'tips_and_updates'}</span>
            <div className="batch-shared-body">
              {batch
                // The API has no batch-update endpoint — the brief is baked in at
                // creation, so say so rather than letting edits silently no-op.
                ? <>{t('ais.batch.shared_note_created_pre', 'This session is')} <strong>{t('ais.batch.shared_note_created_bold', 'already created')}</strong>{t('ais.batch.shared_note_created_end', ', so the shared brief is locked in. Per-row overrides still apply. Start a new session to change the brief.')}</>
                : <>{t('ais.batch.shared_note_open_pre', 'These settings apply to')} <strong>{t('ais.batch.shared_note_open_bold', 'all {{n}} selected products', { n: selected.length })}</strong> {t('ais.batch.shared_note_open_end', 'You can override per-row before generating.')}</>}
            </div>
          </div>

          <div className="batch-side-row" style={{cursor:'pointer'}} onClick={() => { setDraftLook(selectedLook); setShowLookSheet(true) }}>
            <div className="batch-side-row-label">{t('ais.gen.studio_look', 'Studio look')}</div>
            <div className="batch-side-row-value">
              <div style={{width:18,height:18,borderRadius: 0,...lookThumbStyle(currentLook),flexShrink:0}} />
              <span>{currentLook?.name || '—'}</span>
              <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)',marginLeft:'auto'}}>chevron_right</span>
            </div>
          </div>

          <div className="batch-side-row" style={{cursor:'pointer'}} onClick={() => setShowModelSheet(true)}>
            <div className="batch-side-row-label">{t('ais.batch.model_brief', 'Model brief')}</div>
            <div className="batch-side-row-value">
              <div style={{width:22,height:22,borderRadius: 0,background:'linear-gradient(135deg,#D4AF72,#8A6A30)',backgroundSize:'cover',backgroundPosition:'center',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:9,fontWeight:700,flexShrink:0,
                ...(currentModel?.custom_photo_url ? {backgroundImage:`url('${toDisplayUrl(currentModel.custom_photo_url)}')`} : {})}}>
                {!currentModel?.custom_photo_url && modelInitials(currentModel?.name || t('ais.gen.custom', 'Custom'))}
              </div>
              <span>{currentModel?.name?.split(' ')[0] || t('ais.gen.custom', 'Custom')} {currentModel ? t('ais.batch.house_model_tag', '(house model)') : ''}</span>
              <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)',marginLeft:'auto'}}>chevron_right</span>
            </div>
          </div>

          <div className="batch-side-row" style={{cursor:'pointer'}} onClick={() => { setDraftAspect(batchAspect); setShowAspectSheet(true) }}>
            <div className="batch-side-row-label">{t('ais.gen.aspect_ratio', 'Aspect ratio')}</div>
            <div className="batch-side-row-value">
              <span>{batchAspect}</span>
              <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)',marginLeft:'auto'}}>chevron_right</span>
            </div>
          </div>

          <div className="batch-side-row" style={{cursor:'pointer'}} onClick={() => { setDraftPoses(batchPoses); setShowVariants(true) }}>
            <div className="batch-side-row-label">{t('ais.batch.variants_per_product', 'Variants per product')}</div>
            <div className="batch-side-row-value">
              <span>{t('ais.batch.n_poses', '{{n}} poses', { n: batchPoses.length })}</span>
              <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)',marginLeft:'auto'}}>chevron_right</span>
            </div>
          </div>

          <div className="batch-side-row" style={{cursor:'pointer'}} onClick={() => { setDraftParallel(batchParallel); setShowParallel(true) }}>
            <div className="batch-side-row-label">{t('ais.batch.run_in_parallel', 'Run in parallel')}</div>
            <div className="batch-side-row-value">
              <span>{batchParallel}</span>
              <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)',marginLeft:'auto'}}>chevron_right</span>
            </div>
          </div>

          <div className="diversity-note" style={{marginTop:18}}>
            <div className="diversity-note-icon"><span className="material-symbols-outlined">groups</span></div>
            <div className="diversity-note-body">
              <strong>{t('ais.batch.vary_bold', 'Vary model across batch?')}</strong> {t('ais.batch.vary_currently', 'Currently')} <strong>{varyOn ? t('ais.common.on', 'on') : t('ais.common.off', 'off')}</strong>. {t('ais.batch.vary_note', "When on, the run distributes products across your saved house models so the batch doesn't read as one model in many outfits.")}
              <div style={{marginTop:8,fontSize:'9.5px',fontWeight:700,color:'var(--gold)',cursor:'pointer'}} onClick={() => setShowVary(true)}>{t('ais.batch.toggle_variation', 'Toggle variation →')}</div>
            </div>
          </div>
        </div>

        <div className="batch-main">
          <div className="batch-toolbar">
            <div className="batch-toolbar-left">
              <div className={`batch-checkbox${selected.length===visibleRows.length&&visibleRows.length>0?' checked':''}`}
                onClick={() => { if (batch) return; setSelected(selected.length===visibleRows.length ? [] : visibleRows.map(p => p.id)) }}/>
              <div className="batch-select-count">{t('ais.batch.selected_of', '{{sel}} of {{total}} products selected', { sel: selected.length, total: rows.length })}</div>
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <div className="batch-toolbar-search">
                <span className="material-symbols-outlined">search</span>
                <input placeholder={t('ais.batch.filter_ph', 'Filter…')} value={rowFilter} onChange={e => setRowFilter(e.target.value)} />
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowSourceFilter(true)}>
                <span className="material-symbols-outlined">filter_list</span>
                {t('ais.batch.source_filter', 'Source: {{val}}', { val: sourceFilter==='any'?t('ais.batch.source_any','any'):sourceFilter==='ready'?t('ais.batch.source_filter_ready','ready'):t('ais.batch.source_missing','missing') })}
              </button>
              <button className="btn-batch-add" onClick={() => setShowAddProducts(true)}><span className="material-symbols-outlined">add</span>{t('ais.batch.add_products', 'Add products')}</button>
            </div>
          </div>

          <div className="batch-rows">
            {(rowsLoading || productsLoading) && rows.length === 0 && (
              <div style={{padding:24,fontSize:11,color:'var(--stone)'}}>{t('ais.batch.loading_products', 'Loading products…')}</div>
            )}
            {!rowsLoading && visibleRows.length === 0 && rows.length > 0 && (
              <div style={{padding:24,fontSize:11,color:'var(--stone)',textAlign:'center'}}>{t('ais.batch.no_match_filter', 'No products match that filter.')}</div>
            )}
            {visibleRows.map(p => {
              const item     = itemByProduct(p.id)
              const ov       = overrides[p.id]
              const failure  = item ? generationError(item) : ''
              const status   = item?.status || 'queued'
              const statusLabel = item
                ? (status === 'failed' ? t('ais.batch.status.failed', 'FAILED') : t(`ais.batch.status.${status}`, status.toUpperCase()))
                : (p.main_photo ? t('ais.batch.status.ready', 'READY') : t('ais.batch.status.needs_upload', 'NEEDS UPLOAD'))
              const statusCls = item
                ? (status === 'done' ? 'done' : status === 'failed' ? 'failed' : status === 'processing' ? 'processing' : 'queued')
                : (p.main_photo ? 'queued' : 'failed')
              return (
                <div key={p.id} className={`batch-row${selected.includes(p.id)?' selected':''}`}>
                  <div className={`batch-checkbox${selected.includes(p.id)?' checked':''}`} onClick={() => toggleProduct(p.id)}/>
                  <div className="batch-row-img" style={p.main_photo?{backgroundImage:`url('${p.main_photo}')`}:{background:'var(--mist)'}}/>
                  <div className="batch-row-info">
                    <div className="batch-row-name">{p.name}</div>
                    <div className="batch-row-meta">
                      {[p.brand_name, p.sku, p.retail_price?`€${p.retail_price}`:null].filter(Boolean).join(' · ')}
                      {ov && <span style={{color:'var(--gold)',fontWeight:700}}> · {t('ais.batch.overridden', 'overridden')}</span>}
                    </div>
                  </div>
                  <div className="batch-row-stock"><strong>{t('ais.batch.n_in_stock', '{{n}} in stock', { n: productStock(p) })}</strong></div>
                  <div className={`batch-row-source${p.main_photo?' has-image':' no-image'}`}>
                    <span className="material-symbols-outlined">{p.main_photo?'check_circle':'warning'}</span>
                    {p.main_photo ? t('ais.batch.source_ready', 'Source ready') : t('ais.batch.no_source', 'No source image')}
                  </div>
                  <div className={`batch-row-status ${statusCls}`} title={failure || ''}>{statusLabel}</div>
                  <span className="material-symbols-outlined" style={{color:'var(--stone)',fontSize:18,cursor:'pointer'}}
                    onClick={() => { setDraftRowLook(ov?.look_id || null); setDraftRowModel(ov?.model_id || null); setRowSheet(p) }}>more_vert</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="batch-summary-bar">
        <div className="batch-summary-left">
          <div>
            <div className="batch-summary-stat-label">{t('ais.batch.summary.selected', 'SELECTED')}</div>
            <div className="batch-summary-stat-value">{selected.length}</div>
            <div className="batch-summary-stat-sub">{t('ais.batch.summary.products_variants', 'products · {{n}} variants total', { n: selected.length*batchPoses.length })}</div>
          </div>
          <div style={{width:1,height:36,background:'rgba(245,240,232,0.15)'}}/>
          <div>
            <div className="batch-summary-stat-label">{t('ais.batch.summary.quota', 'QUOTA')}</div>
            <div className="batch-summary-stat-value">{selected.length} <em>/ {quotaLeft ?? '—'}</em></div>
            <div className="batch-summary-stat-sub">
              {quotaLeft === null ? t('ais.batch.summary.checking_quota', 'checking quota…')
                : selected.length > quotaLeft ? t('ais.batch.summary.over_quota', '{{n}} over your remaining quota', { n: selected.length - quotaLeft })
                : t('ais.batch.summary.leaves_quota', 'leaves {{n}} after this run', { n: quotaLeft - selected.length })}
            </div>
          </div>
          <div style={{width:1,height:36,background:'rgba(245,240,232,0.15)'}}/>
          <div>
            <div className="batch-summary-stat-label">{progress ? t('ais.batch.summary.progress', 'PROGRESS') : t('ais.batch.summary.parallel', 'PARALLEL')}</div>
            <div className="batch-summary-stat-value">
              {progress ? <>{progress.done || 0}<em>/{progress.total || 0}</em></> : <>{parallelValue(batchParallel)}<em>{t('ais.batch.summary.at_once', 'at once')}</em></>}
            </div>
            <div className="batch-summary-stat-sub">
              {progress ? t('ais.batch.summary.failed_queued', '{{failed}} failed · {{queued}} queued', { failed: progress.failed || 0, queued: progress.queued || 0 }) : t('ais.batch.summary.running_n', 'running {{n}}', { n: batchParallel })}
            </div>
          </div>
        </div>
        <button className="btn-batch-generate" onClick={handleRunBatch} disabled={running||selected.length===0||!selectedLook}>
          <span className="material-symbols-outlined">play_arrow</span>
          {running ? t('ais.batch.running', 'Running…') : t('ais.batch.run_batch_n', 'Run batch · {{n}} products', { n: selected.length })}
        </button>
      </div>

      <ProcessingModal
        t={t}
        open={running}
        lead={t('ais.batch.processing_lead', 'Running your')}
        em={t('ais.batch.processing_em', 'batch')}
        statusLine={progress
          ? t('ais.batch.processing_status', '{{done}} done · {{proc}} in flight · {{queued}} queued · {{failed}} failed', { done: progress.done || 0, proc: progress.processing || 0, queued: progress.queued || 0, failed: progress.failed || 0 })
          : t('ais.batch.processing_queueing', 'Queueing products…')}
        progressPct={progress && progress.total ? Math.round(((progress.done || 0) + (progress.failed || 0) + (progress.skipped || 0)) / progress.total * 100) : 0}
        note={t('ais.batch.n_at_a_time', '{{n}} at a time', { n: parallelValue(batchParallel) })}
        onCancel={() => setRunning(false)}
        cancelLabel={t('ais.batch.stop_watching', 'Stop watching')}
      />

      <Sheet t={t} open={showLookSheet} onClose={() => setShowLookSheet(false)}
        tag={t('ais.batch.look_sheet.tag', 'EDIT · STUDIO LOOK · BATCH')}
        title={t('ais.batch.look_sheet.title', 'Studio <em>look</em>')}
        sub={t('ais.batch.look_sheet.sub', 'Applies to all {{n}} selected products. You can override per-row before generating.', { n: selected.length })}
        foot={t('ais.batch.applies_selected', 'Applies to all <strong>selected products</strong>.')}
        confirmLabel={t('ais.batch.look_sheet.apply', 'Apply look')}
        onConfirm={() => { setSelectedLook(draftLook); setShowLookSheet(false) }}>
        <div className="sheet-section">
          <div className="sheet-section-label">{t('ais.batch.preset_looks_pre', 'Preset')} <em>{t('ais.batch.preset_looks_em', 'looks')}</em></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {looksLoading && looks.length === 0 && <div className="brief-row-sub">{t('ais.gen.loading_looks2', 'Loading looks…')}</div>}
            {looks.map(l => (
              <div key={l.id} onClick={() => setDraftLook(l.id)}
                style={{borderRadius: 0,border:`1.5px solid ${draftLook===l.id?'var(--gold)':'var(--mist)'}`,background:'var(--white)',cursor:'pointer',overflow:'hidden',transition:'all 0.15s'}}>
                <div style={{height:140, ...lookThumbStyle(l)}}/>
                <div style={{padding:'10px 12px'}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:3,display:'flex',alignItems:'center',gap:6}}>
                    {l.name}
                    {l.is_default && <span style={{fontSize:'7px',fontWeight:700,background:'var(--gold)',color:'var(--deep)',padding:'1px 5px',borderRadius: 0,letterSpacing:'0.4px'}}>{t('ais.common.default_badge', 'DEFAULT')}</span>}
                  </div>
                  <div style={{fontSize:9.5,color:'var(--gold)',lineHeight:1.4}}>{lookDescLine(l, t)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="look-card look-card-add" style={{marginTop:10,minHeight:56}} onClick={() => setShowLookEditor(true)} title={t('ais.gen.create_look_title', 'Create a new studio look')}>
            <div className="look-card-addbox">
              <span className="material-symbols-outlined">add</span>
              <div className="look-card-addlabel">{t('ais.batch.create_new_look', 'Create a new look')}</div>
            </div>
          </div>
        </div>
      </Sheet>

      <ModelBriefSheet
        t={t}
        open={showModelSheet}
        onClose={() => setShowModelSheet(false)}
        models={models}
        modelsLoading={modelsLoading}
        brief={modelBrief}
        createModel={createModel}
        show={show}
        onApply={setModelBrief}
        onNavigateToBrand={() => { setShowModelSheet(false); show(t('ais.gen.toast_create_from_brand', 'Create new models from Brand setup'), 'info'); onNavigate('brand') }}
        tag={t('ais.batch.model_sheet.tag', 'EDIT · MODEL BRIEF · BATCH')}
        sub={t('ais.batch.model_sheet.sub', 'Applies to all {{n}} selected products. Pick a saved model or fine-tune attributes — preview updates live.', { n: selected.length })}
        foot={t('ais.batch.applies_selected', 'Applies to all <strong>selected products</strong>.')}
      />

      <LookEditorSheet
        t={t}
        open={showLookEditor}
        onClose={() => setShowLookEditor(false)}
        editingLook={null}
        createLook={createLook}
        createLookWithPhoto={createLookWithPhoto}
        updateLookWithPhoto={updateLookWithPhoto}
        show={show}
        onSaved={newLook => { setSelectedLook(newLook.id); setDraftLook(newLook.id) }}
      />

      <Sheet t={t} open={showAspectSheet} onClose={() => setShowAspectSheet(false)}
        tag={t('ais.batch.aspect_sheet.tag', 'EDIT · ASPECT RATIO')}
        title={t('ais.batch.aspect_sheet.title', 'Aspect <em>ratio</em>')}
        sub={t('ais.batch.aspect_sheet.sub', 'Applied to all {{n}} selected products.', { n: selected.length })}
        foot={t('ais.batch.aspect_sheet.foot', 'Pro tip: pick one ratio per shoot and stay consistent across the season.')}
        confirmLabel={t('ais.common.apply', 'Apply')}
        onConfirm={() => { setBatchAspect(draftAspect); setShowAspectSheet(false) }}>
        <div className="sheet-section" style={{display:'flex',flexDirection:'column',gap:9}}>
          {ASPECT_OPTS.map(o => (
            <div key={o.val} onClick={() => setDraftAspect(o.val)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',borderRadius: 0,cursor:'pointer',border:`1.5px solid ${draftAspect===o.val?'var(--gold)':'transparent'}`,background:draftAspect===o.val?'rgba(184,149,90,0.1)':'var(--cream)'}}>
              <div>
                <div className="num-row-label" dangerouslySetInnerHTML={{__html:`<strong>${o.val.split(' ')[0]}</strong> · ${t(`ais.aspect_word.${o.val.split(' ')[0]}`, o.val.split(' ').slice(1).join(' '))}`}}/>
                <div className="num-row-sub">{o.desc}</div>
              </div>
              <span className="material-symbols-outlined" style={{color:draftAspect===o.val?'var(--gold)':'var(--mist)'}}>{draftAspect===o.val?'check_circle':'radio_button_unchecked'}</span>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet t={t} open={showVariants} onClose={() => { setShowVariants(false); setShowCustomPoseForm(false); setShowSavePresetForm(false) }}
        tag={t('ais.batch.poses_sheet.tag', 'EDIT · POSES')}
        title={t('ais.batch.poses_sheet.title', 'Poses <em>per product</em>')}
        sub={t('ais.batch.poses_sheet.sub', 'Choose which poses to generate for each product in the batch. More poses means more variety and more quota.')}
        foot={t('ais.batch.poses_sheet.foot', 'Each <strong>generation</strong> is one quota unit; the selected poses are bundled into it. Max {{cap}} per shoot.', { cap: POSE_CAP })}
        confirmLabel={t('ais.batch.poses_sheet.apply', 'Apply poses')}
        onConfirm={() => {
          if (draftPoses.length === 0) { show(t('ais.batch.err_need_pose', 'A shoot needs at least one pose.')); return }
          setBatchPoses(draftPoses)
          setShowVariants(false)
          setShowCustomPoseForm(false)
          setShowSavePresetForm(false)
        }}>
        <div className="sheet-section">
          <div className="sheet-section-label">{t('ais.batch.quick_count_pre', 'Quick')} <em>{t('ais.batch.quick_count_em', 'count')}</em></div>
          <div className="pose-quicks">
            {[1,3,4].map(n => (
              <button key={n} type="button" className={`pose-quick${draftPoses.length===n?' on':''}`}
                onClick={() => setDraftPoses(POSE_QUICK_ORDER.filter(id => poseLibrary.some(p => p.id === id)).slice(0, n))}>
                {t('ais.batch.n_pose', '{{n}} pose(s)', { n })}
              </button>
            ))}
          </div>
          <div className="pose-quick-note">{t('ais.batch.quick_count_note', 'Auto-selects the most useful poses for that count. Fine-tune below.')}</div>
        </div>

        <div className="sheet-section">
          <div className="sheet-section-label">{t('ais.batch.presets', 'Presets')}</div>
          <div className="pose-presets">
            {posePresets.map(pr => (
              <button key={pr.id} type="button" className="pose-preset" onClick={() => setDraftPoses(pr.poseIds.slice(0, POSE_CAP))}>
                {t(`ais.pose_preset.${pr.id}.name`, pr.name)} <span className="pose-preset-n">{pr.poseIds.length}</span>
              </button>
            ))}
            <button type="button" className="pose-preset pose-preset-save" onClick={() => setShowSavePresetForm(v => !v)}>
              <span className="material-symbols-outlined">bookmark_add</span> {t('ais.batch.save_current', 'Save current')}
            </button>
          </div>
          {showSavePresetForm && (
            <div style={{display:'flex',gap:8,marginTop:10}}>
              <input value={presetNameDraft} onChange={e=>setPresetNameDraft(e.target.value)} placeholder={t('ais.batch.name_pose_set', 'Name this pose set')}
                style={{flex:1,padding:'8px 11px',border:'1px solid var(--mist)',borderRadius:2,fontSize:11.5,fontFamily:'inherit',outline:'none'}} />
              <button type="button" className="pose-flow-save" onClick={confirmSavePreset}>{t('ais.common.save', 'Save')}</button>
              <button type="button" className="pose-flow-cancel" onClick={() => { setShowSavePresetForm(false); setPresetNameDraft('') }}>{t('ais.common.cancel', 'Cancel')}</button>
            </div>
          )}
        </div>

        <div className="sheet-section">
          <div className="sheet-section-label">{t('ais.batch.pose_library_pre', 'Pose')} <em>{t('ais.batch.pose_library_em', 'library')}</em> <span className="pose-count">{t('ais.batch.n_of_cap', '{{n}} of {{cap}}', { n: draftPoses.length, cap: POSE_CAP })}</span></div>
          <div className="pose-list">
            {poseLibrary.map(p => {
              const on = draftPoses.includes(p.id)
              return (
                <button key={p.id} type="button" className={`pose-item${on?' on':''}`} onClick={() => togglePose(p.id)}>
                  <span className="pose-check"><span className="material-symbols-outlined">{on?'check_circle':'radio_button_unchecked'}</span></span>
                  <span className="pose-body">
                    <span className="pose-name">{poseLabel(p.id, t)}{!p.builtin && <span className="pose-custom-tag">{t('ais.batch.custom_tag', 'CUSTOM')}</span>}</span>
                    <span className="pose-desc">{t(`ais.pose_lib.${p.id}.desc`, p.desc)}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {!showCustomPoseForm && (
            <button type="button" className="pose-add" onClick={() => setShowCustomPoseForm(true)}>
              <span className="material-symbols-outlined">add</span> {t('ais.batch.add_custom_pose', 'Add a custom pose')}
            </button>
          )}
          {showCustomPoseForm && (
            <div className="pose-flow">
              <div className="pose-flow-label">{t('ais.batch.pose_name', 'Pose name')}</div>
              <input className="pose-namefield" value={customPoseName} onChange={e=>setCustomPoseName(e.target.value)} placeholder={t('ais.batch.pose_name_ph', "e.g. 'Over-the-shoulder'")} />
              <div className="pose-flow-label">{t('ais.batch.describe_pose', 'Describe the pose')}</div>
              <textarea className="pose-descfield" value={customPoseDesc} onChange={e=>setCustomPoseDesc(e.target.value)} placeholder={t('ais.batch.describe_pose_ph', "e.g. 'Seated on a stool, three-quarter turn, weight on back hip'")} />
              <div className="pose-flow-actions">
                <button type="button" className="pose-flow-cancel" onClick={() => { setShowCustomPoseForm(false); setCustomPoseName(''); setCustomPoseDesc('') }}>{t('ais.common.cancel', 'Cancel')}</button>
                <button type="button" className="pose-flow-save" onClick={handleAddCustomPose}>{t('ais.batch.add_pose_btn', 'Add pose')}</button>
              </div>
            </div>
          )}
        </div>

        <div className="pose-quota">
          <strong>{t('ais.batch.pose_quota_label', 'Batch:')}</strong> {t('ais.batch.pose_quota_line', '{{poses}} pose(s) × {{products}} products · 1 quota unit per product', { poses: draftPoses.length, products: selected.length })}
        </div>
      </Sheet>

      <Sheet t={t} open={showParallel} onClose={() => setShowParallel(false)}
        tag={t('ais.batch.parallel_sheet.tag', 'EDIT · CONCURRENCY')}
        title={t('ais.batch.parallel_sheet.title', 'Run in <em>parallel</em>')}
        sub={t('ais.batch.parallel_sheet.sub', 'How many generations to run at once. Higher numbers finish faster but burn quota the same — this is just about throughput.')}
        foot={t('ais.batch.parallel_sheet.foot', '<strong>4 at a time</strong> is the sweet spot — fast enough for a coffee break, slow enough not to trigger FASHN rate limits.')}
        confirmLabel={t('ais.common.apply', 'Apply')}
        onConfirm={() => { setBatchParallel(draftParallel); setShowParallel(false) }}>
        <div className="sheet-section" style={{display:'flex',flexDirection:'column',gap:9}}>
          {PARALLEL_OPTS.map(o => (
            <div key={o.val} onClick={() => setDraftParallel(o.val)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',borderRadius: 0,cursor:'pointer',border:`1.5px solid ${draftParallel===o.val?'var(--gold)':'transparent'}`,background:draftParallel===o.val?'rgba(184,149,90,0.1)':'var(--cream)'}}>
              <div>
                <div className="num-row-label">{t(`ais.batch.parallel_opt.${o.val.split(' ')[0]}.label`, o.val)}</div>
                <div className="num-row-sub">{o.desc}</div>
              </div>
              <span className="material-symbols-outlined" style={{color:draftParallel===o.val?'var(--gold)':'var(--mist)'}}>{draftParallel===o.val?'check_circle':'radio_button_unchecked'}</span>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet t={t} open={showVary} onClose={() => setShowVary(false)}
        tag={t('ais.batch.vary_sheet.tag', 'EDIT · MODEL VARIATION')}
        title={t('ais.batch.vary_sheet.title', 'Vary model <em>across batch</em>')}
        sub={t('ais.batch.vary_sheet.sub', 'Avoid the "one model in 24 outfits" feel. Sent to the API as vary_model on the batch.')}
        foot={t('ais.batch.vary_sheet.foot', 'When on, the run distributes products across your saved house models. Each product still keeps the same look.')}
        confirmLabel={t('ais.common.apply', 'Apply')}
        onConfirm={() => setShowVary(false)}>
        <div className="sheet-section">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'var(--cream)',borderRadius: 0,cursor:'pointer',marginBottom:18}} onClick={() => setVaryOn(v => !v)}>
            <div>
              <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{t('ais.batch.randomise_model', 'Randomise model across batch')}</div>
              <div style={{fontSize:10,color:'var(--stone)'}}>{t('ais.batch.randomise_model_note', 'Picks from your saved house models to add visual variety')}</div>
            </div>
            <div className={`toggle${varyOn?' on':''}`}><div className="toggle-knob"/></div>
          </div>
          <div className="sheet-section-label">{t('ais.batch.pool_of_pre', 'Pool of')} <em>{t('ais.batch.pool_of_em', 'models')}</em></div>
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {modelsLoading && models.length === 0 && <div className="brief-row-sub">{t('ais.brief.loading_models', 'Loading models…')}</div>}
            {models.length === 0 && !modelsLoading && (
              <div style={{fontSize:11,color:'var(--stone)',padding:14,background:'var(--cream)'}}>{t('ais.batch.no_models_saved', "No house models saved yet — add some in Brand setup and they'll be used here.")}</div>
            )}
            {models.map(m => (
              <div key={m.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--cream)',borderRadius: 0,opacity:varyOn?1:0.55}}>
                <div style={{width:36,height:36,borderRadius: 0,background:'linear-gradient(135deg,#D4AF72,#8A6A30)',backgroundSize:'cover',backgroundPosition:'center',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:13,fontWeight:700,flexShrink:0,
                  ...(m.custom_photo_url ? {backgroundImage:`url('${toDisplayUrl(m.custom_photo_url)}')`} : {})}}>
                  {!m.custom_photo_url && modelInitials(m.name)}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{m.name}</div>
                  <div style={{fontSize:9.5,color:'var(--stone)'}}>{modelTraitsLine(m)}</div>
                </div>
                {m.is_default && <span style={{fontSize:7,fontWeight:700,letterSpacing:'0.6px',background:'var(--gold)',color:'var(--deep)',padding:'2px 5px'}}>{t('ais.common.default_badge', 'DEFAULT')}</span>}
              </div>
            ))}
          </div>
          <div style={{fontSize:10,color:'var(--stone)',lineHeight:1.55,marginTop:12,fontStyle:'italic'}}>
            {t('ais.batch.vary_footnote', 'The whole saved set is used when variation is on — the API picks the distribution, not this screen.')}
          </div>
        </div>
      </Sheet>

      {rowSheet && (
        <Sheet t={t} open={!!rowSheet} onClose={() => setRowSheet(null)}
          tag={t('ais.batch.row_sheet.tag', 'OVERRIDE · ONE PRODUCT')}
          title={t('ais.batch.row_sheet.title', 'Override for <em>{{name}}</em>', { name: (rowSheet.name || '').split('·')[0].trim() })}
          sub={t('ais.batch.row_sheet.sub', 'Depart from the shared brief just for this product. Useful when one piece needs a different model or look.')}
          foot={t('ais.batch.row_sheet.foot', 'Overrides apply <strong>only to this product</strong>. All others keep the shared brief.')}
          confirmLabel={t('ais.batch.row_sheet.save', 'Save override')}
          onConfirm={saveRowOverride}>
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.batch.baseline_pre', 'Shared brief')} <em>{t('ais.batch.baseline_em', 'baseline')}</em></div>
            <div style={{padding:'12px 14px',background:'var(--cream)',borderRadius: 0,fontSize:10.5,lineHeight:1.55}}>
              <strong>{t('ais.batch.baseline_look', 'Look:')}</strong> {currentLook?.name || '—'}<br/>
              <strong>{t('ais.batch.baseline_model', 'Model:')}</strong> {currentModel?.name || t('ais.gen.custom_brief', 'Custom brief')}<br/>
              <strong>{t('ais.batch.baseline_aspect', 'Aspect:')}</strong> {batchAspect} · <strong>{t('ais.batch.baseline_variants', 'Variants:')}</strong> {t('ais.batch.n_poses', '{{n}} poses', { n: batchPoses.length })}
            </div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.batch.override_look_pre', 'Override')} <em>{t('ais.batch.override_look_em', 'look')}</em></div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              <div onClick={() => setDraftRowLook(null)}
                style={{padding:'6px 12px',background:!draftRowLook?'rgba(184,149,90,0.1)':'var(--cream)',borderRadius: 0,fontSize:10.5,fontWeight:600,cursor:'pointer',border:`1.5px solid ${!draftRowLook?'var(--gold)':'var(--mist)'}`}}>{t('ais.batch.use_shared', 'Use shared')}</div>
              {looks.map(l => (
                <div key={l.id} onClick={() => setDraftRowLook(l.id)}
                  style={{padding:'6px 12px',background:draftRowLook===l.id?'rgba(184,149,90,0.1)':'var(--cream)',borderRadius: 0,fontSize:10.5,fontWeight:600,cursor:'pointer',border:`1.5px solid ${draftRowLook===l.id?'var(--gold)':'var(--mist)'}`}}>{l.name}</div>
              ))}
            </div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.batch.override_model_pre', 'Override')} <em>{t('ais.batch.override_model_em', 'model')}</em></div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              <div onClick={() => setDraftRowModel(null)}
                style={{padding:'6px 12px',background:!draftRowModel?'rgba(184,149,90,0.1)':'var(--cream)',borderRadius: 0,fontSize:10.5,fontWeight:600,cursor:'pointer',border:`1.5px solid ${!draftRowModel?'var(--gold)':'var(--mist)'}`}}>{t('ais.batch.use_shared', 'Use shared')}</div>
              {models.map(m => (
                <div key={m.id} onClick={() => setDraftRowModel(m.id)}
                  style={{padding:'6px 12px',background:draftRowModel===m.id?'rgba(184,149,90,0.1)':'var(--cream)',borderRadius: 0,fontSize:10.5,fontWeight:600,cursor:'pointer',border:`1.5px solid ${draftRowModel===m.id?'var(--gold)':'var(--mist)'}`}}>{m.name}</div>
              ))}
            </div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">{t('ais.batch.other_actions_pre', 'Other')} <em>{t('ais.batch.other_actions_em', 'actions')}</em></div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--cream)',borderRadius: 0,cursor:'pointer'}} onClick={() => removeRow(rowSheet.id)}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{t('ais.batch.remove_from_batch', 'Remove from batch')}</div>
                  <div style={{fontSize:9.5,color:'var(--stone)'}}>{t('ais.batch.remove_from_batch_note', "Skip this product · don't generate")}</div>
                </div>
                <span className="material-symbols-outlined" style={{color:'var(--red)',fontSize:18}}>remove_circle</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--cream)',borderRadius: 0,cursor:'pointer'}} onClick={() => { setRowSheet(null); onNavigate('generate') }}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{t('ais.batch.open_single', 'Open in single mode')}</div>
                  <div style={{fontSize:9.5,color:'var(--stone)'}}>{t('ais.batch.open_single_note', 'Shoot this product on its own, with full control')}</div>
                </div>
                <span className="material-symbols-outlined" style={{color:'var(--gold)',fontSize:18}}>open_in_new</span>
              </div>
            </div>
          </div>
        </Sheet>
      )}

      {/* Past sessions */}
      <Sheet t={t} open={showSessions} onClose={() => setShowSessions(false)}
        tag={t('ais.batch.sessions_sheet.tag', 'BATCH · PAST SESSIONS')}
        title={t('ais.batch.sessions_sheet.title', 'Past <em>sessions</em>')}
        sub={t('ais.batch.sessions_sheet.sub', 'Every batch session for this boutique. Open one to reload its brief, products, and per-row overrides.')}
        foot={t('ais.batch.sessions_sheet.foot', "Opening a session <strong>replaces</strong> what's on screen now.")}
        confirmLabel={t('ais.common.done', 'Done')}
        onConfirm={() => setShowSessions(false)}>
        <div className="sheet-section">
          {sessionsLoading && <div className="brief-row-sub">{t('ais.batch.loading_sessions', 'Loading sessions…')}</div>}
          {!sessionsLoading && sessions.length === 0 && (
            <div style={{padding:24,textAlign:'center',color:'var(--stone)',fontSize:11}}>{t('ais.batch.no_sessions_yet', 'No batch sessions yet. Run one and it appears here.')}</div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {sessions.map(s => {
              const p = s.progress || {}
              return (
                <div key={s.id} onClick={() => loadSession(s)}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:batch?.id===s.id?'rgba(184,149,90,0.1)':'var(--cream)',border:`1.5px solid ${batch?.id===s.id?'var(--gold)':'transparent'}`,borderRadius: 0,cursor:'pointer'}}>
                  <div style={{width:22,height:22,borderRadius: 0,flexShrink:0,...lookThumbStyle(looks.find(l => l.id === s.look_id) || { color_grade: s.look_snapshot?.color_grade })}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11.5,fontWeight:700,marginBottom:2}}>
                      {t('ais.batch.session_row_head', '{{name}} · {{n}} product(s)', { name: s.look_snapshot?.name || t('ais.history.custom_look', 'Custom look'), n: p.total || 0 })}
                    </div>
                    <div style={{fontSize:9.5,color:'var(--stone)'}}>
                      {t('ais.batch.session_row_sub', '{{aspect}} · {{n}} poses · {{ago}}', { aspect: s.aspect, n: (s.poses || []).length, ago: timeAgo(s.created_at) })}
                    </div>
                  </div>
                  <div style={{fontSize:8,fontWeight:700,letterSpacing:'0.6px',padding:'3px 6px',
                    color: s.status==='failed' ? 'var(--red)' : s.status==='draft' ? 'var(--stone)' : 'var(--green)',
                    background:'var(--white)'}}>{t(`ais.batch.status.${s.status}`, (s.status || '').toUpperCase())}</div>
                </div>
              )
            })}
          </div>
        </div>
      </Sheet>

      <Sheet t={t} open={showAddProducts} onClose={() => setShowAddProducts(false)}
        tag={t('ais.batch.add_sheet.tag', 'BATCH · ADD PRODUCTS')}
        title={t('ais.batch.add_sheet.title', 'Add <em>products</em>')}
        sub={t('ais.batch.add_sheet.sub', 'Replace the product list with a filtered set from your catalogue. {{n}} currently selected.', { n: selected.length })}
        foot={t('ais.batch.add_sheet.foot', 'Quick adds <strong>replace</strong> the current list rather than appending to it.')}
        confirmLabel={t('ais.common.done', 'Done')}
        onConfirm={() => setShowAddProducts(false)}>
        <div className="sheet-section">
          <div className="sheet-section-label">{t('ais.batch.quick_add_pre', 'Quick')} <em>{t('ais.batch.quick_add_em', 'add')}</em></div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[
              // Only `missing_ai_images` is a confirmed filter value — don't add
              // more here without checking the backend accepts them.
              { filter:'missing_ai_images', label:t('ais.batch.quick_filter.missing_images.label', 'Products missing on-model images'), sub:t('ais.batch.quick_filter.missing_images.sub', 'Only hanger / flat-lay photos so far — the best batch candidates') },
            ].map(a => (
              <div key={a.filter} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--cream)',borderRadius: 0,cursor:'pointer'}}
                onClick={() => applyQuickFilter(a.filter, a.label)}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{a.label}</div>
                  <div style={{fontSize:'9.5px',color:'var(--stone)'}}>{a.sub}</div>
                </div>
                <span className="material-symbols-outlined" style={{color:'var(--gold)',fontSize:18}}>add_circle</span>
              </div>
            ))}
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--cream)',borderRadius: 0,cursor:'pointer'}}
              onClick={() => { setRows(products); setSelected(products.filter(p => p.main_photo).map(p => p.id)); setBatch(null); setShowAddProducts(false) }}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{t('ais.batch.reset_catalogue', 'Reset to full catalogue')}</div>
                <div style={{fontSize:'9.5px',color:'var(--stone)'}}>{t('ais.batch.n_products_loaded', '{{n}} products loaded', { n: products.length })}</div>
              </div>
              <span className="material-symbols-outlined" style={{color:'var(--stone)',fontSize:18}}>restart_alt</span>
            </div>
          </div>
        </div>
        <div className="sheet-section">
          <div className="sheet-section-label">{t('ais.batch.narrow_by_name_pre', 'Narrow')} <em>{t('ais.batch.narrow_by_name_em', 'by name')}</em></div>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',background:'var(--cream)',borderRadius: 0}}>
            <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)'}}>search</span>
            <input value={rowFilter} onChange={e => setRowFilter(e.target.value)}
              style={{border:'none',background:'none',outline:'none',flex:1,fontSize:11,fontFamily:'inherit'}} placeholder={t('ais.picker.search_ph', 'Search name, SKU, or brand…')}/>
          </div>
          <div style={{fontSize:10,color:'var(--stone)',lineHeight:1.5,marginTop:10}}>
            {t('ais.batch.filter_showing', 'Filters the table behind this sheet — {{visible}} of {{total}} products showing.', { visible: visibleRows.length, total: rows.length })}
          </div>
        </div>
      </Sheet>

      <Sheet t={t} open={showSourceFilter} onClose={() => setShowSourceFilter(false)}
        tag={t('ais.batch.source_filter_sheet.tag', 'FILTER · SOURCE IMAGE')}
        title={t('ais.batch.source_filter_sheet.title', 'Filter by <em>source availability</em>')}
        sub={t('ais.batch.source_filter_sheet.sub', 'Show products by whether they have a photo to generate from.')}
        foot={t('ais.batch.source_filter_sheet.foot', "Useful when prepping a batch — filter to 'needs upload' to see what to fix first.")}
        confirmLabel={t('ais.common.done', 'Done')}
        onConfirm={() => setShowSourceFilter(false)}>
        <div className="sheet-section" style={{display:'flex',flexDirection:'column',gap:9}}>
          {[
            { key:'any',     label:t('ais.batch.source_opt.any', 'Any source') },
            { key:'ready',   label:t('ais.batch.source_opt.ready', 'Source image ready') },
            { key:'missing', label:t('ais.batch.source_opt.missing', 'No source image · needs upload') },
          ].map(o => (
            <div key={o.key} onClick={() => setSourceFilter(o.key)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:sourceFilter===o.key?'rgba(184,149,90,0.1)':'var(--cream)',border:`1.5px solid ${sourceFilter===o.key?'var(--gold)':'transparent'}`,borderRadius: 0,cursor:'pointer'}}>
              <div className="num-row-label">{o.label}</div>
              <span className="material-symbols-outlined" style={{color:sourceFilter===o.key?'var(--gold)':'var(--mist)'}}>{sourceFilter===o.key?'check_circle':'radio_button_unchecked'}</span>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

// ── BRAND SCREEN ──────────────────────────────────────────
// House model editor — create + edit + delete against /ai-studio/models.
// persona_id is always sent as null: the backend stores it as a plain display
// column and never resolves it to a photo, and the server's own seed data uses
// null. PERSONAS is only ever a client-side preview lookup.
function ModelEditorSheet({ t, open, onClose, editingModel, createModel, updateModel, deleteModel, createModelWithPhoto, updateModelWithPhoto, show, onSaved, onDeleted }) {
  const isEdit = !!editingModel

  const [name, setName] = useState('')
  const [skin, setSkin] = useState('Mediterranean')
  const [age,  setAge]  = useState('28-32')
  const [body, setBody] = useState('Athletic')
  const [hair, setHair] = useState('Dark · long')
  const [pose, setPose] = useState('Editorial · static')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // The photo is the one field that actually reaches FASHN — it reads the body
  // pose from it. Without one the backend substitutes a labelled placeholder and
  // every shoot renders that instead of a person.
  const [photoUrl,      setPhotoUrl]      = useState('')    // saved path OR pasted link
  const [photoFile,     setPhotoFile]     = useState(null)  // pending file, uploads on save
  const [photoPreview,  setPhotoPreview]  = useState('')    // object URL for the pending file
  const [photoWarn,     setPhotoWarn]     = useState('')
  const [changingPhoto, setChangingPhoto] = useState(false)
  const [linkMode,      setLinkMode]      = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setName(editingModel?.name || '')
    setSkin(editingModel?.skin || 'Mediterranean')
    setAge(editingModel?.age   || '28-32')
    setBody(editingModel?.body || 'Athletic')
    setHair(editingModel?.hair || 'Dark · long')
    setPose(editingModel?.pose || 'Editorial · static')
    setPhotoUrl(editingModel?.custom_photo_url || '')
    setPhotoFile(null); setPhotoPreview(''); setPhotoWarn('')
    setChangingPhoto(false); setLinkMode(false)
    setError('')
  }, [open, editingModel])

  if (!open) return null

  const match = matchPersona({ skin, age, body, hair })

  // What the preview should show, and whether a real photo backs it.
  const heroPhoto  = photoPreview || toDisplayUrl(photoUrl.trim())
  const hasPhoto   = !!(photoFile || photoUrl.trim())
  // Show the picker when creating, when there's nothing on file, or on request.
  const pickerOpen = !isEdit || !photoUrl.trim() || changingPhoto || !!photoFile

  async function handlePickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''   // re-picking the same file must still fire onChange
    if (!file) return
    setError('')
    if (!PHOTO_TYPES.includes(file.type)) { setError(t('ais.photo.err_type', 'Choose a JPEG, PNG, or WebP image.')); return }
    if (file.size > PHOTO_MAX_BYTES) {
      setError(t('ais.photo.err_size', 'That file is {{mb}}MB — the limit is 10MB.', { mb: (file.size/1024/1024).toFixed(1) })); return
    }
    const info = await inspectPhoto(file)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(info.url)
    setPhotoWarn(photoWarning(info, t))
    setLinkMode(false)
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null); setPhotoPreview(''); setPhotoWarn('')
  }

  async function handleSave() {
    if (!name.trim()) { setError(t('ais.model_sheet.err_name', 'Give the model a name before saving.')); return }
    setSaving(true); setError('')
    const payload = { name: name.trim(), persona_id: null, skin, age, body, hair, pose }
    const link = photoUrl.trim()
    // A picked file goes multipart; otherwise the link (or null to clear) rides
    // along as JSON.
    const res = photoFile
      ? (isEdit ? await updateModelWithPhoto(editingModel.id, payload, photoFile)
                : await createModelWithPhoto({ ...payload, is_default:false }, photoFile))
      : (isEdit ? await updateModel(editingModel.id, { ...payload, custom_photo_url: link || null })
                : await createModel({ ...payload, is_default:false, custom_photo_url: link || null }))
    setSaving(false)

    // A multipart PUT to /models/:id currently returns 200 "House model updated"
    // while ignoring the body entirely — the file AND the text fields are
    // dropped, so nothing changes. POST (create) with multipart works, and PUT
    // with JSON works; it is specifically PUT + multipart that is broken on the
    // deployed backend. Never report a success we can't see in the response.
    if (res.success && isEdit && photoFile) {
      const returned = res.data?.custom_photo_url || null
      if (returned === (editingModel.custom_photo_url || null)) {
        setError(t('ais.model_sheet.err_photo_put_broken', 'The server accepted the request but did not store the new photo. Editing a photo is currently broken server-side — the backend needs redeploying. Everything else you changed was not saved either.'))
        return
      }
    }

    if (res.success) {
      show(res.message || (isEdit ? t('ais.model_sheet.toast_updated', 'House model updated') : t('ais.model_sheet.toast_added', 'House model added')), 'success')
      onSaved && onSaved(res.data)
      onClose()
    } else {
      setError(res.message || t('ais.model_sheet.err_save', 'Failed to save the model.'))
    }
  }

  async function handleDelete() {
    setSaving(true)
    const res = await deleteModel(editingModel.id)
    setSaving(false)
    if (res.success) { show(t('ais.model_sheet.toast_removed', 'House model removed'), 'success'); onDeleted && onDeleted(); onClose() }
    else setError(res.message || t('ais.model_sheet.err_delete', 'Failed to delete the model.'))
  }

  const GROUPS = [
    { key:'skin', label:t('ais.model_sheet.group.skin', 'Skin <em>tone</em>'),    val:skin, set:setSkin, note:t('ais.model_sheet.group.skin_note', 'Specify directly — never default silently. Mi Italia is committed to authentic representation.') },
    { key:'age',  label:t('ais.model_sheet.group.age', 'Apparent <em>age</em>'), val:age,  set:setAge,  note:null },
    { key:'body', label:t('ais.model_sheet.group.body', 'Body <em>type</em>'),    val:body, set:setBody, note:t('ais.model_sheet.group.body_note', 'Italian fashion is increasingly inclusive. Choose the body type your actual customers see themselves in.') },
    { key:'hair', label:t('ais.model_sheet.group.hair', 'Hair'),                  val:hair, set:setHair, note:null },
    { key:'pose', label:t('ais.model_sheet.group.pose', 'Pose <em>energy</em>'),  val:pose, set:setPose, note:null },
  ]

  return (
    <Sheet t={t} open={open} onClose={onClose}
      tag={isEdit ? t('ais.model_sheet.tag_edit', 'EDIT · HOUSE MODEL') : t('ais.model_sheet.tag_new', 'NEW · HOUSE MODEL')}
      title={isEdit ? t('ais.model_sheet.title_edit', 'Refine a <em>house model</em>') : t('ais.model_sheet.title_new', 'Add a <em>house model</em>')}
      sub={t('ais.model_sheet.sub', 'Build a model brief you can re-use across shoots. Specify attributes directly — never default silently. The preview updates as you choose.')}
      foot={t('ais.model_sheet.foot', 'A model brief never overrides your editorial judgement — it just gives the AI a clear starting point.')}
      confirmLabel={saving ? t('ais.common.saving', 'Saving…') : (isEdit ? t('ais.look_sheet.save_changes', 'Save changes') : t('ais.model_sheet.save_preset', 'Save model preset'))}
      onConfirm={handleSave}
      confirmDisabled={saving} wide>

      <div className="model-editor">

      {/* Live preview — pinned left so the attributes being edited on the right
          stay visible against their result. With no photo yet it shows an empty
          placeholder — deliberately NOT a stock persona portrait, which in a
          create form reads as though a real model had already been chosen. */}
      <div className="model-editor-preview">
        <div className="look-preview-label">{t('ais.look_sheet.live_preview', 'Live preview')}</div>
        <div className={`model-hero-photo${hasPhoto ? '' : ' is-empty'}`}
             style={hasPhoto ? {backgroundImage:`url('${heroPhoto}')`} : undefined}>
          {hasPhoto ? (
            <div className="model-hero-photo-tag" style={{background:'rgba(0,108,53,0.85)',color:'var(--cream)'}}>
              {photoFile ? t('ais.model_sheet.new_photo_unsaved', 'NEW PHOTO · UNSAVED') : t('ais.brief.actual_photo', 'ACTUAL MODEL PHOTO')}
            </div>
          ) : (
            <div className="model-photo-empty">
              <span className="material-symbols-outlined">add_a_photo</span>
              <div className="model-photo-empty-lead">{t('ais.picker.no_photo_yet', 'No photo yet')}</div>
              <div className="model-photo-empty-sub">{t('ais.model_sheet.photo_empty_sub', 'Upload one on the right — the AI poses your garment from it')}</div>
            </div>
          )}
        </div>
        <div className="model-editor-preview-body">
          {!hasPhoto && (
            <div className="model-hero-persona">{match.persona.region}</div>
          )}
          <div className="model-hero-name">{name || <>{t('ais.model_sheet.new_pre', 'New')} <em>{t('ais.model_sheet.new_em', 'house model')}</em></>}</div>
          <div className="model-hero-traits">
            {[skin,age,body,hair].filter(Boolean).map(trait => <span key={trait} className="model-hero-trait">{trait}</span>)}
          </div>
          <div className="model-hero-note">
            <span className="material-symbols-outlined">info</span>
            <span>{hasPhoto
              ? t('ais.model_sheet.note_has_photo', 'Your final output follows this exact photo, posed and dressed per the brief beside it.')
              : t('ais.model_sheet.note_no_photo', 'A photo is required before this model can generate. The attributes describe the brief; they do not create a face.')}</span>
          </div>
        </div>
      </div>

      <div className="model-editor-form">

      <div className="sheet-section">
        <div className="sheet-section-label">{t('ais.model_sheet.preset_name_pre', 'Preset')} <em>{t('ais.model_sheet.preset_name_em', 'name')}</em></div>
        <input value={name} onChange={e=>setName(e.target.value)}
          style={{width:'100%',padding:'10px 13px',border:'1.5px solid var(--mist)',borderRadius: 0,fontSize:11.5,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
          placeholder={t('ais.model_sheet.preset_name_ph', "e.g. 'Casual · Spring' or 'Bridal · soft'")} />
      </div>

      {/* The one field that actually reaches FASHN. Without it the backend
          substitutes a placeholder and every shoot renders that instead. */}
      <div className="sheet-section">
        <div className="sheet-section-label">
          {t('ais.model_sheet.model_photo_pre', 'Model')} <em>{t('ais.model_sheet.model_photo_em', 'photo')}</em>{' '}
          <span style={{color: hasPhoto ? 'var(--green)' : 'var(--red)', fontWeight:700, letterSpacing:0, textTransform:'none'}}>
            {hasPhoto ? t('ais.model_sheet.photo_set', '✓ set') : t('ais.model_sheet.photo_required', 'required to generate')}
          </span>
        </div>

        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{display:'none'}} onChange={handlePickPhoto} />

        {!pickerOpen && (
          <div style={{display:'flex',gap:12,alignItems:'center',padding:'12px 14px',background:'var(--cream)',border:'1px solid var(--mist)'}}>
            <div style={{width:52,height:66,flexShrink:0,background:`url('${heroPhoto}') center/cover`,border:'1px solid var(--mist)'}} />
            <div style={{flex:1,fontSize:10,color:'var(--stone)',lineHeight:1.45}}>
              {t('ais.model_sheet.has_photo_note', 'This model has a photo on file. Every shoot using it is posed from this image.')}
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setChangingPhoto(true)}>
              <span className="material-symbols-outlined">swap_horiz</span>{t('ais.common.change', 'Change')}
            </button>
          </div>
        )}

        {pickerOpen && !photoFile && !linkMode && (
          <div className="look-ref" style={!hasPhoto ? {borderColor:'var(--red)'} : undefined} onClick={() => fileRef.current?.click()}>
            <span className="material-symbols-outlined" style={{fontSize:22,color:'var(--gold)'}}>add_photo_alternate</span>
            <div style={{fontSize:11,fontWeight:600,marginTop:5}}>{t('ais.model_sheet.upload_photo', 'Upload a model photo')}</div>
            <div style={{fontSize:9,color:'var(--stone)',marginTop:3,lineHeight:1.5}}>
              {t('ais.model_sheet.upload_photo_pre', 'JPEG, PNG, or WebP · up to 10MB. Choose a')} <strong>{t('ais.model_sheet.upload_photo_bold', 'full-body, single-person')}</strong> {t('ais.model_sheet.upload_photo_post', 'shot — the AI reads the body pose from it and dresses that person in your garment.')}
            </div>
          </div>
        )}

        {pickerOpen && photoFile && (
          <div className="look-ref has-file" style={{cursor:'default',textAlign:'left'}}>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <div style={{width:52,height:66,flexShrink:0,background:`url('${photoPreview}') center/cover`,border:'1px solid var(--mist)'}} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{photoFile.name}</div>
                <div style={{fontSize:9.5,color:'var(--stone)',marginTop:2}}>{t('ais.model_sheet.uploads_on_save', '{{mb}}MB · uploads when you save', { mb: (photoFile.size/1024/1024).toFixed(1) })}</div>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>{t('ais.common.replace', 'Replace')}</button>
              <span className="material-symbols-outlined" style={{cursor:'pointer',color:'var(--stone)'}} onClick={clearPhoto}>close</span>
            </div>
          </div>
        )}

        {pickerOpen && linkMode && (
          <input value={photoUrl} onChange={e=>setPhotoUrl(e.target.value)}
            style={{width:'100%',padding:'10px 13px',border:'1.5px solid var(--mist)',borderRadius:0,fontSize:11.5,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
            placeholder={t('ais.model_sheet.link_ph', 'https://… link to a full-body photo')} />
        )}

        {pickerOpen && !photoFile && (
          <button type="button" onClick={() => setLinkMode(m => !m)}
            style={{background:'none',border:'none',padding:0,marginTop:8,fontSize:10,fontWeight:600,color:'var(--gold)',cursor:'pointer',fontFamily:'inherit'}}>
            {linkMode ? t('ais.look_sheet.use_upload', '← Upload a file instead') : t('ais.look_sheet.use_link', 'Or paste a link instead →')}
          </button>
        )}

        {photoWarn && (
          <div style={{marginTop:8,fontSize:9.5,color:'var(--stone)',lineHeight:1.5,display:'flex',gap:5,alignItems:'flex-start'}}>
            <span className="material-symbols-outlined" style={{fontSize:12,color:'var(--gold)',flexShrink:0,marginTop:1}}>info</span>{photoWarn}
          </div>
        )}

        <div style={{marginTop:8,fontSize:9.5,color:'var(--stone)',lineHeight:1.5}}>
          {t('ais.model_sheet.crop_note', 'Head-and-shoulders crops fail pose detection. A pasted link must be publicly reachable — private or hotlink-protected URLs are rejected when the AI tries to fetch them.')}
        </div>
        <div style={{marginTop:8,fontSize:9.5,color:'var(--stone)',lineHeight:1.5,background:'rgba(184,149,90,0.08)',padding:'10px 12px'}}>
          <strong>{t('ais.model_sheet.consent_label', 'Consent:')}</strong> {t('ais.model_sheet.consent_note', "by using a photo here you confirm you have permission to use this person's likeness in AI-generated imagery.")}
        </div>
      </div>

      {error && (
        <div className="alert alert-red" style={{marginBottom:14}}>
          <span className="material-symbols-outlined">error</span>{error}
        </div>
      )}

      {GROUPS.map(group => (
        <div key={group.key} className="sheet-section">
          <div className="sheet-section-label" dangerouslySetInnerHTML={{__html:group.label}} />
          <div className="opt-pills">
            {MODEL_OPTIONS[group.key].map(v => (
              <button type="button" key={v} className={`opt-pill${group.val===v?' selected':''}`} onClick={() => group.set(v)}>{v}</button>
            ))}
          </div>
          {group.note && <div style={{fontSize:'9.5px',color:'var(--stone)',marginTop:7,lineHeight:1.5}}>{group.note}</div>}
        </div>
      ))}

      {isEdit && !editingModel.is_default && (
        <button type="button" className="look-danger" onClick={handleDelete} disabled={saving}>
          <span className="material-symbols-outlined">delete</span>{t('ais.model_sheet.delete', 'Delete this model')}
        </button>
      )}
      {isEdit && editingModel.is_default && (
        <div className="look-default-note">
          <span className="material-symbols-outlined">star</span>{t('ais.model_sheet.default_note', 'Default model, used by Quick generate. Set another as default to delete this one.')}
        </div>
      )}

      </div>{/* .model-editor-form */}
      </div>{/* .model-editor */}
    </Sheet>
  )
}

function BrandScreen({
  t,
  looks, looksLoading, createLook, updateLook, deleteLook, duplicateLook,
  createLookWithPhoto, updateLookWithPhoto,
  models, modelsLoading, createModel, updateModel, deleteModel, duplicateModel,
  createModelWithPhoto, updateModelWithPhoto,
  getConsistency, getNetworkTrends, resetStudio, show,
}) {
  const lang = useLangStore(s => s.lang)
  // Sheet / modal visibility
  const [showBrandMenu,     setShowBrandMenu]     = useState(false)
  const [showNetworkTrends, setShowNetworkTrends] = useState(false)
  const [showExplain,       setShowExplain]       = useState(false)
  const [showResetConfirm,  setShowResetConfirm]  = useState(false)
  const [resetting,         setResetting]         = useState(false)

  const [showModelEditor,    setShowModelEditor]    = useState(false)
  const [editingModel,       setEditingModel]       = useState(null)
  const [deleteModelConfirm, setDeleteModelConfirm] = useState(null)

  const [showLookEditor,    setShowLookEditor]    = useState(false)
  const [editingLook,       setEditingLook]       = useState(null)
  const [deleteLookConfirm, setDeleteLookConfirm] = useState(null)

  const [consistency, setConsistency] = useState(null)
  const [trends,      setTrends]      = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(true)

  function refetchInsights() {
    setInsightsLoading(true)
    return Promise.all([getConsistency(), getNetworkTrends()]).then(([c, tr]) => {
      if (c.success) setConsistency(c.data || null)
      if (tr.success) setTrends(tr.data || null)
      setInsightsLoading(false)
    })
  }

  useEffect(() => { refetchInsights() }, [lang])

  async function doReset() {
    setResetting(true)
    const res = await resetStudio()
    setResetting(false)
    setShowResetConfirm(false)
    if (res.success) { show(res.message || t('ais.brand.toast_reset', 'Reset to defaults'), 'success'); refetchInsights() }
    else show(res.message || t('ais.brand.err_reset', 'Reset failed'))
  }

  // ── Looks ──
  async function handleSetDefaultLook(l) {
    if (l.is_default) return
    const res = await updateLook(l.id, { is_default: true })
    if (res.success) show(t('ais.brand.toast_default_look', 'Default look updated'), 'success')
    else show(res.message || t('ais.brand.err_default_look', 'Failed to update default look'))
  }
  async function handleDuplicateLook(l) {
    const res = await duplicateLook(l.id)
    show(res.success ? (res.message || t('ais.brand.toast_look_duplicated', 'Studio look duplicated')) : (res.message || t('ais.brand.err_duplicate_look', 'Failed to duplicate look')), res.success ? 'success' : undefined)
  }
  async function handleConfirmDeleteLook() {
    const l = deleteLookConfirm
    setDeleteLookConfirm(null)
    const res = await deleteLook(l.id)
    show(res.success ? t('ais.look_sheet.toast_removed', 'Studio look removed') : (res.message || t('ais.brand.err_delete_look', 'Failed to delete look')), res.success ? 'success' : undefined)
  }

  // ── Models ──
  async function handleSetDefaultModel(m) {
    if (m.is_default) return
    const res = await updateModel(m.id, { is_default: true })
    if (res.success) show(t('ais.brand.toast_default_model', 'Default model updated'), 'success')
    else show(res.message || t('ais.brand.err_default_model', 'Failed to update default model'))
  }
  async function handleDuplicateModel(m) {
    const res = await duplicateModel(m.id)
    show(res.success ? (res.message || t('ais.brand.toast_model_duplicated', 'House model duplicated')) : (res.message || t('ais.brand.err_duplicate_model', 'Failed to duplicate model')), res.success ? 'success' : undefined)
  }
  async function handleConfirmDeleteModel() {
    const m = deleteModelConfirm
    setDeleteModelConfirm(null)
    const res = await deleteModel(m.id)
    show(res.success ? t('ais.model_sheet.toast_removed', 'House model removed') : (res.message || t('ais.brand.err_delete_model', 'Failed to delete model')), res.success ? 'success' : undefined)
  }

  const hasSample = !!(consistency && consistency.sample_size > 0)
  const scoreCopy = !hasSample ? null
    : consistency.score >= 80 ? { title:t('ais.brand.score.strong_title', 'Strong & recognisable.'), desc:t('ais.brand.score.strong_desc', 'Your recent generations share a consistent house model, look, and aspect ratio. Customers will recognise your boutique at a glance. This is a guide — never a constraint.') }
    : consistency.score >= 55 ? { title:t('ais.brand.score.taking_shape_title', 'Taking shape.'),          desc:t('ais.brand.score.taking_shape_desc', 'A point of view is emerging, but a few shoots sit outside it. Concentrating on one house model or look will sharpen the signal.') }
    :                           { title:t('ais.brand.score.finding_voice_title', 'Still finding its voice.'),desc:t('ais.brand.score.finding_voice_desc', 'Your generations vary widely in model, look, or format. That is fine while you experiment — settle on defaults when you are ready.') }

  // Each group labels its rows with a different field — the API returns
  // { name } for looks but { aspect } / { mood } for the other two, so a single
  // hardcoded `name` lookup rendered every aspect and mood row as an em-dash.
  const trendGroups = [
    { key:'trending_looks',   field:'name',   label:t('ais.brand.trend.looks', 'Most-used <em>looks</em>') },
    { key:'trending_aspects', field:'aspect', label:t('ais.brand.trend.aspects', 'Most-used <em>aspect ratios</em>') },
    { key:'trending_moods',   field:'mood',   label:t('ais.brand.trend.moods', 'Most-used <em>moods</em>') },
  ]
  const hasTrends = !!(trends && trendGroups.some(g => (trends[g.key] || []).length))

  // `pct` is a real 0–100 share of all shoots in the window. Do NOT fall back to
  // `count` here: it renders a raw generation count against a % sign, so a look
  // with 12 shoots read "12%". Better to show 0 than a confidently wrong figure.
  // Bars normalise against the biggest value in each group so a low-activity
  // network still reads sensibly.
  function trendRows(list, field) {
    const max = Math.max(1, ...list.map(t => t.pct || 0))
    return list.map(t => ({ name: t[field] || '—', pct: t.pct || 0, width: Math.round(((t.pct || 0) / max) * 100) }))
  }

  return (
    <div>
      {/* ── House model editor ── */}
      <ModelEditorSheet
        t={t}
        open={showModelEditor}
        onClose={() => { setShowModelEditor(false); setEditingModel(null) }}
        editingModel={editingModel}
        createModel={createModel}
        updateModel={updateModel}
        deleteModel={deleteModel}
        createModelWithPhoto={createModelWithPhoto}
        updateModelWithPhoto={updateModelWithPhoto}
        show={show}
        onSaved={() => { setShowModelEditor(false); setEditingModel(null) }}
        onDeleted={() => { setShowModelEditor(false); setEditingModel(null) }}
      />

      {/* ── Studio look editor (create + edit) ── */}
      <LookEditorSheet
        t={t}
        open={showLookEditor}
        onClose={() => { setShowLookEditor(false); setEditingLook(null) }}
        editingLook={editingLook}
        createLook={createLook}
        createLookWithPhoto={createLookWithPhoto}
        updateLookWithPhoto={updateLookWithPhoto}
        updateLook={updateLook}
        deleteLook={deleteLook}
        show={show}
        onSaved={() => { setShowLookEditor(false); setEditingLook(null) }}
        onDeleted={() => { setShowLookEditor(false); setEditingLook(null) }}
      />

      {/* ── Delete confirms ── */}
      {deleteLookConfirm && (
        <div className="unsaved-overlay" onClick={() => setDeleteLookConfirm(null)}>
          <div className="unsaved-modal" onClick={e => e.stopPropagation()}>
            <div className="unsaved-icon" style={{background:'rgba(197,0,26,0.1)'}}>
              <span className="material-symbols-outlined" style={{fontSize:28,color:'var(--red)'}}>delete</span>
            </div>
            <h3 className="unsaved-title" dangerouslySetInnerHTML={{__html: t('ais.brand.delete_confirm.title', 'Delete <em>{{name}}</em>?', { name: deleteLookConfirm.name })}} />
            <p className="unsaved-desc">{t('ais.brand.delete_confirm.look_desc_pre', 'This studio look will be permanently removed.')} <strong>{t('ais.brand.delete_confirm.cannot_undo', 'This cannot be undone.')}</strong></p>
            <div className="unsaved-actions">
              <button className="unsaved-btn unsaved-btn-cancel" onClick={() => setDeleteLookConfirm(null)}>{t('ais.common.cancel', 'Cancel')}</button>
              <button className="unsaved-btn unsaved-btn-discard" onClick={handleConfirmDeleteLook}>
                <span className="material-symbols-outlined">delete</span>{t('ais.brand.delete_look_btn', 'Delete look')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModelConfirm && (
        <div className="unsaved-overlay" onClick={() => setDeleteModelConfirm(null)}>
          <div className="unsaved-modal" onClick={e => e.stopPropagation()}>
            <div className="unsaved-icon" style={{background:'rgba(197,0,26,0.1)'}}>
              <span className="material-symbols-outlined" style={{fontSize:28,color:'var(--red)'}}>delete</span>
            </div>
            <h3 className="unsaved-title" dangerouslySetInnerHTML={{__html: t('ais.brand.delete_confirm.title', 'Delete <em>{{name}}</em>?', { name: deleteModelConfirm.name })}} />
            <p className="unsaved-desc">{t('ais.brand.delete_confirm.model_desc_pre', 'This house model will be permanently removed. Past generations keep their model snapshot.')} <strong>{t('ais.brand.delete_confirm.cannot_undo', 'This cannot be undone.')}</strong></p>
            <div className="unsaved-actions">
              <button className="unsaved-btn unsaved-btn-cancel" onClick={() => setDeleteModelConfirm(null)}>{t('ais.common.cancel', 'Cancel')}</button>
              <button className="unsaved-btn unsaved-btn-discard" onClick={handleConfirmDeleteModel}>
                <span className="material-symbols-outlined">delete</span>{t('ais.brand.delete_model_btn', 'Delete model')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Brand menu sheet ── */}
      <Sheet t={t} open={showBrandMenu} onClose={() => setShowBrandMenu(false)}
        tag={t('ais.brand.menu.tag', 'BRAND · OPTIONS')} title={t('ais.brand.menu.title', 'Brand <em>setup</em>')}
        sub={t('ais.brand.menu.sub', 'Manage your saved house models and studio looks.')}
        foot={t('ais.brand.menu.foot', 'More options coming soon — bulk export, archive view, brand kit settings.')}
        confirmLabel={t('ais.common.close', 'Close')}
        onConfirm={() => setShowBrandMenu(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'var(--cream)',borderRadius: 0,cursor:'pointer'}}
            onClick={() => { setShowBrandMenu(false); setShowResetConfirm(true) }}>
            <div>
              <div style={{fontSize:12,fontWeight:700}}>{t('ais.brand.menu.reset', 'Reset to defaults')}</div>
              <div style={{fontSize:10,color:'var(--stone)',marginTop:2}}>{t('ais.brand.menu.reset_note', 'Re-seeds house models and studio looks. Cannot be undone.')}</div>
            </div>
            <span className="material-symbols-outlined" style={{fontSize:20,color:'var(--red)'}}>restart_alt</span>
          </div>
        </div>
      </Sheet>

      {/* ── Network trends sheet ── */}
      <Sheet t={t} open={showNetworkTrends} onClose={() => setShowNetworkTrends(false)}
        tag={t('ais.brand.network.tag', 'NETWORK · TRENDS')} title={t('ais.brand.network.title', 'Mi Italia <em>network trends</em>')}
        sub={t('ais.brand.network.sub', 'Anonymous aggregate across {{n}} active boutique(s) over the last {{days}} days. Individual generations are never shared.', { n: trends?.boutiques_active ?? 0, days: trends?.window_days ?? 30 })}
        confirmLabel={t('ais.common.close', 'Close')}
        onConfirm={() => setShowNetworkTrends(false)}>
        {!hasTrends ? (
          <div style={{padding:'32px 24px',textAlign:'center'}}>
            <span className="material-symbols-outlined" style={{fontSize:30,color:'var(--gold)'}}>insights</span>
            <div style={{fontSize:12.5,fontWeight:700,marginTop:10}}>{t('ais.brand.network.not_enough', 'Not enough network activity yet')}</div>
            <div style={{fontSize:11,color:'var(--stone)',marginTop:6,lineHeight:1.55}}>
              {t('ais.brand.network.not_enough_note', 'Trends appear once enough Mi Italia boutiques are generating imagery. Nothing about your own shoots is shared to produce them.')}
            </div>
          </div>
        ) : trendGroups.map(g => {
          const list = trends[g.key] || []
          if (!list.length) return null
          return (
            <div key={g.key} className="sheet-section">
              <div className="sheet-section-label" dangerouslySetInnerHTML={{__html:g.label}} />
              {trendRows(list, g.field).map(t => (
                <div key={t.name} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{flex:1,fontSize:11,fontWeight:600}}>{t.name}</div>
                  <div style={{flex:2,height:8,background:'var(--cream)',borderRadius: 0,overflow:'hidden'}}>
                    <div style={{height:'100%',background:'var(--gold)',width:`${t.width}%`,borderRadius: 0}} />
                  </div>
                  <div style={{width:36,fontSize:10.5,fontWeight:700,textAlign:'right'}}>{t.pct}%</div>
                </div>
              ))}
            </div>
          )
        })}
      </Sheet>

      {/* ── Explain modal ── */}
      {showExplain && (
        <div className="explain-overlay" onClick={() => setShowExplain(false)}>
          <div className="explain-modal" onClick={e => e.stopPropagation()}>
            <div className="explain-head">
              <div>
                <div className="sheet-tag">{t('ais.brand.methodology', 'METHODOLOGY')}</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:500,marginTop:6}}>
                  {t('ais.brand.explain.h_pre', 'How is brand')} <em style={{color:'var(--gold)',fontStyle:'italic'}}>{t('ais.brand.explain.h_em', 'consistency')}</em> {t('ais.brand.explain.h_post', 'calculated?')}
                </div>
                <div style={{fontSize:11,color:'var(--stone)',marginTop:5}}>{t('ais.brand.explain.sub', 'A guide, never a constraint. Here is exactly what we look at.')}</div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowExplain(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="explain-body">
              <div className="explain-formula">
                {(consistency?.checks || []).map((c,i) => (
                  <span key={c.key}>{i>0 && ' + '}<em>{c.label.toLowerCase()}</em> × {(c.weight/100).toFixed(2)}</span>
                ))}
                {!consistency?.checks?.length && <>{t('ais.brand.explain.score_eq', 'Score =')} <em>{t('ais.brand.explain.model_consistency', 'model consistency')}</em> × 0.35 + <em>{t('ais.brand.explain.look_concentration', 'look concentration')}</em> × 0.30 + <em>{t('ais.brand.explain.format_uniformity', 'format uniformity')}</em> × 0.20 + <em>{t('ais.brand.explain.palette_coherence', 'palette coherence')}</em> × 0.15</>}
              </div>
              <div className="explain-list">
                {[
                  { key:'model_consistency',  desc:t('ais.brand.explain.desc.model_consistency', 'How often your saved house model appears across recent generations. Weighted highest because it is the single strongest brand signal customers register.') },
                  { key:'look_concentration', desc:t('ais.brand.explain.desc.look_concentration', 'The concentration of your studio look distribution. Higher when one look dominates, lower when you spread evenly. Variety is not punished — having a clear point of view is rewarded.') },
                  { key:'format_uniformity',  desc:t('ais.brand.explain.desc.format_uniformity', 'Aspect ratio consistency across generations destined for the same surface. Mixed ratios on the storefront cost you here.') },
                  { key:'palette_coherence',  desc:t('ais.brand.explain.desc.palette_coherence', 'Colour-temperature and saturation similarity across the set. Two shoots in cool blue light next to a warm tungsten shot read as unrelated.') },
                ].map((item, i) => {
                  const check = (consistency?.checks || []).find(c => c.key === item.key)
                  return (
                    <div key={item.key} className="explain-item">
                      <div className="explain-item-num">{i + 1}</div>
                      <div className="explain-item-body">
                        <div className="explain-item-title">{check?.label || item.key} · {check?.weight ?? '—'}%</div>
                        <div className="explain-item-desc">{item.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{marginTop:18,padding:'14px 16px',background:'rgba(184,149,90,0.06)',borderRadius: 0,fontSize:11,lineHeight:1.55,color:'var(--stone)'}}>
                <strong style={{color:'var(--deep)'}}>{t('ais.brand.explain.note_label', 'A note on the score.')}</strong> {t('ais.brand.explain.note_body', 'We surface this because boutiques tell us they want to be told when their visual language is drifting. We never block a generation, lower your score in private, or share it across the network. Ignore the number if it does not serve you.')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset confirm modal ── */}
      {showResetConfirm && (
        <div className="unsaved-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="unsaved-modal" onClick={e => e.stopPropagation()}>
            <div className="unsaved-icon" style={{background:'rgba(197,0,26,0.1)'}}>
              <span className="material-symbols-outlined" style={{fontSize:28,color:'var(--red)'}}>restart_alt</span>
            </div>
            <h3 className="unsaved-title">{t('ais.brand.reset_confirm.title_pre', 'Reset brand setup to')} <em>{t('ais.brand.reset_confirm.title_em', 'defaults')}</em>?</h3>
            <p className="unsaved-desc">{t('ais.brand.reset_confirm.desc', 'This re-seeds your house models and studio looks from the Mi Italia defaults, replacing everything you have customised.')} <strong>{t('ais.brand.delete_confirm.cannot_undo', 'This cannot be undone.')}</strong></p>
            <div className="unsaved-actions">
              <button className="unsaved-btn unsaved-btn-cancel" onClick={() => setShowResetConfirm(false)}>{t('ais.common.cancel', 'Cancel')}</button>
              <button className="unsaved-btn unsaved-btn-discard" onClick={doReset} disabled={resetting}>
                <span className="material-symbols-outlined">restart_alt</span>
                {resetting ? t('ais.brand.resetting', 'Resetting…') : t('ais.brand.reset_everything', 'Reset everything')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="brand-head">
        <div className="brand-head-text">
          <h1>{t('ais.brand.h1_pre', 'Your')} <em>{t('ais.brand.h1_em', 'brand')}</em> {t('ais.brand.h1_post', 'setup')}</h1>
          <p className="brand-head-sub">{t('ais.brand.h1_sub', 'Save the models and looks that make your boutique feel like itself. Every shoot starts from these — fewer choices, more consistency.')}</p>
        </div>
        <button className="brand-head-menu" onClick={() => setShowBrandMenu(true)}>
          <span className="material-symbols-outlined">more_horiz</span>
        </button>
      </div>

      {/* ── House models + Studio looks ── */}
      <div className="brand-grid">
        <div className="brand-card">
          <div className="brand-card-tag">{t('ais.brand.saved_models_tag', 'SAVED · MODELS')}</div>
          <h3>{t('ais.brand.house_models_pre', 'House')} <em>{t('ais.brand.house_models_em', 'models')}</em></h3>
          <p className="brand-card-sub">{t('ais.brand.house_models_sub', 'Re-usable model briefs. The default is used for Quick generate and as the starting point in Detailed mode.')}</p>
          <div className="preset-list">
            {modelsLoading && models.length === 0 && <div className="brand-card-sub">{t('ais.brief.loading_models', 'Loading models…')}</div>}
            {!modelsLoading && models.length === 0 && <div className="brand-card-sub">{t('ais.brand.no_models_yet', 'No house models yet — add one below.')}</div>}
            {models.map(m => (
              <div key={m.id} className={`preset-item${m.is_default?' default':''}`}>
                <div className="preset-av" style={m.custom_photo_url
                  ? {backgroundImage:`url('${m.custom_photo_url}')`,backgroundSize:'cover',backgroundPosition:'center'}
                  : {background:'linear-gradient(135deg,#D4AF72,#8A6A30)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:13,fontWeight:700,fontFamily:"'Cormorant Garamond',serif"}}>
                  {!m.custom_photo_url && modelInitials(m.name)}
                </div>
                <div className="preset-body">
                  <div className="preset-name">
                    {m.name}
                    {m.is_default && <span className="preset-name-tag">{t('ais.common.default_badge', 'DEFAULT')}</span>}
                  </div>
                  <div className="preset-traits">{modelTraitsLine(m) || t('ais.gen.custom_brief', 'Custom brief')}</div>
                </div>
                <button className="preset-action" onClick={() => handleSetDefaultModel(m)} title={t('ais.brand.set_default', 'Set as default')}>
                  <span className="material-symbols-outlined" style={{color:m.is_default?'var(--gold)':'var(--stone)'}}>{m.is_default?'star':'star_outline'}</span>
                </button>
                <button className="preset-action" onClick={() => { setEditingModel(m); setShowModelEditor(true) }} title={t('ais.common.edit', 'Edit')}>
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button className="preset-action" onClick={() => handleDuplicateModel(m)} title={t('ais.common.duplicate', 'Duplicate')}>
                  <span className="material-symbols-outlined">content_copy</span>
                </button>
                {!m.is_default && (
                  <button className="preset-action" onClick={() => setDeleteModelConfirm(m)} title={t('ais.common.remove', 'Remove')}>
                    <span className="material-symbols-outlined">delete_outline</span>
                  </button>
                )}
              </div>
            ))}
            <button className="preset-add" onClick={() => { setEditingModel(null); setShowModelEditor(true) }}>
              <span className="material-symbols-outlined">add</span>{t('ais.brand.add_house_model', 'Add house model')}
            </button>
          </div>
        </div>

        <div className="brand-card">
          <div className="brand-card-tag">{t('ais.brand.saved_looks_tag', 'SAVED · LOOKS')}</div>
          <h3>{t('ais.brand.studio_looks_pre', 'Studio')} <em>{t('ais.brand.studio_looks_em', 'looks')}</em></h3>
          <p className="brand-card-sub">{t('ais.brand.studio_looks_sub', 'The light, setting, mood, grade, and palette each shoot starts from. Set one as default for Quick generate.')}</p>
          <div className="preset-list">
            {looksLoading && looks.length === 0 && <div className="brand-card-sub">{t('ais.gen.loading_looks2', 'Loading looks…')}</div>}
            {!looksLoading && looks.length === 0 && <div className="brand-card-sub">{t('ais.brand.no_looks_yet', 'No studio looks yet — save one below.')}</div>}
            {looks.map(l => (
              <div key={l.id} className={`preset-item${l.is_default?' default':''}`}>
                <div className="preset-av" style={lookThumbStyle(l)} />
                <div className="preset-body">
                  <div className="preset-name">
                    {l.name}
                    {l.is_default && <span className="preset-name-tag">{t('ais.common.default_badge', 'DEFAULT')}</span>}
                  </div>
                  <div className="preset-traits">{lookDescLine(l, t) || t('ais.brand.custom_look', 'Custom look')}</div>
                </div>
                <button className="preset-action" onClick={() => handleSetDefaultLook(l)} title={t('ais.brand.set_default', 'Set as default')}>
                  <span className="material-symbols-outlined" style={{color:l.is_default?'var(--gold)':'var(--stone)'}}>{l.is_default?'star':'star_outline'}</span>
                </button>
                <button className="preset-action" onClick={() => { setEditingLook(l); setShowLookEditor(true) }} title={t('ais.common.edit', 'Edit')}>
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button className="preset-action" onClick={() => handleDuplicateLook(l)} title={t('ais.common.duplicate', 'Duplicate')}>
                  <span className="material-symbols-outlined">content_copy</span>
                </button>
                {!l.is_default && (
                  <button className="preset-action" onClick={() => setDeleteLookConfirm(l)} title={t('ais.common.remove', 'Remove')}>
                    <span className="material-symbols-outlined">delete_outline</span>
                  </button>
                )}
              </div>
            ))}
            <button className="preset-add" onClick={() => { setEditingLook(null); setShowLookEditor(true) }}>
              <span className="material-symbols-outlined">add</span>{t('ais.brand.save_new_look', 'Save new look')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Network spotlight ── */}
      <div className="brand-card" style={{marginBottom:20}}>
        <div className="brand-card-tag">{t('ais.brand.network_spotlight_tag', 'MI ITALIA NETWORK · FOR REFERENCE ONLY')}</div>
        <h3>{t('ais.brand.network_spotlight_pre', 'What the')} <em>{t('ais.brand.network_spotlight_em', 'network')}</em> {t('ais.brand.network_spotlight_post', 'is choosing')}</h3>
        <p className="brand-card-sub">{t('ais.brand.network_spotlight_sub', 'A reference — never a copy. Anonymous aggregate only; your boutique stays distinctly yours.')}</p>
        {insightsLoading ? (
          <div style={{fontSize:11,color:'var(--stone)',padding:'18px 0'}}>{t('ais.brand.loading_trends', 'Loading network trends…')}</div>
        ) : !hasTrends ? (
          <div style={{padding:'26px 20px',background:'var(--cream)',textAlign:'center'}}>
            <span className="material-symbols-outlined" style={{fontSize:26,color:'var(--gold)'}}>insights</span>
            <div style={{fontSize:12,fontWeight:700,marginTop:8}}>{t('ais.brand.no_network_data', 'No network data yet')}</div>
            <div style={{fontSize:10.5,color:'var(--stone)',marginTop:4,lineHeight:1.5}}>
              {trends?.boutiques_active ? t('ais.brand.no_network_data_active', '{{n}} boutiques active, but not enough shared signal yet.', { n: trends.boutiques_active }) : t('ais.brand.no_network_data_none', 'Trends appear as more Mi Italia boutiques generate imagery.')}
            </div>
          </div>
        ) : (
          <div className="network-grid">
            {(trends.trending_looks || []).slice(0,3).map(l => (
              <div key={l.name} className="network-card">
                <div className="network-card-img" style={{background:'linear-gradient(135deg,#2a2018,#4a4038)'}} />
                <div className="network-card-body">
                  <div className="network-card-name">{l.name}</div>
                  <div className="network-card-loc">
                    <span className="material-symbols-outlined">trending_up</span>{t('ais.brand.pct_of_shoots', '{{pct}}% of shoots', { pct: l.pct || 0 })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:14,borderTop:'1px solid var(--mist)',gap:16}}>
          <div style={{fontSize:11,color:'var(--stone)',lineHeight:1.5,flex:1}}>{t('ais.brand.network_footnote', 'Network insights are anonymous aggregate trends across Mi Italia boutiques. Individual generations are never shared without explicit permission from the originating boutique.')}</div>
          <button className="btn btn-outline btn-sm" style={{flexShrink:0}} onClick={() => setShowNetworkTrends(true)}>{t('ais.brand.see_full_trends', 'See full network trends')}</button>
        </div>
      </div>

      {/* ── Brand consistency score ── */}
      <div className="consistency-row">
        <div className="consistency-head">
          <div className="consistency-title">{t('ais.brand.consistency_pre', 'Brand')} <em>{t('ais.brand.consistency_em', 'consistency')}</em></div>
          <button className="consistency-how-link" onClick={() => setShowExplain(true)}>{t('ais.brand.how_calculated', 'How is this calculated? →')}</button>
        </div>
        {insightsLoading ? (
          <div style={{fontSize:11,color:'var(--stone)',padding:'18px 0'}}>{t('ais.brand.calculating_score', 'Calculating your consistency score…')}</div>
        ) : !hasSample ? (
          <div style={{padding:'28px 22px',background:'var(--cream)',textAlign:'center'}}>
            <span className="material-symbols-outlined" style={{fontSize:28,color:'var(--gold)'}}>donut_large</span>
            <div style={{fontSize:12.5,fontWeight:700,marginTop:9}}>{t('ais.brand.not_enough_shoots', 'Not enough shoots to score yet')}</div>
            <div style={{fontSize:11,color:'var(--stone)',marginTop:5,lineHeight:1.55,maxWidth:460,margin:'5px auto 0'}}>
              {t('ais.brand.not_enough_shoots_note', 'The consistency score compares your recent generations against each other. Run a few shoots and it will appear here — a guide, never a constraint.')}
            </div>
          </div>
        ) : (
          <>
            <div className="consistency-score">
              <div className="consistency-circle">
                <div className="consistency-circle-val">{consistency.score}</div>
              </div>
              <div style={{flex:1}}>
                <div className="consistency-body-title">{scoreCopy.title}</div>
                <div className="consistency-body-desc">
                  {scoreCopy.desc} {t('ais.brand.based_on_last_n', 'Based on your last {{n}} generation(s).', { n: consistency.sample_size })}
                </div>
              </div>
            </div>
            <div className="consistency-checks">
              {(consistency.checks || []).map(c => (
                <div key={c.key} className="consistency-check">
                  <div className={`consistency-check-icon ${c.pct >= 70 ? 'good' : 'warn'}`}>
                    <span className="material-symbols-outlined">{c.pct >= 70 ? 'check' : 'info'}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div className="consistency-check-title">{c.label} · {c.pct}%</div>
                    <div className="consistency-check-desc">{t('ais.brand.weighted_pct', 'Weighted {{pct}}% of your score.', { pct: c.weight })}</div>
                    <div style={{height:5,background:'var(--mist)',marginTop:6,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${Math.max(0,Math.min(100,c.pct))}%`,background:c.pct>=70?'var(--green)':'var(--gold)'}} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────
export default function AIModelStudio() {
  const { t, i18n } = useTranslation()
  const [screen, setScreen] = useState('hub')
  // Single-shoot render tier lives here, not inside GenerateScreen: the Hub's
  // "Quick generate" has to land straight in Quick, and GenerateScreen unmounts
  // on every tab switch so anything it owned would be lost.
  const [genMode, setGenMode] = useState('detailed')
  const { toasts, show } = useToast()

  // ── Studio looks (7–11) ──
  const [looks,        setLooks]        = useState([])
  const [looksLoading, setLooksLoading] = useState(true)

  function refetchLooks() {
    setLooksLoading(true)
    return apiJson(`${STUDIO}/looks`)
      .then(res => { if (res.success) setLooks(res.data || []) })
      .finally(() => setLooksLoading(false))
  }

  async function createLook(body)     { const r = await apiJson(`${STUDIO}/looks`, 'POST', body);              if (r.success) await refetchLooks(); return r }
  async function updateLook(id, body) { const r = await apiJson(`${STUDIO}/looks/${id}`, 'PUT', body);         if (r.success) await refetchLooks(); return r }

  // Looks take a reference image the same way models take a photo — the backend
  // parses multipart on both POST and PUT, so this is one call either way.
  async function sendLookForm(url, method, body, file) {
    const form = new FormData()
    Object.entries(body).forEach(([k, v]) => { if (v !== null && v !== undefined) form.append(k, String(v)) })
    if (file) form.append('photo', file)
    const r = await apiFetch(url, { method, body: form })
      .then(res => res.json())
      .catch(() => ({ success:false, message:'Upload failed' }))
    if (r.success) await refetchLooks()
    return r
  }
  const createLookWithPhoto = (body, file)     => sendLookForm(`${STUDIO}/looks`, 'POST', body, file)
  const updateLookWithPhoto = (id, body, file) => sendLookForm(`${STUDIO}/looks/${id}`, 'PUT', body, file)
  async function deleteLook(id)       { const r = await apiJson(`${STUDIO}/looks/${id}`, 'DELETE');            if (r.success) await refetchLooks(); return r }
  async function duplicateLook(id)    { const r = await apiJson(`${STUDIO}/looks/${id}/duplicate`, 'POST');    if (r.success) await refetchLooks(); return r }

  // ── House models (2–6) ──
  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)

  function refetchModels() {
    setModelsLoading(true)
    return apiJson(`${STUDIO}/models`)
      .then(res => { if (res.success) setModels(res.data || []) })
      .finally(() => setModelsLoading(false))
  }

  async function createModel(body)     { const r = await apiJson(`${STUDIO}/models`, 'POST', body);            if (r.success) await refetchModels(); return r }
  async function updateModel(id, body) { const r = await apiJson(`${STUDIO}/models/${id}`, 'PUT', body);       if (r.success) await refetchModels(); return r }
  async function deleteModel(id)       { const r = await apiJson(`${STUDIO}/models/${id}`, 'DELETE');          if (r.success) await refetchModels(); return r }

  // POST /models and PUT /models/:id both parse multipart directly, so an
  // add-or-edit with a photo is one call — no throwaway-then-delete carrier.
  // apiFetch skips Content-Type for FormData so the browser sets the boundary.
  // The backend takes any file part regardless of field name.
  function modelForm(body, file) {
    const form = new FormData()
    Object.entries(body).forEach(([k, v]) => { if (v !== null && v !== undefined) form.append(k, String(v)) })
    if (file) form.append('photo', file)
    return form
  }
  async function sendModelForm(url, method, body, file) {
    const r = await apiFetch(url, { method, body: modelForm(body, file) })
      .then(res => res.json())
      .catch(() => ({ success:false, message:'Upload failed' }))
    if (r.success) await refetchModels()
    return r
  }
  const createModelWithPhoto = (body, file)     => sendModelForm(`${STUDIO}/models`, 'POST', body, file)
  const updateModelWithPhoto = (id, body, file) => sendModelForm(`${STUDIO}/models/${id}`, 'PUT', body, file)
  async function duplicateModel(id)    { const r = await apiJson(`${STUDIO}/models/${id}/duplicate`, 'POST');  if (r.success) await refetchModels(); return r }

  // ── Quota (1) ──
  const [quota, setQuota] = useState(null)
  function refetchQuota() {
    return apiJson(`${STUDIO}/quota`).then(res => { if (res.success) setQuota(res.data || null) })
  }

  // ── Catalogue — one fetch, shared by the Hub feed (which only carries
  // product_id), the Single-shoot picker, and the Batch product list. ──
  const [products,        setProducts]        = useState([])
  const [productsLoading, setProductsLoading] = useState(true)

  function refetchProducts() {
    setProductsLoading(true)
    return apiJson(`${API}/boutique/products?limit=200`)
      .then(res => { if (res.success) setProducts(res.data?.products || []) })
      .finally(() => setProductsLoading(false))
  }
  const getProduct        = id     => apiJson(`${API}/boutique/products/${id}`)
  const filterProducts    = filter => apiJson(`${API}/boutique/products?limit=200&filter=${encodeURIComponent(filter)}`)

  // Multipart — apiFetch deliberately skips Content-Type for FormData so the
  // browser can set the multipart boundary itself.
  async function uploadProductPhoto(productId, file) {
    const form = new FormData()
    form.append('File', file)   // field name matches ProductPhotos.jsx
    return apiFetch(`${API}/boutique/products/${productId}/photos`, { method:'POST', body: form })
      .then(r => r.json())
      .catch(() => ({ success:false, message:'Upload failed' }))
  }

  // Pushes finished generations onto the product gallery. Already used by
  // ProductAIModelStudio.jsx, so the contract is known-good.
  const pushToProduct = (productId, imageUrls) =>
    apiJson(`${API}/boutique/products/${productId}/photos/from-ai-studio`, 'POST', { imageUrls })

  // ── Generations (12–19) ──
  // Every mutation that can consume or release quota refreshes the counter.
  async function startGeneration(body)   { const r = await apiJson(`${STUDIO}/generate`, 'POST', body);                      if (r.success) refetchQuota(); return r }
  const     pollGeneration     = id      => apiJson(`${STUDIO}/generations/${id}`)
  const     listGenerations    = limit   => apiJson(`${STUDIO}/generations${limit ? `?limit=${limit}` : ''}`)
  const     productGenerations = pid     => apiJson(`${STUDIO}/products/${pid}/generations`)
  async function cancelGeneration(id)    { const r = await apiJson(`${STUDIO}/generations/${id}/cancel`, 'POST');            if (r.success) refetchQuota(); return r }
  async function regenerateGeneration(id){ const r = await apiJson(`${STUDIO}/generations/${id}/regenerate`, 'POST');        if (r.success) refetchQuota(); return r }
  const     saveToGallery      = id      => apiJson(`${STUDIO}/generations/${id}/save-to-gallery`, 'POST')
  const     retouchGeneration  = (id, b) => apiJson(`${STUDIO}/generations/${id}/retouch`, 'POST', b)

  // ── Batch sessions (20–25) ──
  const createBatch     = body            => apiJson(`${STUDIO}/batches`, 'POST', body)
  const listBatches     = ()              => apiJson(`${STUDIO}/batches`)
  const pollBatch       = id              => apiJson(`${STUDIO}/batches/${id}`)
  const patchBatchItem  = (id, pid, body) => apiJson(`${STUDIO}/batches/${id}/items/${pid}`, 'PATCH', body)
  const removeBatchItem = (id, pid)       => apiJson(`${STUDIO}/batches/${id}/items/${pid}`, 'DELETE')
  async function runBatch(id)             { const r = await apiJson(`${STUDIO}/batches/${id}/run`, 'POST'); if (r.success) refetchQuota(); return r }

  // ── Brand insights (26–28) ──
  const getConsistency   = () => apiJson(`${STUDIO}/consistency`)
  const getNetworkTrends = () => apiJson(`${STUDIO}/network-trends`)
  async function resetStudio() {
    const r = await apiJson(`${STUDIO}/reset`, 'POST')
    if (r.success) { await Promise.all([refetchModels(), refetchLooks()]); refetchQuota() }
    return r
  }

  useEffect(() => {
    refetchLooks(); refetchModels(); refetchQuota(); refetchProducts()
  }, [i18n.language])

  const quotaLeft = quota ? Math.max(0, (quota.limit ?? 0) - (quota.used ?? 0)) : null

  const TABS = [
    {key:'hub',      icon:'home',         label:t('ais.tabs.hub', 'Hub')},
    {key:'generate', icon:'photo_camera', label:t('ais.tabs.generate', 'Single shoot')},
    {key:'batch',    icon:'grid_view',    label:t('ais.tabs.batch', 'Batch session')},
    {key:'brand',    icon:'styler',       label:t('ais.tabs.brand', 'Brand setup')},
  ]

  const generationApi = {
    startGeneration, pollGeneration, cancelGeneration, regenerateGeneration,
    saveToGallery, retouchGeneration, productGenerations, pushToProduct,
  }

  return (
    <>
      <div className="studio-subnav">
        {TABS.map(tab => (
          <div key={tab.key} className={`studio-sni${screen===tab.key?' act':''}`} onClick={() => setScreen(tab.key)}>
            <span className="material-symbols-outlined">{tab.icon}</span>{tab.label}
          </div>
        ))}
        <div className="studio-sni-quota">
          <span className="material-symbols-outlined">data_usage</span>
          {quota
            ? <>{t('ais.nav.quota_left', '{{left}} of {{limit}} generations left', { left: quotaLeft, limit: quota.limit })} · {resetLabel(quota.resetsAt)}</>
            : <>{t('ais.hub.loading_quota', 'Loading quota…')}</>}
        </div>
        <div className="studio-sni-reset" onClick={refetchQuota} title={t('ais.nav.refresh_quota', 'Refresh quota')}>
          <span className="material-symbols-outlined">refresh</span>{t('ais.nav.refresh', 'Refresh')}
        </div>
      </div>
      <div className="studio-content">
        {screen==='hub' && (
          <HubScreen
            t={t}
            onNavigate={setScreen}
            onQuickGenerate={() => { setGenMode('quick'); setScreen('generate') }}
            quota={quota}
            products={products}
            listGenerations={listGenerations}
            getNetworkTrends={getNetworkTrends}
          />
        )}
        {screen==='generate' && (
          <GenerateScreen
            t={t}
            onNavigate={setScreen}
            mode={genMode} setMode={setGenMode}
            looks={looks} looksLoading={looksLoading} createLook={createLook}
            createLookWithPhoto={createLookWithPhoto} updateLookWithPhoto={updateLookWithPhoto}
            models={models} modelsLoading={modelsLoading} createModel={createModel}
            products={products} productsLoading={productsLoading}
            getProduct={getProduct} uploadProductPhoto={uploadProductPhoto}
            quota={quota} {...generationApi} show={show}
          />
        )}
        {screen==='batch' && (
          <BatchScreen
            t={t}
            onNavigate={setScreen}
            looks={looks} looksLoading={looksLoading} createLook={createLook}
            createLookWithPhoto={createLookWithPhoto} updateLookWithPhoto={updateLookWithPhoto}
            models={models} modelsLoading={modelsLoading} createModel={createModel}
            products={products} productsLoading={productsLoading} filterProducts={filterProducts}
            quota={quota}
            createBatch={createBatch} listBatches={listBatches} pollBatch={pollBatch}
            patchBatchItem={patchBatchItem} removeBatchItem={removeBatchItem} runBatch={runBatch}
            show={show}
          />
        )}
        {screen==='brand' && (
          <BrandScreen
            t={t}
            looks={looks} looksLoading={looksLoading}
            createLook={createLook}
        createLookWithPhoto={createLookWithPhoto}
        updateLookWithPhoto={updateLookWithPhoto} updateLook={updateLook} deleteLook={deleteLook} duplicateLook={duplicateLook}
            models={models} modelsLoading={modelsLoading}
            createModel={createModel} updateModel={updateModel} deleteModel={deleteModel} duplicateModel={duplicateModel}
            createModelWithPhoto={createModelWithPhoto} updateModelWithPhoto={updateModelWithPhoto}
            getConsistency={getConsistency} getNetworkTrends={getNetworkTrends} resetStudio={resetStudio}
            show={show}
          />
        )}
      </div>
      <Toast toasts={toasts} />
    </>
  )
}
