import { NextRequest, NextResponse } from 'next/server'
import { getSalesRecords, removeSalesRecord, upsertSalesRecords, type SalesRecord } from '@/lib/sales-store'

export async function GET() {
  return NextResponse.json(getSalesRecords())
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const records: SalesRecord[] = Array.isArray(body)
      ? body
      : Array.isArray(body.records)
      ? body.records
      : [body]

    const updated = upsertSalesRecords(records)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Sales POST error:', error)
    return NextResponse.json({ error: 'Failed to save sales records' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const apartmentId = body?.apartmentId
    if (!apartmentId) {
      return NextResponse.json({ error: 'apartmentId required' }, { status: 400 })
    }

    const updated = removeSalesRecord(apartmentId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Sales DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete sales record' }, { status: 500 })
  }
}
