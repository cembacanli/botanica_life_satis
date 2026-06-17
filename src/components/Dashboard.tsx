'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Apartment } from '@/lib/data-generator'

interface BlockInfo {
  name: string
  totalApartments: number
  type: string
  area: string
  priceRange: string
  color: string
  bgColor: string
}

const blocks: Record<string, BlockInfo> = {
  A: {
    name: 'A Blok',
    totalApartments: 60,
    type: '2+1 Daire',
    area: '90 m²',
    priceRange: '4.50M - 4.90M TL',
    color: 'from-blue-600 to-blue-400',
    bgColor: 'bg-blue-50',
  },
  B: {
    name: 'B Blok',
    totalApartments: 60,
    type: '2+1 Daire',
    area: '90 m²',
    priceRange: '4.50M - 4.90M TL',
    color: 'from-cyan-600 to-cyan-400',
    bgColor: 'bg-cyan-50',
  },
  C: {
    name: 'C Blok',
    totalApartments: 120,
    type: '1+1 Daire',
    area: '45 m²',
    priceRange: '2.50M - 2.80M TL',
    color: 'from-green-600 to-green-400',
    bgColor: 'bg-green-50',
  },
  D: {
    name: 'D Blok',
    totalApartments: 120,
    type: '1+1 Daire',
    area: '45 m²',
    priceRange: '2.50M - 2.80M TL',
    color: 'from-emerald-600 to-emerald-400',
    bgColor: 'bg-emerald-50',
  },
}

