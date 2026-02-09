'use client'

import React, { useState } from 'react'
import { Apartment } from '@/lib/data-generator'
import { INSTALLMENT_OPTIONS, calculateInstallment, formatPrice } from '@/lib/installments'

interface SalesRecord {
  apartmentId: string
  saleType: 'reservation' | 'deposit' | 'sold'
  customerName: string
  customerPhone: string
  date: string
}

interface SalesModalProps {
  apartment: Apartment | null
  isOpen: boolean
  onClose: () => void
  onSave: (saleData: SaleData | SaleData[]) => void
  onCancel?: (recordId: number) => void
  existingRecords?: SalesRecord[]
  userRole?: string // 'admin' ise iptal butonu gösterilir
  selectedApartments?: Set<string> // Çoklu seçim için
  apartments?: Apartment[] // Tüm daireler (çoklu seçim yaparken lazım)
}

export interface SaleData {
  apartmentId: string
  saleType: 'reservation' | 'deposit' | 'sold'
  customerName: string
  customerPhone: string
  customerEmail: string
  paymentAmount?: number
  installmentMonths?: number
  monthlyPayment?: number
  notes?: string
}

type SaleType = 'reservation' | 'deposit' | 'sold'

const saleTypeInfo: Record<
  SaleType,
  { label: string; color: string; icon: string; description: string }
> = {
  reservation: {
    label: 'Rezervasyon',
    color: 'bg-blue-500',
    icon: '📅',
    description: 'Dairenin geçici olarak rezerve edilmesi',
  },
  deposit: {
    label: 'Kapora',
    color: 'bg-yellow-500',
    icon: '💰',
    description: 'Kapora ödenir ve satış başlatılır',
  },
  sold: {
    label: 'Satış Tamamı',
    color: 'bg-green-500',
    icon: '✅',
    description: 'Tam satış ve sözleşme imzalanır',
  },
}

