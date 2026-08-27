import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'

const API = import.meta.env.VITE_API_URL

const QUICK_REPLY_KEYS = ['reserve_link', 'size_guide', 'stock_update', 'shipping_info', 'thank_you']

function AvatarPlaceholder({ size = 18 }) {
  return (
    <div className="msg-av-placeholder">
      <span className="material-symbols-outlined" style={{ fontSize: `${size}px` }}>person</span>
    </div>
  )
}

export default function Messages() {
  const { t, i18n } = useTranslation()

  const [conversations, setConversations] = useState([])
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [activeId,      setActiveId]      = useState(null)
  const [activeConvo,   setActiveConvo]   = useState(null)
  const [loadingMsgs,   setLoadingMsgs]   = useState(false)
  const [input,         setInput]         = useState('')
  const [sending,       setSending]       = useState(false)

  const bodyRef     = useRef(null)
  const activeIdRef = useRef(null)

  function fmtTime(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now - d) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return t('messages.yesterday')
    if (diffDays < 7)  return d.toLocaleDateString('en', { weekday: 'short' })
    return d.toLocaleDateString('en', { day: 'numeric', month: 'short' })
  }

  function getStatusLabel(status) {
    if (status === 'sending')   return <span className="msg-status-lbl sending">{t('messages.status.sending')}</span>
    if (status === 'sent')      return <span className="msg-status-lbl sent">{t('messages.status.sent')}</span>
    if (status === 'delivered') return <span className="msg-status-lbl delivered">{t('messages.status.delivered')}</span>
    if (status === 'read')      return <span className="msg-status-lbl read">{t('messages.status.read')}</span>
    return null
  }

  useEffect(() => {
    apiFetch(`${API}/boutique/messages/conversations`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const list = res.data.conversations ?? []
          setConversations(list)
          if (list.length > 0) fetchConversation(list[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConvos(false))
  }, [i18n.language])

  function fetchConversation(id) {
    setActiveId(id)
    activeIdRef.current = id
    setLoadingMsgs(true)
    apiFetch(`${API}/boutique/messages/conversations/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.success && activeIdRef.current === id) {
          setActiveConvo(res.data)
          setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false))
  }

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [activeConvo])

  async function send() {
    const text = input.trim()
    if (!text || !activeConvo || sending) return
    setSending(true)
    const tempMsg = {
      id: `temp-${Date.now()}`,
      direction: 'outbound',
      body: text,
      status: 'sending',
      created_at: new Date().toISOString(),
    }
    setActiveConvo(prev => prev ? { ...prev, messages: [...(prev.messages ?? []), tempMsg] } : prev)
    setInput('')

    try {
      const res = await apiFetch(`${API}/boutique/messages/conversations/${activeConvo.id}/send`, {
        method: 'POST',
        body: JSON.stringify({ body: text })
      }).then(r => r.json())

      if (res.success) {
        setActiveConvo(prev => prev ? {
          ...prev,
          messages: (prev.messages ?? []).map(m => m.id === tempMsg.id ? { ...res.data, status: 'sent' } : m)
        } : prev)
        setConversations(prev => prev.map(c =>
          c.id === activeId
            ? { ...c, last_message_preview: text, last_message_at: new Date().toISOString() }
            : c
        ))
      } else {
        setActiveConvo(prev => prev ? {
          ...prev,
          messages: (prev.messages ?? []).filter(m => m.id !== tempMsg.id)
        } : prev)
      }
    } catch {
      setActiveConvo(prev => prev ? {
        ...prev,
        messages: (prev.messages ?? []).filter(m => m.id !== tempMsg.id)
      } : prev)
    } finally {
      setSending(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const unreadTotal = conversations.filter(c => c.unread_count > 0).length

  function convName(c) {
    return c.customer_name || c.customer_phone || t('messages.unknown_contact')
  }

  function convMeta(c) {
    const parts = []
    if (c.customer_phone) parts.push(`+${c.customer_phone}`)
    if (c.product_name)   parts.push(c.product_name)
    if (!c.within_window) parts.push(t('messages.outside_window'))
    return parts.join(' · ') || t('messages.wa_label')
  }

  return (
    <div className="msg-layout">

      {/* ── Sidebar ── */}
      <div className="msg-sidebar">
        <div className="msg-sidebar-hdr">
          <div className="msg-sidebar-title">{t('messages.title')}</div>
          <div className="msg-sidebar-badges">
            <span className="msg-wa-badge">{t('messages.wa_label')}</span>
            {unreadTotal > 0 && <span className="sb-badge msg-unread-count">{unreadTotal}</span>}
          </div>
        </div>

        <div className="msg-search">
          <div className="msg-search-inner">
            <span className="material-symbols-outlined">search</span>
            <input placeholder={t('messages.search_placeholder')} />
          </div>
        </div>

        <div className="msg-list">
          {loadingConvos && (
            <div className="msg-empty msg-empty-loading">
              <span className="material-symbols-outlined msg-empty-icon-sm">sync</span>
            </div>
          )}
          {!loadingConvos && conversations.length === 0 && (
            <div className="msg-empty msg-empty-list">
              {t('messages.no_conversations')}
            </div>
          )}
          {conversations.map(c => (
            <div
              key={c.id}
              className={`msg-item${c.unread_count > 0 ? ' unread' : ''}${activeId === c.id ? ' active-msg' : ''}`}
              onClick={() => fetchConversation(c.id)}
            >
              <AvatarPlaceholder size={18} />
              <div className="msg-item-body">
                <div className="msg-item-top">
                  <div className="msg-item-name">{convName(c)}</div>
                  <div className="msg-item-time">{fmtTime(c.last_message_at)}</div>
                </div>
                <div className="msg-item-preview">{c.last_message_preview || '—'}</div>
              </div>
              {c.unread_count > 0 && <div className="msg-item-badge">{c.unread_count}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Main chat ── */}
      {activeConvo ? (
        <div className="msg-main">
          <div className="msg-main-hdr">
            <AvatarPlaceholder size={20} />
            <div>
              <div className="msg-main-name">{convName(activeConvo)}</div>
              <div className="msg-main-meta">{convMeta(activeConvo)}</div>
            </div>
            <div className="msg-main-actions">
              <button className="btn btn-sm btn-outline">
                <span className="material-symbols-outlined">person</span>{t('messages.view_profile')}
              </button>
              <button className="btn btn-sm btn-whatsapp">
                <span className="material-symbols-outlined">open_in_new</span>{t('messages.open_wa')}
              </button>
            </div>
          </div>

          <div className="msg-body" ref={bodyRef}>
            <div className="msg-date-divider">{t('messages.today_divider', { date: new Date().toLocaleDateString('en', { month:'long', day:'numeric', year:'numeric' }) })}</div>

            {loadingMsgs ? (
              <div className="msg-empty">
                <span className="material-symbols-outlined msg-empty-icon-md">sync</span>
              </div>
            ) : (activeConvo.messages ?? []).length === 0 ? (
              <div className="msg-empty">{t('messages.start_of_convo', { name: convName(activeConvo) })}</div>
            ) : (
              (activeConvo.messages ?? []).map((m, idx, arr) => {
                const type = m.direction === 'outbound' ? 'sent' : 'received'
                const next = arr[idx + 1]
                const isLastInGroup = !next ||
                  next.direction !== m.direction ||
                  (new Date(next.created_at) - new Date(m.created_at)) > 60000
                const timeStr = m.status === 'sending' ? null : fmtTime(m.created_at)

                return (
                  <div key={m.id} className={`msg-row msg-row-${type}`}>
                    <div className={`msg-bubble-wrap msg-bubble-wrap-${type}`}>
                      {m.template_name && (
                        <div className="msg-template-ref">
                          <span className="material-symbols-outlined msg-template-icon">auto_awesome</span>
                          {t('messages.template_ref', { name: m.template_name })}
                        </div>
                      )}
                      <div className={`msg-bubble ${type}${m.status === 'sending' ? ' sending' : ''}`}>
                        {m.body}
                      </div>
                      {isLastInGroup && (
                        <div className={`msg-time msg-time-${type}`}>
                          {type === 'sent'
                            ? <>{timeStr} {getStatusLabel(m.status)}</>
                            : timeStr}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {!activeConvo.within_window && (
            <div className="msg-window-warn">
              <span className="material-symbols-outlined">schedule</span>
              {t('messages.window_warn')}
            </div>
          )}

          <div className="msg-quick-replies">
            {QUICK_REPLY_KEYS.map((key, i) => {
              const label = t(`messages.quick_replies.${key}`)
              return (
                <div key={key} onClick={() => setInput(label)} className={`msg-quick-chip${i === 0 ? ' msg-quick-wa' : ''}`}>
                  {label}
                </div>
              )
            })}
          </div>

          <div className="msg-input-area">
            <textarea
              className="msg-input-box"
              rows={1}
              placeholder={activeConvo.within_window ? t('messages.input_placeholder') : t('messages.outside_window_placeholder')}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={!activeConvo.within_window || sending}
            />
            <button className="btn btn-sm btn-outline" title={t('messages.attach_product')}>
              <span className="material-symbols-outlined msg-attach-icon">attach_file</span>
            </button>
            <button
              className="msg-send-btn"
              onClick={send}
              disabled={!activeConvo.within_window || sending || !input.trim()}
            >
              <span className="material-symbols-outlined">{sending ? 'hourglass_empty' : 'send'}</span>
            </button>
          </div>
        </div>
      ) : (
        !loadingConvos && (
          <div className="msg-main msg-main-empty">
            <div className="msg-empty-center">
              <span className="material-symbols-outlined msg-empty-icon-lg">chat</span>
              <div className="msg-empty-title">{t('messages.empty_title')}</div>
              <div className="msg-empty-sub">{t('messages.empty_sub')}</div>
            </div>
          </div>
        )
      )}
    </div>
  )
}
