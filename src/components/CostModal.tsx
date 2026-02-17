'use client'

import { useEffect, useState } from 'react'

export interface CostFormData {
  itemName: string
  category: string
  amount: number
  date: string
  note?: string
}

interface CostModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: CostFormData) => Promise<void> | void
  initialData?: Partial<CostFormData> | null
  title?: string
  submitLabel?: string
}

const defaultData = (): CostFormData => ({
  itemName: '',
  category: '',
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  note: '',
})

export default function CostModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  title = 'Aylik Maliyet Giriniz',
  submitLabel = 'Kaydet',
}: CostModalProps) {
  const [formData, setFormData] = useState<CostFormData>(defaultData)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (initialData) {
      setFormData({
        itemName: initialData.itemName || '',
        category: initialData.category || '',
        amount: initialData.amount || 0,
        date: initialData.date || new Date().toISOString().slice(0, 10),
        note: initialData.note || '',
      })
    } else {
      setFormData(defaultData())
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
    if (!formData.itemName.trim()) {
      setError('Kalem adi zorunludur.')
      return
    }
    if (!formData.category.trim()) {
      setError('Kategori zorunludur.')
      return
    }
    if (!formData.amount || formData.amount <= 0) {
      setError('Tutar 0 dan buyuk olmali.')
      return
    }
    if (!formData.date) {
      setError('Tarih zorunludur.')
      return
    }

    setSaving(true)
    try {
      await onSave({
        itemName: formData.itemName.trim(),
        category: formData.category.trim(),
        amount: Math.round(formData.amount),
        date: formData.date,
        note: (formData.note || '').trim(),
      })
      setFormData(defaultData())
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Maliyet kaydedilemedi.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-700 to-slate-900 text-white">
          <h3 className="text-lg font-bold">{title}</h3>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-700 mb-1">Kalem Adi</label>
            <input
              value={formData.itemName}
              onChange={e => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              placeholder="Orn: Demir, Iscilik, Elektrik"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Kategori</label>
              <input
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
                placeholder="Orn: Insaat, Ruhsat, Pazarlama"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Tutar (TL)</label>
              <input
                type="number"
                min="0"
                value={formData.amount || ''}
                onChange={e => setFormData(prev => ({ ...prev, amount: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-3 py-2 border rounded"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Tarih</label>
            <input
              type="date"
              value={formData.date}
              onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
            />
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
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-800 text-white"
          >
            {saving ? 'Kaydediliyor...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

