import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, encodeSessionUser } from '@/lib/auth-session'
import { authenticateUser } from '@/lib/user-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username = String(body?.username || '').trim()
    const password = String(body?.password || '').trim()

    if (!username || !password) {
      return NextResponse.json({ error: 'username and password required' }, { status: 400 })
    }

    const user = await authenticateUser(username, password)
    if (!user) {
      return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
    }

    const response = NextResponse.json({ user })
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: encodeSessionUser(user),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
