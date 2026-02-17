import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { addCostRecord, getCostRecords, removeCostRecord, updateCostRecord } from '@/lib/costs-store'

const COSTS_TABLE = 'costs'

interface CostPayload {
  itemName: string
  category: string
  amount: number
  date: string
  note?: string
}

function getActorUsername(request: NextRequest) {
  return String(request.headers.get('x-actor-username') || '').trim().toLocaleLowerCase('tr-TR')
}

function isCostsTableMissing(error: any) {
  const message = String(error?.message || '')
  const code = String(error?.code || '')
  return code === 'PGRST205' || message.toLowerCase().includes("could not find the table 'public.costs'")
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from(COSTS_TABLE)
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      if (isCostsTableMissing(error)) {
        return NextResponse.json(getCostRecords())
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data || []).map((row: any) => ({
      id: row.id,
      itemName: row.item_name,
      category: row.category,
      amount: row.amount || 0,
      date: row.date,
      note: row.note || '',
      createdAt: row.created_at,
    }))

    return NextResponse.json(rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Costs fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CostPayload

    const itemName = String(body?.itemName || '').trim()
    const category = String(body?.category || '').trim()
    const amount = Number(body?.amount || 0)
    const date = String(body?.date || '').trim()
    const note = String(body?.note || '').trim()

    if (!itemName || !category || !date || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const payload = {
      item_name: itemName,
      category,
      amount: Math.round(amount),
      date,
      note,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from(COSTS_TABLE).insert(payload).select('*').single()

    if (error) {
      if (isCostsTableMissing(error)) {
        const local = addCostRecord({
          itemName,
          category,
          amount: Math.round(amount),
          date,
          note,
        })
        return NextResponse.json(local)
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: data.id,
      itemName: data.item_name,
      category: data.category,
      amount: data.amount || 0,
      date: data.date,
      note: data.note || '',
      createdAt: data.created_at,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cost create failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = getActorUsername(request)
    if (actor !== 'cem') {
      return NextResponse.json(
        { error: 'Bu islem icin yetkiniz yok. Sadece cem kullanicisi duzenleme yapabilir.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const id = String(body?.id || '').trim()
    const itemName = String(body?.itemName || '').trim()
    const category = String(body?.category || '').trim()
    const amount = Number(body?.amount || 0)
    const date = String(body?.date || '').trim()
    const note = String(body?.note || '').trim()

    if (!id || !itemName || !category || !date || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const updatePayload = {
      item_name: itemName,
      category,
      amount: Math.round(amount),
      date,
      note,
    }

    const { data, error } = await supabase
      .from(COSTS_TABLE)
      .update(updatePayload)
      .eq('id', id)
      .select('*')

    if (error) {
      if (isCostsTableMissing(error)) {
        const local = updateCostRecord(id, {
          itemName,
          category,
          amount: Math.round(amount),
          date,
          note,
        })
        if (!local) return NextResponse.json({ error: 'Cost not found' }, { status: 404 })
        return NextResponse.json(local)
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Kayit bulunamadi veya veritabani update policy izin vermiyor.' },
        { status: 404 }
      )
    }

    const row = data[0]
    return NextResponse.json({
      id: row.id,
      itemName: row.item_name,
      category: row.category,
      amount: row.amount || 0,
      date: row.date,
      note: row.note || '',
      createdAt: row.created_at,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cost update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = getActorUsername(request)
    if (actor !== 'cem') {
      return NextResponse.json(
        { error: 'Bu islem icin yetkiniz yok. Sadece cem kullanicisi silme yapabilir.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const id = String(body?.id || '').trim()
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { error } = await supabase.from(COSTS_TABLE).delete().eq('id', id)
    if (error) {
      if (isCostsTableMissing(error)) {
        const deleted = removeCostRecord(id)
        if (!deleted) return NextResponse.json({ error: 'Cost not found' }, { status: 404 })
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cost delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
