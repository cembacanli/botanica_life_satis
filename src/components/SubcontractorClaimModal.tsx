'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClaimStatus } from '@/lib/subcontractor-claims-store'

export interface SubcontractorClaimFormData {
  previousPaidAmount: number
  currentClaimAmount: number
  deductionAmount: number
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
  defaultPreviousPaidAmount?: number
  title?: string
  submitLabel?: string
}

const defaultData = (): SubcontractorClaimFormData => ({
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
  defaultPreviousPaidAmount = 0,
  title = 'Yeni Hakedis Girisi',
  submitLabel = 'Kaydet',
}: SubcontractorClaimModalProps) {
  const [formData, setFormData] = useState<SubcontractorClaimFormData>(defaultData)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (initialData) {
      setFormData({
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
        previousPaidAmount: Math.max(Math.round(defaultPreviousPaidAmount || 0), 0),
      })
    }
  }, [isOpen, initialData, defaultPreviousPaidAmount])

  const progressPercent = useMemo(() => {
    if (!subcontractorContractAmount || subcontractorContractAmount <= 0) return 0
    const progressAmount = Number(formData.previousPaidAmount || 0) + Number(formData.currentClaimAmount || 0)
    const ratio = (progressAmount / subcontractorContractAmount) * 100
    return Math.min(Math.max(Number(ratio.toFixed(2)), 0), 100)
  }, [formData.previousPaidAmount, formData.currentClaimAmount, subcontractorContractAmount])

  const completedAmount = useMemo(
    () => Math.round((Number(subcontractorContractAmount || 0) * Number(progressPercent || 0)) / 100),
    [subcontractorContractAmount, progressPercent]
  )

  const netPayableAmount = useMemo(
    () => Math.max(Number(formData.currentClaimAmount || 0) - Number(formData.deductionAmount || 0), 0),
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
      setError('Taseron sozlesme tutari bulunamadi.')
      return
    }
    if (!formData.currentClaimAmount || formData.currentClaimAmount <= 0) {
      setError('Bu hakedis tutari 0 dan buyuk olmali.')
      return
    }
    if (!formData.claimDate) {
      setError('Tarih zorunludur.')
      return
    }

    setSaving(true)
    try {
      await onSave({
        previousPaidAmount: Math.max(Math.round(formData.previousPaidAmount || 0), 0),
        currentClaimAmount: Math.round(formData.currentClaimAmount || 0),
        deductionAmount: Math.max(Math.round(formData.deductionAmount || 0), 0),
        claimDate: formData.claimDate,
        status: formData.status,
        note: (formData.note || '').trim(),
      })
      setFormData(defaultData())
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Hakedis kaydedilemedi.'
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
          <div className="text-xs mt-1 opacity-90">Taseron: {subcontractorName}</div>
          {subcontractorWorkScope && <div className="text-xs mt-1 opacity-90">Is Kapsami: {subcontractorWorkScope}</div>}
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Sozlesme Tutari (TL)</label>
              <input
                type="number"
                value={subcontractorContractAmount || 0}
                className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-700"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Ilerleme (%)</label>
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Onceki Odeme (TL)</label>
              <input
                type="number"
                min="0"
                value={formData.previousPaidAmount || ''}
                onChange={e => setFormData(prev => ({ ...prev, previousPaidAmount: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-3 py-2 border rounded"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Bu Hakedis (TL)</label>
              <input
                type="number"
                min="0"
                value={formData.currentClaimAmount || ''}
                onChange={e => setFormData(prev => ({ ...prev, currentClaimAmount: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-3 py-2 border rounded"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Kesinti (TL)</label>
              <input
                type="number"
                min="0"
                value={formData.deductionAmount || ''}
                onChange={e => setFormData(prev => ({ ...prev, deductionAmount: parseInt(e.target.value, 10) || 0 }))}
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
                <option value="onaylandi">Onaylandi</option>
                <option value="odendi">Odendi</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded bg-cyan-50 border border-cyan-200 p-3">
              <div className="text-xs text-cyan-700">Gerceklesen Tutar (Ilerleme Bazli)</div>
              <div className="text-lg font-bold text-cyan-900">{formatCurrency(completedAmount)}</div>
            </div>
            <div className="rounded bg-teal-50 border border-teal-200 p-3">
              <div className="text-xs text-teal-700">Net Odeme (Bu Hakedis - Kesinti)</div>
              <div className="text-lg font-bold text-teal-900">{formatCurrency(netPayableAmount)}</div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Aciklama (Opsiyonel)</label>
            <textarea
              value={formData.note}
              onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
              className="w-full px-3 py-2 border rounded min-h-24"
              placeholder="Kisa not"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            Iptal
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
