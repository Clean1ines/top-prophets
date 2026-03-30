import { http } from './httpClient'

export async function authWithGoogleToken(token: string) {
  const { data } = await http.post<{
    ok: boolean
    user?: { id: string; username: string; email?: string; name?: string }
  }>('/api/auth/google', { token })
  return data
}

export function getGoogleLoginUrl() {
  const raw = String(http.defaults.baseURL ?? '')
  const base = raw.replace(/\/+$/, '')
  return `${base}/api/auth/google/login`
}

