import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'

const API = import.meta.env.VITE_API_URL

const AVATAR_COLORS = [
  { bg:'rgba(184,149,90,.2)',  fg:'#8A6A30' },
  { bg:'rgba(26,79,191,.15)', fg:'#1A4FBF' },
  { bg:'rgba(197,0,26,.12)',  fg:'#C5001A' },
  { bg:'rgba(107,33,200,.12)',fg:'#6B21C8' },
  { bg:'rgba(0,108,53,.12)',  fg:'#006C35' },
]

// TODO(i18n): the bundle has no keys for these row labels — they still need
// translating. Same for "Total Staff", "Pending Invite", "Assign to Store",
// "Resend", "Invite Pending" and the two role descriptions below.
const PERMISSIONS = [
  ['View Dashboard',        true,  true,  true  ],
  ['Add / Edit Products',   true,  true,  false ],
  ['Manage Reservations',   true,  true,  true  ],
  ['Process POS Sales',     true,  true,  true  ],
  ['View Orders',           true,  true,  'part'],
  ['Generate DHL Labels',   true,  true,  false ],
  ['View Financials',       true,  'part',false ],
  ['Manage Staff',          true,  false, false ],
  ['Manage Discounts',      true,  true,  false ],
  ['Edit Store Profile',    true,  false, false ],
  ['Showroom Settings',     true,  'part',false ],
]

