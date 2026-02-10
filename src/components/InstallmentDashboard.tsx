'use client'

import React, { useState, useEffect } from 'react'
import { getStatusColor, getStatusEmoji, getStatusLabel, DueStatus } from '@/lib/installments'

interface InstallmentStats {
  totalApartments: number
  paidApartments: number
  installedApartments: number
  cashApartments: number
  totalRevenue: number
  totalPaid: number
  totalDue: number
  overdueApartments: number
  installmentDistribution: Record<string, number>
}

interface DashboardCard {
  label: string
  value: string | number
  icon: string
  color: 'blue' | 'green' | 'red' | 'orange' | 'purple'
  subtext?: string
}

export default function InstallmentDashboard() {
  const [stats, setStats] = useState<InstallmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBlock, setSelectedBlock] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('all')

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/installments/stats')
        const data = await res.json()
        setStats(data)
      } catch (error) {
        console.error('Stats fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    // Her 30 saniyede bir güncelle
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return <div className="p-6 text-center text-gray-500">Veriler yüklenemedi</div>
  }

  const cards: DashboardCard[] = [
    {
      label: 'Toplam Daire',
      value: stats.totalApartments,
      icon: '🏢',
      color: 'blue',
    },
    {
      label: 'Taksit Yapılan',
      value: stats.installedApartments,
      icon: '📅',
      color: 'purple',
      subtext: `${stats.cashApartments} peşin`,
    },
    {
      label: 'Tahsilâtı Tamamlanan',
      value: stats.paidApartments,
      icon: '✅',
      color: 'green',
    },
    {
      label: 'Vade Geçmiş',
      value: stats.overdueApartments,
      icon: '⚠️',
      color: 'red',
    },
  ]

  const paymentPercentage = stats.totalRevenue > 0 ? (stats.totalPaid / stats.totalRevenue) * 100 : 0

  const getColorClass = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      red: 'from-red-500 to-red-600',
      orange: 'from-orange-500 to-orange-600',
      purple: 'from-purple-500 to-purple-600',
    }
    return colors[color] || colors.blue
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          📊 Taksit Yönetim Paneli
        </h2>
        <div className="flex gap-2">
          {(['all', 'A', 'B', 'C', 'D'] as const).map(block => (
            <button
              key={block}
              onClick={() => setSelectedBlock(block)}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                selectedBlock === block
                  ? 'bg-indigo-606 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {block === 'all' ? 'Tümü' : `Blok ${block}`}
            </button>
          ))}
        </div>
      </div>

      {/* Ana Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`bg-gradient-to-br ${getColorClass(card.color)} text-white p-6 rounded-lg shadow-lg transform transition-transform hover:scale-105`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium opacity-90">{card.label}</p>
                <div className="text-3xl font-bold mt-2">{card.value}</div>
                {card.subtext && <p className="text-xs opacity-75 mt-1">{card.subtext}</p>}
              </div>
              <span className="text-3xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Finansal Özet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Para Akışı */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            💰 Finansal Özet
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-gray-700">Toplam Satış Fiyatı:</span>
              <span className="font-bold text-gray-900">
                {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  minimumFractionDigits: 0,
                }).format(stats.totalRevenue)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-green-50 rounded">
              <span className="text-gray-700">Yapılan Ödemeler:</span>
              <span className="font-bold text-green-700">
                {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  minimumFractionDigits: 0,
                }).format(stats.totalPaid)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
              <span className="text-gray-700">Kalan Vade Tutarı:</span>
              <span className="font-bold text-red-700">
                {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  minimumFractionDigits: 0,
                }).format(stats.totalDue)}
              </span>
            </div>

            {/* İlerleme Çubuğu */}
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Tahsilat Oranı</span>
                <span className="text-sm font-bold text-indigo-600">{paymentPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(paymentPercentage, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Taksit Dağılımı */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            📋 Taksit Dağılımı
          </h3>

          <div className="space-y-3">
            {Object.entries({
              '3 Ay': stats.installmentDistribution['3months'] || 0,
              '6 Ay': stats.installmentDistribution['6months'] || 0,
              '12 Ay': stats.installmentDistribution['12months'] || 0,
              '24 Ay': stats.installmentDistribution['24months'] || 0,
              '36 Ay': stats.installmentDistribution['36months'] || 0,
            }).map(([label, count]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-gray-600">{label}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full"
                      style={{
                        width: `${
                          stats.installedApartments > 0
                            ? (count / stats.installedApartments) * 100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="font-bold text-gray-700 min-w-[30px]">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Durum Özeti */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          🎯 Ödeme Durumu Özeti
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
            <div className="text-sm text-gray-600">Tamamen Ödenen</div>
            <div className="text-2xl font-bold text-green-700">{stats.paidApartments}</div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
            <div className="text-sm text-gray-600">Taksit Yapılan</div>
            <div className="text-2xl font-bold text-blue-700">{stats.installedApartments}</div>
          </div>

          <div className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-500">
            <div className="text-sm text-gray-600">Peşin Ödenen</div>
            <div className="text-2xl font-bold text-orange-700">{stats.cashApartments}</div>
          </div>

          <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
            <div className="text-sm text-gray-600">Vade Geçmiş</div>
            <div className="text-2xl font-bold text-red-700">{stats.overdueApartments}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
