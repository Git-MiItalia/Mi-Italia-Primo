import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../../lib/api'

const API    = import.meta.env.VITE_API_URL
const ANGLES = ['front', 'back', 'side']

// Recompute { uploaded, total, ready } from a try_on_images object.
// Server returns completeness on the initial fetch but not on upload/delete
// responses — this keeps local state consistent without an extra refetch.
function calcCompleteness(imgs) {
  const uploaded = ANGLES.filter(a => imgs?.[a]).length
  return { uploaded, total: 3, ready: uploaded === 3 }
}

/**
 * Manages virtual try-on reference photos for a single product's variants.
 *
 * Data model: each variant has three angle slots (front / back / side).
 * Backend endpoints:
 *   GET    /boutique/try-on/products                                 — list all products with try-on state
 *   POST   /boutique/products/:pid/variants/:vid/try-on/:angle       — upload one angle (form-data, key "testfile")
 *   DELETE /boutique/products/:pid/variants/:vid/try-on/:angle       — remove one angle
 *
 * NOTE on the upload field key: Postman spec shows the file under `testfile`.
 * If backend switches to `image` / `file` / etc., change the fd.append line below.
 */
export default function VirtualTryOn({ productId }) {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState(null)   // `${variantId}-${angle}` while uploading/deleting
  const [error, setError]     = useState('')
  const fileInputRefs         = useRef({})

  useEffect(() => {
    if (!productId) return
    loadTryOnData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  function loadTryOnData() {
    setLoading(true)
    apiFetch(`${API}/boutique/try-on/products`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const found = (res.data?.products ?? []).find(p => p.id === productId)
          setProduct(found ?? null)
        }
      })
      .catch(err => {
        console.error('[VirtualTryOn] fetch failed:', err)
        setError('Unable to load try-on photos.')
      })
      .finally(() => setLoading(false))
  }

  async function handleUpload(variantId, angle, file) {
    if (!file) return
    const key = `${variantId}-${angle}`
    setBusyKey(key)
    setError('')
    try {
      const fd = new FormData()
      fd.append('testfile', file)
      const res = await apiFetch(
        `${API}/boutique/products/${productId}/variants/${variantId}/try-on/${angle}`,
        { method: 'POST', body: fd }
      )
      const data = await res.json()
      if (data.success) {
        setProduct(prev => ({
          ...prev,
          variants: prev.variants.map(v =>
            v.id === variantId
              ? {
                  ...v,
                  try_on_images: data.data.try_on_images,
                  completeness:  calcCompleteness(data.data.try_on_images),
                }
              : v
          )
        }))
      } else {
        setError(data.message || 'Upload failed.')
      }
    } catch (err) {
      console.error('[VirtualTryOn] upload failed:', err)
      setError('Network error during upload.')
    } finally {
      setBusyKey(null)
    }
  }

  async function handleDelete(variantId, angle) {
    if (!window.confirm(`Remove ${angle} photo?`)) return
    const key = `${variantId}-${angle}`
    setBusyKey(key)
    setError('')
    try {
      const res = await apiFetch(
        `${API}/boutique/products/${productId}/variants/${variantId}/try-on/${angle}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (data.success) {
        setProduct(prev => ({
          ...prev,
          variants: prev.variants.map(v => {
            if (v.id !== variantId) return v
            const nextImgs = { ...v.try_on_images, [angle]: null }
            return {
              ...v,
              try_on_images: nextImgs,
              completeness:  calcCompleteness(nextImgs),
            }
          })
        }))
      } else {
        setError(data.message || 'Remove failed.')
      }
    } catch (err) {
      console.error('[VirtualTryOn] delete failed:', err)
      setError('Network error.')
    } finally {
      setBusyKey(null)
    }
  }

  function pickFile(variantId, angle) {
    fileInputRefs.current[`${variantId}-${angle}`]?.click()
  }

  // ── Render ──

  if (!productId) {
    return (
      <div style={{ padding: '20px 0', color: 'var(--stone)', fontSize: 12, textAlign: 'center' }}>
        Save this product first, then add virtual try-on photos here.
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: '20px 0', color: 'var(--stone)', fontSize: 12 }}>Loading try-on data…</div>
  }

  if (!product) {
    return <div style={{ padding: '20px 0', color: 'var(--stone)', fontSize: 12 }}>No variants available for try-on.</div>
  }

  return (
    <div>
      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(197,0,26,0.08)',
          color: 'var(--red)',
          borderRadius: 0,
          marginBottom: 14,
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
          {error}
        </div>
      )}

      {product.variants.map((v, i) => {
        const c        = v.completeness ?? calcCompleteness(v.try_on_images)
        const label    = [v.size_label, v.colour].filter(Boolean).join(' · ') || 'Variant'
        const isLast   = i === product.variants.length - 1
        return (
          <div
            key={v.id}
            style={{
              marginBottom: isLast ? 0 : 18,
              paddingBottom: isLast ? 0 : 18,
              borderBottom: isLast ? 'none' : '1px solid var(--mist)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
              <div style={{
                fontSize: 11,
                color: c.ready ? 'var(--green)' : 'var(--stone)',
                fontWeight: 600,
              }}>
                {c.ready ? '✓ All angles ready' : `${c.uploaded} of ${c.total} uploaded`}
              </div>
            </div>

            <div className="ap-tryon-angles">
              {ANGLES.map(angle => {
                const key  = `${v.id}-${angle}`
                const url  = v.try_on_images?.[angle]
                const busy = busyKey === key

                return (
                  <div key={angle} className="ap-tryon-angle">
                    {url ? (
                      <>
                        <div className="ap-tryon-angle-img" style={{ backgroundImage: `url('${url}')` }} />
                        <div className="ap-tryon-angle-label" style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}>
                          <span style={{ textTransform: 'capitalize' }}>{angle} ✓</span>
                          <button
                            onClick={() => handleDelete(v.id, angle)}
                            disabled={busy}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--red)',
                              cursor: busy ? 'wait' : 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title={`Remove ${angle} photo`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                              {busy ? 'hourglass_top' : 'delete'}
                            </span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className="ap-tryon-angle-img"
                          style={{
                            background: 'var(--cream)',
                            border: '1.5px dashed var(--mist)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: 6,
                            cursor: busy ? 'wait' : 'pointer',
                          }}
                          onClick={() => !busy && pickFile(v.id, angle)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--gold)' }}>
                            {busy ? 'hourglass_top' : 'add_photo_alternate'}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--stone)' }}>
                            {busy ? 'Uploading…' : 'Upload'}
                          </span>
                        </div>
                        <div className="ap-tryon-angle-label" style={{ textTransform: 'capitalize' }}>
                          {angle}
                        </div>
                      </>
                    )}

                    <input
                      ref={el => { fileInputRefs.current[key] = el }}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(v.id, angle, file)
                        e.target.value = ''  // reset so re-selecting the same file re-fires onChange
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
