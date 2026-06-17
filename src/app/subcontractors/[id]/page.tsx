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
  workStartDate?: string
  workDurationDays: number
  contractAmount: number
  contractItems?: ContractItem[]
  phone?: string
  note?: string
}

interface ContractItem {
  id: string
  name: string
  unit: string
  estimatedQuantity: number
  unitPrice: number
  amount: number
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

interface CumulativeClaim extends SubcontractorClaim {
  sequenceNo: number
  cumulativeClaimAmount: number
  cumulativeNetPayableAmount: number
  cumulativeDeductionAmount: number
  cumulativeProgressPercent: number
  previousCumulativeClaimAmount: number
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

const toNumber = (value: unknown) => {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const getClaimTime = (item: SubcontractorClaim) => new Date(item.claimDate || item.createdAt || 0).getTime()

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
    if (!subcontractor) throw new Error('Taşeron bulunamadı.')
    const contractAmount = Number(subcontractor.contractAmount || 0)
    const previousPaidAmount = Number(data.previousPaidAmount || defaultPreviousPaidAmount || 0)
    const currentClaimAmount = Number(data.currentClaimAmount || 0)
    const progressAmount = previousPaidAmount + currentClaimAmount
    const progressPercent =
      contractAmount > 0 ? Math.min(Math.max(Number(((progressAmount / contractAmount) * 100).toFixed(2)), 0), 100) : 0

    const payload = {
      subcontractorId: subcontractor.id,
      subcontractorName: subcontractor.name,
      workItem: data.workItem || subcontractor.workScope || subcontractor.name,
      contractAmount,
      progressPercent,
      ...data,
      previousPaidAmount,
      currentClaimAmount,
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
      throw new Error(json?.error || 'Hakediş kaydedilemedi.')
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
    const totalCurrentClaim = claims.reduce((sum, item) => sum + toNumber(item.currentClaimAmount), 0)
    const totalNetPayable = claims.reduce((sum, item) => sum + toNumber(item.netPayableAmount), 0)
    const totalPaid = claims
      .filter(item => item.status === 'odendi')
      .reduce((sum, item) => sum + toNumber(item.netPayableAmount), 0)
    const totalPending = claims
      .filter(item => item.status !== 'odendi')
      .reduce((sum, item) => sum + toNumber(item.netPayableAmount), 0)
    const contractAmount = toNumber(subcontractor?.contractAmount)
    const cumulativeProgressPercent =
      contractAmount > 0 ? Math.min(Number(((totalCurrentClaim / contractAmount) * 100).toFixed(2)), 100) : 0
    return { totalCurrentClaim, totalNetPayable, totalPaid, totalPending, cumulativeProgressPercent }
  }, [claims, subcontractor?.contractAmount])

  const cumulativeClaims = useMemo<CumulativeClaim[]>(() => {
    const contractAmount = toNumber(subcontractor?.contractAmount)
    let cumulativeClaimAmount = 0
    let cumulativeNetPayableAmount = 0
    let cumulativeDeductionAmount = 0

    return [...claims]
      .sort((a, b) => {
        const dateDiff = getClaimTime(a) - getClaimTime(b)
        if (dateDiff !== 0) return dateDiff
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
      })
      .map((item, index) => {
        const previousCumulativeClaimAmount = cumulativeClaimAmount
        cumulativeClaimAmount += toNumber(item.currentClaimAmount)
        cumulativeNetPayableAmount += toNumber(item.netPayableAmount)
        cumulativeDeductionAmount += toNumber(item.deductionAmount)

        return {
          ...item,
          sequenceNo: index + 1,
          previousCumulativeClaimAmount,
          cumulativeClaimAmount,
          cumulativeNetPayableAmount,
          cumulativeDeductionAmount,
          cumulativeProgressPercent:
            contractAmount > 0 ? Math.min(Number(((cumulativeClaimAmount / contractAmount) * 100).toFixed(2)), 100) : 0,
        }
      })
  }, [claims, subcontractor?.contractAmount])

  const sortedClaims = useMemo(
    () =>
      [...cumulativeClaims].sort((a, b) => {
        const dateDiff = getClaimTime(b) - getClaimTime(a)
        if (dateDiff !== 0) return dateDiff
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      }),
    [cumulativeClaims]
  )

  const defaultPreviousPaidAmount = useMemo(() => {
    if (!editingClaim) return totals.totalCurrentClaim
    const found = cumulativeClaims.find(item => item.id === editingClaim.id)
    return toNumber(found?.previousCumulativeClaimAmount)
  }, [cumulativeClaims, editingClaim, totals.totalCurrentClaim])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0)

