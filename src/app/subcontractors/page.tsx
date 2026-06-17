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
  progressPercent?: number
  claimDate?: string
  createdAt?: string
  netPayableAmount: number
  status: 'taslak' | 'onaylandi' | 'odendi'
}

export default function SubcontractorsPage() {
  const router = useRouter()
  const { user, loading, isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [claims, setClaims] = useState<SubcontractorClaim[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null)

  const loadData = () => {
    fetch('/api/subcontractors')
      .then(r => r.json())
      .then(data => setSubcontractors(Array.isArray(data) ? data : []))
      .catch(() => setSubcontractors([]))

    fetch('/api/subcontractor-claims')
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
    loadData()
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    const intervalId = setInterval(loadData, 3000)
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

    if (isEdit) {
      setSubcontractors(prev => prev.map(item => (item.id === json.id ? json : item)))
      setEditingSubcontractor(null)
    } else {
      setSubcontractors(prev => [json, ...prev])
    }
  }

  const handleDeleteSubcontractor = async (item: Subcontractor) => {
    const ok = window.confirm(`"${item.name}" taseronunu silmek istiyor musunuz? Bagli hakedisler de silinir.`)
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
      alert(json?.error || 'Silme islemi basarisiz.')
      return
    }
    setSubcontractors(prev => prev.filter(s => s.id !== item.id))
    setClaims(prev => prev.filter(c => c.subcontractorId !== item.id))
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0)

  const formatDate = (dateText: string) => {
    if (!dateText) return '-'
    const d = new Date(`${dateText}T00:00:00`)
    if (Number.isNaN(d.getTime())) return dateText
    return d.toLocaleDateString('tr-TR')
  }

  const parseMoneyText = (valueText: string) => {
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

  const parseAnalysisDeductionFromText = (textValue: string) => {
    const text = String(textValue || '')
    const explicitMatch = text.match(
      /Toplam\s+sat[ıi]ş?\s+bedeli:\s*([\d.,\s]+(?:\s*(?:milyon|milyar|bin))?)\s*(?:TL|₺|lira)?/i
    )
    if (explicitMatch?.[1]) {
      return parseMoneyText(explicitMatch[1])
    }

    const fallbackMatch = text.match(
      /([\d.,\s]+(?:\s*(?:milyon|milyar|bin))?)\s*(?:TL|₺|lira|bedelle)/i
    )
    if (fallbackMatch?.[1]) {
      return parseMoneyText(fallbackMatch[1])
    }
    return 0
  }

  const extractAnalysisText = (note: string) => {
    const text = String(note || '')
    const blockMatch = text.match(/([A-Za-zÇĞİÖŞÜçğıöşü])\s*blok/i)
    const blockName = blockMatch ? `${String(blockMatch[1]).toUpperCase()} Blok` : ''
    const analysisLines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('[Analiz]'))
      .map(line =>
        line
          .replace(/^\[Analiz\]\s*/i, '')
          .replace(/\s*Kalan plan:.*$/i, '')
          .replace(/^Bartir verilen daireler:/i, 'Bartir verilen daireler:')
          .replace(/^Daireler:\s*/i, `Bartir verilen daireler: ${blockName ? `${blockName} ` : ''}`)
      )
    if (analysisLines.length > 0) return analysisLines.join(' ')

    // Geriye donuk uyumluluk: eski kayitlarda [Analiz] satiri yoksa ham nottan anlik analiz üret
    const aptMatch = text.match(/([\d\s,.-]{1,80})\s*(?:numarali|numaralı)?\s*daire\w*/i)
    const apartments = aptMatch ? (aptMatch[1].match(/\d{1,4}/g) || []) : []

    const moneyMatch =
      text.match(/([\d.,\s]+(?:\s*(?:milyon|milyar|bin))?)\s*(?:tl|₺|bedelle|lira)/i) ||
      text.match(/toplam(?:da)?[^0-9]{0,20}([\d.,\s]+(?:\s*(?:milyon|milyar|bin))?)/i)

    let amount = 0
    if (moneyMatch?.[1]) {
      let raw = moneyMatch[1].toLocaleLowerCase('tr-TR').trim()
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
      if (Number.isFinite(parsed) && parsed > 0) amount = Math.round(parsed * multiplier)
    }

    if (apartments.length === 0 && amount <= 0) return ''
    const apartmentText = `${blockName ? `${blockName} ` : ''}${apartments.join(', ')} Numaralar`.trim()
    return `Bartir verilen daireler: ${apartmentText}, Toplam satis bedeli: ${new Intl.NumberFormat(
      'tr-TR'
    ).format(amount)} TL`
  }

  const getContractStatus = (contractDate: string, workDurationDays: number, completionPercent: number) => {
    const start = new Date(`${contractDate}T00:00:00`)
    if (Number.isNaN(start.getTime()) || workDurationDays <= 0) {
      return { label: 'Sure bilgisi eksik', isDelayed: false }
    }

    const due = new Date(start)
    due.setDate(due.getDate() + workDurationDays)
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const diffMs = due.getTime() - todayStart.getTime()
    const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    const lateDays = Math.abs(remainingDays)

    if (completionPercent < 100 && remainingDays < 0) {
      return { label: `${lateDays} gun gecikme`, isDelayed: true }
    }

    if (remainingDays <= 0) {
      return { label: 'Bugun son gun', isDelayed: false }
    }

    return { label: `${remainingDays} gun kaldi`, isDelayed: false }
  }

  const totals = useMemo(() => {
    const totalNet = claims.reduce((sum, item) => sum + (item.netPayableAmount || 0), 0)
    const totalPaid = claims
      .filter(item => item.status === 'odendi')
      .reduce((sum, item) => sum + (item.netPayableAmount || 0), 0)
    return {
      subcontractorCount: subcontractors.length,
      claimCount: claims.length,
      totalNet,
      totalPaid,
    }
  }, [claims, subcontractors.length])

  if (!mounted || loading) {
    return <div className="min-h-screen p-8">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Taşeron Takibi ve Hakediş</h1>
            <div className="text-base text-gray-600">
              Sözleşme kayıtlarını yönetin, ardından taşeron bazında hakediş girin.
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 text-base bg-gray-200 hover:bg-gray-300 text-gray-800 rounded"
            >
              Ana Sayfa
            </button>
            <button
              onClick={() => router.push('/contracts')}
              className="px-5 py-2.5 text-base bg-slate-800 hover:bg-slate-900 text-white rounded"
            >
              Sözleşme Merkezi
            </button>
            <button
              onClick={() => {
                setEditingSubcontractor(null)
                setModalOpen(true)
              }}
              className="px-5 py-2.5 text-base bg-sky-700 hover:bg-sky-800 text-white rounded"
            >
              Yeni Taşeron Ekle
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Toplam Taşeron</div>
            <div className="text-3xl font-bold text-sky-700 mt-1">{totals.subcontractorCount}</div>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Toplam Hakediş Kaydı</div>
            <div className="text-3xl font-bold text-cyan-700 mt-1">{totals.claimCount}</div>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Toplam Net Ödeme</div>
            <div className="text-3xl font-bold text-teal-700 mt-1">{formatCurrency(totals.totalNet)}</div>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="text-base text-gray-600">Ödenen Net</div>
            <div className="text-3xl font-bold text-green-700 mt-1">{formatCurrency(totals.totalPaid)}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50 font-semibold text-lg text-gray-800">Taşeron Listesi</div>
          {subcontractors.length === 0 ? (
            <div className="p-5 text-gray-500">Taşeron kaydı yok</div>
          ) : (
            <div className="divide-y">
              {subcontractors.map(item => {
                const relatedClaims = claims.filter(c => c.subcontractorId === item.id)
                const totalNet = relatedClaims.reduce((sum, c) => sum + (c.netPayableAmount || 0), 0)
                const analysisText = extractAnalysisText(item.note || '')
                const totalHakedisAmount = relatedClaims.reduce((sum, c: any) => sum + Number(c.currentClaimAmount || 0), 0)
                const analysisDeduction = Math.max(
                  parseAnalysisDeductionFromText(analysisText),
                  parseAnalysisDeductionFromText(item.note || '')
                )
                const totalContractAmount = Number(item.contractAmount || 0)
                const totalPaymentIncludingBarter = analysisDeduction + totalHakedisAmount
                const remainingPayableAmount = Math.max(totalContractAmount - totalPaymentIncludingBarter, 0)
                const sortedClaims = [...relatedClaims].sort((a, b) => {
                  const aTime = new Date(a.claimDate || a.createdAt || 0).getTime()
                  const bTime = new Date(b.claimDate || b.createdAt || 0).getTime()
                  return bTime - aTime
                })
                const totalCurrentClaimAmount = relatedClaims.reduce(
                  (sum, c: any) => sum + Number(c.currentClaimAmount || 0),
                  0
                )
                const completionPercent =
                  item.contractAmount > 0
                    ? Number(((totalCurrentClaimAmount / item.contractAmount) * 100).toFixed(1))
                    : 0
                const contractStatus = getContractStatus(item.contractDate, item.workDurationDays, completionPercent)
                return (
                  <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="text-xl font-semibold text-gray-900">{item.name}</div>
                      <div className="text-base text-gray-600">{item.workScope}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        Sözleşme: {formatDate(item.contractDate)} | Süre: {item.workDurationDays} gün | Tutar:{' '}
                        {formatCurrency(totalContractAmount)}
                      </div>
                      <div className="text-sm mt-1">
                        <span className="text-gray-700">Yaklaşık Tamamlanma: %{completionPercent.toFixed(1)}</span>
                        <span className={`ml-3 font-medium ${contractStatus.isDelayed ? 'text-red-600' : 'text-green-600'}`}>
                          {contractStatus.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {item.phone ? `Tel: ${item.phone} | ` : ''}Hakediş: {relatedClaims.length} kayıt | Net:{' '}
                        {formatCurrency(totalNet)}
                      </div>
                      <div className="text-sm text-gray-700 mt-1">
                        Barter dahil taşerona yapılmış toplam ödeme: {formatCurrency(totalPaymentIncludingBarter)}
                        <span className="text-gray-500"> (Barter: {formatCurrency(analysisDeduction)} + Hakediş toplamı: {formatCurrency(totalHakedisAmount)})</span>
                      </div>
                      <div className="text-sm text-amber-700 mt-1 font-medium">
                        Kalan Ödenecek Tutar: {formatCurrency(remainingPayableAmount)}
                      </div>
                      {analysisText && <div className="text-sm text-gray-500 mt-1">{analysisText}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => router.push(`/subcontractors/${item.id}`)}
                        className="px-4 py-2 text-sm rounded bg-teal-100 text-teal-800 hover:bg-teal-200"
                      >
                        Hakedişler
                      </button>
                      <button
                        onClick={() => {
                          setEditingSubcontractor(item)
                          setModalOpen(true)
                        }}
                        className="px-4 py-2 text-sm rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDeleteSubcontractor(item)}
                        className="px-4 py-2 text-sm rounded bg-red-100 text-red-700 hover:bg-red-200"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
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
