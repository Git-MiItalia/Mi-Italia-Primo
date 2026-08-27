import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import StripeCheckout from '../components/ui/StripeCheckout'
import PrimoLogo from '../assets/PrimoLogo.svg'

const BASE_URL = import.meta.env.VITE_API_URL

function Feat({ icon = 'check', locked, highlight, muted, children }) {
  let cls = 'sub-plan-feat'
  if (locked)    cls += ' locked'
  if (highlight) cls += ' highlight'
  if (muted)     cls += ' muted'
  const iconColor = (icon === 'close' || icon === 'schedule') && !highlight
    ? 'var(--stone)'
    : icon === 'check' && !locked
    ? 'var(--green)'
    : 'var(--stone)'
  return (
    <div className={cls}>
      <span className="material-symbols-outlined" style={{ color: iconColor }}>{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function AiSection({ title, children }) {
  return (
    <div className="sub-ai-section">
      <div className="sub-ai-header">
        <span className="material-symbols-outlined">neurology</span>
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}

function StarterCard({ t, selecting, onSelect }) {
  return (
    <div className="sub-plan-card ssu-plan-col">
      <div className="sub-plan-name"><em>{t('sub.plans.starter')}</em></div>
      <div className="ssu-plan-desc">
        {t('sub.setup.starter_desc')}
      </div>
      <div className="sub-plan-price">€0<span className="sub-plan-price-mo">/mo</span></div>
      <div className="sub-plan-price-sub">{t('sub.setup.starter_rate')}</div>
      <div className="sub-plan-feats ssu-feats-grow">
        <Feat><span dangerouslySetInnerHTML={{ __html: t('sub.setup.feat_500_contacts') }} /></Feat>
        <Feat>{t('sub.setup.feat_2_campaigns')}</Feat>
        <Feat>{t('sub.setup.feat_10_renders')}</Feat>
        <Feat>{t('sub.setup.feat_1_lang')}</Feat>
        <Feat icon="close" locked>{t('sub.setup.feat_no_whatsapp')}</Feat>
        <Feat icon="close" locked>{t('sub.setup.feat_no_tiers')}</Feat>
        <AiSection title={t('sub.setup.ai_title')}>
          <Feat>{t('sub.setup.ai_italian_vocab')}</Feat>
          <Feat icon="close" locked>{t('sub.setup.ai_no_style')}</Feat>
          <Feat icon="close" locked>{t('sub.setup.ai_no_memory')}</Feat>
          <Feat icon="schedule" locked>{t('sub.setup.ai_translations_soon')}</Feat>
        </AiSection>
      </div>
      <button
        className="btn btn-primary ssu-plan-btn"
        disabled={!!selecting}
        onClick={onSelect}
      >
        {selecting === 'starter' ? t('sub.setup.setting_up') : t('sub.setup.start_starter')}
      </button>
    </div>
  )
}

function ConnectCard({ t, selecting, onSelect }) {
  return (
    <div className="sub-plan-card ssu-plan-col">
      <div className="sub-plan-name"><em>{t('sub.setup.connect')}</em></div>
      <div className="ssu-plan-desc">
        {t('sub.setup.connect_desc')}
      </div>
      <div className="sub-plan-price">€0<span className="sub-plan-price-mo">/mo</span></div>
      <div className="sub-plan-price-sub">{t('sub.setup.connect_rate')}</div>
      <div className="sub-plan-feats ssu-feats-grow">
        <Feat><span dangerouslySetInnerHTML={{ __html: t('sub.setup.feat_1500_contacts') }} /></Feat>
        <Feat>{t('sub.setup.feat_unlimited_email')}</Feat>
        <Feat>{t('sub.setup.feat_wa_print')}</Feat>
        <Feat>{t('sub.setup.feat_25_renders')}</Feat>
        <Feat>{t('sub.setup.feat_8_langs')}</Feat>
        <Feat>{t('sub.setup.feat_tier_discounts')}</Feat>
        <Feat>{t('sub.setup.feat_floor')}</Feat>
        <Feat icon="schedule" locked>{t('sub.setup.feat_ig_dm')} <span className="sub-soon-tag">{t('sub.setup.coming_soon')}</span></Feat>
        <AiSection title={t('sub.setup.ai_title')}>
          <Feat>{t('sub.setup.ai_italian_vocab')}</Feat>
          <Feat>{t('sub.setup.ai_remembers_campaigns')}</Feat>
          <Feat>{t('sub.setup.ai_translations_2h')}</Feat>
          <Feat icon="close" locked>{t('sub.setup.ai_no_behaviour')}</Feat>
        </AiSection>
      </div>
      <button
        className="btn btn-primary ssu-plan-btn"
        disabled={!!selecting}
        onClick={onSelect}
      >
        {selecting === 'connect' ? t('sub.setup.setting_up') : t('sub.setup.start_connect')}
      </button>
    </div>
  )
}

function ProCard({ t, selecting, onSelect }) {
  return (
    <div className="sub-plan-card recommended ssu-plan-col">
      <div className="sub-plan-tag recommended">{t('sub.setup.recommended')}</div>
      <div className="sub-plan-name"><em>{t('sub.plans.pro')}</em></div>
      <div className="ssu-plan-desc">
        {t('sub.setup.pro_desc')}
      </div>
      <div className="sub-plan-price">€200<span className="sub-plan-price-mo">/mo</span></div>
      <div className="sub-plan-price-sub">{t('sub.setup.pro_rate')}</div>
      <div className="sub-plan-feats ssu-feats-grow">
        <Feat><span dangerouslySetInnerHTML={{ __html: t('sub.setup.feat_unlimited_contacts') }} /></Feat>
        <Feat>{t('sub.setup.feat_unlimited_campaigns')}</Feat>
        <Feat>{t('sub.setup.feat_unlimited_renders')}</Feat>
        <Feat>{t('sub.setup.feat_multi_location')}</Feat>
        <Feat>{t('sub.setup.feat_custom_checkout')}</Feat>
        <Feat>{t('sub.setup.feat_account_manager')}</Feat>
        <AiSection title={t('sub.setup.ai_title')}>
          <Feat highlight icon="workspace_premium">{t('sub.setup.ai_nightly')}</Feat>
          <Feat highlight icon="workspace_premium">{t('sub.setup.ai_remembers_all')}</Feat>
          <Feat highlight icon="workspace_premium"><span dangerouslySetInnerHTML={{ __html: t('sub.setup.ai_sounds_like_you') }} /></Feat>
          <Feat highlight icon="workspace_premium">{t('sub.setup.ai_translations_30m')}</Feat>
        </AiSection>
      </div>
      <button
        className="btn btn-primary ssu-plan-btn"
        disabled={!!selecting}
        onClick={onSelect}
      >
        <span className="material-symbols-outlined">north_east</span>
        {t('sub.setup.start_pro')}
      </button>
    </div>
  )
}

export default function SubscriptionSetup() {
  const navigate = useNavigate()
  const { t }    = useTranslation()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selecting,    setSelecting]    = useState(null)
  const [error,        setError]        = useState('')

  const handleSelectPlan = async (plan) => {
    setSelecting(plan); setError('')
    try {
      const res  = await apiFetch(`${BASE_URL}/boutique/subscription/select-plan`, {
        method: 'POST',
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.success) navigate('/subscription')
      else setError(data.message || t('sub.setup.error_select'))
    } catch {
      setError(t('common.error_network'))
    } finally {
      setSelecting(null)
    }
  }

  return (
    <div className="ssu-wrap">
      <div className="ssu-logo-wrap ssu-logo-center">
        <img src={PrimoLogo} alt="Primo by Mi Italia" className="ssu-logo" />
      </div>
      <div className="ssu-hdr">
        <div className="ssu-title">{t('sub.setup.title')} <em>{t('sub.setup.title_em')}</em></div>
        <div className="ssu-sub">{t('sub.setup.subtitle')}</div>
      </div>

      {error && (
        <div className="alert alert-red ssu-error">
          <span className="material-symbols-outlined">error</span>{error}
        </div>
      )}

      <div className="ssu-grid">
        <StarterCard t={t} selecting={selecting} onSelect={() => handleSelectPlan('starter')} />
        <ConnectCard t={t} selecting={selecting} onSelect={() => handleSelectPlan('connect')} />
        <ProCard     t={t} selecting={selecting} onSelect={() => setCheckoutOpen(true)} />
      </div>

      <div className="ssu-note ssu-note-row">
        <span className="material-symbols-outlined">lock</span>
        <span>{t('sub.setup.activation_note')}</span>
      </div>

      {checkoutOpen && (
        <StripeCheckout
          plan="pro"
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => navigate('/subscription')}
        />
      )}
    </div>
  )
}
