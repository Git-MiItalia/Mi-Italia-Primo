import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../ui/modals'
import useLangStore from '../../store/langStore'
import { findById } from '../../lib/returnsPolicy/model'
import { isLawfulOnline } from '../../lib/returnsPolicy/engine'

/**
 * "Change class mapping" modal — Store Profile, Returns Classes card.
 * Unlike the store-default picker, an in-store-only policy is allowed here:
 * the online-fallback guardrail (in the resolution engine) transparently
 * falls back to the store default whenever such a product is listed online.
 */
export default function ClassMappingModal({ klass, policies, storeDefaultId, onSave, onClose }) {
  const { t } = useTranslation()
  const lang = useLangStore(s => s.lang)
  const [pendingMap, setPendingMap] = useState(klass.map)

  function winText(p) {
    if (p.none) return t('returns_policy.window_none', 'No returns')
    return `${p.days} ${t('returns_policy.days', 'days')}`
  }

  const storeDefault = findById(policies, storeDefaultId)
  const className = lang === 'it' ? klass.it : klass.en

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('returns_classes.mapping_modal.title', { className, defaultValue: 'Change mapping — {{className}}' })}
    >
      <p className="modal-intro">
        {t('returns_classes.mapping_modal.intro', 'Products of this class inherit this policy unless a product overrides it. In-store-only policies fall back to the store default when a product is listed online.')}
      </p>

      <div
        className={`rp-opt${pendingMap === null ? ' sel' : ''}`}
        onClick={() => setPendingMap(null)}
      >
        <div className="rp-opt-radio" />
        <div className="rp-opt-body">
          <div className="rp-opt-name">{t('returns_classes.mapping_modal.follow_default', 'Follow store default')}</div>
          <div className="rp-opt-sub">
            {storeDefault ? `${lang === 'it' ? storeDefault.it : storeDefault.en} · ${winText(storeDefault)}` : ''}
          </div>
        </div>
      </div>

      {policies.map(p => {
        const sel = pendingMap === p.id
        const instoreOnly = !isLawfulOnline(p)
        return (
          <div
            key={p.id}
            className={`rp-opt${sel ? ' sel' : ''}`}
            onClick={() => setPendingMap(p.id)}
          >
            <div className="rp-opt-radio" />
            <div className="rp-opt-body">
              <div className="rp-opt-name">{lang === 'it' ? p.it : p.en}</div>
              <div className="rp-opt-sub">{winText(p)}</div>
            </div>
            {instoreOnly && (
              <div className="rp-opt-badge muted">
                <span className="material-symbols-outlined">storefront</span>
                {t('returns_classes.mapping_modal.instore_only', 'In-store only')}
              </div>
            )}
          </div>
        )
      })}

      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-outline">
          {t('common.cancel', 'Cancel')}
        </button>
        <button type="button" onClick={() => { onSave(pendingMap); onClose() }} className="btn btn-primary">
          {t('returns_classes.mapping_modal.save_btn', 'Save mapping')}
        </button>
      </div>
    </Modal>
  )
}
