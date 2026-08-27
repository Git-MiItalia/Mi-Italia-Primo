import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import useLangStore from '../store/langStore'
import ReturnsDefaultModal from '../components/settings/ReturnsDefaultModal'
import PolicyEditorModal from '../components/settings/PolicyEditorModal'
import ClassMappingModal from '../components/settings/ClassMappingModal'
import { SEED_POLICIES, RETURNS_CLASSES, BASELINE_POLICY_ID, findById } from '../lib/returnsPolicy/model'
import { isLawfulOnline, buildClassMap } from '../lib/returnsPolicy/engine'
import { useCategoryTree } from '../lib/categoryTree'

const API      = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL

// ─── Media limits (from .env) ────────────────────────────────
const MAX_PHOTOS         = Number(import.meta.env.VITE_MAX_PHOTOS         ?? 10)
const MAX_VIDEOS         = Number(import.meta.env.VITE_MAX_VIDEOS         ?? 3)
const MAX_UPLOAD_COUNT   = Number(import.meta.env.VITE_MAX_UPLOAD_COUNT   ?? 10)
const MAX_PHOTO_SIZE_MB  = Number(import.meta.env.VITE_MAX_PHOTO_SIZE_MB  ?? 10)
const MAX_VIDEO_SIZE_MB  = Number(import.meta.env.VITE_MAX_VIDEO_SIZE_MB  ?? 10)

const isImageType = (t) => typeof t === 'string' && t.startsWith('image/')
const isVideoType = (t) => typeof t === 'string' && t.startsWith('video/')

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

function defaultHours() {
  return Object.fromEntries(DAYS.map(d => [d, { open:'10:00', close:'19:00' }]))
}

