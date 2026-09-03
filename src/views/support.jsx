import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'

const API = import.meta.env.VITE_API_URL

const SUBJECT_KEYS = [
  { ico:'💡', key:'suggestion' },
  { ico:'🐛', key:'bug' },
  { ico:'💰', key:'billing' },
  { ico:'📦', key:'product' },
  { ico:'🔗', key:'integration' },
  { ico:'🏪', key:'account' },
  { ico:'📊', key:'analytics' },
  { ico:'❓', key:'general' },
]

const PRIORITY_KEYS = ['low', 'normal', 'high', 'urgent']

const PRIORITY_STYLES = {
  low:    { borderColor:'var(--green)', background:'rgba(0,108,53,.05)',  color:'var(--green)' },
  normal: { borderColor:'#1A4FBF',      background:'rgba(26,79,191,.05)', color:'#1A4FBF' },
  high:   { borderColor:'#B45309',      background:'rgba(180,83,9,.06)',  color:'#B45309' },
  urgent: { borderColor:'var(--red)',   background:'rgba(197,0,26,.05)', color:'var(--red)' },
}

function statusStyle(status) {
  if (status === 'open')     return { background:'rgba(26,79,191,.08)',  color:'#1A4FBF' }
  if (status === 'progress') return { background:'rgba(180,83,9,.08)',   color:'#B45309' }
  if (status === 'resolved') return { background:'rgba(0,108,53,.08)',   color:'var(--green)' }
  if (status === 'new')      return { background:'rgba(197,0,26,.08)',   color:'var(--red)' }
  return {}
}

function catToSubject(category) {
  return SUBJECT_KEYS.find(s => s.key === category) ?? SUBJECT_KEYS[SUBJECT_KEYS.length - 1]
}

function formatRelative(iso, t) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const sec  = Math.floor(diff / 1000)
  const min  = Math.floor(sec / 60)
  const hr   = Math.floor(min / 60)
  const day  = Math.floor(hr / 24)
  if (sec < 60) return t('sup.just_now')
  if (min < 60) return `${min}m ago`
  if (hr < 24)  return `${hr}h ago`
  if (day < 7)  return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

function initials(name) {
  const parts = (name ?? '').trim().split(/\s+/).map(w => w[0]).filter(Boolean)
  return parts.slice(0, 2).join('').toUpperCase() || 'ME'
}

