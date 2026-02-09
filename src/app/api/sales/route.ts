import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface SalesRecord {
  apartmentId: string
  saleType: 'reservation' | 'deposit' | 'sold'
  customerName: string
  customerPhone: string
  date: string
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Database'den gelen verileri frontend formatına çevir
    const records = (data || []).map((row: any) => ({
      apartmentId: row.apartment_id,
      saleType: row.sale_type,
      customerName: row.customer_name,
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
    const body = await request.json()
    const records: SalesRecord[] = Array.isArray(body)
      ? body
      : Array.isArray(body.records)
      ? body.records
      : [body]

    // Her kayıt için upsert yap
    for (const record of records) {
      // Önce var mı kontrol et
      const { data: existing } = await supabase
        .from('sales')
        .select('id')
        .eq('apartment_id', record.apartmentId)
        .single()

      if (existing) {
        // Güncelle
        await supabase
          .from('sales')
          .update({
            sale_type: record.saleType,
            customer_name: record.customerName,
            customer_phone: record.customerPhone,
            date: record.date,
          })
          .eq('apartment_id', record.apartmentId)
      } else {
        // Ekle
        await supabase.from('sales').insert({
          apartment_id: record.apartmentId,
          sale_type: record.saleType,
          customer_name: record.customerName,
          customer_phone: record.customerPhone,
          date: record.date,
        })
      }
    }

    // Güncel listeyi döndür
    const { data } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    const updated = (data || []).map((row: any) => ({
      apartmentId: row.apartment_id,
      saleType: row.sale_type,
      customerName: row.customer_name,
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
    const body = await request.json()
    const apartmentId = body?.apartmentId
    if (!apartmentId) {
      return NextResponse.json({ error: 'apartmentId required' }, { status: 400 })
    }

    await supabase.from('sales').delete().eq('apartment_id', apartmentId)

    // Güncel listeyi döndür
    const { data } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    const updated = (data || []).map((row: any) => ({
      apartmentId: row.apartment_id,
      saleType: row.sale_type,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      date: row.date,
    }))

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Sales DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete sales record' }, { status: 500 })
  }
}
