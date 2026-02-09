import { NextRequest, NextResponse } from 'next/server'
import { getAllSaleDetails, getSaleDetails, removeSaleDetails, upsertSaleDetails, type SaleDetails } from '@/lib/sales-store'

export async function GET(request: NextRequest) {
  const apartmentId = request.nextUrl.searchParams.get('apartmentId')
  if (apartmentId) {
    return NextResponse.json(getSaleDetails(apartmentId))
  }
  return NextResponse.json(getAllSaleDetails())
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const details: SaleDetails[] = Array.isArray(body)
      ? body
      : Array.isArray(body.details)
      ? body.details
      : [body]

    const updated = upsertSaleDetails(details)
    return NextResponse.json(updated)
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

    const updated = removeSaleDetails(apartmentId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Sale details DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete sale details' }, { status: 500 })
  }
}
