import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatCustomerName } from '@/lib/customer-name'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are missing')
  }

  return createClient(url, anonKey)
}

export interface SalesRecord {
  apartmentId: string
  saleType: 'reservation' | 'deposit' | 'sold'
  customerName: string
  customerPhone: string
  date: string
}

function normalizeSaleDate(input: string) {
  const parsed = new Date(input)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()

  const match = String(input || '').match(/(\d{2})\.(\d{2})\.(\d{4})/)
  if (match) {
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)
    const year = parseInt(match[3], 10)
    const normalized = new Date(year, month - 1, day)
    if (!Number.isNaN(normalized.getTime())) return normalized.toISOString()
  }

  return new Date().toISOString()
}

export async function GET() {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const records = (data || []).map((row: any) => ({
      apartmentId: row.apartment_id,
      saleType: row.sale_type,
      customerName: formatCustomerName(row.customer_name || ''),
      customerPhone: row.customer_phone,
      date: row.date,
    }))

    return NextResponse.json(records)
  } catch (error) {
    console.error('Sales GET error:', error)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const records: SalesRecord[] = Array.isArray(body)
      ? body
      : Array.isArray(body.records)
        ? body.records
        : [body]

    for (const record of records) {
      const safeDate = normalizeSaleDate(record.date)
      const normalizedCustomerName = formatCustomerName(record.customerName)

      const { data: existing, error: existingError } = await supabase
        .from('sales')
        .select('id')
        .eq('apartment_id', record.apartmentId)
        .maybeSingle()

      if (existingError) throw existingError

      if (existing) {
        const { error: updateError } = await supabase
          .from('sales')
          .update({
            sale_type: record.saleType,
            customer_name: normalizedCustomerName,
            customer_phone: record.customerPhone,
            date: safeDate,
          })
          .eq('apartment_id', record.apartmentId)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('sales').insert({
          apartment_id: record.apartmentId,
          sale_type: record.saleType,
          customer_name: normalizedCustomerName,
          customer_phone: record.customerPhone,
          date: safeDate,
        })

        if (insertError) throw insertError
      }
    }

    const { data, error: listError } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    if (listError) throw listError

    const updated = (data || []).map((row: any) => ({
      apartmentId: row.apartment_id,
      saleType: row.sale_type,
      customerName: formatCustomerName(row.customer_name || ''),
      customerPhone: row.customer_phone,
      date: row.date,
    }))

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Sales POST error:', error)
    return NextResponse.json({ error: 'Failed to save sales records' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const apartmentId = body?.apartmentId
    if (!apartmentId) {
      return NextResponse.json({ error: 'apartmentId required' }, { status: 400 })
    }

    const { error: deleteError } = await supabase.from('sales').delete().eq('apartment_id', apartmentId)
    if (deleteError) throw deleteError

    const { data, error: listError } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    if (listError) throw listError

    const updated = (data || []).map((row: any) => ({
      apartmentId: row.apartment_id,
      saleType: row.sale_type,
      customerName: formatCustomerName(row.customer_name || ''),
      customerPhone: row.customer_phone,
      date: row.date,
    }))

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Sales DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete sales record' }, { status: 500 })
  }
}
