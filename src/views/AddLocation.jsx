import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { apiFetch } from '../lib/api'

const API = import.meta.env.VITE_API_URL

const LOC_TYPE_KEY = 'locations.type.'
const COUNTRY_KEY  = 'locations.country.'
const ROLE_KEY     = 'locations.role.'

const STEP_KEYS = ['basic', 'catalogue', 'channels', 'terminals', 'team', 'policies', 'review']
const MAX_STEP = STEP_KEYS.length

/* Country and type names were fixed English strings in these dropdowns, so an
   Italian boutique picked "Italy" from a list that should read "Italia". The
   `label` is now only the fallback used until the bundle carries the key.
   The type keys are the same `locations.type.*` the Locations screen uses, so
   a type reads identically wherever it appears. */
const COUNTRIES = [
  { code: 'IT', key: 'it', label: 'Italy' },
  { code: 'FR', key: 'fr', label: 'France' },
  { code: 'UK', key: 'uk', label: 'UK' },
  { code: 'AE', key: 'ae', label: 'UAE' },
]

const LOCATION_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'flagship', label: 'Flagship' },
  { value: 'popup',    label: 'Pop-up' },
  { value: 'outlet',   label: 'Outlet' },
]

function shortName(name) { return (name ?? '').replace(/^[^—]+—\s*/, '') }

