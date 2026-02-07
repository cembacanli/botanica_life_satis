'use client'

import { useState, useEffect } from 'react'
import { Apartment } from '@/lib/data-generator'

interface FilterOptions {
  block: string
  floor: string
  facade: string
}

export default function ApartmentsList() {
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterOptions>({
    block: '',
    floor: '',
    facade: '',
  })

  useEffect(() => {
    fetchApartments()
  }, [filters])

  const fetchApartments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filters.block) params.append('block', filters.block)
      if (filters.floor) params.append('floor', filters.floor)
      if (filters.facade) params.append('facade', filters.facade)

      const response = await fetch(`/api/apartments?${params.toString()}`)
      const data = await response.json()
      setApartments(data)
    } catch (error) {
      console.error('Error fetching apartments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (field: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Daire Satış Programı</h1>
        <p className="text-gray-600 mb-8">
          Toplam {apartments.length} daire arasından istediğinizi seçin
        </p>

        {/* Filtreler */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Blok</label>
              <select
                value={filters.block}
                onChange={e => handleFilterChange('block', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tüm Bloklar</option>
                <option value="A">Blok A</option>
                <option value="B">Blok B</option>
                <option value="C">Blok C</option>
                <option value="D">Blok D</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kat</label>
              <select
                value={filters.floor}
                onChange={e => handleFilterChange('floor', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tüm Katlar</option>
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}. Kat
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cephe</label>
              <select
                value={filters.facade}
                onChange={e => handleFilterChange('facade', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tüm Cepheler</option>
                <option value="ana_yol">Ana Yol Cephesi</option>
                <option value="arka_cephe">Arka Cephe</option>
              </select>
            </div>
          </div>
        </div>

        {/* Daire Listesi */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apartments.map((apt, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div
                  className={`px-6 py-4 ${
                    apt.block === 'A' || apt.block === 'B' ? 'bg-blue-50' : 'bg-green-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      Blok {apt.block} - Daire {apt.number}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        apt.facade === 'ana_yol'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {apt.facade === 'ana_yol' ? 'Ana Yol' : 'Arka'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 my-4 text-sm">
                    <div>
                      <p className="text-gray-600">Kat</p>
                      <p className="font-semibold text-gray-900">{apt.floor}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Tür</p>
                      <p className="font-semibold text-gray-900">{apt.type}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Alan</p>
                      <p className="font-semibold text-gray-900">{apt.area} m²</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Fiyat</p>
                      <p className="font-semibold text-blue-600">{formatPrice(apt.price)}</p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-3 bg-gray-50 border-t">
                  <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors">
                    Detay Gör
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
