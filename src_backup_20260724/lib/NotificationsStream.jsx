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
    console.log('[SSE payload]', payload)
    subscribers.forEach(cb => cb(payload))
    console.log('[SSE subscribers count]', subscribers.size)
  } catch (err) {
    console.log('[SSE parse error]', err, e.data)
  }
}

  es.onerror = (err) => {

    }
}

export function closeNotificationStream() {
  if (es) { es.close(); es = null }
  subscribers.clear()
}