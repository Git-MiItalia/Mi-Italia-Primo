import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api'

const API = import.meta.env.VITE_API_URL

const INVITE_METHODS = [
  { k:'email', ico:'📧', name:'Email invite',  desc:'Send Mi Italia invite + receipt' },
  { k:'wa',    ico:'💬', name:'WhatsApp',      desc:'Send invite via WhatsApp' },
  { k:'qr',    ico:'📲', name:'Show QR',       desc:'Download app on their phone now' },
  { k:'none',  ico:'🧾', name:'Receipt only',  desc:'No invite — sale record only' },
]

const OPTIN_METHODS = [
  { k:'mi',    ico:'📱', name:'Mi Italia app', desc:'Notification appears in her app immediately' },
  { k:'email', ico:'📧', name:'Email',          desc:'Sent to her registered Mi Italia email' },
  { k:'qr',    ico:'📲', name:'Show QR now',   desc:'She scans and accepts in-store on her phone' },
  { k:'skip',  ico:'⏭', name:'Skip for now',  desc:'Record sale only, send later automatically' },
]

function ModalShell({ children, onClose, title, em, sub }) {
  return (
    <>
      <div onClick={onClose} className="modal-overlay-blur" />
      <div className="modal-large clm-modal">
        <div className="modal-large-hdr clm-hdr">
          <div>
            <div className="modal-large-title">{title} <em className="modal-em-gold">{em}</em></div>
            {sub && <div className="clm-sub">{sub}</div>}
          </div>
          <button onClick={onClose} className="modal-large-close">✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

function ClmAlert({ type = 'info', icon, children }) {
  return (
    <div className={`clm-alert clm-alert-${type}`}>
      <span className="clm-alert-icon">{icon}</span>
      <div>{children}</div>
    </div>
  )
}

export default function CustomerLookupModal({ onAttach, onClose }) {
  const { t } = useTranslation()

  const [tab, setTab]                   = useState('crm')
  const [query, setQuery]               = useState('')
  const [results, setResults]           = useState([])
  const [loading, setLoading]           = useState(false)
  const [selected, setSelected]         = useState(null)
  const [qrScanned, setQrScanned]       = useState(false)
  const [phase, setPhase]               = useState('search')
  const [inviteMethod, setInviteMethod] = useState('email')
  const [optinMethod, setOptinMethod]   = useState('mi')
  const [walkinFirst, setWalkinFirst]   = useState('')
  const [walkinLast, setWalkinLast]     = useState('')
  const [walkinEmail, setWalkinEmail]   = useState('')
  const [walkinPhone, setWalkinPhone]   = useState('')
  const [walkinLang, setWalkinLang]     = useState('🇮🇹 Italian')
  const [consentEmail, setConsentEmail] = useState(true)
  const [consentWa, setConsentWa]       = useState(false)
  const [consentPush, setConsentPush]   = useState(true)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSelected(null); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      apiFetch(`${API}/boutique/pos/customers/lookup?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(res => { if (res.success) setResults(res.data.results ?? []) })
        .catch(() => {})
        .finally(() => setLoading(false))
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const crmResults = results.filter(r => r.source === 'crm' || r.boutique_customer_id)
  const miResults  = results.filter(r => r.source === 'new_mi_italia' && !r.boutique_customer_id)

  const TABS = [
    { k:'crm',    label:t('clm.tabs.crm') },
    { k:'mi',     label:t('clm.tabs.mi') },
    { k:'qr',     label:t('clm.tabs.qr') },
    { k:'walkin', label:t('clm.tabs.walkin') },
  ]

  function handleAttachCrm(c) {
    if (!c) return
    onAttach({ name:c.name, email:c.email, phone:c.phone, mi_italia_user_id:c.mi_italia_user_id, boutique_customer_id:c.boutique_customer_id, tier:c.platform_profile?.tier, points:c.platform_profile?.points_balance, wallet:c.platform_profile?.wallet_balance, photo:c.profile_photo_url, tag:'CRM Contact', key:'crm' })
    onClose()
  }

  function handleAttachMi()    { setPhase('optin') }
  function handleSendOptin()   { setPhase('success') }
  function handleAttachQr()    { onAttach({ name:'Marco Rossi', seg:'loyal', tag:'Mi Italia', key:'returning' }); onClose() }
  function handleCreateWalkin(){ if (!walkinFirst.trim()) return; onAttach({ name:`${walkinFirst} ${walkinLast}`.trim(), seg:'new', tag:'Walk-in', key:'walkin' }); onClose() }

  const searchBar = (
    <div className="clm-search-bar">
      <span className="clm-search-emoji">🔍</span>
      <input value={query} onChange={e => setQuery(e.target.value)} className="input-bare"
        placeholder={tab === 'crm' ? t('clm.search_crm') : t('clm.search_mi')} />
    </div>
  )

  // ── Success phase ──
  if (phase === 'success') {
    return (
      <ModalShell onClose={onClose}>
        <div className="clm-success-body">
          <div className="modal-success-emoji">✅</div>
          <div className="clm-success-title">Valentina <em className="modal-em-gold">Attached</em></div>
          <div className="clm-success-sub">{t('clm.success.sub')}</div>
          <div className="clm-permissions-card">
            <div className="clm-permissions-lbl">{t('clm.success.can_do')}</div>
            {[
              { ico:'✓', ok:true,  text:t('clm.success.perm.receipt') },
              { ico:'✓', ok:true,  text:t('clm.success.perm.record') },
              { ico:'✓', ok:true,  text:t('clm.success.perm.loyalty') },
              { ico:'⏳', ok:false, text:t('clm.success.perm.email') },
              { ico:'⏳', ok:false, text:t('clm.success.perm.wa') },
              { ico:'⏳', ok:false, text:t('clm.success.perm.push') },
            ].map((r, i) => (
              <div key={i} className={`clm-perm-row${r.ok ? ' ok' : ' pending'}`}>
                <span>{r.ico}</span><span>{r.text}</span>
              </div>
            ))}
          </div>
          <button className="btn clm-back-btn" onClick={() => { onAttach({ name:selected?.name, email:selected?.email, phone:selected?.phone, mi_italia_user_id:selected?.mi_italia_user_id, tag:'Mi Italia', key:'new' }); onClose() }}>
            ← {t('clm.success.back_pos')}
          </button>
        </div>
      </ModalShell>
    )
  }

  // ── Opt-in phase ──
  if (phase === 'optin') {
    return (
      <ModalShell onClose={onClose} title={t('clm.optin.title')} em={t('clm.optin.title_em')} sub={t('clm.optin.sub')}>
        <div className="modal-large-body">
          <ClmAlert type="green" icon="✅"><strong>{selected?.name} {t('clm.optin.attached')}</strong> {t('clm.optin.attached_desc')}</ClmAlert>

          <div className="inner-card-sm clm-optin-profile">
            {selected?.profile_photo_url
              ? <div className="clm-optin-av clm-optin-av-photo" style={{ backgroundImage:`url('${selected.profile_photo_url.startsWith('http') ? selected.profile_photo_url : API + selected.profile_photo_url}')` }} />
              : <div className="clm-optin-av clm-optin-av-initial">{selected?.name?.[0]?.toUpperCase()}</div>
            }
            <div>
              <div className="clm-optin-name">{selected?.name}</div>
              <div className="clm-optin-meta">Mi Italia user · {selected?.email}</div>
            </div>
          </div>

          <div className="clm-optin-section-lbl">{t('clm.optin.how_to_send')}</div>
          <div className="clm-method-grid">
            {OPTIN_METHODS.map(m => (
              <div key={m.k} onClick={() => setOptinMethod(m.k)} className={`clm-method-card${optinMethod===m.k?' sel':''}`}>
                <div className="clm-method-ico">{m.ico}</div>
                <div className="clm-method-name">{m.name}</div>
                <div className="clm-method-desc">{m.desc}</div>
              </div>
            ))}
          </div>

          <div className="clm-optin-section-lbl">{t('clm.optin.covers')}</div>
          {[
            { k:'email', on:consentEmail, set:setConsentEmail, label:t('clm.optin.email_label'), desc:t('clm.optin.email_desc'), chip:'📧 Email',    chipBg:'rgba(99,91,255,.08)',  chipColor:'var(--stripe)' },
            { k:'wa',    on:consentWa,    set:setConsentWa,    label:t('clm.optin.wa_label'),    desc:t('clm.optin.wa_desc'),    chip:'💬 WhatsApp',chipBg:'rgba(37,211,102,.1)', chipColor:'#1a9e4d' },
            { k:'push',  on:consentPush,  set:setConsentPush,  label:t('clm.optin.push_label'),  desc:t('clm.optin.push_desc'),  chip:'🔔 Push',    chipBg:'rgba(184,149,90,.1)', chipColor:'#8A6A30' },
          ].map(c => (
            <div key={c.k} onClick={() => c.set(v => !v)} className={`clm-consent-row${c.on?' sel':''}`}>
              <input type="checkbox" checked={c.on} onChange={() => {}} className="clm-consent-check" />
              <div>
                <div className="clm-consent-label">{c.label}</div>
                <div className="clm-consent-desc">{c.desc}</div>
                <div className="clm-consent-chip-wrap">
                  <span className="clm-consent-chip" style={{ background:c.chipBg, color:c.chipColor }}>{c.chip}</span>
                </div>
              </div>
            </div>
          ))}
          <ClmAlert type="gdpr" icon="🔒">{selected?.name?.split(' ')[0] || 'This customer'} {t('clm.optin.gdpr_note')}</ClmAlert>
        </div>
        <div className="modal-large-footer">
          <button onClick={() => setPhase('search')} className="btn btn-outline modal-large-cancel">← {t('common.back')}</button>
          <button onClick={handleSendOptin} className="btn btn-primary modal-large-submit">{t('clm.optin.send_btn')}</button>
        </div>
      </ModalShell>
    )
  }

  // ── Main search phase ──
  const subTexts = {
    crm:    t('clm.sub.crm'),
    mi:     t('clm.sub.mi'),
    qr:     t('clm.sub.qr'),
    walkin: t('clm.sub.walkin'),
  }

  return (
    <ModalShell onClose={onClose} title={t('clm.title')} em={t('clm.title_em')} sub={subTexts[tab]}>

      {/* Tabs */}
      <div className="clm-tabs">
        {TABS.map(tb => (
          <div key={tb.k} onClick={() => { setTab(tb.k); setQuery('') }} className={`clm-tab${tab===tb.k?' act':''}`}>
            {tb.label}
          </div>
        ))}
      </div>

      {/* ── CRM tab ── */}
      {tab === 'crm' && (
        <>
          {searchBar}
          <div className="modal-large-body clm-results">
            {loading && <div className="state-loading">{t('clm.searching')}</div>}
            {!loading && query && <div className="clm-result-count">{crmResults.length} {t('clm.results')}</div>}
            {!loading && !query && <div className="state-empty-sm">{t('clm.type_to_search')}</div>}
            {crmResults.map(c => (
              <div key={c.mi_italia_user_id || c.boutique_customer_id}
                onClick={() => setSelected(c)}
                className={`clm-result-row${selected===c?' sel':''}`}>
                {c.profile_photo_url
                  ? <div className="clm-result-av clm-result-av-photo" style={{ backgroundImage:`url('${API}${c.profile_photo_url}')` }} />
                  : <div className="clm-result-av clm-result-av-initial">{c.name?.[0]}</div>
                }
                <div className="clm-result-body">
                  <div className="clm-result-name">{c.name}</div>
                  <div className="clm-result-meta">{c.email} · {c.phone}</div>
                </div>
                <div className="clm-crm-badge">✓ {t('clm.crm_contact')}</div>
              </div>
            ))}
            <ClmAlert type="info" icon="ℹ">{t('clm.crm_info')}</ClmAlert>
          </div>
          <div className="modal-large-footer">
            <button onClick={onClose} className="btn btn-outline modal-large-cancel">{t('common.cancel')}</button>
            <button onClick={() => selected && handleAttachCrm(selected)} disabled={!selected}
              className={`btn btn-primary modal-large-submit${!selected?' clm-disabled':''}`}>
              {selected ? `${t('clm.attach')} ${selected.name?.split(' ')[0]}` : t('clm.select_customer')}
            </button>
          </div>
        </>
      )}

      {/* ── Mi Italia tab ── */}
      {tab === 'mi' && (
        <>
          {searchBar}
          <div className="modal-large-body clm-results">
            {loading && <div className="state-loading">{t('clm.searching')}</div>}
            {!loading && !query && <div className="state-empty-sm">{t('clm.type_to_search')}</div>}
            {!loading && query && miResults.length === 0 && <div className="state-loading">{t('clm.no_mi_results')}</div>}
            {!loading && query && miResults.length > 0 && (
              <div className="clm-result-count">{miResults.length} Mi Italia {t('clm.user')}{miResults.length !== 1 ? 's' : ''}</div>
            )}
            {miResults.map(c => (
              <div key={c.mi_italia_user_id}
                onClick={() => setSelected(prev => prev?.mi_italia_user_id === c.mi_italia_user_id ? null : c)}
                className={`clm-mi-card${selected?.mi_italia_user_id===c.mi_italia_user_id?' sel':''}`}>
                <div className="clm-mi-card-hdr">
                  {c.profile_photo_url
                    ? <div className="clm-mi-card-av clm-mi-card-av-photo" style={{ backgroundImage:`url('${c.profile_photo_url.startsWith('http') ? c.profile_photo_url : API + c.profile_photo_url}')` }} />
                    : <div className="clm-mi-card-av clm-mi-card-av-initial">{c.name?.[0]?.toUpperCase()}</div>
                  }
                  <div className="clm-mi-card-info">
                    <div className="clm-mi-card-name">{c.name}</div>
                    <div className="clm-mi-verified">✓ {t('clm.verified_mi')}</div>
                  </div>
                  {selected?.mi_italia_user_id === c.mi_italia_user_id && <span className="clm-mi-check">✓</span>}
                </div>
                <div className="clm-mi-card-body">
                  {[
                    { lbl:t('clm.mi_fields.email'),   val:c.email },
                    { lbl:t('clm.mi_fields.phone'),   val:c.phone || t('clm.mi_fields.after_optin'), muted:!c.phone },
                    { lbl:t('clm.mi_fields.tier'),    val:c.platform_profile?.tier || '—' },
                    { lbl:t('clm.mi_fields.points'),  val:c.platform_profile?.points_balance ?? 0 },
                    { lbl:t('clm.mi_fields.wallet'),  val:`€${c.platform_profile?.wallet_balance ?? '0.00'}` },
                    { lbl:t('clm.mi_fields.crm'),     val:c.boutique_customer_id ? t('clm.mi_fields.existing') : t('clm.mi_fields.not_yet'), muted:!c.boutique_customer_id },
                  ].map(r => (
                    <div key={r.lbl} className="clm-mi-field-row">
                      <span className="clm-mi-field-lbl">{r.lbl}</span>
                      <span className={`clm-mi-field-val${r.muted?' muted':''}`}>{r.val}</span>
                    </div>
                  ))}
                </div>
                <div className="clm-mi-gdpr-note">{t('clm.mi_gdpr')}</div>
              </div>
            ))}
            {miResults.length > 0 && <ClmAlert type="gdpr" icon="🔒">{t('clm.mi_gdpr_footer')}</ClmAlert>}
          </div>
          <div className="modal-large-footer">
            <button onClick={onClose} className="btn btn-outline modal-large-cancel">{t('common.cancel')}</button>
            <button onClick={selected ? handleAttachMi : null} disabled={!selected}
              className={`btn btn-primary modal-large-submit${!selected?' clm-disabled':''}`}>
              {selected ? `${t('clm.attach')} ${selected.name?.split(' ')[0]} + ${t('clm.send_optin')} →` : t('clm.select_customer')}
            </button>
          </div>
        </>
      )}

      {/* ── QR tab ── */}
      {tab === 'qr' && (
        <>
          <div className="modal-large-body">
            <div className="clm-qr-box">
              <div className="clm-qr-instruction">{t('clm.qr.instruction')}</div>
              <div className="clm-qr-viewfinder">
                {['tl','tr','bl','br'].map(c => <div key={c} className={`clm-qr-corner clm-qr-${c}`} />)}
                {!qrScanned && <div className="clm-qr-scanline" />}
                <span className="clm-qr-placeholder">{qrScanned ? '✅' : '⬛'}</span>
              </div>
              <div className="clm-qr-hint">{t('clm.qr.hint')}</div>
              {!qrScanned && (
                <button onClick={() => setQrScanned(true)} className="clm-qr-sim-btn">{t('clm.qr.simulate')}</button>
              )}
            </div>
            {qrScanned && (
              <div className="clm-qr-resolved">
                <div className="clm-qr-resolved-av">M</div>
                <div>
                  <div className="clm-qr-resolved-name">Marco Rossi</div>
                  <div className="clm-qr-resolved-status">✓ Verified · ♻ Loyal · 5 {t('clm.qr.purchases')}</div>
                </div>
                <div className="clm-qr-matched">Matched ✓</div>
              </div>
            )}
            {!qrScanned ? (
              <>
                <ClmAlert type="green" icon="⚡">{t('clm.qr.why_fast')}</ClmAlert>
                <div className="clm-qr-reasons-title">{t('clm.qr.why_preferred')}</div>
                {[t('clm.qr.r1'),t('clm.qr.r2'),t('clm.qr.r3'),t('clm.qr.r4'),t('clm.qr.r5')].map(reason => (
                  <div key={reason} className="clm-qr-reason"><span className="clm-qr-reason-check">✓</span>{reason}</div>
                ))}
              </>
            ) : (
              <>
                <ClmAlert type="green" icon="✅"><strong>{t('clm.qr.matched')}</strong> {t('clm.qr.matched_desc')}</ClmAlert>
                <div className="inner-card-sm">
                  <div className="clm-consent-status-lbl">{t('clm.qr.consent_status')}</div>
                  {[{ch:'📧 Email',on:true},{ch:'💬 WhatsApp',on:false},{ch:'🔔 Push',on:true}].map(r => (
                    <div key={r.ch} className="clm-consent-status-row">
                      <span>{r.ch}</span>
                      <span className={r.on ? 'clm-consent-on' : 'clm-consent-off'}>{r.on ? `✓ ${t('clm.qr.opted_in')}` : `✗ ${t('clm.qr.not_opted')}`}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="modal-large-footer">
            <button onClick={onClose} className="btn btn-outline modal-large-cancel">{t('common.cancel')}</button>
            <button onClick={qrScanned ? handleAttachQr : null} disabled={!qrScanned}
              className={`btn btn-primary modal-large-submit${!qrScanned?' clm-disabled':''}`}>
              {qrScanned ? `${t('clm.attach')} Marco Rossi ✓` : t('clm.qr.scan_first')}
            </button>
          </div>
          <style>{`@keyframes scan{0%{top:20%;opacity:0;}10%{opacity:1;}90%{opacity:1;}100%{top:80%;opacity:0;}}`}</style>
        </>
      )}

      {/* ── Walk-in tab ── */}
      {tab === 'walkin' && (
        <>
          <div className="modal-large-body">
            <ClmAlert type="info" icon="ℹ">{t('clm.walkin.info')}</ClmAlert>
            <div className="form-row2">
              <div>
                <label className="clm-field-lbl">{t('clm.walkin.first_name')}</label>
                <input value={walkinFirst} onChange={e => setWalkinFirst(e.target.value)} className="form-input" placeholder="Elena" />
              </div>
              <div>
                <label className="clm-field-lbl">{t('clm.walkin.last_name')}</label>
                <input value={walkinLast} onChange={e => setWalkinLast(e.target.value)} className="form-input" placeholder="Conti" />
              </div>
            </div>
            <div className="clm-walkin-field">
              <label className="clm-field-lbl">{t('clm.walkin.email')}</label>
              <input value={walkinEmail} onChange={e => setWalkinEmail(e.target.value)} className="form-input" type="email" placeholder="elena@example.com" />
              <div className="clm-field-hint">{t('clm.walkin.email_hint')}</div>
            </div>
            <div className="clm-walkin-field">
              <label className="clm-field-lbl">{t('clm.walkin.phone')}</label>
              <input value={walkinPhone} onChange={e => setWalkinPhone(e.target.value)} className="form-input" type="tel" placeholder="+39 333 000 0000" />
              <div className="clm-field-hint">{t('clm.walkin.phone_hint')}</div>
            </div>
            <div className="clm-walkin-field">
              <label className="clm-field-lbl">{t('clm.walkin.language')}</label>
              <select value={walkinLang} onChange={e => setWalkinLang(e.target.value)} className="form-input">
                {['🇮🇹 Italian','🇬🇧 English','🇫🇷 French','🇩🇪 German','🇸🇦 Arabic','🇨🇳 Mandarin','🇯🇵 Japanese'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="detail-divider" />
            <div className="clm-invite-lbl">{t('clm.walkin.invite_title')}</div>
            <div className="clm-method-grid">
              {INVITE_METHODS.map(m => (
                <div key={m.k} onClick={() => setInviteMethod(m.k)} className={`clm-method-card${inviteMethod===m.k?' sel':''}`}>
                  <div className="clm-method-ico">{m.ico}</div>
                  <div className="clm-method-name">{m.name}</div>
                  <div className="clm-method-desc">{m.desc}</div>
                </div>
              ))}
            </div>
            <ClmAlert type="gdpr" icon="🔒">{t('clm.walkin.gdpr')}</ClmAlert>
          </div>
          <div className="modal-large-footer">
            <button onClick={onClose} className="btn btn-outline modal-large-cancel">{t('common.cancel')}</button>
            <button onClick={handleCreateWalkin} disabled={!walkinFirst.trim()}
              className={`btn btn-primary modal-large-submit${!walkinFirst.trim()?' clm-disabled':''}`}>
              {t('clm.walkin.create_btn')}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}
