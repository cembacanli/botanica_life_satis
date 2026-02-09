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
  }
}

export interface InstallmentManageData {
  startDate: string
  monthlyPayment: number
  installmentMonths: number
  paymentMethod: 'nakit' | 'cek' | 'senet'
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

    onSave({
      startDate,
      monthlyPayment,
      installmentMonths,
      paymentMethod,
    })

    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-t-lg">
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

          {/* Aylık Ödeme Tutarı */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              💰 Aylık Ödeme Tutarı (TL)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1000"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {monthlyPayment > 0
                ? `Toplam Tutar: ${new Intl.NumberFormat('tr-TR', {
                    style: 'currency',
                    currency: 'TRY',
                    minimumFractionDigits: 0,
                  }).format(monthlyPayment * installmentMonths)}`
                : 'Tutar hazırlanıyor...'}
            </p>
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
              onChange={(e) => setInstallmentMonths(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              {installmentMonths} ay ({Math.round((installmentMonths / 12) * 10) / 10} yıl)
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
            <h3 className="font-semibold text-gray-800 mb-2">📋 Özet</h3>
            <div className="space-y-1 text-sm text-gray-700">
              <p>
                <span className="font-medium">Başlangıç:</span> {new Date(startDate).toLocaleDateString('tr-TR')}
              </p>
              <p>
                <span className="font-medium">Aylık Ödeme:</span> {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  minimumFractionDigits: 0,
                }).format(monthlyPayment)}
              </p>
              <p>
                <span className="font-medium">Taksit Sayısı:</span> {installmentMonths} ay
              </p>
              <p>
                <span className="font-medium">Toplam Tutar:</span> {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  minimumFractionDigits: 0,
                }).format(monthlyPayment * installmentMonths)}
              </p>
              <p>
                <span className="font-medium">Ödeme Yöntemi:</span> {paymentMethods.find(m => m.id === paymentMethod)?.label}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
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