export default function StoreProfile() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const lang = useLangStore(s => s.lang)

  const DAY_LABELS = {
    monday:    t('store_profile.details.day_mon', 'Mon'),
    tuesday:   t('store_profile.details.day_tue', 'Tue'),
    wednesday: t('store_profile.details.day_wed', 'Wed'),
    thursday:  t('store_profile.details.day_thu', 'Thu'),
    friday:    t('store_profile.details.day_fri', 'Fri'),
    saturday:  t('store_profile.details.day_sat', 'Sat'),
    sunday:    t('store_profile.details.day_sun', 'Sun'),
  }

  const { tree: categoryTree } = useCategoryTree()
  const activeCategories = categoryTree.filter(c => (c.product_count ?? 0) > 0)

  const [profile, setProfile]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  const [name, setName]               = useState('')
  const [address, setAddress]         = useState('')
  const [city, setCity]               = useState('')
  const [postcode, setPostcode]       = useState('')
  const [country, setCountry]         = useState('IT')
  const [phone, setPhone]             = useState('')
  const [whatsapp, setWhatsapp]       = useState('')
  const [email, setEmail]             = useState('')
  const [description, setDescription] = useState('')
  const [hours, setHours]             = useState(defaultHours())

  const [founderCardEnabled, setFounderCardEnabled] = useState(true)
  const [founderName, setFounderName]     = useState('')
  const [founderTitle, setFounderTitle]   = useState('')
  const [founderPhotoUrl, setFounderPhotoUrl] = useState(null)
  const [founderSaving, setFounderSaving] = useState(false)
  const [founderSaved, setFounderSaved]   = useState(false)
  const founderPhotoRef = useRef()

  // ─── Cover photo (single hero image) ─────────────────────
  const [coverPhotoUrl, setCoverPhotoUrl]   = useState(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverError, setCoverError]         = useState(null)
  const coverPhotoRef = useRef()

  // ─── Media gallery (photos + videos) ─────────────────────
  const [media, setMedia]                 = useState([])
  const [mediaLoading, setMediaLoading]   = useState(true)
  const [uploading, setUploading]         = useState(false)
  const [uploadError, setUploadError]     = useState(null)
  const [showAllPhotosModal, setShowAllPhotosModal] = useState(false)
  const mediaFileRef = useRef()

  // ─── Social Media Platforms ───────────────────────────────
  const [instagramUrl, setInstagramUrl] = useState('')
  const [facebookUrl,  setFacebookUrl]  = useState('')
  const [tiktokUrl,    setTiktokUrl]    = useState('')
  const [pinterestUrl, setPinterestUrl] = useState('')
  const [youtubeUrl,   setYoutubeUrl]   = useState('')
  const [linkedinUrl,  setLinkedinUrl]  = useState('')
  const [xUrl,         setXUrl]         = useState('')
  const [openSocial,   setOpenSocial]   = useState(null)
  const [socialDraft,  setSocialDraft]  = useState('')
  const [socialSaving, setSocialSaving] = useState(false)
  const [socialSaved,  setSocialSaved]  = useState(false)
  const [socialEditMode, setSocialEditMode] = useState(false)

  const SOCIAL_VALUES = { instagram: instagramUrl, facebook: facebookUrl, tiktok: tiktokUrl, pinterest: pinterestUrl, youtube: youtubeUrl, linkedin: linkedinUrl, x: xUrl }
  const SOCIAL_SETTERS = { instagram: setInstagramUrl, facebook: setFacebookUrl, tiktok: setTiktokUrl, pinterest: setPinterestUrl, youtube: setYoutubeUrl, linkedin: setLinkedinUrl, x: setXUrl }
  // Only these 3 platforms are shown for now. Keep the rest wired (state/load/save) but
  // commented out of the active grid so they can be re-enabled by uncommenting below.
  const SOCIAL_PLATFORMS = [
    { key: 'instagram', label: 'Instagram', Icon: IconInstagram, color: '#E1306C' },
    { key: 'facebook',  label: 'Facebook',  Icon: IconFacebook,  color: '#1877F2' },
    { key: 'tiktok',    label: 'TikTok',    Icon: IconTikTok,    color: '#000000' },
    // { key: 'pinterest', label: 'Pinterest', Icon: IconPinterest, color: '#E60023' },
    // { key: 'youtube',   label: 'YouTube',   Icon: IconYoutube,   color: '#FF0000' },
    // { key: 'linkedin',  label: 'LinkedIn',  Icon: IconLinkedin,  color: '#0A66C2' },
    // { key: 'x',         label: 'X',         Icon: IconX,         color: '#000000' },
  ]

  function openSocialPopover(key) {
    setSocialDraft(SOCIAL_VALUES[key] ?? '')
    setOpenSocial(key)
  }
  function handleSocialTileClick(key) {
    if (socialEditMode) {
      openSocialPopover(key)
    } else if (SOCIAL_VALUES[key]) {
      window.open(SOCIAL_VALUES[key], '_blank', 'noopener,noreferrer')
    }
  }
  function saveSocialDraft() {
    SOCIAL_SETTERS[openSocial]?.(socialDraft)
    setOpenSocial(null)
  }

  const [terminal, setTerminal]       = useState('none')
  const [posPayment, setPosPayment]   = useState('external')
  const [website, setWebsite]         = useState('none')
  const [websiteUrl, setWebsiteUrl]   = useState('')
  const [posSystem, setPosSystem]     = useState('primo')
  const [techSaving, setTechSaving]   = useState(false)
  const [techSaved, setTechSaved]     = useState(false)

  // ─── Returns Policy (store default + policy library + returns classes) ───
  const [policies, setPolicies]             = useState(SEED_POLICIES)
  const [returnsClasses, setReturnsClasses] = useState(RETURNS_CLASSES)
  const [defaultPolicyId, setDefaultPolicyId] = useState(BASELINE_POLICY_ID)
  const [rpSaving, setRpSaving]       = useState(false)
  const [rpSaved, setRpSaved]         = useState(false)
  const [rpModal, setRpModal]         = useState(null) // { type:'default' } | { type:'policy', id } | { type:'class', classId }

  // Load profile
  useEffect(() => {
    apiFetch(`${API}/boutique/profile`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) return
        const d = res.data
        setProfile(d)
        setName(d.name ?? '')
        setAddress(d.address_line1 ?? '')
        setCity(d.city ?? '')
        setPostcode(d.postcode ?? '')
        setCountry(d?.country || 'IT')
        setPhone(d.phone ?? '')
        setWhatsapp(d.whatsapp ?? '')
        setEmail(d.email ?? '')
        setDescription(d.description ?? '')
        setFounderCardEnabled(d.founder_card_enabled ?? true)
        setFounderName(d.founder_name ?? '')
        setFounderTitle(d.founder_title ?? '')
        setFounderPhotoUrl(d.founder_photo_url ? `${IMG_BASE}${d.founder_photo_url}` : null)
        setCoverPhotoUrl(d.cover_photo_url ? `${IMG_BASE}${d.cover_photo_url}` : null)
        setTerminal(d.payment_terminal_type ?? 'none')
        setPosPayment(d.default_pos_payment_method ?? 'external')
        setWebsite(d.website_platform ?? 'none')
        setWebsiteUrl(d.website_url ?? '')
        setPosSystem(d.existing_pos_system ?? 'primo')
        const social = d.social_links_json ?? {}
        setInstagramUrl(social.instagram ?? '')
        setFacebookUrl(social.facebook ?? '')
        setTiktokUrl(social.tiktok ?? '')
        setPinterestUrl(social.pinterest ?? '')
        setYoutubeUrl(social.youtube ?? '')
        setLinkedinUrl(social.linkedin ?? '')
        setXUrl(social.x ?? '')
        if (Array.isArray(d.returns_policies_json) && d.returns_policies_json.length) {
          setPolicies(d.returns_policies_json)
        }
        if (d.returns_classes_json) {
          setReturnsClasses(RETURNS_CLASSES.map(c => ({
            ...c,
            map: Object.prototype.hasOwnProperty.call(d.returns_classes_json, c.id) ? d.returns_classes_json[c.id] : c.map,
          })))
        }
        if (d.returns_default_policy_id) setDefaultPolicyId(d.returns_default_policy_id)
        if (d.opening_hours_json) {
          const raw = d.opening_hours_json
          const parsed = {}
          DAYS.forEach(day => {
            const short = day.slice(0,3)
            if (raw[day]) {
              parsed[day] = typeof raw[day] === 'object' ? raw[day] : { open: raw[day].split('-')[0], close: raw[day].split('-')[1] }
            } else if (raw[short]) {
              parsed[day] = typeof raw[short] === 'object' ? raw[short] : { open: raw[short].split('-')[0], close: raw[short].split('-')[1] }
            } else {
              parsed[day] = { open: 'Closed', close: '' }
            }
          })
          setHours(parsed)
        }
        setLoading(false)
      })
  }, [])

  // Load media list
  useEffect(() => {
    apiFetch(`${API}/boutique/media`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) setMedia(res.data?.media ?? [])
      })
      .catch(() => {})
      .finally(() => setMediaLoading(false))
  }, [])

  function saveProfile() {
    setSaving(true)
    const hours_json = Object.fromEntries(DAYS.map(d => [d, hours[d]]))
    apiFetch(`${API}/boutique/profile`, {
      method: 'PUT',
      body: JSON.stringify({
        name, address_line1: address, city, postcode, phone, whatsapp, email, description,
        opening_hours_json: hours_json,
      }),
    }).then(r => r.json()).then(res => {
      setSaving(false)
      if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    })
  }

  function saveFounderCard() {
    setFounderSaving(true)
    apiFetch(`${API}/boutique/profile`, {
      method: 'PUT',
      body: JSON.stringify({
        founder_card_enabled: founderCardEnabled, founder_name: founderName, founder_title: founderTitle,
      }),
    }).then(r => r.json()).then(res => {
      setFounderSaving(false)
      if (res.success) { setFounderSaved(true); setTimeout(() => setFounderSaved(false), 2000) }
    })
  }

  function saveTechStack() {
    setTechSaving(true)
    apiFetch(`${API}/boutique/profile`, {
      method: 'PUT',
      body: JSON.stringify({
        payment_terminal_type: terminal, default_pos_payment_method: posPayment,
        website_platform: website, website_url: websiteUrl, existing_pos_system: posSystem,
      }),
    }).then(r => r.json()).then(res => {
      setTechSaving(false)
      if (res.success) { setTechSaved(true); setTimeout(() => setTechSaved(false), 2000) }
    })
  }

  function saveSocialLinks() {
    setSocialSaving(true)
    apiFetch(`${API}/boutique/profile`, {
      method: 'PUT',
      body: JSON.stringify({
        social_links_json: {
          instagram: instagramUrl, facebook: facebookUrl, tiktok: tiktokUrl, pinterest: pinterestUrl,
          youtube: youtubeUrl, linkedin: linkedinUrl, x: xUrl,
        },
      }),
    }).then(r => r.json()).then(res => {
      setSocialSaving(false)
      if (res.success) {
        setSocialSaved(true)
        setSocialEditMode(false)
        setTimeout(() => setSocialSaved(false), 2000)
      }
    })
  }

  function saveReturnsPolicy() {
    setRpSaving(true)
    apiFetch(`${API}/boutique/profile`, {
      method: 'PUT',
      body: JSON.stringify({
        returns_default_policy_id: defaultPolicyId,
        returns_policies_json: policies,
        returns_classes_json: buildClassMap(returnsClasses),
      }),
    }).then(r => r.json()).then(res => {
      setRpSaving(false)
      if (res.success) { setRpSaved(true); setTimeout(() => setRpSaved(false), 2000) }
    })
  }

  function handleSetDefault(id) {
    setDefaultPolicyId(id)
  }

  function handleSavePolicy(draft, isNew) {
    setPolicies(prev => isNew ? [...prev, draft] : prev.map(p => p.id === draft.id ? draft : p))
  }

  function handleRemovePolicy(id) {
    setPolicies(prev => prev.filter(p => p.id !== id))
    setReturnsClasses(prev => prev.map(c => c.map === id ? { ...c, map: null } : c))
  }

  function handleSaveClassMap(classId, newMap) {
    setReturnsClasses(prev => prev.map(c => c.id === classId ? { ...c, map: newMap } : c))
  }

  function rpName(item) { return lang === 'it' ? item.it : item.en }

  function rpWinText(p) {
    if (p.none) return t('returns_policy.window_none', 'No returns')
    return `${p.days} ${t('returns_policy.days', 'days')}`
  }

  const RP_SEED_DESC = {
    standard: { en: 'Meets the EU distance minimum. The compliant baseline.', it: 'Rispetta il minimo UE per le vendite a distanza. La base conforme.' },
    extended: { en: 'More generous than the minimum. Safe on any channel.', it: 'Più generosa del minimo. Sicura su ogni canale.' },
    mtm:      { en: 'No returns. Bespoke goods are exempt from the withdrawal right.', it: 'Nessun reso. I beni su misura sono esenti dal diritto di recesso.' },
    hygiene:  { en: 'No returns once unsealed. Sealed-goods exemption applies.', it: 'Nessun reso una volta aperto. Si applica l’esenzione per beni sigillati.' },
    final:    { en: 'No returns, no exemption. Lawful in-store only.', it: 'Nessun reso, nessuna esenzione. Lecita solo in negozio.' },
  }
  function rpDescFor(p) {
    if (RP_SEED_DESC[p.id] && !p.edited) return lang === 'it' ? RP_SEED_DESC[p.id].it : RP_SEED_DESC[p.id].en
    if (p.none) {
      const exTxt = p.exempt === 'bespoke'
        ? t('returns_policy.desc.bespoke_exemption', 'bespoke exemption')
        : p.exempt === 'sealed'
          ? t('returns_policy.desc.sealed_exemption', 'sealed exemption')
          : t('returns_policy.desc.instore_only', 'in-store only')
      return `${t('returns_policy.desc.no_returns_prefix', 'No returns,')} ${exTxt}.`
    }
    return `${t('returns_policy.desc.custom_window_prefix', 'Custom window of')} ${p.days} ${t('returns_policy.desc.days_suffix', 'days.')}`
  }

  function rpStatusFor(p) {
    if (p.id === defaultPolicyId) return { cls: 'pending', label: t('returns_policy.status.default', 'Store default') }
    if (!isLawfulOnline(p)) return { cls: 'cancelled', label: t('returns_policy.status.instore_only', 'In-store only') }
    if (p.exempt === 'bespoke') return { cls: 'active', label: t('returns_policy.status.exempt_bespoke', 'Exempt: bespoke') }
    if (p.exempt === 'sealed') return { cls: 'active', label: t('returns_policy.status.exempt_sealed', 'Exempt: sealed') }
    return { cls: 'active', label: t('returns_policy.status.compliant', 'Compliant') }
  }

  const RP_CLASS_NOTES = {
    standard:  { en: 'Most products', it: 'La maggior parte dei prodotti' },
    mtm:       { en: 'Not present in browse taxonomy; assigned manually', it: 'Non presente nella tassonomia; assegnata manualmente' },
    sealed:    { en: 'Swimwear, sealed or pierced items', it: 'Costumi, articoli sigillati o forati' },
    finalsale: { en: 'As-is stock; falls back to default online', it: 'Merce as-is; ricade sulla predefinita online' },
  }
  function rpClassNote(c) {
    const n = RP_CLASS_NOTES[c.id]
    return n ? (lang === 'it' ? n.it : n.en) : ''
  }

  function uploadFounderPhoto(file) {
    const fd = new FormData()
    fd.append('photo', file)
    apiFetch(`${API}/boutique/profile/founder-photo`, { method: 'POST', body: fd })
      .then(r => r.json())
      .then(res => { if (res.success) setFounderPhotoUrl(`${IMG_BASE}${res.data.founder_photo_url}`) })
  }

  // ─── Cover photo upload ──────────────────────────────────
  function uploadCoverPhoto(file) {
    setCoverError(null)
    if (!isImageType(file.type)) {
      setCoverError(t('store_profile.photo.err_not_image', 'Please select an image file.'))
      return
    }
    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      setCoverError(t('store_profile.photo.err_too_large', { size: MAX_PHOTO_SIZE_MB, defaultValue: 'File is over {{size}}MB.' }))
      return
    }

    setCoverUploading(true)
    const fd = new FormData()
    fd.append('coverPhoto', file)

    apiFetch(`${API}/boutique/profile/cover-photo`, { method: 'POST', body: fd })
      .then(r => r.json())
      .then(res => {
        if (res?.success) {
          setCoverPhotoUrl(`${IMG_BASE}${res.data.cover_photo_url}`)
        } else {
          setCoverError(res?.message || t('store_profile.photo.upload_failed', 'Upload failed'))
        }
      })
      .catch(() => setCoverError(t('store_profile.photo.upload_failed_network', 'Upload failed — check your connection')))
      .finally(() => setCoverUploading(false))
  }

  // ─── Media handlers ─────────────────────────────────────
  function handleMediaSelect(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    setUploadError(null)

    const images  = files.filter(f => isImageType(f.type))
    const videos  = files.filter(f => isVideoType(f.type))
    const invalid = files.filter(f => !isImageType(f.type) && !isVideoType(f.type))

    const errors = []
    if (invalid.length > 0) errors.push(t('store_profile.photo.err_unsupported', { count: invalid.length, defaultValue: '{{count}} file(s) rejected (unsupported format)' }))

    const oversizedImages = images.filter(f => f.size > MAX_PHOTO_SIZE_MB * 1024 * 1024)
    const oversizedVideos = videos.filter(f => f.size > MAX_VIDEO_SIZE_MB * 1024 * 1024)
    if (oversizedImages.length > 0) errors.push(t('store_profile.photo.err_photos_oversized', { count: oversizedImages.length, size: MAX_PHOTO_SIZE_MB, defaultValue: '{{count}} photo(s) over {{size}}MB' }))
    if (oversizedVideos.length > 0) errors.push(t('store_profile.photo.err_videos_oversized', { count: oversizedVideos.length, size: MAX_VIDEO_SIZE_MB, defaultValue: '{{count}} video(s) over {{size}}MB' }))

    const validImages = images.filter(f => f.size <= MAX_PHOTO_SIZE_MB * 1024 * 1024)
    const validVideos = videos.filter(f => f.size <= MAX_VIDEO_SIZE_MB * 1024 * 1024)

    const currentPhotos = media.filter(m => m.media_type === 'image').length
    const currentVideos = media.filter(m => m.media_type === 'video').length
    const photoSlots = Math.max(0, MAX_PHOTOS - currentPhotos)
    const videoSlots = Math.max(0, MAX_VIDEOS - currentVideos)

    const finalImages = validImages.slice(0, photoSlots)
    const finalVideos = validVideos.slice(0, videoSlots)
    if (validImages.length > finalImages.length) errors.push(t('store_profile.photo.err_photos_skipped', { count: validImages.length - finalImages.length, max: MAX_PHOTOS, defaultValue: '{{count}} photo(s) skipped (max {{max}})' }))
    if (validVideos.length > finalVideos.length) errors.push(t('store_profile.photo.err_videos_skipped', { count: validVideos.length - finalVideos.length, max: MAX_VIDEOS, defaultValue: '{{count}} video(s) skipped (max {{max}})' }))

    const combined = [...finalImages, ...finalVideos]
    if (combined.length > MAX_UPLOAD_COUNT) errors.push(t('store_profile.photo.err_max_per_upload', { max: MAX_UPLOAD_COUNT, defaultValue: 'Only {{max}} files per upload' }))
    const toUpload = combined.slice(0, MAX_UPLOAD_COUNT)

    if (errors.length > 0) setUploadError(errors.join(' · '))
    if (toUpload.length === 0) return

    const fd = new FormData()
    toUpload.forEach(f => fd.append('files', f))

    setUploading(true)
    apiFetch(`${API}/boutique/media`, { method: 'POST', body: fd })
      .then(r => r.json())
      .then(res => {
        if (res?.success) {
          setMedia(prev => [...prev, ...(res.data?.media ?? [])])
        } else {
          setUploadError(res?.message || t('store_profile.photo.upload_failed', 'Upload failed'))
        }
      })
      .catch(() => setUploadError(t('store_profile.photo.upload_failed_network', 'Upload failed — check your connection')))
      .finally(() => setUploading(false))
  }

  function deleteMedia(mediaId) {
    const backup = media
    setMedia(prev => prev.filter(m => m.id !== mediaId))
    setUploadError(null)

    apiFetch(`${API}/boutique/media/${mediaId}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(res => {
        if (!res?.success) {
          setMedia(backup)
          setUploadError(res?.message || t('store_profile.photo.delete_failed', 'Delete failed'))
        }
      })
      .catch(() => {
        setMedia(backup)
        setUploadError(t('store_profile.photo.delete_failed_network', 'Delete failed — check your connection'))
      })
  }

  function updateHour(day, field, value) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  const photoCount = media.filter(m => m.media_type === 'image').length
  const videoCount = media.filter(m => m.media_type === 'video').length
  const canAddMore = photoCount < MAX_PHOTOS || videoCount < MAX_VIDEOS

  const GALLERY_ROW_SIZE = 3
  const rowMedia = media.slice(0, GALLERY_ROW_SIZE)

  function renderMediaCell(m) {
    const fullUrl = `${IMG_BASE}${m.url}`
    return (
      <div key={m.id} className="sp-media-cell">
        {m.media_type === 'video' ? (
          <video src={fullUrl} preload="metadata" muted playsInline className="sp-media-video" />
        ) : (
          <div className="sp-media-img" style={{ backgroundImage:`url('${fullUrl}')` }} />
        )}
        {m.media_type === 'video' && (
          <div className="sp-media-video-badge">
            <span className="material-symbols-outlined">play_arrow</span>
            <span className="sp-media-video-badge-text">{t('store_profile.photo.video_badge', 'VIDEO')}</span>
          </div>
        )}
        <button
          className="sp-media-delete-btn"
          onClick={() => deleteMedia(m.id)}
          title={t('store_profile.photo.remove_tooltip', 'Remove')}
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    )
  }

  function renderAddMediaTile() {
    return (
      <div
        className={`sp-media-add${uploading ? ' is-loading' : ''}`}
        onClick={() => !uploading && mediaFileRef.current.click()}
      >
        <div className="sp-media-add-inner">
          {uploading ? (
            <>
              <span className="material-symbols-outlined">hourglass_top</span>
              <div className="sp-media-add-lbl">{t('store_profile.uploading', 'Uploading…')}</div>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">add_photo_alternate</span>
              <div className="sp-media-add-lbl">{t('store_profile.photo.add_media', 'Add media')}</div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="sp-page-loading">
      <span className="material-symbols-outlined">hourglass_empty</span>
      <div className="sp-page-loading-text">{t('store_profile.loading', 'Loading profile…')}</div>
    </div>
  )

  return (
    <>
    <div className="grid2">

      {/* ══ LEFT COLUMN ══ */}
      <div>

        {/* Store Details */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('store_profile.details.title', 'Store')} <em>{t('store_profile.details.title_em', 'Details')}</em></div>
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('store_profile.details.name_label', 'Store Name')}</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">{t('store_profile.details.address_label', 'Address')}</label>
              <input className="form-input" value={address} onChange={e => setAddress(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('store_profile.details.city_label', 'City')}</label>
              <input className="form-input" value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>
          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">{t('store_profile.details.postcode_label', 'Postcode')}</label>
              <input className="form-input" value={postcode} onChange={e => setPostcode(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('store_profile.details.email_label', 'Email')}</label>
              <input className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">{t('store_profile.details.phone_label', 'Phone')}</label>
              <PhoneInput
                international
                defaultCountry={country || 'IT'}
                value={phone}
                onChange={v => setPhone(v || '')}
                className="sp-phone-input"
              />
              {phone && !isValidPhoneNumber(phone) && (
                <div className="form-hint sp-phone-hint-invalid">
                  {t('store_profile.details.invalid_phone', 'Not a valid phone number')}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-lbl">{t('store_profile.details.whatsapp_label', 'WhatsApp')}</label>
              <PhoneInput
                international
                defaultCountry={country || 'IT'}
                value={whatsapp}
                onChange={v => setWhatsapp(v || '')}
                className="sp-phone-input"
              />
              {whatsapp && !isValidPhoneNumber(whatsapp) && (
                <div className="form-hint sp-phone-hint-invalid">
                  {t('store_profile.details.invalid_phone', 'Not a valid phone number')}
                </div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('store_profile.details.bio_label', 'Store Bio')}</label>
            <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('store_profile.details.hours_label', 'Opening Hours')}</label>
            <div className="sp-hours-list">
              {DAYS.map(day => (
                <div key={day} className="sp-hours-row">
                  <span className="sp-hours-day">{DAY_LABELS[day]}</span>
                  <input className="form-input sp-hours-input" value={hours[day]?.open ?? ''} onChange={e => updateHour(day, 'open', e.target.value)} placeholder={t('store_profile.details.hours_open_placeholder', '10:00')} />
                  <span className="sp-hours-sep">–</span>
                  <input className="form-input sp-hours-input" value={hours[day]?.close ?? ''} onChange={e => updateHour(day, 'close', e.target.value)} placeholder={t('store_profile.details.hours_close_placeholder', '19:00 or Closed')} />
                </div>
              ))}
            </div>
          </div>
          <div className="sp-card-footer-actions">
            <button className="btn btn-sm btn-primary" onClick={saveProfile} disabled={saving}>
              {saved ? `✓ ${t('common.saved', 'Saved')}` : saving ? t('common.saving', 'Saving…') : t('store_profile.save_changes_btn', 'Save Changes')}
            </button>
          </div>
        </div>

        {/* Social Media Platforms */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('store_profile.social.title', 'Social Media')} <em>{t('store_profile.social.title_em', 'Platforms')}</em></div>
            <div className="sp-social-hdr-actions">
              {!socialEditMode && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline sp-social-edit-btn"
                  onClick={() => setSocialEditMode(true)}
                  title={t('common.edit', 'Edit')}
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
              )}
              <button className="btn btn-sm btn-primary" onClick={saveSocialLinks} disabled={socialSaving}>
                {socialSaved ? `✓ ${t('common.saved', 'Saved')}` : socialSaving ? t('common.saving', 'Saving…') : t('store_profile.save_btn', 'Save')}
              </button>
            </div>
          </div>
          <p className="sp-social-intro">{t('store_profile.social.intro', 'Add the links to your Social Media')}</p>
          <div className="sp-social-grid">
            {SOCIAL_PLATFORMS.map(p => {
              const value = SOCIAL_VALUES[p.key]
              return (
                <div key={p.key} className="sp-social-tile-wrap">
                  <div
                    className={`sp-social-tile${value ? ' filled' : ''}${!socialEditMode && !value ? ' no-link' : ''}`}
                    onClick={() => handleSocialTileClick(p.key)}
                  >
                    <span className="sp-social-icon" style={{ color: p.color }}><p.Icon /></span>
                    <div className="sp-social-tile-body">
                      <div className="sp-social-tile-label">{p.label}</div>
                      <div className="sp-social-tile-sub">{value || t('store_profile.social.add_link', 'Add link')}</div>
                    </div>
                  </div>
                  {openSocial === p.key && (
                    <>
                      <div className="sp-social-popover-overlay" onClick={() => setOpenSocial(null)} />
                      <div className="sp-social-popover">
                        <label className="form-lbl">{t('store_profile.social.link_label', '{{platform}} Link', { platform: p.label })}</label>
                        <input
                          className="form-input"
                          value={socialDraft}
                          onChange={e => setSocialDraft(e.target.value)}
                          placeholder={`https://${p.key}.com/yourstore`}
                          autoFocus
                        />
                        <div className="sp-social-popover-actions">
                          <button className="btn btn-outline btn-sm" onClick={() => setOpenSocial(null)}>{t('common.cancel', 'Cancel')}</button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm sp-social-popover-save"
                            onClick={saveSocialDraft}
                            title={t('common.save', 'Save')}
                          >
                            <span className="material-symbols-outlined">check</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Founder Card */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('store_profile.founder.title', 'Founder')} <em>{t('store_profile.founder.title_em', 'Card')}</em></div>
            <button className="btn btn-sm btn-primary" onClick={saveFounderCard} disabled={founderSaving}>
              {founderSaved ? `✓ ${t('common.saved', 'Saved')}` : founderSaving ? t('common.saving', 'Saving…') : t('store_profile.save_btn', 'Save')}
            </button>
          </div>

          <div className="sp-founder-toggle-row">
            <div>
              <div className="sp-founder-toggle-title">{t('store_profile.founder.toggle_title', 'Show founder card on boutique page')}</div>
              <div className="sp-founder-toggle-sub">{t('store_profile.founder.toggle_sub', 'Displays founder photo and name on your Mi Italia listing')}</div>
            </div>
            <div className={`toggle${founderCardEnabled ? ' on' : ''}`} onClick={() => setFounderCardEnabled(v => !v)}>
              <div className="toggle-knob" />
            </div>
          </div>

          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">{t('store_profile.founder.name_label', 'Founder Name')}</label>
              <input className="form-input" value={founderName} onChange={e => setFounderName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('store_profile.founder.role_label', 'Founder Title')}</label>
              <input className="form-input" value={founderTitle} onChange={e => setFounderTitle(e.target.value)} />
            </div>
          </div>

          <input ref={founderPhotoRef} type="file" accept="image/*" className="sp-file-hidden"
            onChange={e => { if (e.target.files[0]) uploadFounderPhoto(e.target.files[0]) }} />

          {founderPhotoUrl ? (
            <div className="sp-founder-preview">
              <div className="sp-founder-photo" style={{ backgroundImage:`url('${founderPhotoUrl}')` }} />
              <div className="sp-founder-preview-body">
                <div className="sp-founder-preview-title">{t('store_profile.founder.photo_uploaded', 'Founder photo uploaded')}</div>
                <button className="btn btn-sm btn-outline" onClick={() => founderPhotoRef.current.click()}>{t('store_profile.replace_btn', 'Replace')}</button>
              </div>
            </div>
          ) : (
            <div className="upload-zone sp-clickable" onClick={() => founderPhotoRef.current.click()}>
              <span className="material-symbols-outlined">person</span>
              <div className="upload-zone-title">{t('store_profile.founder.upload_title', 'Upload Founder Photo')}</div>
              <div className="upload-zone-sub">{t('store_profile.founder.upload_hint', 'Min 400×400px · Square crop recommended')}</div>
            </div>
          )}
        </div>

        {/* Returns Policies */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('returns_policy.title_a', 'Returns')} <em>{t('returns_policy.title_b', 'Policies')}</em></div>
            <button className="btn btn-sm btn-primary" onClick={saveReturnsPolicy} disabled={rpSaving}>
              {rpSaved ? `✓ ${t('common.saved', 'Saved')}` : rpSaving ? t('common.saving', 'Saving…') : t('store_profile.save_btn', 'Save')}
            </button>
          </div>

          <div className="rp-banner">
            <div>
              <div className="rp-banner-lbl">{t('returns_policy.default_lbl', 'Store default')}</div>
              <div className="rp-banner-val">
                {(() => {
                  const d = findById(policies, defaultPolicyId)
                  return d ? `${rpName(d)} · ${rpWinText(d)}` : '—'
                })()}
              </div>
              <div className="rp-banner-sub">{t('returns_policy.default_sub', 'Applied to every product without an override')}</div>
            </div>
            <button className="btn btn-sm btn-outline" onClick={() => setRpModal({ type: 'default' })}>
              {t('returns_policy.change_default_btn', 'Change default')}
            </button>
          </div>

          <div className="rp-lib-hdr">
            <div className="form-lbl">{t('returns_policy.library_title', 'Policy library')}</div>
            <button className="btn btn-xs btn-primary" onClick={() => setRpModal({ type: 'policy', id: null })}>
              <span className="material-symbols-outlined">add</span> {t('returns_policy.new_policy_btn', 'New policy')}
            </button>
          </div>

          {policies.map(p => {
            const status = rpStatusFor(p)
            return (
              <div key={p.id} className="rp-row">
                <div className="rp-row-body">
                  <div className="rp-row-name">{rpName(p)}</div>
                  <div className="rp-row-desc">{rpDescFor(p)}</div>
                  <div className="rp-row-meta">
                    {rpWinText(p)} · {p.online ? t('returns_policy.online', 'Online') : t('returns_policy.online_off', 'Not online')} · {p.instore ? t('returns_policy.instore', 'In-store') : t('returns_policy.instore_off', 'Not in-store')}
                  </div>
                </div>
                <span className={`status ${status.cls}`}>{status.label}</span>
                <button className="btn btn-sm btn-outline" onClick={() => setRpModal({ type: 'policy', id: p.id })}>
                  {t('common.edit', 'Edit')}
                </button>
              </div>
            )
          })}

          <div className="alert alert-info rp-callout">
            <span className="material-symbols-outlined">gavel</span>
            <span>
              <strong>{t('returns_policy.callout_strong', 'Separate from returns:')}</strong>{' '}
              {t('returns_policy.callout_body', 'the two-year legal guarantee for faulty goods always applies and is never affected by any policy above. Online sales inherit the 14-day withdrawal minimum by law.')}
            </span>
          </div>
        </div>

        {/* Returns Classes */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('returns_classes.title_a', 'Returns')} <em>{t('returns_classes.title_b', 'Classes')}</em></div>
            <button className="btn btn-sm btn-primary" onClick={saveReturnsPolicy} disabled={rpSaving}>
              {rpSaved ? `✓ ${t('common.saved', 'Saved')}` : rpSaving ? t('common.saving', 'Saving…') : t('store_profile.save_changes_btn', 'Save Changes')}
            </button>
          </div>

          {returnsClasses.map(c => {
            const mapped = c.map ? findById(policies, c.map) : null
            const fallbackDefault = findById(policies, defaultPolicyId)
            const mappedName = mapped ? rpName(mapped) : t('returns_classes.follow_default', 'Store default')
            const win = mapped ? rpWinText(mapped) : (fallbackDefault ? rpWinText(fallbackDefault) : '')
            return (
              <div key={c.id} className="rp-row">
                <div className="rp-row-body">
                  <div className="rp-row-name">{rpName(c)}</div>
                  <div className="rp-row-desc">{rpClassNote(c)}</div>
                  <div className="rp-row-meta">
                    {mapped ? mappedName : <em>{mappedName}</em>} · {win}
                  </div>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => setRpModal({ type: 'class', classId: c.id })}>
                  {t('common.change', 'Change')}
                </button>
              </div>
            )
          })}

          <div className="alert alert-info rp-callout">
            <span className="material-symbols-outlined">account_tree</span>
            <span>
              <strong>{t('returns_classes.callout_strong', 'Precedence:')}</strong>{' '}
              {t('returns_classes.callout_body', 'product override beats returns class beats store default. Final Sale eligible maps to an in-store-only policy; if such a product is listed online it falls back to the store default, shown transparently.')}
            </span>
          </div>
        </div>
      </div>

      {/* ══ RIGHT COLUMN ══ */}
      <div>

        {/* Store Photography — cover photo + gallery */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('store_profile.photo.title', 'Store')} <em>{t('store_profile.photo.title_em', 'Photography')}</em></div>
          </div>

          {/* Cover Photo — single hero image */}
          <div className="sp-photo-section">
            <div className="sp-photo-section-lbl">{t('store_profile.photo.cover_label', 'Cover Photo')}</div>

            <input ref={coverPhotoRef} type="file" accept="image/*" className="sp-file-hidden"
              onChange={e => { if (e.target.files[0]) uploadCoverPhoto(e.target.files[0]); e.target.value = '' }} />

            {coverError && (
              <div className="sp-alert-error">
                <span className="material-symbols-outlined sp-alert-icon">error</span>
                <span className="sp-alert-error-body">{coverError}</span>
                <button className="sp-alert-close" onClick={() => setCoverError(null)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            )}

            {coverPhotoUrl ? (
              <div className="sp-cover-preview" style={{ backgroundImage: `url('${coverPhotoUrl}')` }}>
                <button
                  className="sp-cover-replace-btn"
                  onClick={() => !coverUploading && coverPhotoRef.current.click()}
                  disabled={coverUploading}
                >
                  <span className="material-symbols-outlined">{coverUploading ? 'hourglass_top' : 'edit'}</span>
                  {coverUploading ? t('store_profile.uploading', 'Uploading…') : t('store_profile.replace_btn', 'Replace')}
                </button>
              </div>
            ) : (
              <div
                className={`upload-zone sp-clickable${coverUploading ? ' is-loading' : ''}`}
                onClick={() => !coverUploading && coverPhotoRef.current.click()}
              >
                <span className="material-symbols-outlined">{coverUploading ? 'hourglass_top' : 'add_photo_alternate'}</span>
                <div className="upload-zone-title">{coverUploading ? t('store_profile.uploading', 'Uploading…') : t('store_profile.photo.upload_cover_title', 'Upload Cover Photo')}</div>
                <div className="upload-zone-sub">{t('store_profile.photo.upload_cover_hint', '1200×400px recommended · Used as hero on boutique page')}</div>
              </div>
            )}
          </div>

          {/* Gallery — photos + videos */}
          <div>
            <div className="sp-gallery-hdr">
              <div className="sp-photo-section-lbl">{t('store_profile.photo.gallery_label', 'Gallery')}</div>
              <div className="sp-gallery-count">
                {t('store_profile.photo.gallery_count', { photoCount, maxPhotos: MAX_PHOTOS, videoCount, maxVideos: MAX_VIDEOS, defaultValue: '{{photoCount}}/{{maxPhotos}} photos · {{videoCount}}/{{maxVideos}} videos' })}
              </div>
            </div>

            <input ref={mediaFileRef} type="file" accept="image/*,video/*" multiple className="sp-file-hidden"
              onChange={e => { handleMediaSelect(e.target.files); e.target.value = '' }} />

            {uploadError && (
              <div className="sp-alert-error">
                <span className="material-symbols-outlined sp-alert-icon">error</span>
                <span className="sp-alert-error-body">{uploadError}</span>
                <button className="sp-alert-close" onClick={() => setUploadError(null)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            )}

            {mediaLoading ? (
              <div className="sp-media-loading">{t('store_profile.photo.loading_media', 'Loading media…')}</div>
            ) : (
              <>
                <div className="sp-media-grid">
                  {rowMedia.map(m => renderMediaCell(m))}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline ap-see-all-models-btn sp-media-see-all-btn"
                  onClick={() => setShowAllPhotosModal(true)}
                >
                  {t('store_profile.photo.see_all_btn', 'See all Photos')}
                </button>
              </>
            )}

            <div className="sp-media-hint">
              {t('store_profile.photo.media_hint', { photoSize: MAX_PHOTO_SIZE_MB, videoSize: MAX_VIDEO_SIZE_MB, max: MAX_UPLOAD_COUNT, defaultValue: 'Photos up to {{photoSize}}MB · Videos up to {{videoSize}}MB · Max {{max}} files per upload' })}
              {!canAddMore && (
                <span className="sp-media-hint-warn">· {t('store_profile.photo.gallery_full', 'Gallery full — remove media to add more')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="card">
          <div className="card-hdr"><div className="card-title">{t('store_profile.categories.title', 'Categories (By your Products)')}</div></div>
          <div className="sp-cat-chips">
            {activeCategories.map(c => (
              <div key={c.id} className="sp-cat-chip">{c.name}</div>
            ))}
          </div>
        </div>

        {/* Language & Region */}
        <div className="card">
          <div className="card-hdr"><div className="card-title">{t('store_profile.language.title', 'Language &')} <em>{t('store_profile.language.title_em', 'Region')}</em></div></div>
          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">{t('store_profile.language.primary_label', 'Primary Language')}</label>
              <select className="form-select"><option>{t('store_profile.language.opt_italian', 'Italian')}</option><option>{t('store_profile.language.opt_english', 'English')}</option></select>
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('store_profile.language.currency_label', 'Currency')}</label>
              <select className="form-select"><option>{t('store_profile.language.opt_eur', 'EUR €')}</option></select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('store_profile.language.active_label', 'Active Languages')}</label>
            <div className="sp-lang-list">
              {[{l:'IT',on:true},{l:'EN',on:true},{l:'FR',on:false},{l:'DE',on:false},{l:'AR',on:false},{l:'ZH',on:false}].map(({l,on}) => (
                <span key={l} className={`sp-lang-chip${on ? ' on' : ''}`}>{l}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="card">
          <div className="card-hdr">
            <div>
              <div className="card-title">{t('store_profile.tech.title', 'Tech')} <em>{t('store_profile.tech.title_em', 'Stack')}</em></div>
              <div className="sp-tech-sub">{t('store_profile.tech.sub', 'Helps us connect Primo to your existing tools')}</div>
            </div>
            <button className="btn btn-sm btn-primary" onClick={saveTechStack} disabled={techSaving}>
              {techSaved ? `✓ ${t('common.saved', 'Saved')}` : techSaving ? t('common.saving', 'Saving…') : t('store_profile.save_btn', 'Save')}
            </button>
          </div>

          <div className="sp-tech-section">
            <span className="material-symbols-outlined">credit_card</span>{t('store_profile.tech.terminal_section', 'In-Store Payment Terminal')}
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('store_profile.tech.terminal_question', 'How do you take card payments in-store?')}</label>
            <select className="form-select" value={terminal} onChange={e => setTerminal(e.target.value)}>
              <option value="stripe">{t('store_profile.tech.opt_stripe', 'Stripe Terminal (Mi Italia integrated)')}</option>
              <option value="sumup">SumUp</option>
              <option value="square">Square</option>
              <option value="verifone">Verifone</option>
              <option value="bank">{t('store_profile.tech.opt_bank', 'Bank-issued terminal')}</option>
              <option value="other">{t('store_profile.tech.opt_other_terminal', 'Other external terminal')}</option>
              <option value="none">{t('store_profile.tech.opt_no_terminal', 'No card payments in-store')}</option>
            </select>
          </div>
          {terminal === 'stripe'
            ? <div className="alert alert-info"><span className="material-symbols-outlined">check_circle</span>{t('store_profile.tech.stripe_alert', 'Stripe Terminal is fully integrated with Primo POS. Card payments are processed directly and commission is auto-deducted per sale.')}</div>
            : terminal !== 'none' && <div className="alert alert-warn"><span className="material-symbols-outlined">info</span>{t('store_profile.tech.external_alert', "External terminals work seamlessly with Primo. Primo tracks the sale and calculates commission. You'll receive a monthly invoice for POS commission rather than per-transaction deduction.")}</div>
          }

          <div className="sp-divider" />

          <div className="form-group">
            <label className="form-lbl">{t('store_profile.tech.pos_method_label', 'Default POS Payment Method')}</label>
            <select className="form-select" value={posPayment} onChange={e => setPosPayment(e.target.value)}>
              <option value="external_terminal">{t('store_profile.tech.opt_pos_external', 'External Terminal (show external panel first)')}</option>
              <option value="stripe">{t('store_profile.tech.opt_pos_stripe', 'Stripe Terminal')}</option>
              <option value="cash">{t('store_profile.tech.opt_pos_cash', 'Cash')}</option>
            </select>
            <div className="form-hint">{t('store_profile.tech.pos_method_hint', 'This pre-selects the payment tab when you open POS. You can always switch during a sale.')}</div>
          </div>

          <div className="sp-divider" />

          <div className="sp-tech-section">
            <span className="material-symbols-outlined">language</span>{t('store_profile.tech.website_section', 'Your Website')}
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('store_profile.tech.website_question', 'Do you have your own website?')}</label>
            <select className="form-select" value={website} onChange={e => setWebsite(e.target.value)}>
              <option value="none">{t('store_profile.tech.opt_no_website', 'No — Mi Italia is my only online presence')}</option>
              <option value="shopify">{t('store_profile.tech.opt_website_shopify', 'Yes — Shopify')}</option>
              <option value="woocommerce">{t('store_profile.tech.opt_website_woo', 'Yes — WooCommerce')}</option>
              <option value="lightspeed">{t('store_profile.tech.opt_website_lightspeed', 'Yes — Lightspeed eCom')}</option>
              <option value="custom">{t('store_profile.tech.opt_website_custom', 'Yes — Custom / other platform')}</option>
            </select>
          </div>
          {website !== 'none' && (
            <div className="form-group">
              <label className="form-lbl">{t('store_profile.tech.website_url_label', 'Website URL')}</label>
              <input className="form-input" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder={t('store_profile.tech.website_url_placeholder', 'https://yourstore.com')} />
            </div>
          )}
          {website === 'shopify' && (
            <div className="sp-integration-box sp-integration-shopify">
              <div className="sp-integration-hdr">
                <span className="material-symbols-outlined">store</span>
                <div className="sp-integration-title">{t('store_profile.tech.shopify_title', 'Shopify Integration')}</div>
              </div>
              <div className="sp-integration-body">{t('store_profile.tech.shopify_body', 'Mirror your Shopify catalogue, orders, and customers, and write POS sales back to Shopify. Set it up under Settings › Integrations.')}</div>
              <button className="btn btn-sm btn-outline sp-integration-btn" onClick={() => navigate('/integrations')}><span className="material-symbols-outlined">cable</span>{t('store_profile.tech.go_to_integrations_btn', 'Go to Integrations')}</button>
            </div>
          )}
          {website === 'woocommerce' && (
            <div className="sp-integration-box sp-integration-woo">
              <div className="sp-integration-hdr">
                <span className="material-symbols-outlined">store</span>
                <div className="sp-integration-title">{t('store_profile.tech.woo_title', 'WooCommerce Integration — Coming Soon')}</div>
              </div>
              <div className="sp-integration-body">{t('store_profile.tech.woo_body', 'A Mi Italia WooCommerce plugin will allow automatic product and inventory sync between your WordPress store and Primo.')}</div>
              <button className="btn btn-sm btn-outline sp-integration-btn"><span className="material-symbols-outlined">notifications</span>{t('store_profile.tech.notify_btn', 'Notify Me When Available')}</button>
            </div>
          )}
          {website === 'none' && (
            <div className="alert alert-info"><span className="material-symbols-outlined">info</span>{t('store_profile.tech.no_website_alert', 'Mi Italia + Primo is your complete online retail presence. Your boutique page on Mi Italia serves as your public storefront.')}</div>
          )}

          <div className="sp-divider" />

          <div className="sp-tech-section">
            <span className="material-symbols-outlined">point_of_sale</span>{t('store_profile.tech.pos_section', 'Existing POS System')}
          </div>
          <div className="form-group sp-form-group-tight">
            <label className="form-lbl">{t('store_profile.tech.pos_question', 'Do you use a dedicated POS system?')}</label>
            <select className="form-select" value={posSystem} onChange={e => setPosSystem(e.target.value)}>
              <option value="primo">{t('store_profile.tech.opt_no_pos', 'No — Primo POS is my only system')}</option>
              <option value="lightspeed">Lightspeed Retail</option>
              <option value="square-pos">Square POS</option>
              <option value="shopify-pos">Shopify POS</option>
              <option value="revel">Revel Systems</option>
              <option value="other-pos">{t('store_profile.tech.opt_other_pos', 'Other POS system')}</option>
            </select>
          </div>
          {posSystem !== 'primo' && (
            <div className="alert alert-warn sp-alert-tight">
              <span className="material-symbols-outlined">info</span>{t('store_profile.tech.dual_pos_alert', 'Running two POS systems is fine. Use Primo POS for Mi Italia app customers and reservations. Use your existing POS for all other in-store transactions.')}
            </div>
          )}
        </div>
      </div>
    </div>

    {rpModal?.type === 'default' && (
      <ReturnsDefaultModal
        policies={policies}
        currentDefaultId={defaultPolicyId}
        onSave={handleSetDefault}
        onClose={() => setRpModal(null)}
      />
    )}
    {rpModal?.type === 'policy' && (
      <PolicyEditorModal
        policy={rpModal.id ? findById(policies, rpModal.id) : null}
        isCurrentDefault={rpModal.id === defaultPolicyId}
        onSave={handleSavePolicy}
        onRemove={handleRemovePolicy}
        onClose={() => setRpModal(null)}
      />
    )}
    {rpModal?.type === 'class' && (
      <ClassMappingModal
        klass={findById(returnsClasses, rpModal.classId)}
        policies={policies}
        storeDefaultId={defaultPolicyId}
        onSave={(newMap) => handleSaveClassMap(rpModal.classId, newMap)}
        onClose={() => setRpModal(null)}
      />
    )}

    {/* ── All Gallery Photos modal ────────────────────────────────────────── */}
    {showAllPhotosModal && (
      <div className="modal-backdrop" onClick={() => setShowAllPhotosModal(false)}>
        <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ overflowY:'auto', maxHeight:'85vh' }}>
          <div className="modal-hdr">
            <div className="modal-title">{t('store_profile.photo.all_modal_title', 'All')} <em>{t('store_profile.photo.all_modal_title_em', 'Gallery Photos')}</em></div>
            <div className="modal-close" onClick={() => setShowAllPhotosModal(false)}>
              <span className="material-symbols-outlined">close</span>
            </div>
          </div>
          {uploadError && (
            <div className="sp-alert-error">
              <span className="material-symbols-outlined sp-alert-icon">error</span>
              <span className="sp-alert-error-body">{uploadError}</span>
              <button className="sp-alert-close" onClick={() => setUploadError(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          )}
          <div className="sp-media-grid sp-media-grid-modal">
            {media.map(m => renderMediaCell(m))}
            {canAddMore && renderAddMediaTile()}
          </div>
        </div>
      </div>
    )}
    </>
  )
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 2c-2.72 0-3.06.01-4.12.06-1.06.05-1.79.22-2.43.47-.66.26-1.22.6-1.77 1.15a4.9 4.9 0 0 0-1.15 1.77c-.25.64-.42 1.37-.47 2.43C2.01 8.94 2 9.28 2 12s.01 3.06.06 4.12c.05 1.06.22 1.79.47 2.43.26.66.6 1.22 1.15 1.77.55.55 1.11.89 1.77 1.15.64.25 1.37.42 2.43.47C8.94 21.99 9.28 22 12 22s3.06-.01 4.12-.06c1.06-.05 1.79-.22 2.43-.47.66-.26 1.22-.6 1.77-1.15.55-.55.89-1.11 1.15-1.77.25-.64.42-1.37.47-2.43.05-1.06.06-1.4.06-4.12s-.01-3.06-.06-4.12c-.05-1.06-.22-1.79-.47-2.43a4.9 4.9 0 0 0-1.15-1.77 4.9 4.9 0 0 0-1.77-1.15c-.64-.25-1.37-.42-2.43-.47C15.06 2.01 14.72 2 12 2Zm0 1.8c2.67 0 2.99.01 4.04.06.98.05 1.51.21 1.86.35.47.18.8.4 1.15.75.35.35.57.68.75 1.15.14.35.3.88.35 1.86.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.05.98-.21 1.51-.35 1.86-.18.47-.4.8-.75 1.15-.35.35-.68.57-1.15.75-.35.14-.88.3-1.86.35-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-.98-.05-1.51-.21-1.86-.35a3.1 3.1 0 0 1-1.15-.75 3.1 3.1 0 0 1-.75-1.15c-.14-.35-.3-.88-.35-1.86C3.81 14.99 3.8 14.67 3.8 12s.01-2.99.06-4.04c.05-.98.21-1.51.35-1.86.18-.47.4-.8.75-1.15.35-.35.68-.57 1.15-.75.35-.14.88-.3 1.86-.35C9.01 3.81 9.33 3.8 12 3.8Zm0 3.06a5.14 5.14 0 1 0 0 10.28 5.14 5.14 0 0 0 0-10.28Zm0 8.48a3.34 3.34 0 1 1 0-6.68 3.34 3.34 0 0 1 0 6.68Zm6.54-8.68a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z" />
    </svg>
  )
}

function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.83c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.9h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  )
}

