import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../ui/modals'
import useLangStore from '../../store/langStore'
import { isEligibleAsDefault } from '../../lib/returnsPolicy/engine'

/**
 * "Change store default" modal — Store Profile, Returns Policies card.
 * The default is the fallback for every product, online included, so only
 * online-lawful policies can be selected here.
 */
export default function ReturnsDefaultModal({ policies, currentDefaultId, onSave, onClose }) {
  const { t } = useTranslation()
  const lang = useLangStore(s => s.lang)
  const [pendingId, setPendingId] = useState(currentDefaultId)

  function winText(p) {
    if (p.none) return t('returns_policy.window_none', 'No returns')
    return `${p.days} ${t('returns_policy.days', 'days')}`
  }

  return (
    <Modal isOpen onClose={onClose} title={t('returns_policy.default_modal.title', 'Change store default')}>
      <p className="modal-intro">
        {t('returns_policy.default_modal.intro', 'The default is the fallback for every product, online included, so only online-lawful policies can be chosen.')}
      </p>
      {policies.map(p => {
        const blocked = !isEligibleAsDefault(p)
        const sel = p.id === pendingId
        return (
          <div
            key={p.id}
            className={`rp-opt${sel ? ' sel' : ''}${blocked ? ' blocked' : ''}`}
            onClick={() => !blocked && setPendingId(p.id)}
          >
            <div className="rp-opt-radio" />
            <div className="rp-opt-body">
              <div className="rp-opt-name">{lang === 'it' ? p.it : p.en}</div>
              <div className="rp-opt-sub">{winText(p)}</div>
            </div>
            {blocked && (
              <div className="rp-opt-badge">
                <span className="material-symbols-outlined">lock</span>
                {t('returns_policy.default_modal.cannot_be_default', 'Cannot be a default')}
              </div>
            )}
          </div>
        )
      })}
      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-outline">
          {t('common.cancel', 'Cancel')}
        </button>
        <button type="button" onClick={() => { onSave(pendingId); onClose() }} className="btn btn-primary">
          {t('returns_policy.default_modal.save_btn', 'Set as default')}
        </button>
      </div>
    </Modal>
  )
}
