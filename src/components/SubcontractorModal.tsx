'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface SubcontractorFormData {
  name: string
  workScope: string
  contractDate: string
  workStartDate: string
  workDurationDays: number
  contractAmount: number
  contractItems?: ContractItem[]
  paymentSchedule?: PaymentScheduleItem[]
  barterItems?: BarterItem[]
  phone?: string
  note?: string
  contractFileUrl?: string
  contractFileName?: string
}

export interface ContractItem {
  id: string
  name: string
  unit: string
  estimatedQuantity: number | string
  unitPrice: number | string
  amount: number
}

export interface PaymentScheduleItem {
  id: string
  paymentDate: string
  amount: number | string
  note?: string
}

export interface BarterItem {
  id: string
  block: string
  apartmentNo: string
  amount: number | string
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
  workStartDate: new Date().toISOString().slice(0, 10),
  workDurationDays: 0,
  contractAmount: 0,
  contractItems: [],
  paymentSchedule: [],
  barterItems: [],
  phone: '',
  note: '',
  contractFileUrl: '',
  contractFileName: '',
})

const emptyContractItem = (): ContractItem => ({
  id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: '',
  unit: '',
  estimatedQuantity: 0,
  unitPrice: 0,
  amount: 0,
})

const emptyPaymentScheduleItem = (): PaymentScheduleItem => ({
  id: `payment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  paymentDate: new Date().toISOString().slice(0, 10),
  amount: 0,
  note: '',
})

const emptyBarterItem = (): BarterItem => ({
  id: `barter-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  block: '',
  apartmentNo: '',
  amount: 0,
  note: '',
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
  const [contractItems, setContractItems] = useState<ContractItem[]>([emptyContractItem()])
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>([emptyPaymentScheduleItem()])
  const [barterItems, setBarterItems] = useState<BarterItem[]>([emptyBarterItem()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [deleteCurrentFile, setDeleteCurrentFile] = useState(false)

  const formatAmountTr = (amount: number) =>
    new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0))

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

  const sanitizeDecimalInput = (value: string) => {
    return value.replace(/[^\d.,]/g, '')
  }

  const formatDecimalInput = (value: unknown) => {
    const parsed = parseDecimalInput(value)
    return parsed > 0
      ? new Intl.NumberFormat('tr-TR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(parsed)
      : ''
  }

  const normalizeDateInput = (value: string) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return value

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return value
    if (month < 1 || month > 12 || day < 1) return value

    const lastDayOfMonth = new Date(year, month, 0).getDate()
    const safeDay = Math.min(day, lastDayOfMonth)
    return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
  }

  const normalizeItems = (items: ContractItem[]) =>
    items
      .map(item => {
        const estimatedQuantity = parseDecimalInput(item.estimatedQuantity)
        const unitPrice = parseDecimalInput(item.unitPrice)
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

  const normalizePaymentSchedule = (items: PaymentScheduleItem[]) =>
    items
      .map(item => ({
        ...item,
        paymentDate: String(item.paymentDate || '').trim(),
        amount: Number(parseDecimalInput(item.amount).toFixed(2)),
        note: String(item.note || '').trim(),
      }))
      .filter(item => item.paymentDate && item.amount > 0)

  const normalizeBarterItems = (items: BarterItem[]) =>
    items
      .map(item => ({
        ...item,
        block: String(item.block || '').trim().toUpperCase(),
        apartmentNo: String(item.apartmentNo || '').trim(),
        amount: Number(parseDecimalInput(item.amount).toFixed(2)),
        note: String(item.note || '').trim(),
      }))
      .filter(item => item.block && item.apartmentNo && item.amount > 0)

  const normalizedContractItems = useMemo(() => normalizeItems(contractItems), [contractItems])
  const normalizedPaymentSchedule = useMemo(() => normalizePaymentSchedule(paymentSchedule), [paymentSchedule])
  const normalizedBarterItems = useMemo(() => normalizeBarterItems(barterItems), [barterItems])

  const contractItemsTotal = normalizedContractItems.reduce((sum, item) => sum + item.amount, 0)
  const paymentScheduleTotal = normalizedPaymentSchedule.reduce((sum, item) => sum + item.amount, 0)
  const barterItemsTotal = normalizedBarterItems.reduce((sum, item) => sum + item.amount, 0)

  const updateContractItem = (id: string, patch: Partial<ContractItem>) => {
    setContractItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        const next = { ...item, ...patch }
        const amount = Number((parseDecimalInput(next.estimatedQuantity) * parseDecimalInput(next.unitPrice)).toFixed(2))
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

  const updatePaymentScheduleItem = (id: string, patch: Partial<PaymentScheduleItem>) => {
    setPaymentSchedule(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removePaymentScheduleItem = (id: string) => {
    setPaymentSchedule(prev => {
      const next = prev.filter(item => item.id !== id)
      return next.length > 0 ? next : [emptyPaymentScheduleItem()]
    })
  }

  const updateBarterItem = (id: string, patch: Partial<BarterItem>) => {
    setBarterItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeBarterItem = (id: string) => {
    setBarterItems(prev => {
      const next = prev.filter(item => item.id !== id)
      return next.length > 0 ? next : [emptyBarterItem()]
    })
  }

  useEffect(() => {
    if (!isOpen) return
    setSelectedFile(null)
    setDeleteCurrentFile(false)
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        workScope: initialData.workScope || '',
        contractDate: initialData.contractDate || new Date().toISOString().slice(0, 10),
        workStartDate: initialData.workStartDate || initialData.contractDate || new Date().toISOString().slice(0, 10),
        workDurationDays: Number(initialData.workDurationDays || 0),
        contractAmount: Number(initialData.contractAmount || 0),
        contractItems: Array.isArray(initialData.contractItems) ? initialData.contractItems : [],
        paymentSchedule: Array.isArray(initialData.paymentSchedule) ? initialData.paymentSchedule : [],
        barterItems: Array.isArray(initialData.barterItems) ? initialData.barterItems : [],
        phone: initialData.phone || '',
        note: initialData.note || '',
        contractFileUrl: initialData.contractFileUrl || '',
        contractFileName: initialData.contractFileName || '',
      })
      const initialItems = Array.isArray(initialData.contractItems) && initialData.contractItems.length > 0
        ? initialData.contractItems
        : [emptyContractItem()]
      setContractItems(initialItems)
      setPaymentSchedule(
        Array.isArray(initialData.paymentSchedule) && initialData.paymentSchedule.length > 0
          ? initialData.paymentSchedule
          : [emptyPaymentScheduleItem()]
      )
      setBarterItems(
        Array.isArray(initialData.barterItems) && initialData.barterItems.length > 0
          ? initialData.barterItems
          : [emptyBarterItem()]
      )
    } else {
      setFormData(defaultData())
      setContractItems([emptyContractItem()])
      setPaymentSchedule([emptyPaymentScheduleItem()])
      setBarterItems([emptyBarterItem()])
    }
  }, [isOpen, initialData])

  if (!isOpen) return null

  const handleClose = () => {
    if (saving) return
    setError('')
    setFormData(defaultData())
    setContractItems([emptyContractItem()])
    setPaymentSchedule([emptyPaymentScheduleItem()])
    setBarterItems([emptyBarterItem()])
    setSelectedFile(null)
    setDeleteCurrentFile(false)
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
    if (!formData.workStartDate) {
      setError('İşe başlama tarihi zorunludur.')
      return
    }
    if (!formData.workDurationDays || formData.workDurationDays <= 0) {
      setError('İş süresi 0 dan büyük olmalıdır.')
      return
    }
    const finalContractItems = normalizedContractItems
    const finalContractAmount = contractItemsTotal
    const finalPaymentSchedule = normalizedPaymentSchedule
    const finalBarterItems = normalizedBarterItems

    if (!finalContractAmount || finalContractAmount <= 0) {
      setError('Sözleşme tutarı için iş kalemi, birim, takribi miktar ve birim fiyat alanlarını doldurun.')
      return
    }

    setSaving(true)
    try {
      let finalFileUrl = formData.contractFileUrl || ''
      let finalFileName = formData.contractFileName || ''

      if (deleteCurrentFile && !selectedFile) {
        finalFileUrl = ''
        finalFileName = ''
      }

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const uniqName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`
        const filePath = `subcontractors/${uniqName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('subcontractor-documents')
          .upload(filePath, selectedFile)

        if (uploadError) {
          throw new Error(`Dosya yüklenirken hata oluştu: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage
          .from('subcontractor-documents')
          .getPublicUrl(filePath)

        finalFileUrl = urlData.publicUrl
        finalFileName = selectedFile.name
      }

      await onSave({
        name: formData.name.trim(),
        workScope: formData.workScope.trim(),
        contractDate: formData.contractDate,
        workStartDate: formData.workStartDate,
        workDurationDays: Math.round(formData.workDurationDays || 0),
        contractAmount: Number(finalContractAmount.toFixed(2)),
        contractItems: finalContractItems,
        paymentSchedule: finalPaymentSchedule,
        barterItems: finalBarterItems,
        phone: (formData.phone || '').trim(),
        note: (formData.note || '').trim(),
        contractFileUrl: finalFileUrl,
        contractFileName: finalFileName,
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
              <label className="block text-sm text-gray-700 mb-1">İşe Başlama Tarihi</label>
              <input
                type="date"
                value={formData.workStartDate}
                onChange={e => setFormData(prev => ({ ...prev, workStartDate: e.target.value }))}
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
              <div className="w-full rounded border bg-gray-100 px-3 py-2 font-semibold text-gray-900">
                {formatAmountTr(contractItemsTotal)}
              </div>
              <div className="mt-1 text-xs text-gray-500">İş kalemleri toplamından otomatik hesaplanır.</div>
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
                const amount = parseDecimalInput(item.estimatedQuantity) * parseDecimalInput(item.unitPrice)
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
                        type="text"
                        inputMode="decimal"
                        value={item.estimatedQuantity || ''}
                        onChange={e => updateContractItem(item.id, { estimatedQuantity: sanitizeDecimalInput(e.target.value) })}
                        onBlur={() => updateContractItem(item.id, { estimatedQuantity: formatDecimalInput(item.estimatedQuantity) })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Birim Fiyat</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.unitPrice || ''}
                        onChange={e => updateContractItem(item.id, { unitPrice: sanitizeDecimalInput(e.target.value) })}
                        onBlur={() => updateContractItem(item.id, { unitPrice: formatDecimalInput(item.unitPrice) })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="0,00"
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

          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Ödeme Planı</div>
                  <div className="text-xs text-gray-600">Taksit tarihi, tutarı ve kısa açıklamasını girin.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentSchedule(prev => [...prev, emptyPaymentScheduleItem()])}
                  className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                >
                  Taksit Ekle
                </button>
              </div>

              <div className="space-y-3">
                {paymentSchedule.map(item => (
                  <div key={item.id} className="grid grid-cols-1 gap-3 rounded border border-emerald-100 bg-white p-3 md:grid-cols-[180px_180px_minmax(260px,1fr)_52px]">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Ödeme Tarihi</label>
                      <input
                        type="date"
                        value={item.paymentDate}
                        onChange={e => updatePaymentScheduleItem(item.id, { paymentDate: normalizeDateInput(e.target.value) })}
                        onBlur={() => updatePaymentScheduleItem(item.id, { paymentDate: normalizeDateInput(item.paymentDate) })}
                        className="w-full rounded border px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Tutar</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.amount || ''}
                        onChange={e => updatePaymentScheduleItem(item.id, { amount: sanitizeDecimalInput(e.target.value) })}
                        onBlur={() => updatePaymentScheduleItem(item.id, { amount: formatDecimalInput(item.amount) })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Açıklama</label>
                      <input
                        value={item.note || ''}
                        onChange={e => updatePaymentScheduleItem(item.id, { note: e.target.value })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="Örn: 1. taksit"
                      />
                    </div>
                    <div className="flex items-end justify-end md:justify-start">
                      <button
                        type="button"
                        onClick={() => removePaymentScheduleItem(item.id)}
                        className="h-10 w-10 rounded bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-right text-sm font-semibold text-emerald-900">
                Ödeme planı toplamı: {formatAmountTr(paymentScheduleTotal)} TL
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Barter Daireleri</div>
                  <div className="text-xs text-gray-600">Daire no ve tutar girilince dashboard satış kaydı oluşur.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setBarterItems(prev => [...prev, emptyBarterItem()])}
                  className="rounded bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
                >
                  Daire Ekle
                </button>
              </div>

              <div className="space-y-3">
                {barterItems.map(item => (
                  <div key={item.id} className="grid grid-cols-1 gap-3 rounded border border-amber-100 bg-white p-3 md:grid-cols-[110px_140px_180px_minmax(260px,1fr)_52px]">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Blok</label>
                      <select
                        value={item.block || ''}
                        onChange={e => updateBarterItem(item.id, { block: e.target.value })}
                        className="w-full rounded border px-3 py-2 text-sm"
                      >
                        <option value="">Seç</option>
                        {['A', 'B', 'C', 'D'].map(block => (
                          <option key={block} value={block}>
                            {block}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Daire No</label>
                      <input
                        value={item.apartmentNo}
                        onChange={e => updateBarterItem(item.id, { apartmentNo: e.target.value })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="Örn: 64"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Barter Tutarı</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.amount || ''}
                        onChange={e => updateBarterItem(item.id, { amount: sanitizeDecimalInput(e.target.value) })}
                        onBlur={() => updateBarterItem(item.id, { amount: formatDecimalInput(item.amount) })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Açıklama</label>
                      <input
                        value={item.note || ''}
                        onChange={e => updateBarterItem(item.id, { note: e.target.value })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="Örn: barter satış"
                      />
                    </div>
                    <div className="flex items-end justify-end md:justify-start">
                      <button
                        type="button"
                        onClick={() => removeBarterItem(item.id)}
                        className="h-10 w-10 rounded bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-right text-sm font-semibold text-amber-900">
                Barter toplamı: {formatAmountTr(barterItemsTotal)} TL
              </div>
            </div>
          </div>

          {/* Sözleşme Dosyası Yükleme */}
          <div>
            <label className="block text-sm text-gray-700 mb-1 font-semibold">Sözleşme Belgesi (PDF veya Görsel)</label>
            {formData.contractFileUrl && !deleteCurrentFile ? (
              <div className="flex items-center justify-between border rounded px-3 py-2 bg-slate-50 border-slate-200">
                <a
                  href={formData.contractFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-sky-700 font-medium hover:underline flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {formData.contractFileName || 'Yüklenmiş Dosya'}
                </a>
                <button
                  type="button"
                  onClick={() => setDeleteCurrentFile(true)}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800"
                >
                  Kaldır / Değiştir
                </button>
              </div>
            ) : selectedFile ? (
              <div className="flex items-center justify-between border rounded px-3 py-2 bg-sky-50 border-sky-200">
                <span className="text-sm text-slate-700 truncate flex items-center gap-1.5 font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {selectedFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Vazgeç
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50/50 hover:bg-slate-50 transition text-center cursor-pointer relative">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0])
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-sky-700">Dosya seçmek için tıklayın</span> veya buraya sürükleyin
                </div>
                <div className="text-xs text-slate-400 mt-1">PDF, JPG, PNG (Maks. 50MB)</div>
              </div>
            )}
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
