'use client'

import React, { useState, useEffect } from 'react'

interface HistoryEntry {
  id: string
  apartmentId: string
  timestamp: string
  changeType: 'created' | 'updated' | 'payment' | 'schedule_change'
  oldValue?: Record<string, any>
  newValue: Record<string, any>
  changedBy?: string
  notes?: string
}

interface InstallmentHistoryProps {
  apartmentId?: string
  limit?: number
}

export default function InstallmentHistory({ apartmentId, limit = 20 }: InstallmentHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const query = new URLSearchParams()
        if (apartmentId) query.append('apartmentId', apartmentId)
        query.append('limit', limit.toString())

        const res = await fetch(`/api/installments/history?${query}`)
        const data = await res.json()
        setHistory(data.data || [])
      } catch (error) {
        console.error('History fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [apartmentId, limit])

  const getChangeTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      created: 'Oluşturuldu',
      updated: 'Güncellendi',
      payment: 'Ödeme',
      schedule_change: 'Çizelge Değişikliği',
    }
    return labels[type] || type
  }

  const getChangeTypeEmoji = (type: string): string => {
    const emojis: Record<string, string> = {
      created: '✨',
      updated: '✏️',
      payment: '💰',
      schedule_change: '📅',
    }
    return emojis[type] || '📝'
  }

  const getChangeTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      created: 'bg-green-50 border-green-200',
      updated: 'bg-blue-50 border-blue-200',
      payment: 'bg-purple-50 border-purple-200',
      schedule_change: 'bg-orange-50 border-orange-200',
    }
    return colors[type] || 'bg-gray-50 border-gray-200'
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="p-6 text-center bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">📭 Geçmiş kaydı bulunamadı</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-gray-800">📜 Taksit Değişiklik Geçmişi</h3>

      <div className="space-y-3">
        {history.map((entry) => (
          <div
            key={entry.id}
            className={`border rounded-lg p-4 transition-all ${getChangeTypeColor(entry.changeType)}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{getChangeTypeEmoji(entry.changeType)}</span>

              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-800">
                    {getChangeTypeLabel(entry.changeType)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(entry.timestamp).toLocaleString('tr-TR')}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mt-1">
                  Daire: <span className="font-mono font-bold">{entry.apartmentId}</span>
                </p>

                {entry.changedBy && (
                  <p className="text-xs text-gray-600 mt-1">
                    Değişiklik Yapan: {entry.changedBy}
                  </p>
                )}

                {entry.notes && (
                  <p className="text-sm text-gray-600 mt-2 italic bg-white/50 p-2 rounded">
                    💬 {entry.notes}
                  </p>
                )}

                {/* Değişiklik Detayları */}
                {entry.changeType === 'updated' && entry.oldValue && (
                  <div className="mt-2 text-xs space-y-1 bg-white/50 p-2 rounded">
                    <p className="text-gray-700">
                      <span className="line-through text-red-600">
                        Eski: {JSON.stringify(entry.oldValue).slice(0, 50)}...
                      </span>
                    </p>
                    <p className="text-gray-700">
                      <span className="text-green-600">
                        Yeni: {JSON.stringify(entry.newValue).slice(0, 50)}...
                      </span>
                    </p>
                  </div>
                )}

                {entry.changeType === 'payment' && entry.newValue.amount && (
                  <div className="mt-2 p-2 bg-white/70 rounded">
                    <p className="text-sm font-bold text-green-700">
                      ✅ Ödeme: {new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                        minimumFractionDigits: 0,
                      }).format(entry.newValue.amount)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
