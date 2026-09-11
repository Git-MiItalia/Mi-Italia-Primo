import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api'

const API = import.meta.env.VITE_API_URL

// Preset prompt chips (dead UI — Custom Text Prompt tab is placeholder only).
// `en` is what gets appended to the prompt: the prompt is sent to the image
// model, which expects English, so only the chip label is translated.
const PROMPT_CHIPS = [
  { key: 'studio_white',     en: 'Studio white background' },
  { key: 'milan_street',     en: 'Milan street, golden hour' },
  { key: 'boutique_warm',    en: 'Boutique interior, warm light' },
  { key: 'italian_country',  en: 'Italian countryside' },
  { key: 'relaxed_pose',     en: 'Relaxed pose' },
  { key: 'athletic_build',   en: 'Athletic build' },
  { key: 'slim_build',       en: 'Slim fit build' },
  { key: 'plus_size',        en: 'Plus size' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function AIModelStudio({ productId, refreshKey, onPhotosChange }) {
  const { t } = useTranslation()

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
        setError(t('ais_legacy.err_load_photos'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // `t` re-runs this on a language switch; the fetch is cancel-guarded, so
    // the only effect is that a failure message reappears in the new language.
  }, [productId, refreshKey, t])

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
      if (!data.success) throw new Error(data.message || t('ais_legacy.err_status_check'))
      const { status, outputs, error: statusErr } = data.data
      setProgress(`${status}…`)
      if (status === 'completed') return outputs?.[0] || null
      if (status === 'failed' || statusErr) throw new Error(statusErr || t('ais_legacy.err_generation_failed'))
    }
    throw new Error(t('ais_legacy.err_timeout'))
  }

  // ── Submit + poll for the single selected source photo ─────────────────────
  async function runGeneration() {
    setError('')
    setSaveMessage('')

    // Validate — inline errors instead of toast
    if (!selectedSourcePhoto) { setError(t('ais_legacy.err_select_source')); return }
    if (!selectedModel)       { setError(t('ais_legacy.err_select_model')); return }

    setGeneratedUrl(null)
    setSaved(false)
    setGenerating(true)
    setProgress(t('ais_legacy.submitting'))

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
      if (!submitData.success) throw new Error(submitData.message || t('ais_legacy.err_submit_failed'))

      const outputUrl = await pollStatus(submitData.data.predictionId)
      if (outputUrl) setGeneratedUrl(outputUrl)
    } catch (err) {
      console.error('[AIModelStudio] generation failed:', err)
      setError(err.message || t('ais_legacy.err_generation_retry'))
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
      if (!data.success) throw new Error(data.message || t('ais_legacy.err_save_failed'))

      setSaved(true)
      setSaveMessage(data.message || t('ais_legacy.toast_added_gallery'))
      if (onPhotosChange) onPhotosChange()
    } catch (err) {
      console.error('[AIModelStudio] save-to-gallery failed:', err)
      setError(err.message || t('ais_legacy.err_save_retry'))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="card">
      <div className="card-hdr">
        <div>
          <div className="card-title">{t('ais_legacy.title_pre')} <em>{t('ais_legacy.title_em')}</em></div>
          <div className="ap-card-sub">
            {t('ais_legacy.sub')}
          </div>
        </div>
        <div className="ap-ai-hdr-right">
          <span className="ap-ai-badge">{t('ais_legacy.powered_by_ai')}</span>
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
              <div>{t('ais_legacy.save_product_first')}</div>
            </div>
          )}

          {productId && loading && (
            <div className="ap-studio-empty">{t('common.loading')}</div>
          )}

          {productId && !loading && productPhotos.length === 0 && (
            <div className="ap-studio-empty ap-studio-empty-warn">
              <span className="material-symbols-outlined">photo_camera</span>
              <div>
                <strong>{t('ais_legacy.upload_first_bold')}</strong>
                <div className="ap-studio-empty-sub">
                  {t('ais_legacy.upload_first_note')}
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
                    {t('ais_legacy.source_photo_n', { n: selectedSourceIndex >= 0 ? selectedSourceIndex + 1 : '—' })}
                  </div>
                  <div className="ap-source-sub">
                    {t('ais_legacy.source_photo_note')}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline ap-source-btn"
                  onClick={() => setShowSourceModal(true)}
                >
                  {t('ais_legacy.change_source')}
                </button>
              </div>

              {/* Tab switcher — Mi Italia Models | Custom Text Prompt (dead UI) */}
              <div className="ap-studio-tabs">
                <div
                  className={`ai-studio-tab${studioTab === 'mi' ? ' act' : ''}`}
                  onClick={() => setStudioTab('mi')}
                >
                  {t('ais_legacy.tab_mi')}
                </div>
                <div
                  className={`ai-studio-tab${studioTab === 'prompt' ? ' act' : ''}`}
                  onClick={() => setStudioTab('prompt')}
                >
                  {t('ais_legacy.tab_prompt')}
                </div>
              </div>

              {/* Mi Italia Models tab */}
              {studioTab === 'mi' && (
                <>
                  <div className="ap-section-lbl">
                    {stockModels.length > 0
                      ? t('ais_legacy.select_model_n', { n: stockModels.length })
                      : t('ais_legacy.select_model')}
                  </div>
                  {stockModels.length === 0 ? (
                    <div className="ap-studio-empty">{t('ais_legacy.loading_models')}</div>
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
                  <div className="ap-section-lbl">{t('ais_legacy.describe_model_scene')}</div>
                  <div className="form-group">
                    <textarea
                      className="form-textarea ap-prompt-textarea"
                      placeholder={t('ais_legacy.prompt_placeholder')}
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                    />
                    <div className="form-hint">
                      {t('ais_legacy.prompt_hint')}
                    </div>
                  </div>
                  <div className="ap-chips">
                    {PROMPT_CHIPS.map(chip => (
                      <div
                        key={chip.key}
                        className="prompt-chip"
                        onClick={() => setCustomPrompt(p => p ? p + ', ' + chip.en : chip.en)}
                      >
                        {t(`ais_legacy.chip.${chip.key}`)}
                      </div>
                    ))}
                  </div>
                  <div className="ap-prompt-note">
                    <span className="material-symbols-outlined">info</span>
                    {t('ais_legacy.prompt_preview_note')}
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
                {generating
                  ? t('ais_legacy.generating_progress', { progress })
                  : t('ais_legacy.generate_btn')}
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
                  <div className="ap-section-lbl ap-gen-results-lbl">{t('ais_legacy.generated_result')}</div>
                  <div className="ap-gen-single-wrap">
                    <div
                      className="ap-gen-single-img"
                      style={{ backgroundImage:`url('${generatedUrl}')` }}
                    />
                    {saved && (
                      <div className="ap-gen-saved-badge">
                        <span className="material-symbols-outlined">check_circle</span>
                        {t('ais_legacy.saved_to_gallery')}
                      </div>
                    )}
                  </div>

                  <div className="ap-studio-desc-box">
                    <div className="ap-studio-desc-lbl">{t('ais_legacy.description')}</div>
                    <div className="ap-studio-desc-text">
                      {t('ais_legacy.description_text', {
                        n:     selectedSourceIndex + 1,
                        model: selectedModel?.label || t('ais_legacy.model_fallback'),
                      })}
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
                      {t('ais_legacy.regenerate')}
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
                        ? t('ais_legacy.saved_to_gallery')
                        : (saving ? t('common.saving') : t('ais_legacy.add_to_gallery'))}
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
              <div className="modal-title">{t('ais_legacy.select_source_pre')} <em>{t('ais_legacy.select_source_em')}</em></div>
              <div className="modal-close" onClick={() => setShowSourceModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>

            <div className="ap-source-modal-info">
              {t('ais_legacy.select_source_info')}
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
                  <div className="ap-source-modal-label">{t('ais.gen.photo_n', { n: i + 1 })}</div>
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
