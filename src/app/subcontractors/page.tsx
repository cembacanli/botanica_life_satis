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
  barterItems?: BarterItem[]
  phone?: string
  note?: string
  createdAt: string
}

interface BarterItem {
  id: string
  block: string
  apartmentNo: string
  amount: number
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
  progressPercent?: number
  claimDate?: string
  createdAt?: string
  currentClaimAmount?: number
  netPayableAmount: number
  status: 'taslak' | 'onaylandi' | 'odendi'
}

type StatusFilter = 'all' | 'active' | 'delayed' | 'completed' | 'noClaims'

interface SubcontractorSummary {
  item: Subcontractor
  relatedClaims: SubcontractorClaim[]
  totalClaimAmount: number
  totalNet: number
  totalPaid: number
  pendingNet: number
  remainingPayableAmount: number
  completionPercent: number
  workStartDate: string
  endDate: string
  daysRemaining: number
  status: {
    key: Exclude<StatusFilter, 'all' | 'noClaims'>
    label: string
    badge: string
    bar: string
  }
  analysisText: string
}

const statusFilters: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Aktif' },
  { key: 'delayed', label: 'Gecikmede' },
  { key: 'completed', label: 'Tamamlanan' },
  { key: 'noClaims', label: 'Hakediş Yok' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(dateText: string) {
  if (!dateText) return '-'
  const parsed = new Date(`${dateText}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateText
  return parsed.toLocaleDateString('tr-TR')
}

function getEndDate(startDate: string, durationDays: number) {
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || durationDays <= 0) return ''
  const end = new Date(start)
  end.setDate(end.getDate() + durationDays)
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

function parseMoneyText(valueText: string) {
  let raw = String(valueText || '').toLocaleLowerCase('tr-TR').trim()
  let multiplier = 1
  if (raw.includes('milyar')) {
    multiplier = 1_000_000_000
    raw = raw.replace('milyar', '')
  } else if (raw.includes('milyon')) {
    multiplier = 1_000_000
    raw = raw.replace('milyon', '')
  } else if (raw.includes('bin')) {
    multiplier = 1_000
    raw = raw.replace('bin', '')
  }

  raw = raw.replace(/\s+/g, '')
  raw = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/\./g, '')
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.round(parsed * multiplier)
}

function parseAnalysisDeductionFromText(textValue: string) {
  const text = String(textValue || '')
  const explicitMatch = text.match(
    /Toplam\s+sat[ıi]ş?\s+bedeli:\s*([\d.,\s]+(?:\s*(?:milyon|milyar|bin))?)\s*(?:TL|₺|lira)?/i
  )
  if (explicitMatch?.[1]) return parseMoneyText(explicitMatch[1])

  const fallbackMatch = text.match(
    /([\d.,\s]+(?:\s*(?:milyon|milyar|bin))?)\s*(?:TL|₺|lira|bedelle)/i
  )
  if (fallbackMatch?.[1]) return parseMoneyText(fallbackMatch[1])
  return 0
}

function extractAnalysisText(note: string) {
  const text = String(note || '')
  const analysisLines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('[Analiz]'))
    .map(line => line.replace(/^\[Analiz\]\s*/i, '').replace(/\s*Kalan plan:.*$/i, ''))
  return analysisLines.join(' ')
}

function getStatus(daysRemaining: number, completionPercent: number): SubcontractorSummary['status'] {
  if (completionPercent >= 100) {
    return {
      key: 'completed',
      label: 'Tamamlandı',
      badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
      bar: 'bg-emerald-500',
    }
  }

  if (daysRemaining < 0) {
    return {
      key: 'delayed',
      label: `${Math.abs(daysRemaining)} gün gecikme`,
      badge: 'bg-rose-100 text-rose-700 ring-rose-200',
      bar: 'bg-rose-500',
    }
  }

  return {
    key: 'active',
    label: daysRemaining === 0 ? 'Bugün son gün' : `${daysRemaining} gün kaldı`,
    badge: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
    bar: 'bg-cyan-500',
  }
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper?: string
}) {
  return (
    <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/10 backdrop-blur">
      <div className="text-sm text-slate-200">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {helper ? <div className="mt-2 text-xs text-slate-300">{helper}</div> : null}
    </div>
  )
}

export default function SubcontractorsPage() {
  const router = useRouter()
  const { user, loading, isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [claims, setClaims] = useState<SubcontractorClaim[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const loadData = () => {
    fetch('/api/subcontractors', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => setSubcontractors(Array.isArray(data) ? data : []))
      .catch(() => setSubcontractors([]))

    fetch('/api/subcontractor-claims', { cache: 'no-store' })
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
    if (!loading && isAuthenticated) {
      loadData()
    }
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    const intervalId = setInterval(loadData, 5000)
    return () => clearInterval(intervalId)
  }, [])

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
      throw new Error(json?.error || 'Taşeron kaydedilemedi.')
    }

    await loadData()
    setEditingSubcontractor(null)
  }

  const handleDeleteSubcontractor = async (item: Subcontractor) => {
    const ok = window.confirm(`"${item.name}" taşeronunu silmek istiyor musunuz? Bağlı hakedişler de silinir.`)
    if (!ok) return

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
    setSubcontractors(prev => prev.filter(subcontractor => subcontractor.id !== item.id))
    setClaims(prev => prev.filter(claim => claim.subcontractorId !== item.id))
  }

  const summaries = useMemo<SubcontractorSummary[]>(() => {
    return subcontractors.map(item => {
      const relatedClaims = claims.filter(claim => claim.subcontractorId === item.id)
      const totalClaimAmount = relatedClaims.reduce((sum, claim) => sum + Number(claim.currentClaimAmount || 0), 0)
      const totalNet = relatedClaims.reduce((sum, claim) => sum + Number(claim.netPayableAmount || 0), 0)
      const totalPaid = relatedClaims
        .filter(claim => claim.status === 'odendi')
        .reduce((sum, claim) => sum + Number(claim.netPayableAmount || 0), 0)
      const pendingNet = Math.max(totalNet - totalPaid, 0)
      const analysisText = extractAnalysisText(item.note || '')
      const noteDeduction = Math.max(
        parseAnalysisDeductionFromText(analysisText),
        parseAnalysisDeductionFromText(item.note || '')
      )
      const barterItemsList = item.barterItems || []
      const barterListDeduction = Array.isArray(barterItemsList)
        ? barterItemsList.reduce((sum, barterItem) => sum + Number(barterItem.amount || 0), 0)
        : 0
      const totalBarterAmount = Math.max(noteDeduction, barterListDeduction)

      const totalPaymentIncludingBarter = totalBarterAmount + totalClaimAmount
      const remainingPayableAmount = Math.max(Number(item.contractAmount || 0) - totalPaymentIncludingBarter, 0)
      const completionPercent =
        item.contractAmount > 0 ? Math.min(Number(((totalClaimAmount / item.contractAmount) * 100).toFixed(1)), 100) : 0
      const workStartDate = item.workStartDate || item.contractDate
      const endDate = getEndDate(workStartDate, item.workDurationDays)
      const daysRemaining = getDaysRemaining(endDate)
      const status = getStatus(daysRemaining, completionPercent)

      return {
        item,
        relatedClaims,
        totalClaimAmount,
        totalNet,
        totalPaid,
        pendingNet,
        remainingPayableAmount,
        completionPercent,
        workStartDate,
        endDate,
        daysRemaining,
        status,
        analysisText,
      }
    })
  }, [claims, subcontractors])

  const totals = useMemo(() => {
    const totalContractAmount = summaries.reduce((sum, summary) => sum + Number(summary.item.contractAmount || 0), 0)
    const totalClaimAmount = summaries.reduce((sum, summary) => sum + summary.totalClaimAmount, 0)
    const totalNet = summaries.reduce((sum, summary) => sum + summary.totalNet, 0)
    const totalPaid = summaries.reduce((sum, summary) => sum + summary.totalPaid, 0)
    const delayedCount = summaries.filter(summary => summary.status.key === 'delayed').length
    const averageCompletion =
      summaries.length > 0 ? summaries.reduce((sum, summary) => sum + summary.completionPercent, 0) / summaries.length : 0

    return {
      subcontractorCount: summaries.length,
      claimCount: claims.length,
      totalContractAmount,
      totalClaimAmount,
      totalNet,
      totalPaid,
      delayedCount,
      averageCompletion,
    }
  }, [claims.length, summaries])

  const filteredSummaries = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('tr-TR')

    return summaries
      .filter(summary => {
        if (statusFilter === 'noClaims' && summary.relatedClaims.length > 0) return false
        if (statusFilter !== 'all' && statusFilter !== 'noClaims' && summary.status.key !== statusFilter) return false
        if (!term) return true

        const text = [
          summary.item.name,
          summary.item.workScope,
          summary.item.phone || '',
          summary.item.note || '',
          ...(summary.item.contractItems || []).map(contractItem => contractItem.name),
        ]
          .join(' ')
          .toLocaleLowerCase('tr-TR')

        return text.includes(term)
      })
      .sort((a, b) => {
        const order = { delayed: 0, active: 1, completed: 2 }
        if (a.status.key !== b.status.key) return order[a.status.key] - order[b.status.key]
        return Number(b.item.contractAmount || 0) - Number(a.item.contractAmount || 0)
      })
  }, [searchTerm, statusFilter, summaries])

  if (!mounted || loading) {
    return <div className="min-h-screen bg-slate-100 p-8">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0_55%,_#cbd5e1)] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl ring-1 ring-slate-800">
          <div className="bg-[linear-gradient(120deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94),rgba(8,47,73,0.92))] px-6 py-8 md:px-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.32em] text-cyan-200">Taşeron Takibi</div>
                <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Taşeron ve Hakediş Yönetimi</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 md:text-base">
                  Taşeron sözleşmelerini, kalan süreleri, iş kalemlerini ve hakediş durumlarını tek ekranda takip edin.
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
                  onClick={() => router.push('/contracts')}
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Sözleşme Merkezi
                </button>
                <button
                  onClick={() => {
                    setEditingSubcontractor(null)
                    setModalOpen(true)
                  }}
                  className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Yeni Taşeron
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <SummaryCard label="Toplam Taşeron" value={String(totals.subcontractorCount)} helper="Kayıtlı sözleşme sayısı" />
              <SummaryCard label="Sözleşme Portföyü" value={formatCurrency(totals.totalContractAmount)} helper="İş kalemleri toplamı" />
              <SummaryCard label="Toplam Hakediş" value={formatCurrency(totals.totalClaimAmount)} helper={`${totals.claimCount} hakediş kaydı`} />
              <SummaryCard label="Net Tahakkuk" value={formatCurrency(totals.totalNet)} helper="Kesinti sonrası net toplam" />
              <SummaryCard label="Ödenen Net" value={formatCurrency(totals.totalPaid)} helper="Durumu ödendi olan kayıtlar" />
              <SummaryCard label="Ortalama İlerleme" value={`%${totals.averageCompletion.toFixed(1)}`} helper={`${totals.delayedCount} geciken iş`} />
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ara</span>
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Taşeron, iş kapsamı, telefon veya iş kalemi ara"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </label>

            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Durum</span>
              <div className="flex flex-wrap gap-2">
                {statusFilters.map(option => (
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

          <div className="mt-4 text-sm text-slate-500">{filteredSummaries.length} taşeron listeleniyor.</div>
        </section>

        {filteredSummaries.length === 0 ? (
          <section className="rounded-3xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Taşeron kaydı bulunamadı</h2>
            <p className="mt-2 text-sm text-slate-500">Aramayı temizleyebilir veya yeni taşeron ekleyebilirsiniz.</p>
          </section>
        ) : (
          <section className="grid gap-4">
            {filteredSummaries.map(summary => {
              const contractItemPreview = (summary.item.contractItems || []).slice(0, 3)

              return (
                <article key={summary.item.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-slate-900">{summary.item.name}</h2>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${summary.status.badge}`}>
                          {summary.status.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{summary.item.workScope}</p>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Sözleşme: {formatDate(summary.item.contractDate)}</span>
                        <span>Başlama: {formatDate(summary.workStartDate)}</span>
                        <span>Bitiş: {formatDate(summary.endDate)}</span>
                        <span>Süre: {summary.item.workDurationDays} gün</span>
                        <span>Telefon: {summary.item.phone || '-'}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => router.push(`/subcontractors/${summary.item.id}`)}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        Hakedişler
                      </button>
                      <button
                        onClick={() => {
                          setEditingSubcontractor(summary.item)
                          setModalOpen(true)
                        }}
                        className="rounded-2xl bg-cyan-100 px-4 py-3 text-sm font-medium text-cyan-800 transition hover:bg-cyan-200"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDeleteSubcontractor(summary.item)}
                        className="rounded-2xl bg-rose-100 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-200"
                      >
                        Sil
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Sözleşme</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(summary.item.contractAmount)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Hakediş</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(summary.totalClaimAmount)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Net</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(summary.totalNet)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Ödenen</div>
                      <div className="mt-1 text-sm font-semibold text-emerald-700">{formatCurrency(summary.totalPaid)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Bekleyen</div>
                      <div className="mt-1 text-sm font-semibold text-amber-700">{formatCurrency(summary.pendingNet)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Kalan Bakiye</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(summary.remainingPayableAmount)}</div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-slate-700">Tamamlanma: %{summary.completionPercent.toFixed(1)}</span>
                      <span className="text-slate-500">{summary.relatedClaims.length} hakediş kaydı</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div
                        className={`h-2 rounded-full ${summary.status.bar}`}
                        style={{ width: `${Math.min(summary.completionPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {contractItemPreview.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {contractItemPreview.map(contractItem => (
                        <span key={contractItem.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {contractItem.name}: {formatCurrency(contractItem.amount)}
                        </span>
                      ))}
                      {(summary.item.contractItems?.length || 0) > contractItemPreview.length ? (
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                          +{(summary.item.contractItems?.length || 0) - contractItemPreview.length} kalem
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {summary.analysisText ? (
                    <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-900">
                      {summary.analysisText}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </section>
        )}
      </div>

      <SubcontractorModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingSubcontractor(null)
        }}
        onSave={handleSaveSubcontractor}
        initialData={editingSubcontractor}
        title={editingSubcontractor ? 'Taşeron Sözleşmesini Düzenle' : 'Yeni Taşeron Ekle'}
        submitLabel={editingSubcontractor ? 'Güncelle' : 'Kaydet'}
      />
    </div>
  )
}
