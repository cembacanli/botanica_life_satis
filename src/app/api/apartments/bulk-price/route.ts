import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { block, floor, facade, operationType, value } = body

    if (!operationType || typeof value !== 'number') {
      return NextResponse.json({ error: 'Missing operationType or invalid value' }, { status: 400 })
    }

    // Build the query to find all available/unsold apartments matching the filters
    let query = supabase.from('apartments').select('*').eq('status', 'available')

    if (block && block !== 'Tümü') {
      query = query.eq('block', block)
    }
    if (floor && floor !== 'Tümü') {
      query = query.eq('floor', Number(floor))
    }
    if (facade && facade !== 'Tümü') {
      query = query.eq('facade', facade)
    }

    const { data: apartments, error: fetchError } = await query
    if (fetchError) {
      console.error('Fetch apartments error for bulk update:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!apartments || apartments.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0, message: 'Kriterlere uygun satılık daire bulunamadı.' })
    }

    // Calculate new prices and create updates payload with full rows to be safe
    const updates = apartments.map((apt) => {
      let newPrice = apt.price
      if (operationType === 'percentage') {
        newPrice = Math.round(apt.price * (1 + value / 100))
      } else if (operationType === 'fixed') {
        newPrice = apt.price + value
      }
      // Guarantee price is non-negative
      if (newPrice < 0) newPrice = 0

      return {
        ...apt,
        price: newPrice,
      }
    })

    // Upsert the full rows back to Supabase
    const { error: updateError } = await supabase.from('apartments').upsert(updates)
    if (updateError) {
      console.error('Bulk update price error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      updatedCount: updates.length,
      message: `${updates.length} dairenin fiyatı başarıyla güncellendi.`,
    })
  } catch (error: any) {
    console.error('Bulk price route error:', error)
    return NextResponse.json({ error: error.message || 'Bulk price update failed' }, { status: 500 })
  }
}
