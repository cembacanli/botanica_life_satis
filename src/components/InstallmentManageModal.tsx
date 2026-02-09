'use client'

import React, { useState } from 'react'

interface InstallmentManageModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: InstallmentManageData) => void
  currentData?: {
    startDate: string
    monthlyPayment: number
    installmentMonths: number
    paymentMethod?: string
    totalDebt?: number // Toplam Borç (Satış - Peşinat)
    paidAmount?: number // Yapılan Ödemeler Toplam
    remainingBalance?: number // Kalan Borç
  }
}

export interface InstallmentManageData {
  startDate: string
  monthlyPayment: number
  installmentMonths: number
  paymentMethod: 'nakit' | 'cek' | 'senet'
  installmentSchedule?: number[] // Her ay için özel tutarlar
}

const paymentMethods = [
  { id: 'nakit', label: '💵 Nakit' },
  { id: 'cek', label: '📄 Çek' },
  { id: 'senet', label: '📋 Senet' },
]

export default function InstallmentManageModal({
  isOpen,
  onClose,
  onSave,
  currentData,
}: InstallmentManageModalProps) {
  const [startDate, setStartDate] = useState(
    currentData?.startDate || new Date().toISOString().split('T')[0]
  )
  const [monthlyPayment, setMonthlyPayment] = useState(currentData?.monthlyPayment || 0)
  const [installmentMonths, setInstallmentMonths] = useState(currentData?.installmentMonths || 12)
  const [paymentMethod, setPaymentMethod] = useState<'nakit' | 'cek' | 'senet'>(
    (currentData?.paymentMethod as any) || 'nakit'
  )
  const [error, setError] = useState('')
  const [autoCalculate, setAutoCalculate] = useState(true) // Otomatik hesaplama açık/kapalı
  const [showSchedule, setShowSchedule] = useState(false) // Taksit çizelgesi göster/gizle
  const [installmentSchedule, setInstallmentSchedule] = useState<number[]>([]) // Her ay için tutarlar
  
  // Borç bilgileri
  const totalDebt = currentData?.totalDebt || 0 // Toplam Borç
  const paidAmount = currentData?.paidAmount || 0 // Yapılan Ödemeler
  const remainingBalance = currentData?.remainingBalance || (totalDebt - paidAmount) // Kalan Borç
  
  // İlk yükleme: taksit çizelgesi oluştur
  React.useEffect(() => {
    if (installmentMonths > 0 && monthlyPayment > 0) {
      const schedule = Array(installmentMonths).fill(monthlyPayment)
      setInstallmentSchedule(schedule)
    }
  }, []) // Sadece ilk yükleme

  // Son ay'daki tutarı ayarla (kalan borç hesabına göre)
  const recalculateLastMonth = (schedule: number[], lastMonthAmount?: number) => {
    if (schedule.length === 0) return schedule
    
    const newSchedule = [...schedule]
    const allButLastTotal = newSchedule.slice(0, -1).reduce((sum, val) => sum + val, 0)
    
    if (lastMonthAmount !== undefined) {
      newSchedule[newSchedule.length - 1] = lastMonthAmount
    } else {
      newSchedule[newSchedule.length - 1] = Math.max(0, remainingBalance - allButLastTotal)
    }
    
    return newSchedule
  }

  // Taksit tutarında değişiklik
  const handleInstallmentChange = (index: number, value: number) => {
    const newSchedule = [...installmentSchedule]
    newSchedule[index] = Math.max(0, value)

    // Son ay değilse, sonraki ayları eşit olarak ayarla
    if (index < newSchedule.length - 1) {
      const paidUpToNow = newSchedule.slice(0, index + 1).reduce((sum, val) => sum + val, 0)
      const remainingForLater = Math.max(0, remainingBalance - paidUpToNow)
      const monthsLeft = newSchedule.length - index - 1
      
      if (monthsLeft > 0) {
        const perMonth = Math.ceil(remainingForLater / monthsLeft)
        for (let i = index + 1; i < newSchedule.length; i++) {
          newSchedule[i] = perMonth
        }
        // Son ay için farkı ayarla
        const calculatedTotal = newSchedule.reduce((sum, val) => sum + val, 0)
        if (calculatedTotal !== remainingBalance) {
          newSchedule[newSchedule.length - 1] = remainingBalance - newSchedule.slice(0, -1).reduce((sum, val) => sum + val, 0)
        }
      }
    }

    setInstallmentSchedule(newSchedule)
  }
  
  // Aylık ödeme otomatik hesaplama
  const handleInstallmentMonthsChange = (value: number) => {
    setInstallmentMonths(value)
    
    // Schedule'ı yeniden oluştur
    if (autoCalculate && remainingBalance > 0) {
      const calculatedMonthly = Math.ceil(remainingBalance / value)
      setMonthlyPayment(calculatedMonthly)
      
      const schedule = Array(value).fill(calculatedMonthly)
      const lastMonthAmount = remainingBalance - (calculatedMonthly * (value - 1))
      schedule[schedule.length - 1] = lastMonthAmount
      setInstallmentSchedule(schedule)
    }
  }
  
  // Total tutar = Taksit çizelgesinin toplamı
  const totalAmount = installmentSchedule.length > 0 
    ? installmentSchedule.reduce((sum, val) => sum + val, 0)
    : monthlyPayment * installmentMonths

  const handleSave = () => {
    setError('')

    if (!startDate) {
      setError('Başlangıç tarihi gereklidir')
      return
    }

    if (!monthlyPayment || monthlyPayment <= 0) {
      setError('Aylık ödeme sıfırdan büyük olmalıdır')
      return
    }

    if (!installmentMonths || installmentMonths <= 0 || installmentMonths > 360) {
      setError('Taksit ayı 1-360 arasında olmalıdır')
      return
    }

    // Çizelge tutarlarını kontrol et
    if (installmentSchedule.length > 0) {
      const scheduleTotal = installmentSchedule.reduce((sum, val) => sum + val, 0)
      if (scheduleTotal !== totalAmount) {
        setError('Taksit çizelgesi tutarları geçersiz')
        return
      }
    }

    onSave({
      startDate,
      monthlyPayment,
      installmentMonths,
      paymentMethod,
      installmentSchedule: installmentSchedule.length > 0 ? installmentSchedule : undefined,
    } as any)

    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold">Taksit Bilgilerini Düzenle</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Başlangıç Tarihi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📅 Taksit Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Seçilen Tarih: {new Date(startDate).toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Borç Bilgileri - Read Only */}
          {totalDebt > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-2">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                📊 Borç Bilgileri
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-2 bg-white rounded border border-blue-100">
                  <span className="text-gray-700">Toplam Borç:</span>
                  <span className="font-bold text-blue-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(totalDebt)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center p-2 bg-white rounded border border-green-100">
                  <span className="text-gray-700">Yapılan Ödemeler:</span>
                  <span className="font-bold text-green-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(paidAmount)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center p-2 bg-white rounded border border-orange-100">
                  <span className="text-gray-700">Kalan Borç:</span>
                  <span className="font-bold text-orange-600 text-lg">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(Math.max(0, remainingBalance))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Aylık Ödeme Tutarı */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                💰 Aylık Ödeme Tutarı (TL)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCalculate}
                  onChange={(e) => setAutoCalculate(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Otomatik Hesapla</span>
              </label>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1000"
                value={monthlyPayment}
                onChange={(e) => {
                  setAutoCalculate(false) // Manuel değişiklik otomatik hesaplamayı kapat
                  setMonthlyPayment(parseInt(e.target.value) || 0)
                }}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  autoCalculate ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                placeholder="0"
                disabled={autoCalculate && remainingBalance > 0}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {monthlyPayment > 0
                ? `${installmentMonths} ay × ${new Intl.NumberFormat('tr-TR', {
                    style: 'currency',
                    currency: 'TRY',
                    minimumFractionDigits: 0,
                  }).format(monthlyPayment)} = ${new Intl.NumberFormat('tr-TR', {
                    style: 'currency',
                    currency: 'TRY',
                    minimumFractionDigits: 0,
                  }).format(totalAmount)}`
                : 'Tutar hazırlanıyor...'}
            </p>
            {remainingBalance > 0 && autoCalculate && (
              <p className="text-xs text-blue-600 mt-1">
                ✓ Kalan Borç ({new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  minimumFractionDigits: 0,
                }).format(remainingBalance)}) ÷ {installmentMonths} ay = Otomatik hesaplanan aylık ödeme
              </p>
            )}
          </div>

          {/* Taksit Ay Sayısı */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📊 Taksit Ay Sayısı
            </label>
            <input
              type="number"
              min="1"
              max="360"
              value={installmentMonths}
              onChange={(e) => handleInstallmentMonthsChange(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              {installmentMonths} ay ({Math.round((installmentMonths / 12) * 10) / 10} yıl)
              {autoCalculate && remainingBalance > 0 && (
                <span className="block text-blue-600 mt-1">
                  💡 Taksit sayısı değiştiğinde aylık ödeme otomatik güncellenir
                </span>
              )}
            </p>
          </div>

          {/* Ödeme Yöntemi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              🏦 Ödeme Yöntemi
            </label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as any)}
                  className={`px-3 py-2 rounded-lg font-medium transition-all border-2 ${
                    paymentMethod === method.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Özet */}
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
            <h3 className="font-semibold text-gray-800 mb-3">📋 Taksit Özeti</h3>
            <div className="space-y-2 text-sm">
              {remainingBalance > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Ödenmesi Gereken:</span>
                  <span className="font-bold text-orange-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(Math.max(0, remainingBalance))}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Başlangıç Tarihi:</span>
                <span className="font-medium">{new Date(startDate).toLocaleDateString('tr-TR')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Aylık Ödeme:</span>
                <span className="font-bold text-indigo-600">
                  {new Intl.NumberFormat('tr-TR', {
                    style: 'currency',
                    currency: 'TRY',
                    minimumFractionDigits: 0,
                  }).format(monthlyPayment)}
                </span>
              </div>
              <div className="flex justify-between items-center my-2 p-2 bg-white rounded border-l-4 border-indigo-600">
                <span className="text-gray-700">Toplam Ödenecek ({installmentMonths}×{monthlyPayment.toLocaleString('tr-TR')}):</span>
                <span className="font-bold text-indigo-700 text-lg">
                  {new Intl.NumberFormat('tr-TR', {
                    style: 'currency',
                    currency: 'TRY',
                    minimumFractionDigits: 0,
                  }).format(totalAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Ödeme Yöntemi:</span>
                <span className="font-medium">{paymentMethods.find(m => m.id === paymentMethod)?.label}</span>
              </div>
              
              {/* Fark Gösterimi */}
              {remainingBalance > 0 && Math.abs(totalAmount - remainingBalance) > 100 && (
                <div className={`mt-2 p-2 rounded text-xs ${
                  totalAmount > remainingBalance 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {totalAmount > remainingBalance
                    ? `✓ Kalan borçtan ${new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                        minimumFractionDigits: 0,
                      }).format(totalAmount - remainingBalance)} fazla ödeme yapılacak (Pozitif)`
                    : `⚠️ Kalan borçtan ${new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                        minimumFractionDigits: 0,
                      }).format(remainingBalance - totalAmount)} eksik ödeme (Son ay düşük tutar)`
                  }
                </div>
              )}
            </div>
          </div>

          {/* Taksit Çizelgesi */}
          <div className="border-t pt-4 mt-4">
            <button
              type="button"
              onClick={() => setShowSchedule(!showSchedule)}
              className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg font-medium text-purple-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                📅 Taksit Çizelgesi ({installmentMonths} ay)
              </span>
              <svg
                className={`w-5 h-5 transition-transform ${showSchedule ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>

            {showSchedule && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {installmentSchedule.map((amount, index) => {
                    // Ödeme tarihini hesapla
                    const paymentDate = new Date(startDate)
                    paymentDate.setMonth(paymentDate.getMonth() + index)
                    
                    return (
                      <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border border-purple-100">
                        <div className="flex-1">
                          <label className="text-xs text-gray-600 block">
                            {index + 1}. Taksit - {paymentDate.toLocaleDateString('tr-TR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={amount}
                            onChange={(e) => handleInstallmentChange(index, parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium"
                          />
                        </div>
                        <div className="text-right text-sm font-bold text-purple-600 min-w-[80px]">
                          {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'TRY',
                            minimumFractionDigits: 0,
                          }).format(amount)}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Çizelge Toplamı */}
                <div className="mt-4 p-3 bg-purple-100 rounded-lg border-2 border-purple-300 flex justify-between items-center">
                  <span className="font-bold text-purple-700">Çizelge Toplam:</span>
                  <span className="text-lg font-bold text-purple-700">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(totalAmount)}
                  </span>
                </div>

                {/* Kontrol Mesajları */}
                {Math.abs(totalAmount - remainingBalance) < 100 ? (
                  <div className="mt-2 p-2 bg-green-100 text-green-800 text-xs rounded">
                    ✅ Çizelge toplam, kalan borçla eşleşüyor!
                  </div>
                ) : totalAmount > remainingBalance ? (
                  <div className="mt-2 p-2 bg-blue-100 text-blue-800 text-xs rounded">
                    ℹ️ Kalan borçtan {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(totalAmount - remainingBalance)} fazla
                  </div>
                ) : (
                  <div className="mt-2 p-2 bg-red-100 text-red-800 text-xs rounded">
                    ⚠️ Kalan borçtan {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(remainingBalance - totalAmount)} eksik
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}
