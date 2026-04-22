import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AUTH_COOKIE_NAME, decodeSessionUser } from '@/lib/auth-session'

const USER_TABLE = 'app_users'

export async function GET(request: NextRequest) {
  try {
    const cookieValue = request.cookies.get(AUTH_COOKIE_NAME)?.value
    const sessionUser = decodeSessionUser(cookieValue)
    if (!sessionUser?.id) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const { data, error } = await supabase
      .from(USER_TABLE)
      .select('id, username, role, created_at')
      .eq('id', sessionUser.id)
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      const response = NextResponse.json({ user: null }, { status: 401 })
      response.cookies.delete(AUTH_COOKIE_NAME)
      return response
    }

    return NextResponse.json({
      user: {
        id: data.id,
        username: data.username,
        role: data.role,
        createdAt: data.created_at,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auth session check failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
