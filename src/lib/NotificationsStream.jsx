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

  // Was an empty handler, so a dropped stream failed silently and notifications
  // simply stopped arriving with nothing to show for it. EventSource reconnects
  // on its own, so there is nothing to do here but leave a trace — deliberately
  // console only, since a reconnect is not worth a toast in the merchant's face.
  es.onerror = (err) => {
    console.error('[SSE connection error]', err)
  }
}

export function closeNotificationStream() {
  if (es) { es.close(); es = null }
  subscribers.clear()
}