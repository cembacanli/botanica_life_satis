'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface SalesReport {
  apartmentId: string
  block: string
  number: number
  saleType: 'reservation' | 'deposit' | 'sold'
  customerName: string
  date: string
}

export default function ReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<SalesReport[]>([])
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = () => {
    const saved = localStorage.getItem('salesRecords')
    if (saved) {
      setReports(JSON.parse(saved))
    }
  }

  const filteredReports =
    filterType === 'all' ? reports : reports.filter(r => r.saleType === filterType)

  const stats = {
    total: reports.length,
    reservations: reports.filter(r => r.saleType === 'reservation').length,
    deposits: reports.filter(r => r.saleType === 'deposit').length,
    sold: reports.filter(r => r.saleType === 'sold').length,
  }

  const getSaleTypeInfo = (
    type: string
  ): { label: string; color: string; bgColor: string; icon: string } => {
    switch (type) {
      case 'reservation':
        return { label: 'Rezervasyon', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: '📅' }
      case 'deposit':
        return { label: 'Kapora', color: 'text-yellow-600', bgColor: 'bg-yellow-50', icon: '💰' }
      case 'sold':
        return { label: 'Satış', color: 'text-green-600', bgColor: 'bg-green-50', icon: '✅' }
      default:
        return { label: 'Bilinmiyor', color: 'text-gray-600', bgColor: 'bg-gray-50', icon: '?' }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-8">
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-4 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Geri Dön
            </button>
            <h1 className="text-4xl font-bold">Satış Raporları</h1>
            <p className="text-white/80 mt-2">Tüm satış işlemlerinin özeti</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-purple-600">{stats.total}</div>
            <div className="text-sm text-gray-600 mt-2">Toplam İşlem</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.reservations}</div>
            <div className="text-sm text-gray-600 mt-2">Rezervasyon</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-yellow-600">{stats.deposits}</div>
            <div className="text-sm text-gray-600 mt-2">Kapora</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.sold}</div>
            <div className="text-sm text-gray-600 mt-2">Satış Tamamı</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-red-600">
              {stats.total > 0 ? ((stats.sold / stats.total) * 100).toFixed(0) : 0}%
            </div>
            <div className="text-sm text-gray-600 mt-2">Satış Oranı</div>
          </div>
        </div>

        {/* Filtre */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Satış Türüne Göre Filtrele</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { value: 'all', label: 'Tümü', color: 'bg-gray-100 hover:bg-gray-200' },
              { value: 'reservation', label: '📅 Rezervasyon', color: 'bg-blue-100 hover:bg-blue-200' },
              { value: 'deposit', label: '💰 Kapora', color: 'bg-yellow-100 hover:bg-yellow-200' },
              { value: 'sold', label: '✅ Satış', color: 'bg-green-100 hover:bg-green-200' },
            ].map(filter => (
              <button
                key={filter.value}
                onClick={() => setFilterType(filter.value)}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  filterType === filter.value ? filter.color + ' ring-2 ring-offset-2' : filter.color
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Raporlar Tablosu */}
        {filteredReports.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Müşteri
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Daire
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Satış Türü
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Tarih
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report, idx) => {
                    const info = getSaleTypeInfo(report.saleType)
                    return (
                      <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          {report.customerName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <span className="font-semibold">Blok {report.block}</span> - Daire{' '}
                          {report.number}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${info.bgColor} ${info.color} font-medium`}>
                            {info.icon} {info.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(report.date).toLocaleString('tr-TR')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Henüz Satış Yok</h3>
            <p className="text-gray-600">
              {filterType === 'all'
                ? 'Satış raporları burada görünecektir.'
                : 'Bu kategoride satış yok.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