function IconTikTok() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M16.6 2h-3.2v13.6a3.1 3.1 0 1 1-2.2-2.97V9.35a6.3 6.3 0 1 0 5.4 6.25c0-.14 0-.28-.01-.42V9.1a7.9 7.9 0 0 0 4.6 1.48V7.36a4.85 4.85 0 0 1-4.6-3.02c-.19-.68-.03-2.34 0-2.34Z" />
    </svg>
  )
}

// Not currently shown in SOCIAL_PLATFORMS (only Instagram/Facebook/TikTok are active for now).
// Kept here, commented, so these can be re-enabled quickly later.
/*
function IconPinterest() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12.017 0C5.396 0 0 5.396 0 12.017c0 5.068 3.153 9.394 7.601 11.108-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.15-2.911 1.015 0 1.505.762 1.505 1.674 0 1.021-.65 2.544-.984 3.95-.278 1.176.591 2.134 1.75 2.134 2.097 0 3.712-2.213 3.712-5.404 0-2.827-2.031-4.805-4.935-4.805-3.362 0-5.336 2.523-5.336 5.132 0 1.017.392 2.109.881 2.703a.35.35 0 0 1 .081.336c-.089.372-.287 1.171-.325 1.334-.051.213-.171.259-.394.156-1.469-.684-2.386-2.83-2.386-4.554 0-3.709 2.695-7.116 7.774-7.116 4.083 0 7.253 2.909 7.253 6.795 0 4.055-2.556 7.313-6.107 7.313-1.192 0-2.313-.619-2.696-1.35 0 0-.591 2.25-.734 2.803-.267 1.026-.988 2.311-1.47 3.096 1.106.343 2.28.526 3.499.526 6.621 0 12.017-5.396 12.017-12.017C24.034 5.396 18.638 0 12.017 0Z" />
    </svg>
  )
}

function IconYoutube() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="currentColor" d="M23.499 6.203a3.008 3.008 0 0 0-2.089-2.089C19.541 3.613 12 3.613 12 3.613s-7.541 0-9.41.501A3.008 3.008 0 0 0 .501 6.203C0 8.093 0 12.034 0 12.034s0 3.94.501 5.831a3.007 3.007 0 0 0 2.089 2.088c1.869.502 9.41.502 9.41.502s7.541 0 9.41-.502a3.007 3.007 0 0 0 2.089-2.088c.501-1.89.501-5.831.501-5.831s0-3.941-.501-5.831Z" />
      <path fill="var(--white, #fff)" d="M9.545 15.568V8.436l6.257 3.566z" />
    </svg>
  )
}

function IconLinkedin() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.119 20.452H3.554V9h3.565v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M18.9 2.5h3.1l-6.77 7.74L23.3 21.5h-6.63l-5.19-6.79-5.94 6.79H2.44l7.24-8.27L2.7 2.5h6.8l4.69 6.2 5.71-6.2Zm-1.09 17.1h1.72L7.28 4.3H5.44l12.37 15.3Z" />
    </svg>
  )
}
*/
