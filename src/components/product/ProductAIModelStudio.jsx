import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from '../../lib/api'

const API = import.meta.env.VITE_API_URL

// Preset prompt chips (dead UI — Custom Text Prompt tab is placeholder only)
const PROMPT_CHIPS = [
  'Studio white background',
  'Milan street, golden hour',
  'Boutique interior, warm light',
  'Italian countryside',
  'Relaxed pose',
  'Athletic build',
  'Slim fit build',
  'Plus size',
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function AIModelStudio({ productId, refreshKey, onPhotosChange }) {
  // UI state
  const [aiStudioOn,      setAiStudioOn]      = useState(true)
  const [studioTab,       setStudioTab]       = useState('mi')       // 'mi' | 'prompt'
  const [selectedModelId, setSelectedModelId] = useState(null)
  const [customPrompt,    setCustomPrompt]    = useState('')

  // Data state
  const [stockModels,     setStockModels]     = useState([])
  const [productPhotos,   setProductPhotos]   = useState([])
  const [loading,         setLoading]         = useState(false)

  // Source-selection state
  const [selectedSourceId, setSelectedSourceId] = useState(null)     // ID of chosen product photo
  const [showSourceModal,  setShowSourceModal]  = useState(false)
  const [showAllModelsModal, setShowAllModelsModal] = useState(false)

  // Generation state — SINGLE result per generation now
  const [generating,   setGenerating]   = useState(false)
  const [progress,     setProgress]     = useState('')
  const [generatedUrl, setGeneratedUrl] = useState(null)
  const [saved,        setSaved]        = useState(false)

  // Save state
  const [saving,       setSaving]       = useState(false)

  // Inline banners
  const [error,        setError]        = useState('')
  const [saveMessage,  setSaveMessage]  = useState('')

  // ── Fetch stock models on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    apiFetch(`${API}/boutique/try-on/stock-models`)
      .then(r => r.json())
      .then(res => {
        if (cancelled) return
        if (res.success) setStockModels(res.data || [])
      })
      .catch(err => {
        if (cancelled) return
        console.error('[AIModelStudio] stock-models fetch failed:', err)
      })
    return () => { cancelled = true }
  }, [])

  // ── Fetch product photos when productId available ───────────────────────────
  useEffect(() => {
    if (!productId) return
    let cancelled = false
    setLoading(true)
    apiFetch(`${API}/boutique/products/${productId}`)
      .then(r => r.json())
      .then(res => {
        if (cancelled) return
        if (res.success) setProductPhotos(res.data?.photos || [])
      })
      .catch(err => {
        if (cancelled) return
        console.error('[AIModelStudio] product fetch failed:', err)
        setError('Could not load product photos.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId, refreshKey])

  // ── Auto-select first product photo as source ───────────────────────────────
  useEffect(() => {
    if (productPhotos.length > 0 && !selectedSourceId) {
      setSelectedSourceId(productPhotos[0].id)
    }
  }, [productPhotos, selectedSourceId])

  // ── Derived data ────────────────────────────────────────────────────────────
  const selectedModel = useMemo(() =>
    stockModels.find(m => m.id === selectedModelId) || null
  , [stockModels, selectedModelId])

  const rowModels = useMemo(() => {
    if (!selectedModelId) return stockModels.slice(0, 8)
    const chosen = stockModels.find(m => m.id === selectedModelId)
    if (!chosen) return stockModels.slice(0, 8)
    const rest = stockModels.filter(m => m.id !== selectedModelId)
    return [chosen, ...rest].slice(0, 8)
  }, [stockModels, selectedModelId])

  const selectedSourcePhoto = useMemo(() =>
    productPhotos.find(p => p.id === selectedSourceId) || null
  , [productPhotos, selectedSourceId])

  const selectedSourceIndex = useMemo(() =>
    productPhotos.findIndex(p => p.id === selectedSourceId)
  , [productPhotos, selectedSourceId])

  // ── Poll a single prediction until completed / failed / timeout ────────────
  async function pollStatus(predictionId) {
    const MAX_ATTEMPTS = 60
    const INTERVAL_MS  = 3000
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, INTERVAL_MS))
      const res  = await apiFetch(`${API}/boutique/ai-studio/status/${predictionId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Status check failed')
      const { status, outputs, error: statusErr } = data.data
      setProgress(`${status}…`)
      if (status === 'completed') return outputs?.[0] || null
      if (status === 'failed' || statusErr) throw new Error(statusErr || 'Generation failed')
    }
    throw new Error('Generation timed out after 3 minutes')
  }

  // ── Submit + poll for the single selected source photo ─────────────────────
  async function runGeneration() {
    setError('')
    setSaveMessage('')

    // Validate — inline errors instead of toast
    if (!selectedSourcePhoto) { setError('Please select a source photo.'); return }
    if (!selectedModel)       { setError('Please select a model first.'); return }

    setGeneratedUrl(null)
    setSaved(false)
    setGenerating(true)
    setProgress('Submitting…')

    try {
      const submitRes  = await apiFetch(`${API}/boutique/ai-studio/run`, {
        method: 'POST',
        body:   JSON.stringify({
          operation:    'try-on',
          modelImage:   selectedModel.image_url,
          garmentImage: selectedSourcePhoto.url,
          category:     'auto',
          mode:         'balanced',
        }),
      })
      const submitData = await submitRes.json()
      if (!submitData.success) throw new Error(submitData.message || 'Submit failed')

      const outputUrl = await pollStatus(submitData.data.predictionId)
      if (outputUrl) setGeneratedUrl(outputUrl)
    } catch (err) {
      console.error('[AIModelStudio] generation failed:', err)
      setError(err.message || 'Generation failed — please try again.')
    } finally {
      setGenerating(false)
      setProgress('')
    }
  }

  function regenerate() {
    setGeneratedUrl(null)
    setSaved(false)
    setSaveMessage('')
    setTimeout(() => runGeneration(), 0)
  }

  // ── Save the single generated photo to gallery ─────────────────────────────
  async function saveToGallery() {
    if (!generatedUrl || !productId || saved) return
    setSaving(true)
    setError('')
    try {
      const res  = await apiFetch(`${API}/boutique/products/${productId}/photos/from-ai-studio`, {
        method: 'POST',
        body:   JSON.stringify({ imageUrls: [generatedUrl] }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Save failed')

      setSaved(true)
      setSaveMessage(data.message || 'Photo added to gallery')
      if (onPhotosChange) onPhotosChange()
    } catch (err) {
      console.error('[AIModelStudio] save-to-gallery failed:', err)
      setError(err.message || 'Save failed — please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="card">
      <div className="card-hdr">
        <div>
          <div className="card-title">AI Model <em>Studio</em></div>
          <div className="ap-card-sub">
            Generate on-model photos from your product photos · No photoshoot needed
          </div>
        </div>
        <div className="ap-ai-hdr-right">
          <span className="ap-ai-badge">POWERED BY AI</span>
          <div
            className={`toggle${aiStudioOn ? ' on' : ''}`}
            onClick={() => setAiStudioOn(v => !v)}
          >
            <div className="toggle-knob" />
          </div>
        </div>
      </div>

      {aiStudioOn && (
        <>
          {!productId && (
            <div className="ap-studio-empty">
              <span className="material-symbols-outlined">info</span>
              <div>Save the product first, then upload photos to enable AI Studio.</div>
            </div>
          )}

          {productId && loading && (
            <div className="ap-studio-empty">Loading…</div>
          )}

          {productId && !loading && productPhotos.length === 0 && (
            <div className="ap-studio-empty ap-studio-empty-warn">
              <span className="material-symbols-outlined">photo_camera</span>
              <div>
                <strong>Upload product photos first.</strong>
                <div className="ap-studio-empty-sub">
                  Add photos in the Product Photos card above, then return here to generate on-model images.
                </div>
              </div>
            </div>
          )}

          {productId && !loading && productPhotos.length > 0 && (
            <>
              {/* Source row — preview of the selected source photo + Change Source */}
              <div className="ap-source-row">
                <div
                  className="ap-source-img"
                  style={{ backgroundImage:`url('${selectedSourcePhoto?.url || ''}')` }}
                />
                <div className="ap-source-body">
                  <div className="ap-source-title">
                    Source: Photo {selectedSourceIndex >= 0 ? selectedSourceIndex + 1 : '—'}
                  </div>
                  <div className="ap-source-sub">
                    AI will place this garment on the selected model
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline ap-source-btn"
                  onClick={() => setShowSourceModal(true)}
                >
                  Change Source
                </button>
              </div>

              {/* Tab switcher — Mi Italia Models | Custom Text Prompt (dead UI) */}
              <div className="ap-studio-tabs">
                <div
                  className={`ai-studio-tab${studioTab === 'mi' ? ' act' : ''}`}
                  onClick={() => setStudioTab('mi')}
                >
                  Mi Italia Models
                </div>
                <div
                  className={`ai-studio-tab${studioTab === 'prompt' ? ' act' : ''}`}
                  onClick={() => setStudioTab('prompt')}
                >
                  Custom Text Prompt
                </div>
              </div>

              {/* Mi Italia Models tab */}
              {studioTab === 'mi' && (
                <>
                  <div className="ap-section-lbl">
                    Select a Model{stockModels.length > 0 ? ` — ${stockModels.length} Stock Models` : ''}
                  </div>
                  {stockModels.length === 0 ? (
                    <div className="ap-studio-empty">Loading models…</div>
                  ) : (
                    <>
                      <div className="ai-model-grid">
                        {rowModels.map(m => (
                          <div
                            key={m.id}
                            className={`ai-model-card${selectedModelId === m.id ? ' sel' : ''}`}
                            onClick={() => setSelectedModelId(m.id)}
                          >
                            <div className="ai-model-img" style={{ backgroundImage:`url('${m.image_url}')` }} />
                            <div className="ai-model-name">{m.label}</div>
                            <div className="ai-model-meta">{m.gender}</div>
                          </div>
                        ))}
                      </div>
                      {stockModels.length > 8 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline ap-see-all-models-btn"
                          onClick={() => setShowAllModelsModal(true)}
                        >
                          See all available Models
                        </button>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Custom Text Prompt tab — dead UI, will wire later */}
              {studioTab === 'prompt' && (
                <div>
                  <div className="ap-section-lbl">Describe Your Model &amp; Scene</div>
                  <div className="form-group">
                    <textarea
                      className="form-textarea ap-prompt-textarea"
                      placeholder="e.g. 35-year-old Italian man, athletic build, medium skin tone…"
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                    />
                    <div className="form-hint">
                      Be specific about age, ethnicity, build, pose, background, and lighting.
                    </div>
                  </div>
                  <div className="ap-chips">
                    {PROMPT_CHIPS.map(chip => (
                      <div
                        key={chip}
                        className="prompt-chip"
                        onClick={() => setCustomPrompt(p => p ? p + ', ' + chip : chip)}
                      >
                        {chip}
                      </div>
                    ))}
                  </div>
                  <div className="ap-prompt-note">
                    <span className="material-symbols-outlined">info</span>
                    Custom prompts are a preview — currently the generator uses Mi Italia Models only.
                  </div>
                </div>
              )}

              {/* Scene / Angle / Resolution — commented out for now, wire later */}
              {/*
              <div className="form-row3 ap-no-mb-row">
                <div className="form-group ap-no-mb">
                  <label className="form-lbl">Scene / Background</label>
                  <select className="form-select">
                    <option>Studio — White</option>
                    <option>Studio — Grey</option>
                    <option>Outdoor · Golden hour</option>
                  </select>
                </div>
                <div className="form-group ap-no-mb">
                  <label className="form-lbl">Angle</label>
                  <select className="form-select">
                    <option>Front</option>
                    <option>Three-quarter</option>
                    <option>Back</option>
                  </select>
                </div>
                <div className="form-group ap-no-mb">
                  <label className="form-lbl">Output Resolution</label>
                  <select className="form-select">
                    <option>Standard (1:1.25)</option>
                    <option>Portrait (4:5)</option>
                  </select>
                </div>
              </div>
              */}

              {/* Generate button — always active, validates on click */}
              <button
                type="button"
                className="btn btn-primary ap-generate-btn"
                onClick={runGeneration}
                disabled={generating}
              >
                <span className="material-symbols-outlined">auto_awesome</span>
                {generating ? `Generating… ${progress}` : 'Generate Model Photo'}
              </button>

              {error && (
                <div className="alert alert-red ap-studio-alert">
                  <span className="material-symbols-outlined">error</span>{error}
                </div>
              )}

              {saveMessage && (
                <div className="alert alert-info ap-studio-alert">
                  <span className="material-symbols-outlined">check_circle</span>{saveMessage}
                </div>
              )}

              {/* Single result display */}
              {generatedUrl && (
                <>
                  <div className="ap-section-lbl ap-gen-results-lbl">Generated Result</div>
                  <div className="ap-gen-single-wrap">
                    <div
                      className="ap-gen-single-img"
                      style={{ backgroundImage:`url('${generatedUrl}')` }}
                    />
                    {saved && (
                      <div className="ap-gen-saved-badge">
                        <span className="material-symbols-outlined">check_circle</span>
                        Saved to Gallery
                      </div>
                    )}
                  </div>

                  <div className="ap-studio-desc-box">
                    <div className="ap-studio-desc-lbl">Description</div>
                    <div className="ap-studio-desc-text">
                      AI-generated on-model photo — garment from Photo {selectedSourceIndex + 1} placed on {selectedModel?.label || 'model'}.
                    </div>
                  </div>

                  <div className="ap-gen-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={regenerate}
                      disabled={generating || saving}
                    >
                      <span className="material-symbols-outlined">refresh</span>
                      Regenerate
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={saveToGallery}
                      disabled={saved || saving || generating}
                    >
                      <span className="material-symbols-outlined">
                        {saved ? 'check_circle' : 'add_photo_alternate'}
                      </span>
                      {saved
                        ? 'Saved to Gallery'
                        : (saving ? 'Saving…' : 'Add to Gallery')}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── Change Source modal ─────────────────────────────────────────────── */}
      {showSourceModal && (
        <div className="modal-backdrop" onClick={() => setShowSourceModal(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()} style={{ overflowY:'auto', maxHeight:'85vh' }}>
            <div className="modal-hdr">
              <div className="modal-title">Select <em>Source Photo</em></div>
              <div className="modal-close" onClick={() => setShowSourceModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>

            <div className="ap-source-modal-info">
              Choose which product photo will be used as the garment reference.
            </div>

            <div className="ap-source-modal-grid">
              {productPhotos.map((p, i) => (
                <div
                  key={p.id}
                  className={`ap-source-modal-thumb${p.id === selectedSourceId ? ' selected' : ''}`}
                  onClick={() => {
                    setSelectedSourceId(p.id)
                    setShowSourceModal(false)
                  }}
                >
                  <div
                    className="ap-source-modal-img"
                    style={{ backgroundImage:`url('${p.url}')` }}
                  />
                  <div className="ap-source-modal-label">Photo {i + 1}</div>
                  {p.id === selectedSourceId && (
                    <div className="ap-source-modal-check">
                      <span className="material-symbols-outlined">check_circle</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── All Models modal ────────────────────────────────────────────────── */}
      {showAllModelsModal && (
        <div className="modal-backdrop" onClick={() => setShowAllModelsModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ overflowY:'auto', maxHeight:'85vh' }}>
            <div className="modal-hdr">
              <div className="modal-title">All <em>Available Models</em></div>
              <div className="modal-close" onClick={() => setShowAllModelsModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>

            <div className="ai-model-grid">
              {stockModels.map(m => (
                <div
                  key={m.id}
                  className={`ai-model-card${selectedModelId === m.id ? ' sel' : ''}`}
                  onClick={() => {
                    setSelectedModelId(m.id)
                    setShowAllModelsModal(false)
                  }}
                >
                  <div className="ai-model-img" style={{ backgroundImage:`url('${m.image_url}')` }} />
                  <div className="ai-model-name">{m.label}</div>
                  <div className="ai-model-meta">{m.gender}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