export default function Support() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  // ── Form state ─────────────────────────────────────────
  const [selectedSubj, setSelectedSubj] = useState(0)
  const [selectedPri, setSelectedPri]   = useState('normal')
  const [subjLine, setSubjLine]         = useState('')
  const [msgBody, setMsgBody]           = useState('')
  const [submitted, setSubmitted]       = useState(false)
  const [lastTicketRef, setLastTicketRef] = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState(null)
  const [attachFile, setAttachFile]     = useState(null)
  const fileInputRef = useRef(null)

  // ── Tickets list ───────────────────────────────────────
  const [tickets, setTickets]               = useState([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [ticketsError, setTicketsError]     = useState(null)

  // ── Quick help + contact ───────────────────────────────
  const [quickHelp, setQuickHelp]     = useState(null)
  const [loadingHelp, setLoadingHelp] = useState(true)

  // ── Open thread ────────────────────────────────────────
  const [openTicketId, setOpenTicketId]     = useState(null)
  const [openThread, setOpenThread]         = useState(null)  // { ticket, messages }
  const [loadingThread, setLoadingThread]   = useState(false)
  const [threadError, setThreadError]       = useState(null)

  // ── Per-ticket action state ────────────────────────────
  const [followUps, setFollowUps]             = useState({})
  const [sendingFollowUp, setSendingFollowUp] = useState(false)
  const [followUpError, setFollowUpError]     = useState(null)
  const [resolving, setResolving]             = useState(false)
  const [resolveError, setResolveError]       = useState(null)
  const [followUpFile, setFollowUpFile]       = useState(null)
  const followUpFileInputRef = useRef(null)

  // ── Mount: fetch quick-help + tickets ──────────────────
  useEffect(() => {
    apiFetch(`${API}/boutique/support/quick-help`)
      .then(r => r.json())
      .then(res => { if (res?.success) setQuickHelp(res.data) })
      .catch(err => console.error('[Support] quick-help fetch failed:', err))
      .finally(() => setLoadingHelp(false))

    fetchTickets()
  }, [i18n.language])

  function fetchTickets() {
    setLoadingTickets(true)
    setTicketsError(null)
    return apiFetch(`${API}/boutique/support/tickets`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) setTickets(res.data?.tickets ?? [])
        else setTicketsError(res?.message ?? 'Failed to load tickets')
      })
      .catch(err => {
        console.error('[Support] tickets fetch failed:', err)
        setTicketsError('Network error loading tickets')
      })
      .finally(() => setLoadingTickets(false))
  }

  // ── Fetch thread when openTicketId changes ─────────────
  useEffect(() => {
    if (!openTicketId) { setOpenThread(null); return }
    setLoadingThread(true)
    setThreadError(null)
    apiFetch(`${API}/boutique/support/tickets/${openTicketId}`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) setOpenThread(res.data)
        else setThreadError(res?.message ?? 'Failed to load ticket')
      })
      .catch(err => {
        console.error('[Support] thread fetch failed:', err)
        setThreadError('Network error loading ticket')
      })
      .finally(() => setLoadingThread(false))
  }, [openTicketId])

  function refetchThread() {
    if (!openTicketId) return Promise.resolve()
    return apiFetch(`${API}/boutique/support/tickets/${openTicketId}`)
      .then(r => r.json())
      .then(res => { if (res?.success) setOpenThread(res.data) })
      .catch(err => console.error('[Support] thread refetch failed:', err))
  }

  // ── Submit new ticket ──────────────────────────────────
  async function submitTicket() {
    if (!subjLine.trim() || !msgBody.trim() || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      let res
      if (attachFile) {
        const fd = new FormData()
        fd.append('category', SUBJECT_KEYS[selectedSubj].key)
        fd.append('priority', selectedPri)
        fd.append('subject', subjLine)
        fd.append('body', msgBody)
        fd.append('file', attachFile)
        res = await apiFetch(`${API}/boutique/support/tickets`, { method: 'POST', body: fd }).then(r => r.json())
      } else {
        res = await apiFetch(`${API}/boutique/support/tickets`, {
          method: 'POST',
          body: JSON.stringify({
            category: SUBJECT_KEYS[selectedSubj].key,
            priority: selectedPri,
            subject:  subjLine,
            body:     msgBody,
          }),
        }).then(r => r.json())
      }

      if (res?.success) {
        setLastTicketRef(res.data?.ticket?.ref ?? '')
        setSubmitted(true)
        fetchTickets()
      } else {
        setSubmitError(res?.message ?? 'Failed to submit ticket')
      }
    } catch (err) {
      console.error('[Support] submitTicket failed:', err)
      setSubmitError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setSubmitted(false)
    setSubjLine('')
    setMsgBody('')
    setSelectedSubj(0)
    setSelectedPri('normal')
    setSubmitError(null)
    setAttachFile(null)
  }

  function toggleTicket(id) {
    setOpenTicketId(prev => prev === id ? null : id)
    setFollowUpError(null)
    setResolveError(null)
    setFollowUpFile(null)
  }

  // ── Send follow-up ─────────────────────────────────────
  async function sendFollowUp(id) {
    const text = followUps[id]?.trim()
    if ((!text && !followUpFile) || sendingFollowUp) return
    setSendingFollowUp(true)
    setFollowUpError(null)
    try {
      let res
      if (followUpFile) {
        const fd = new FormData()
        if (text) fd.append('body', text)
        fd.append('file', followUpFile)
        res = await apiFetch(`${API}/boutique/support/tickets/${id}/messages`, { method: 'POST', body: fd }).then(r => r.json())
      } else {
        res = await apiFetch(`${API}/boutique/support/tickets/${id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ body: text }),
        }).then(r => r.json())
      }

      if (res?.success) {
        setFollowUps(prev => ({ ...prev, [id]: '' }))
        setFollowUpFile(null)
        await Promise.all([refetchThread(), fetchTickets()])
      } else {
        setFollowUpError(res?.message ?? 'Failed to send message')
      }
    } catch (err) {
      console.error('[Support] sendFollowUp failed:', err)
      setFollowUpError('Network error — please try again')
    } finally {
      setSendingFollowUp(false)
    }
  }

  // ── Resolve / reopen ────────────────────────────────────
  async function setTicketStatus(id, status) {
    if (resolving) return
    setResolving(true)
    setResolveError(null)
    try {
      const res = await apiFetch(`${API}/boutique/support/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }).then(r => r.json())

      if (res?.success) {
        await Promise.all([refetchThread(), fetchTickets()])
      } else {
        setResolveError(res?.message ?? 'Failed to update ticket')
      }
    } catch (err) {
      console.error('[Support] setTicketStatus failed:', err)
      setResolveError('Network error — please try again')
    } finally {
      setResolving(false)
    }
  }

  // ── Download attachment ─────────────────────────────────
  async function downloadAttachment(att) {
    try {
      const res = await apiFetch(`${API}/boutique/support/attachments/${att.id}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = att.filename || 'attachment'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[Support] downloadAttachment failed:', err)
    }
  }

  const hasSupportReply = openThread?.messages?.some(m => m.sender !== 'boutique') ?? false

  return (
    <div className="sup-layout">

      {/* ── LEFT ── */}
      <div>

        {/* New ticket form */}
        {!submitted && (
          <div className="card">
            <div className="sup-form-title">
              {t('sup.form.title')} <em className="sup-form-title-em">{t('sup.form.title_em')}</em>
            </div>
            <div className="sup-form-subtitle">{t('sup.form.subtitle')}</div>

            {/* Subject tiles */}
            <div className="form-group">
              <label className="form-lbl">{t('sup.form.topic_label')}</label>
              <div className="sup-subject-grid">
                {SUBJECT_KEYS.map((s, i) => (
                  <div key={s.key} onClick={() => setSelectedSubj(i)}
                    className={`sup-subject-tile${selectedSubj===i?' sel':''}`}>
                    <div className={`sup-subject-ico${selectedSubj===i?' sel':''}`}>{s.ico}</div>
                    <div className="sup-subject-name">{t(`sup.subjects.${s.key}.name`).split(' ')[0]}</div>
                    <div className="sup-subject-sub">{t(`sup.subjects.${s.key}.sub`)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subject line + Priority */}
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('sup.form.subject_label')}</label>
                <input className="form-input"
                  placeholder={t(`sup.subjects.${SUBJECT_KEYS[selectedSubj].key}.placeholder`)}
                  value={subjLine} onChange={e => setSubjLine(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('sup.form.priority_label')}</label>
                <div className="sup-priority-row">
                  {PRIORITY_KEYS.map(pk => (
                    <div key={pk} onClick={() => setSelectedPri(pk)}
                      className="sup-priority-chip"
                      style={selectedPri===pk ? PRIORITY_STYLES[pk] : { borderColor:'var(--mist)', background:'var(--white)', color:'var(--stone)' }}>
                      {t(`sup.priority.${pk}`)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Message body */}
            <div className="form-group">
              <label className="form-lbl">{t('sup.form.message_label')}</label>
              <textarea className="form-textarea sup-message-ta"
                placeholder={t('sup.form.message_placeholder')}
                value={msgBody} onChange={e => setMsgBody(e.target.value)} />
            </div>

            {/* Attachment zone */}
            <div className="form-group">
              <label className="form-lbl">
                {t('sup.form.attachments_label')} <span className="sup-optional">{t('sup.form.optional')}</span>
              </label>
              <input ref={fileInputRef} type="file" className="pp-hidden-input"
                onChange={e => setAttachFile(e.target.files?.[0] ?? null)} />
              {!attachFile ? (
                <div className="sup-upload-zone" onClick={() => fileInputRef.current?.click()}>
                  <span className="material-symbols-outlined sup-upload-icon">upload_file</span>
                  <div className="sup-upload-title">{t('sup.form.upload_title')}</div>
                  <div className="sup-upload-sub">{t('sup.form.upload_sub')}</div>
                </div>
              ) : (
                <div className="sup-upload-selected">
                  <span className="material-symbols-outlined sup-upload-selected-icon">description</span>
                  <span className="sup-upload-selected-name">{attachFile.name}</span>
                  <span className="material-symbols-outlined sup-upload-selected-remove"
                    title={t('sup.form.remove_title')} onClick={() => setAttachFile(null)}>close</span>
                </div>
              )}
            </div>

            {submitError && (
              <div className="alert alert-red sup-inline-alert">
                <span className="material-symbols-outlined">error</span>{submitError}
              </div>
            )}

            {/* Footer */}
            <div className="sup-form-footer">
              <div className="sup-reply-note">
                <span className="material-symbols-outlined sup-reply-icon">bolt</span>
                {t('sup.form.reply_note')} <strong>{quickHelp?.contact?.email ?? 'support@miitalia.com'}</strong>
              </div>
              <button className="btn btn-primary"
                onClick={submitTicket}
                disabled={submitting || !subjLine.trim() || !msgBody.trim()}>
                <span className="material-symbols-outlined">{submitting ? 'hourglass_top' : 'send'}</span>
                {submitting ? 'Sending…' : t('sup.form.submit_btn')}
              </button>
            </div>
          </div>
        )}

        {/* Success card */}
        {submitted && (
          <div className="sup-success-card">
            <div className="sup-success-emoji">✅</div>
            <div className="sup-success-title">
              {t('sup.success.title')} <em className="sup-success-em">{t('sup.success.title_em')}</em>
            </div>
            <div className="sup-success-id">
              {lastTicketRef} · {SUBJECT_KEYS[selectedSubj].ico} {t(`sup.subjects.${SUBJECT_KEYS[selectedSubj].key}.name`)}
            </div>
            <div className="sup-success-msg">{t('sup.success.message')}</div>
            <button className="btn btn-outline btn-sm" onClick={resetForm}>
              <span className="material-symbols-outlined">add</span>{t('sup.success.another_btn')}
            </button>
          </div>
        )}

        {/* Ticket history */}
        <div className="pt-section-divider sup-tickets-divider">
          {t('sup.tickets.title')}
          <span className="pt-section-line" />
        </div>

        <div className="card sup-tickets-card">
          {loadingTickets && <div className="state-empty">Loading tickets…</div>}

          {!loadingTickets && ticketsError && (
            <div className="alert alert-red sup-inline-alert">
              <span className="material-symbols-outlined">error</span>{ticketsError}
            </div>
          )}

          {!loadingTickets && !ticketsError && tickets.length === 0 && (
            <div className="state-empty">{t('sup.tickets.empty')}</div>
          )}

          {!loadingTickets && !ticketsError && tickets.map(tk => {
            const subj   = catToSubject(tk.category)
            const isOpen = openTicketId === tk.id
            return (
              <div key={tk.id}>
                <div onClick={() => toggleTicket(tk.id)}
                  className={`sup-ticket-row${isOpen?' sel':''}`}>
                  <div className="sup-ticket-ico">{subj.ico}</div>
                  <div className="sup-ticket-body">
                    <div className="sup-ticket-meta">{tk.ref} · {formatRelative(tk.lastMessageAt ?? tk.createdAt, t)}</div>
                    <div className="sup-ticket-subj">{tk.subject}</div>
                  </div>
                  <div className="sup-ticket-badges">
                    <span className="sup-ticket-status" style={statusStyle(tk.status)}>
                      {t(`sup.ticket_status.${tk.status}`)}
                    </span>
                    <div className="sup-ticket-priority">{t(`sup.priority.${tk.priority}`)}</div>
                  </div>
                </div>

                {/* Thread */}
                {isOpen && (
                  <div className="sup-thread">
                    <div className="lbl-eyebrow sup-thread-lbl">
                      {t('sup.tickets.thread')} · {tk.ref}
                    </div>

                    {loadingThread && (
                      <div className="state-empty sup-thread-loading">Loading thread…</div>
                    )}

                    {threadError && (
                      <div className="alert alert-red sup-inline-alert">
                        <span className="material-symbols-outlined">error</span>{threadError}
                      </div>
                    )}

                    {!loadingThread && !threadError && openThread && (
                      <>
                        <div className="sup-thread-msgs">
                          {openThread.messages.map(m => {
                            const isBoutique = m.sender === 'boutique'
                            return (
                              <div key={m.id}
                                className={`sup-bubble-wrap ${isBoutique ? 'sup-bubble-sent' : 'sup-bubble-received'}`}>
                                <div className={`sup-bubble-av ${isBoutique ? 'sup-bubble-av-gold' : 'sup-bubble-av-mi'}`}>
                                  {isBoutique ? initials(m.author_name) : 'MI'}
                                </div>
                                <div>
                                  <div className={`sup-bubble ${isBoutique ? 'sup-bubble-user' : 'sup-bubble-support'}`}>
                                    {m.body}
                                    {m.attachments?.length > 0 && (
                                      <div className="sup-msg-attachments">
                                        {m.attachments.map(att => (
                                          <div key={att.id} className="sup-msg-attachment" onClick={() => downloadAttachment(att)}>
                                            <span className="material-symbols-outlined sup-msg-attachment-icon">attach_file</span>
                                            <span className="sup-msg-attachment-name">{att.filename}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className={`sup-bubble-time${isBoutique ? ' sup-bubble-time-right' : ''}`}>
                                    {formatRelative(m.created_at, t)} · {isBoutique ? t('sup.tickets.you') : (m.author_name || t('sup.tickets.support_name'))}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          {!hasSupportReply && tk.status !== 'resolved' && (
                            <div className="sup-awaiting">{t('sup.tickets.awaiting')}</div>
                          )}
                        </div>

                        {resolveError && (
                          <div className="alert alert-red sup-inline-alert">
                            <span className="material-symbols-outlined">error</span>{resolveError}
                          </div>
                        )}

                        {tk.status !== 'resolved' ? (
                          <>
                            {followUpError && (
                              <div className="alert alert-red sup-inline-alert">
                                <span className="material-symbols-outlined">error</span>{followUpError}
                              </div>
                            )}
                            <div className="sup-followup">
                              <input ref={followUpFileInputRef} type="file" className="pp-hidden-input"
                                onChange={e => setFollowUpFile(e.target.files?.[0] ?? null)} />
                              <div className="sup-followup-input-wrap">
                                <textarea className="form-textarea sup-followup-ta"
                                  placeholder={t('sup.tickets.followup_placeholder')}
                                  value={followUps[tk.id] || ''}
                                  onChange={e => setFollowUps(prev => ({ ...prev, [tk.id]: e.target.value }))} />
                                {followUpFile && (
                                  <div className="sup-attach-chip">
                                    <span className="material-symbols-outlined">description</span>
                                    {followUpFile.name}
                                    <span className="material-symbols-outlined sup-attach-chip-remove"
                                      title={t('sup.form.remove_title')} onClick={() => setFollowUpFile(null)}>close</span>
                                  </div>
                                )}
                              </div>
                              <button className="btn btn-outline btn-sm sup-attach-btn"
                                title={t('sup.form.attach_title')}
                                onClick={() => followUpFileInputRef.current?.click()}
                                disabled={sendingFollowUp}>
                                <span className="material-symbols-outlined">attach_file</span>
                              </button>
                              <button className="btn btn-primary btn-sm"
                                onClick={() => sendFollowUp(tk.id)}
                                disabled={sendingFollowUp || (!(followUps[tk.id] || '').trim() && !followUpFile)}>
                                <span className="material-symbols-outlined">
                                  {sendingFollowUp ? 'hourglass_top' : 'send'}
                                </span>
                              </button>
                            </div>
                            <div className="sup-thread-actions">
                              <button className="btn btn-outline btn-xs"
                                onClick={() => setTicketStatus(tk.id, 'resolved')}
                                disabled={resolving}>
                                <span className="material-symbols-outlined">check_circle</span>
                                {resolving ? 'Marking…' : 'Mark as resolved'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="sup-resolved-note">
                            <span className="material-symbols-outlined sup-resolved-icon">check_circle</span>
                            {t('sup.tickets.resolved_note')}
                            <button className="btn btn-outline btn-xs sup-reopen-btn"
                              onClick={() => setTicketStatus(tk.id, 'open')}
                              disabled={resolving}>
                              {resolving ? t('sup.tickets.reopening_btn') : t('sup.tickets.reopen_btn')}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div>
        {/* Quick help — from GET /quick-help */}
        <div className="card">
          <div className="sup-sidebar-title">
            {t('sup.help.title')} <em className="sup-form-title-em">{t('sup.help.title_em')}</em>
          </div>
          {loadingHelp && <div className="state-empty">Loading…</div>}
          {!loadingHelp && quickHelp && (
            <div className="sup-quick-links">
              {(quickHelp.articles ?? []).map(l => (
                <div key={l.key} className="sup-quick-link" onClick={() => l.url && navigate(l.url)}>
                  <span className="material-symbols-outlined sup-quick-link-icon">{l.icon}</span>
                  <div className="sup-quick-link-body">
                    <div className="sup-quick-link-title">{l.title}</div>
                    <div className="sup-quick-link-sub">{l.subtitle}</div>
                  </div>
                  <span className="material-symbols-outlined sup-quick-link-chevron">chevron_right</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact — from GET /quick-help.contact */}
        <div className="card">
          <div className="sup-sidebar-title">
            {t('sup.contact.title')} <em className="sup-form-title-em">{t('sup.contact.title_em')}</em>
          </div>
          <div className="sup-contact-list">
            <div className="inner-card-sm sup-contact-row">
              <span className="material-symbols-outlined sup-contact-icon">forum</span>
              <div>
                <div className="sup-contact-name">{t('sup.contact.inapp_title')}</div>
                <div className="sup-contact-sub">
                  {quickHelp?.contact?.avgResponse
                    ? `${t('sup.contact.inapp_sub')} · ${quickHelp.contact.avgResponse}`
                    : t('sup.contact.inapp_sub')}
                </div>
              </div>
            </div>
            <div className="inner-card-sm sup-contact-row">
              <span className="material-symbols-outlined sup-contact-icon">email</span>
              <div>
                <div className="sup-contact-name">{quickHelp?.contact?.email ?? 'support@miitalia.com'}</div>
                <div className="sup-contact-sub">{t('sup.contact.email_sub')}</div>
              </div>
            </div>
            <div className="sup-online-row">
              <div className={`sup-online-dot${quickHelp?.contact?.online === false ? ' sup-online-dot-off' : ''}`} />
              <div>
                <div className="sup-online-label">
                  {quickHelp?.contact?.online === false ? 'Support offline' : t('sup.contact.online_label')}
                </div>
                <div className="sup-contact-sub">{quickHelp?.contact?.hours ?? t('sup.contact.online_hours')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
