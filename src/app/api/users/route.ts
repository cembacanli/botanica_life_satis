import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ensureUsersSeeded, hashPassword, requireAdminUser, toPublicUser } from '@/lib/user-auth'

const USER_TABLE = 'app_users'

function unauthorized() {
  return NextResponse.json({ error: 'admin authorization required' }, { status: 403 })
}

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdminUser(request)
    if (!adminUser) return unauthorized()

    await ensureUsersSeeded()

    const { data, error } = await supabase
      .from(USER_TABLE)
      .select('id, username, role, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json((data || []).map((user) => toPublicUser(user)))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Users fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdminUser(request)
    if (!adminUser) return unauthorized()

    const body = await request.json()
    const username = String(body?.username || '').trim()
    const password = String(body?.password || '').trim()
    const role = body?.role === 'admin' ? 'admin' : 'user'

    if (!username || !password) {
      return NextResponse.json({ error: 'username and password required' }, { status: 400 })
    }

    await ensureUsersSeeded()

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
      .insert({
        username,
        password: hashPassword(password),
        role,
        created_at: new Date().toISOString(),
      })
      .select('id, username, role, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(toPublicUser(data))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'User create failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminUser = await requireAdminUser(request)
    if (!adminUser) return unauthorized()

    const body = await request.json()
    const id = String(body?.id || '').trim()

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    if (id === adminUser.id) {
      return NextResponse.json({ error: 'cannot delete current admin user' }, { status: 400 })
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
