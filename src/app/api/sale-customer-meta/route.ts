import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const TABLE = 'sale_customer_meta'

interface SaleCustomerMetaPayload {
  apartmentId: string
  customerAddress?: string
  customerIdentityNo?: string
}

function mapRows(rows: any[]) {
  return (rows || []).reduce<Record<string, { customerAddress?: string; customerIdentityNo?: string }>>((acc, row) => {
    acc[row.apartment_id] = {
      customerAddress: row.customer_address || '',
      customerIdentityNo: row.customer_identity_no || '',
    }
    return acc
  }, {})
}

export async function GET() {
  try {
    const { data, error } = await supabase.from(TABLE).select('*')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(mapRows(data || []))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sale customer meta fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const records: SaleCustomerMetaPayload[] = Array.isArray(body)
      ? body
      : Array.isArray(body.records)
        ? body.records
        : [body]

    for (const record of records) {
      const apartmentId = String(record?.apartmentId || '').trim()
      if (!apartmentId) continue

      const payload = {
        apartment_id: apartmentId,
        customer_address: String(record?.customerAddress || '').trim(),
        customer_identity_no: String(record?.customerIdentityNo || '').trim(),
        updated_at: new Date().toISOString(),
      }

      const { data: existing } = await supabase
        .from(TABLE)
        .select('id')
        .eq('apartment_id', apartmentId)
        .maybeSingle()

      if (existing) {
        await supabase.from(TABLE).update(payload).eq('apartment_id', apartmentId)
      } else {
        await supabase.from(TABLE).insert(payload)
      }
    }

    const { data, error } = await supabase.from(TABLE).select('*')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(mapRows(data || []))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sale customer meta save failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const apartmentIds = Array.isArray(body?.apartmentIds)
      ? body.apartmentIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : [String(body?.apartmentId || '').trim()].filter(Boolean)

    if (apartmentIds.length === 0) {
      return NextResponse.json({ error: 'apartmentId required' }, { status: 400 })
    }

    const { error } = await supabase.from(TABLE).delete().in('apartment_id', apartmentIds)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sale customer meta delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
