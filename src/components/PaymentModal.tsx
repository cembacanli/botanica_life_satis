 'use client'

import React from 'react'
import { Apartment } from '@/lib/data-generator'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (amount: number, print: boolean) => void
  apartment?: Apartment | null
  details?: any
  amount: number
  label: string
}

export default function PaymentModal({ isOpen, onClose, onConfirm, apartment, details, amount, label }: Props) {
  if (!isOpen) return null

  const handleConfirm = (print: boolean) => {
    onConfirm(amount, print)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Ödeme Onayı</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <div><strong>Daire:</strong> {apartment ? `${apartment.block} - ${apartment.number}` : '-'}</div>
          <div><strong>Müşteri:</strong> {details?.customerName || '-'} ({details?.customerPhone || '-'})</div>
          <div><strong>Tutar:</strong> {new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0}).format(amount)}</div>
          <div><strong>Tür:</strong> {label}</div>
          <div><strong>Tarih:</strong> {new Date().toLocaleString('tr-TR')}</div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => onClose()} className="px-4 py-2 border rounded">İptal</button>
          <button onClick={() => handleConfirm(false)} className="px-4 py-2 bg-blue-600 text-white rounded">Ödemeyi Kaydet</button>
          <button onClick={() => handleConfirm(true)} className="px-4 py-2 bg-green-600 text-white rounded ml-auto">Kaydet ve Fiş Yazdır</button>
        </div>
      </div>
    </div>
  )
}
