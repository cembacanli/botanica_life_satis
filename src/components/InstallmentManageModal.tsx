'use client'

import React, { useState, useEffect } from 'react'

interface InstallmentManageModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: InstallmentManageData) => void
  currentData?: {
    startDate: string
    monthlyPayment: number
    installmentMonths: number
    paymentMethod?: string
    totalDebt?: number
    paidAmount?: number
    remainingBalance?: number
    installmentSchedule?: number[]
    installmentScheduleDates?: string[]
    depositAmount?: number
    salePrice?: number
  }
}

export interface InstallmentManageData {
  startDate: string
  monthlyPayment: number
  installmentMonths: number
  paymentMethod: 'nakit' | 'cek' | 'senet'
  installmentSchedule?: number[]
  installmentScheduleDates?: string[]
  depositAmount?: number
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
  const [startDate, setStartDate] = useState('')
  const [monthlyPayment, setMonthlyPayment] = useState(0)
  const [installmentMonths, setInstallmentMonths] = useState(12)
  const [paymentMethod, setPaymentMethod] = useState<'nakit' | 'cek' | 'senet'>('nakit')
  const [error, setError] = useState('')
  const [autoCalculate, setAutoCalculate] = useState(true)
  const [showSchedule, setShowSchedule] = useState(false)
  const [depositAmount, setDepositAmount] = useState(0)
  
  // Taksit tarihleri ve tutarları
  const [installmentDates, setInstallmentDates] = useState<string[]>([])
  const [customAmounts, setCustomAmounts] = useState<{ [key: number]: number }>({})

  const salePrice = currentData?.salePrice || 0
  const totalDebt = currentData?.totalDebt || 0
  const paidAmount = currentData?.paidAmount || 0
  
  // ⭐ Kalan taksit toplamı = Daire bedeli - Peşinat (sadece 1 kez çıkart)
  const effectiveRemainingBalance = Math.max(0, salePrice - depositAmount)

  // Initialize modal açılışında SADECE BİR KEZ
  useEffect(() => {
    if (!isOpen) return
    
    if (currentData) {
      const initDate = currentData.startDate || new Date().toISOString().split('T')[0]
      setStartDate(initDate)
      setMonthlyPayment(currentData.monthlyPayment || 0)
      setInstallmentMonths(currentData.installmentMonths || 12)
      setPaymentMethod((currentData.paymentMethod as any) || 'nakit')
      setDepositAmount(currentData.depositAmount || 0)
      setAutoCalculate(!currentData.installmentSchedule || currentData.installmentSchedule.length === 0)
      setError('')
      
      // Taksit tarihlerini initialize et
      const months = currentData.installmentMonths || 12
      const dates = []
      const baseDate = new Date(initDate)
      
      if (baseDate && !isNaN(baseDate.getTime())) {
        for (let i = 0; i < months; i++) {
          const d = new Date(baseDate)
          d.setMonth(d.getMonth() + i)
          dates.push(d.toISOString().split('T')[0])
        }
      } else {
        const validDate = new Date()
        for (let i = 0; i < months; i++) {
          const d = new Date(validDate)
          d.setMonth(d.getMonth() + i)
          dates.push(d.toISOString().split('T')[0])
        }
      }
      setInstallmentDates(dates)
      
      // Custom tutarlar varsa yükle
      if (currentData.installmentSchedule && currentData.installmentSchedule.length > 0) {
        const amounts: { [key: number]: number } = {}
        currentData.installmentSchedule.forEach((amount, index) => {
          amounts[index] = amount
        })
        setCustomAmounts(amounts)
      } else {
        setCustomAmounts({})
      }
    }
  }, [isOpen]) // SADECE isOpen dependency!

