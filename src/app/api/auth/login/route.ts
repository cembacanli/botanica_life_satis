import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const USER_TABLE = 'app_users'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username = String(body?.username || '').trim()
    const password = String(body?.password || '').trim()

    if (!username || !password) {
      return NextResponse.json({ error: 'username and password required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from(USER_TABLE)
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
    }

    return NextResponse.json({ user: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
