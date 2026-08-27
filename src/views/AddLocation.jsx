import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'

const API = import.meta.env.VITE_API_URL

const STEP_KEYS = ['basic', 'catalogue', 'channels', 'terminals', 'team', 'policies', 'review']
const MAX_STEP = STEP_KEYS.length

const COUNTRIES = [
  { code: 'IT', label: 'Italy' },
  { code: 'FR', label: 'France' },
  { code: 'UK', label: 'UK' },
  { code: 'AE', label: 'UAE' },
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
    t('locations.wizard.step.basic', 'Basic details'),
    t('locations.wizard.step.catalogue', 'Catalogue & stock'),
    t('locations.wizard.step.channels', 'Sales channels'),
    t('locations.wizard.step.terminals', 'POS & terminals'),
    t('locations.wizard.step.team', 'Team'),
    t('locations.wizard.step.policies', 'Policies & tax'),
    t('locations.wizard.step.review', 'Review & activate'),
  ]

  function setField(key, value) { setForm(f => ({ ...f, [key]: value })) }
  function pick(key, value) { setForm(f => ({ ...f, [key]: value })) }

  function goStep(n) { if (n <= maxVisited || n < step) { setStep(n); window.scrollTo(0, 0) } }
  function next() {
    if (step === 1) {
      if (!form.name.trim() || !form.city.trim()) {
        setBasicError(t('locations.wizard.basic_required', 'Add at least a location name and city to continue.'))
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
    if (!first || !email) { setInviteError(t('locations.wizard.invite_missing', 'Add at least a first name and email.')); return }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setInviteError(t('locations.wizard.invite_invalid_email', 'Enter a valid email address.')); return }
    setInviting(true); setInviteError(null)
    try {
      const fullName = `${first} ${last}`.trim()
      const res = await apiFetch(`${API}/boutique/staff/invite`, {
        method: 'POST',
        body: JSON.stringify({ email, name: fullName, role: inviteDraft.role }),
      }).then(r => r.json())
      if (!res?.success) { setInviteError(res?.message ?? 'Failed to invite'); return }
      const newStaff = { id: res.data?.id, name: fullName, role: inviteDraft.role, email, locations: [], pending: true }
      setStaffList(list => [...list, newStaff])
      if (newStaff.id) setAssigned(a => ({ ...a, [newStaff.id]: true }))
      setInviteOpen(false)
      setInviteDraft({ first: '', last: '', email: '', role: 'staff' })
    } catch (err) {
      console.error('[AddLocation] sendInvite failed', err); setInviteError('Network error')
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

      if (!res?.success) { setActivateError(res?.message ?? 'Failed to create location'); return }

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
        <h2>{t('locations.wizard.success_title', 'Location added')}</h2>
        <p>
          {t('locations.wizard.success_body', '{{name}} is live and scoped into your boutique. Stock, staff, and reporting now include it.')
            .replace('{{name}}', created.name || t('locations.wizard.unnamed', 'The location'))}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={restart}>{t('locations.wizard.add_another', 'Add another')}</button>
          <button className="btn btn-primary" onClick={() => navigate('/locations')}>{t('locations.wizard.go_to_locations', 'Go to Locations')}</button>
          {form.channel === 'shopify' && (
            <button className="btn btn-outline" onClick={() => navigate('/integrations')}>
              <span className="material-symbols-outlined">link</span>{t('locations.wizard.go_to_integrations', 'Connect Shopify')}
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
          {step > 1 ? <button className="btn btn-outline" onClick={prev}>{t('locations.wizard.back', 'Back')}</button> : <span />}
          {step < MAX_STEP ? (
            <button className="btn btn-primary" onClick={next}>
              {t('locations.wizard.continue', 'Continue')}<span className="material-symbols-outlined">arrow_forward</span>
            </button>
          ) : (
            <button className="btn btn-primary" onClick={activate} disabled={activating}>
              <span className="material-symbols-outlined">add_business</span>
              {activating ? t('locations.wizard.activating', 'Activating…') : t('locations.wizard.activate', 'Activate location')}
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
      <PanelHead n={1} label={t('locations.wizard.step.basic', 'Basic details')}
        title={t('locations.wizard.basic_title', 'Basic details')}
        lead={t('locations.wizard.basic_lead', 'Where is this location and how should it appear on receipts and the store switcher.')} />
      <div className="form-group"><label className="form-lbl">{t('locations.wizard.loc_name', 'Location name')}</label>
        <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Sartoria Belloni Firenze" /></div>
      <div className="form-group"><label className="form-lbl">{t('locations.wizard.sign', 'Shop sign / display name')}</label>
        <input className="form-input" value={form.sign} onChange={e => setField('sign', e.target.value)} placeholder="e.g. Sartoria Belloni" /></div>
      <div className="form-group"><label className="form-lbl">{t('locations.wizard.address', 'Street address')}</label>
        <input className="form-input" value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Via Tornabuoni 5" /></div>
      <div className="grid3">
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.city', 'City')}</label>
          <input className="form-input" value={form.city} onChange={e => setField('city', e.target.value)} placeholder="Firenze" /></div>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.postcode', 'Postal code')}</label>
          <input className="form-input" value={form.postcode} onChange={e => setField('postcode', e.target.value)} placeholder="50123" /></div>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.type', 'Location type')}</label>
          <select className="form-select" value={form.type} onChange={e => setField('type', e.target.value)}>
            {LOCATION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select></div>
      </div>
      <div className="grid2">
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.country', 'Country')}</label>
          <select className="form-select" value={form.country} onChange={e => setField('country', e.target.value)}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select></div>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.phone', 'Phone')}</label>
          <input className="form-input" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+39 055 000000" /></div>
      </div>
      <div className="form-group"><label className="form-lbl">{t('locations.wizard.email', 'Email')}</label>
        <input className="form-input" type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="firenze@sartoriabelloni.it" /></div>
      <div className="grid2">
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.mon_sat', 'Mon–Sat hours')}</label>
          <input className="form-input" value={form.monSat} onChange={e => setField('monSat', e.target.value)} placeholder="10:00-19:30" /></div>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.sun', 'Sunday hours')}</label>
          <input className="form-input" value={form.sun} onChange={e => setField('sun', e.target.value)} placeholder="11:00-18:00 or Closed" /></div>
      </div>
      <div className="form-group"><label className="form-lbl">{t('locations.wizard.timezone', 'Time zone')}</label>
        <input className="form-input" value="Europe/Rome" readOnly /></div>
      {error && <div className="alert locwiz-error">{error}</div>}
    </>
  )
}

function StepCatalogue({ form, pick, existingLocations, t }) {
  return (
    <>
      <PanelHead n={2} label={t('locations.wizard.step.catalogue', 'Catalogue & stock')}
        title={t('locations.wizard.catalogue_title', 'Catalogue & stock')}
        lead={t('locations.wizard.catalogue_lead', 'How this location’s products relate to the rest of your boutique. This is the one architectural choice that shapes everything downstream.')} />
      <OptionCard selected={form.catalogue === 'share'} onClick={() => pick('catalogue', 'share')}
        title={t('locations.wizard.catalogue_share', 'Share the boutique catalogue')} recommended={t('locations.wizard.recommended', 'Recommended')}
        desc={t('locations.wizard.catalogue_share_desc', 'One product record across your boutique; stock is counted separately at each location.')} />
      <OptionCard selected={form.catalogue === 'copy'} onClick={() => pick('catalogue', 'copy')}
        title={t('locations.wizard.catalogue_copy', 'Copy from an existing location')}
        desc={t('locations.wizard.catalogue_copy_desc', 'Start from another location’s catalogue, then let this one diverge.')}>
        {form.catalogue === 'copy' && (
          <div className="locwiz-sub-field">
            <select className="form-select" value={form.copySource} onChange={e => { e.stopPropagation(); pick('copySource', e.target.value) }} onClick={e => e.stopPropagation()}>
              <option value="">{t('locations.wizard.pick_location', 'Select a location…')}</option>
              {existingLocations.map(l => <option key={l.id} value={l.id}>{shortName(l.name)}</option>)}
            </select>
          </div>
        )}
      </OptionCard>
      <OptionCard selected={form.catalogue === 'empty'} onClick={() => pick('catalogue', 'empty')}
        title={t('locations.wizard.catalogue_empty', 'Start empty')}
        desc={t('locations.wizard.catalogue_empty_desc', 'Build this location’s catalogue from scratch or import it from its own Shopify store.')} />
      <Callout icon="architecture">
        <b>{t('locations.wizard.catalogue_flag_title', 'Open decision, flagged for engineering:')}</b>{' '}
        {t('locations.wizard.catalogue_flag_body', 'a locked rule sets one Shopify store per location, so a shared master catalogue sits above the per-store mirror. This step lets you choose the model; the deep mapping of one variant to stock at many locations is Engineering’s to build — your choice here is captured but not yet wired to a backend.')}
      </Callout>
    </>
  )
}

function StepChannels({ form, pick, t }) {
  return (
    <>
      <PanelHead n={3} label={t('locations.wizard.step.channels', 'Sales channels')}
        title={t('locations.wizard.channels_title', 'Sales channels')}
        lead={t('locations.wizard.channels_lead', 'Each location can mirror its own Shopify store. Decide now, connect it from Integrations once this location is created.')} />
      <OptionCard selected={form.channel === 'shopify'} onClick={() => pick('channel', 'shopify')}
        title={t('locations.wizard.channel_shopify', 'Connect a Shopify store')}
        desc={t('locations.wizard.channel_shopify_desc', 'One Shopify store per location. After activation, you’ll be able to connect it from Integrations.')} />
      <OptionCard selected={form.channel === 'instore'} onClick={() => pick('channel', 'instore')}
        title={t('locations.wizard.channel_instore', 'In-store only for now')}
        desc={t('locations.wizard.channel_instore_desc', 'Sell at the counter today, connect online later without redoing setup.')} />
    </>
  )
}

function StepTerminals({ form, pick, setField, t }) {
  return (
    <>
      <PanelHead n={4} label={t('locations.wizard.step.terminals', 'POS & terminals')}
        title={t('locations.wizard.terminals_title', 'POS & terminals')}
        lead={t('locations.wizard.terminals_lead', 'Give the location a till now, or provision hardware later from Locations settings.')} />
      <OptionCard selected={form.terminalMode === 'now'} onClick={() => pick('terminalMode', 'now')}
        title={t('locations.wizard.terminal_now', 'Add the first terminal')}>
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
        title={t('locations.wizard.terminal_later', 'Set up later')}
        desc={t('locations.wizard.terminal_later_desc', 'Finish now and add terminals from Locations settings when the hardware arrives.')} />
      <Callout icon="info">
        {t('locations.wizard.terminal_flag', 'Terminal pairing isn’t available yet — the location will be created without a terminal; your choice here is captured but not sent anywhere until this is built.')}
      </Callout>
    </>
  )
}

function StepTeam({ t, staffList, assigned, toggleAssign, manager, setManager, inviteOpen, inviteDraft, setInviteDraft, openInvite, cancelInvite, sendInvite, inviting, inviteError }) {
  const assignedList = staffList.filter(s => assigned[s.id])
  return (
    <>
      <PanelHead n={5} label={t('locations.wizard.step.team', 'Team')}
        title={t('locations.wizard.team_title', 'Team')}
        lead={t('locations.wizard.team_lead', 'Assign existing staff to this location, invite anyone new, and name a manager.')} />
      {staffList.length === 0 && <div className="state-empty">{t('locations.wizard.no_staff', 'No staff members yet.')}</div>}
      <div className="loc-assign-list">
        {staffList.map(s => (
          <label key={s.id} className="loc-assign-item">
            <input type="checkbox" className="loc-assign-checkbox" checked={!!assigned[s.id]} onChange={() => toggleAssign(s.id)} />
            {s.name}{s.pending && <span className="loc-primary-badge-sm">{t('locations.wizard.invited', 'Invited')}</span>} · {s.role}
          </label>
        ))}
      </div>

      {inviteOpen ? (
        <div className="loc-danger-zone locwiz-invite-box">
          <div className="locwiz-eyebrow" style={{ marginBottom: 12 }}>{t('locations.wizard.new_invite', 'New invitation')}</div>
          <div className="grid2">
            <div className="form-group"><label className="form-lbl">{t('locations.wizard.first_name', 'First name')}</label>
              <input className="form-input" value={inviteDraft.first} onChange={e => setInviteDraft(d => ({ ...d, first: e.target.value }))} placeholder="e.g. Elena" /></div>
            <div className="form-group"><label className="form-lbl">{t('locations.wizard.last_name', 'Last name')}</label>
              <input className="form-input" value={inviteDraft.last} onChange={e => setInviteDraft(d => ({ ...d, last: e.target.value }))} placeholder="e.g. Conti" /></div>
          </div>
          <div className="grid2">
            <div className="form-group"><label className="form-lbl">{t('locations.wizard.email', 'Email')}</label>
              <input className="form-input" type="email" value={inviteDraft.email} onChange={e => setInviteDraft(d => ({ ...d, email: e.target.value }))} placeholder="nome@sartoriabelloni.it" /></div>
            <div className="form-group"><label className="form-lbl">{t('locations.wizard.role', 'Role')}</label>
              <select className="form-select" value={inviteDraft.role} onChange={e => setInviteDraft(d => ({ ...d, role: e.target.value }))}>
                <option value="staff">Staff</option><option value="manager">Manager</option>
              </select></div>
          </div>
          {inviteError && <div className="alert locwiz-error">{inviteError}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={sendInvite} disabled={inviting}>
              <span className="material-symbols-outlined">send</span>{inviting ? t('locations.wizard.sending', 'Sending…') : t('locations.wizard.send_invite', 'Send invite')}
            </button>
            <button className="btn btn-outline btn-sm" onClick={cancelInvite}>{t('common.cancel', 'Cancel')}</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost" style={{ paddingLeft: 0, marginTop: 6 }} onClick={openInvite}>
          <span className="material-symbols-outlined">person_add</span>{t('locations.wizard.invite_new', 'Invite someone new')}
        </button>
      )}

      <div className="form-group" style={{ marginTop: 16 }}>
        <label className="form-lbl">{t('locations.wizard.manager', 'Location manager')}</label>
        <select className="form-select" value={manager} onChange={e => setManager(e.target.value)}>
          <option value="">{t('locations.wizard.no_manager', 'No manager assigned')}</option>
          {assignedList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="form-hint">{t('locations.wizard.manager_hint', 'Display only for now — roles in this app are set per staff member, not per location.')}</div>
      </div>
    </>
  )
}

function StepPolicies({ form, pick, setField, t }) {
  return (
    <>
      <PanelHead n={6} label={t('locations.wizard.step.policies', 'Policies & tax')}
        title={t('locations.wizard.policies_title', 'Policies & tax')}
        lead={t('locations.wizard.policies_lead', 'The new location inherits your boutique’s returns default. Adjust tax to the local regime.')} />
      <OptionCard selected={form.returns === 'inherit'} onClick={() => pick('returns', 'inherit')}
        title={t('locations.wizard.returns_inherit', 'Inherit boutique returns policy')} recommended={t('locations.wizard.recommended', 'Recommended')}
        desc={t('locations.wizard.returns_inherit_desc', 'Standard policy, with returns classes and exemptions already configured for your boutique.')} />
      <OptionCard selected={form.returns === 'custom'} onClick={() => pick('returns', 'custom')}
        title={t('locations.wizard.returns_custom', 'Set a location-specific policy')}
        desc={t('locations.wizard.returns_custom_desc', 'Not available yet — the location will use the boutique default until this is built.')} />
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.vat_rate', 'VAT rate')}</label>
          <select className="form-select" value={form.vatRate} onChange={e => setField('vatRate', e.target.value)}>
            <option value="22">22% (standard)</option><option value="10">10%</option><option value="4">4%</option>
          </select></div>
        <div className="form-group"><label className="form-lbl">{t('locations.wizard.currency', 'Currency')}</label>
          <input className="form-input" value="EUR (€)" readOnly /></div>
      </div>
      <Callout icon="info">
        {t('locations.wizard.policies_flag', 'Returns policy and VAT rate choices here are captured for review but not yet persisted to the backend.')}
      </Callout>
    </>
  )
}

function StepReview({ t, form, staffList, assigned, manager, goStep, existingLocations }) {
  const catalogueLabels = {
    share: t('locations.wizard.catalogue_share', 'Share the boutique catalogue'),
    copy: `${t('locations.wizard.catalogue_copy', 'Copy from an existing location')} — ${shortName(existingLocations.find(l => l.id === form.copySource)?.name) || '—'}`,
    empty: t('locations.wizard.catalogue_empty', 'Start empty'),
  }
  const channelLabels = {
    shopify: t('locations.wizard.channel_shopify', 'Connect a Shopify store'),
    instore: t('locations.wizard.channel_instore', 'In-store only for now'),
  }
  const assignedList = staffList.filter(s => assigned[s.id])
  const managerName = staffList.find(s => s.id === manager)?.name

  const rows = [
    [t('locations.wizard.rev_location', 'Location'), `${form.name || t('locations.wizard.unnamed', '(unnamed)')} · ${form.city || '—'}`, 1],
    [t('locations.wizard.rev_address', 'Address'), [form.address, form.city, form.postcode].filter(Boolean).join(', ') || '—', 1],
    [t('locations.wizard.rev_catalogue', 'Catalogue'), catalogueLabels[form.catalogue], 2],
    [t('locations.wizard.rev_channel', 'Sales channel'), channelLabels[form.channel], 3],
    [t('locations.wizard.rev_terminal', 'Terminal'), form.terminalMode === 'now' ? form.terminalName : t('locations.wizard.terminal_later', 'Set up later'), 4],
    [t('locations.wizard.rev_team', 'Team'), `${assignedList.length} ${t('locations.wizard.assigned', 'assigned')}${managerName ? ' · ' + t('locations.wizard.manager', 'Manager') + ' ' + managerName : ''}`, 5],
    [t('locations.wizard.rev_returns', 'Returns'), form.returns === 'inherit' ? t('locations.wizard.returns_inherit', 'Inherit boutique returns policy') : t('locations.wizard.returns_custom', 'Set a location-specific policy'), 6],
    [t('locations.wizard.rev_tax', 'Tax'), `${form.vatRate}% · EUR`, 6],
  ]

  return (
    <>
      <PanelHead n={7} label={t('locations.wizard.step.review', 'Review & activate')}
        title={t('locations.wizard.review_title', 'Review & activate')}
        lead={t('locations.wizard.review_lead', 'One last look. Activating creates the location and scopes stock, staff, and reporting to it.')} />
      <div className="locwiz-rev-grid">
        {rows.map(([k, v, n]) => (
          <div key={k} className="locwiz-rev-row">
            <div className="k">{k}</div>
            <div className="v">{v}</div>
            <div className="ed" onClick={() => goStep(n)}>{t('locations.wizard.edit', 'Edit')}</div>
          </div>
        ))}
      </div>
      <Callout icon="verified">
        {t('locations.wizard.review_flag', 'Currency is EUR and time zone Europe/Rome. Catalogue architecture, terminal provisioning, and location-specific tax/returns overrides shown above are captured for review only — they are not yet sent to the backend.')}
      </Callout>
    </>
  )
}
