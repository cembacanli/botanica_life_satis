'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import SubcontractorModal, { SubcontractorFormData } from '@/components/SubcontractorModal'

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
  createdAt: string
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

type ContractStatusKey = 'all' | 'active' | 'closing' | 'delayed' | 'completed'

interface ContractStatusMeta {
  key: Exclude<ContractStatusKey, 'all'>
  label: string
  accent: string
  progressColor: string
}

interface ContractSummary {
  subcontractor: Subcontractor
  claims: SubcontractorClaim[]
  totalClaimAmount: number
  totalNetAccrued: number
  totalPaid: number
  pendingPayment: number
  totalDeduction: number
  remainingContractAmount: number
  completionPercent: number
  endDate: string
  daysRemaining: number
  claimCount: number
  lastClaimDate: string
  status: ContractStatusMeta
  analysisText: string
  userNote: string
}

const statusFilterOptions: Array<{ key: ContractStatusKey; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Aktif' },
  { key: 'closing', label: 'Yaklaşan' },
  { key: 'delayed', label: 'Gecikmede' },
  { key: 'completed', label: 'Tamamlanan' },
]

const claimStatusStyles: Record<SubcontractorClaim['status'], string> = {
  taslak: 'bg-slate-100 text-slate-700',
  onaylandi: 'bg-amber-100 text-amber-800',
  odendi: 'bg-emerald-100 text-emerald-800',
}

const claimStatusLabels: Record<SubcontractorClaim['status'], string> = {
  taslak: 'Taslak',
  onaylandi: 'Onaylandı',
  odendi: 'Ödendi',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value: string) {
  if (!value) return '-'

  const parsed = new Date(`${value}T00:00:00`)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('tr-TR')
  }

  const fallback = new Date(value)
  if (Number.isNaN(fallback.getTime())) return value
  return fallback.toLocaleDateString('tr-TR')
}

