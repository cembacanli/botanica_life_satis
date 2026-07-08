import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatCustomerName } from '@/lib/customer-name'

type SaleType = 'reservation' | 'deposit' | 'sold' | 'barter' | 'landowner'

interface ApartmentRow {
  id: string
  block: string | null
  floor: number | null
  number: number | null
}

interface SalesRow {
  apartment_id: string | null
  sale_type: SaleType | null
  customer_name: string | null
  customer_phone: string | null
  date: string | null
  created_at: string | null
}

interface PaymentRecord {
  amount?: number | string | null
  date?: string
  label?: string
}

interface SaleDetailsRow {
  apartment_id: string | null
  deposit_amount: number | null
  sale_price: number | null
  payments: PaymentRecord[] | null
  remaining_balance: number | null
}

interface ReportRow {
  apartmentId: string
  block: string
  floor: number
  number: number
  saleType: SaleType
  customerName: string
  customerFirstName: string
  customerLastName: string
  customerPhone: string
  date: string
  salePrice: number
  totalPaid: number
  remainingBalance: number
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are missing')
  }

  return createClient(url, anonKey)
}

function toNumber(value: unknown) {
  const numeric = Number(value || 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function splitCustomerName(customerName: string) {
  const parts = String(customerName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return {
      firstName: '-',
      lastName: '-',
    }
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: '-',
    }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function getSortWeight(block: string) {
  const weights: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 }
  return weights[block] || 99
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const blockFilter = String(searchParams.get('block') || '')
      .trim()
      .toUpperCase()

    const supabase = getSupabase()

    const [
      { data: apartments, error: apartmentsError },
      { data: sales, error: salesError },
      { data: saleDetails, error: saleDetailsError },
    ] = await Promise.all([
      supabase.from('apartments').select('id, block, floor, number'),
      supabase
        .from('sales')
        .select('apartment_id, sale_type, customer_name, customer_phone, date, created_at')
        .order('date', { ascending: false }),
      supabase.from('sale_details').select('apartment_id, deposit_amount, sale_price, payments, remaining_balance'),
    ])

    if (apartmentsError) throw apartmentsError
    if (salesError) throw salesError
    if (saleDetailsError) throw saleDetailsError

    const apartmentMap = new Map<string, ApartmentRow>()
    for (const apartment of (apartments || []) as ApartmentRow[]) {
      apartmentMap.set(apartment.id, apartment)
    }

    const saleDetailsMap = new Map<string, SaleDetailsRow>()
    for (const detail of (saleDetails || []) as SaleDetailsRow[]) {
      if (detail.apartment_id) {
        saleDetailsMap.set(detail.apartment_id, detail)
      }
    }

    const rows = ((sales || []) as SalesRow[])
      .map((sale): ReportRow | null => {
        const apartmentId = String(sale.apartment_id || '').trim()
        if (!apartmentId) return null

        const apartment = apartmentMap.get(apartmentId)
        const detail = saleDetailsMap.get(apartmentId)
        const depositAmount = toNumber(detail?.deposit_amount)
        const paymentsTotal = Array.isArray(detail?.payments)
          ? detail!.payments.reduce((sum, payment) => sum + toNumber(payment?.amount), 0)
          : 0
        const totalPaid = depositAmount + paymentsTotal
        const salePrice = toNumber(detail?.sale_price)
        const fallbackRemaining = Math.max(0, salePrice - totalPaid)
        const remainingBalance =
          detail?.remaining_balance === null || detail?.remaining_balance === undefined
            ? fallbackRemaining
            : Math.max(0, toNumber(detail.remaining_balance))
        const customerName = formatCustomerName(String(sale.customer_name || '').trim()) || '-'
        const { firstName, lastName } = splitCustomerName(customerName)

        return {
          apartmentId,
          block: String(apartment?.block || '?'),
          floor: toNumber(apartment?.floor),
          number: toNumber(apartment?.number),
          saleType: (sale.sale_type || 'reservation') as SaleType,
          customerName,
          customerFirstName: firstName,
          customerLastName: lastName,
          customerPhone: String(sale.customer_phone || '').trim(),
          date: sale.date || sale.created_at || new Date().toISOString(),
          salePrice,
          totalPaid,
          remainingBalance,
        }
      })
      .filter((row): row is ReportRow => row !== null)

    // Barter ve arsa sahibi işlemleri finansal tutarları etkilememelidir.
    // Bunlar tabloda görüntülenir ancak satış tutarı toplamlarına dahil edilmez.
    const EXCLUDED_FROM_TOTALS: SaleType[] = ['barter', 'landowner']

    const filteredRows = rows.filter(row => {
      if (blockFilter && row.block !== blockFilter) return false
      return row.salePrice > 0 || row.totalPaid > 0 || row.remainingBalance > 0 || EXCLUDED_FROM_TOTALS.includes(row.saleType)
    })

    // Finansal toplamlara dahil edilecek satırlar (barter ve arsa sahibi hariç)
    const financialRows = filteredRows.filter(row => !EXCLUDED_FROM_TOTALS.includes(row.saleType))

    filteredRows.sort((a, b) => {
      if (a.block !== b.block) return getSortWeight(a.block) - getSortWeight(b.block)
      if (a.floor !== b.floor) return a.floor - b.floor
      return a.number - b.number
    })

    const blockOrder = ['A', 'B', 'C', 'D']
    const blockEntries = blockOrder
      .map(block => {
        const items = filteredRows.filter(row => row.block === block)
        if (items.length === 0) return null

        // Finansal toplamlarda sadece gerçek satışlar (barter ve arsa sahibi hariç)
        const financialItems = items.filter(item => !EXCLUDED_FROM_TOTALS.includes(item.saleType))

        return {
          block,
          totalCount: items.length,
          totalSalePrice: financialItems.reduce((sum, item) => sum + item.salePrice, 0),
          totalPaid: financialItems.reduce((sum, item) => sum + item.totalPaid, 0),
          totalRemainingBalance: financialItems.reduce((sum, item) => sum + item.remainingBalance, 0),
          items,
        }
      })
      .filter(Boolean)

    const activity = rows
      .filter(row => !blockFilter || row.block === blockFilter)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      total: filteredRows.length,
      totals: {
        totalCount: filteredRows.length,
        // Barter ve arsa sahibi toplam satış tutarına dahil edilmez
        totalSalePrice: financialRows.reduce((sum, item) => sum + item.salePrice, 0),
        totalPaid: financialRows.reduce((sum, item) => sum + item.totalPaid, 0),
        totalRemainingBalance: financialRows.reduce((sum, item) => sum + item.remainingBalance, 0),
      },
      blocks: blockEntries,
      activity,
    })
  } catch (error) {
    console.error('Installment reports GET error:', error)
    return NextResponse.json({ error: 'Rapor verileri alınamadı.' }, { status: 500 })
  }
}