export default function SalesModal({ 
  apartment, 
  isOpen, 
  onClose, 
  onSave,
  onCancel,
  existingRecords = [],
  userRole = 'user',
  selectedApartments,
  apartments = []
}: SalesModalProps) {
  const [selectedSaleType, setSelectedSaleType] = useState<SaleType>('reservation')
  const [selectedInstallment, setSelectedInstallment] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    paymentAmount: '',
    salePrice: '',
    notes: '',
  })

  // When modal opens, initialize salePrice with apartment price
  React.useEffect(() => {
    if (apartment && isOpen) {
      setFormData(prev => ({ ...prev, salePrice: apartment.price.toString() }))
    }
  }, [apartment, isOpen])

  if (!isOpen || !apartment) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Çoklu seçim kontrolü
      const aptIds = selectedApartments && selectedApartments.size > 0 
        ? Array.from(selectedApartments)
        : apartment 
        ? [apartment.id]
        : []

      if (aptIds.length === 0) {
        alert('Lütfen en az bir daire seçin')
        return
      }

      // Taksit planı hesapla (Faiz yok, ilk ödeme düşülü)
      let installmentData = { months: 1, payment: 0 }
      const firstApt = apartments.find(a => a.id === aptIds[0]) || apartment
      if (selectedSaleType === 'sold' && selectedInstallment >= 1 && firstApt) {
        const depositAmount = formData.paymentAmount ? parseInt(formData.paymentAmount) : 0
        const salePrice = formData.salePrice ? parseInt(formData.salePrice) : firstApt.price
        const plan = calculateInstallment(
          salePrice,
          depositAmount,
          selectedInstallment
        )
        installmentData = { months: selectedInstallment, payment: plan.monthlyPayment }
      }

      // Tüm seçili daireler için SaleData oluştur
      const saleDataArray: SaleData[] = aptIds.map(aptId => ({
        apartmentId: aptId,
        saleType: selectedSaleType,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail,
        paymentAmount: formData.paymentAmount ? parseInt(formData.paymentAmount) : undefined,
        installmentMonths: selectedInstallment > 1 ? selectedInstallment : undefined,
        monthlyPayment: installmentData.payment > 0 ? installmentData.payment : undefined,
        notes: formData.notes,
      }))

      // Her daire için detayları kaydet
      const salePrice = formData.salePrice ? parseInt(formData.salePrice) : (apartment?.price || 0)
      aptIds.forEach(aptId => {
        const saleDetails = {
          apartmentId: aptId,
          depositAmount: formData.paymentAmount ? parseInt(formData.paymentAmount) : 0,
          salePrice,
          installmentMonths: selectedInstallment,
          monthlyPayment: installmentData.payment,
          payments: [],
          remainingBalance: salePrice - (formData.paymentAmount ? parseInt(formData.paymentAmount) : 0),
        }
        localStorage.setItem(`saleDetails_${aptId}`, JSON.stringify(saleDetails))
      })

      // WhatsApp mesajı gönder (sadece birinci daire için)
      try {
        const firstApart = apartments.find(a => a.id === aptIds[0]) || apartment
        await fetch('/api/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerPhone: formData.customerPhone,
            customerName: formData.customerName,
            block: firstApart?.block || '',
            apartmentNumber: firstApart?.number || '',
            price: salePrice,
            depositAmount: formData.paymentAmount ? parseInt(formData.paymentAmount) : 0,
            saleType: selectedSaleType,
            monthlyPayment: installmentData.payment,
            installmentMonths: installmentData.months,
          }),
        })
      } catch (err) {
        console.log('WhatsApp mesajı gönderilemedi (opsiyonel):', err)
        // Devam et
      }

      // onSave callback'ini çağır - çoklu veya tek seçim
      if (saleDataArray.length > 1) {
        onSave(saleDataArray)
      } else {
        onSave(saleDataArray[0])
      }

      setFormData({ customerName: '', customerPhone: '', customerEmail: '', paymentAmount: '', salePrice: '', notes: '' })
      setSelectedInstallment(1)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleCancelRecord = (index: number) => {
    if (confirmingCancel === index) {
      // Onay verildiyse iptal et
      if (onCancel) {
        onCancel(index)
        setConfirmingCancel(null)
        alert('Satış işlemi başarıyla iptal edildi!')
      }
    } else {
      // İlk klik: onay iste
      setConfirmingCancel(index)
    }
  }

  if (!isOpen || !apartment) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Satış İşlemi</h2>
            <p className="text-gray-300 text-sm mt-1">
              Blok {apartment.block} - Daire {apartment.number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {/* Önceki Satış Kayıtları */}
          {existingRecords.length > 0 && (
            <div className="mb-8 p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">⚠️</span>
                <h3 className="font-semibold text-amber-900">Bu Daire İçin Aktif Satış Kaydı Var</h3>
              </div>
              <div className="space-y-3">
                {existingRecords.map((record, index) => {
                  const saleType = saleTypeInfo[record.saleType]
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white rounded border border-amber-100"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{saleType.icon}</span>
                          <span className="font-semibold text-gray-900">{record.customerName}</span>
                          <span className={`text-xs px-2 py-1 rounded ${saleType.color}`}>
                            {saleType.label}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">{record.date}</div>
                      </div>
                      {onCancel && userRole === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleCancelRecord(index)}
                          className={`ml-3 px-3 py-2 rounded font-medium transition-all ${
                            confirmingCancel === index
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700'
                          }`}
                        >
                          {confirmingCancel === index ? '✓ Onayla' : '✕ İptal Et'}
                        </button>
                      )}
                      {existingRecords.length > 0 && userRole !== 'admin' && (
                        <span className="ml-3 px-3 py-2 text-sm text-gray-500">🔒 Kilitli</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-sm text-amber-800 mt-4 italic">
                ℹ️ Yeni bir satış yapmak için önce mevcut satış kaydını iptal etmelisiniz.
              </p>
            </div>
          )}

          {/* Daire Bilgileri */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Daire Bilgileri</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Blok</div>
                <div className="font-bold text-gray-900 text-lg">{apartment.block}</div>
              </div>
              <div>
                <div className="text-gray-600">Kat</div>
                <div className="font-bold text-gray-900 text-lg">{apartment.floor}</div>
              </div>
              <div>
                <div className="text-gray-600">Daire No</div>
                <div className="font-bold text-gray-900 text-lg">{apartment.number}</div>
              </div>
              <div>
                <div className="text-gray-600">Tip</div>
                <div className="font-bold text-gray-900 text-lg">{apartment.type}</div>
              </div>
              <div>
                <div className="text-gray-600">Alan</div>
                <div className="font-bold text-gray-900">{apartment.area} m²</div>
              </div>
              <div>
                <div className="text-gray-600">Cephe</div>
                <div className="font-bold text-gray-900">
                  {apartment.facade === 'ana_yol' ? 'Ana Yol' : 'Arka'}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-gray-600">Fiyat</div>
                <div className="font-bold text-green-600 text-lg">
                  {new Intl.NumberFormat('tr-TR', {
                    style: 'currency',
                    currency: 'TRY',
                    minimumFractionDigits: 0,
                  }).format(apartment.price)}
                </div>
              </div>
            </div>
          </div>

          {/* Satış Türü Seçimi */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Satış Türü Seçin</h3>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(saleTypeInfo).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedSaleType(key as SaleType)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedSaleType === key
                      ? `${info.color} border-current text-white`
                      : 'border-gray-200 text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{info.icon}</div>
                  <div className="font-bold text-sm">{info.label}</div>
                </button>
              ))}
            </div>
            <p className="text-gray-600 text-sm mt-3">
              {saleTypeInfo[selectedSaleType].description}
            </p>
          </div>

          {/* Müşteri Bilgileri */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Müşteri Bilgileri</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Müşteri Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={e => handleInputChange('customerName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ad Soyad"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefon *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.customerPhone}
                    onChange={e => handleInputChange('customerPhone', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="05XX XXX XXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.customerEmail}
                    onChange={e => handleInputChange('customerEmail', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ödeme Bilgileri */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Ödeme Bilgileri</h3>
            {selectedSaleType !== 'reservation' && (
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Satış Fiyatı (TL)
                  </label>
                  <input
                    type="number"
                    value={formData.salePrice}
                    onChange={e => handleInputChange('salePrice', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                  />
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {selectedSaleType === 'deposit' ? 'Kapora Tutarı' : 'Ödeme Tutarı'} (TL)
                </label>
                <input
                  type="number"
                  value={formData.paymentAmount}
                  onChange={e => handleInputChange('paymentAmount', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
                {selectedSaleType === 'deposit' && (
                  <p className="text-sm text-gray-600 mt-2">
                    Tipik kapora: %20 = {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(apartment.price * 0.2)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Taksit Seçeneği (Satış için) */}
          {selectedSaleType === 'sold' && (
            <div className="mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">📅 Taksit Seçeneği (Faiz Yok)</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Taksit Ayı Sayısı (İstediğiniz tam sayıyı girin)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={selectedInstallment}
                  onChange={e => setSelectedInstallment(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ay sayısını girin (örn: 12)"
                />
                <p className="text-xs text-gray-500 mt-1">Min: 1, Max: 60 ay</p>
              </div>

              {/* Taksit Özeti */}
              {selectedInstallment > 0 && formData.paymentAmount && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Taksit Özeti</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Satış Fiyatı</div>
                      <div className="font-bold text-gray-900">
                        {new Intl.NumberFormat('tr-TR', {
                          style: 'currency',
                          currency: 'TRY',
                          minimumFractionDigits: 0,
                        }).format(formData.salePrice ? parseInt(formData.salePrice) : apartment.price)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">İlk Ödeme</div>
                      <div className="font-bold text-green-600">
                        {new Intl.NumberFormat('tr-TR', {
                          style: 'currency',
                          currency: 'TRY',
                          minimumFractionDigits: 0,
                        }).format(formData.paymentAmount ? parseInt(formData.paymentAmount) : 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">Kalan Tutar</div>
                      <div className="font-bold text-gray-900">
                        {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'TRY',
                            minimumFractionDigits: 0,
                          }).format(Math.max(0, (formData.salePrice ? parseInt(formData.salePrice) : apartment.price) - (formData.paymentAmount ? parseInt(formData.paymentAmount) : 0)))}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">Taksit Sayısı</div>
                      <div className="font-bold text-blue-600">
                        {selectedInstallment} ay
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-gray-600">Aylık Ödeme (Faiz Yok)</div>
                      <div className="font-bold text-blue-600 text-lg">
                        {new Intl.NumberFormat('tr-TR', {
                          style: 'currency',
                          currency: 'TRY',
                          minimumFractionDigits: 0,
                        }).format(formData.paymentAmount ? Math.round(((formData.salePrice ? parseInt(formData.salePrice) : apartment.price) - parseInt(formData.paymentAmount)) / selectedInstallment) : (formData.salePrice ? parseInt(formData.salePrice) : apartment.price) / selectedInstallment)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notlar */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notlar
            </label>
            <textarea
              value={formData.notes}
              onChange={e => handleInputChange('notes', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="İlave notlar ekleyin..."
            />
          </div>

          {/* Butonlar */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Kapat
            </button>
            <button
              type="submit"
              disabled={isSubmitting || existingRecords.length > 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-wait disabled:from-gray-400 disabled:to-gray-400 flex items-center justify-center gap-2"
            >
              {existingRecords.length > 0 ? (
                <>
                  🔒 Satış Yapılamaz
                </>
              ) : isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  İşleniyor...
                </>
              ) : (
                'Satışı Tamamla'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
