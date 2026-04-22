import { NextResponse } from 'next/server'
import { getApartmentStats } from '@/lib/apartments-store'

export async function GET() {
  try {
    const stats = await getApartmentStats()

    return NextResponse.json({
      message: 'Supabase apartments ready',
      source: 'supabase',
      totalApartments: stats.totalApartments,
      blocks: stats.blocks,
    })
  } catch (error) {
    console.error('Initialization error:', error)
    return NextResponse.json({ error: 'Initialization failed' }, { status: 500 })
  }
}