function getEndDate(contractDate: string, workDurationDays: number) {
  const start = new Date(`${contractDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || workDurationDays <= 0) return ''

  const end = new Date(start)
  end.setDate(end.getDate() + workDurationDays)
  return end.toISOString().slice(0, 10)
}

function getDaysRemaining(endDate: string) {
  if (!endDate) return 0

  const due = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(due.getTime())) return 0

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function extractAnalysisText(note: string) {
  return String(note || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('[Analiz]'))
    .map(line => line.replace(/^\[Analiz\]\s*/i, ''))
    .join(' ')
}

function stripAnalysisLines(note: string) {
  return String(note || '')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => !line.trim().startsWith('[Analiz]'))
    .join('\n')
    .trim()
}

function getContractStatus(daysRemaining: number, completionPercent: number): ContractStatusMeta {
  if (completionPercent >= 100) {
    return {
      key: 'completed',
      label: 'Tamamlandı',
      accent: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
      progressColor: 'bg-emerald-500',
    }
  }

  if (daysRemaining < 0) {
    return {
      key: 'delayed',
      label: `${Math.abs(daysRemaining)} gün gecikme`,
      accent: 'bg-rose-100 text-rose-700 ring-rose-200',
      progressColor: 'bg-rose-500',
    }
  }

  if (daysRemaining <= 14) {
    return {
      key: 'closing',
      label: `${Math.max(daysRemaining, 0)} gün kaldı`,
      accent: 'bg-amber-100 text-amber-800 ring-amber-200',
      progressColor: 'bg-amber-500',
    }
  }

  return {
    key: 'active',
    label: `${daysRemaining} gün kaldı`,
    accent: 'bg-sky-100 text-sky-700 ring-sky-200',
    progressColor: 'bg-cyan-500',
  }
}

function SummaryCard({
  title,
  value,
  helper,
}: {
  title: string
  value: string
  helper?: string
}) {
  return (
    <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/10 backdrop-blur">
      <div className="text-sm text-slate-200">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {helper ? <div className="mt-2 text-xs text-slate-300">{helper}</div> : null}
    </div>
  )
}

function DetailMetric({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper?: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
      {helper ? <div className="mt-1 text-sm text-slate-500">{helper}</div> : null}
    </div>
  )
}

export default function ContractsPage() {
  const router = useRouter()
  const { user, loading, isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [claims, setClaims] = useState<SubcontractorClaim[]>([])
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContractStatusKey>('all')
  const [selectedContractId, setSelectedContractId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null)

  const loadData = async () => {
    try {
      setError('')

      const [subcontractorRes, claimsRes] = await Promise.all([
        fetch('/api/subcontractors', { cache: 'no-store' }),
        fetch('/api/subcontractor-claims', { cache: 'no-store' }),
      ])

      const [subcontractorData, claimsData] = await Promise.all([
        subcontractorRes.json(),
        claimsRes.json(),
      ])

      if (!subcontractorRes.ok) {
        throw new Error(subcontractorData?.error || 'Sözleşme verileri alınamadı.')
      }

      if (!claimsRes.ok) {
        throw new Error(claimsData?.error || 'Hakediş verileri alınamadı.')
      }

      setSubcontractors(Array.isArray(subcontractorData) ? subcontractorData : [])
      setClaims(Array.isArray(claimsData) ? claimsData : [])
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Sözleşme verileri alınamadı.'
      setError(message)
      setSubcontractors([])
      setClaims([])
    }
  }

  useEffect(() => {
    setMounted(true)

    if (!loading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!loading && isAuthenticated) {
      loadData()
    }
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (isAuthenticated) {
        loadData()
      }
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [isAuthenticated])

  const contractSummaries = useMemo<ContractSummary[]>(() => {
    return subcontractors.map(subcontractor => {
      const relatedClaims = claims
        .filter(item => item.subcontractorId === subcontractor.id)
        .sort((a, b) => {
          const aTime = new Date(a.claimDate || a.createdAt || 0).getTime()
          const bTime = new Date(b.claimDate || b.createdAt || 0).getTime()
          return bTime - aTime
        })

      const totalClaimAmount = relatedClaims.reduce(
        (sum, item) => sum + Number(item.currentClaimAmount || 0),
        0
      )
      const totalNetAccrued = relatedClaims.reduce(
        (sum, item) => sum + Number(item.netPayableAmount || 0),
        0
      )
      const totalPaid = relatedClaims
        .filter(item => item.status === 'odendi')
        .reduce((sum, item) => sum + Number(item.netPayableAmount || 0), 0)
      const totalDeduction = relatedClaims.reduce(
        (sum, item) => sum + Number(item.deductionAmount || 0),
        0
      )
      const pendingPayment = Math.max(totalNetAccrued - totalPaid, 0)
      const remainingContractAmount = Math.max(
        Number(subcontractor.contractAmount || 0) - totalClaimAmount,
        0
      )
      const completionPercent =
        subcontractor.contractAmount > 0
          ? Math.min(
              Number(
                ((totalClaimAmount / Number(subcontractor.contractAmount || 0)) * 100).toFixed(1)
              ),
              100
            )
          : 0

      const endDate = getEndDate(subcontractor.workStartDate || subcontractor.contractDate, subcontractor.workDurationDays)
      const daysRemaining = getDaysRemaining(endDate)
      const status = getContractStatus(daysRemaining, completionPercent)
      const analysisText = extractAnalysisText(subcontractor.note || '')
      const userNote = stripAnalysisLines(subcontractor.note || '')

      return {
        subcontractor,
        claims: relatedClaims,
        totalClaimAmount,
        totalNetAccrued,
        totalPaid,
        pendingPayment,
        totalDeduction,
        remainingContractAmount,
        completionPercent,
        endDate,
        daysRemaining,
        claimCount: relatedClaims.length,
        lastClaimDate: relatedClaims[0]?.claimDate || relatedClaims[0]?.createdAt || '',
        status,
        analysisText,
        userNote,
      }
    })
  }, [claims, subcontractors])

  const filteredContracts = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('tr-TR')

    return contractSummaries
      .filter(summary => {
        if (statusFilter !== 'all' && summary.status.key !== statusFilter) return false
        if (!term) return true

        const haystack = [
          summary.subcontractor.name,
          summary.subcontractor.workScope,
          summary.subcontractor.phone || '',
          summary.userNote,
          summary.analysisText,
        ]
          .join(' ')
          .toLocaleLowerCase('tr-TR')

        return haystack.includes(term)
      })
      .sort((a, b) => {
        const order = { delayed: 0, closing: 1, active: 2, completed: 3 }

        if (a.status.key !== b.status.key) {
          return order[a.status.key] - order[b.status.key]
        }

        return (
          Number(b.subcontractor.contractAmount || 0) - Number(a.subcontractor.contractAmount || 0)
        )
      })
  }, [contractSummaries, searchTerm, statusFilter])

  useEffect(() => {
    if (!filteredContracts.length) {
      setSelectedContractId('')
      return
    }

    if (!filteredContracts.some(item => item.subcontractor.id === selectedContractId)) {
      setSelectedContractId(filteredContracts[0].subcontractor.id)
    }
  }, [filteredContracts, selectedContractId])

  const selectedContract =
    filteredContracts.find(item => item.subcontractor.id === selectedContractId) ||
    filteredContracts[0] ||
    null

  const totals = useMemo(() => {
    const totalContractAmount = contractSummaries.reduce(
      (sum, item) => sum + Number(item.subcontractor.contractAmount || 0),
      0
    )
    const totalClaimAmount = contractSummaries.reduce((sum, item) => sum + item.totalClaimAmount, 0)
    const totalPaid = contractSummaries.reduce((sum, item) => sum + item.totalPaid, 0)
    const totalPendingPayment = contractSummaries.reduce(
      (sum, item) => sum + item.pendingPayment,
      0
    )
    const delayedCount = contractSummaries.filter(item => item.status.key === 'delayed').length
    const averageCompletion =
      contractSummaries.length > 0
        ? contractSummaries.reduce((sum, item) => sum + item.completionPercent, 0) /
          contractSummaries.length
        : 0

    return {
      totalContractAmount,
      totalClaimAmount,
      totalPaid,
      totalPendingPayment,
      delayedCount,
      averageCompletion,
    }
  }, [contractSummaries])

  const handleSaveSubcontractor = async (data: SubcontractorFormData) => {
    const isEdit = Boolean(editingSubcontractor?.id)

    const response = await fetch('/api/subcontractors', {
      method: isEdit ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-username': user?.username || '',
      },
      body: JSON.stringify(isEdit ? { id: editingSubcontractor?.id, ...data } : data),
    })

    const json = await response.json()
    if (!response.ok) {
      throw new Error(json?.error || 'Sözleşme kaydedilemedi.')
    }

    await loadData()
    setSelectedContractId(json?.id || selectedContractId)
    setEditingSubcontractor(null)
  }

  const handleDeleteSubcontractor = async (item: Subcontractor) => {
    const confirmed = window.confirm(
      `"${item.name}" sözleşmesini silmek istiyor musunuz? Bağlı hakedişler de silinir.`
    )
    if (!confirmed) return

    const response = await fetch('/api/subcontractors', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-username': user?.username || '',
      },
      body: JSON.stringify({ id: item.id }),
    })

    const json = await response.json()
    if (!response.ok) {
      alert(json?.error || 'Silme işlemi başarısız.')
      return
    }

    await loadData()
  }

  if (!mounted || loading) {
    return <div className="min-h-screen p-8">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0_55%,_#cbd5e1)] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl ring-1 ring-slate-800">
          <div className="bg-[linear-gradient(120deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94),rgba(8,47,73,0.92))] px-6 py-8 md:px-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.32em] text-cyan-200">
                  Sözleşmeler Modülü
                </div>
                <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
                  Taşeron Sözleşme Merkezi
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 md:text-base">
                  Taşeron sözleşmelerini, hakediş akışlarını, ödeme yükünü ve gecikme risklerini
                  tek merkezden yönetin.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => router.push('/')}
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Ana Sayfa
                </button>
                <button
                  onClick={() => router.push('/subcontractors')}
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Taşeron Takibi
                </button>
                <button
                  onClick={() => {
                    setEditingSubcontractor(null)
                    setModalOpen(true)
                  }}
                  className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Yeni Sözleşme
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <SummaryCard
                title="Toplam Portföy"
                value={formatCurrency(totals.totalContractAmount)}
                helper={`${contractSummaries.length} aktif kayıt`}
              />
              <SummaryCard
                title="Tahakkuk Eden İş"
                value={formatCurrency(totals.totalClaimAmount)}
                helper="Girilen hakediş toplamı"
              />
              <SummaryCard
                title="Ödenen Net"
                value={formatCurrency(totals.totalPaid)}
                helper="Durumu ödendi olan hakedişler"
              />
              <SummaryCard
                title="Bekleyen Ödeme"
                value={formatCurrency(totals.totalPendingPayment)}
                helper="Onay bekleyen veya taslak net tutar"
              />
              <SummaryCard
                title="Geciken Sözleşme"
                value={String(totals.delayedCount)}
                helper="Süresi aşılmış işler"
              />
              <SummaryCard
                title="Ortalama İlerleme"
                value={`%${totals.averageCompletion.toFixed(1)}`}
                helper="Sözleşme genel tamamlanma oranı"
              />
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
          <div className="space-y-4">
            <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Ara
                  </span>
                  <input
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    placeholder="Taşeron, iş kapsamı, telefon veya not ara"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </label>

                <div>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Durum
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {statusFilterOptions.map(option => (
                      <button
                        key={option.key}
                        onClick={() => setStatusFilter(option.key)}
                        className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                          statusFilter === option.key
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm text-slate-500">
                {filteredContracts.length} sözleşme listeleniyor.
              </div>
            </div>

            <div className="space-y-4">
              {filteredContracts.length === 0 ? (
                <div className="rounded-3xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-xl font-semibold text-slate-900">Sözleşme bulunamadı</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Filtrelere uyan kayıt yok. Aramayı temizleyebilir veya yeni sözleşme
                    ekleyebilirsiniz.
                  </p>
                </div>
              ) : (
                filteredContracts.map(summary => {
                  const isSelected =
                    selectedContract?.subcontractor.id === summary.subcontractor.id

                  return (
                    <button
                      key={summary.subcontractor.id}
                      onClick={() => setSelectedContractId(summary.subcontractor.id)}
                      className={`w-full rounded-[1.75rem] border p-5 text-left shadow-sm transition ${
                        isSelected
                          ? 'border-cyan-300 bg-cyan-50 ring-4 ring-cyan-100'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-semibold text-slate-900">
                              {summary.subcontractor.name}
                            </h2>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${summary.status.accent}`}
                            >
                              {summary.status.label}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {summary.subcontractor.workScope}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                            <span>Sözleşme: {formatDate(summary.subcontractor.contractDate)}</span>
                            <span>Başlama: {formatDate(summary.subcontractor.workStartDate || summary.subcontractor.contractDate)}</span>
                            <span>Bitiş: {formatDate(summary.endDate)}</span>
                            <span>Süre: {summary.subcontractor.workDurationDays} gün</span>
                            <span>Telefon: {summary.subcontractor.phone || '-'}</span>
                            <span>Son hakediş: {formatDate(summary.lastClaimDate)}</span>
                          </div>
                        </div>

                        <div className="grid shrink-0 gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl bg-slate-100 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Sözleşme
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {formatCurrency(summary.subcontractor.contractAmount)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-100 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Tamamlanma
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              %{summary.completionPercent.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="h-2 rounded-full bg-slate-200">
                          <div
                            className={`h-2 rounded-full ${summary.status.progressColor}`}
                            style={{ width: `${Math.min(summary.completionPercent, 100)}%` }}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Tahakkuk
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {formatCurrency(summary.totalClaimAmount)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Ödenen
                            </div>
                            <div className="mt-1 text-sm font-semibold text-emerald-700">
                              {formatCurrency(summary.totalPaid)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Bekleyen
                            </div>
                            <div className="mt-1 text-sm font-semibold text-amber-700">
                              {formatCurrency(summary.pendingPayment)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Hakediş
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {summary.claimCount} kayıt
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="space-y-4">
            {!selectedContract ? (
              <div className="rounded-[1.75rem] bg-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-200">
                <h2 className="text-xl font-semibold text-slate-900">Sözleşme seçin</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Soldaki listeden bir taşeron sözleşmesi seçtiğinizde tüm detaylar burada
                  görünecek.
                </p>
              </div>
            ) : (
              <>
                <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Seçili Sözleşme
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                        {selectedContract.subcontractor.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedContract.subcontractor.workScope}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${selectedContract.status.accent}`}
                    >
                      {selectedContract.status.label}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <DetailMetric
                      label="Sözleşme Tarihi"
                      value={formatDate(selectedContract.subcontractor.contractDate)}
                    />
                    <DetailMetric
                      label="İşe Başlama"
                      value={formatDate(selectedContract.subcontractor.workStartDate || selectedContract.subcontractor.contractDate)}
                    />
                    <DetailMetric
                      label="Planlanan Bitiş"
                      value={formatDate(selectedContract.endDate)}
                    />
                    <DetailMetric
                      label="İş Süresi"
                      value={`${selectedContract.subcontractor.workDurationDays} gün`}
                    />
                    <DetailMetric
                      label="Telefon"
                      value={selectedContract.subcontractor.phone || '-'}
                    />
                    <DetailMetric
                      label="Hakediş Adedi"
                      value={`${selectedContract.claimCount} kayıt`}
                    />
                    <DetailMetric
                      label="Son Hakediş"
                      value={formatDate(selectedContract.lastClaimDate)}
                    />
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <DetailMetric
                      label="Sözleşme Tutarı"
                      value={formatCurrency(selectedContract.subcontractor.contractAmount)}
                      helper="Sistemde kalan güncel sözleşme büyüklüğü"
                    />
                    <DetailMetric
                      label="Kalan Sözleşme Bakiyesi"
                      value={formatCurrency(selectedContract.remainingContractAmount)}
                      helper="Henüz hakedişe dönüşmeyen bölüm"
                    />
                    <DetailMetric
                      label="Net Tahakkuk"
                      value={formatCurrency(selectedContract.totalNetAccrued)}
                      helper="Kesinti sonrası oluşan toplam ödeme yükümlülüğü"
                    />
                    <DetailMetric
                      label="Toplam Kesinti"
                      value={formatCurrency(selectedContract.totalDeduction)}
                      helper="Hakedişler içinde kesilen toplam tutar"
                    />
                    <DetailMetric
                      label="Ödenen Net"
                      value={formatCurrency(selectedContract.totalPaid)}
                      helper="Durumu ödendi olan kayıtların toplamı"
                    />
                    <DetailMetric
                      label="Bekleyen Ödeme"
                      value={formatCurrency(selectedContract.pendingPayment)}
                      helper="Henüz kapanmamış net ödeme yükü"
                    />
                  </div>

                  <div className="mt-6 rounded-3xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          İlerleme
                        </div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">
                          %{selectedContract.completionPercent.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-right text-sm text-slate-500">
                        <div>Sözleşme: {formatCurrency(selectedContract.subcontractor.contractAmount)}</div>
                        <div>Hakediş: {formatCurrency(selectedContract.totalClaimAmount)}</div>
                      </div>
                    </div>
                    <div className="mt-4 h-3 rounded-full bg-slate-200">
                      <div
                        className={`h-3 rounded-full ${selectedContract.status.progressColor}`}
                        style={{ width: `${Math.min(selectedContract.completionPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {selectedContract.subcontractor.contractItems?.length ? (
                    <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Sözleşme İş Kalemleri
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            Bu kalemler hakediş girişinde otomatik seçenek olarak gelir.
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-slate-900">
                          {selectedContract.subcontractor.contractItems.length} kalem
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                          <thead>
                            <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                              <th className="px-3 py-2">İş Kalemi</th>
                              <th className="px-3 py-2">Birim</th>
                              <th className="px-3 py-2 text-right">Takribi Miktar</th>
                              <th className="px-3 py-2 text-right">Birim Fiyat</th>
                              <th className="px-3 py-2 text-right">Tutar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedContract.subcontractor.contractItems.map(item => (
                              <tr key={item.id} className="border-b last:border-b-0">
                                <td className="px-3 py-3 font-medium text-slate-900">{item.name}</td>
                                <td className="px-3 py-3 text-slate-600">{item.unit}</td>
                                <td className="px-3 py-3 text-right text-slate-700">
                                  {new Intl.NumberFormat('tr-TR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(item.estimatedQuantity)}
                                </td>
                                <td className="px-3 py-3 text-right text-slate-700">
                                  {formatCurrency(item.unitPrice)}
                                </td>
                                <td className="px-3 py-3 text-right font-semibold text-slate-900">
                                  {formatCurrency(item.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {selectedContract.analysisText ? (
                    <div className="mt-6 rounded-3xl border border-cyan-200 bg-cyan-50 px-4 py-4 text-sm leading-6 text-cyan-900">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                        Barter Analizi
                      </div>
                      {selectedContract.analysisText}
                    </div>
                  ) : null}

                  {selectedContract.userNote ? (
                    <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Açıklama
                      </div>
                      <div className="whitespace-pre-wrap">{selectedContract.userNote}</div>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() =>
                        router.push(`/subcontractors/${selectedContract.subcontractor.id}`)
                      }
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Hakediş Sayfası
                    </button>
                    <button
                      onClick={() => router.push('/subcontractors')}
                      className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      Taşeron Listesi
                    </button>
                    <button
                      onClick={() => {
                        setEditingSubcontractor(selectedContract.subcontractor)
                        setModalOpen(true)
                      }}
                      className="rounded-2xl bg-cyan-100 px-4 py-3 text-sm font-medium text-cyan-800 transition hover:bg-cyan-200"
                    >
                      Sözleşmeyi Düzenle
                    </button>
                    <button
                      onClick={() => handleDeleteSubcontractor(selectedContract.subcontractor)}
                      className="rounded-2xl bg-rose-100 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-200"
                    >
                      Sözleşmeyi Sil
                    </button>
                  </div>
                </section>

                <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Hakediş Hareketleri
                      </div>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">
                        Finansal Akış
                      </h3>
                    </div>
                    <div className="text-sm text-slate-500">
                      {selectedContract.claimCount} kayıt
                    </div>
                  </div>

                  {selectedContract.claims.length === 0 ? (
                    <div className="mt-5 rounded-3xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      Bu sözleşme için henüz hakediş kaydı yok.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {selectedContract.claims.map(claim => (
                        <div key={claim.id} className="rounded-3xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-base font-semibold text-slate-900">
                                  {formatDate(claim.claimDate)}
                                </div>
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${claimStatusStyles[claim.status]}`}
                                >
                                  {claimStatusLabels[claim.status]}
                                </span>
                              </div>
                              <div className="mt-1 text-sm text-slate-600">{claim.workItem}</div>
                              {claim.note ? (
                                <div className="mt-2 text-sm leading-6 text-slate-500">
                                  {claim.note}
                                </div>
                              ) : null}
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                  İlerleme
                                </div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">
                                  %{Number(claim.progressPercent || 0).toFixed(1)}
                                </div>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                  Önceki
                                </div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">
                                  {formatCurrency(claim.previousPaidAmount)}
                                </div>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                  Bu Hakediş
                                </div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">
                                  {formatCurrency(claim.currentClaimAmount)}
                                </div>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                  Kesinti
                                </div>
                                <div className="mt-1 text-sm font-semibold text-rose-700">
                                  {formatCurrency(claim.deductionAmount)}
                                </div>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                  Net Ödeme
                                </div>
                                <div className="mt-1 text-sm font-semibold text-emerald-700">
                                  {formatCurrency(claim.netPayableAmount)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </section>
      </div>

      <SubcontractorModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingSubcontractor(null)
        }}
        onSave={handleSaveSubcontractor}
        initialData={editingSubcontractor}
        title={editingSubcontractor ? 'Sözleşmeyi Düzenle' : 'Yeni Sözleşme Oluştur'}
        submitLabel={editingSubcontractor ? 'Güncelle' : 'Kaydet'}
      />
    </div>
  )
}
