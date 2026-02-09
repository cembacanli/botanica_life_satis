'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import SalesModal, { SaleData } from '@/components/SalesModal'
import { Apartment } from '@/lib/data-generator'

interface SalesRecord {
  apartmentId: string
  saleType: 'reservation' | 'deposit' | 'sold'
  customerName: string
  customerPhone: string
  date: string
}

export default function BlockPage() {
  const params = useParams()
  const router = useRouter()
  const blockName = params.block as string
  const { user: currentUser } = useAuth()

  const [apartments, setApartments] = useState<Apartment[]>([])
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null)
  const [selectedApartments, setSelectedApartments] = useState<Set<string>>(new Set())
  const [showSalesModal, setShowSalesModal] = useState(false)
  const [filterFloor, setFilterFloor] = useState<string>('')
  const [multiSelectMode, setMultiSelectMode] = useState(false)

  useEffect(() => {
    fetchApartments()
  }, [])

  // Apartments yüklendikten sonra satış kayıtlarını yükle ve senkronize et
  useEffect(() => {
    if (apartments.length > 0) {
      loadSalesRecords()
    }
  }, [apartments.length])

  const fetchApartments = async () => {
    try {
      const response = await fetch(`/api/apartments?block=${blockName}`)
      const data = await response.json()
      
      // localStorage'dan satış kayıtlarını oku
      const saved = localStorage.getItem('salesRecords')
      const records = saved ? JSON.parse(saved) : []
      
      // Apartment status'larını güncelle
      const updatedData = data.map((apt: Apartment) => {
        const saleRecord = records.find((rec: SalesRecord) => rec.apartmentId === apt.id)
        if (saleRecord) {
          const newStatus = saleRecord.saleType === 'reservation' ? 'reserved' : saleRecord.saleType === 'deposit' ? 'deposited' : 'sold'
          return { ...apt, status: newStatus }
        }
        return apt
      })
      
      setApartments(updatedData)
      setSalesRecords(records)
    } catch (error) {
      console.error('Error fetching apartments:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSalesRecords = () => {
    const saved = localStorage.getItem('salesRecords')
    if (saved) {
      setSalesRecords(JSON.parse(saved))
    }
  }

  // Listen to salesRecords changes from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('salesRecords')
      if (saved) setSalesRecords(JSON.parse(saved))
    }

    const handleFocus = () => {
      const saved = localStorage.getItem('salesRecords')
      if (saved) setSalesRecords(JSON.parse(saved))
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  // Update apartment status when sales records change
  useEffect(() => {
    setApartments(prevApts =>
      prevApts.map(apt => {
        const saleRecord = salesRecords.find(rec => rec.apartmentId === apt.id)
        if (saleRecord) {
          const newStatus = saleRecord.saleType === 'reservation' ? 'reserved' : saleRecord.saleType === 'deposit' ? 'deposited' : 'sold'
          return { ...apt, status: newStatus }
        }
        return apt
      })
    )
  }, [salesRecords])

  const handleSalesSubmit = useCallback(
    (saleData: SaleData | SaleData[]) => {
      // Çoklu seçim kontrolü
      const dataArray = Array.isArray(saleData) ? saleData : [saleData]
      
      const newRecords = dataArray.map(data => ({
        apartmentId: data.apartmentId,
        saleType: data.saleType,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        date: new Date().toLocaleString('tr-TR'),
      }))

      const updated = [...salesRecords, ...newRecords]
      setSalesRecords(updated)
      localStorage.setItem('salesRecords', JSON.stringify(updated))

      // Seçili dairelerin status'unu güncelle
      setApartments(prevApts =>
        prevApts.map(apt =>
          dataArray.some(d => d.apartmentId === apt.id)
            ? {
                ...apt,
                status: dataArray[0].saleType === 'reservation' ? 'reserved' : dataArray[0].saleType === 'deposit' ? 'deposited' : 'sold',
              }
            : apt
        )
      )

      setShowSalesModal(false)
      setSelectedApartment(null)
      setSelectedApartments(new Set())
      setMultiSelectMode(false)

      // Başarı mesajı
      const count = dataArray.length
      const firstData = dataArray[0]
      alert(
        `${firstData.customerName} için ${count} ${count > 1 ? 'daire' : 'dairenin'} ${firstData.saleType === 'reservation' ? 'Rezervasyonu' : firstData.saleType === 'deposit' ? 'Kaporası' : 'Satışı'} başarıyla kaydedildi!`
      )
    },
    [salesRecords, multiSelectMode, selectedApartments]
  )

  const handleCancelSale = useCallback(
    (recordIndex: number) => {
      if (!selectedApartment) return

      // İptal edilecek satış kaydını al
      const recordToCancel = salesRecords[recordIndex]

      // Satış kaydını sil
      const updated = salesRecords.filter((_, idx) => idx !== recordIndex)
      setSalesRecords(updated)
      localStorage.setItem('salesRecords', JSON.stringify(updated))

      // Dairenin statusunu tekrar 'available' yap
      setApartments(prevApts =>
        prevApts.map(apt =>
          apt.id === selectedApartment.id
            ? { ...apt, status: 'available' }
            : apt
        )
      )

      // WhatsApp iptal bildirimi gönder
      try {
        fetch('/api/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerPhone: recordToCancel.customerPhone,
            customerName: recordToCancel.customerName,
            block: selectedApartment.block,
            apartmentNumber: selectedApartment.number,
            price: selectedApartment.price,
            saleType: 'cancelled',
            notificationType: 'cancellation',
          }),
        }).catch(err => console.log('WhatsApp mesajı gönderilemedi (opsiyonel):', err))
      } catch (err) {
        console.log('WhatsApp mesajı gönderilemedi (opsiyonel):', err)
      }

      // Modal'ı kapat ve seçimi temizle
      setShowSalesModal(false)
      setSelectedApartment(null)
    },
    [salesRecords, selectedApartment]
  )

  // İstatistik hesaplama fonksiyonları
  const calculateBlockStats = (blockLetter: string) => {
    const blockSales = salesRecords.filter(record => {
      const apt = apartments.find(a => a.id === record.apartmentId)
      return apt && apt.block === blockLetter && record.saleType === 'sold'
    })

    const totalRevenue = blockSales.reduce((sum, record) => {
      const saleData = JSON.parse(localStorage.getItem('saleDetails_' + record.apartmentId) || '{}')
      return sum + (saleData.salePrice || 0)
    }, 0)

    const totalDeposit = blockSales.reduce((sum, record) => {
      const saleData = JSON.parse(localStorage.getItem('saleDetails_' + record.apartmentId) || '{}')
      const payments = (saleData.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
      return sum + (saleData.depositAmount || 0) + payments
    }, 0)

    const remainingBalance = blockSales.reduce((sum, record) => {
      const saleData = JSON.parse(localStorage.getItem('saleDetails_' + record.apartmentId) || '{}')
      return sum + (saleData.remainingBalance || ((saleData.salePrice || 0) - (saleData.depositAmount || 0)))
    }, 0)

    return {
      soldCount: blockSales.length,
      totalRevenue,
      totalDeposit,
      remainingBalance,
    }
  }

  const calculateProjectStats = () => {
    const allSales = salesRecords.filter(record => record.saleType === 'sold')

    const totalRevenue = allSales.reduce((sum, record) => {
      const saleData = JSON.parse(localStorage.getItem('saleDetails_' + record.apartmentId) || '{}')
      return sum + (saleData.salePrice || 0)
    }, 0)

    const totalDeposit = allSales.reduce((sum, record) => {
      const saleData = JSON.parse(localStorage.getItem('saleDetails_' + record.apartmentId) || '{}')
      const payments = (saleData.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
      return sum + (saleData.depositAmount || 0) + payments
    }, 0)

    const remainingBalance = allSales.reduce((sum, record) => {
      const saleData = JSON.parse(localStorage.getItem('saleDetails_' + record.apartmentId) || '{}')
      return sum + (saleData.remainingBalance || ((saleData.salePrice || 0) - (saleData.depositAmount || 0)))
    }, 0)

    return {
      soldCount: allSales.length,
      totalRevenue,
      totalDeposit,
      remainingBalance,
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-50 border-green-200'
      case 'reserved':
        return 'bg-blue-50 border-blue-200'
      case 'deposited':
        return 'bg-yellow-50 border-yellow-200'
      case 'sold':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return { label: 'Müsait', color: 'bg-green-100 text-green-800', icon: '✓' }
      case 'reserved':
        return { label: 'Rezerve', color: 'bg-blue-100 text-blue-800', icon: '📅' }
      case 'deposited':
        return { label: 'Kapora', color: 'bg-yellow-100 text-yellow-800', icon: '💰' }
      case 'sold':
        return { label: 'Satıldı', color: 'bg-red-100 text-red-800', icon: '✅' }
      default:
        return { label: 'Bilinmiyor', color: 'bg-gray-100 text-gray-800', icon: '?' }
    }
  }

  const getSalesInfo = (apartmentId: string) => {
    return salesRecords.find(rec => rec.apartmentId === apartmentId)
  }

  const handleApartmentClick = (apt: Apartment) => {
    // Multi-select mode'daysa dairenin seçimini toggle et
    if (multiSelectMode) {
      if (apt.status === 'available') {
        const newSet = new Set(selectedApartments)
        if (newSet.has(apt.id)) {
          newSet.delete(apt.id)
        } else {
          newSet.add(apt.id)
        }
        setSelectedApartments(newSet)
      }
      return
    }

    // Normal ayınız modu
    console.log('Dairecliked:', apt.id, 'Status:', apt.status, 'CurrentUser:', currentUser, 'Role:', currentUser?.role)
    
    // Admin tüm daireleri açabilir, kullanıcılar sadece müsait daireleri
    if (currentUser?.role === 'admin' || apt.status === 'available') {
      console.log('Modal açılıyor...')
      setSelectedApartment(apt)
      setShowSalesModal(true)
    } else {
      console.log('Modal açılamadı - Erişim reddedildi')
    }
  }

  const handleModalClose = () => {
    setShowSalesModal(false)
    setSelectedApartment(null)
    // Modal kapatılırken localStorage'ı oku ve güncelle
    const saved = localStorage.getItem('salesRecords')
    if (saved) {
      setSalesRecords(JSON.parse(saved))
    }
  }

  const filteredApartments = filterFloor
    ? apartments.filter(apt => apt.floor === parseInt(filterFloor))
    : apartments

  const blockInfo = {
    A: { color: 'from-blue-600 to-blue-400', totalUnits: 60 },
    B: { color: 'from-cyan-600 to-cyan-400', totalUnits: 60 },
    C: { color: 'from-green-600 to-green-400', totalUnits: 120 },
    D: { color: 'from-fuchsia-600 to-fuchsia-400', totalUnits: 120 },
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div
        className={`bg-gradient-to-r ${blockInfo[blockName as keyof typeof blockInfo]?.color || 'from-gray-600 to-gray-400'} text-white py-8`}
      >
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
            <h1 className="text-4xl font-bold">Blok {blockName}</h1>
            <p className="text-white/80 mt-2">
              {filteredApartments.length} daire ({apartments.length} toplam)
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{blockName}</div>
            <div className="text-white/80">BLOK</div>
            
            {/* Multi-select Mode Indicator */}
            {multiSelectMode && selectedApartments.size > 0 && (
              <div className="mt-2 bg-white/20 px-3 py-1 rounded-full text-sm">
                ✓ {selectedApartments.size} daire seçildi
              </div>
            )}
          </div>

          {/* Multi-select Toggle Button */}
          <button
            onClick={() => {
              setMultiSelectMode(!multiSelectMode)
              setSelectedApartments(new Set())
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              multiSelectMode
                ? 'bg-white text-purple-600 shadow-lg'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {multiSelectMode ? '✓ Çoklu Seç Aktif' : '☐ Çoklu Seç'}
          </button>

          {/* Seçili Daireleri Sat Butonu */}
          {multiSelectMode && selectedApartments.size > 0 && (
            <button
              onClick={() => {
                // Modal açmadan önce seçili daireleri hazırla
                setShowSalesModal(true)
              }}
              className="ml-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all shadow-lg animate-pulse"
            >
              ✓ {selectedApartments.size} Daireyi Sat
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {apartments.filter(a => a.status === 'available').length}
            </div>
            <div className="text-sm text-gray-600">Müsait</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {apartments.filter(a => a.status === 'reserved').length}
            </div>
            <div className="text-sm text-gray-600">Rezerve</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {apartments.filter(a => a.status === 'deposited').length}
            </div>
            <div className="text-sm text-gray-600">Kapora</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {apartments.filter(a => a.status === 'sold').length}
            </div>
            <div className="text-sm text-gray-600">Satıldı</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {(
                (apartments.filter(a => a.status === 'sold').length / apartments.length) *
                100
              ).toFixed(0)}
              %
            </div>
            <div className="text-sm text-gray-600">Satış Oranı</div>
          </div>
        </div>

        {/* Filtre */}
        <div className="mb-8 bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Kata Göre Filtrele:
          </label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(floor => (
              <button
                key={floor}
                onClick={() => setFilterFloor(floor.toString())}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterFloor === floor.toString()
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {floor}. Kat
              </button>
            ))}
          </div>
        </div>

        {/* Daire Listesi */}
        {blockName === 'A' || blockName === 'B' ? (
          // A ve B blokları: Ana yol 6 sütun, Arka cephe 6 sütun
          <div className="space-y-8">
            {/* Ana Yol Cephesi - 6 sütun */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Ana Yol Cephesi</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                {filteredApartments
                  .filter(apt => apt.facade === 'ana_yol')
                  .map((apt, idx) => {
                    const saleInfo = getSalesInfo(apt.id)
                    const statusBadge = getStatusBadge(apt.status)

                    return (
                      <div
                        key={idx}
                        className={`rounded-lg shadow-md border-2 overflow-hidden transition-all hover:shadow-lg ${getStatusColor(apt.status)}`}
                      >
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-xl font-bold">Daire {apt.number}</h3>
                              <p className="text-gray-300 text-sm">{apt.floor}. Kat</p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge.color}`}
                            >
                              {statusBadge.icon} {statusBadge.label}
                            </span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4">
                          {/* Özellikler */}
                          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                            <div>
                              <span className="text-gray-600">Tip:</span>
                              <div className="font-bold">{apt.type}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Alan:</span>
                              <div className="font-bold">{apt.area} m²</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Cephe:</span>
                              <div className="font-bold">
                                {apt.facade === 'ana_yol' ? 'Ana Yol' : 'Arka'}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">Fiyat:</span>
                              <div className="font-bold text-green-600">
                                {new Intl.NumberFormat('tr-TR', {
                                  style: 'currency',
                                  currency: 'TRY',
                                  minimumFractionDigits: 0,
                                }).format(apt.price)}
                              </div>
                            </div>
                          </div>

                          {/* Satış Bilgisi */}
                          {saleInfo && (
                            <div className="mb-4 p-3 bg-white/50 rounded border border-gray-300 text-sm">
                              <div className="font-bold text-gray-900 mb-1">{saleInfo.customerName}</div>
                              <div className="text-gray-700">{saleInfo.date}</div>
                            </div>
                          )}

                          {/* Buton */}
                          <button
                            onClick={() => handleApartmentClick(apt)}
                            disabled={apt.status !== 'available' && currentUser?.role !== 'admin'}
                            className={`w-full py-3 rounded-lg font-medium transition-all ${
                              apt.status === 'available' || currentUser?.role === 'admin'
                                ? 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg cursor-pointer'
                                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            }`}
                          >
                            {apt.status === 'available' ? 'Satış Yap' : currentUser?.role === 'admin' ? 'Düzenle / İptal' : statusBadge.label}
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Arka Cephe - 6 sütun */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Arka Cephe</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                {filteredApartments
                  .filter(apt => apt.facade === 'arka_cephe')
                  .map((apt, idx) => {
                    const saleInfo = getSalesInfo(apt.id)
                    const statusBadge = getStatusBadge(apt.status)

                    return (
                      <div
                        key={idx}
                        className={`rounded-lg shadow-md border-2 overflow-hidden transition-all hover:shadow-lg ${getStatusColor(apt.status)}`}
                      >
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-xl font-bold">Daire {apt.number}</h3>
                              <p className="text-gray-300 text-sm">{apt.floor}. Kat</p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge.color}`}
                            >
                              {statusBadge.icon} {statusBadge.label}
                            </span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4">
                          {/* Özellikler */}
                          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                            <div>
                              <span className="text-gray-600">Tip:</span>
                              <div className="font-bold">{apt.type}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Alan:</span>
                              <div className="font-bold">{apt.area} m²</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Cephe:</span>
                              <div className="font-bold">
                                {apt.facade === 'ana_yol' ? 'Ana Yol' : 'Arka'}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">Fiyat:</span>
                              <div className="font-bold text-green-600">
                                {new Intl.NumberFormat('tr-TR', {
                                  style: 'currency',
                                  currency: 'TRY',
                                  minimumFractionDigits: 0,
                                }).format(apt.price)}
                              </div>
                            </div>
                          </div>

                          {/* Satış Bilgisi */}
                          {saleInfo && (
                            <div className="mb-4 p-3 bg-white/50 rounded border border-gray-300 text-sm">
                              <div className="font-bold text-gray-900 mb-1">{saleInfo.customerName}</div>
                              <div className="text-gray-700">{saleInfo.date}</div>
                            </div>
                          )}

                          {/* Buton */}
                          <button
                            onClick={() => handleApartmentClick(apt)}
                            disabled={apt.status !== 'available' && currentUser?.role !== 'admin'}
                            className={`w-full py-3 rounded-lg font-medium transition-all ${
                              apt.status === 'available' || currentUser?.role === 'admin'
                                ? 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg cursor-pointer'
                                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            }`}
                          >
                            {apt.status === 'available' ? 'Satış Yap' : currentUser?.role === 'admin' ? 'Düzenle / İptal' : statusBadge.label}
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        ) : (
          // C ve D blokları: Ana yol 6 sütun, Arka cephe 6 sütun
          <div className="space-y-8">
            {/* Ana Yol Cephesi - 6 sütun */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Ana Yol Cephesi</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                {filteredApartments
                  .filter(apt => apt.facade === 'ana_yol')
                  .map((apt, idx) => {
                    const saleInfo = getSalesInfo(apt.id)
                    const statusBadge = getStatusBadge(apt.status)

                    return (
                      <div
                        key={idx}
                        className={`rounded-lg shadow-md border-2 overflow-hidden transition-all hover:shadow-lg ${getStatusColor(apt.status)}`}
                      >
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-xl font-bold">Daire {apt.number}</h3>
                              <p className="text-gray-300 text-sm">{apt.floor}. Kat</p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge.color}`}
                            >
                              {statusBadge.icon} {statusBadge.label}
                            </span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4">
                          {/* Özellikler */}
                          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                            <div>
                              <span className="text-gray-600">Tip:</span>
                              <div className="font-bold">{apt.type}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Alan:</span>
                              <div className="font-bold">{apt.area} m²</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Cephe:</span>
                              <div className="font-bold">
                                {apt.facade === 'ana_yol' ? 'Ana Yol' : 'Arka'}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">Fiyat:</span>
                              <div className="font-bold text-green-600">
                                {new Intl.NumberFormat('tr-TR', {
                                  style: 'currency',
                                  currency: 'TRY',
                                  minimumFractionDigits: 0,
                                }).format(apt.price)}
                              </div>
                            </div>
                          </div>

                          {/* Satış Bilgisi */}
                          {saleInfo && (
                            <div className="mb-4 p-3 bg-white/50 rounded border border-gray-300 text-sm">
                              <div className="font-bold text-gray-900 mb-1">{saleInfo.customerName}</div>
                              <div className="text-gray-700">{saleInfo.date}</div>
                            </div>
                          )}

                          {/* Buton */}
                          <button
                            onClick={() => handleApartmentClick(apt)}
                            disabled={apt.status !== 'available' && currentUser?.role !== 'admin'}
                            className={`w-full py-3 rounded-lg font-medium transition-all ${
                              apt.status === 'available' || currentUser?.role === 'admin'
                                ? 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg cursor-pointer'
                                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            }`}
                          >
                            {apt.status === 'available' ? 'Satış Yap' : currentUser?.role === 'admin' ? 'Düzenle / İptal' : statusBadge.label}
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Arka Cephe - 6 sütun */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Arka Cephe</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                {filteredApartments
                  .filter(apt => apt.facade === 'arka_cephe')
                  .map((apt, idx) => {
                    const saleInfo = getSalesInfo(apt.id)
                    const statusBadge = getStatusBadge(apt.status)

                    return (
                      <div
                        key={idx}
                        className={`rounded-lg shadow-md border-2 overflow-hidden transition-all hover:shadow-lg ${getStatusColor(apt.status)}`}
                      >
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-xl font-bold">Daire {apt.number}</h3>
                              <p className="text-gray-300 text-sm">{apt.floor}. Kat</p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge.color}`}
                            >
                              {statusBadge.icon} {statusBadge.label}
                            </span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4">
                          {/* Özellikler */}
                          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                            <div>
                              <span className="text-gray-600">Tip:</span>
                              <div className="font-bold">{apt.type}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Alan:</span>
                              <div className="font-bold">{apt.area} m²</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Cephe:</span>
                              <div className="font-bold">
                                {apt.facade === 'ana_yol' ? 'Ana Yol' : 'Arka'}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">Fiyat:</span>
                              <div className="font-bold text-green-600">
                                {new Intl.NumberFormat('tr-TR', {
                                  style: 'currency',
                                  currency: 'TRY',
                                  minimumFractionDigits: 0,
                                }).format(apt.price)}
                              </div>
                            </div>
                          </div>

                          {/* Satış Bilgisi */}
                          {saleInfo && (
                            <div className="mb-4 p-3 bg-white/50 rounded border border-gray-300 text-sm">
                              <div className="font-bold text-gray-900 mb-1">{saleInfo.customerName}</div>
                              <div className="text-gray-700">{saleInfo.date}</div>
                            </div>
                          )}

                          {/* Buton */}
                          <button
                            onClick={() => handleApartmentClick(apt)}
                            disabled={apt.status !== 'available' && currentUser?.role !== 'admin'}
                            className={`w-full py-3 rounded-lg font-medium transition-all ${
                              apt.status === 'available' || currentUser?.role === 'admin'
                                ? 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg cursor-pointer'
                                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            }`}
                          >
                            {apt.status === 'available' ? 'Satış Yap' : currentUser?.role === 'admin' ? 'Düzenle / İptal' : statusBadge.label}
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        )}

        {/* BLOK İSTATİSTİKLERİ */}
        {(() => {
          const blockStats = calculateBlockStats(blockName)
          return (
            <div className="mt-12 mb-8 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow-lg p-6 border border-blue-200">
              <h3 className="text-2xl font-bold text-blue-900 mb-6">
                📊 Blok {blockName} - Satış İstatistikleri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 shadow">
                  <div className="text-sm text-gray-600 mb-1">Satılan Daire Sayısı</div>
                  <div className="text-3xl font-bold text-blue-600">{blockStats.soldCount}</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow">
                  <div className="text-sm text-gray-600 mb-1">Toplam Ciro</div>
                  <div className="text-2xl font-bold text-green-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(blockStats.totalRevenue)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow">
                  <div className="text-sm text-gray-600 mb-1">Alınan Peşinatlar</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(blockStats.totalDeposit)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow">
                  <div className="text-sm text-gray-600 mb-1">Kalan Alacak</div>
                  <div className="text-2xl font-bold text-red-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(blockStats.remainingBalance)}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* PROJE TOPLAM İSTATİSTİKLERİ */}
        {(() => {
          const projectStats = calculateProjectStats()
          return (
            <div className="mt-12 bg-gradient-to-r from-purple-50 to-pink-100 rounded-lg shadow-lg p-6 border border-purple-200">
              <h3 className="text-2xl font-bold text-purple-900 mb-6">
                🏢 PROJE TOPLAMI - Tüm Satış İstatistikleri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 shadow">
                  <div className="text-sm text-gray-600 mb-1">Toplam Satılan Daire</div>
                  <div className="text-3xl font-bold text-blue-600">{projectStats.soldCount}</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow">
                  <div className="text-sm text-gray-600 mb-1">Toplam Ciro</div>
                  <div className="text-2xl font-bold text-green-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(projectStats.totalRevenue)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow">
                  <div className="text-sm text-gray-600 mb-1">Toplam Peşinatlar</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(projectStats.totalDeposit)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow">
                  <div className="text-sm text-gray-600 mb-1">Toplam Kalan Alacak</div>
                  <div className="text-2xl font-bold text-red-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(projectStats.remainingBalance)}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      <SalesModal
        apartment={selectedApartment}
        isOpen={showSalesModal}
        onClose={handleModalClose}
        onSave={handleSalesSubmit}
        onCancel={handleCancelSale}
        existingRecords={selectedApartment ? salesRecords.filter(r => r.apartmentId === selectedApartment.id) : []}
        userRole={currentUser?.role || 'user'}
        selectedApartments={multiSelectMode ? selectedApartments : undefined}
        apartments={apartments}
      />
    </div>
  )
}
