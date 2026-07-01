'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  barterItems?: BarterItem[]
  phone?: string
  note?: string
  contractFileUrl?: string
  contractFileName?: string
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
  isSigned?: boolean
}

interface SubcontractorPayment {
  id: string
  subcontractorId: string
  subcontractorName: string
  paymentDate: string
  amount: number
  paymentMethod?: string
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
  isSigned: boolean
}

type ActiveTab = 'claims' | 'payments'

interface PaymentFormData {
  paymentDate: string
  amount: string
  paymentMethod: string
  note: string
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

const SIGNED_TAG = '[İMZALANDI]'

function isClaimSigned(claim: SubcontractorClaim): boolean {
  return (claim.note || '').includes(SIGNED_TAG)
}

function addSignedTag(note: string): string {
  if (note.includes(SIGNED_TAG)) return note
  return note ? `${note}\n${SIGNED_TAG}` : SIGNED_TAG
}

function removeSignedTag(note: string): string {
  return note
    .split('\n')
    .filter(line => line.trim() !== SIGNED_TAG)
    .join('\n')
    .trim()
}

export default function SubcontractorDetailPage() {
  const params = useParams<{ id: string }>()
  const subcontractorId = String(params?.id || '')
  const router = useRouter()
  const { user, loading, isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [subcontractor, setSubcontractor] = useState<Subcontractor | null>(null)
  const [claims, setClaims] = useState<SubcontractorClaim[]>([])
  const [payments, setPayments] = useState<SubcontractorPayment[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('claims')
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>({
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: '',
    paymentMethod: '',
    note: '',
  })
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClaim, setEditingClaim] = useState<SubcontractorClaim | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [signingId, setSigningId] = useState<string | null>(null)
  const [activePrintId, setActivePrintId] = useState<string | 'all' | null>(null)
  const printAreaRef = useRef<HTMLDivElement>(null)

  const barterItems = useMemo<BarterItem[]>(() => {
    return subcontractor?.barterItems || []
  }, [subcontractor])

  const totalBarterAmount = useMemo(() => {
    if (!subcontractor) return 0
    const listTotal = Array.isArray(subcontractor.barterItems)
      ? subcontractor.barterItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)
      : 0
    const noteAnalysisText = extractAnalysisText(subcontractor.note || '')
    const noteTotal = Math.max(
      parseAnalysisDeductionFromText(noteAnalysisText),
      parseAnalysisDeductionFromText(subcontractor.note || '')
    )
    return Math.max(listTotal, noteTotal)
  }, [subcontractor])

  const noteAnalysisText = useMemo(() => {
    if (!subcontractor) return ''
    return extractAnalysisText(subcontractor.note || '')
  }, [subcontractor])

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

    fetch(`/api/subcontractor-payments?subcontractorId=${encodeURIComponent(subcontractorId)}`)
      .then(r => r.json())
      .then(data => setPayments(Array.isArray(data) ? data : []))
      .catch(() => setPayments([]))
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

  const handleDeleteClick = (item: SubcontractorClaim) => {
    if (deleteConfirmId === item.id) {
      handleDeleteClaim(item)
      setDeleteConfirmId(null)
    } else {
      setDeleteConfirmId(item.id)
    }
  }

  const handleSavePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!subcontractor) return

    const amount = Number(Number(paymentForm.amount || 0).toFixed(2))
    if (!paymentForm.paymentDate) {
      setPaymentError('Odeme tarihi gereklidir.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Odeme tutari 0 dan buyuk olmalidir.')
      return
    }

