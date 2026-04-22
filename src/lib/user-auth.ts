import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AUTH_COOKIE_NAME, decodeSessionUser } from '@/lib/auth-session'

const USER_TABLE = 'app_users'
const PASSWORD_PREFIX = 'scrypt'

type UserRole = 'admin' | 'user'

interface AppUserRow {
  id: string
  username: string
  password: string | null
  role: UserRole
  created_at: string
}

interface SeedUser {
  username: string
  password: string
  role: UserRole
}

export interface PublicUser {
  id: string
  username: string
  role: UserRole
  createdAt: string
}

function parseSeedUsers(): SeedUser[] {
  const raw = process.env.APP_SEED_USERS_JSON?.trim()
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item): SeedUser => ({
        username: String(item?.username || '').trim(),
        password: String(item?.password || ''),
        role: item?.role === 'admin' ? 'admin' : 'user',
      }))
      .filter((item) => item.username && item.password)
  } catch (error) {
    console.error('APP_SEED_USERS_JSON parse error:', error)
    return []
  }
}

export function toPublicUser(user: Pick<AppUserRow, 'id' | 'username' | 'role' | 'created_at'>): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.created_at,
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${PASSWORD_PREFIX}$${salt}$${hash}`
}

function verifyHashedPassword(password: string, stored: string) {
  const [prefix, salt, expectedHash] = stored.split('$')
  if (prefix !== PASSWORD_PREFIX || !salt || !expectedHash) return false

  const derived = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHash, 'hex')

  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

export function verifyPassword(password: string, storedPassword: string | null | undefined) {
  if (!storedPassword) return false
  if (storedPassword.startsWith(`${PASSWORD_PREFIX}$`)) {
    return verifyHashedPassword(password, storedPassword)
  }

  return storedPassword === password
}

export function needsPasswordUpgrade(storedPassword: string | null | undefined) {
  return typeof storedPassword === 'string' && !storedPassword.startsWith(`${PASSWORD_PREFIX}$`)
}

export async function ensureUsersSeeded() {
  const { data, error } = await supabase.from(USER_TABLE).select('id').limit(1)
  if (error) throw error
  if (data && data.length > 0) return

  const seedUsers = parseSeedUsers()
  if (seedUsers.length === 0) return

  const payload = seedUsers.map((user) => ({
    username: user.username,
    password: hashPassword(user.password),
    role: user.role,
    created_at: new Date().toISOString(),
  }))

  const { error: insertError } = await supabase.from(USER_TABLE).insert(payload)
  if (insertError) throw insertError
}

export async function authenticateUser(username: string, password: string): Promise<PublicUser | null> {
  await ensureUsersSeeded()

  const { data, error } = await supabase
    .from(USER_TABLE)
    .select('id, username, password, role, created_at')
    .eq('username', username)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data || !verifyPassword(password, data.password)) return null

  if (needsPasswordUpgrade(data.password)) {
    const { error: updateError } = await supabase
      .from(USER_TABLE)
      .update({ password: hashPassword(password) })
      .eq('id', data.id)

    if (updateError) {
      console.error('Password upgrade failed for user:', data.username, updateError)
    }
  }

  return toPublicUser(data as AppUserRow)
}

export async function requireAdminUser(request: NextRequest): Promise<PublicUser | null> {
  const cookieValue = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const sessionUser = decodeSessionUser(cookieValue)
  if (!sessionUser?.id) return null

  const { data, error } = await supabase
    .from(USER_TABLE)
    .select('id, username, role, created_at')
    .eq('id', sessionUser.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return toPublicUser(data as Pick<AppUserRow, 'id' | 'username' | 'role' | 'created_at'>)
}