  // Otomatik hesapla modu: ay/tutar/peşinat değişince güncelle
  useEffect(() => {
    // ⭐ Peşinat değiştiğinde aylık ödemeyi yeniden hesapla
    if (autoCalculate && effectiveRemainingBalance > 0 && installmentMonths > 0) {
      const monthly = Math.ceil(effectiveRemainingBalance / installmentMonths)
      setMonthlyPayment(monthly)
      
      // Custom tutarlar varsa temizle (peşinat değişirse taksitleri sıfırla)
      if (Object.keys(customAmounts).length > 0) {
        setCustomAmounts({})
      }
    }
    
    // Ay sayısı değişirse tarih dizisini güncelle
    const dates = []
    const fallbackDate = new Date()
    const baseDate = startDate ? new Date(startDate) : fallbackDate
    
    // Eğer baseDate invalid ise, hata vermesin
    if (!baseDate || isNaN(baseDate.getTime())) {
      const validDate = new Date()
      for (let i = 0; i < installmentMonths; i++) {
        const d = new Date(validDate)
        d.setMonth(d.getMonth() + i)
        dates.push(d.toISOString().split('T')[0])
      }
    } else {
      for (let i = 0; i < installmentMonths; i++) {
        const d = new Date(baseDate)
        d.setMonth(d.getMonth() + i)
        dates.push(d.toISOString().split('T')[0])
      }
    }
    setInstallmentDates(dates)
  }, [autoCalculate, effectiveRemainingBalance, installmentMonths, startDate, depositAmount])

  // Tutar düzenlendiğinde geri kalan taksitleri otomatik hesapla
  const handleAmountChange = (index: number, value: number) => {
    const newAmounts = { ...customAmounts }
    
    if (value > 0) {
      newAmounts[index] = value
    } else {
      delete newAmounts[index]
    }
    
    // Şu anki düzenlenen ve önceki taksitlerin tutarını hesapla
    let paidSoFar = 0
    for (let i = 0; i < index; i++) {
      paidSoFar += newAmounts[i] !== undefined ? newAmounts[i] : monthlyPayment
    }
    paidSoFar += value // Şu anki tutarı ekle
    
    // ⭐ Kalan bakiye (peşinat değişse de dinamik olsun)
    const remainingDebt = effectiveRemainingBalance - paidSoFar
    const remainingMonths = installmentMonths - index - 1
    
    // Geri kalan taksitleri eşit olarak dağıt
    if (remainingMonths > 0 && remainingDebt > 0) {
      const perMonth = Math.ceil(remainingDebt / remainingMonths)
      
      for (let i = index + 1; i < installmentMonths; i++) {
        if (i === installmentMonths - 1) {
          // Son taksit: tam kalan bakiye
          const beforeLast = paidSoFar + (i - index - 1) * perMonth
          newAmounts[i] = Math.max(0, effectiveRemainingBalance - beforeLast)
        } else {
          newAmounts[i] = perMonth
        }
      }
    } else if (remainingMonths === 0) {
      // Bu son taksit
      newAmounts[index] = Math.max(0, effectiveRemainingBalance - paidSoFar + value)
    }
    
    setCustomAmounts(newAmounts)
  }

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

    // Schedule oluştur - custom tutarlar varsa onları kullan
    const schedule: number[] = []
    for (let i = 0; i < installmentMonths; i++) {
      if (customAmounts[i] !== undefined) {
        schedule.push(customAmounts[i])
      } else if (i === installmentMonths - 1) {
        // Son ay: kalan borç
        const allButLast = schedule.reduce((a, b) => a + b, 0)
        schedule.push(Math.max(0, effectiveRemainingBalance - allButLast))
      } else {
        schedule.push(monthlyPayment)
      }
    }

    onSave({
      startDate,
      monthlyPayment,
      installmentMonths,
      paymentMethod,
      installmentSchedule: schedule,
      installmentScheduleDates: installmentDates,
      depositAmount,
    })

    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full shadow-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 rounded-t-lg sticky top-0 z-10">
          <h2 className="text-lg font-bold">Taksit Bilgilerini Düzenle</h2>
        </div>