function ini(name) {
  return (name ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

function rolePill(role) {
  if (role === 'owner')   return 'owner'
  if (role === 'manager') return 'manager'
  return 'staff'
}

function PermIcon({ val }) {
  if (val === true)   return <span className="material-symbols-outlined perm-check" style={{ fontVariationSettings:"'FILL' 1" }}>check_circle</span>
  if (val === false)  return <span className="material-symbols-outlined perm-x"     style={{ fontVariationSettings:"'FILL' 1" }}>cancel</span>
  if (val === 'part') return <span className="material-symbols-outlined perm-partial">radio_button_partial</span>
  return null
}

export default function Staff() {
  const { t } = useTranslation()

  const [staff,   setStaff]   = useState([])
  const [loading, setLoading] = useState(true)

  const [showInvite,    setShowInvite]    = useState(false)
  const [invName,       setInvName]       = useState('')
  const [invEmail,      setInvEmail]      = useState('')
  const [invRole,       setInvRole]       = useState('staff')
  const [invError,      setInvError]      = useState('')
  const [inviting,      setInviting]      = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(null)

  const [editMember, setEditMember] = useState(null)
  const [editName,   setEditName]   = useState('')
  const [editRole,   setEditRole]   = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editSaving, setEditSaving] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState(null)

  /* ── commented out scene bar — pending additional endpoints ──
  const SCENES = [
    { key:'team',  label:'1 · Team' },
    { key:'clock', label:'2 · Clock In / Out' },
    { key:'pay',   label:'3 · Pay & Hours' },
    { key:'sales', label:'4 · Sales by Employee' },
    { key:'perms', label:'5 · Permissions' },
  ]
  const [scene, setScene] = useState('team')
  ── end commented out ── */

  const [boutiqueName, setBoutiqueName] = useState('')

  useEffect(() => {
    setLoading(true)
    apiFetch(`${API}/boutique/staff`)
      .then(r => r.json())
      .then(res => { setStaff(res.data?.staff ?? []); setLoading(false) })
      .catch(() => setLoading(false))

    apiFetch(`${API}/boutique/profile`)
      .then(r => r.json())
      .then(res => { if (res.success) setBoutiqueName(res.data?.name ?? '') })
      .catch(() => {})
  }, [])

  // Role label for a value coming back from the API, so the pill and the
  // matrix headers read in the viewer's language rather than raw 'manager'.
  function roleLabel(role) {
    if (role === 'owner')   return t('staff.roles.owner')
    if (role === 'manager') return t('staff.roles.manager')
    return t('staff.roles.staff')
  }

  function inviteStaff() {
    if (!invName || !invEmail) { setInvError(t('staff.invite_modal.error_required')); return }
    setInviting(true); setInvError('')
    apiFetch(`${API}/boutique/staff/invite`, {
      method: 'POST',
      body: JSON.stringify({ name: invName, email: invEmail, role: invRole })
    }).then(r => r.json()).then(res => {
      setInviting(false)
      if (res.success) {
        setStaff(prev => [...prev, res.data])
        setShowInvite(false)
        setInvName(''); setInvEmail(''); setInvRole('staff')
        setInviteSuccess(res.data)
      } else {
        setInvError(res.message ?? 'Failed to send invite.')
      }
    })
  }

  function openEdit(member) {
    setEditMember(member); setEditName(member.name)
    setEditRole(member.role); setEditActive(member.is_active)
  }

  function saveEdit() {
    if (!editMember) return
    setEditSaving(true)
    apiFetch(`${API}/boutique/staff/${editMember.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: editName, role: editRole, is_active: editActive })
    }).then(r => r.json()).then(res => {
      setEditSaving(false)
      if (res.success) {
        setStaff(prev => prev.map(s => s.id === editMember.id ? res.data : s))
        setEditMember(null)
      }
    })
  }

  function removeStaff(id) {
    apiFetch(`${API}/boutique/staff/${id}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setStaff(prev => prev.filter(s => s.id !== id))
          if (editMember?.id === id) setEditMember(null)
          setDeleteConfirm(null)
        }
      })
  }

  const totalStaff   = staff.length
  const activeNow    = staff.filter(s => s.is_active && !s.pending).length
  const pendingCount = staff.filter(s => s.pending).length

  return (
    <>
      <div className="grid2" style={{ alignItems: 'start' }}>

        {/* ── Left column ── */}
        <div>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:17 }}>{t('staff.title')} <em style={{ color:'var(--gold)', fontStyle:'italic' }}>Accounts</em></h3>
            <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
              <span className="material-symbols-outlined">person_add</span>Invite Staff
            </button>
          </div>

          {/* Stat cards */}
          <div className="stat-row" style={{ gridTemplateColumns:'1fr 1fr 1fr', marginBottom:14 }}>
            <div className="stat-card">
              <div className="stat-lbl">Total Staff</div>
              <div className="stat-val">{totalStaff}</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">{t('common.active')}</div>
              <div className="stat-val">{activeNow}</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Pending Invite</div>
              <div className="stat-val">{pendingCount}</div>
            </div>
          </div>

          {/* Staff cards */}
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">
                {boutiqueName
                  ? <>{boutiqueName.split(' ').slice(0, -1).join(' ')} <em>{boutiqueName.split(' ').slice(-1)}</em></>
                  : t('staff.team_overview')}
              </div>
            </div>

            {loading && (
              <div style={{ padding:'30px', textAlign:'center', color:'var(--stone)', fontSize:12 }}>
                {t('staff.loading')}
              </div>
            )}

            {!loading && staff.length === 0 && (
              <div style={{ padding:'30px', textAlign:'center', color:'var(--stone)', fontStyle:'italic', fontSize:12 }}>
                No staff members yet. Click "Invite Staff" to add your first team member.
              </div>
            )}

            {!loading && staff.map((member, i) => {
              const c = AVATAR_COLORS[i % AVATAR_COLORS.length]
              return (
                <div key={member.id} className={`staff-card${member.pending ? ' pending' : ''}`}
                  style={member.pending ? { opacity: 0.6 } : {}}>
                  {/* Avatar */}
                  <div className="staff-av"
                    style={{ background: c.bg, color: c.fg }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{ini(member.name)}</span>
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div className="staff-name">{member.pending ? 'Invite Pending' : member.name}</div>
                    <div>
                      <span className={`staff-role-tag ${rolePill(member.role)}`}>
                        {member.role === 'owner' && (
                          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>workspace_premium</span>
                        )}
                        {roleLabel(member.role)}
                      </span>
                    </div>
                    <div className="staff-email">{member.email}</div>
                  </div>
                  {/* Actions */}
                  <div className="staff-actions">
                    {member.pending ? (
                      <>
                        <button className="btn btn-sm btn-outline">Resend</button>
                        <button className="btn btn-sm btn-red" onClick={() => setDeleteConfirm(member.id)}>{t('common.cancel')}</button>
                      </>
                    ) : member.role === 'owner' ? (
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(member)}>{t('common.edit')}</button>
                    ) : (
                      <>
                        <button className="btn btn-sm btn-outline" onClick={() => openEdit(member)}>{t('common.edit')}</button>
                        <button className="btn btn-sm btn-red" onClick={() => setDeleteConfirm(member.id)}>{t('common.remove')}</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right column — Permissions matrix ── */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">Role <em>{t('staff.perms.title')}</em></div>
          </div>
          <table className="perm-matrix">
            <thead>
              <tr>
                <th>Permission</th>
                <th>{t('staff.roles.owner')}</th>
                <th>{t('staff.roles.manager')}</th>
                <th>{t('staff.roles.staff')}</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(([label, owner, manager, staff]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td><PermIcon val={owner}   /></td>
                  <td><PermIcon val={manager} /></td>
                  <td><PermIcon val={staff}   /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="form-hint" style={{ marginTop: 8 }}>
            <span style={{ color:'var(--gold)', fontWeight:600 }}>◑</span> Partial = read-only access
          </div>
        </div>
      </div>

      {/* ── Invite Modal ── */}
      {showInvite && (
        <div className="modal-backdrop" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:'440px', minHeight:'443px' }}>
            <div className="modal-hdr">
              <span className="modal-title">Invite <em>Staff Member</em></span>
              <span className="modal-close" onClick={() => setShowInvite(false)}>
                <span className="material-symbols-outlined">close</span>
              </span>
            </div>
            {invError && (
              <div className="alert alert-red" style={{ marginBottom:12 }}>
                <span className="material-symbols-outlined">error</span>{invError}
              </div>
            )}
            <div className="form-group">
              <label className="form-lbl">Email Address</label>
              <input className="form-input" type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="staff@email.com" />
            </div>
            <div className="form-group">
              <label className="form-lbl">Full Name</label>
              <input className="form-input" value={invName} onChange={e => setInvName(e.target.value)} placeholder="First and last name" />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('staff.invite_modal.role_label')}</label>
              <select className="form-select" value={invRole} onChange={e => setInvRole(e.target.value)}>
                <option value="staff">Staff — POS, reservations, view orders</option>
                <option value="manager">Manager — + products, discounts, DHL labels</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-lbl">Assign to Store</label>
              <input className="form-input" value={boutiqueName} readOnly style={{ color:'var(--stone)' }} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowInvite(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={inviteStaff} disabled={inviting}>
                <span className="material-symbols-outlined">send</span>
                {inviting ? t('staff.invite_modal.sending') : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editMember && (
        <div className="modal-backdrop" onClick={() => setEditMember(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <span className="modal-title">{editMember.name} — <em>{t('staff.edit_modal.title_em')}</em></span>
              <span className="modal-close" onClick={() => setEditMember(null)}>
                <span className="material-symbols-outlined">close</span>
              </span>
            </div>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('staff.edit_modal.name_label')}</label>
                <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('staff.edit_modal.email_label')}</label>
                <input className="form-input" value={editMember.email} readOnly style={{ color:'var(--stone)' }} />
              </div>
            </div>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('staff.edit_modal.role_label')}</label>
                <select className="form-select" value={editRole} onChange={e => setEditRole(e.target.value)}>
                  <option value="staff">{t('staff.roles.staff')}</option>
                  <option value="manager">{t('staff.roles.manager')}</option>
                  <option value="owner">{t('staff.roles.owner')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('staff.edit_modal.status_label')}</label>
                <select className="form-select" value={editActive ? 'active' : 'inactive'} onChange={e => setEditActive(e.target.value === 'active')}>
                  <option value="active">{t('staff.status.active')}</option>
                  <option value="inactive">{t('staff.status.inactive')}</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize:10, color:'var(--stone)', marginBottom:16 }}>
              {t('staff.table.joined')}: {fmtDate(editMember.created_at)} · {t('staff.table.last_login')}: {fmtDate(editMember.last_login_at)}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditMember(null)}>{t('common.cancel')}</button>
              <button className="btn btn-red btn-sm" onClick={() => setDeleteConfirm(editMember.id)}>
                <span className="material-symbols-outlined">person_off</span>{t('common.remove')}
              </button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>
                <span className="material-symbols-outlined">save</span>
                {editSaving ? t('staff.edit_modal.saving') : t('staff.edit_modal.save_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Success Modal ── */}
      {inviteSuccess && (
        <div className="modal-backdrop" onClick={() => setInviteSuccess(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()} style={{ textAlign:'center' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>✅</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, marginBottom:6 }}>
              Staff <em style={{ color:'var(--gold)' }}>Invited</em>
            </div>
            <div style={{ fontSize:11, color:'var(--stone)', lineHeight:1.7, marginBottom:20 }}>
              {t('staff.invite_success.msg1', { name: inviteSuccess.name, role: roleLabel(inviteSuccess.role) })}<br />
              An invitation email has been sent to <strong>{inviteSuccess.email}</strong>.
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={() => setInviteSuccess(null)}>{t('common.done')}</button>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('staff.delete_modal.title')} <em>{t('staff.delete_modal.title_em')}</em></div>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-intro">
              {t('staff.delete_modal.msg', { name: staff.find(s => s.id === deleteConfirm)?.name })}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</button>
              <button className="btn btn-red" onClick={() => removeStaff(deleteConfirm)}>
                <span className="material-symbols-outlined">person_off</span>{t('staff.delete_modal.remove_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
