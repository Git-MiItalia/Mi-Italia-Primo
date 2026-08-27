export const getToken    = () => localStorage.getItem('primo_token')
export const setToken    = (t) => localStorage.setItem('primo_token', t)
export const clearToken  = () => { localStorage.removeItem('primo_token'); clearStaff() }

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
export const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
})