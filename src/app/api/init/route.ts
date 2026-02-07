import { NextRequest, NextResponse } from 'next/server'
import { generateApartments } from '@/lib/data-generator'

export async function GET(request: NextRequest) {
  try {
    const apartments = generateApartments()

    return NextResponse.json({
      message: 'Database initialized successfully',
      totalApartments: apartments.length,
      blocks: {
        'A-B': '60 daire (2+1, 90m²)',
        'C-D': '120 daire (1+1, 45m²)',
      },
    })
  } catch (error) {
    console.error('Initialization error:', error)
    return NextResponse.json({ error: 'Initialization failed' }, { status: 500 })
  }
}
