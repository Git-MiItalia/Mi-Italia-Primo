import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

function AiSection({ children }) {
  return (
    <div className="sub-ai-section">
      <div className="sub-ai-header">
        <span className="material-symbols-outlined">neurology</span>
        <span>Your AI Assistant</span>
      </div>
      {children}
    </div>
  )
}

function StarterCard({ selecting, onSelect }) {
  return (
    <div className="sub-plan-card" style={{ display:'flex', flexDirection:'column' }}>
      <div className="sub-plan-name"><em>Starter</em></div>
      <div style={{ fontSize:'10.5px', color:'var(--stone)', lineHeight:1.55 }}>
        Test the platform with zero commitment. Best for boutiques new to digital.
      </div>
      <div className="sub-plan-price">€0<span className="sub-plan-price-mo">/mo</span></div>
      <div className="sub-plan-price-sub">10% on all attributed sales · No floor</div>
      <div className="sub-plan-feats" style={{ flex:1 }}>
        {/* checks */}
        <Feat>Up to <strong>500 contacts</strong></Feat>
        <Feat>2 email campaigns/month</Feat>
        <Feat>10 AI Studio renders/month</Feat>
        <Feat>Italian + 1 language</Feat>
        {/* crosses */}
        <Feat icon="close" locked>No WhatsApp</Feat>
        <Feat icon="close" locked>No tier discounts</Feat>
        <AiSection>
          {/* checks */}
          <Feat>Understands Italian fashion vocabulary</Feat>
          {/* crosses */}
          <Feat icon="close" locked>Doesn't learn from your boutique's style</Feat>
          <Feat icon="close" locked>No memory of your customers or products</Feat>
          {/* clock — coming soon */}
          <Feat icon="schedule" locked>Translations reviewed (Coming Soon)</Feat>
        </AiSection>
      </div>
      <button
        className="btn btn-primary"
        style={{ width:'100%', justifyContent:'center', marginTop:16 }}
        disabled={!!selecting}
        onClick={onSelect}
      >
        {selecting === 'starter' ? 'Setting up…' : 'Start with Starter'}
      </button>
    </div>
  )
}

function ConnectCard({ selecting, onSelect }) {
  return (
    <div className="sub-plan-card" style={{ display:'flex', flexDirection:'column' }}>
      <div className="sub-plan-name"><em>Connect</em></div>
      <div style={{ fontSize:'10.5px', color:'var(--stone)', lineHeight:1.55 }}>
        Pay only when the platform earns. Most boutiques start here.
      </div>
      <div className="sub-plan-price">€0<span className="sub-plan-price-mo">/mo</span></div>
      <div className="sub-plan-price-sub">5–8% tiered commission · 15% floor</div>
      <div className="sub-plan-feats" style={{ flex:1 }}>
        {/* checks */}
        <Feat>Up to <strong>1,500 contacts</strong></Feat>
        <Feat>Unlimited email campaigns</Feat>
        <Feat>WhatsApp &amp; Print campaigns</Feat>
        <Feat>25 AI Studio renders/month</Feat>
        <Feat>All 8 translation languages</Feat>
        <Feat>Tier discounts (Silver → Platinum)</Feat>
        <Feat>Floor protection</Feat>
        {/* clock — coming soon, stone color */}
        <Feat icon="schedule" locked>Instagram DM <span className="sub-soon-tag">COMING SOON</span></Feat>
        <AiSection>
          {/* checks */}
          <Feat>Understands Italian fashion vocabulary</Feat>
          <Feat>Remembers your past campaigns and messaging style</Feat>
          <Feat>Translations reviewed within 2 hours</Feat>
          {/* crosses */}
          <Feat icon="close" locked>Doesn't learn your unique customer behaviour</Feat>
        </AiSection>
      </div>
      <button
        className="btn btn-primary"
        style={{ width:'100%', justifyContent:'center', marginTop:16 }}
        disabled={!!selecting}
        onClick={onSelect}
      >
        {selecting === 'connect' ? 'Setting up…' : 'Start with Connect'}
      </button>
    </div>
  )
}

function ProCard({ selecting, onSelect }) {
  return (
    <div className="sub-plan-card recommended" style={{ display:'flex', flexDirection:'column' }}>
      <div className="sub-plan-tag recommended">RECOMMENDED FOR YOU</div>
      <div className="sub-plan-name"><em>Pro</em></div>
      <div style={{ fontSize:'10.5px', color:'var(--stone)', lineHeight:1.55 }}>
        Predictable monthly cost · zero commission. Best when attribution is mature.
      </div>
      <div className="sub-plan-price">€200<span className="sub-plan-price-mo">/mo</span></div>
      <div className="sub-plan-price-sub">0% commission · No floor</div>
      <div className="sub-plan-feats" style={{ flex:1 }}>
        <Feat><strong>Unlimited contacts</strong></Feat>
        <Feat>Unlimited campaigns · all channels</Feat>
        <Feat>Unlimited AI Studio renders</Feat>
        <Feat>Multi-location support</Feat>
        <Feat>Custom branded checkout</Feat>
        <Feat>Dedicated account manager</Feat>
        <AiSection>
          <Feat highlight icon="workspace_premium">Trained nightly on your boutique specifically</Feat>
          <Feat highlight icon="workspace_premium">Remembers every customer, product, sale, and campaign</Feat>
          <Feat highlight icon="workspace_premium">Responses sound like <em>your</em> boutique, not a generic template</Feat>
          <Feat highlight icon="workspace_premium">Translations reviewed within 30 minutes, 24/7</Feat>
        </AiSection>
      </div>
      <button
        className="btn btn-primary"
        style={{ width:'100%', justifyContent:'center', marginTop:16 }}
        disabled={!!selecting}
        onClick={onSelect}
      >
        <span className="material-symbols-outlined">north_east</span>
        Start with Pro
      </button>
    </div>
  )
}

export default function SubscriptionSetup() {
  const navigate = useNavigate()
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
      else setError(data.message || 'Failed to select plan. Please try again.')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSelecting(null)
    }
  }

  return (
    <div className="ssu-wrap">
      <div className="ssu-logo-wrap" style={{ textAlign:'center' }}>
        <img src={PrimoLogo} alt="Primo by Mi Italia" className="ssu-logo" />
      </div>
      <div className="ssu-hdr">
        <div className="ssu-title">Choose your <em>plan</em></div>
        <div className="ssu-sub">Select a plan to activate your boutique on Mi Italia. You can change plans anytime.</div>
      </div>

      {error && (
        <div className="alert alert-red ssu-error">
          <span className="material-symbols-outlined">error</span>{error}
        </div>
      )}

      <div className="ssu-grid">
        <StarterCard selecting={selecting} onSelect={() => handleSelectPlan('starter')} />
        <ConnectCard selecting={selecting} onSelect={() => handleSelectPlan('connect')} />
        <ProCard     selecting={selecting} onSelect={() => setCheckoutOpen(true)} />
      </div>

      <div className="ssu-note" style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
        <span className="material-symbols-outlined">lock</span>
        <span>Your boutique will be activated once a plan is selected. You cannot access the portal until this step is complete.</span>
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
