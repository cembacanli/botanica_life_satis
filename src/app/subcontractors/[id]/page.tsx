'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import SubcontractorClaimModal, { SubcontractorClaimFormData } from '@/components/SubcontractorClaimModal'

interface Subcontractor {
  id: string
  name: string
  workScope: string
  contractDate: string
  workDurationDays: number
  contractAmount: number
  phone?: string
  note?: string
}

interface SubcontractorClaim {
  id: string
  subcontractorId: string
  subcontractorName: string
  workItem: string
  contractAmount: number
  progressPercent: number
  completedAmount: number
  previousPaidAmount: number
  currentClaimAmount: number
  deductionAmount: number
  netPayableAmount: number
  claimDate: string
  status: 'taslak' | 'onaylandi' | 'odendi'
  note?: string
  createdAt: string
}

const statusStyles: Record<SubcontractorClaim['status'], string> = {
  taslak: 'bg-gray-100 text-gray-700',
  onaylandi: 'bg-amber-100 text-amber-800',
  odendi: 'bg-green-100 text-green-800',
}

const statusLabels: Record<SubcontractorClaim['status'], string> = {
  taslak: 'Taslak',
  onaylandi: 'Onaylandi',
  odendi: 'Odendi',
}

export default function SubcontractorDetailPage() {
  const params = useParams<{ id: string }>()
  const subcontractorId = String(params?.id || '')
  const router = useRouter()
  const { user, loading, isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [subcontractor, setSubcontractor] = useState<Subcontractor | null>(null)
  const [claims, setClaims] = useState<SubcontractorClaim[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClaim, setEditingClaim] = useState<SubcontractorClaim | null>(null)

  const loadData = () => {
    fetch('/api/subcontractors')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) {
          setSubcontractor(null)
          return
        }
        const found = data.find((item: Subcontractor) => item.id === subcontractorId) || null
        setSubcontractor(found)
      })
      .catch(() => setSubcontractor(null))

    fetch(`/api/subcontractor-claims?subcontractorId=${encodeURIComponent(subcontractorId)}`)
      .then(r => r.json())
      .then(data => setClaims(Array.isArray(data) ? data : []))
      .catch(() => setClaims([]))
  }

  useEffect(() => {
    setMounted(true)
    if (!loading && !isAuthenticated) {
      router.push('/login')
      return
    }
    if (!subcontractorId) return
    loadData()
  }, [isAuthenticated, loading, router, subcontractorId])

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (subcontractorId) loadData()
    }, 3000)
    return () => clearInterval(intervalId)
  }, [subcontractorId])

  const handleSaveClaim = async (data: SubcontractorClaimFormData) => {
    if (!subcontractor) throw new Error('Taseron bulunamadi.')
    const contractAmount = Number(subcontractor.contractAmount || 0)
    const progressAmount = Number(data.previousPaidAmount || 0) + Number(data.currentClaimAmount || 0)
    const progressPercent =
      contractAmount > 0 ? Math.min(Math.max(Number(((progressAmount / contractAmount) * 100).toFixed(2)), 0), 100) : 0

    const payload = {
      subcontractorId: subcontractor.id,
      subcontractorName: subcontractor.name,
      workItem: subcontractor.workScope || subcontractor.name,
      contractAmount,
      progressPercent,
      ...data,
    }

    const isEdit = Boolean(editingClaim?.id)
    const response = await fetch('/api/subcontractor-claims', {
      method: isEdit ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-username': user?.username || '',
      },
      body: JSON.stringify(isEdit ? { id: editingClaim?.id, ...payload } : payload),
    })

    const json = await response.json()
    if (!response.ok) {
      throw new Error(json?.error || 'Hakedis kaydedilemedi.')
    }

    if (isEdit) {
      setClaims(prev => prev.map(item => (item.id === json.id ? json : item)))
      setEditingClaim(null)
    } else {
      setClaims(prev => [json, ...prev])
    }
  }

  const handleDeleteClaim = async (item: SubcontractorClaim) => {
    const ok = window.confirm('Bu hakedis kaydini silmek istiyor musunuz?')
    if (!ok) return

    const response = await fetch('/api/subcontractor-claims', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-username': user?.username || '',
      },
      body: JSON.stringify({ id: item.id }),
    })
    const json = await response.json()
    if (!response.ok) {
      alert(json?.error || 'Silme islemi basarisiz.')
      return
    }
    setClaims(prev => prev.filter(c => c.id !== item.id))
  }

  const totals = useMemo(() => {
    const totalCurrentClaim = claims.reduce((sum, item) => sum + (item.currentClaimAmount || 0), 0)
    const totalNetPayable = claims.reduce((sum, item) => sum + (item.netPayableAmount || 0), 0)
    const totalPaid = claims
      .filter(item => item.status === 'odendi')
      .reduce((sum, item) => sum + (item.netPayableAmount || 0), 0)
    const totalPending = claims
      .filter(item => item.status !== 'odendi')
      .reduce((sum, item) => sum + (item.netPayableAmount || 0), 0)
    return { totalCurrentClaim, totalNetPayable, totalPaid, totalPending }
  }, [claims])

  const sortedClaims = useMemo(
    () =>
      [...claims].sort((a, b) => {
        const aTime = new Date(a.claimDate || a.createdAt || 0).getTime()
        const bTime = new Date(b.claimDate || b.createdAt || 0).getTime()
        return bTime - aTime
      }),
    [claims]
  )

  const defaultPreviousPaidAmount = useMemo(() => {
    if (sortedClaims.length === 0) return 0
    return Number(sortedClaims[0]?.currentClaimAmount || 0)
  }, [sortedClaims])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0)

  if (!mounted || loading) {
    return <div className="min-h-screen p-8">Yukleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {subcontractor ? `${subcontractor.name} - Hakedis Sayfasi` : 'Taseron Hakedis Sayfasi'}
            </h1>
            <div className="text-base text-gray-600">
              {subcontractor ? subcontractor.workScope : 'Taseron bilgisi yukleniyor'}
            </div>
            {subcontractor && (
              <div className="text-sm text-gray-500 mt-1">
                Sozlesme: {subcontractor.contractDate} | Sure: {subcontractor.workDurationDays} gun | Tutar:{' '}
                {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(subcontractor.contractAmount || 0)}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/subcontractors')}
              className="px-5 py-2.5 text-base bg-gray-200 hover:bg-gray-300 text-gray-800 rounded"
            >
              Taseron Listesi
            </button>
            <button
              onClick={() => {
                setEditingClaim(null)
                setModalOpen(true)
              }}
              disabled={!subcontractor}
              className="px-5 py-2.5 text-base bg-teal-700 hover:bg-teal-800 text-white rounded disabled:opacity-50"
            >
              Yeni Hakedis Ekle
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Toplam Hakedis</div>
            <div className="text-3xl font-bold text-cyan-700 mt-1">{formatCurrency(totals.totalCurrentClaim)}</div>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Toplam Net Odeme</div>
            <div className="text-3xl font-bold text-teal-700 mt-1">{formatCurrency(totals.totalNetPayable)}</div>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Odenen</div>
            <div className="text-3xl font-bold text-green-700 mt-1">{formatCurrency(totals.totalPaid)}</div>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Bekleyen</div>
            <div className="text-3xl font-bold text-amber-700 mt-1">{formatCurrency(totals.totalPending)}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50 font-semibold text-lg text-gray-800">Hakedis Kayitlari</div>
          {sortedClaims.length === 0 ? (
            <div className="p-5 text-gray-500">Kayit yok</div>
          ) : (
            <div className="divide-y">
              {sortedClaims.map(item => (
                <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-xl font-semibold text-gray-900">{item.workItem}</div>
                      <span className={`text-sm px-3 py-1 rounded ${statusStyles[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Tarih: {item.claimDate} | Sozlesme: {formatCurrency(item.contractAmount)} | Ilerleme: %
                      {item.progressPercent}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Onceki: {formatCurrency(item.previousPaidAmount)} | Bu hakedis: {formatCurrency(item.currentClaimAmount)}
                      {' | '}Kesinti: {formatCurrency(item.deductionAmount)} | Net: {formatCurrency(item.netPayableAmount)}
                    </div>
                    {item.note && <div className="text-sm text-gray-500 mt-1">{item.note}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingClaim(item)
                        setModalOpen(true)
                      }}
                      className="px-4 py-2 text-sm rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                    >
                      Duzenle
                    </button>
                    <button
                      onClick={() => handleDeleteClaim(item)}
                      className="px-4 py-2 text-sm rounded bg-red-100 text-red-700 hover:bg-red-200"
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

      <SubcontractorClaimModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingClaim(null)
        }}
        onSave={handleSaveClaim}
        initialData={editingClaim}
        subcontractorName={subcontractor?.name || '-'}
        subcontractorWorkScope={subcontractor?.workScope || ''}
        subcontractorContractAmount={Number(subcontractor?.contractAmount || 0)}
        defaultPreviousPaidAmount={defaultPreviousPaidAmount}
        title={editingClaim ? 'Hakedis Duzenle' : 'Yeni Hakedis Girisi'}
        submitLabel={editingClaim ? 'Guncelle' : 'Kaydet'}
      />
    </div>
  )
}