  if (!mounted || loading) {
    return <div className="min-h-screen p-8">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {subcontractor ? `${subcontractor.name} - Hakediş Sayfası` : 'Taşeron Hakediş Sayfası'}
            </h1>
            <div className="text-base text-gray-600">
              {subcontractor ? subcontractor.workScope : 'Taşeron bilgisi yükleniyor'}
            </div>
            {subcontractor && (
              <div className="text-sm text-gray-500 mt-1">
                Sözleşme: {subcontractor.contractDate} | Başlama: {subcontractor.workStartDate || subcontractor.contractDate} | Süre: {subcontractor.workDurationDays} gün | Tutar:{' '}
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
              onClick={() => router.push('/contracts')}
              className="px-5 py-2.5 text-base bg-slate-800 hover:bg-slate-900 text-white rounded"
            >
              Sözleşmeler
            </button>
            <button
              onClick={() => router.push('/subcontractors')}
              className="px-5 py-2.5 text-base bg-gray-200 hover:bg-gray-300 text-gray-800 rounded"
            >
              Taşeron Listesi
            </button>
            <button
              onClick={() => {
                setEditingClaim(null)
                setModalOpen(true)
              }}
              disabled={!subcontractor}
              className="px-5 py-2.5 text-base bg-teal-700 hover:bg-teal-800 text-white rounded disabled:opacity-50"
            >
              Yeni Hakediş Ekle
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 xl:grid-cols-5">
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Kümülatif Hakediş</div>
            <div className="text-3xl font-bold text-cyan-700 mt-1">{formatCurrency(totals.totalCurrentClaim)}</div>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Kümülatif İlerleme</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">%{totals.cumulativeProgressPercent.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Toplam Net Ödeme</div>
            <div className="text-3xl font-bold text-teal-700 mt-1">{formatCurrency(totals.totalNetPayable)}</div>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Ödenen</div>
            <div className="text-3xl font-bold text-green-700 mt-1">{formatCurrency(totals.totalPaid)}</div>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Bekleyen</div>
            <div className="text-3xl font-bold text-amber-700 mt-1">{formatCurrency(totals.totalPending)}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50 font-semibold text-lg text-gray-800">Hakediş Kayıtları</div>
          {sortedClaims.length === 0 ? (
            <div className="p-5 text-gray-500">Kayıt yok</div>
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
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">Hakediş No</div>
                        <div className="font-semibold text-slate-900">#{item.sequenceNo}</div>
                      </div>
                      <div className="rounded-lg bg-blue-50 px-3 py-2">
                        <div className="text-xs text-blue-700">Önceki Toplam</div>
                        <div className="font-semibold text-blue-900">{formatCurrency(item.previousCumulativeClaimAmount)}</div>
                      </div>
                      <div className="rounded-lg bg-cyan-50 px-3 py-2">
                        <div className="text-xs text-cyan-700">Bu Hakediş</div>
                        <div className="font-semibold text-cyan-900">{formatCurrency(item.currentClaimAmount)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">Kümülatif Hakediş</div>
                        <div className="font-semibold text-slate-900">{formatCurrency(item.cumulativeClaimAmount)}</div>
                      </div>
                      <div className="rounded-lg bg-indigo-50 px-3 py-2">
                        <div className="text-xs text-indigo-700">Kümülatif İlerleme</div>
                        <div className="font-semibold text-indigo-900">%{item.cumulativeProgressPercent.toFixed(2)}</div>
                      </div>
                      <div className="rounded-lg bg-emerald-50 px-3 py-2">
                        <div className="text-xs text-emerald-700">Kümülatif Net</div>
                        <div className="font-bold text-emerald-800">{formatCurrency(item.cumulativeNetPayableAmount)}</div>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg bg-gray-50 px-3 py-2">
                        <div className="text-xs text-gray-500">Sözleşme</div>
                        <div className="font-semibold text-gray-900">{formatCurrency(item.contractAmount)}</div>
                      </div>
                      <div className="rounded-lg bg-rose-50 px-3 py-2">
                        <div className="text-xs text-rose-600">Bu Hakediş Kesinti</div>
                        <div className="font-semibold text-rose-700">{formatCurrency(item.deductionAmount)}</div>
                      </div>
                      <div className="rounded-lg bg-emerald-50 px-3 py-2">
                        <div className="text-xs text-emerald-700">Bu Hakediş Net</div>
                        <div className="font-bold text-emerald-800">{formatCurrency(item.netPayableAmount)}</div>
                      </div>
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
                        Düzenle
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
        initialData={editingClaim ? { ...editingClaim, previousPaidAmount: defaultPreviousPaidAmount } : null}
        subcontractorName={subcontractor?.name || '-'}
        subcontractorWorkScope={subcontractor?.workScope || ''}
        subcontractorContractAmount={Number(subcontractor?.contractAmount || 0)}
        contractItems={subcontractor?.contractItems || []}
        defaultPreviousPaidAmount={defaultPreviousPaidAmount}
        title={editingClaim ? 'Hakedişi Düzenle' : 'Yeni Hakediş Girişi'}
        submitLabel={editingClaim ? 'Güncelle' : 'Kaydet'}
      />
    </div>
  )
}
