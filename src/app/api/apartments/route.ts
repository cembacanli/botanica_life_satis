import { NextRequest, NextResponse } from 'next/server'
import { generateApartments, type Apartment } from '@/lib/data-generator'

// In-memory storage for apartments (replace with database in production)
let apartments: Apartment[] | null = null

export async function GET(request: NextRequest) {
  try {
    // Initialize apartments if not done yet
    if (!apartments) {
      apartments = generateApartments().map((apt, idx) => ({
        ...apt,
        id: `apt-${idx}`,
        created_at: new Date().toISOString(),
      }))
    }

    const block = request.nextUrl.searchParams.get('block')
    const floor = request.nextUrl.searchParams.get('floor')
    const facade = request.nextUrl.searchParams.get('facade')

    let filtered = apartments

    if (block) filtered = filtered.filter(apt => apt.block === block)
    if (floor) filtered = filtered.filter(apt => apt.floor === parseInt(floor))
    if (facade) filtered = filtered.filter(apt => apt.facade === facade)

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch apartments' }, { status: 500 })
  }
}
