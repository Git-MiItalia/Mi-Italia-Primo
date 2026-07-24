import { useState, useCallback } from 'react'

const STYLES = {
  error:   { background:'var(--red)',   color:'#fff',        icon:'error' },
  warning: { background:'#B45309',      color:'#fff',        icon:'warning' },
  success: { background:'var(--green)', color:'#fff',        icon:'check_circle' },
  info:    { background:'var(--deep)',  color:'var(--gold)', icon:'info' },
}

export function useToast() {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'error', duration = 3000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  return { toasts, show }
}

export default function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => {
        const s = STYLES[t.type] || STYLES.info
        return (
          <div key={t.id} className="toast-item" style={{ background:s.background, color:s.color }}>
            <span className="material-symbols-outlined toast-icon">{s.icon}</span>
            {t.message}
          </div>
        )
      })}
    </div>
  )
}
