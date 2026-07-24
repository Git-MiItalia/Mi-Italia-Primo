import { useState, useRef, useEffect } from 'react'
import { apiFetch } from '../lib/api'

const API = import.meta.env.VITE_API_URL

const quickReplies = ['Reserve link', 'Size guide', 'Stock update', 'Shipping info', 'Thank you']

function AvatarPlaceholder({ size = 18 }) {
  return (
    <div className="msg-av-placeholder">
      <span className="material-symbols-outlined" style={{ fontSize: `${size}px` }}>person</span>
    </div>
  )
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return d.toLocaleDateString('en', { weekday: 'short' })
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short' })
}

function getStatusLabel(status) {
  if (status === 'sending')   return <span className="msg-status-lbl sending">Sending…</span>
  if (status === 'sent')      return <span className="msg-status-lbl sent">Sent</span>
  if (status === 'delivered') return <span className="msg-status-lbl delivered">Delivered</span>
  if (status === 'read')      return <span className="msg-status-lbl read">Read</span>
  return null
}

export default function Messages() {
  const [conversations, setConversations] = useState([])
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [activeId,      setActiveId]      = useState(null)
  const [activeConvo,   setActiveConvo]   = useState(null)
  const [loadingMsgs,   setLoadingMsgs]   = useState(false)
  const [input,         setInput]         = useState('')
  const [sending,       setSending]       = useState(false)

  const bodyRef     = useRef(null)
  const activeIdRef = useRef(null)

  useEffect(() => {
    // Fetch conversations on mount
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

    // SSE connection — opens once, stays open
    const token = localStorage.getItem('primo_token')
    if (token) {
      const es = new EventSource(`${API}/boutique/messages/stream?token=${encodeURIComponent(token)}`)

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data)

          if (payload.type === 'inbound_message' || payload.type === 'outbound_message') {
            const message = payload.message

            if (activeIdRef.current && payload.conversation_id === activeIdRef.current) {
              setActiveConvo(prev => {
                if (!prev) return prev
                const msgs = prev.messages ?? []

                // If exact ID already exists, just update status
                if (msgs.some(m => m.id === message.id)) {
                  return { ...prev, messages: msgs.map(m => m.id === message.id ? { ...m, status: message.status } : m) }
                }

                if (payload.type === 'outbound_message') {
                  // Match by wa_message_id
                  if (message.wa_message_id && msgs.some(m => m.wa_message_id === message.wa_message_id)) {
                    return { ...prev, messages: msgs.map(m => m.wa_message_id === message.wa_message_id ? { ...m, status: message.status } : m) }
                  }

                  // Match temp message still in list
                  const tempIdx = msgs.findIndex(m => m.id?.toString().startsWith('temp-') && m.body === message.body)
                  if (tempIdx !== -1) {
                    const updated = [...msgs]
                    updated[tempIdx] = { ...message, direction: 'outbound' }
                    return { ...prev, messages: updated }
                  }

                  // Already replaced by POST — match by body+direction within 5 seconds
                  const recentMatch = msgs.findIndex(m =>
                    m.direction === 'outbound' &&
                    m.body === message.body &&
                    Math.abs(new Date(m.created_at) - new Date(message.created_at)) < 5000
                  )
                  if (recentMatch !== -1) {
                    const updated = [...msgs]
                    updated[recentMatch] = { ...updated[recentMatch], ...message, direction: 'outbound' }
                    return { ...prev, messages: updated }
                  }
                }

                // Genuinely new message — append
                return { ...prev, messages: [...msgs, message] }
              })
            }

            setConversations(prev => prev.map(c =>
              c.id === payload.conversation_id
                ? { ...c, last_message_preview: message.body, last_message_at: message.created_at, unread_count: c.id === activeIdRef.current ? 0 : (c.unread_count ?? 0) + 1 }
                : c
            ))

          } else if (payload.type === 'status_update') {
            setActiveConvo(prev => {
              if (!prev) return prev
              return {
                ...prev,
                messages: prev.messages.map(m =>
                  m.wa_message_id === payload.wa_message_id
                    ? { ...m, status: payload.status }
                    : m
                )
              }
            })
          }
        } catch {}
      }

      es.onerror = () => {}
      return () => es.close()
    }
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (!bodyRef.current) return
    setTimeout(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }, 50)
  }, [activeConvo?.messages])

  function fetchConversation(id) {
    setActiveId(id)
    activeIdRef.current = id
    setLoadingMsgs(true)
    apiFetch(`${API}/boutique/messages/conversations/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setActiveConvo(res.data)
          setTimeout(() => {
            if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
          }, 50)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false))
  }

  async function send() {
    const text = input.trim()
    if (!text || !activeId || sending) return
    setSending(true)

    const tempMsg = {
      id: `temp-${Date.now()}`,
      direction: 'outbound',
      body: text,
      sender_type: 'boutique',
      msg_type: 'text',
      status: 'sending',
      created_at: new Date().toISOString(),
    }
    setActiveConvo(prev => prev ? { ...prev, messages: [...(prev.messages ?? []), tempMsg] } : prev)
    setInput('')

    try {
      const res  = await apiFetch(`${API}/boutique/messages/conversations/${activeId}/reply`, {
        method: 'POST',
        body:   JSON.stringify({ body: text }),
      })
      const data = await res.json()

      if (data.success) {
        setActiveConvo(prev => prev ? {
          ...prev,
          messages: (prev.messages ?? []).map(m =>
            m.id === tempMsg.id ? { ...data.data, direction: 'outbound' } : m
          )
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
    return c.customer_name || c.customer_phone || 'Unknown'
  }

  function convMeta(c) {
    const parts = []
    if (c.customer_phone) parts.push(`+${c.customer_phone}`)
    if (c.product_name)   parts.push(c.product_name)
    if (!c.within_window) parts.push('Outside reply window')
    return parts.join(' · ') || 'WhatsApp'
  }

  return (
    <div className="msg-layout">

      {/* ── Sidebar ── */}
      <div className="msg-sidebar">
        <div className="msg-sidebar-hdr">
          <div className="msg-sidebar-title">Messages</div>
          <div className="msg-sidebar-badges">
            <span className="msg-wa-badge">WhatsApp</span>
            {unreadTotal > 0 && <span className="sb-badge msg-unread-count">{unreadTotal}</span>}
          </div>
        </div>

        <div className="msg-search">
          <div className="msg-search-inner">
            <span className="material-symbols-outlined">search</span>
            <input placeholder="Search conversations..." />
          </div>
        </div>

        <div className="msg-list">
          {loadingConvos && (
            <div className="msg-empty" style={{ padding: '20px 16px', textAlign: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--stone)' }}>sync</span>
            </div>
          )}
          {!loadingConvos && conversations.length === 0 && (
            <div className="msg-empty" style={{ padding: '24px 16px', textAlign: 'center', fontSize: 11, color: 'var(--stone)' }}>
              No conversations yet.
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
                <span className="material-symbols-outlined">person</span>View Profile
              </button>
              <button className="btn btn-sm btn-whatsapp">
                <span className="material-symbols-outlined">open_in_new</span>Open in WhatsApp
              </button>
            </div>
          </div>

          <div className="msg-body" ref={bodyRef}>
            <div className="msg-date-divider">{`Today · ${new Date().toLocaleDateString('en', { month:'long', day:'numeric', year:'numeric' })}`}</div>

            {loadingMsgs ? (
              <div className="msg-empty">
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--stone)' }}>sync</span>
              </div>
            ) : (activeConvo.messages ?? []).length === 0 ? (
              <div className="msg-empty">{`Start of conversation with ${convName(activeConvo)}`}</div>
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
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span>
                          Template: {m.template_name}
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
              Outside the 24-hour reply window. You can only send template messages.
            </div>
          )}

          <div className="msg-quick-replies">
            {quickReplies.map((r, i) => (
              <div key={r} onClick={() => setInput(r)} className={`msg-quick-chip${i === 0 ? ' msg-quick-wa' : ''}`}>
                {r}
              </div>
            ))}
          </div>

          <div className="msg-input-area">
            <textarea
              className="msg-input-box"
              rows={1}
              placeholder={activeConvo.within_window ? 'Type a message...' : 'Outside reply window…'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={!activeConvo.within_window || sending}
            />
            <button className="btn btn-sm btn-outline" title="Attach product">
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
            <div style={{ textAlign: 'center', color: 'var(--stone)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.3 }}>chat</span>
              <div style={{ fontSize: 13, fontWeight: 600 }}>No conversation selected</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Select a conversation from the list</div>
            </div>
          </div>
        )
      )}
    </div>
  )
}
