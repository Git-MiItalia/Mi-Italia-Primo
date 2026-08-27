import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Toast, { useToast } from '../ui/Toast'

const PRESET_COLOURS = [
  { name:'Black',    hex:'#000000' },
  { name:'White',    hex:'#FFFFFF' },
  { name:'Navy',     hex:'#1B2A4A' },
  { name:'Camel',    hex:'#C19A6B' },
  { name:'Beige',    hex:'#E8DCC8' },
  { name:'Ivory',    hex:'#FFFFF0' },
  { name:'Brown',    hex:'#6B3D1E' },
  { name:'Burgundy', hex:'#800020' },
  { name:'Forest',   hex:'#2D5016' },
  { name:'Stone',    hex:'#8C7B6B' },
  { name:'Grey',     hex:'#808080' },
  { name:'Rust',     hex:'#B7410E' },
  { name:'Mustard',  hex:'#E1AD01' },
  { name:'Cobalt',   hex:'#0047AB' },
  { name:'Olive',    hex:'#6B7B3A' },
  { name:'Camo',     hex:'#6B7B6B' },
]

function hexToDisplay(hex) { return hex?.toUpperCase() ?? '' }
function isValidHex(hex)   { return /^#[0-9A-Fa-f]{6}$/.test(hex) }

export default function ColourVariants({ initialColours, onColourChange, onColoursChange }) {
  const { toasts, show } = useToast()
  const { t }            = useTranslation()

  const [colours, setColours]       = useState([])
  const [adding, setAdding]         = useState(false)
  const [pickerHex, setPickerHex]   = useState('#B8955A')
  const [codeInput, setCodeInput]   = useState('#B8955A')
  const [colourName, setColourName] = useState('')
  const [codeError, setCodeError]   = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [selectedPresets, setSelectedPresets] = useState([])
  const pickerRef    = useRef()
  const nameInputRef = useRef()
  const initialised  = useRef(false)

  // Seed colours from initialColours prop (edit mode)
  useEffect(() => {
    if (initialised.current) return
    if (!initialColours?.length) return
    // Normalise — ensure each colour has an id
    const seeded = initialColours
      .filter(c => c?.name)
      .map((c, i) => ({
        id:  c.id ?? Date.now() + i,
        name: c.name,
        hex:  c.hex ?? '#888888',
      }))
    if (!seeded.length) return
    setColours(seeded)
    setSelectedId(seeded[0].id)
    if (onColourChange)  onColourChange(seeded[0])
    if (onColoursChange) onColoursChange(seeded)
    initialised.current = true
  }, [initialColours])

  function openAdding() {
    setPickerHex('#B8955A'); setCodeInput('#B8955A')
    setColourName(''); setCodeError(''); setAdding(true)
  }

  function handlePickerChange(e) {
    const hex = e.target.value
    setPickerHex(hex); setCodeInput(hex.toUpperCase()); setCodeError('')
  }

  function handleCodeInput(e) {
    let val = e.target.value
    if (!val.startsWith('#')) val = '#' + val
    setCodeInput(val)
    if (isValidHex(val)) { setPickerHex(val); setCodeError('') }
    else setCodeError(t('colour_variants.hex_error'))
  }

  function saveColour() {
    if (!colourName.trim()) return
    if (!isValidHex(pickerHex)) { setCodeError(t('colour_variants.hex_error')); return }
    const trimmedName = colourName.trim()
    if (colours.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      show(t('colour_variants.duplicate_name', { name: trimmedName }), 'warning')
      return
    }
    const newColour = { id: Date.now(), name: trimmedName, hex: pickerHex.toUpperCase() }
    const updated   = [...colours, newColour]
    setColours(updated)
    setSelectedId(newColour.id)
    if (onColourChange)  onColourChange(newColour)
    if (onColoursChange) onColoursChange(updated)
    // Reset for the next colour instead of closing — lets the user add several in a row
    setColourName('')
    setPickerHex('#B8955A'); setCodeInput('#B8955A'); setCodeError('')
    nameInputRef.current?.focus()
  }

  function handleFieldKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveColour() }
  }

  function removeColour(id) {
    const updated = colours.filter(c => c.id !== id)
    setColours(updated)
    if (onColoursChange) onColoursChange(updated)
    if (selectedId === id) {
      setSelectedId(updated[0]?.id ?? null)
      if (onColourChange) onColourChange(updated[0] ?? null)
    }
  }

  function selectColour(c) {
    setSelectedId(c.id)
    if (onColourChange) onColourChange(c)
  }

  function togglePreset(preset) {
    setSelectedPresets(prev =>
      prev.includes(preset.hex) ? prev.filter(h => h !== preset.hex) : [...prev, preset.hex]
    )
  }

  function addSelectedPresets() {
    if (!selectedPresets.length) return
    const existingNames = new Set(colours.map(c => c.name.toLowerCase()))
    const toAdd = PRESET_COLOURS.filter(p =>
      selectedPresets.includes(p.hex) && !existingNames.has(p.name.toLowerCase())
    )
    setSelectedPresets([])
    if (!toAdd.length) { show(t('colour_variants.already_added'), 'warning'); return }
    const newColours = toAdd.map((p, i) => ({ id: Date.now() + i, name: p.name, hex: p.hex }))
    const updated = [...colours, ...newColours]
    setColours(updated)
    const last = newColours[newColours.length - 1]
    setSelectedId(last.id)
    if (onColourChange)  onColourChange(last)
    if (onColoursChange) onColoursChange(updated)
    show(t('colour_variants.presets_added', { count: newColours.length }), 'success')
  }

  return (
    <>
      <div className="card">
        <div className="cv-hdr">
          <div className="card-title">Colour <em>Variants</em></div>
          {!adding ? (
            <button className="btn btn-sm btn-outline" onClick={openAdding}>
              <span className="material-symbols-outlined">add</span>{t('colour_variants.add_btn')}
            </button>
          ) : (
            <div className="cv-hdr-actions">
              <button className="btn btn-sm btn-outline" onClick={() => setAdding(false)}>{t('colour_variants.done')}</button>
              <button className="btn btn-sm btn-primary" onClick={saveColour}>
                <span className="material-symbols-outlined">add</span>{t('colour_variants.add_colour_btn')}
              </button>
            </div>
          )}
        </div>

        {colours.length > 0 && (
          <div className={`cv-chips${adding ? ' cv-chips-mb' : ''}`}>
            {colours.map(c => (
              <div key={c.id} onClick={() => selectColour(c)} className={`cv-chip${selectedId === c.id ? ' sel' : ''}`}>
                <div className="cv-chip-dot" style={{ background:c.hex }} />
                <span className={`cv-chip-name${selectedId === c.id ? ' sel' : ''}`}>{c.name}</span>
                <span className="cv-chip-hex">{c.hex}</span>
                <span className="material-symbols-outlined cv-chip-remove"
                  onClick={e => { e.stopPropagation(); removeColour(c.id) }}>close</span>
              </div>
            ))}
          </div>
        )}

        {colours.length === 0 && !adding && (
          <div className="cv-empty">{t('colour_variants.empty')}</div>
        )}

        {adding && (
          <div className={`cv-form${colours.length > 0 ? ' cv-form-mt' : ''}`}>
            <div className="cv-picker-row">
              <div className="cv-picker-wrap">
                <div className="cv-picker-swatch" style={{ background:pickerHex }} onClick={() => pickerRef.current?.click()}>
                  <input ref={pickerRef} type="color" value={pickerHex} onChange={handlePickerChange} className="cv-picker-native" />
                </div>
                <div className="cv-picker-hint">{t('colour_variants.click_to_pick')}</div>
              </div>
              <div className="cv-fields">
                <div className="form-group ap-no-mb">
                  <label className="form-lbl">{t('colour_variants.hex_label')}</label>
                  <input className={`form-input cv-hex-input${codeError ? ' cv-input-error' : ''}`}
                    value={codeInput} onChange={handleCodeInput} onKeyDown={handleFieldKeyDown} placeholder="#000000" />
                  {codeError && <div className="cv-error">{codeError}</div>}
                </div>
                <div className="form-group ap-no-mb">
                  <label className="form-lbl">{t('colour_variants.name_label')}</label>
                  <input ref={nameInputRef} className="form-input" value={colourName}
                    onChange={e => setColourName(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder={t('colour_variants.name_placeholder')} />
                </div>
              </div>
            </div>

            {isValidHex(pickerHex) && (
              <div className="cv-preview">
                <div className="cv-preview-dot" style={{ background:pickerHex }} />
                <span className="cv-preview-name">{colourName || t('colour_variants.unnamed')}</span>
                <span className="cv-preview-hex">{hexToDisplay(pickerHex)}</span>
              </div>
            )}

            <div className="cv-presets-hdr">
              <div className="cv-presets-lbl">{t('colour_variants.quick_presets')}</div>
              {selectedPresets.length > 0 && (
                <button type="button" className="btn btn-sm btn-primary" onClick={addSelectedPresets}>
                  <span className="material-symbols-outlined">check</span>
                  {t('colour_variants.add_selected', { count: selectedPresets.length })}
                </button>
              )}
            </div>
            <div className="cv-presets">
              {PRESET_COLOURS.map(p => {
                const checked = selectedPresets.includes(p.hex)
                return (
                  <div key={p.hex} onClick={() => togglePreset(p)} title={`${p.name} ${p.hex}`} className={`cv-preset${checked ? ' sel' : ''}`}>
                    <div className={`cv-preset-swatch${checked ? ' sel' : ''}`} style={{ background:p.hex }}>
                      {checked && <span className="material-symbols-outlined cv-preset-check">check</span>}
                    </div>
                    <span className="cv-preset-name">{p.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <Toast toasts={toasts} />
    </>
  )
}
