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
  }
}

export interface InstallmentManageData {
  startDate: string
  monthlyPayment: number
  installmentMonths: number
  paymentMethod: 'nakit' | 'cek' | 'senet'
  installmentSchedule?: number[]
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

  const totalDebt = currentData?.totalDebt || 0
  const paidAmount = currentData?.paidAmount || 0
  const remainingBalance = currentData?.remainingBalance || Math.max(0, totalDebt - paidAmount)

  // Initialize modal açılışında
  useEffect(() => {
    if (isOpen && currentData) {
      setStartDate(currentData.startDate || new Date().toISOString().split('T')[0])
      setMonthlyPayment(currentData.monthlyPayment || 0)
      setInstallmentMonths(currentData.installmentMonths || 12)
      setPaymentMethod((currentData.paymentMethod as any) || 'nakit')
      setAutoCalculate(!currentData.installmentSchedule || currentData.installmentSchedule.length === 0)
      setError('')
    }
  }, [isOpen, currentData])

  // Otomatik hesapla modu: ay/tutar değişince güncelle
  useEffect(() => {
    if (autoCalculate && remainingBalance > 0 && installmentMonths > 0) {
      const monthly = Math.ceil(remainingBalance / installmentMonths)
      setMonthlyPayment(monthly)
    }
  }, [autoCalculate, remainingBalance, installmentMonths])

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

    const totalAmount = monthlyPayment * installmentMonths
    
    // Son ayı kalan borça göre ayarla
    const schedule: number[] = []
    for (let i = 0; i < installmentMonths; i++) {
      schedule.push(monthlyPayment)
    }
    const allButLast = schedule.slice(0, -1).reduce((a, b) => a + b, 0)
    schedule[schedule.length - 1] = Math.max(0, remainingBalance - allButLast)

    onSave({
      startDate,
      monthlyPayment,
      installmentMonths,
      paymentMethod,
      installmentSchedule: schedule,
    })

    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 rounded-t-lg sticky top-0 z-10">
          <h2 className="text-lg font-bold">Taksit Bilgilerini Düzenle</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
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
                    }).format(Math.max(0, remainingBalance))}
                  </span>
                </div>
              </div>
            </div>
          )}

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
                onClick={() => installmentMonths > 1 && setInstallmentMonths(installmentMonths - 1)}
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
                onClick={() => installmentMonths < 360 && setInstallmentMonths(installmentMonths + 1)}
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
              disabled={autoCalculate && remainingBalance > 0}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold text-lg ${
                autoCalculate && remainingBalance > 0 ? 'bg-gray-100 cursor-not-allowed' : ''
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

          {/* Özet */}
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
            <h3 className="font-semibold text-gray-800 mb-3">📋 Özet</h3>
            <div className="space-y-2 text-sm">
              {remainingBalance > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Ödenmesi Gereken:</span>
                  <span className="font-bold text-orange-600">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(remainingBalance)}
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
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowSchedule(!showSchedule)}
              className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg font-medium text-purple-700 transition-colors"
            >
              <span>📅 Taksit Çizelgesi ({installmentMonths} ay)</span>
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
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200 space-y-2 max-h-48 overflow-y-auto">
                {Array.from({ length: installmentMonths }).map((_, i) => {
                  const date = new Date(startDate)
                  date.setMonth(date.getMonth() + i)
                  
                  let amount = monthlyPayment
                  if (i === installmentMonths - 1) {
                    // Son ay: kalan borç
                    const allButLast = monthlyPayment * (installmentMonths - 1)
                    amount = Math.max(0, remainingBalance - allButLast)
                  }

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-white rounded border border-purple-100"
                    >
                      <div className="text-sm">
                        <div className="font-semibold text-purple-700">{i + 1}. Taksit</div>
                        <div className="text-xs text-gray-600">{date.toLocaleDateString('tr-TR')}</div>
                      </div>
                      <div className="text-sm font-bold text-purple-600">
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
            )}
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