        {/* Content - 2 Column Layout */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[calc(95vh-140px)] overflow-y-auto">
          {/* Left Column - Temel Ayarlar */}
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Borç Bilgileri */}
          {totalDebt > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-2">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">📊 Borç Bilgileri</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Toplam Borç:</span>
                  <span className="font-bold text-blue-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(totalDebt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Yapılan Ödemeler:</span>
                  <span className="font-bold text-green-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded border border-orange-200">
                  <span className="text-gray-700">Kalan Borç:</span>
                  <span className="font-bold text-orange-600 text-lg">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(Math.max(0, effectiveRemainingBalance))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Peşinat */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">💵 Peşinat (TL)</label>
            <input
              type="number"
              min="0"
              step="50000"
              value={depositAmount}
              onChange={(e) => setDepositAmount(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold text-lg"
            />
          </div>

          {/* Başlangıç Tarihi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">📅 Taksit Başlangıç Tarihi</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Taksit Ay Sayısı */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">📊 Taksit Ay Sayısı</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (installmentMonths > 1) {
                    setInstallmentMonths(installmentMonths - 1)
                    setAutoCalculate(false)
                  }
                }}
                disabled={installmentMonths <= 1}
                className="px-3 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded font-bold transition-colors"
              >
                ➖
              </button>

              <input
                type="number"
                min="1"
                max="360"
                value={installmentMonths}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  if (!isNaN(val) && val >= 1 && val <= 360) {
                    setInstallmentMonths(val)
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold text-center text-lg"
              />

              <button
                type="button"
                onClick={() => {
                  if (installmentMonths < 360) {
                    setInstallmentMonths(installmentMonths + 1)
                    setAutoCalculate(false)
                  }
                }}
                disabled={installmentMonths >= 360}
                className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded font-bold transition-colors"
              >
                ➕
              </button>

              <span className="text-sm text-gray-600 whitespace-nowrap min-w-[60px] text-center">
                {(installmentMonths / 12).toFixed(1)} yıl
              </span>
            </div>
          </div>

          {/* Aylık Ödeme */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">💰 Aylık Ödeme (TL)</label>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCalculate}
                  onChange={(e) => setAutoCalculate(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Otomatik</span>
              </label>
            </div>
            <input
              type="number"
              min="0"
              step="100000"
              value={monthlyPayment}
              onChange={(e) => {
                setMonthlyPayment(parseInt(e.target.value) || 0)
                setAutoCalculate(false)
              }}
              disabled={autoCalculate && effectiveRemainingBalance > 0}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold text-lg ${
                autoCalculate && effectiveRemainingBalance > 0 ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            />
            <p className="text-xs text-gray-500 mt-1">
              {monthlyPayment > 0 && installmentMonths > 0
                ? `${installmentMonths} ay × ${monthlyPayment.toLocaleString('tr-TR')} TL = ${(monthlyPayment * installmentMonths).toLocaleString('tr-TR')} TL`
                : 'Tutar hesaplanıyor...'}
            </p>
          </div>

          {/* Ödeme Yöntemi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">🏦 Ödeme Yöntemi</label>
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

          {/* Right Column - Taksit Çizelgesi */}
          <div className="space-y-4">
            {/* Özet */}
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
              <h3 className="font-semibold text-gray-800 mb-3">📋 Özet</h3>
              <div className="space-y-2 text-sm">
                {effectiveRemainingBalance > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Toplam Taksitlerin Toplamı:</span>
                    <span className="font-bold text-blue-600">
                      {new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                        minimumFractionDigits: 0,
                      }).format(effectiveRemainingBalance)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-700">Tarih:</span>
                  <span className="font-medium">{new Date(startDate).toLocaleDateString('tr-TR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Ay Sayısı:</span>
                  <span className="font-bold">{installmentMonths} ay</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded border-l-4 border-indigo-600">
                  <span className="text-gray-700">Toplam:</span>
                  <span className="font-bold text-indigo-700 text-lg">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(monthlyPayment * installmentMonths)}
                  </span>
                </div>
              </div>
            </div>

            {/* Taksit Çizelgesi - Direkt Gösterimi */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 text-lg">📅 Taksit Çizelgesi ({installmentMonths} ay)</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto bg-purple-50 p-4 rounded-lg border border-purple-200">
                {Array.from({ length: installmentMonths }).map((_, i) => {
                  const dateValue = installmentDates[i] || ''
                  const customAmount = customAmounts[i]
                  
                  let amount = customAmount !== undefined ? customAmount : monthlyPayment
                  if (i === installmentMonths - 1 && customAmount === undefined) {
                    // Son ay: kalan borç (custom değilse)
                    const allButLast = monthlyPayment * (installmentMonths - 1)
                    amount = Math.max(0, effectiveRemainingBalance - allButLast)
                  }

                  return (
                    <div
                      key={i}
                      className="p-3 bg-white rounded border border-purple-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-purple-700">{i + 1}. Taksit</label>
                        <div className="text-xs text-gray-600">
                          {new Date(dateValue).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                      
                      {/* Tarih Input */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">📅 Tarih</label>
                        <input
                          type="date"
                          value={dateValue}
                          onChange={(e) => {
                            const newDates = [...installmentDates]
                            newDates[i] = e.target.value
                            setInstallmentDates(newDates)
                          }}
                          className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      
                      {/* Tutar Input */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">💰 Tutar (TL)</label>
                        <input
                          type="number"
                          min="0"
                          step="100000"
                          value={customAmount !== undefined ? customAmount : amount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            handleAmountChange(i, val)
                          }}
                          className="w-full px-2 py-1 text-sm font-bold border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

          {/* Right Column - Taksit Çizelgesi */}
          <div className="space-y-4">
            {/* Özet */}
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
              <h3 className="font-semibold text-gray-800 mb-3">📋 Özet</h3>
              <div className="space-y-2 text-sm">
                {effectiveRemainingBalance > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Ödenmesi Gereken:</span>
                    <span className="font-bold text-orange-600">
                      {new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                        minimumFractionDigits: 0,
                      }).format(effectiveRemainingBalance)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-700">Tarih:</span>
                  <span className="font-medium">{new Date(startDate).toLocaleDateString('tr-TR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Ay Sayısı:</span>
                  <span className="font-bold">{installmentMonths} ay</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded border-l-4 border-indigo-600">
                  <span className="text-gray-700">Toplam:</span>
                  <span className="font-bold text-indigo-700 text-lg">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(monthlyPayment * installmentMonths)}
                  </span>
                </div>
              </div>
            </div>

            {/* Taksit Çizelgesi */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 text-lg">📅 Taksit Çizelgesi ({installmentMonths} ay)</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto bg-purple-50 p-4 rounded-lg border border-purple-200">
                {Array.from({ length: installmentMonths }).map((_, i) => {
                  const dateValue = installmentDates[i] || ''
                  const customAmount = customAmounts[i]
                  
                  let amount = customAmount !== undefined ? customAmount : monthlyPayment
                  if (i === installmentMonths - 1 && customAmount === undefined) {
                    const allButLast = monthlyPayment * (installmentMonths - 1)
                    amount = Math.max(0, effectiveRemainingBalance - allButLast)
                  }

                  return (
                    <div
                      key={i}
                      className="p-3 bg-white rounded border border-purple-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-purple-700">{i + 1}. Taksit</label>
                        <div className="text-xs text-gray-600">
                          {new Date(dateValue).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">📅 Tarih</label>
                        <input
                          type="date"
                          value={dateValue}
                          onChange={(e) => {
                            const newDates = [...installmentDates]
                            newDates[i] = e.target.value
                            setInstallmentDates(newDates)
                          }}
                          className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">💰 Tutar (TL)</label>
                        <input
                          type="number"
                          min="0"
                          step="100000"
                          value={customAmount !== undefined ? customAmount : amount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            handleAmountChange(i, val)
                          }}
                          className="w-full px-2 py-1 text-sm font-bold border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t flex gap-3 justify-end sticky bottom-0">
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