export default function Dashboard() {
  const router = useRouter()
  const { user, logout, loading, isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [salesRecords, setSalesRecords] = useState<any[]>([])
  const [saleDetailsMap, setSaleDetailsMap] = useState<Record<string, any>>({})
  const [costs, setCosts] = useState<any[]>([])

  useEffect(() => {
    setMounted(true)
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
    // Load apartments and sales records for dashboard stats
    fetch('/api/apartments')
      .then(r => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setApartments(data)
        } else {
          console.warn('API returned non-array data:', data)
          setApartments([])
        }
      })
      .catch((err) => {
        console.error('Error loading apartments:', err)
        setApartments([])
      })

    fetch('/api/sales')
      .then(r => r.json())
      .then((data) => setSalesRecords(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error('Error loading sales:', err)
        setSalesRecords([])
      })

    fetch('/api/sale-details')
      .then(r => r.json())
      .then((data) => setSaleDetailsMap(data || {}))
      .catch((err) => {
        console.error('Error loading sale details:', err)
        setSaleDetailsMap({})
      })

    fetch('/api/costs')
      .then(r => r.json())
      .then((data) => setCosts(Array.isArray(data) ? data : []))
      .catch(() => setCosts([]))

  }, [isAuthenticated, loading, router])

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetch('/api/sales')
        .then(r => r.json())
        .then((data) => setSalesRecords(Array.isArray(data) ? data : []))
        .catch(() => undefined)

      fetch('/api/sale-details')
        .then(r => r.json())
        .then((data) => setSaleDetailsMap(data || {}))
        .catch(() => undefined)

      fetch('/api/costs')
        .then(r => r.json())
        .then((data) => setCosts(Array.isArray(data) ? data : []))
        .catch(() => undefined)

    }, 3000)

    return () => clearInterval(intervalId)
  }, [])

  const handleBlockClick = (blockName: string) => {
    router.push(`/blocks/${blockName}`)
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const soldApartmentIds = new Set(
    salesRecords.filter((rec: any) => rec.saleType === 'sold').map((rec: any) => rec.apartmentId)
  )
  const landOwnerApartmentIds = new Set(
    salesRecords
      .filter((rec: any) => {
        if (rec.saleType !== 'sold') return false
        const name = (rec.customerName || '')
          .toLocaleLowerCase('tr-TR')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        const saleData = saleDetailsMap[rec.apartmentId] || {}
        return name.includes('arsa sahibi') || (saleData.salePrice || 0) <= 0
      })
      .map((rec: any) => rec.apartmentId)
  )
  const potentialApartments = apartments.filter(apt => !soldApartmentIds.has(apt.id))
  const potentialAmount = potentialApartments.reduce((sum, apt) => sum + (apt.price || 0), 0)
  const soldTotalAmount = salesRecords
    .filter((rec: any) => rec.saleType === 'sold' && !landOwnerApartmentIds.has(rec.apartmentId))
    .reduce((sum: number, rec: any) => {
      const saleData = saleDetailsMap[rec.apartmentId] || {}
      return sum + (saleData.salePrice || 0)
    }, 0)
  const projectTotalSalePrice = soldTotalAmount + potentialAmount
  const totalDepositAmount = salesRecords
    .filter((rec: any) => rec.saleType === 'sold')
    .reduce((sum: number, rec: any) => {
      const saleData = saleDetailsMap[rec.apartmentId] || {}
      const payments = (saleData.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
      return sum + (saleData.depositAmount || 0) + payments
    }, 0)
  const totalCostAmount = costs.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
  const netProfitAmount = totalDepositAmount - totalCostAmount
  const today = new Date()
  const isSecondDayOfMonth = today.getDate() === 2
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const hasPreviousMonthCost = costs.some((item: any) => {
    const d = new Date(item.date || item.createdAt || '')
    if (Number.isNaN(d.getTime())) return false
    return d >= prevMonthStart && d <= prevMonthEnd
  })
  const shouldShowPreviousMonthReminder = isSecondDayOfMonth && !hasPreviousMonthCost
  const previousMonthLabel = prevMonthStart.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const potentialAmountFormatted = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(potentialAmount)

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center" style={{backgroundImage: 'url(/vaziyet.jpeg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed'}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 relative z-10"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-8" style={{backgroundImage: 'url(/vaziyet.jpeg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed'}}>
      <div className="absolute inset-0 bg-black/60 pointer-events-none"></div>
      <div className="w-full mx-auto px-0 md:max-w-7xl relative z-10">
        {/* Header */}
        <div className="mb-12 text-center flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-3">
              BOTANICA LIFE - DAİRE SATIŞ PROGRAMI
            </h1>
            <p className="text-xl text-gray-300">
              Toplam 360 Daire - 4 Blok - 10 Kat
            </p>
          </div>
          <button
            onClick={() => router.push('/installments')}
            className="ml-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Taksitleri Yönet
          </button>
          <button
            onClick={() => router.push('/reports')}
            className="ml-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Raporlar
          </button>
          <button
            onClick={() => router.push('/costs')}
            className="ml-4 px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-3.866 0-7 1.343-7 3v4c0 1.657 3.134 3 7 3s7-1.343 7-3v-4c0-1.657-3.134-3-7-3zm0 0V5m0 3v3" />
            </svg>
            Maliyet
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => router.push('/construction-costs')}
              className="ml-4 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 21h18M5 21V9l7-4 7 4v12M9 21v-6h6v6M10 9h4"
                />
              </svg>
              Insaat Hesabi
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              onClick={() => router.push('/material-procurement')}
              className="ml-4 px-6 py-3 bg-stone-700 hover:bg-stone-800 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7L12 3 4 7m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              Malzeme Alım Modülü
            </button>
          )}
          <button
            onClick={() => router.push('/contracts')}
            className="ml-4 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7h18M3 12h18M3 17h18M8 7v10m8-10v10"
              />
            </svg>
            Sözleşmeler
          </button>
          <button
            onClick={() => router.push('/plans')}
            className="ml-4 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V2m6 15l6-3m-6 3V5m6 9V3.618a1 1 0 00-.553-.894L15 0"
              />
            </svg>
            Planlar
          </button>
          <div className="flex gap-3 ml-4">
            {user?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin')}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
                Admin
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Çıkış
            </button>
          </div>
        </div>

        {shouldShowPreviousMonthReminder && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
            Hatırlatma: {previousMonthLabel} ayı maliyetlerini girmeniz gerekiyor.
          </div>
        )}

        {/* Site Plan */}
        <div className="mb-12 -mx-8 px-4 flex justify-center">
          <div className="w-full md:w-3/4 lg:w-2/3 bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
            <h2 className="text-lg md:text-2xl font-bold text-white mb-4 text-center">🗺️ Site Planı (Bloklara tıkla)</h2>
            <div className="relative rounded-lg overflow-hidden shadow-2xl group bg-white/95">
              <img
                src="/site-plan.jpg"
                alt="Site Planı"
                className="w-full h-full object-contain"
              />
              {/* Clickable Block Overlay */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 4800 2700"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* B Blok - Sol Üst */}
                <polygon
                  points="1565,920 2085,860 2160,1450 1645,1508"
                  fill="transparent"
                  className="hover:fill-cyan-400 hover:opacity-20 cursor-pointer transition-all"
                  onClick={() => handleBlockClick('B')}
                >
                  <title>B Blok</title>
                </polygon>
                
                {/* A Blok - Sağ Üst */}
                <polygon
                  points="2570,780 3110,730 3165,1315 2620,1365"
                  fill="transparent"
                  className="hover:fill-blue-400 hover:opacity-20 cursor-pointer transition-all"
                  onClick={() => handleBlockClick('A')}
                >
                  <title>A Blok</title>
                </polygon>
                
                {/* C Blok - Sol Alt */}
                <polygon
                  points="1220,1605 1805,1545 1878,2218 1285,2275"
                  fill="transparent"
                  className="hover:fill-emerald-400 hover:opacity-20 cursor-pointer transition-all"
                  onClick={() => handleBlockClick('D')}
                >
                  <title>D Blok</title>
                </polygon>
                
                {/* D Blok - Sağ Alt */}
                <polygon
                  points="2925,1560 3555,1515 3628,2188 2995,2240"
                  fill="transparent"
                  className="hover:fill-green-400 hover:opacity-20 cursor-pointer transition-all"
                  onClick={() => handleBlockClick('C')}
                >
                  <title>C Blok</title>
                </polygon>
              </svg>
            </div>
          </div>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="text-3xl font-bold text-blue-400 mb-2">360</div>
            <div className="text-gray-300">Toplam Daire</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="text-3xl font-bold text-green-400 mb-2">4</div>
            <div className="text-gray-300">Blok</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="text-3xl font-bold text-yellow-400 mb-2">10</div>
            <div className="text-gray-300">Kat</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="text-xl md:text-2xl font-bold text-purple-400 mb-1">{potentialAmountFormatted}</div>
            <div className="text-xs text-purple-200 mb-2">{potentialApartments.length} daire satisa acik</div>
            <div className="text-gray-300">Potansiyel</div>
          </div>
        </div>

        {/* Blok Bazlı Özet İstatistikler (Dashboard) */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">📊 Blok Özeti</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {Object.keys(blocks).map((key) => {
              const blockApts = apartments.filter(a => a.block === key)
              const blockSales = salesRecords.filter((rec: any) => {
                const apt = apartments.find(a => a.id === rec.apartmentId)
                return apt && apt.block === key && rec.saleType === 'sold'
              })
              const soldIdsInBlock = new Set(blockSales.map((rec: any) => rec.apartmentId))
              const unsoldAptsInBlock = blockApts.filter((apt: any) => !soldIdsInBlock.has(apt.id))
              const blockPotential = blockApts.reduce((sum: number, apt: any) => {
                if (soldIdsInBlock.has(apt.id)) return sum
                return sum + (apt.price || 0)
              }, 0)
              const blockAverageSalePrice = unsoldAptsInBlock.length > 0
                ? blockPotential / unsoldAptsInBlock.length
                : 0

              const totalRevenue = blockSales.reduce((sum: number, rec: any) => {
                const saleData = saleDetailsMap[rec.apartmentId] || {}
                return sum + (saleData.salePrice || 0)
              }, 0)

              const totalDeposit = blockSales.reduce((sum: number, rec: any) => {
                const saleData = saleDetailsMap[rec.apartmentId] || {}
                const payments = (saleData.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
                return sum + (saleData.depositAmount || 0) + payments
              }, 0)

              const remainingApts = blocks[key].totalApartments - blockSales.length

              return (
                <div key={key} className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
                  <div className="text-sm text-gray-300">Blok {key}</div>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-2xl font-bold text-white">{blockSales.length} satıldı</div>
                      <div className="text-sm text-blue-300 mt-1">{remainingApts} daire kaldı</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Toplam</div>
                      <div className="text-sm text-gray-300">{blocks[key].totalApartments}</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-300 mt-2">Toplam Ciro</div>
                  <div className="text-lg font-semibold text-green-300">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(totalRevenue)}
                  </div>
                  <div className="text-sm text-gray-300 mt-1">Peşinatlar / Kalan</div>
                  <div className="text-sm text-gray-200">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(totalDeposit)} / {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(blockSales.reduce((sum:number, rec:any) => {
                      const saleData = saleDetailsMap[rec.apartmentId] || {}
                      return sum + (saleData.remainingBalance || ((saleData.salePrice || 0) - (saleData.depositAmount || 0)))
                    }, 0))}
                  </div>
                  <div className="text-sm text-gray-300 mt-1">Potansiyel</div>
                  <div className="text-sm font-semibold text-purple-200">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(blockPotential)}
                  </div>
                  <div className="text-sm text-gray-300 mt-1">Ortalama Kalan Daire Satış Bedeli</div>
                  <div className="text-sm font-semibold text-cyan-200">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(blockAverageSalePrice)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Proje Toplamı Özet */}
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-2">🏢 Proje Toplamı</h3>
            <div className="flex items-center gap-6">
              <div>
                <div className="text-sm text-gray-300">Proje Toplam Satış Bedeli</div>
                <div className="text-2xl font-bold text-cyan-300">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(projectTotalSalePrice)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-300">Toplam Satılan</div>
                <div className="text-2xl font-bold text-white">
                  {salesRecords.filter(s => s.saleType === 'sold').length}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-300">Toplam Ciro</div>
                <div className="text-2xl font-bold text-green-300">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(
                    salesRecords.filter((rec: any) => rec.saleType === 'sold').reduce((sum: number, rec: any) => {
                      const saleData = saleDetailsMap[rec.apartmentId] || {}
                      return sum + (saleData.salePrice || 0)
                    }, 0)
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-300">Toplam Peşinat</div>
                <div className="text-2xl font-bold text-orange-300">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(
                    salesRecords.filter((rec: any) => rec.saleType === 'sold').reduce((sum: number, rec: any) => {
                      const saleData = saleDetailsMap[rec.apartmentId] || {}
                      const payments = (saleData.payments || []).reduce((s:number,p:any)=>s+(p.amount||0),0)
                      return sum + (saleData.depositAmount || 0) + payments
                    }, 0)
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-300">Toplam Kalan</div>
                <div className="text-2xl font-bold text-red-300">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(
                    salesRecords.filter((rec: any) => rec.saleType === 'sold').reduce((sum: number, rec: any) => {
                      const saleData = saleDetailsMap[rec.apartmentId] || {}
                      return sum + (saleData.remainingBalance || ((saleData.salePrice || 0) - (saleData.depositAmount || 0)))
                    }, 0)
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-300">Toplam Maliyet</div>
                <div className="text-2xl font-bold text-red-200">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(totalCostAmount)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-300">Kar</div>
                <div className={`text-2xl font-bold ${netProfitAmount >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(netProfitAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bloklar - 1 Satır - 4 Kart */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {Object.entries(blocks).map(([key, block]) => (
            <button
              key={key}
              onClick={() => handleBlockClick(key)}
              className="group relative overflow-hidden rounded-lg bg-gradient-to-br shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-pointer"
            >
              {/* Background gradient */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${block.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
              />

              {/* Content */}
              <div className={`relative p-3 ${block.bgColor} border border-gray-300 h-full`}>
                {/* Block Number */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div
                      className={`text-3xl font-bold bg-gradient-to-r ${block.color} bg-clip-text text-transparent`}
                    >
                      {key}
                    </div>
                    <div className="text-xs text-gray-600">BLOK</div>
                  </div>
                  <div className="bg-white/40 backdrop-blur rounded-full p-1">
                    <svg
                      className="w-4 h-4 text-gray-700 group-hover:text-gray-900 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <div className="text-xs text-gray-600 font-medium uppercase tracking-wider">
                      Daire Sayısı
                    </div>
                    <div className="text-sm font-bold text-gray-900">
                      {block.totalApartments}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium uppercase tracking-wider">
                      Daire Tipi
                    </div>
                    <div className="text-xs font-bold text-gray-900">{block.type}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium uppercase tracking-wider">
                      Alanı
                    </div>
                    <div className="text-xs font-bold text-gray-900">{block.area}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium uppercase tracking-wider">
                      Kat Sayısı
                    </div>
                    <div className="text-xs font-bold text-gray-900">10</div>
                  </div>
                </div>

                {/* Price Range */}
                <div className="pt-2 border-t border-gray-300">
                  <div className="text-xs text-gray-600 font-medium uppercase tracking-wider mb-1">
                    Fiyat Aralığı
                  </div>
                  <div className="text-xs font-bold text-gray-900">{block.priceRange}</div>
                </div>

                {/* Click hint */}
                <div className="mt-2 text-center">
                  <div className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">
                    Tıklayarak gir →
                  </div>
                </div>
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-5 bg-white transition-opacity duration-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