function Callout({ icon = 'info', children }) {
  return (
    <div className="alert locwiz-callout">
      <span className="material-symbols-outlined">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function OptionCard({ selected, onClick, title, recommended, desc, children }) {
  return (
    <div className={`locwiz-opt-card${selected ? ' sel' : ''}`} onClick={onClick}>
      <div className="radio" />
      <div style={{ flex: 1 }}>
        <div className="oc-t">{title}{recommended && <span className="rec">{recommended}</span>}</div>
        {desc && <div className="oc-d">{desc}</div>}
        {children}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
export default function AddLocation() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [maxVisited, setMaxVisited] = useState(1)
  const [basicError, setBasicError] = useState(null)

  const [form, setForm] = useState({
    name: '', sign: '', address: '', city: '', postcode: '', country: 'IT', type: 'standard',
    phone: '', email: '', monSat: '10:00-19:30', sun: '11:00-18:00',
    catalogue: 'share', copySource: '',
    channel: 'shopify',
    terminalMode: 'now', terminalName: 'Cassa 1', terminalType: 'Stripe Terminal',
    returns: 'inherit', vatRate: '22',
  })

  const [existingLocations, setExistingLocations] = useState([])
  const [staffList, setStaffList] = useState([])
  const [assigned, setAssigned] = useState({})
  const [manager, setManager] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteDraft, setInviteDraft] = useState({ first: '', last: '', email: '', role: 'staff' })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)

  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState(null)
  const [created, setCreated] = useState(null)

  useEffect(() => {
    apiFetch(`${API}/boutique/locations`).then(r => r.json())
      .then(res => { if (res?.success) setExistingLocations(res.data?.locations ?? []) })
      .catch(err => console.error('[AddLocation] fetchLocations', err))
    apiFetch(`${API}/boutique/locations/staff`).then(r => r.json())
      .then(res => { if (res?.success) setStaffList(res.data?.staff ?? []) })
      .catch(err => console.error('[AddLocation] fetchStaff', err))
  }, [])

  const STEPS = [
    t('locations.wizard.step.basic'),
    t('locations.wizard.step.catalogue'),
    t('locations.wizard.step.channels'),
    t('locations.wizard.step.terminals'),
    t('locations.wizard.step.team'),
    t('locations.wizard.step.policies'),
    t('locations.wizard.step.review'),
  ]

  function setField(key, value) { setForm(f => ({ ...f, [key]: value })) }
  function pick(key, value) { setForm(f => ({ ...f, [key]: value })) }

  function goStep(n) { if (n <= maxVisited || n < step) { setStep(n); window.scrollTo(0, 0) } }
  function next() {
    if (step === 1) {
      if (!form.name.trim() || !form.city.trim()) {
        setBasicError(t('locations.wizard.basic_required'))
        return
      }
      if (form.phone && !isValidPhoneNumber(form.phone)) {
        setBasicError(t('locations.wizard.invalid_phone'))
        return
      }
    }
    setBasicError(null)
    if (step < MAX_STEP) { const n = step + 1; setStep(n); setMaxVisited(m => Math.max(m, n)); window.scrollTo(0, 0) }
  }
  function prev() { if (step > 1) { setStep(step - 1); window.scrollTo(0, 0) } }

  function toggleAssign(id) { setAssigned(a => ({ ...a, [id]: !a[id] })) }
  function openInvite() { setInviteOpen(true); setInviteError(null) }
  function cancelInvite() { setInviteOpen(false); setInviteDraft({ first: '', last: '', email: '', role: 'staff' }); setInviteError(null) }

  async function sendInvite() {
    const first = inviteDraft.first.trim(), last = inviteDraft.last.trim(), email = inviteDraft.email.trim()
    if (!first || !email) { setInviteError(t('locations.wizard.invite_missing')); return }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setInviteError(t('locations.wizard.invite_invalid_email')); return }
    setInviting(true); setInviteError(null)
    try {
      const fullName = `${first} ${last}`.trim()
      const res = await apiFetch(`${API}/boutique/staff/invite`, {
        method: 'POST',
        body: JSON.stringify({ email, name: fullName, role: inviteDraft.role }),
      }).then(r => r.json())
      if (!res?.success) { setInviteError(res?.message ?? t('locations.err.invite')); return }
      const newStaff = { id: res.data?.id, name: fullName, role: inviteDraft.role, email, locations: [], pending: true }
      setStaffList(list => [...list, newStaff])
      if (newStaff.id) setAssigned(a => ({ ...a, [newStaff.id]: true }))
      setInviteOpen(false)
      setInviteDraft({ first: '', last: '', email: '', role: 'staff' })
    } catch (err) {
      console.error('[AddLocation] sendInvite failed', err); setInviteError(t('common.error_network'))
    } finally { setInviting(false) }
  }

  async function activate() {
    if (activating) return
    setActivating(true); setActivateError(null)
    try {
      const res = await apiFetch(`${API}/boutique/locations`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, type: form.type,
          addressLine1: form.address, city: form.city, postcode: form.postcode, country: form.country,
          phone: form.phone || null, email: form.email || null,
          openingHours: { mon_sat: form.monSat, sun: form.sun },
          miItaliaListingName: form.sign || form.name,
        }),
      }).then(r => r.json())

      if (!res?.success) { setActivateError(res?.message ?? t('locations.err.create')); return }

      const newId = res.data?.id ?? res.data?.location?.id
      const assignedIds = Object.entries(assigned).filter(([, on]) => on).map(([id]) => id)
      if (newId && assignedIds.length > 0) {
        await Promise.all(assignedIds.map(id => {
          const staffMember = staffList.find(s => s.id === id)
          const currentIds = (staffMember?.locations ?? []).map(l => (typeof l === 'string' ? l : l.id))
          const locationIds = Array.from(new Set([...currentIds, newId]))
          return apiFetch(`${API}/boutique/locations/staff/${id}`, {
            method: 'PUT', body: JSON.stringify({ locationIds }),
          }).then(r => r.json()).catch(err => console.error('[AddLocation] staff assign failed', id, err))
        }))
      }
      setCreated({ name: form.name, city: form.city })
    } catch (err) {
      console.error('[AddLocation] activate failed', err); setActivateError('Network error')
    } finally { setActivating(false) }
  }

  function restart() {
    setStep(1); setMaxVisited(1); setBasicError(null); setCreated(null)
    setForm({
      name: '', sign: '', address: '', city: '', postcode: '', country: 'IT', type: 'standard',
      phone: '', email: '', monSat: '10:00-19:30', sun: '11:00-18:00',
      catalogue: 'share', copySource: '', channel: 'shopify',
      terminalMode: 'now', terminalName: 'Cassa 1', terminalType: 'Stripe Terminal',
      returns: 'inherit', vatRate: '22',
    })
    setAssigned({}); setManager('')
  }

  if (created) {
    return (
      <div className="card locwiz-success">
        <div className="seal"><span className="material-symbols-outlined">check</span></div>
        <h2>{t('locations.wizard.success_title')}</h2>
        <p>
          {t('locations.wizard.success_body')
            .replace('{{name}}', created.name || t('locations.wizard.unnamed'))}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={restart}>{t('locations.wizard.add_another')}</button>
          <button className="btn btn-primary" onClick={() => navigate('/locations')}>{t('locations.wizard.go_to_locations')}</button>
          {form.channel === 'shopify' && (
            <button className="btn btn-outline" onClick={() => navigate('/integrations')}>
              <span className="material-symbols-outlined">link</span>{t('locations.wizard.go_to_integrations')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="locwiz-shell">
      <aside>
        <div className="locwiz-rail">
          {STEPS.map((label, i) => {
            const n = i + 1
            const cls = `locwiz-rail-step${n === step ? ' active' : ''}${n < step ? ' done' : ''}`
            return (
              <div key={label} className={cls} onClick={() => goStep(n)}>
                <div className="no">{n < step ? <span className="material-symbols-outlined">check</span> : n}</div>
                <div className="lbl">{label}</div>
              </div>
            )
          })}
        </div>
      </aside>

      <section className="card locwiz-panel">
        {step === 1 && <StepBasic form={form} setField={setField} t={t} error={basicError} existingLocations={existingLocations} />}
        {step === 2 && <StepCatalogue form={form} pick={pick} existingLocations={existingLocations} t={t} />}
        {step === 3 && <StepChannels form={form} pick={pick} t={t} />}
        {step === 4 && <StepTerminals form={form} pick={pick} setField={setField} t={t} />}
        {step === 5 && (
          <StepTeam
            t={t} staffList={staffList} assigned={assigned} toggleAssign={toggleAssign}
            manager={manager} setManager={setManager}
            inviteOpen={inviteOpen} inviteDraft={inviteDraft} setInviteDraft={setInviteDraft}
            openInvite={openInvite} cancelInvite={cancelInvite} sendInvite={sendInvite}
            inviting={inviting} inviteError={inviteError}
          />
        )}
        {step === 6 && <StepPolicies form={form} pick={pick} setField={setField} t={t} />}
        {step === 7 && (
          <StepReview
            t={t} form={form} staffList={staffList} assigned={assigned} manager={manager}
            goStep={goStep} existingLocations={existingLocations}
          />
        )}

        {activateError && <div className="alert locwiz-error">{activateError}</div>}

        <div className="locwiz-nav-row">
          {step > 1 ? <button className="btn btn-outline" onClick={prev}>{t('common.back')}</button> : <span />}
          {step < MAX_STEP ? (
            <button className="btn btn-primary" onClick={next}>
              {t('locations.wizard.continue')}<span className="material-symbols-outlined">arrow_forward</span>
            </button>
          ) : (
            <button className="btn btn-primary" onClick={activate} disabled={activating}>
              <span className="material-symbols-outlined">add_business</span>
              {activating ? t('locations.wizard.activating') + '…' : t('locations.wizard.activate')}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

// ── Step panels ──────────────────────────────────────────────────────────

function PanelHead({ n, label, title, lead }) {
  return (
    <>
      <div className="locwiz-eyebrow">Step {n} of {MAX_STEP} · {label}</div>
      <h2>{title}</h2>
      <div className="locwiz-keyline" />
      <div className="locwiz-lead">{lead}</div>
    </>
  )
}

function StepBasic({ form, setField, t, error }) {
  return (
    <>
      <PanelHead n={1} label={t('locations.wizard.step.basic')}
        title={t('locations.wizard.basic_title')}
        lead={t('locations.wizard.basic_lead')} />
      <div className="form-group"><label className="form-lbl">{t('locations.wizard.loc_name')}</label>
        <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder={t('locations.wizard.ph_loc_name')} /></div>
      <div className="form-group"><label className="form-lbl">{t('locations.wizard.sign')}</label>
        <input className="form-input" value={form.sign} onChange={e => setField('sign', e.target.value)} placeholder={t('locations.wizard.ph_listing')} /></div>
      <div className="form-group"><label className="form-lbl">{t('locations.wizard.address')}</label>
        <input className="form-input" value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Via Tornabuoni 5" /></div>
      <div className="grid3">
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.city')}</label>
          <input className="form-input" value={form.city} onChange={e => setField('city', e.target.value)} placeholder="Firenze" /></div>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.postcode')}</label>
          <input className="form-input" value={form.postcode} onChange={e => setField('postcode', e.target.value)} placeholder="50123" /></div>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.type')}</label>
          <select className="form-select" value={form.type} onChange={e => setField('type', e.target.value)}>
            {LOCATION_TYPES.map(o => <option key={o.value} value={o.value}>{t(LOC_TYPE_KEY + o.value, { defaultValue: o.label })}</option>)}
          </select></div>
      </div>
      <div className="grid2">
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.country')}</label>
          <select className="form-select" value={form.country} onChange={e => setField('country', e.target.value)}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{t(COUNTRY_KEY + c.key, { defaultValue: c.label })}</option>)}
          </select></div>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.phone')}</label>
          <PhoneInput
            international
            defaultCountry={form.country || 'IT'}
            value={form.phone}
            onChange={v => setField('phone', v || '')}
            className="sp-phone-input"
          />
          {form.phone && !isValidPhoneNumber(form.phone) && (
            <div className="form-hint sp-phone-hint-invalid">
              {t('locations.wizard.invalid_phone')}
            </div>
          )}
        </div>
      </div>
      <div className="form-group"><label className="form-lbl">{t('locations.wizard.email')}</label>
        <input className="form-input" type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="firenze@sartoriabelloni.it" /></div>
      <div className="grid2">
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.mon_sat')}</label>
          <input className="form-input" value={form.monSat} onChange={e => setField('monSat', e.target.value)} placeholder="10:00-19:30" /></div>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.sun')}</label>
          <input className="form-input" value={form.sun} onChange={e => setField('sun', e.target.value)} placeholder={t('locations.hours.sun_ph')} /></div>
      </div>
      <div className="form-group"><label className="form-lbl">{t('locations.wizard.timezone')}</label>
        <input className="form-input" value="Europe/Rome" readOnly /></div>
      {error && <div className="alert locwiz-error">{error}</div>}
    </>
  )
}

function StepCatalogue({ form, pick, existingLocations, t }) {
  return (
    <>
      <PanelHead n={2} label={t('locations.wizard.step.catalogue')}
        title={t('locations.wizard.catalogue_title')}
        lead={t('locations.wizard.catalogue_lead')} />
      <OptionCard selected={form.catalogue === 'share'} onClick={() => pick('catalogue', 'share')}
        title={t('locations.wizard.catalogue_share')} recommended={t('locations.wizard.recommended')}
        desc={t('locations.wizard.catalogue_share_desc')} />
      <OptionCard selected={form.catalogue === 'copy'} onClick={() => pick('catalogue', 'copy')}
        title={t('locations.wizard.catalogue_copy')}
        desc={t('locations.wizard.catalogue_copy_desc')}>
        {form.catalogue === 'copy' && (
          <div className="locwiz-sub-field">
            <select className="form-select" value={form.copySource} onChange={e => { e.stopPropagation(); pick('copySource', e.target.value) }} onClick={e => e.stopPropagation()}>
              <option value="">{t('locations.wizard.pick_location') + '…'}</option>
              {existingLocations.map(l => <option key={l.id} value={l.id}>{shortName(l.name)}</option>)}
            </select>
          </div>
        )}
      </OptionCard>
      <OptionCard selected={form.catalogue === 'empty'} onClick={() => pick('catalogue', 'empty')}
        title={t('locations.wizard.catalogue_empty')}
        desc={t('locations.wizard.catalogue_empty_desc')} />
      <Callout icon="architecture">
        <b>{t('locations.wizard.catalogue_flag_title')}</b>{' '}
        {t('locations.wizard.catalogue_flag_body')}
      </Callout>
    </>
  )
}

function StepChannels({ form, pick, t }) {
  return (
    <>
      <PanelHead n={3} label={t('locations.wizard.step.channels')}
        title={t('locations.wizard.channels_title')}
        lead={t('locations.wizard.channels_lead')} />
      <OptionCard selected={form.channel === 'shopify'} onClick={() => pick('channel', 'shopify')}
        title={t('locations.wizard.channel_shopify')}
        desc={t('locations.wizard.channel_shopify_desc')} />
      <OptionCard selected={form.channel === 'instore'} onClick={() => pick('channel', 'instore')}
        title={t('locations.wizard.channel_instore')}
        desc={t('locations.wizard.channel_instore_desc')} />
    </>
  )
}

function StepTerminals({ form, pick, setField, t }) {
  return (
    <>
      <PanelHead n={4} label={t('locations.wizard.step.terminals')}
        title={t('locations.wizard.terminals_title')}
        lead={t('locations.wizard.terminals_lead')} />
      <OptionCard selected={form.terminalMode === 'now'} onClick={() => pick('terminalMode', 'now')}
        title={t('locations.wizard.terminal_now')}>
        {form.terminalMode === 'now' && (
          <div className="locwiz-sub-field grid2" onClick={e => e.stopPropagation()}>
            <input className="form-input" value={form.terminalName} placeholder="Cassa 1" onChange={e => setField('terminalName', e.target.value)} />
            <select className="form-select" value={form.terminalType} onChange={e => setField('terminalType', e.target.value)}>
              <option>Stripe Terminal</option><option>Nexi SmartPOS</option><option>SumUp</option>
            </select>
          </div>
        )}
      </OptionCard>
      <OptionCard selected={form.terminalMode === 'later'} onClick={() => pick('terminalMode', 'later')}
        title={t('locations.wizard.terminal_later')}
        desc={t('locations.wizard.terminal_later_desc')} />
      <Callout icon="info">
        {t('locations.wizard.terminal_flag')}
      </Callout>
    </>
  )
}

function StepTeam({ t, staffList, assigned, toggleAssign, manager, setManager, inviteOpen, inviteDraft, setInviteDraft, openInvite, cancelInvite, sendInvite, inviting, inviteError }) {
  const assignedList = staffList.filter(s => assigned[s.id])
  return (
    <>
      <PanelHead n={5} label={t('locations.wizard.step.team')}
        title={t('locations.wizard.team_title')}
        lead={t('locations.wizard.team_lead')} />
      {staffList.length === 0 && <div className="state-empty">{t('locations.wizard.no_staff')}</div>}
      <div className="loc-assign-list">
        {staffList.map(s => (
          <label key={s.id} className="loc-assign-item">
            <input type="checkbox" className="loc-assign-checkbox" checked={!!assigned[s.id]} onChange={() => toggleAssign(s.id)} />
            {s.name}{s.pending && <span className="loc-primary-badge-sm">{t('locations.wizard.invited')}</span>} · {s.role}
          </label>
        ))}
      </div>

      {inviteOpen ? (
        <div className="loc-danger-zone locwiz-invite-box">
          <div className="locwiz-eyebrow" style={{ marginBottom: 12 }}>{t('locations.wizard.new_invite')}</div>
          <div className="grid2">
            <div className="form-group"><label className="form-lbl">{t('locations.wizard.first_name')}</label>
              <input className="form-input" value={inviteDraft.first} onChange={e => setInviteDraft(d => ({ ...d, first: e.target.value }))} placeholder={t('locations.wizard.ph_first')} /></div>
            <div className="form-group"><label className="form-lbl">{t('locations.wizard.last_name')}</label>
              <input className="form-input" value={inviteDraft.last} onChange={e => setInviteDraft(d => ({ ...d, last: e.target.value }))} placeholder={t('locations.wizard.ph_last')} /></div>
          </div>
          <div className="grid2">
            <div className="form-group"><label className="form-lbl">{t('locations.wizard.email')}</label>
              <input className="form-input" type="email" value={inviteDraft.email} onChange={e => setInviteDraft(d => ({ ...d, email: e.target.value }))} placeholder="nome@sartoriabelloni.it" /></div>
            <div className="form-group"><label className="form-lbl">{t('locations.wizard.role')}</label>
              <select className="form-select" value={inviteDraft.role} onChange={e => setInviteDraft(d => ({ ...d, role: e.target.value }))}>
                <option value="staff">{t(ROLE_KEY + 'staff', { defaultValue: 'Staff' })}</option><option value="manager">{t(ROLE_KEY + 'manager', { defaultValue: 'Manager' })}</option>
              </select></div>
          </div>
          {inviteError && <div className="alert locwiz-error">{inviteError}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={sendInvite} disabled={inviting}>
              <span className="material-symbols-outlined">send</span>{inviting ? t('locations.wizard.sending') + '…' : t('locations.wizard.send_invite')}
            </button>
            <button className="btn btn-outline btn-sm" onClick={cancelInvite}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost" style={{ paddingLeft: 0, marginTop: 6 }} onClick={openInvite}>
          <span className="material-symbols-outlined">person_add</span>{t('locations.wizard.invite_new')}
        </button>
      )}

      <div className="form-group" style={{ marginTop: 16 }}>
        <label className="form-lbl">{t('locations.wizard.manager')}</label>
        <select className="form-select" value={manager} onChange={e => setManager(e.target.value)}>
          <option value="">{t('locations.wizard.no_manager')}</option>
          {assignedList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="form-hint">{t('locations.wizard.manager_hint')}</div>
      </div>
    </>
  )
}

function StepPolicies({ form, pick, setField, t }) {
  return (
    <>
      <PanelHead n={6} label={t('locations.wizard.step.policies')}
        title={t('locations.wizard.policies_title')}
        lead={t('locations.wizard.policies_lead')} />
      <OptionCard selected={form.returns === 'inherit'} onClick={() => pick('returns', 'inherit')}
        title={t('locations.wizard.returns_inherit')} recommended={t('locations.wizard.recommended')}
        desc={t('locations.wizard.returns_inherit_desc')} />
      <OptionCard selected={form.returns === 'custom'} onClick={() => pick('returns', 'custom')}
        title={t('locations.wizard.returns_custom')}
        desc={t('locations.wizard.returns_custom_desc')} />
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.vat_rate')}</label>
          <select className="form-select" value={form.vatRate} onChange={e => setField('vatRate', e.target.value)}>
            <option value="22">22% (standard)</option><option value="10">10%</option><option value="4">4%</option>
          </select></div>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.currency')}</label>
          <input className="form-input" value="EUR (€)" readOnly /></div>
      </div>
      <Callout icon="info">
        {t('locations.wizard.policies_flag')}
      </Callout>
    </>
  )
}

function StepReview({ t, form, staffList, assigned, manager, goStep, existingLocations }) {
  const catalogueLabels = {
    share: t('locations.wizard.catalogue_share'),
    copy: `${t('locations.wizard.catalogue_copy')} — ${shortName(existingLocations.find(l => l.id === form.copySource)?.name) || '—'}`,
    empty: t('locations.wizard.catalogue_empty'),
  }
  const channelLabels = {
    shopify: t('locations.wizard.channel_shopify'),
    instore: t('locations.wizard.channel_instore'),
  }
  const assignedList = staffList.filter(s => assigned[s.id])
  const managerName = staffList.find(s => s.id === manager)?.name

  const rows = [
    [t('locations.wizard.rev_location'), `${form.name || t('locations.wizard.unnamed')} · ${form.city || '—'}`, 1],
    [t('locations.wizard.rev_address'), [form.address, form.city, form.postcode].filter(Boolean).join(', ') || '—', 1],
    [t('locations.wizard.rev_catalogue'), catalogueLabels[form.catalogue], 2],
    [t('locations.wizard.rev_channel'), channelLabels[form.channel], 3],
    [t('locations.wizard.rev_terminal'), form.terminalMode === 'now' ? form.terminalName : t('locations.wizard.terminal_later'), 4],
    [t('locations.wizard.rev_team'), `${assignedList.length} ${t('locations.wizard.assigned')}${managerName ? ' · ' + t('locations.wizard.manager') + ' ' + managerName : ''}`, 5],
    [t('locations.wizard.rev_returns'), form.returns === 'inherit' ? t('locations.wizard.returns_inherit') : t('locations.wizard.returns_custom'), 6],
    [t('locations.wizard.rev_tax'), `${form.vatRate}% · EUR`, 6],
  ]

  return (
    <>
      <PanelHead n={7} label={t('locations.wizard.step.review')}
        title={t('locations.wizard.review_title')}
        lead={t('locations.wizard.review_lead')} />
      <div className="locwiz-rev-grid">
        {rows.map(([k, v, n]) => (
          <div key={k} className="locwiz-rev-row">
            <div className="k">{k}</div>
            <div className="v">{v}</div>
            <div className="ed" onClick={() => goStep(n)}>{t('common.edit')}</div>
          </div>
        ))}
      </div>
      <Callout icon="verified">
        {t('locations.wizard.review_flag')}
      </Callout>
    </>
  )
}
