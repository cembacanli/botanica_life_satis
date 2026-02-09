import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const USER_TABLE = 'app_users'

const DEFAULT_USERS = [
  {
    username: 'cem',
    password: '2127030cem',
    role: 'admin',
    created_at: new Date().toISOString(),
  },
  {
    username: 'satis1',
    password: '2127030satis1',
    role: 'user',
    created_at: new Date().toISOString(),
  },
  {
    username: 'satis2',
    password: '2127030satis2',
    role: 'user',
    created_at: new Date().toISOString(),
  },
]

async function ensureSeeded() {
  const { data, error } = await supabase.from(USER_TABLE).select('id').limit(1)
  if (error) {
    throw error
  }

  if (!data || data.length === 0) {
    const { error: insertError } = await supabase.from(USER_TABLE).insert(DEFAULT_USERS)
    if (insertError) {
      throw insertError
    }
  }
}

export async function GET() {
  try {
    await ensureSeeded()
    const { data, error } = await supabase
      .from(USER_TABLE)
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Users fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username = String(body?.username || '').trim()
    const password = String(body?.password || '').trim()
    const role = body?.role === 'admin' ? 'admin' : 'user'

    if (!username || !password) {
      return NextResponse.json({ error: 'username and password required' }, { status: 400 })
    }

    await ensureSeeded()

    const { data: existing, error: existingError } = await supabase
      .from(USER_TABLE)
      .select('id')
      .eq('username', username)
      .limit(1)

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'username already exists' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from(USER_TABLE)
      .insert({ username, password, role, created_at: new Date().toISOString() })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'User create failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const id = String(body?.id || '').trim()

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { error } = await supabase.from(USER_TABLE).delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'User delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
