// src/lib/notificationStream.js

let es = null
const subscribers = new Set()

export function subscribeToNotifications(callback) {
  subscribers.add(callback)
  return () => subscribers.delete(callback) // returns unsubscribe fn
}

export function openNotificationStream(token) {
  
  if (es) return // already open
  const API = import.meta.env.VITE_API_URL
  es = new EventSource(`${API}/boutique/notifications/stream?token=${encodeURIComponent(token)}`)

 es.onmessage = (e) => {
  try {
    const data = e.data
    if (!data || data.trim() === ':ping' || data.trim() === ':connected') return
    const payload = JSON.parse(data)
    subscribers.forEach(cb => cb(payload))
  } catch (err) {
    console.error('[SSE parse error]', err, e.data)
  }
}

  es.onerror = (err) => {

    }
}

export function closeNotificationStream() {
  if (es) { es.close(); es = null }
  subscribers.clear()
}