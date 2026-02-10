'use client'

import React, { useState } from 'react'

interface BulkInstallmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: BulkInstallmentData) => void
  selectedApartments: string[]
}

export interface BulkInstallmentData {
  apartmentIds: string[]
  months: number
  startDate: string
  depositPercentage: number
  paymentMethod: 'nakit' | 'cek' | 'senet'
  notes: string
}

export default function BulkInstallmentModal({
  isOpen,
  onClose,
  onSave,
  selectedApartments,
}: BulkInstallmentModalProps) {
  const [months, setMonths] = useState(12)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [depositPercentage, setDepositPercentage] = useState(20)
  const [paymentMethod, setPaymentMethod] = useState<'nakit' | 'cek' | 'senet'>('nakit')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const handleSave = () => {
    setError('')

    if (!startDate) {
      setError('Başlangıç tarihi gereklidir')
      return
    }

    if (months <= 0 || months > 360) {
      setError('Taksit ayı 1-360 arasında olmalıdır')
      return
    }

    if (selectedApartments.length === 0) {
      setError('Lütfen en az bir daire seçin')
      return
    }

    onSave({
      apartmentIds: selectedApartments,
      months,
      startDate,
      depositPercentage,
      paymentMethod,
      notes,
    })

    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold">Toplu Taksit Ayarlaması</h2>
          <p className="text-sm opacity-90 mt-1">
            {selectedApartments.length} daire için ayarlamalar yapılacak
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Seçili Daireler */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📍 Seçili Daireler ({selectedApartments.length})
            </label>
            <div className="max-h-32 overflow-y-auto p-3 bg-purple-50 rounded-lg border border-purple-200">
              {selectedApartments.length > 0 ? (
                <p className="text-sm text-gray-600">
                  {selectedApartments.join(', ')}
                </p>
              ) : (
                <p className="text-sm text-gray-500 italic">Daire seçilmedi</p>
              )}
            </div>
          </div>

          {/* Taksit Ay Sayısı */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📅 Taksit Ay Sayısı
            </label>
            <input
              type="number"
              min="1"
              max="360"
              value={months}
              onChange={(e) => setMonths(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              {months} ay ({(months / 12).toFixed(1)} yıl)
            </p>
          </div>

          {/* Başlangıç Tarihi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🗓️ Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Peşinat Yüzdesi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              💳 Peşinat Yüzdesi
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={depositPercentage}
                onChange={(e) => setDepositPercentage(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="font-bold text-purple-600 min-w-[50px]">%{depositPercentage}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Satış fiyatının %{depositPercentage}'i peşinat olarak alınacak
            </p>
          </div>

          {/* Ödeme Yöntemi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🏦 Ödeme Yöntemi
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['nakit', 'cek', 'senet'].map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method as any)}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-all border-2 ${
                    paymentMethod === method
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-purple-400'
                  }`}
                >
                  {method === 'nakit' && '💵 Nakit'}
                  {method === 'cek' && '📄 Çek'}
                  {method === 'senet' && '📋 Senet'}
                </button>
              ))}
            </div>
          </div>

          {/* Notlar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📝 Notlar (İsteğe Bağlı)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bu toplu işlem hakkında notlar..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={2}
            />
          </div>

          {/* Özet */}
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h3 className="font-semibold text-gray-800 mb-2">📋 İşlem Özeti</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Daire Sayısı:</span>
                <span className="font-bold">{selectedApartments.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Taksit Periyodu:</span>
                <span className="font-bold">{months} ay</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Peşinat:</span>
                <span className="font-bold">{depositPercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Ödeme Yöntemi:</span>
                <span className="font-bold capitalize">{paymentMethod}</span>
              </div>
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
            className="px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
          >
            Toplu Uygula ({selectedApartments.length})
          </button>
        </div>
      </div>
    </div>
  )
}
