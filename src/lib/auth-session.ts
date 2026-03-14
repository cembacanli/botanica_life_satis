export const AUTH_COOKIE_NAME = 'bl_auth_user'

export interface SessionUser {
  id: string
  username: string
  role: 'admin' | 'user'
}

export function encodeSessionUser(user: SessionUser) {
  return Buffer.from(JSON.stringify(user), 'utf8').toString('base64url')
}

export function decodeSessionUser(value: string | undefined): SessionUser | null {
  if (!value) return null
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as SessionUser
  } catch {
    return null
  }
}
