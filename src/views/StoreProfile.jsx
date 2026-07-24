import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../lib/api'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

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
const DAY_LABELS = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' }

function defaultHours() {
  return Object.fromEntries(DAYS.map(d => [d, { open:'10:00', close:'19:00' }]))
}

export default function StoreProfile() {
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
  const mediaFileRef = useRef()

  const [terminal, setTerminal]       = useState('none')
  const [posPayment, setPosPayment]   = useState('external')
  const [website, setWebsite]         = useState('none')
  const [websiteUrl, setWebsiteUrl]   = useState('')
  const [posSystem, setPosSystem]     = useState('primo')
  const [techSaving, setTechSaving]   = useState(false)
  const [techSaved, setTechSaved]     = useState(false)

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
        founder_card_enabled: founderCardEnabled, founder_name: founderName, founder_title: founderTitle,
        opening_hours_json: hours_json,
      }),
    }).then(r => r.json()).then(res => {
      setSaving(false)
      if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
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
      setCoverError('Please select an image file.')
      return
    }
    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      setCoverError(`File is over ${MAX_PHOTO_SIZE_MB}MB.`)
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
          setCoverError(res?.message || 'Upload failed')
        }
      })
      .catch(() => setCoverError('Upload failed — check your connection'))
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
    if (invalid.length > 0) errors.push(`${invalid.length} file(s) rejected (unsupported format)`)

    const oversizedImages = images.filter(f => f.size > MAX_PHOTO_SIZE_MB * 1024 * 1024)
    const oversizedVideos = videos.filter(f => f.size > MAX_VIDEO_SIZE_MB * 1024 * 1024)
    if (oversizedImages.length > 0) errors.push(`${oversizedImages.length} photo(s) over ${MAX_PHOTO_SIZE_MB}MB`)
    if (oversizedVideos.length > 0) errors.push(`${oversizedVideos.length} video(s) over ${MAX_VIDEO_SIZE_MB}MB`)

    const validImages = images.filter(f => f.size <= MAX_PHOTO_SIZE_MB * 1024 * 1024)
    const validVideos = videos.filter(f => f.size <= MAX_VIDEO_SIZE_MB * 1024 * 1024)

    const currentPhotos = media.filter(m => m.media_type === 'image').length
    const currentVideos = media.filter(m => m.media_type === 'video').length
    const photoSlots = Math.max(0, MAX_PHOTOS - currentPhotos)
    const videoSlots = Math.max(0, MAX_VIDEOS - currentVideos)

    const finalImages = validImages.slice(0, photoSlots)
    const finalVideos = validVideos.slice(0, videoSlots)
    if (validImages.length > finalImages.length) errors.push(`${validImages.length - finalImages.length} photo(s) skipped (max ${MAX_PHOTOS})`)
    if (validVideos.length > finalVideos.length) errors.push(`${validVideos.length - finalVideos.length} video(s) skipped (max ${MAX_VIDEOS})`)

    const combined = [...finalImages, ...finalVideos]
    if (combined.length > MAX_UPLOAD_COUNT) errors.push(`Only ${MAX_UPLOAD_COUNT} files per upload`)
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
          setUploadError(res?.message || 'Upload failed')
        }
      })
      .catch(() => setUploadError('Upload failed — check your connection'))
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
          setUploadError(res?.message || 'Delete failed')
        }
      })
      .catch(() => {
        setMedia(backup)
        setUploadError('Delete failed — check your connection')
      })
  }

  function updateHour(day, field, value) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  const photoCount = media.filter(m => m.media_type === 'image').length
  const videoCount = media.filter(m => m.media_type === 'video').length
  const canAddMore = photoCount < MAX_PHOTOS || videoCount < MAX_VIDEOS

  if (loading) return (
    <div className="sp-page-loading">
      <span className="material-symbols-outlined">hourglass_empty</span>
      <div className="sp-page-loading-text">Loading profile…</div>
    </div>
  )

  return (
    <div className="grid2">

      {/* ══ LEFT COLUMN ══ */}
      <div>

        {/* Store Details */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">Store <em>Details</em></div>
            <button className="btn btn-sm btn-primary" onClick={saveProfile} disabled={saving}>
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
          <div className="form-group">
            <label className="form-lbl">Store Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">Address</label>
              <input className="form-input" value={address} onChange={e => setAddress(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-lbl">City</label>
              <input className="form-input" value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>
          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">Postcode</label>
              <input className="form-input" value={postcode} onChange={e => setPostcode(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-lbl">Email</label>
              <input className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">Phone</label>
              <PhoneInput
                international
                defaultCountry={country || 'IT'}
                value={phone}
                onChange={v => setPhone(v || '')}
                className="sp-phone-input"
              />
              {phone && !isValidPhoneNumber(phone) && (
                <div className="form-hint sp-phone-hint-invalid">
                  Not a valid phone number
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-lbl">WhatsApp</label>
              <PhoneInput
                international
                defaultCountry={country || 'IT'}
                value={whatsapp}
                onChange={v => setWhatsapp(v || '')}
                className="sp-phone-input"
              />
              {whatsapp && !isValidPhoneNumber(whatsapp) && (
                <div className="form-hint sp-phone-hint-invalid">
                  Not a valid phone number
                </div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="form-lbl">Store Bio</label>
            <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-lbl">Opening Hours</label>
            <div className="sp-hours-list">
              {DAYS.map(day => (
                <div key={day} className="sp-hours-row">
                  <span className="sp-hours-day">{DAY_LABELS[day]}</span>
                  <input className="form-input sp-hours-input" value={hours[day]?.open ?? ''} onChange={e => updateHour(day, 'open', e.target.value)} placeholder="10:00" />
                  <span className="sp-hours-sep">–</span>
                  <input className="form-input sp-hours-input" value={hours[day]?.close ?? ''} onChange={e => updateHour(day, 'close', e.target.value)} placeholder="19:00 or Closed" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Founder Card */}
        <div className="card">
          <div className="card-hdr"><div className="card-title">Founder <em>Card</em></div></div>

          <div className="sp-founder-toggle-row">
            <div>
              <div className="sp-founder-toggle-title">Show founder card on boutique page</div>
              <div className="sp-founder-toggle-sub">Displays founder photo and name on your Mi Italia listing</div>
            </div>
            <div className={`toggle${founderCardEnabled ? ' on' : ''}`} onClick={() => setFounderCardEnabled(v => !v)}>
              <div className="toggle-knob" />
            </div>
          </div>

          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">Founder Name</label>
              <input className="form-input" value={founderName} onChange={e => setFounderName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-lbl">Founder Title</label>
              <input className="form-input" value={founderTitle} onChange={e => setFounderTitle(e.target.value)} />
            </div>
          </div>

          <input ref={founderPhotoRef} type="file" accept="image/*" className="sp-file-hidden"
            onChange={e => { if (e.target.files[0]) uploadFounderPhoto(e.target.files[0]) }} />

          {founderPhotoUrl ? (
            <div className="sp-founder-preview">
              <div className="sp-founder-photo" style={{ backgroundImage:`url('${founderPhotoUrl}')` }} />
              <div className="sp-founder-preview-body">
                <div className="sp-founder-preview-title">Founder photo uploaded</div>
                <button className="btn btn-sm btn-outline" onClick={() => founderPhotoRef.current.click()}>Replace</button>
              </div>
            </div>
          ) : (
            <div className="upload-zone sp-clickable" onClick={() => founderPhotoRef.current.click()}>
              <span className="material-symbols-outlined">person</span>
              <div className="upload-zone-title">Upload Founder Photo</div>
              <div className="upload-zone-sub">Min 400×400px · Square crop recommended</div>
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT COLUMN ══ */}
      <div>

        {/* Store Photography — cover photo + gallery */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">Store <em>Photography</em></div>
          </div>

          {/* Cover Photo — single hero image */}
          <div className="sp-photo-section">
            <div className="sp-photo-section-lbl">Cover Photo</div>

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
                  {coverUploading ? 'Uploading…' : 'Replace'}
                </button>
              </div>
            ) : (
              <div
                className={`upload-zone sp-clickable${coverUploading ? ' is-loading' : ''}`}
                onClick={() => !coverUploading && coverPhotoRef.current.click()}
              >
                <span className="material-symbols-outlined">{coverUploading ? 'hourglass_top' : 'add_photo_alternate'}</span>
                <div className="upload-zone-title">{coverUploading ? 'Uploading…' : 'Upload Cover Photo'}</div>
                <div className="upload-zone-sub">1200×400px recommended · Used as hero on boutique page</div>
              </div>
            )}
          </div>

          {/* Gallery — photos + videos */}
          <div>
            <div className="sp-gallery-hdr">
              <div className="sp-photo-section-lbl">Gallery</div>
              <div className="sp-gallery-count">
                {photoCount}/{MAX_PHOTOS} photos · {videoCount}/{MAX_VIDEOS} videos
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
              <div className="sp-media-loading">Loading media…</div>
            ) : (
              <div className="sp-media-grid">
                {media.map(m => {
                  const fullUrl = `${IMG_BASE}${m.url}`
                  return (
                    <div key={m.id} className="sp-media-cell">
                      {m.media_type === 'video' ? (
                        <video
                          src={fullUrl}
                          preload="metadata"
                          muted
                          playsInline
                          className="sp-media-video"
                        />
                      ) : (
                        <div className="sp-media-img" style={{ backgroundImage:`url('${fullUrl}')` }} />
                      )}

                      {m.media_type === 'video' && (
                        <div className="sp-media-video-badge">
                          <span className="material-symbols-outlined">play_arrow</span>
                          <span className="sp-media-video-badge-text">VIDEO</span>
                        </div>
                      )}

                      <button
                        className="sp-media-delete-btn"
                        onClick={() => deleteMedia(m.id)}
                        title="Remove"
                      >
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  )
                })}

                {canAddMore && (
                  <div
                    className={`sp-media-add${uploading ? ' is-loading' : ''}`}
                    onClick={() => !uploading && mediaFileRef.current.click()}
                  >
                    <div className="sp-media-add-inner">
                      {uploading ? (
                        <>
                          <span className="material-symbols-outlined">hourglass_top</span>
                          <div className="sp-media-add-lbl">Uploading…</div>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">add_photo_alternate</span>
                          <div className="sp-media-add-lbl">Add media</div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="sp-media-hint">
              Photos up to {MAX_PHOTO_SIZE_MB}MB · Videos up to {MAX_VIDEO_SIZE_MB}MB · Max {MAX_UPLOAD_COUNT} files per upload
              {!canAddMore && (
                <span className="sp-media-hint-warn">· Gallery full — remove media to add more</span>
              )}
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="card">
          <div className="card-hdr"><div className="card-title">Categories</div></div>
          <div className="sp-cat-chips">
            {['Menswear','Military Heritage','Outerwear'].map(c => (
              <div key={c} className="sp-cat-chip">{c}</div>
            ))}
            <div className="sp-cat-chip sp-cat-chip-add">+ Add Category</div>
          </div>
        </div>

        {/* Language & Region */}
        <div className="card">
          <div className="card-hdr"><div className="card-title">Language &amp; <em>Region</em></div></div>
          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">Primary Language</label>
              <select className="form-select"><option>Italian</option><option>English</option></select>
            </div>
            <div className="form-group">
              <label className="form-lbl">Currency</label>
              <select className="form-select"><option>EUR €</option></select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-lbl">Active Languages</label>
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
              <div className="card-title">Tech <em>Stack</em></div>
              <div className="sp-tech-sub">Helps us connect Primo to your existing tools</div>
            </div>
            <button className="btn btn-sm btn-primary" onClick={saveTechStack} disabled={techSaving}>
              {techSaved ? '✓ Saved' : techSaving ? 'Saving…' : 'Save'}
            </button>
          </div>

          <div className="sp-tech-section">
            <span className="material-symbols-outlined">credit_card</span>In-Store Payment Terminal
          </div>
          <div className="form-group">
            <label className="form-lbl">How do you take card payments in-store?</label>
            <select className="form-select" value={terminal} onChange={e => setTerminal(e.target.value)}>
              <option value="stripe">Stripe Terminal (Mi Italia integrated)</option>
              <option value="sumup">SumUp</option>
              <option value="square">Square</option>
              <option value="verifone">Verifone</option>
              <option value="bank">Bank-issued terminal</option>
              <option value="other">Other external terminal</option>
              <option value="none">No card payments in-store</option>
            </select>
          </div>
          {terminal === 'stripe'
            ? <div className="alert alert-info"><span className="material-symbols-outlined">check_circle</span>Stripe Terminal is fully integrated with Primo POS. Card payments are processed directly and commission is auto-deducted per sale.</div>
            : terminal !== 'none' && <div className="alert alert-warn"><span className="material-symbols-outlined">info</span>External terminals work seamlessly with Primo. Primo tracks the sale and calculates commission. You'll receive a monthly invoice for POS commission rather than per-transaction deduction.</div>
          }

          <div className="sp-divider" />

          <div className="form-group">
            <label className="form-lbl">Default POS Payment Method</label>
            <select className="form-select" value={posPayment} onChange={e => setPosPayment(e.target.value)}>
              <option value="external_terminal">External Terminal (show external panel first)</option>
              <option value="stripe">Stripe Terminal</option>
              <option value="cash">Cash</option>
            </select>
            <div className="form-hint">This pre-selects the payment tab when you open POS. You can always switch during a sale.</div>
          </div>

          <div className="sp-divider" />

          <div className="sp-tech-section">
            <span className="material-symbols-outlined">language</span>Your Website
          </div>
          <div className="form-group">
            <label className="form-lbl">Do you have your own website?</label>
            <select className="form-select" value={website} onChange={e => setWebsite(e.target.value)}>
              <option value="none">No — Mi Italia is my only online presence</option>
              <option value="shopify">Yes — Shopify</option>
              <option value="woocommerce">Yes — WooCommerce</option>
              <option value="lightspeed">Yes — Lightspeed eCom</option>
              <option value="custom">Yes — Custom / other platform</option>
            </select>
          </div>
          {website !== 'none' && (
            <div className="form-group">
              <label className="form-lbl">Website URL</label>
              <input className="form-input" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://yourstore.com" />
            </div>
          )}
          {website === 'shopify' && (
            <div className="sp-integration-box sp-integration-shopify">
              <div className="sp-integration-hdr">
                <span className="material-symbols-outlined">store</span>
                <div className="sp-integration-title">Shopify Integration — Coming Soon</div>
              </div>
              <div className="sp-integration-body">When the Mi Italia Shopify app launches, your products, stock levels, and orders will sync automatically between Shopify and Primo.</div>
              <button className="btn btn-sm btn-outline sp-integration-btn"><span className="material-symbols-outlined">notifications</span>Notify Me When Available</button>
            </div>
          )}
          {website === 'woocommerce' && (
            <div className="sp-integration-box sp-integration-woo">
              <div className="sp-integration-hdr">
                <span className="material-symbols-outlined">store</span>
                <div className="sp-integration-title">WooCommerce Integration — Coming Soon</div>
              </div>
              <div className="sp-integration-body">A Mi Italia WooCommerce plugin will allow automatic product and inventory sync between your WordPress store and Primo.</div>
              <button className="btn btn-sm btn-outline sp-integration-btn"><span className="material-symbols-outlined">notifications</span>Notify Me When Available</button>
            </div>
          )}
          {website === 'none' && (
            <div className="alert alert-info"><span className="material-symbols-outlined">info</span>Mi Italia + Primo is your complete online retail presence. Your boutique page on Mi Italia serves as your public storefront.</div>
          )}

          <div className="sp-divider" />

          <div className="sp-tech-section">
            <span className="material-symbols-outlined">point_of_sale</span>Existing POS System
          </div>
          <div className="form-group sp-form-group-tight">
            <label className="form-lbl">Do you use a dedicated POS system?</label>
            <select className="form-select" value={posSystem} onChange={e => setPosSystem(e.target.value)}>
              <option value="primo">No — Primo POS is my only system</option>
              <option value="lightspeed">Lightspeed Retail</option>
              <option value="square-pos">Square POS</option>
              <option value="shopify-pos">Shopify POS</option>
              <option value="revel">Revel Systems</option>
              <option value="other-pos">Other POS system</option>
            </select>
          </div>
          {posSystem !== 'primo' && (
            <div className="alert alert-warn sp-alert-tight">
              <span className="material-symbols-outlined">info</span>Running two POS systems is fine. Use Primo POS for Mi Italia app customers and reservations. Use your existing POS for all other in-store transactions.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
