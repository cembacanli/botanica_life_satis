import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SUBCONTRACTOR_PAYMENTS_TABLE = 'subcontractor_payments'

interface PaymentPayload {
  id?: string
  subcontractorId: string
  subcontractorName: string
  paymentDate: string
  amount: number
  paymentMethod?: string
  note?: string
}

function getActorUsername(request: NextRequest) {
  return String(request.headers.get('x-actor-username') || '').trim().toLocaleLowerCase('tr-TR')
}

function isPaymentsSchemaUnavailable(error: any) {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '')
  return (
    code === 'PGRST205' ||
    message.includes("could not find the table 'public.subcontractor_payments'") ||
    message.includes('subcontractor_id') ||
    message.includes('payment_date')
  )
}

function getSchemaErrorMessage() {
  return 'Supabase tablo/kolon yapisi eksik veya erisilemez: subcontractor_payments. Lutfen supabase/subcontractor_module.sql dosyasini Supabase SQL Editor uzerinden tekrar calistirin.'
}

function normalizeAndValidatePayload(body: PaymentPayload) {
  const subcontractorId = String(body?.subcontractorId || '').trim()
  const subcontractorName = String(body?.subcontractorName || '').trim()
  const paymentDate = String(body?.paymentDate || '').trim()
  const amount = Math.round(Number(body?.amount || 0))
  const paymentMethod = String(body?.paymentMethod || '').trim()
  const note = String(body?.note || '').trim()

  if (!subcontractorId || !subcontractorName || !paymentDate) return null
  if (!Number.isFinite(amount) || amount <= 0) return null

  return {
    subcontractorId,
    subcontractorName,
    paymentDate,
    amount,
    paymentMethod,
    note,
  }
}

function mapRow(row: any) {
  return {
    id: row.id,
    subcontractorId: row.subcontractor_id,
    subcontractorName: row.subcontractor_name,
    paymentDate: row.payment_date,
    amount: row.amount || 0,
    paymentMethod: row.payment_method || '',
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const subcontractorIdFilter = String(request.nextUrl.searchParams.get('subcontractorId') || '').trim()

    const query = supabase
      .from(SUBCONTRACTOR_PAYMENTS_TABLE)
      .select('*')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })

    const { data, error } = subcontractorIdFilter
      ? await query.eq('subcontractor_id', subcontractorIdFilter)
      : await query

    if (error) {
      if (isPaymentsSchemaUnavailable(error)) {
        return NextResponse.json([])
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json((data || []).map(mapRow))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractor payments fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = normalizeAndValidatePayload((await request.json()) as PaymentPayload)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from(SUBCONTRACTOR_PAYMENTS_TABLE)
      .insert({
        subcontractor_id: payload.subcontractorId,
        subcontractor_name: payload.subcontractorName,
        payment_date: payload.paymentDate,
        amount: payload.amount,
        payment_method: payload.paymentMethod,
        note: payload.note,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) {
      if (isPaymentsSchemaUnavailable(error)) {
        return NextResponse.json({ error: getSchemaErrorMessage() }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(mapRow(data))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractor payment create failed'
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

    const body = (await request.json()) as PaymentPayload
    const id = String(body?.id || '').trim()
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const payload = normalizeAndValidatePayload(body)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from(SUBCONTRACTOR_PAYMENTS_TABLE)
      .update({
        subcontractor_id: payload.subcontractorId,
        subcontractor_name: payload.subcontractorName,
        payment_date: payload.paymentDate,
        amount: payload.amount,
        payment_method: payload.paymentMethod,
        note: payload.note,
      })
      .eq('id', id)
      .select('*')

    if (error) {
      if (isPaymentsSchemaUnavailable(error)) {
        return NextResponse.json({ error: getSchemaErrorMessage() }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Kayit bulunamadi.' }, { status: 404 })
    }

    return NextResponse.json(mapRow(data[0]))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractor payment update failed'
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

    const { error } = await supabase.from(SUBCONTRACTOR_PAYMENTS_TABLE).delete().eq('id', id)
    if (error) {
      if (isPaymentsSchemaUnavailable(error)) {
        return NextResponse.json({ error: getSchemaErrorMessage() }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractor payment delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
