export const getToken    = () => localStorage.getItem('primo_token')
export const setToken    = (t) => localStorage.setItem('primo_token', t)
export const clearToken  = () => {
  localStorage.removeItem('primo_token')
  clearStaff()
  // Cleared with the token: the next boutique to log in on this browser must
  // not inherit the previous one's WhatsApp entitlement.
  clearWhatsappEnabled()
}

// Staff identity snapshot from login response ({id, name, role, photo_url,
// preferred_locale}) — only refreshed at login, used to tell an owner from
// non-owner staff for display purposes (e.g. Sidebar's own-name/role vs
// founder-name/title). Photo itself should prefer the live `my_photo_url`
// from GET /boutique/profile, not this snapshot.
export const getStaff   = () => {
  try { return JSON.parse(localStorage.getItem('primo_staff') ?? 'null') }
  catch { return null }
}
export const setStaff   = (staff) => localStorage.setItem('primo_staff', JSON.stringify(staff ?? null))
export const clearStaff = () => localStorage.removeItem('primo_staff')

// Whether this boutique has WhatsApp. Sent as `whatsapp_enabled` on the login
// response; when false the portal hides the Messages tab, the WhatsApp number
// fields and every WhatsApp action and campaign channel.
//
// Absent is treated as ENABLED on purpose. The flag only arrives at login, so
// a session that predates it has nothing stored — and losing the Messages tab
// because a value failed to read is a worse failure than showing it. Sir sends
// the flag explicitly every time, so this fallback should never fire in
// practice.
export const setWhatsappEnabled = (on) =>
  localStorage.setItem('primo_whatsapp_enabled', JSON.stringify(on !== false))

export const isWhatsappEnabled = () => {
  try {
    const raw = localStorage.getItem('primo_whatsapp_enabled')
    return raw === null ? true : JSON.parse(raw) !== false
  } catch { return true }
}

export const clearWhatsappEnabled = () => localStorage.removeItem('primo_whatsapp_enabled')
export const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
})