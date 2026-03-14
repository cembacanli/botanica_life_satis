import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const TABLE = 'construction_cost_scenarios'

interface ScenarioPayload {
  id?: string
  inputs: Record<string, unknown>
  blocks: unknown[]
}

function mapRow(row: any) {
  const inputs = row.inputs || {}
  return {
    id: row.id,
    savedAt: row.created_at,
    inputs,
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json((data || []).map(mapRow))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Construction scenarios fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScenarioPayload
    const inputs = body?.inputs || {}
    const blocks = Array.isArray(body?.blocks) ? body.blocks : []
    const scenarioName = String((inputs as any)?.scenarioName || '').trim()

    if (!scenarioName || blocks.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        scenario_name: scenarioName,
        inputs,
        blocks,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(mapRow(data))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Construction scenario create failed'
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
    const message = error instanceof Error ? error.message : 'Construction scenario delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as ScenarioPayload
    const id = String(body?.id || '').trim()
    const inputs = body?.inputs || {}
    const blocks = Array.isArray(body?.blocks) ? body.blocks : []
    const scenarioName = String((inputs as any)?.scenarioName || '').trim()

    if (!id || !scenarioName || blocks.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        scenario_name: scenarioName,
        inputs,
        blocks,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(mapRow(data))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Construction scenario update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
