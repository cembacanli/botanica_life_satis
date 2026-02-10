import { NextResponse } from 'next/server'

// Taksit istatistikleri
let saleDetailsMap: Record<string, any> = {}

export async function GET() {
  try {
    // Genel istatistikler hesapla
    const apartments = Object.values(saleDetailsMap)
    
    const stats = {
      totalApartments: apartments.length,
      paidApartments: apartments.filter((apt: any) => apt.remainingBalance === 0).length,
      installedApartments: apartments.filter((apt: any) => apt.installmentMonths && apt.installmentMonths > 1).length,
      cashApartments: apartments.filter((apt: any) => !apt.installmentMonths || apt.installmentMonths === 1).length,
      
      // Finansal veriler
      totalRevenue: apartments.reduce((sum: number, apt: any) => sum + (apt.salePrice || 0), 0),
      totalPaid: apartments.reduce((sum: number, apt: any) => sum + ((apt.salePrice || 0) - (apt.remainingBalance || 0)), 0),
      totalDue: apartments.reduce((sum: number, apt: any) => sum + (apt.remainingBalance || 0), 0),
      
      // Vade bilgileri
      overdueApartments: apartments.filter((apt: any) => {
        if (!apt.installmentMonths || !apt.startDate) return false
        // Hiç bir taksiti ödenmemiş ve tarih geçmiş mi?
        return apt.remainingBalance > 0 && new Date(apt.startDate) < new Date()
      }).length,
      
      // Taksit dağılımı
      installmentDistribution: {
        '3months': apartments.filter((apt: any) => apt.installmentMonths === 3).length,
        '6months': apartments.filter((apt: any) => apt.installmentMonths === 6).length,
        '12months': apartments.filter((apt: any) => apt.installmentMonths === 12).length,
        '24months': apartments.filter((apt: any) => apt.installmentMonths === 24).length,
        '36months': apartments.filter((apt: any) => apt.installmentMonths === 36).length,
      },
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Stats calculation failed' }, { status: 500 })
  }
}
