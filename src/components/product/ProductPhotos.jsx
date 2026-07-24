import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Toast, { useToast } from '../ui/Toast'
import { apiFetch } from '../../lib/api'

const API = import.meta.env.VITE_API_URL
const MAX_PHOTOS         = Number(import.meta.env.VITE_MAX_PHOTOS         ?? 10)
const MAX_PHOTO_SIZE_MB  = Number(import.meta.env.VITE_MAX_PHOTO_SIZE_MB  ?? 10)

export default function ProductPhotos({ productId, initialPhotos = [], onNeedPublish, refreshKey, onPhotosChange }) {
  const [photos, setPhotos]       = useState(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const fileInputRef              = useRef()
  const { toasts, show }          = useToast()
  const { t }                     = useTranslation()

  useEffect(() => {
    if (initialPhotos.length > 0) setPhotos(initialPhotos)
  }, [initialPhotos.length])

  const isFirstRefreshRef = useRef(true)
  useEffect(() => {
    if (isFirstRefreshRef.current) { isFirstRefreshRef.current = false; return }
    if (!productId) return
    apiFetch(`${API}/boutique/products/${productId}`)
      .then(r => r.json())
      .then(res => { if (res.success) setPhotos(res.data.photos ?? []) })
      .catch(() => {})
  }, [refreshKey])

  async function handleFileChange(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return

    // ── Validate: file size + count ─────────────────────────
    const oversized = files.filter(f => f.size > MAX_PHOTO_SIZE_MB * 1024 * 1024)
    if (oversized.length > 0) {
      show(`${oversized.length} file(s) over ${MAX_PHOTO_SIZE_MB}MB — skipped`)
    }

    const validFiles = files.filter(f => f.size <= MAX_PHOTO_SIZE_MB * 1024 * 1024)
    const slotsLeft  = Math.max(0, MAX_PHOTOS - photos.length)

    if (slotsLeft === 0) {
      show(`Max ${MAX_PHOTOS} photos reached. Remove one first.`)
      e.target.value = ''
      return
    }

    const toUpload = validFiles.slice(0, slotsLeft)
    if (validFiles.length > slotsLeft) {
      show(`Only ${slotsLeft} slot(s) left — ${validFiles.length - slotsLeft} skipped`)
    }

    if (toUpload.length === 0) {
      e.target.value = ''
      return
    }

    let activeId = productId
    if (!activeId) {
      if (!onNeedPublish) { show(t('photos.no_product')); return }
      show(t('photos.creating'), 'info')
      activeId = await onNeedPublish()
      if (!activeId) { show(t('photos.create_failed')); return }
    }

    setUploading(true)
    for (const file of toUpload) {
      const fd = new FormData()
      fd.append('File', file)
      try {
        const res = await apiFetch(`${API}/boutique/products/${activeId}/photos`, {
          method: 'POST',
          body: fd,
        }).then(r => r.json())

        if (res.success) {
          setPhotos(prev => [...prev, ...res.data.photos])
          show(t('photos.uploaded'), 'success')
          if (onPhotosChange) onPhotosChange()
        } else {
          show(res.message ?? t('photos.upload_failed'))
        }
      } catch {
        show(t('photos.upload_error'))
      }
    }
    setUploading(false)
    e.target.value = ''
  }

  async function deletePhoto(photoId) {
    if (!productId) return
    try {
      const res = await apiFetch(`${API}/boutique/products/${productId}/photos/${photoId}`, {
        method: 'DELETE',
      }).then(r => r.json())

      if (res.success) {
        setPhotos(prev => prev.filter(p => p.id !== photoId))
        show(t('photos.deleted'), 'success')
        if (onPhotosChange) onPhotosChange()
      } else {
        show(res.message ?? t('photos.delete_failed'))
      }
    } catch {
      show(t('photos.delete_error'))
    }
  }

  async function setMainPhoto(photoId) {
    if (!productId) return
    try {
      const res = await apiFetch(`${API}/boutique/products/${productId}/photos/${photoId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_main: true }),
      }).then(r => r.json())

      if (res.success) {
        setPhotos(prev => prev.map(p => ({ ...p, is_main: p.id === photoId })))
        show(t('photos.main_updated'), 'success')
      } else {
        show(res.message ?? t('photos.update_failed'))
      }
    } catch {
      show(t('photos.update_error'))
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">Product <em>Photos</em></div>
          <div className="pp-hdr-actions">
            {uploading && <span className="pp-uploading">{t('photos.uploading')}</span>}
            <button className="btn btn-sm btn-outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <span className="material-symbols-outlined">add_photo_alternate</span>
              {t('photos.add_btn')}
            </button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="pp-hidden-input" onChange={handleFileChange} />

        {photos.length > 0 && (
          <div className="photo-grid pp-grid-mb">
            {photos.map(photo => (
              <div key={photo.id} className="photo-item">
                <div className="photo-bg" style={{ backgroundImage:`url('${photo.url}')` }} />
                {photo.is_main && <div className="photo-item-main">{t('photos.main_label')}</div>}
                <div className="photo-item-actions">
                  {!photo.is_main && (
                    <div className="photo-item-btn pp-star-btn" title={t('photos.set_main')} onClick={() => setMainPhoto(photo.id)}>
                      <span className="material-symbols-outlined">star</span>
                    </div>
                  )}
                  <div className="photo-item-btn" title={t('photos.delete_photo')} onClick={() => deletePhoto(photo.id)}>
                    <span className="material-symbols-outlined">close</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="photo-add" onClick={() => fileInputRef.current?.click()}>
              <span className="material-symbols-outlined">add_photo_alternate</span>
              <div className="photo-add-lbl">{t('photos.add_btn')}</div>
            </div>
          </div>
        )}

        {photos.length === 0 && (
          <div className="photo-add pp-empty" onClick={() => fileInputRef.current?.click()}>
            <span className="material-symbols-outlined">add_photo_alternate</span>
            <div className="photo-add-lbl">{t('photos.click_to_upload')}</div>
          </div>
        )}

        <div className="form-hint">{t('photos.hint')}</div>
      </div>

      <Toast toasts={toasts} />
    </>
  )
}