    setPaymentSaving(true)
    setPaymentError('')
    try {
      const response = await fetch('/api/subcontractor-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-username': user?.username || '',
        },
        body: JSON.stringify({
          subcontractorId: subcontractor.id,
          subcontractorName: subcontractor.name,
          paymentDate: paymentForm.paymentDate,
          amount,
          paymentMethod: paymentForm.paymentMethod,
          note: paymentForm.note,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.error || 'Odeme kaydedilemedi.')
      }

      setPayments(prev => [json, ...prev])
      setPaymentForm({
        paymentDate: new Date().toISOString().slice(0, 10),
        amount: '',
        paymentMethod: '',
        note: '',
      })
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Odeme kaydedilemedi.')
    } finally {
      setPaymentSaving(false)
    }
  }

  const handleDeletePayment = async (item: SubcontractorPayment) => {
    const ok = window.confirm(`${formatCurrency(item.amount)} tutarindaki odemeyi silmek istiyor musunuz?`)
    if (!ok) return

    const response = await fetch('/api/subcontractor-payments', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-username': user?.username || '',
      },
      body: JSON.stringify({ id: item.id }),
    })
    const json = await response.json()
    if (!response.ok) {
      alert(json?.error || 'Odeme silinemedi.')
      return
    }
    setPayments(prev => prev.filter(payment => payment.id !== item.id))
  }

  const handleToggleSigned = useCallback(async (item: SubcontractorClaim) => {
    if (signingId) return
    setSigningId(item.id)
    try {
      const currentlySigned = isClaimSigned(item)
      const newNote = currentlySigned
        ? removeSignedTag(item.note || '')
        : addSignedTag(item.note || '')

      const response = await fetch('/api/subcontractor-claims', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-username': user?.username || '',
        },
        body: JSON.stringify({
          id: item.id,
          subcontractorId: item.subcontractorId,
          subcontractorName: item.subcontractorName,
          workItem: item.workItem,
          contractAmount: item.contractAmount,
          progressPercent: item.progressPercent,
          previousPaidAmount: item.previousPaidAmount,
          currentClaimAmount: item.currentClaimAmount,
          deductionAmount: item.deductionAmount,
          claimDate: item.claimDate,
          status: item.status,
          note: newNote,
        }),
      })

      if (response.ok) {
        const updated = await response.json()
        setClaims(prev => prev.map(c => (c.id === updated.id ? updated : c)))
      }
    } catch {
      // silently fail
    } finally {
      setSigningId(null)
    }
  }, [signingId, user?.username])

  useEffect(() => {
    if (activePrintId !== null) {
      const timer = setTimeout(() => {
        window.print()
        setActivePrintId(null)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [activePrintId])

  const handlePrint = useCallback(() => {
    setActivePrintId('all')
  }, [])

  const handlePrintSingle = useCallback((claimId: string) => {
    setActivePrintId(claimId)
  }, [])

  const totals = useMemo(() => {
    const totalCurrentClaim = claims.reduce((sum, item) => sum + toNumber(item.currentClaimAmount), 0)
    const totalNetPayable = claims.reduce((sum, item) => sum + toNumber(item.netPayableAmount), 0)
    const totalStandalonePayments = payments.reduce((sum, item) => sum + toNumber(item.amount), 0)
    const totalPaid = claims
      .filter(item => item.status === 'odendi')
      .reduce((sum, item) => sum + toNumber(item.netPayableAmount), 0)
    const totalPending = claims
      .filter(item => item.status !== 'odendi')
      .reduce((sum, item) => sum + toNumber(item.netPayableAmount), 0)
    const contractAmount = toNumber(subcontractor?.contractAmount)
    const cumulativeProgressPercent =
      contractAmount > 0 ? Math.min(Number(((totalCurrentClaim / contractAmount) * 100).toFixed(2)), 100) : 0
    return { totalCurrentClaim, totalNetPayable, totalStandalonePayments, totalPaid, totalPending, cumulativeProgressPercent }
  }, [claims, payments, subcontractor?.contractAmount])

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
          isSigned: isClaimSigned(item),
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

  const selectedPrintClaim = useMemo(() => {
    if (!activePrintId || activePrintId === 'all') return null
    return cumulativeClaims.find(c => c.id === activePrintId) || null
  }, [activePrintId, cumulativeClaims])

  const defaultPreviousPaidAmount = useMemo(() => {
    if (!editingClaim) return totals.totalCurrentClaim
    const found = cumulativeClaims.find(item => item.id === editingClaim.id)
    return toNumber(found?.previousCumulativeClaimAmount)
  }, [cumulativeClaims, editingClaim, totals.totalCurrentClaim])

  const remainingContractAmount = useMemo(() => {
    if (!subcontractor) return 0
    const contractAmount = toNumber(subcontractor.contractAmount)
    return Math.max(contractAmount - totals.totalCurrentClaim - totalBarterAmount - totals.totalStandalonePayments, 0)
  }, [subcontractor, totals.totalCurrentClaim, totals.totalStandalonePayments, totalBarterAmount])

  const formatDate = (value: string) => {
    if (!value) return '-'
    const parsed = new Date(`${value}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString('tr-TR')
    const fallback = new Date(value)
    if (Number.isNaN(fallback.getTime())) return value
    return fallback.toLocaleDateString('tr-TR')
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0)

  if (!mounted || loading) {
    return <div className="min-h-screen p-8">Yükleniyor...</div>
  }

  return (
    <>
      <div className="min-h-screen bg-slate-100 p-4 md:p-8 screen-only">
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
                {formatCurrency(subcontractor.contractAmount)}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={!subcontractor || sortedClaims.length === 0}
              className="px-5 py-2.5 text-base bg-indigo-700 hover:bg-indigo-800 text-white rounded disabled:opacity-50 flex items-center gap-2"
              title="Hakediş Raporu Yazdır"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Yazdır
            </button>
            {subcontractor?.contractFileUrl && (
              <a
                href={subcontractor.contractFileUrl}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 text-base bg-emerald-700 hover:bg-emerald-800 text-white rounded flex items-center gap-2"
                title="Sözleşme Belgesini Görüntüle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Sözleşme Belgesi
              </a>
            )}
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Row 1: Contract Metrics */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-between min-h-[96px]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sözleşme Bedeli</div>
            <div className="text-xl md:text-2xl font-bold text-slate-800 mt-1 truncate" title={formatCurrency(subcontractor?.contractAmount || 0)}>
              {formatCurrency(subcontractor?.contractAmount || 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-between min-h-[96px]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kümülatif Hakediş</div>
            <div className="text-xl md:text-2xl font-bold text-cyan-700 mt-1 truncate" title={formatCurrency(totals.totalCurrentClaim)}>
              {formatCurrency(totals.totalCurrentClaim)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-between min-h-[96px]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Barter Toplamı</div>
            <div className="text-xl md:text-2xl font-bold text-indigo-700 mt-1 truncate" title={formatCurrency(totalBarterAmount)}>
              {formatCurrency(totalBarterAmount)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-between min-h-[96px]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kalan Sözleşme Bakiyesi</div>
            <div className="text-xl md:text-2xl font-bold text-rose-700 mt-1 truncate" title={formatCurrency(remainingContractAmount)}>
              {formatCurrency(remainingContractAmount)}
            </div>
          </div>

          {/* Row 2: Progress & Payment Metrics */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-between min-h-[96px]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kümülatif İlerleme</div>
            <div className="text-xl md:text-2xl font-bold text-slate-900 mt-1 truncate">
              %{totals.cumulativeProgressPercent.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-between min-h-[96px]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Toplam Net Ödeme</div>
            <div className="text-xl md:text-2xl font-bold text-teal-700 mt-1 truncate" title={formatCurrency(totals.totalNetPayable)}>
              {formatCurrency(totals.totalNetPayable)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-between min-h-[96px]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yapilan Odemeler</div>
            <div className="text-xl md:text-2xl font-bold text-emerald-700 mt-1 truncate" title={formatCurrency(totals.totalStandalonePayments)}>
              {formatCurrency(totals.totalStandalonePayments)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-between min-h-[96px]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bekleyen</div>
            <div className="text-xl md:text-2xl font-bold text-amber-700 mt-1 truncate" title={formatCurrency(totals.totalPending)}>
              {formatCurrency(totals.totalPending)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-between min-h-[96px]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ödenen</div>
            <div className="text-xl md:text-2xl font-bold text-green-700 mt-1 truncate" title={formatCurrency(totals.totalPaid + totals.totalStandalonePayments)}>
              {formatCurrency(totals.totalPaid + totals.totalStandalonePayments)}
            </div>
          </div>
        </div>

        {totalBarterAmount > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b bg-gray-50 font-semibold text-lg text-gray-800">
              Barter Daireleri
            </div>
            <div className="p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {barterItems.map((item, idx) => (
                  <div key={item.id || idx} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                    <div className="text-base font-semibold text-slate-900">
                      {item.block} Blok - Daire {item.apartmentNo}
                    </div>
                    <div className="text-sm text-indigo-700 font-bold mt-1">
                      {formatCurrency(item.amount)}
                    </div>
                    {item.note && <div className="text-xs text-slate-500 mt-2">{item.note}</div>}
                  </div>
                ))}
                {barterItems.length === 0 && noteAnalysisText && (
                  <div className="col-span-full text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border">
                    <div className="font-semibold text-xs uppercase text-slate-500 mb-1">Barter Açıklaması</div>
                    {noteAnalysisText}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('claims')}
            className={`px-4 py-2 text-sm rounded font-semibold ${
              activeTab === 'claims'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Hakedis Kayitlari
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 text-sm rounded font-semibold ${
              activeTab === 'payments'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Yapilan Odemeler
          </button>
        </div>

        <div className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-6 ${activeTab === 'payments' ? '' : 'hidden'}`}>
          <div className="px-5 py-4 border-b bg-gray-50 font-semibold text-lg text-gray-800">Yapilan Odemeler</div>
          <div className="p-5 border-b bg-white">
            <form onSubmit={handleSavePayment} className="grid gap-4 lg:grid-cols-[160px_180px_180px_minmax(0,1fr)_auto] lg:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Tarih</span>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={event => setPaymentForm(prev => ({ ...prev, paymentDate: event.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Tutar</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={paymentForm.amount}
                  onChange={event => setPaymentForm(prev => ({ ...prev, amount: event.target.value }))}
                  placeholder="0"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Odeme Tipi</span>
                <input
                  value={paymentForm.paymentMethod}
                  onChange={event => setPaymentForm(prev => ({ ...prev, paymentMethod: event.target.value }))}
                  placeholder="Nakit, banka..."
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Not</span>
                <input
                  value={paymentForm.note}
                  onChange={event => setPaymentForm(prev => ({ ...prev, note: event.target.value }))}
                  placeholder="Aciklama"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={!subcontractor || paymentSaving}
                className="rounded bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {paymentSaving ? 'Kaydediliyor' : 'Odeme Ekle'}
              </button>
            </form>
            {paymentError && <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{paymentError}</div>}
          </div>
          {payments.length === 0 ? (
            <div className="p-5 text-gray-500">Kayit yok</div>
          ) : (
            <div className="divide-y">
              {payments.map(item => (
                <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-slate-900">{formatCurrency(item.amount)}</div>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
                      <span>{formatDate(item.paymentDate)}</span>
                      <span>{item.paymentMethod || 'Odeme tipi yok'}</span>
                    </div>
                    {item.note && <div className="mt-2 text-sm text-slate-600">{item.note}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePayment(item)}
                    className="self-start rounded bg-red-100 px-4 py-2 text-sm text-red-700 hover:bg-red-200 md:self-center"
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${activeTab === 'claims' ? '' : 'hidden'}`}>
          <div className="px-5 py-4 border-b bg-gray-50 font-semibold text-lg text-gray-800">Hakediş Kayıtları</div>
          {sortedClaims.length === 0 ? (
            <div className="p-5 text-gray-500">Kayıt yok</div>
          ) : (
            <div className="divide-y">
              {sortedClaims.map(item => {
                const signed = item.isSigned
                const displayNote = (item.note || '').split('\n').filter(l => l.trim() !== SIGNED_TAG).join('\n').trim()
                return (
                <div key={item.id} className={`p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${signed ? 'border-l-4 border-l-green-500' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-xl font-semibold text-gray-900">{item.workItem}</div>
                      <span className={`text-sm px-3 py-1 rounded ${statusStyles[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                      {signed && (
                        <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800 font-semibold flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          İmzalandı
                        </span>
                      )}
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
                    {displayNote && <div className="text-sm text-gray-500 mt-1">{displayNote}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* İmzalandı Checkbox */}
                    <label
                      className={`flex items-center gap-2 cursor-pointer select-none rounded-lg px-3 py-2 text-sm font-medium transition ${
                        signed
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      } ${signingId === item.id ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={signed}
                        onChange={() => handleToggleSigned(item)}
                        disabled={signingId === item.id}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 accent-green-600"
                      />
                      İmzalandı
                    </label>
                    <div className="flex items-center gap-2">
                    {deleteConfirmId === item.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteClick(item)}
                          className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 font-semibold"
                        >
                          Evet, Sil
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-4 py-2 text-sm rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                        >
                          Vazgeç
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handlePrintSingle(item.id)}
                          className="px-4 py-2 text-sm rounded bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center gap-1"
                          title="Bu Hakedişi Yazdır"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Yazdır
                        </button>
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
                          onClick={() => handleDeleteClick(item)}
                          className="px-4 py-2 text-sm rounded bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Sil
                        </button>
                      </>
                    )}
                    </div>
                  </div>
                </div>
              )})}
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

    {/* ======== Professional Print Area ======== */}
    {subcontractor && sortedClaims.length > 0 && activePrintId !== null && (
      <div
        id="hakedis-print-area"
        className="print-only"
        ref={printAreaRef}
      >
        {activePrintId === 'all' && (
          <div className="print-page">
            {/* Header */}
            <div className="print-header">
              HAKEDİŞ RAPORU
            </div>
            <div className="print-subheader">
              {subcontractor.name} — {subcontractor.workScope}
            </div>

            {/* Meta Info Table */}
            <table className="print-meta-table">
              <tbody>
                <tr>
                  <td className="meta-label">Taşeron Adı</td>
                  <td className="meta-value">{subcontractor.name}</td>
                  <td className="meta-label">İş Kapsamı</td>
                  <td className="meta-value">{subcontractor.workScope}</td>
                </tr>
                <tr>
                  <td className="meta-label">Sözleşme Tarihi</td>
                  <td className="meta-value">{formatDate(subcontractor.contractDate)}</td>
                  <td className="meta-label">İşe Başlama</td>
                  <td className="meta-value">{formatDate(subcontractor.workStartDate || subcontractor.contractDate)}</td>
                </tr>
                <tr>
                  <td className="meta-label">İş Süresi</td>
                  <td className="meta-value">{subcontractor.workDurationDays} gün</td>
                  <td className="meta-label">Telefon</td>
                  <td className="meta-value">{subcontractor.phone || '-'}</td>
                </tr>
                <tr>
                  <td className="meta-label">Sözleşme Bedeli</td>
                  <td className="meta-value" style={{ fontWeight: 700, fontSize: '12px' }}>{formatCurrency(subcontractor.contractAmount)}</td>
                  <td className="meta-label">Hakediş Sayısı</td>
                  <td className="meta-value">{sortedClaims.length} adet</td>
                </tr>
              </tbody>
            </table>

            {/* Summary Box */}
            <div className="print-summary-box">
              <div className="print-summary-item">
                <div className="label">Kümülatif Hakediş</div>
                <div className="value">{formatCurrency(totals.totalCurrentClaim)}</div>
              </div>
              <div className="print-summary-item">
                <div className="label">Toplam Net Ödeme</div>
                <div className="value">{formatCurrency(totals.totalNetPayable)}</div>
              </div>
              <div className="print-summary-item">
                <div className="label">Kümülatif İlerleme</div>
                <div className="value">%{totals.cumulativeProgressPercent.toFixed(2)}</div>
              </div>
              <div className="print-summary-item">
                <div className="label">Ödenen Net</div>
                <div className="value">{formatCurrency(totals.totalPaid)}</div>
              </div>
              <div className="print-summary-item">
                <div className="label">Bekleyen Ödeme</div>
                <div className="value">{formatCurrency(totals.totalPending)}</div>
              </div>
              <div className="print-summary-item">
                <div className="label">Kalan Bakiye</div>
                <div className="value">{formatCurrency(remainingContractAmount)}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                <span>İlerleme</span>
                <span>%{totals.cumulativeProgressPercent.toFixed(2)}</span>
              </div>
              <div className="print-progress-bar">
                <div className="print-progress-fill" style={{ width: `${Math.min(totals.cumulativeProgressPercent, 100)}%` }} />
              </div>
            </div>

            {/* Claims Table */}
            <table className="print-claims-table">
              <thead>
                <tr>
                  <th style={{ width: '4%' }}>No</th>
                  <th style={{ width: '10%' }}>Tarih</th>
                  <th style={{ width: '16%' }}>İş Kalemi</th>
                  <th style={{ width: '8%' }}>Durum</th>
                  <th style={{ width: '12%' }}>Bu Hakediş</th>
                  <th style={{ width: '10%' }}>Kesinti</th>
                  <th style={{ width: '12%' }}>Net Ödeme</th>
                  <th style={{ width: '12%' }}>Küm. Hakediş</th>
                  <th style={{ width: '8%' }}>İlerleme</th>
                  <th style={{ width: '8%' }}>İmza</th>
                </tr>
              </thead>
              <tbody>
                {[...cumulativeClaims].sort((a, b) => a.sequenceNo - b.sequenceNo).map(item => (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center' }}>#{item.sequenceNo}</td>
                    <td style={{ textAlign: 'center' }}>{formatDate(item.claimDate)}</td>
                    <td>{item.workItem}</td>
                    <td style={{ textAlign: 'center' }}>{statusLabels[item.status]}</td>
                    <td>{formatCurrency(item.currentClaimAmount)}</td>
                    <td>{formatCurrency(item.deductionAmount)}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(item.netPayableAmount)}</td>
                    <td>{formatCurrency(item.cumulativeClaimAmount)}</td>
                    <td style={{ textAlign: 'center' }}>%{item.cumulativeProgressPercent.toFixed(1)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {item.isSigned ? (
                        <span className="print-signed-badge">✓ İmzalı</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 9 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'left', fontWeight: 700 }}>TOPLAM</td>
                  <td>{formatCurrency(totals.totalCurrentClaim)}</td>
                  <td>{formatCurrency(cumulativeClaims.length > 0 ? cumulativeClaims[cumulativeClaims.length - 1].cumulativeDeductionAmount : 0)}</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(totals.totalNetPayable)}</td>
                  <td>—</td>
                  <td style={{ textAlign: 'center' }}>%{totals.cumulativeProgressPercent.toFixed(1)}</td>
                  <td style={{ textAlign: 'center', fontSize: 9 }}>
                    {cumulativeClaims.filter(c => c.isSigned).length}/{cumulativeClaims.length}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Signatures */}
            <div className="print-signatures">
              <div className="print-signature-box">
                <div className="name">İşveren / Yetkili</div>
                <div className="title">Botanica Life</div>
              </div>
              <div className="print-signature-box">
                <div className="name">{subcontractor.name}</div>
                <div className="title">Taşeron / Yüklenici</div>
              </div>
            </div>

            {/* Footer */}
            <div className="print-footer">
              Bu belge Botanica Life Satış Yönetim Sistemi tarafından oluşturulmuştur. •{' '}
              <span className="date">
                {new Date().toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        )}

        {activePrintId !== 'all' && selectedPrintClaim && (
          <div className="print-page">
            {/* Header */}
            <div className="print-header">
              HAKEDİŞ ONAY PROTOKOLÜ
            </div>
            <div className="print-subheader" style={{ fontSize: '14px', fontWeight: 600 }}>
              {subcontractor.name} — {selectedPrintClaim.sequenceNo} nolu Hakediş Belgesi
            </div>

            <div style={{ fontSize: '11px', lineHeight: '1.6', marginBottom: '20px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              Aşağıda detayları belirtilen iş kalemlerine ait imalatlar, yerinde incelenerek taraflarca mutabakat altına alınmış ve onaylanmıştır. Bu hakediş raporu, sözleşme şartlarına ve yapılan imalat miktarlarına uygun olarak düzenlenmiştir.
            </div>

            <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', color: '#0f172a' }}>1. SÖZLEŞME VE TAŞERON BİLGİLERİ</h3>
            <table className="print-meta-table">
              <tbody>
                <tr>
                  <td className="meta-label">İşveren</td>
                  <td className="meta-value">Botanica Life</td>
                  <td className="meta-label">Yüklenici (Taşeron)</td>
                  <td className="meta-value">{subcontractor.name}</td>
                </tr>
                <tr>
                  <td className="meta-label">İş Kapsamı / Kalemi</td>
                  <td className="meta-value">{subcontractor.workScope}</td>
                  <td className="meta-label">Sözleşme Tarihi</td>
                  <td className="meta-value">{formatDate(subcontractor.contractDate)}</td>
                </tr>
                <tr>
                  <td className="meta-label">Sözleşme Bedeli</td>
                  <td className="meta-value" style={{ fontWeight: 700 }}>{formatCurrency(subcontractor.contractAmount)}</td>
                  <td className="meta-label">İşe Başlama Tarihi</td>
                  <td className="meta-value">{formatDate(subcontractor.workStartDate || subcontractor.contractDate)}</td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', color: '#0f172a', marginTop: '20px' }}>2. HAKEDİŞ HESAP TABLOSU</h3>
            <table className="print-meta-table">
              <tbody>
                <tr>
                  <td className="meta-label" style={{ width: '35%' }}>Hakediş Numarası</td>
                  <td className="meta-value" style={{ fontWeight: 700 }}>{selectedPrintClaim.sequenceNo} Nolu Hakediş</td>
                  <td className="meta-label" style={{ width: '35%' }}>Hakediş Tarihi</td>
                  <td className="meta-value">{formatDate(selectedPrintClaim.claimDate)}</td>
                </tr>
                <tr>
                  <td className="meta-label">Yapılan İş Açıklaması</td>
                  <td className="meta-value" colSpan={3}>{selectedPrintClaim.workItem}</td>
                </tr>
                <tr>
                  <td className="meta-label">Önceki Toplam Hakediş</td>
                  <td className="meta-value">{formatCurrency(selectedPrintClaim.previousCumulativeClaimAmount)}</td>
                  <td className="meta-label">Bu Hakediş Bedeli (Brüt)</td>
                  <td className="meta-value" style={{ fontWeight: 700, color: '#0284c7' }}>{formatCurrency(selectedPrintClaim.currentClaimAmount)}</td>
                </tr>
                <tr>
                  <td className="meta-label">Bu Hakediş Kesintisi</td>
                  <td className="meta-value" style={{ color: '#dc2626' }}>{formatCurrency(selectedPrintClaim.deductionAmount)}</td>
                  <td className="meta-label">Bu Hakediş Net Ödemesi</td>
                  <td className="meta-value" style={{ fontWeight: 700, fontSize: '13px', color: '#16a34a' }}>{formatCurrency(selectedPrintClaim.netPayableAmount)}</td>
                </tr>
                <tr>
                  <td className="meta-label">Yeni Kümülatif Hakediş Bedeli</td>
                  <td className="meta-value" style={{ fontWeight: 600 }}>{formatCurrency(selectedPrintClaim.cumulativeClaimAmount)}</td>
                  <td className="meta-label">Kümülatif İlerleme Oranı</td>
                  <td className="meta-value" style={{ fontWeight: 600 }}>%{selectedPrintClaim.cumulativeProgressPercent.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="meta-label">Ödeme Durumu</td>
                  <td className="meta-value">{statusLabels[selectedPrintClaim.status]}</td>
                  <td className="meta-label">İmza Durumu</td>
                  <td className="meta-value">
                    {selectedPrintClaim.isSigned ? 'İMZALANDI (ONAYLI)' : 'İMZA BEKLENİYOR'}
                  </td>
                </tr>
                {((selectedPrintClaim.note || '')
                  .split('\n')
                  .filter(l => l.trim() !== SIGNED_TAG)
                  .join('\n')
                  .trim()) && (
                  <tr>
                    <td className="meta-label">Hakediş Notu / Açıklama</td>
                    <td className="meta-value" colSpan={3}>
                      {(selectedPrintClaim.note || '')
                        .split('\n')
                        .filter(l => l.trim() !== SIGNED_TAG)
                        .join('\n')
                        .trim()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', color: '#0f172a', marginTop: '25px' }}>3. ONAY VE İMZA</h3>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '20px' }}>
              Yukarıda dökümü yapılan hakediş raporu tarafların karşılıklı rızasıyla tanzim edilmiş olup, belirtilen net tutar üzerinde mutabık kalınmıştır.
            </div>

            <div className="print-signatures" style={{ marginTop: '20px' }}>
              <div className="print-signature-box" style={{ border: '1px solid #cbd5e1', padding: '15px', borderRadius: '4px' }}>
                <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', marginBottom: '40px', color: '#475569' }}>
                  YÜKLENİCİ (TAŞERON)
                </div>
                <div className="name" style={{ fontSize: '12px', fontWeight: 600 }}>{subcontractor.name}</div>
                <div className="title" style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>Yetkili İmza / Kaşe</div>
              </div>
              <div className="print-signature-box" style={{ border: '1px solid #cbd5e1', padding: '15px', borderRadius: '4px' }}>
                <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', marginBottom: '40px', color: '#475569' }}>
                  İŞVEREN
                </div>
                <div className="name" style={{ fontSize: '12px', fontWeight: 600 }}>Botanica Life</div>
                <div className="title" style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>Yetkili İmza / Kaşe</div>
              </div>
            </div>

            <div className="print-footer" style={{ marginTop: '40px' }}>
              Bu belge Botanica Life Satış Yönetim Sistemi tarafından tanzim edilmiştir. Hakediş onay tarihi:{' '}
              <span className="date">
                {new Date().toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        )}
      </div>
    )}
    </>
  )
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
