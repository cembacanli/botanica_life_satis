'use client'

import React, { useState } from 'react'

interface InstallmentReportModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (type: 'pdf' | 'csv' | 'print') => void
}

export default function InstallmentReportModal({
  isOpen,
  onClose,
  onExport,
}: InstallmentReportModalProps) {
  const [reportType, setReportType] = useState<'all' | 'overdue' | 'upcoming' | 'paid'>('all')
  const [blockFilter, setBlockFilter] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('all')
  const [exporting, setExporting] = useState(false)

  const handleExport = async (type: 'pdf' | 'csv' | 'print') => {
    setExporting(true)
    try {
      await onExport(type)
    } finally {
      setExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold">📊 Taksit Raporu Oluştur</h2>
          <p className="text-sm opacity-90 mt-1">Filtrele, incele ve dışa aktar</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Rapor Türü */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              📋 Rapor Türü
            </label>
            <div className="space-y-2">
              {[
                { id: 'all', label: '📊 Tüm Taksitler', icon: '📋' },
                { id: 'overdue', label: '⚠️ Vade Geçmiş', icon: '⚠️' },
                { id: 'upcoming', label: '⏰ Yaklaşan Vadeler', icon: '⏰' },
                { id: 'paid', label: '✅ Ödenen Taksitler', icon: '✅' },
              ].map((option) => (
                <label
                  key={option.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    reportType === option.id
                      ? 'bg-indigo-50 border-indigo-500'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    value={option.id}
                    checked={reportType === option.id}
                    onChange={(e) => setReportType(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <span className="font-medium text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Blok Filtresi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🏢 Blok Filtresi
            </label>
            <select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">Tüm Bloklar</option>
              <option value="A">Blok A</option>
              <option value="B">Blok B</option>
              <option value="C">Blok C</option>
              <option value="D">Blok D</option>
            </select>
          </div>

          {/* Bilgilendirme */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">💡 İpucu:</span> Seçili filtrelere göre rapor oluşturulacak ve
              cihazınıza indirilecektir. İlgili satış sonrası işlemleri gerçekleştirebilirsiniz.
            </p>
          </div>

          {/* Dışa Aktarım Seçenekleri */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              💾 Dışa Aktarım Formatı
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleExport('pdf')}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 font-medium text-sm transition-colors"
              >
                📄 PDF
              </button>
              <button
                onClick={() => handleExport('csv')}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 font-medium text-sm transition-colors"
              >
                📊 CSV
              </button>
              <button
                onClick={() => handleExport('print')}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 font-medium text-sm transition-colors"
              >
                🖨️ Yazdır
              </button>
            </div>
          </div>

          {exporting && (
            <div className="text-center py-4">
              <div className="inline-block">
                <div className="animate-spin inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                <p className="text-sm text-gray-600 mt-2">Hazırlanıyor...</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
