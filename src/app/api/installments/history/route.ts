import { NextResponse } from 'next/server'

// Taksit değişiklik geçmişi
let installmentHistory: Array<{
  id: string
  apartmentId: string
  timestamp: string
  changeType: string
  oldValue?: Record<string, any>
  newValue: Record<string, any>
  changedBy?: string
  notes?: string
}> = []

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const apartmentId = searchParams.get('apartmentId')
    const limit = parseInt(searchParams.get('limit') || '50')

    let filtered = installmentHistory

    if (apartmentId) {
      filtered = filtered.filter(h => h.apartmentId === apartmentId)
    }

    // En yeniden başla
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      total: filtered.length,
      data: filtered.slice(0, limit),
    })
  } catch (error) {
    console.error('History error:', error)
    return NextResponse.json({ error: 'History fetch failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    const historyEntry = {
      id: `hist_${Date.now()}`,
      apartmentId: data.apartmentId,
      timestamp: new Date().toISOString(),
      changeType: data.changeType || 'updated',
      oldValue: data.oldValue,
      newValue: data.newValue,
      changedBy: data.changedBy,
      notes: data.notes,
    }

    installmentHistory.push(historyEntry)

    // Sadece son 1000'i tut
    if (installmentHistory.length > 1000) {
      installmentHistory = installmentHistory.slice(-1000)
    }

    return NextResponse.json(historyEntry, { status: 201 })
  } catch (error) {
    console.error('History save error:', error)
    return NextResponse.json({ error: 'History save failed' }, { status: 500 })
  }
}
