import { NextResponse } from 'next/server'

interface InstallmentReport {
  apartmentId: string
  block: string
  number: number
  customerName: string
  salePrice: number
  deposit: number
  installmentMonths: number
  monthlyPayment: number
  startDate: string
  totalPaid: number
  remainingBalance: number
  paymentPercentage: number
  status: 'paid' | 'ongoing' | 'overdue' | 'pending'
  nextDueDate?: string
  nextDueAmount?: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // all, overdue, upcoming, paid
    const block = searchParams.get('block')
    const sort = searchParams.get('sort') || 'dueDate' // dueDate, remaining, customer

    // Veritabanından taksit verilerini al (şimdilik mock)
    let reports: InstallmentReport[] = []

    // Filtreleme
    if (filter === 'overdue') {
      reports = reports.filter(r => r.status === 'overdue')
    } else if (filter === 'upcoming') {
      reports = reports.filter(r => r.status === 'ongoing' && new Date(r.nextDueDate || '') < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    } else if (filter === 'paid') {
      reports = reports.filter(r => r.status === 'paid')
    }

    // Blok filtresi
    if (block) {
      reports = reports.filter(r => r.block === block)
    }

    // Sıralama
    if (sort === 'remaining') {
      reports.sort((a, b) => b.remainingBalance - a.remainingBalance)
    } else if (sort === 'customer') {
      reports.sort((a, b) => a.customerName.localeCompare(b.customerName, 'tr-TR'))
    } else {
      reports.sort((a, b) => new Date(a.nextDueDate || '').getTime() - new Date(b.nextDueDate || '').getTime())
    }

    return NextResponse.json({
      total: reports.length,
      data: reports,
    })
  } catch (error) {
    console.error('Report error:', error)
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}
