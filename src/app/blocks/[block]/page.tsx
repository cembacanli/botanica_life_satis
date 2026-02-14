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
  const [saleDetailsMap, setSaleDetailsMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null)
  const [selectedApartments, setSelectedApartments] = useState<Set<string>>(new Set())
  const [showSalesModal, setShowSalesModal] = useState(false)
  const [filterFloor, setFilterFloor] = useState<string>('')
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [contractApartment, setContractApartment] = useState<Apartment | null>(null)

  useEffect(() => {
    const loadAll = async () => {
      try {
        const records = await fetchSalesRecords()
        await fetchSaleDetails()
        await fetchApartments(records)
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [blockName])

  const fetchSalesRecords = async () => {
    try {
      const response = await fetch('/api/sales')
      const data = await response.json()
      const records = Array.isArray(data) ? data : []
      setSalesRecords(records)
      return records
    } catch (error) {
      console.error('Error fetching sales records:', error)
      setSalesRecords([])
      return []
    }
  }

  const fetchSaleDetails = async () => {
    try {
      const response = await fetch('/api/sale-details')
      const data = await response.json()
      setSaleDetailsMap(data || {})
      return data
    } catch (error) {
      console.error('Error fetching sale details:', error)
      setSaleDetailsMap({})
      return {}
    }
  }

  const fetchApartments = async (recordsOverride?: SalesRecord[]) => {
    try {
      const response = await fetch(`/api/apartments?block=${blockName}`)
      const data = await response.json()
      const records = recordsOverride || salesRecords
      
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
    } catch (error) {
      console.error('Error fetching apartments:', error)
    }
  }

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchSalesRecords()
      fetchSaleDetails()
    }, 3000)

    return () => clearInterval(intervalId)
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

      fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecords),
      })
        .then(r => r.json())
        .then(data => {
          setSalesRecords(Array.isArray(data) ? data : [])
        })
        .catch(err => console.error('Sales save error:', err))

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

      // WhatsApp bildirimi gönder (TEK MESAJ)
      const firstData = dataArray[0]
      const soldApartments = apartments.filter(apt => dataArray.some(d => d.apartmentId === apt.id))
      
      if (dataArray.length > 1) {
        // Çoklu daire satışı
        const totalPrice = soldApartments.reduce((sum, apt) => sum + apt.price, 0)
        const apartmentNumbers = soldApartments.map(apt => apt.number)
        const blocks = [...new Set(soldApartments.map(apt => apt.block))]

        fetch('/api/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerPhone: firstData.customerPhone || '',
            customerName: firstData.customerName || '',
            block: blocks[0] || '',
            apartmentNumber: apartmentNumbers[0] || 0,
            price: totalPrice,
            totalPrice: totalPrice,
            depositAmount: firstData.paymentAmount || 0,
            monthlyPayment: firstData.monthlyPayment || 0,
            installmentMonths: firstData.installmentMonths || 0,
            saleType: firstData.saleType || 'sold',
            notificationType: 'sale',
            isMultiple: true,
            apartmentNumbers: apartmentNumbers,
            blocks: blocks,
          }),
        })
          .then(r => {
            if (!r.ok) throw new Error(`WhatsApp API error: ${r.status}`)
            return r.json()
          })
          .then(result => {
            if (result?.success === false) {
              console.warn('⚠️ WhatsApp error:', result?.message)
              if (result?.error?.includes('LİMİT')) {
                // Sandbox limit - bilgilendir ama satış başarılı
                console.warn('📊 Satış kaydedildi ama WhatsApp mesajı gönderilemedi:', result?.error)
              }
            } else if (result?.success === true) {
              console.log('✅ WhatsApp mesajı gönderildi')
            }
          })
          .catch(err => console.log('📌 WhatsApp bildirim (opsiyonel):', err.message))
      } else {
        // Tekli daire satışı
        const soldApt = soldApartments[0]
        if (soldApt) {
          fetch('/api/send-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerPhone: firstData.customerPhone || '',
              customerName: firstData.customerName || '',
              block: soldApt.block || '',
              apartmentNumber: soldApt.number || 0,
              price: soldApt.price || 0,
              depositAmount: firstData.paymentAmount || 0,
              monthlyPayment: firstData.monthlyPayment || 0,
              installmentMonths: firstData.installmentMonths || 0,
              saleType: firstData.saleType || 'sold',
              notificationType: 'sale',
            }),
          })
            .then(r => {
              if (!r.ok) throw new Error(`WhatsApp API error: ${r.status}`)
              return r.json()
            })
            .then(result => {
              if (result?.success === false) {
                console.warn('⚠️ WhatsApp error:', result?.message)
                if (result?.error?.includes('LİMİT')) {
                  console.warn('📊 Satış kaydedildi ama WhatsApp mesajı gönderilemedi:', result?.error)
                }
              } else if (result?.success === true) {
                console.log('✅ WhatsApp mesajı gönderildi')
              }
            })
            .catch(err => console.log('📌 WhatsApp bildirim (opsiyonel):', err.message))
        }
      }

      setShowSalesModal(false)
      setSelectedApartment(null)
      setSelectedApartments(new Set())
      setMultiSelectMode(false)

      fetchSaleDetails()

      // Başarı mesajı
      const count = dataArray.length
      alert(
        `${firstData.customerName} için ${count} ${count > 1 ? 'daire' : 'dairenin'} ${firstData.saleType === 'reservation' ? 'Rezervasyonu' : firstData.saleType === 'deposit' ? 'Kaporası' : 'Satışı'} başarıyla kaydedildi!`
      )
    },
    [salesRecords, multiSelectMode, selectedApartments, apartments]
  )

  const handleCancelSale = useCallback(
    (apartmentId: string) => {
      if (!apartmentId) {
        alert('Daire ID bulunamadı!')
        return
      }

      // İptal edilecek satış kaydını bul
      const recordToCancel = salesRecords.find(rec => rec.apartmentId === apartmentId)
      if (!recordToCancel) {
        alert('Satış kaydı bulunamadı!')
        return
      }

      // İlk olarak satış kaydını sil (/api/sales)
      fetch('/api/sales', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apartmentId: apartmentId }),
      })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`)
          return r.json()
        })
        .then(data => {
          // Sales kaydı başarıyla silindi
          setSalesRecords(Array.isArray(data) ? data : [])

          // Satış detay kaydını sil
          return fetch('/api/sale-details', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apartmentId: apartmentId }),
          }).then(r => r.json())
        })
        .then(() => {
          // Dairenin statusunu tekrar 'available' yap
          setApartments(prevApts =>
            prevApts.map(apt =>
              apt.id === apartmentId
                ? { ...apt, status: 'available' }
                : apt
            )
          )

          // WhatsApp iptal bildirimi gönder
          const apt = apartments.find(a => a.id === apartmentId)
          if (apt) {
            fetch('/api/send-whatsapp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customerPhone: recordToCancel.customerPhone || '',
                customerName: recordToCancel.customerName || 'Müşteri',
                block: apt.block,
                apartmentNumber: apt.number,
                price: apt.price,
                saleType: 'cancelled',
                notificationType: 'cancellation',
              }),
            })
              .then(r => r.json())
              .then(result => {
                if (result?.success === false) {
                  console.warn('⚠️ WhatsApp error:', result?.message)
                  if (result?.error?.includes('LİMİT')) {
                    console.warn('📊 İptal kaydedildi ama WhatsApp mesajı gönderilemedi:', result?.error)
                  }
                } else if (result?.success === true) {
                  console.log('✅ İptal WhatsApp mesajı gönderildi')
                }
              })
              .catch(err => console.log('📌 WhatsApp bildirim (opsiyonel):', err))
          }

          // Modal'ı kapat
          setShowSalesModal(false)
          setSelectedApartment(null)
          alert('✓ Satış işlemi başarıyla iptal edildi!')
        })
        .catch(err => {
          console.error('Cancel error:', err)
          alert('❌ İptal işlemi başarısız: ' + err.message)
        })
    },
    [salesRecords, apartments]
  )

  const handleCancelMultiple = useCallback(() => {
    if (!selectedApartments || selectedApartments.size === 0) return

    // Seçili dairelerin satış kayıtlarını al
    const selectedAptIds = Array.from(selectedApartments)
    const cancelRecords = salesRecords.filter(rec => selectedAptIds.includes(rec.apartmentId))

    if (cancelRecords.length === 0) {
      alert('Seçili dairelerde iptal edilecek satış kaydı bulunamadı!')
      return
    }

    // Tüm satış kayıtlarını sil
    const deletePromises = cancelRecords.map(record =>
      Promise.all([
        fetch('/api/sales', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apartmentId: record.apartmentId }),
        }),
        fetch('/api/sale-details', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apartmentId: record.apartmentId }),
        }),
      ])
    )

    Promise.all(deletePromises)
      .then(() => {
        // Satış kayıtlarını yenile
        fetchSalesRecords()

        // Dairelerin statusunu 'available' yap
        setApartments(prevApts =>
          prevApts.map(apt =>
            selectedAptIds.includes(apt.id)
              ? { ...apt, status: 'available' }
              : apt
          )
        )

        // Çoklu WhatsApp iptal bildirimi gönder
        const cancelledApts = apartments.filter(apt => selectedAptIds.includes(apt.id))
        const totalPrice = cancelledApts.reduce((sum, apt) => sum + apt.price, 0)
        const apartmentNumbers = cancelledApts.map(apt => apt.number)
        const blocks = [...new Set(cancelledApts.map(apt => apt.block))]
        const firstRecord = cancelRecords[0]

        fetch('/api/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerPhone: firstRecord.customerPhone,
            customerName: firstRecord.customerName,
            block: blocks[0],
            apartmentNumber: apartmentNumbers[0],
            price: totalPrice,
            totalPrice: totalPrice,
            saleType: 'cancelled',
            notificationType: 'cancellation',
            isMultiple: true,
            apartmentNumbers: apartmentNumbers,
            blocks: blocks,
          }),
        }).catch(err => console.log('WhatsApp mesajı gönderilemedi (opsiyonel):', err))

        // Modal'ı kapat ve seçimleri temizle
        setShowSalesModal(false)
        setSelectedApartment(null)
        setSelectedApartments(new Set())
        setMultiSelectMode(false)

        alert(`${cancelRecords.length} dairenin satışı başarıyla iptal edildi!`)
      })
      .catch(err => {
        console.error('Multiple cancel error:', err)
        alert('İptal işlemi sırasında hata oluştu!')
      })
  }, [selectedApartments, salesRecords, apartments])

  // İstatistik hesaplama fonksiyonları
  const calculateBlockStats = (blockLetter: string) => {
    const blockSales = salesRecords.filter(record => {
      const apt = apartments.find(a => a.id === record.apartmentId)
      return apt && apt.block === blockLetter && record.saleType === 'sold'
    })

    const totalRevenue = blockSales.reduce((sum, record) => {
      const saleData = saleDetailsMap[record.apartmentId] || {}
      return sum + (saleData.salePrice || 0)
    }, 0)

    const totalDeposit = blockSales.reduce((sum, record) => {
      const saleData = saleDetailsMap[record.apartmentId] || {}
      const payments = (saleData.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
      return sum + (saleData.depositAmount || 0) + payments
    }, 0)

    const remainingBalance = blockSales.reduce((sum, record) => {
      const saleData = saleDetailsMap[record.apartmentId] || {}
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
      const saleData = saleDetailsMap[record.apartmentId] || {}
      return sum + (saleData.salePrice || 0)
    }, 0)

    const totalDeposit = allSales.reduce((sum, record) => {
      const saleData = saleDetailsMap[record.apartmentId] || {}
      const payments = (saleData.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
      return sum + (saleData.depositAmount || 0) + payments
    }, 0)

    const remainingBalance = allSales.reduce((sum, record) => {
      const saleData = saleDetailsMap[record.apartmentId] || {}
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

  const openContractModal = (apt: Apartment) => {
    const saleInfo = getSalesInfo(apt.id)
    if (!saleInfo || saleInfo.saleType !== 'sold') {
      alert('Sozlesme sadece satilan daireler icin acilir.')
      return
    }
    setContractApartment(apt)
    setShowContractModal(true)
  }

  const handlePrintContract = () => {
    if (!contractApartment) return
    const saleInfo = getSalesInfo(contractApartment.id)
    const saleDetails = saleDetailsMap[contractApartment.id] || {}
    if (!saleInfo) return

    const contractHtml = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Daire Satis Sozlesmesi</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #111827; line-height: 1.5; }
            h1 { text-align: center; margin-bottom: 24px; }
            .section { margin-bottom: 18px; }
            .label { font-weight: bold; width: 180px; display: inline-block; }
            .box { border: 1px solid #d1d5db; padding: 14px; border-radius: 8px; }
            .sign { margin-top: 54px; display: flex; justify-content: space-between; gap: 24px; }
            .sign-item { width: 48%; text-align: center; }
            .line { margin-top: 64px; border-top: 1px solid #111827; padding-top: 6px; }
          </style>
        </head>
        <body>
          <h1>DAIRE SATIS SOZLESMESI</h1>

          <div class="section box">
            <div><span class="label">Musteri:</span> ${saleInfo.customerName}</div>
            <div><span class="label">Telefon:</span> ${saleInfo.customerPhone}</div>
            <div><span class="label">Islem Tarihi:</span> ${new Date().toLocaleDateString('tr-TR')}</div>
          </div>

          <div class="section box">
            <div><span class="label">Blok:</span> ${contractApartment.block}</div>
            <div><span class="label">Daire No:</span> ${contractApartment.number}</div>
            <div><span class="label">Kat:</span> ${contractApartment.floor}</div>
            <div><span class="label">Daire Tipi:</span> ${contractApartment.type}</div>
            <div><span class="label">Alan:</span> ${contractApartment.area} m²</div>
          </div>

          <div class="section box">
            <div><span class="label">Satis Bedeli:</span> ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(saleDetails.salePrice || contractApartment.price)}</div>
            <div><span class="label">Pesinat:</span> ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(saleDetails.depositAmount || 0)}</div>
            <div><span class="label">Kalan Bakiye:</span> ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(saleDetails.remainingBalance || 0)}</div>
          </div>

          <p>Taraflar, yukarida bilgileri yer alan daire satisina iliskin sartlari okuyup kabul etmistir.</p>

          <div class="sign">
            <div class="sign-item">
              <div class="line">SATICI IMZA / KASE</div>
            </div>
            <div class="sign-item">
              <div class="line">ALICI IMZA</div>
            </div>
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(contractHtml)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
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
    fetchSalesRecords()
    fetchSaleDetails()
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
                const firstSelectedId = Array.from(selectedApartments)[0]
                const firstSelected = apartments.find(a => a.id === firstSelectedId) || null
                setSelectedApartment(firstSelected)
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
                    const isSelected = selectedApartments.has(apt.id)

                    return (
                      <div
                        key={idx}
                        onClick={() => multiSelectMode && apt.status === 'available' && handleApartmentClick(apt)}
                        className={`relative rounded-lg shadow-md border-2 overflow-hidden transition-all hover:shadow-lg ${
                          isSelected 
                            ? 'border-4 border-blue-600 bg-blue-50' 
                            : getStatusColor(apt.status)
                        } ${multiSelectMode && apt.status === 'available' ? 'cursor-pointer hover:scale-105' : ''}`}
                      >
                        {/* Selection Indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg z-10">
                            ✓
                          </div>
                        )}
                        
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

                          {/* Butonlar */}
                          <div className="space-y-2">
                            <button
                              onClick={() => { setSelectedApartment(apt); setShowSalesModal(true) }}
                              disabled={apt.status !== 'available' && currentUser?.role !== 'admin'}
                              className={`w-full py-3 rounded-lg font-medium transition-all ${
                                apt.status === 'available' || currentUser?.role === 'admin'
                                  ? 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg cursor-pointer'
                                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              }`}
                            >
                              {apt.status === 'available' ? 'Satış Yap' : currentUser?.role === 'admin' ? 'Düzenle / İptal' : statusBadge.label}
                            </button>

                            {apt.status === 'sold' && saleInfo && (
                              <button
                                onClick={() => openContractModal(apt)}
                                className="w-full py-2 rounded-lg font-medium transition-all bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg"
                              >
                                Sözleşme İmzala
                              </button>
                            )}
                          </div>
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
                    const isSelected = selectedApartments.has(apt.id)

                    return (
                      <div
                        key={idx}
                        onClick={() => multiSelectMode && apt.status === 'available' && handleApartmentClick(apt)}
                        className={`relative rounded-lg shadow-md border-2 overflow-hidden transition-all hover:shadow-lg ${
                          isSelected 
                            ? 'border-4 border-blue-600 bg-blue-50' 
                            : getStatusColor(apt.status)
                        } ${multiSelectMode && apt.status === 'available' ? 'cursor-pointer hover:scale-105' : ''}`}
                      >
                        {/* Selection Indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg z-10">
                            ✓
                          </div>
                        )}
                        
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

                          {/* Butonlar */}
                          <div className="space-y-2">
                            <button
                              onClick={() => { setSelectedApartment(apt); setShowSalesModal(true) }}
                              disabled={apt.status !== 'available' && currentUser?.role !== 'admin'}
                              className={`w-full py-3 rounded-lg font-medium transition-all ${
                                apt.status === 'available' || currentUser?.role === 'admin'
                                  ? 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg cursor-pointer'
                                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              }`}
                            >
                              {apt.status === 'available' ? 'Satış Yap' : currentUser?.role === 'admin' ? 'Düzenle / İptal' : statusBadge.label}
                            </button>

                            {apt.status === 'sold' && saleInfo && (
                              <button
                                onClick={() => openContractModal(apt)}
                                className="w-full py-2 rounded-lg font-medium transition-all bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg"
                              >
                                Sözleşme İmzala
                              </button>
                            )}
                          </div>
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
                    const isSelected = selectedApartments.has(apt.id)

                    return (
                      <div
                        key={idx}
                        onClick={() => multiSelectMode && apt.status === 'available' && handleApartmentClick(apt)}
                        className={`relative rounded-lg shadow-md border-2 overflow-hidden transition-all hover:shadow-lg ${
                          isSelected 
                            ? 'border-4 border-blue-600 bg-blue-50' 
                            : getStatusColor(apt.status)
                        } ${multiSelectMode && apt.status === 'available' ? 'cursor-pointer hover:scale-105' : ''}`}
                      >
                        {/* Selection Indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg z-10">
                            ✓
                          </div>
                        )}
                        
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

                          {/* Butonlar */}
                          <div className="space-y-2">
                            <button
                              onClick={() => { setSelectedApartment(apt); setShowSalesModal(true) }}
                              disabled={apt.status !== 'available' && currentUser?.role !== 'admin'}
                              className={`w-full py-3 rounded-lg font-medium transition-all ${
                                apt.status === 'available' || currentUser?.role === 'admin'
                                  ? 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg cursor-pointer'
                                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              }`}
                            >
                              {apt.status === 'available' ? 'Satış Yap' : currentUser?.role === 'admin' ? 'Düzenle / İptal' : statusBadge.label}
                            </button>

                            {apt.status === 'sold' && saleInfo && (
                              <button
                                onClick={() => openContractModal(apt)}
                                className="w-full py-2 rounded-lg font-medium transition-all bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg"
                              >
                                Sözleşme İmzala
                              </button>
                            )}
                          </div>
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
                    const isSelected = selectedApartments.has(apt.id)

                    return (
                      <div
                        key={idx}
                        onClick={() => multiSelectMode && apt.status === 'available' && handleApartmentClick(apt)}
                        className={`relative rounded-lg shadow-md border-2 overflow-hidden transition-all hover:shadow-lg ${
                          isSelected 
                            ? 'border-4 border-blue-600 bg-blue-50' 
                            : getStatusColor(apt.status)
                        } ${multiSelectMode && apt.status === 'available' ? 'cursor-pointer hover:scale-105' : ''}`}
                      >
                        {/* Selection Indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg z-10">
                            ✓
                          </div>
                        )}
                        
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

                          {/* Butonlar */}
                          <div className="space-y-2">
                            <button
                              onClick={() => { setSelectedApartment(apt); setShowSalesModal(true) }}
                              disabled={apt.status !== 'available' && currentUser?.role !== 'admin'}
                              className={`w-full py-3 rounded-lg font-medium transition-all ${
                                apt.status === 'available' || currentUser?.role === 'admin'
                                  ? 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg cursor-pointer'
                                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              }`}
                            >
                              {apt.status === 'available' ? 'Satış Yap' : currentUser?.role === 'admin' ? 'Düzenle / İptal' : statusBadge.label}
                            </button>

                            {apt.status === 'sold' && saleInfo && (
                              <button
                                onClick={() => openContractModal(apt)}
                                className="w-full py-2 rounded-lg font-medium transition-all bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg"
                              >
                                Sözleşme İmzala
                              </button>
                            )}
                          </div>
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

      {showContractModal && contractApartment && (() => {
        const saleInfo = getSalesInfo(contractApartment.id)
        const saleDetails = saleDetailsMap[contractApartment.id] || {}
        if (!saleInfo) return null

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Sözleşme İmzala</h2>
                  <p className="text-white/80 text-sm mt-1">Blok {contractApartment.block} - Daire {contractApartment.number}</p>
                </div>
                <button
                  onClick={() => {
                    setShowContractModal(false)
                    setContractApartment(null)
                  }}
                  className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25"
                >
                  Kapat
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3">Müşteri Bilgileri</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Ad Soyad:</span> <span className="font-medium">{saleInfo.customerName}</span></div>
                    <div><span className="text-gray-500">Telefon:</span> <span className="font-medium">{saleInfo.customerPhone}</span></div>
                    <div><span className="text-gray-500">Satış Tarihi:</span> <span className="font-medium">{saleInfo.date}</span></div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3">Daire Bilgileri</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Blok / Daire:</span> <span className="font-medium">{contractApartment.block} / {contractApartment.number}</span></div>
                    <div><span className="text-gray-500">Kat:</span> <span className="font-medium">{contractApartment.floor}</span></div>
                    <div><span className="text-gray-500">Tip:</span> <span className="font-medium">{contractApartment.type}</span></div>
                    <div><span className="text-gray-500">Alan:</span> <span className="font-medium">{contractApartment.area} m²</span></div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3">Ödeme Özeti</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Satış Bedeli</div>
                      <div className="font-bold text-green-700">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(saleDetails.salePrice || contractApartment.price)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Peşinat</div>
                      <div className="font-bold text-blue-700">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(saleDetails.depositAmount || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Kalan Bakiye</div>
                      <div className="font-bold text-red-700">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(saleDetails.remainingBalance || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-gray-300 p-4">
                  <div className="text-sm text-gray-600 mb-8">
                    Taraflar, satış sözleşmesini okuyup kabul ederek aşağıdaki alanları imzalayacaktır.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
                    <div>
                      <div className="h-16"></div>
                      <div className="border-t pt-2 text-sm font-medium">SATICI İMZA / KAŞE</div>
                    </div>
                    <div>
                      <div className="h-16"></div>
                      <div className="border-t pt-2 text-sm font-medium">ALICI İMZA</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0 flex justify-end gap-3">
                <button
                  onClick={() => handlePrintContract()}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  Yazdır ve İmzala
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      <SalesModal
        apartment={selectedApartment}
        isOpen={showSalesModal}
        onClose={handleModalClose}
        onSave={handleSalesSubmit}
        onCancel={handleCancelSale}
        onCancelMultiple={handleCancelMultiple}
        existingRecords={selectedApartment ? salesRecords.filter(r => r.apartmentId === selectedApartment.id) : []}
        userRole={currentUser?.role || 'user'}
        selectedApartments={multiSelectMode ? selectedApartments : undefined}
        apartments={apartments}
      />
    </div>
  )
}
