'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import CostModal, { CostFormData } from '@/components/CostModal'

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export default function CostsPage() {
  const router = useRouter()
  const { user, loading, isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [costs, setCosts] = useState<any[]>([])
  const [salesRecords, setSalesRecords] = useState<any[]>([])
  const [apartments, setApartments] = useState<any[]>([])
  const [saleDetailsMap, setSaleDetailsMap] = useState<Record<string, any>>({})
  const [costModalOpen, setCostModalOpen] = useState(false)
  const [editingCost, setEditingCost] = useState<any | null>(null)

  useEffect(() => {
    setMounted(true)
    if (!loading && !isAuthenticated) {
      router.push('/login')
      return
    }

    fetch('/api/costs')
      .then(r => r.json())
      .then(data => setCosts(Array.isArray(data) ? data : []))
      .catch(() => setCosts([]))

    fetch('/api/sales')
      .then(r => r.json())
      .then(data => setSalesRecords(Array.isArray(data) ? data : []))
      .catch(() => setSalesRecords([]))

    fetch('/api/apartments')
      .then(r => r.json())
      .then(data => setApartments(Array.isArray(data) ? data : []))
      .catch(() => setApartments([]))

    fetch('/api/sale-details')
      .then(r => r.json())
      .then(data => setSaleDetailsMap(data || {}))
      .catch(() => setSaleDetailsMap({}))
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetch('/api/costs')
        .then(r => r.json())
        .then(data => setCosts(Array.isArray(data) ? data : []))
        .catch(() => undefined)

      fetch('/api/sales')
        .then(r => r.json())
        .then(data => setSalesRecords(Array.isArray(data) ? data : []))
        .catch(() => undefined)

      fetch('/api/apartments')
        .then(r => r.json())
        .then(data => setApartments(Array.isArray(data) ? data : []))
        .catch(() => undefined)

      fetch('/api/sale-details')
        .then(r => r.json())
        .then(data => setSaleDetailsMap(data || {}))
        .catch(() => undefined)
    }, 3000)

    return () => clearInterval(intervalId)
  }, [])

  const handleSaveCost = async (data: CostFormData) => {
    const isEdit = Boolean(editingCost?.id)
    const res = await fetch('/api/costs', {
      method: isEdit ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-username': user?.username || '',
      },
      body: JSON.stringify(isEdit ? { id: editingCost.id, ...data } : data),
    })

    const json = await res.json()
    if (!res.ok) {
      throw new Error(json?.error || 'Maliyet kaydedilemedi.')
    }

    if (isEdit) {
      setCosts(prev => prev.map(item => (item.id === json.id ? json : item)))
      setEditingCost(null)
    } else {
      setCosts(prev => [json, ...prev])
    }
  }

  const handleEditCost = (item: any) => {
    setEditingCost(item)
    setCostModalOpen(true)
  }

  const handleDeleteCost = async (item: any) => {
    const ok = window.confirm(`"${item.itemName}" kaydini silmek istiyor musunuz?`)
    if (!ok) return

    const res = await fetch('/api/costs', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-username': user?.username || '',
      },
      body: JSON.stringify({ id: item.id }),
    })
    const json = await res.json()
    if (!res.ok) {
      alert(json?.error || 'Silme islemi basarisiz.')
      return
    }
    setCosts(prev => prev.filter(c => c.id !== item.id))
  }

  const totalCostAmount = costs.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
  const landOwnerApartmentIds = new Set(
    salesRecords
      .filter((rec: any) => {
        if (rec.saleType !== 'sold') return false
        const name = (rec.customerName || '')
          .toLocaleLowerCase('tr-TR')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        const saleData = saleDetailsMap[rec.apartmentId] || {}
        return name.includes('arsa sahibi') || (saleData.salePrice || 0) <= 0
      })
      .map((rec: any) => rec.apartmentId)
  )
  const soldApartmentIds = new Set(
    salesRecords
      .filter((rec: any) => rec.saleType === 'sold' && !landOwnerApartmentIds.has(rec.apartmentId))
      .map((rec: any) => rec.apartmentId)
  )
  const soldTotalArea = apartments.reduce((sum: number, apt: any) => {
    if (!soldApartmentIds.has(apt.id)) return sum
    return sum + (apt.area || 0)
  }, 0)
  const soldTypeCounts = apartments.reduce((acc: Record<string, number>, apt: any) => {
    if (!soldApartmentIds.has(apt.id)) return acc
    const type = String(apt.type || 'Bilinmeyen')
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})
  const soldTypeSummary = Object.entries(soldTypeCounts)
    .sort((a, b) => a[0].localeCompare(b[0], 'tr'))
    .map(([type, count]) => `${type}: ${count} adet`)
    .join(', ')
  const averageCostPerSquareMeter = soldTotalArea > 0 ? totalCostAmount / soldTotalArea : 0
  const today = new Date()
  const isSecondDayOfMonth = today.getDate() === 2
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const hasPreviousMonthCost = costs.some((item: any) => {
    const d = new Date(item.date || item.createdAt || '')
    if (Number.isNaN(d.getTime())) return false
    return d >= prevMonthStart && d <= prevMonthEnd
  })
  const shouldShowPreviousMonthReminder = isSecondDayOfMonth && !hasPreviousMonthCost
  const previousMonthLabel = prevMonthStart.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const recentCosts = [...costs]
    .sort((a: any, b: any) => {
      const aTime = new Date(a.date || a.createdAt || 0).getTime()
      const bTime = new Date(b.date || b.createdAt || 0).getTime()
      return bTime - aTime
    })
    .slice(0, 50)

  if (!mounted || loading) {
    return <div className="min-h-screen p-8">Yukleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Maliyet Sayfasi</h1>
            <div className="text-sm text-gray-600">Proje maliyetlerini buradan yonetin.</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded"
            >
              Ana Sayfa
            </button>
            <button
              onClick={() => {
                setEditingCost(null)
                setCostModalOpen(true)
              }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded"
            >
              Yeni Maliyet Ekle
            </button>
          </div>
        </div>

        {shouldShowPreviousMonthReminder && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
            Hatirlatma: {previousMonthLabel} ayi maliyetlerini girmeniz gerekiyor.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-sm text-gray-600">Toplam Maliyet</div>
            <div className="text-3xl font-bold text-red-600 mt-1">
              {currencyFormatter.format(totalCostAmount)}
            </div>
            <div className="text-xs text-gray-500 mt-2">{costs.length} kayit</div>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-sm text-gray-600">Ortalama Maliyet</div>
            <div className="text-3xl font-bold text-blue-700 mt-1">
              {currencyFormatter.format(averageCostPerSquareMeter)}
            </div>
            <div className="text-xs text-gray-500 mt-2">m² basina (Satilan toplam: {soldTotalArea} m²)</div>
            <div className="text-xs text-gray-500 mt-1">
              {soldTypeSummary || 'Daire tipi bilgisi yok'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50 font-semibold text-gray-800">Son Maliyet Kayitlari</div>
          {recentCosts.length === 0 ? (
            <div className="p-5 text-gray-500">Kayit yok</div>
          ) : (
            <div className="divide-y">
              {recentCosts.map((item: any) => (
                <div key={item.id || `${item.itemName}-${item.date}`} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-gray-900">{item.itemName}</div>
                    <div className="text-sm text-gray-600">
                      {item.category} - {item.date}
                    </div>
                    {item.note && <div className="text-xs text-gray-500 mt-1">{item.note}</div>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="font-bold text-gray-900">
                      {currencyFormatter.format(item.amount || 0)}
                    </div>
                    <button
                      onClick={() => handleEditCost(item)}
                      className="px-3 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                    >
                      Duzenle
                    </button>
                    <button
                      onClick={() => handleDeleteCost(item)}
                      className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CostModal
        isOpen={costModalOpen}
        onClose={() => {
          setCostModalOpen(false)
          setEditingCost(null)
        }}
        onSave={handleSaveCost}
        initialData={editingCost}
        title={editingCost ? 'Aylik Maliyeti Duzenle' : 'Aylik Maliyet Giriniz'}
        submitLabel={editingCost ? 'Guncelle' : 'Kaydet'}
      />
    </div>
  )
}
