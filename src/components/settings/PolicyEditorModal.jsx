import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../ui/modals'
import { isProtected } from '../../lib/returnsPolicy/model'
import { validatePolicy, isEligibleAsDefault, POLICY_ERRORS } from '../../lib/returnsPolicy/engine'

/**
 * "New / Edit policy" modal — Store Profile, Returns Policies card.
 * `policy` is null when creating a new one. Validation mirrors the guardrails
 * the API must also enforce server-side (see returnsPolicy/engine.js).
 */
export default function PolicyEditorModal({ policy, isCurrentDefault, onSave, onRemove, onClose }) {
  const { t } = useTranslation()
  const isNew = !policy
  const isCustom = !!policy && !isProtected(policy.id)

  const [en, setEn]           = useState(policy?.en ?? '')
  const [it, setIt]           = useState(policy?.it ?? '')
  const [none, setNone]       = useState(policy?.none ?? false)
  const [days, setDays]       = useState(policy && !policy.none ? policy.days : 14)
  const [online, setOnline]   = useState(policy?.online ?? true)
  const [instore, setInstore] = useState(policy?.instore ?? true)
  const [exempt, setExempt]   = useState(policy?.exempt ?? 'none')
  const [error, setError]     = useState(null)

  function errMsg(code) {
    switch (code) {
      case POLICY_ERRORS.NAMES_REQUIRED:     return t('returns_policy.editor.err_names', 'Both names are required.')
      case POLICY_ERRORS.CHANNEL_REQUIRED:   return t('returns_policy.editor.err_channel', 'Choose at least one channel.')
      case POLICY_ERRORS.ONLINE_MIN:         return t('returns_policy.editor.err_online_min', 'Online sales require at least 14 days.')
      case POLICY_ERRORS.EXEMPTION_REQUIRED: return t('returns_policy.editor.err_exemption', 'No-returns online needs a legal exemption. Add one, or remove the online channel.')
      default:                               return t('returns_policy.editor.err_generic', 'Please check the fields above.')
    }
  }

  function handleSave() {
    const draft = {
      en: en.trim(),
      it: it.trim(),
      days: none ? 0 : Number(days) || 0,
      none,
      online,
      instore,
      exempt: none ? exempt : 'none',
    }
    const check = validatePolicy(draft)
    if (!check.ok) { setError(errMsg(check.error)); return }
    if (isCurrentDefault && !isEligibleAsDefault(draft)) {
      setError(t('returns_policy.editor.err_default_unlawful', 'This is the store default and must stay lawful for online sales.'))
      return
    }
    const id = policy ? policy.id : `custom_${Date.now()}`
    onSave({ id, ...draft, edited: true }, isNew)
    onClose()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isNew ? t('returns_policy.editor.title_new', 'New policy') : t('returns_policy.editor.title_edit', 'Edit policy')}
    >
      <div className="form-row2">
        <div className="form-group">
          <label className="form-lbl">{t('returns_policy.editor.name_en', 'Name (English)')}</label>
          <input className="form-input" value={en} onChange={e => setEn(e.target.value)} placeholder="e.g. Holiday 60-day" />
        </div>
        <div className="form-group">
          <label className="form-lbl">{t('returns_policy.editor.name_it', 'Name (Italian)')}</label>
          <input className="form-input" value={it} onChange={e => setIt(e.target.value)} placeholder="es. Festivo 60 giorni" />
        </div>
      </div>

      <div className="form-group">
        <label className="form-lbl">{t('returns_policy.editor.window', 'Return window')}</label>
        <div className="rp-seg-row">
          <button type="button" className={`btn btn-sm ${!none ? 'btn-primary' : 'btn-outline'}`} onClick={() => setNone(false)}>
            {t('returns_policy.editor.days_opt', 'Days')}
          </button>
          <button type="button" className={`btn btn-sm ${none ? 'btn-primary' : 'btn-outline'}`} onClick={() => setNone(true)}>
            {t('returns_policy.editor.none_opt', 'No returns')}
          </button>
          {!none && (
            <input className="form-input rp-days-input" type="number" min="0" value={days} onChange={e => setDays(e.target.value)} />
          )}
        </div>
      </div>

      <div className="form-group">
        <label className="form-lbl">{t('returns_policy.editor.channels', 'Channels')}</label>
        <div className="ap-toggle-row ap-toggle-border">
          <div className="ap-toggle-label">{t('returns_policy.editor.online', 'Online')}</div>
          <div className={`toggle${online ? ' on' : ''}`} onClick={() => setOnline(v => !v)}>
            <div className="toggle-knob" />
          </div>
        </div>
        <div className="ap-toggle-row">
          <div className="ap-toggle-label">{t('returns_policy.editor.instore', 'In-store')}</div>
          <div className={`toggle${instore ? ' on' : ''}`} onClick={() => setInstore(v => !v)}>
            <div className="toggle-knob" />
          </div>
        </div>
      </div>

      {none && (
        <div className="form-group">
          <label className="form-lbl">{t('returns_policy.editor.exemption', 'Legal exemption (required for no-returns online)')}</label>
          <div className="rp-seg-row">
            <button type="button" className={`btn btn-sm ${exempt === 'none' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setExempt('none')}>
              {t('returns_policy.editor.exempt_none', 'None')}
            </button>
            <button type="button" className={`btn btn-sm ${exempt === 'bespoke' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setExempt('bespoke')}>
              {t('returns_policy.editor.exempt_bespoke', 'Bespoke')}
            </button>
            <button type="button" className={`btn btn-sm ${exempt === 'sealed' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setExempt('sealed')}>
              {t('returns_policy.editor.exempt_sealed', 'Sealed')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-red">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      <div className="modal-footer">
        {isCustom && (
          <button
            type="button"
            className="btn btn-red"
            style={{ marginRight: 'auto' }}
            onClick={() => { onRemove(policy.id); onClose() }}
          >
            {t('returns_policy.editor.remove_btn', 'Remove')}
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          {isNew ? t('returns_policy.editor.add_btn', 'Add policy') : t('returns_policy.editor.save_btn', 'Save changes')}
        </button>
      </div>
    </Modal>
  )
}
