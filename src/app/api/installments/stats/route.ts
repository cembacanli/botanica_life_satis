import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface SaleDetailRow {
  sale_price: number | null
  remaining_balance: number | null
  installment_months: number | null
  start_date: string | null
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sale_details')
      .select('sale_price, remaining_balance, installment_months, start_date')

    if (error) {
      throw error
    }

    const apartments = (data || []) as SaleDetailRow[]
    const now = new Date()

    const stats = {
      totalApartments: apartments.length,
      paidApartments: apartments.filter((apt) => (apt.remaining_balance || 0) === 0).length,
      installedApartments: apartments.filter((apt) => (apt.installment_months || 0) > 1).length,
      cashApartments: apartments.filter((apt) => !apt.installment_months || apt.installment_months === 1).length,
      totalRevenue: apartments.reduce((sum, apt) => sum + (apt.sale_price || 0), 0),
      totalPaid: apartments.reduce(
        (sum, apt) => sum + Math.max(0, (apt.sale_price || 0) - (apt.remaining_balance || 0)),
        0
      ),
      totalDue: apartments.reduce((sum, apt) => sum + (apt.remaining_balance || 0), 0),
      overdueApartments: apartments.filter((apt) => {
        if (!apt.start_date || !apt.installment_months || apt.installment_months <= 1) return false
        const startDate = new Date(apt.start_date)
        if (Number.isNaN(startDate.getTime())) return false
        return (apt.remaining_balance || 0) > 0 && startDate < now
      }).length,
      installmentDistribution: {
        '3months': apartments.filter((apt) => apt.installment_months === 3).length,
        '6months': apartments.filter((apt) => apt.installment_months === 6).length,
        '12months': apartments.filter((apt) => apt.installment_months === 12).length,
        '24months': apartments.filter((apt) => apt.installment_months === 24).length,
        '36months': apartments.filter((apt) => apt.installment_months === 36).length,
      },
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Stats calculation failed' }, { status: 500 })
  }
}
