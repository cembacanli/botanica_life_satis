'use client'

import { useEffect, useState } from 'react'

export interface SubcontractorFormData {
  name: string
  workScope: string
  contractDate: string
  workDurationDays: number
  contractAmount: number
  phone?: string
  note?: string
}

interface SubcontractorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SubcontractorFormData) => Promise<void> | void
  initialData?: Partial<SubcontractorFormData> | null
  title?: string
  submitLabel?: string
}

const defaultData = (): SubcontractorFormData => ({
  name: '',
  workScope: '',
  contractDate: new Date().toISOString().slice(0, 10),
  workDurationDays: 0,
  contractAmount: 0,
  phone: '',
  note: '',
})

export default function SubcontractorModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  title = 'Yeni Taseron Ekle',
  submitLabel = 'Kaydet',
}: SubcontractorModalProps) {
  const [formData, setFormData] = useState<SubcontractorFormData>(defaultData)
  const [contractAmountInput, setContractAmountInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const formatAmountTr = (amount: number) =>
    new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0))

  const parseAmountInput = (input: string) => {
    const cleaned = String(input || '')
      .replace(/\s+/g, '')
      .replace(/[^\d,.-]/g, '')

    if (!cleaned) return 0

    const normalized = cleaned.includes(',')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/\./g, '')

    const parsed = Number(normalized)
    if (!Number.isFinite(parsed) || parsed < 0) return 0
    return parsed
  }

  const sanitizeAmountTyping = (input: string) => {
    const cleaned = String(input || '').replace(/[^\d,.\s]/g, '')
    const firstComma = cleaned.indexOf(',')
    if (firstComma < 0) return cleaned
    return `${cleaned.slice(0, firstComma + 1)}${cleaned.slice(firstComma + 1).replace(/,/g, '')}`
  }

  useEffect(() => {
    if (!isOpen) return
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        workScope: initialData.workScope || '',
        contractDate: initialData.contractDate || new Date().toISOString().slice(0, 10),
        workDurationDays: Number(initialData.workDurationDays || 0),
        contractAmount: Number(initialData.contractAmount || 0),
        phone: initialData.phone || '',
        note: initialData.note || '',
      })
      setContractAmountInput(
        Number(initialData.contractAmount || 0) > 0 ? formatAmountTr(Number(initialData.contractAmount || 0)) : ''
      )
    } else {
      setFormData(defaultData())
      setContractAmountInput('')
    }
  }, [isOpen, initialData])

  if (!isOpen) return null

  const handleClose = () => {
    if (saving) return
    setError('')
    setFormData(defaultData())
    onClose()
  }

  const handleSubmit = async () => {
    setError('')
    if (!formData.name.trim()) {
      setError('Taseron adi zorunludur.')
      return
    }
    if (!formData.workScope.trim()) {
      setError('Is kapsami zorunludur.')
      return
    }
    if (!formData.contractDate) {
      setError('Sozlesme tarihi zorunludur.')
      return
    }
    if (!formData.workDurationDays || formData.workDurationDays <= 0) {
      setError('Isin suresi 0 dan buyuk olmali.')
      return
    }
    if (!formData.contractAmount || formData.contractAmount <= 0) {
      setError('Sozlesme tutari 0 dan buyuk olmali.')
      return
    }

    setSaving(true)
    try {
      await onSave({
        name: formData.name.trim(),
        workScope: formData.workScope.trim(),
        contractDate: formData.contractDate,
        workDurationDays: Math.round(formData.workDurationDays || 0),
        contractAmount: Math.round(formData.contractAmount || 0),
        phone: (formData.phone || '').trim(),
        note: (formData.note || '').trim(),
      })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Taseron kaydedilemedi.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-sky-700 to-blue-700 text-white">
          <h3 className="text-lg font-bold">{title}</h3>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-700 mb-1">Taseron Adi</label>
            <input
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              placeholder="Orn: ABC Kalip Iscilik"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Is Kapsami</label>
            <input
              value={formData.workScope}
              onChange={e => setFormData(prev => ({ ...prev, workScope: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              placeholder="Orn: Kaba insaat, mekanik, elektrik"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Sozlesme Tarihi</label>
              <input
                type="date"
                value={formData.contractDate}
                onChange={e => setFormData(prev => ({ ...prev, contractDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Isin Suresi (Gun)</label>
              <input
                type="number"
                min="1"
                value={formData.workDurationDays || ''}
                onChange={e => setFormData(prev => ({ ...prev, workDurationDays: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-3 py-2 border rounded"
                placeholder="Orn: 120"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Sozlesme Tutari (TL)</label>
              <input
                type="text"
                inputMode="decimal"
                value={contractAmountInput}
                onFocus={() => {
                  if (!contractAmountInput.trim() && formData.contractAmount > 0) {
                    setContractAmountInput(String(formData.contractAmount).replace('.', ','))
                  }
                }}
                onChange={e => {
                  const raw = sanitizeAmountTyping(e.target.value)
                  setContractAmountInput(raw)
                  if (!raw.trim()) {
                    setFormData(prev => ({ ...prev, contractAmount: 0 }))
                    return
                  }
                  const parsed = parseAmountInput(raw)
                  setFormData(prev => ({ ...prev, contractAmount: parsed }))
                }}
                onBlur={() => {
                  const parsed = parseAmountInput(contractAmountInput)
                  setFormData(prev => ({ ...prev, contractAmount: parsed }))
                  setContractAmountInput(parsed > 0 ? formatAmountTr(parsed) : '')
                }}
                className="w-full px-3 py-2 border rounded"
                placeholder="0,00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Telefon (Opsiyonel)</label>
            <input
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              placeholder="05xx xxx xx xx"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Aciklama (Opsiyonel) - Bartir Var ise Blok, Daire numarasi ve Toplam Daire Satis Tutarini giriniz
            </label>
            <textarea
              value={formData.note}
              onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
              className="w-full px-3 py-2 border rounded min-h-24"
              placeholder="Orn: D Blok 118, 119, 120 numarali daireler, toplam satis bedeli 8.000.000 TL"
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
            className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-800 text-white"
          >
            {saving ? 'Kaydediliyor...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
