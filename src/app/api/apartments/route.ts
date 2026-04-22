import { NextRequest, NextResponse } from 'next/server'
import { listApartments } from '@/lib/apartments-store'

export async function GET(request: NextRequest) {
  try {
    const apartments = await listApartments({
      block: request.nextUrl.searchParams.get('block'),
      floor: request.nextUrl.searchParams.get('floor'),
      facade: request.nextUrl.searchParams.get('facade'),
    })

    return NextResponse.json(apartments)
  } catch (error) {
    console.error('Apartments fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch apartments' }, { status: 500 })
  }
}
