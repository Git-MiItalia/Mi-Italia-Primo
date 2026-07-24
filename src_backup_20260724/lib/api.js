import useLangStore from '../store/langStore'

export async function apiFetch(input, init = {}) {
  const locale = useLangStore.getState().lang || 'en'
  const token  = localStorage.getItem('primo_token')

  const headers = new Headers(init.headers)
  headers.set('Accept-Language', locale)

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (!headers.has('Content-Type') && !(init.body instanceof FormData) && init.method !== 'DELETE') {
    headers.set('Content-Type', 'application/json')
  }

  let response
  try {
    response = await fetch(input, { ...init, headers })
  } catch {
    // Server is down / unreachable — clear token and redirect to login
    localStorage.removeItem('primo_token')
    window.location.href = '/login'
    return new Promise(() => {})
  }

  // Token invalid or expired — redirect to login
  if (response.status === 401) {
    localStorage.removeItem('primo_token')
    window.location.href = '/login'
    return new Promise(() => {})
  }

  return response
}
