import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface SaleDetails {
  apartmentId: string
  depositAmount: number
  salePrice: number
  installmentMonths: number
  monthlyPayment: number
  payments: Array<{ amount: number; date: string }>
  remainingBalance: number
  startDate?: string
  paymentMethod?: string
  customSchedule?: number[]
}

export async function GET(request: NextRequest) {
  try {
    const apartmentId = request.nextUrl.searchParams.get('apartmentId')
    
    if (apartmentId) {
      const { data, error } = await supabase
        .from('sale_details')
        .select('*')
        .eq('apartment_id', apartmentId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return NextResponse.json(null)
        }
        throw error
      }

      return NextResponse.json({
        apartmentId: data.apartment_id,
        depositAmount: data.deposit_amount,
        salePrice: data.sale_price,
        installmentMonths: data.installment_months,
        monthlyPayment: data.monthly_payment,
        payments: data.payments || [],
        remainingBalance: data.remaining_balance,
        startDate: data.start_date,
        paymentMethod: data.payment_method,
        customSchedule: data.custom_schedule,
      })
    }

    // Tüm detayları döndür
    const { data, error } = await supabase.from('sale_details').select('*')
    if (error) throw error

    const allDetails: Record<string, any> = {}
    ;(data || []).forEach((row: any) => {
      allDetails[row.apartment_id] = {
        apartmentId: row.apartment_id,
        depositAmount: row.deposit_amount,
        salePrice: row.sale_price,
        installmentMonths: row.installment_months,
        monthlyPayment: row.monthly_payment,
        payments: row.payments || [],
        remainingBalance: row.remaining_balance,
        startDate: row.start_date,
        paymentMethod: row.payment_method,
        customSchedule: row.custom_schedule,
      }
    })

    return NextResponse.json(allDetails)
  } catch (error) {
    console.error('Sale details GET error:', error)
    return NextResponse.json({}, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const details: SaleDetails[] = Array.isArray(body)
      ? body
      : Array.isArray(body.details)
      ? body.details
      : [body]

    for (const detail of details) {
      const { data: existing } = await supabase
        .from('sale_details')
        .select('id')
        .eq('apartment_id', detail.apartmentId)
        .single()

      const dbRecord = {
        apartment_id: detail.apartmentId,
        deposit_amount: detail.depositAmount,
        sale_price: detail.salePrice,
        installment_months: detail.installmentMonths,
        monthly_payment: detail.monthlyPayment,
        payments: detail.payments,
        remaining_balance: detail.remainingBalance,
        start_date: detail.startDate,
        payment_method: detail.paymentMethod,
        custom_schedule: detail.customSchedule,
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        await supabase
          .from('sale_details')
          .update(dbRecord)
          .eq('apartment_id', detail.apartmentId)
      } else {
        await supabase.from('sale_details').insert(dbRecord)
      }
    }

    // Güncel listeyi döndür
    const { data } = await supabase.from('sale_details').select('*')
    const allDetails: Record<string, any> = {}
    ;(data || []).forEach((row: any) => {
      allDetails[row.apartment_id] = {
        apartmentId: row.apartment_id,
        depositAmount: row.deposit_amount,
        salePrice: row.sale_price,
        installmentMonths: row.installment_months,
        monthlyPayment: row.monthly_payment,
        payments: row.payments || [],
        remainingBalance: row.remaining_balance,
        startDate: row.start_date,
        paymentMethod: row.payment_method,
        customSchedule: row.custom_schedule,
      }
    })

    return NextResponse.json(allDetails)
  } catch (error) {
    console.error('Sale details POST error:', error)
    return NextResponse.json({ error: 'Failed to save sale details' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const apartmentId = body?.apartmentId
    if (!apartmentId) {
      return NextResponse.json({ error: 'apartmentId required' }, { status: 400 })
    }

    await supabase.from('sale_details').delete().eq('apartment_id', apartmentId)

    // Güncel listeyi döndür
    const { data } = await supabase.from('sale_details').select('*')
    const allDetails: Record<string, any> = {}
    ;(data || []).forEach((row: any) => {
      allDetails[row.apartment_id] = {
        apartmentId: row.apartment_id,
        depositAmount: row.deposit_amount,
        salePrice: row.sale_price,
        installmentMonths: row.installment_months,
        monthlyPayment: row.monthly_payment,
        payments: row.payments || [],
        remainingBalance: row.remaining_balance,
        startDate: row.start_date,
        paymentMethod: row.payment_method,
        customSchedule: row.custom_schedule,
      }
    })

    return NextResponse.json(allDetails)
  } catch (error) {
    console.error('Sale details DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete sale details' }, { status: 500 })
  }
}
