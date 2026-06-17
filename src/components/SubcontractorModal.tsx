'use client'

import { useEffect, useState } from 'react'

export interface SubcontractorFormData {
  name: string
  workScope: string
  contractDate: string
  workDurationDays: number
  contractAmount: number
  contractItems?: ContractItem[]
  phone?: string
  note?: string
}

export interface ContractItem {
  id: string
  name: string
  unit: string
  estimatedQuantity: number
  unitPrice: number
  amount: number
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
  contractItems: [],
  phone: '',
  note: '',
})

const emptyContractItem = (): ContractItem => ({
  id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: '',
  unit: '',
  estimatedQuantity: 0,
  unitPrice: 0,
  amount: 0,
})

export default function SubcontractorModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  title = 'Yeni Taşeron Sözleşmesi',
  submitLabel = 'Kaydet',
}: SubcontractorModalProps) {
  const [formData, setFormData] = useState<SubcontractorFormData>(defaultData)
  const [contractAmountInput, setContractAmountInput] = useState('')
  const [contractItems, setContractItems] = useState<ContractItem[]>([emptyContractItem()])
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

  const normalizeItems = (items: ContractItem[]) =>
    items
      .map(item => {
        const estimatedQuantity = Number(item.estimatedQuantity || 0)
        const unitPrice = Number(item.unitPrice || 0)
        const amount = Number((estimatedQuantity * unitPrice).toFixed(2))
        return {
          ...item,
          name: item.name.trim(),
          unit: item.unit.trim(),
          estimatedQuantity,
          unitPrice,
          amount,
        }
      })
      .filter(item => item.name && item.unit && item.estimatedQuantity > 0 && item.unitPrice > 0)

  const contractItemsTotal = contractItems.reduce((sum, item) => {
    return sum + Number((Number(item.estimatedQuantity || 0) * Number(item.unitPrice || 0)).toFixed(2))
  }, 0)

  const updateContractItem = (id: string, patch: Partial<ContractItem>) => {
    setContractItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        const next = { ...item, ...patch }
        const amount = Number((Number(next.estimatedQuantity || 0) * Number(next.unitPrice || 0)).toFixed(2))
        return { ...next, amount }
      })
    )
  }

  const removeContractItem = (id: string) => {
    setContractItems(prev => {
      const next = prev.filter(item => item.id !== id)
      return next.length > 0 ? next : [emptyContractItem()]
    })
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
        contractItems: Array.isArray(initialData.contractItems) ? initialData.contractItems : [],
        phone: initialData.phone || '',
        note: initialData.note || '',
      })
      const initialItems = Array.isArray(initialData.contractItems) && initialData.contractItems.length > 0
        ? initialData.contractItems
        : [emptyContractItem()]
      setContractItems(initialItems)
      setContractAmountInput(
        Number(initialData.contractAmount || 0) > 0 ? formatAmountTr(Number(initialData.contractAmount || 0)) : ''
      )
    } else {
      setFormData(defaultData())
      setContractAmountInput('')
      setContractItems([emptyContractItem()])
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
      setError('Taşeron adı zorunludur.')
      return
    }
    if (!formData.workScope.trim()) {
      setError('İş kapsamı zorunludur.')
      return
    }
    if (!formData.contractDate) {
      setError('Sözleşme tarihi zorunludur.')
      return
    }
    if (!formData.workDurationDays || formData.workDurationDays <= 0) {
      setError('İş süresi 0 dan büyük olmalıdır.')
      return
    }
    const finalContractItems = normalizeItems(contractItems)
    const finalContractAmount = finalContractItems.length > 0
      ? finalContractItems.reduce((sum, item) => sum + item.amount, 0)
      : Number(formData.contractAmount || 0)

    if (!finalContractAmount || finalContractAmount <= 0) {
      setError('Sözleşme tutarı 0 dan büyük olmalıdır.')
      return
    }

    setSaving(true)
    try {
      await onSave({
        name: formData.name.trim(),
        workScope: formData.workScope.trim(),
        contractDate: formData.contractDate,
        workDurationDays: Math.round(formData.workDurationDays || 0),
        contractAmount: Number(finalContractAmount.toFixed(2)),
        contractItems: finalContractItems,
        phone: (formData.phone || '').trim(),
        note: (formData.note || '').trim(),
      })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Taşeron sözleşmesi kaydedilemedi.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-sky-700 to-blue-700 text-white">
          <h3 className="text-lg font-bold">{title}</h3>
        </div>

        <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-700 mb-1">Taşeron Adı</label>
            <input
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              placeholder="Örn: ABC Kalıp İşçilik"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">İş Kapsamı</label>
            <input
              value={formData.workScope}
              onChange={e => setFormData(prev => ({ ...prev, workScope: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              placeholder="Örn: kaba inşaat, mekanik, elektrik"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Sözleşme Tarihi</label>
              <input
                type="date"
                value={formData.contractDate}
                onChange={e => setFormData(prev => ({ ...prev, contractDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">İşin Süresi (Gün)</label>
              <input
                type="number"
                min="1"
                value={formData.workDurationDays || ''}
                onChange={e => setFormData(prev => ({ ...prev, workDurationDays: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-3 py-2 border rounded"
                placeholder="Örn: 120"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Sözleşme Tutarı (TL)</label>
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

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Sözleşme İş Kalemleri</div>
                <div className="text-xs text-gray-500">Örn: Kazı, m3, takribi miktar, birim fiyat ve toplam tutar.</div>
              </div>
              <button
                type="button"
                onClick={() => setContractItems(prev => [...prev, emptyContractItem()])}
                className="rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800"
              >
                Kalem Ekle
              </button>
            </div>

            <div className="space-y-3">
              {contractItems.map(item => {
                const amount = Number(item.estimatedQuantity || 0) * Number(item.unitPrice || 0)
                return (
                  <div key={item.id} className="grid grid-cols-1 gap-2 rounded border border-gray-200 bg-white p-3 md:grid-cols-[minmax(160px,1.4fr)_90px_120px_120px_120px_44px]">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">İş Kalemi</label>
                      <input
                        value={item.name}
                        onChange={e => updateContractItem(item.id, { name: e.target.value })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="Kazı"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Birim</label>
                      <input
                        value={item.unit}
                        onChange={e => updateContractItem(item.id, { unit: e.target.value })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="m3"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Takribi Miktar</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.estimatedQuantity || ''}
                        onChange={e => updateContractItem(item.id, { estimatedQuantity: Number(e.target.value || 0) })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Birim Fiyat</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice || ''}
                        onChange={e => updateContractItem(item.id, { unitPrice: Number(e.target.value || 0) })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Tutar</label>
                      <div className="rounded border bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900">
                        {formatAmountTr(amount)}
                      </div>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeContractItem(item.id)}
                        className="h-10 w-10 rounded bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100"
                        title="Kalemi sil"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 flex justify-end text-sm">
              <div className="rounded bg-gray-900 px-4 py-2 font-semibold text-white">
                İş kalemleri toplamı: {formatAmountTr(contractItemsTotal)} TL
              </div>
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
              Açıklama
            </label>
            <textarea
              value={formData.note}
              onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
              className="w-full px-3 py-2 border rounded min-h-24"
              placeholder="Barter varsa blok, daire numaraları ve toplam satış bedelini burada belirtin."
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
            className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-800 text-white"
          >
            {saving ? 'Kaydediliyor...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
