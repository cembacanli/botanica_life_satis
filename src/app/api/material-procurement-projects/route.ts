import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const TABLE = 'material_procurement_projects'

type ModulePayload = {
  id?: string
  project: Record<string, unknown>
  mortar: Record<string, unknown>
  materials: unknown[]
  walls: unknown[]
  username?: string
}

function mapRow(row: any) {
  return {
    id: row.id,
    projectName: row.project_name || '',
    project: row.project || {},
    mortar: row.mortar || {},
    materials: Array.isArray(row.materials) ? row.materials : [],
    walls: Array.isArray(row.walls) ? row.walls : [],
    username: row.username || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase.from(TABLE).select('*').order('updated_at', { ascending: false })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json((data || []).map(mapRow))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Material procurement projects fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ModulePayload
    const project = body?.project || {}
    const mortar = body?.mortar || {}
    const materials = Array.isArray(body?.materials) ? body.materials : []
    const walls = Array.isArray(body?.walls) ? body.walls : []
    const projectName = String((project as any)?.projectName || '').trim()
    const username = String(body?.username || '').trim()

    if (!projectName) {
      return NextResponse.json({ error: 'Proje adı zorunludur.' }, { status: 400 })
    }

    const payload = {
      project_name: projectName,
      project,
      mortar,
      materials,
      walls,
      username,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(mapRow(data))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Material procurement project create failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as ModulePayload
    const id = String(body?.id || '').trim()
    const project = body?.project || {}
    const mortar = body?.mortar || {}
    const materials = Array.isArray(body?.materials) ? body.materials : []
    const walls = Array.isArray(body?.walls) ? body.walls : []
    const projectName = String((project as any)?.projectName || '').trim()
    const username = String(body?.username || '').trim()

    if (!id || !projectName) {
      return NextResponse.json({ error: 'Geçersiz kayıt verisi.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        project_name: projectName,
        project,
        mortar,
        materials,
        walls,
        username,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(mapRow(data))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Material procurement project update failed'
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

    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Material procurement project delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
