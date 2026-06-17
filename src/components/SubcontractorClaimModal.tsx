'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClaimStatus } from '@/lib/subcontractor-claims-store'

export interface SubcontractorClaimFormData {
  workItem?: string
  claimQuantity?: number | string
  previousPaidAmount: number | string
  currentClaimAmount: number | string
  deductionAmount: number | string
  claimDate: string
  status: ClaimStatus
  note?: string
}

interface SubcontractorClaimModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SubcontractorClaimFormData) => Promise<void> | void
  initialData?: Partial<SubcontractorClaimFormData> | null
  subcontractorName: string
  subcontractorWorkScope?: string
  subcontractorContractAmount: number
  contractItems?: ContractItem[]
  defaultPreviousPaidAmount?: number
  title?: string
  submitLabel?: string
}

interface ContractItem {
  id: string
  name: string
  unit: string
  estimatedQuantity: number
  unitPrice: number
  amount: number
}

const defaultData = (): SubcontractorClaimFormData => ({
  workItem: '',
  claimQuantity: 0,
  previousPaidAmount: 0,
  currentClaimAmount: 0,
  deductionAmount: 0,
  claimDate: new Date().toISOString().slice(0, 10),
  status: 'taslak',
  note: '',
})

export default function SubcontractorClaimModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  subcontractorName,
  subcontractorWorkScope,
  subcontractorContractAmount,
  contractItems = [],
  defaultPreviousPaidAmount = 0,
  title = 'Yeni Hakediş Girişi',
  submitLabel = 'Kaydet',
}: SubcontractorClaimModalProps) {
  const [formData, setFormData] = useState<SubcontractorClaimFormData>(defaultData)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [initializedOpen, setInitializedOpen] = useState(false)

  const parseDecimalInput = (value: unknown) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0
    }

    const raw = String(value || '').trim()
    if (!raw) return 0

    const normalized = raw.includes(',')
      ? raw.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.')
      : raw.replace(/\s+/g, '').replace(/,/g, '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  const sanitizeDecimalInput = (value: string) => value.replace(/[^\d.,]/g, '')

  const formatDecimalInput = (value: unknown) => {
    const parsed = parseDecimalInput(value)
    return parsed > 0
      ? new Intl.NumberFormat('tr-TR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(parsed)
      : ''
  }

  useEffect(() => {
    if (!isOpen) {
      setInitializedOpen(false)
      return
    }
    if (initializedOpen) return

    if (initialData) {
      setFormData({
        workItem: initialData.workItem || '',
        claimQuantity: Number(initialData.claimQuantity || 0),
        previousPaidAmount: Number(initialData.previousPaidAmount || 0),
        currentClaimAmount: Number(initialData.currentClaimAmount || 0),
        deductionAmount: Number(initialData.deductionAmount || 0),
        claimDate: initialData.claimDate || new Date().toISOString().slice(0, 10),
        status: (initialData.status as ClaimStatus) || 'taslak',
        note: initialData.note || '',
      })
    } else {
      setFormData({
        ...defaultData(),
        workItem: contractItems[0]?.name || subcontractorWorkScope || '',
        previousPaidAmount: Math.max(Math.round(defaultPreviousPaidAmount || 0), 0),
      })
    }
    setInitializedOpen(true)
  }, [isOpen, initializedOpen, initialData, defaultPreviousPaidAmount, contractItems, subcontractorWorkScope])

  const selectedContractItem = useMemo(
    () => contractItems.find(item => item.name === formData.workItem) || null,
    [contractItems, formData.workItem]
  )

  const progressPercent = useMemo(() => {
    if (!subcontractorContractAmount || subcontractorContractAmount <= 0) return 0
    const progressAmount = parseDecimalInput(formData.previousPaidAmount) + parseDecimalInput(formData.currentClaimAmount)
    const ratio = (progressAmount / subcontractorContractAmount) * 100
    return Math.min(Math.max(Number(ratio.toFixed(2)), 0), 100)
  }, [formData.previousPaidAmount, formData.currentClaimAmount, subcontractorContractAmount])

  const completedAmount = useMemo(
    () => Math.round((Number(subcontractorContractAmount || 0) * Number(progressPercent || 0)) / 100),
    [subcontractorContractAmount, progressPercent]
  )

  const netPayableAmount = useMemo(
    () => Math.max(parseDecimalInput(formData.currentClaimAmount) - parseDecimalInput(formData.deductionAmount), 0),
    [formData.currentClaimAmount, formData.deductionAmount]
  )

  if (!isOpen) return null

  const handleClose = () => {
    if (saving) return
    setError('')
    setFormData(defaultData())
    onClose()
  }

  const handleSubmit = async () => {
    setError('')
    if (!subcontractorContractAmount || subcontractorContractAmount <= 0) {
      setError('Taşeron sözleşme tutarı bulunamadı.')
      return
    }
    const currentClaimAmount = parseDecimalInput(formData.currentClaimAmount)
    if (!currentClaimAmount || currentClaimAmount <= 0) {
      setError('Bu hakediş tutarı 0 dan büyük olmalıdır.')
      return
    }
    if (!formData.claimDate) {
      setError('Tarih zorunludur.')
      return
    }

    setSaving(true)
    try {
      await onSave({
        workItem: (formData.workItem || subcontractorWorkScope || subcontractorName).trim(),
        claimQuantity: parseDecimalInput(formData.claimQuantity),
        previousPaidAmount: Number(parseDecimalInput(formData.previousPaidAmount).toFixed(2)),
        currentClaimAmount: Number(currentClaimAmount.toFixed(2)),
        deductionAmount: Number(parseDecimalInput(formData.deductionAmount).toFixed(2)),
        claimDate: formData.claimDate,
        status: formData.status,
        note: [
          selectedContractItem && parseDecimalInput(formData.claimQuantity)
            ? `[Sözleşme Kalemi] ${selectedContractItem.name} | Miktar: ${parseDecimalInput(formData.claimQuantity)} ${selectedContractItem.unit} | Birim Fiyat: ${formatCurrency(selectedContractItem.unitPrice)}`
            : '',
          (formData.note || '').trim(),
        ]
          .filter(Boolean)
          .join('\n'),
      })
      setFormData(defaultData())
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Hakediş kaydedilemedi.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-teal-700 to-cyan-700 text-white">
          <h3 className="text-lg font-bold">{title}</h3>
          <div className="text-xs mt-1 opacity-90">Taşeron: {subcontractorName}</div>
          {subcontractorWorkScope ? (
            <div className="text-xs mt-1 opacity-90">İş Kapsamı: {subcontractorWorkScope}</div>
          ) : null}
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Sözleşme Tutarı (TL)</label>
              <input
                type="number"
                value={subcontractorContractAmount || 0}
                className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-700"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">İlerleme (%)</label>
              <input
                type="number"
                value={progressPercent}
                className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-700"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Tarih</label>
              <input
                type="date"
                value={formData.claimDate}
                onChange={e => setFormData(prev => ({ ...prev, claimDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded border border-gray-200 bg-gray-50 p-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Sözleşme İş Kalemi</label>
              <select
                value={formData.workItem || ''}
                onChange={e => {
                  const selectedName = e.target.value
                  const selected = contractItems.find(item => item.name === selectedName)
                  const nextQuantity = parseDecimalInput(formData.claimQuantity)
                  setFormData(prev => ({
                    ...prev,
                    workItem: selectedName,
                    currentClaimAmount: selected && nextQuantity > 0 ? Number((nextQuantity * selected.unitPrice).toFixed(2)) : prev.currentClaimAmount,
                  }))
                }}
                className="w-full px-3 py-2 border rounded bg-white"
              >
                {contractItems.length === 0 ? (
                  <option value={subcontractorWorkScope || subcontractorName}>
                    {subcontractorWorkScope || subcontractorName}
                  </option>
                ) : (
                  contractItems.map(item => (
                    <option key={item.id} value={item.name}>
                      {item.name} - {item.estimatedQuantity} {item.unit} x {formatCurrency(item.unitPrice)}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Bu Hakediş Miktarı</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.claimQuantity ?? ''}
                onChange={e => {
                  const rawQuantity = sanitizeDecimalInput(e.target.value)
                  const quantity = parseDecimalInput(rawQuantity)
                  setFormData(prev => ({
                    ...prev,
                    claimQuantity: rawQuantity,
                    currentClaimAmount: selectedContractItem ? Number((quantity * selectedContractItem.unitPrice).toFixed(2)) : prev.currentClaimAmount,
                  }))
                }}
                onBlur={() => setFormData(prev => ({ ...prev, claimQuantity: formatDecimalInput(prev.claimQuantity) }))}
                className="w-full px-3 py-2 border rounded bg-white"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Birim / Birim Fiyat</label>
              <div className="rounded border bg-white px-3 py-2 text-sm text-gray-800">
                {selectedContractItem
                  ? `${selectedContractItem.unit} / ${formatCurrency(selectedContractItem.unitPrice)}`
                  : '-'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Önceki Ödeme (TL)</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.previousPaidAmount ?? ''}
                onChange={e => setFormData(prev => ({ ...prev, previousPaidAmount: sanitizeDecimalInput(e.target.value) }))}
                onBlur={() => setFormData(prev => ({ ...prev, previousPaidAmount: formatDecimalInput(prev.previousPaidAmount) }))}
                className="w-full px-3 py-2 border rounded"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Bu Hakediş (TL)</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.currentClaimAmount ?? ''}
                onChange={e => setFormData(prev => ({ ...prev, currentClaimAmount: sanitizeDecimalInput(e.target.value) }))}
                onBlur={() => setFormData(prev => ({ ...prev, currentClaimAmount: formatDecimalInput(prev.currentClaimAmount) }))}
                className="w-full px-3 py-2 border rounded"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Kesinti (TL)</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.deductionAmount ?? ''}
                onChange={e => setFormData(prev => ({ ...prev, deductionAmount: sanitizeDecimalInput(e.target.value) }))}
                onBlur={() => setFormData(prev => ({ ...prev, deductionAmount: formatDecimalInput(prev.deductionAmount) }))}
                className="w-full px-3 py-2 border rounded"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Durum</label>
              <select
                value={formData.status}
                onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as ClaimStatus }))}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="taslak">Taslak</option>
                <option value="onaylandi">Onaylandı</option>
                <option value="odendi">Ödendi</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded bg-cyan-50 border border-cyan-200 p-3">
              <div className="text-xs text-cyan-700">Gerçekleşen Tutar (İlerleme Bazlı)</div>
              <div className="text-lg font-bold text-cyan-900">{formatCurrency(completedAmount)}</div>
            </div>
            <div className="rounded bg-teal-50 border border-teal-200 p-3">
              <div className="text-xs text-teal-700">Net Ödeme (Bu Hakediş - Kesinti)</div>
              <div className="text-lg font-bold text-teal-900">{formatCurrency(netPayableAmount)}</div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Açıklama (Opsiyonel)</label>
            <textarea
              value={formData.note}
              onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
              className="w-full px-3 py-2 border rounded min-h-24"
              placeholder="Kısa not"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded bg-teal-700 hover:bg-teal-800 text-white"
          >
            {saving ? 'Kaydediliyor...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
