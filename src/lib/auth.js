export const getToken    = () => localStorage.getItem('primo_token')
export const setToken    = (t) => localStorage.setItem('primo_token', t)
export const clearToken  = () => localStorage.removeItem('primo_token')
export const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
})