'use client'

import React, { useEffect, useState } from 'react'
import { Apartment } from '@/lib/data-generator'
import PaymentModal from '@/components/PaymentModal'
import InstallmentManageModal, { InstallmentManageData } from '@/components/InstallmentManageModal'
import { useRouter } from 'next/navigation'

interface SalesRecord {
  apartmentId: string
  saleType: 'reservation' | 'deposit' | 'sold'
  customerName: string
  customerPhone: string
  date: string
}

export default function InstallmentsPage() {
  const router = useRouter()
  const formatDateTr = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
  }
  const formatDateTimeTr = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${formatDateTr(date)} ${hours}:${minutes}:${seconds}`
  }
  const parsePaymentDate = (value: string) => {
    const iso = new Date(value)
    if (!Number.isNaN(iso.getTime())) return iso
    // tr-TR format: dd.MM.yyyy HH:mm:ss
    const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})/) 
    if (!match) return new Date()
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)
    const year = parseInt(match[3], 10)
    return new Date(year, month - 1, day)
  }
  const buildScheduleAmounts = (details: any) => {
    const months = details?.installmentMonths || 0
    const base = details?.customSchedule || details?.installmentSchedule || []
    const amounts: number[] = []
    for (let i = 0; i < months; i++) {
      const v = base[i]
      amounts.push(typeof v === 'number' && v > 0 ? v : details?.monthlyPayment || 0)
    }
    return amounts
  }
  const getInstallmentsPaidCount = (schedule: number[], paidAmount: number) => {
    let total = 0
    let count = 0
    for (let i = 0; i < schedule.length; i++) {
      total += schedule[i]
      if (paidAmount >= total) {
        count += 1
      } else {
        break
      }
    }
    return count
  }
  const buildAdjustedSchedule = (details: any, schedule: number[], paidAmount: number) => {
    const months = details?.installmentMonths || 0
    if (months === 0) return []
    const paidCount = getInstallmentsPaidCount(schedule, paidAmount)
    const remainingMonths = Math.max(0, months - paidCount)
    if (remainingMonths === 0) return schedule

    // ⭐ Custom schedule varsa ASLA yeniden hesaplama yapma!
    // Kullanıcı manual olarak taksit tutarlarını ayarladıysa, bunları koru
    const hasCustomSchedule = details?.customSchedule && details.customSchedule.length > 0
    if (hasCustomSchedule) {
      return [...schedule]
    }

    // Yalnızca otomatik schedule için (custom olmayan) yeniden hesapla
    const remainingBalance = details?.remainingBalance || 0
    const adjusted = [...schedule]
    const perMonth = Math.ceil(remainingBalance / remainingMonths)

    for (let i = paidCount; i < months; i++) {
      adjusted[i] = perMonth
    }

    const lastIndex = months - 1
    if (remainingMonths > 1) {
      adjusted[lastIndex] = Math.max(0, remainingBalance - perMonth * (remainingMonths - 1))
    } else {
      adjusted[lastIndex] = Math.max(0, remainingBalance)
    }
    return adjusted
  }
  const getInstallmentPaymentIndexMap = (schedule: number[], payments: Array<{ amount: number; label?: string }>) => {
    const map: Array<number | null> = Array(schedule.length).fill(null)
    let payIdx = 0
    let acc = 0

    for (let i = 0; i < schedule.length; i++) {
      const due = schedule[i]
      while (payIdx < payments.length && acc < due) {
        const p = payments[payIdx]
        if (p.label !== 'Ara Ödeme') {
          acc += p.amount || 0
        }
        payIdx += 1
      }
      if (acc >= due) {
        map[i] = payIdx - 1
        acc = acc - due
      } else {
        map[i] = null
      }
    }

    return map
  }
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([])
  const [saleDetailsMap, setSaleDetailsMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [payAmount, setPayAmount] = useState('')
  const [selectedApt, setSelectedApt] = useState<string | null>(null)
  const [blockFilter, setBlockFilter] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<{ apartmentId: string; amount: number; label: string } | null>(null)
  const [manageModalOpen, setManageModalOpen] = useState(false)
  const [selectedAptForManage, setSelectedAptForManage] = useState<string | null>(null)
  
  // Taksit seçim modal
  const [installmentSelectOpen, setInstallmentSelectOpen] = useState(false)
  const [selectedAptForInstallment, setSelectedAptForInstallment] = useState<string | null>(null)

  const mergeSaleDetails = (prev: Record<string, any>, incoming: Record<string, any>) => {
    const merged: Record<string, any> = { ...incoming }
    Object.keys(prev || {}).forEach(key => {
      if (!merged[key]) {
        merged[key] = prev[key]
        return
      }
      if ((!merged[key].customScheduleDates || merged[key].customScheduleDates.length === 0) && prev[key].customScheduleDates && prev[key].customScheduleDates.length > 0) {
        merged[key].customScheduleDates = prev[key].customScheduleDates
      }
      if (!merged[key].customSchedule && prev[key].customSchedule) {
        merged[key].customSchedule = prev[key].customSchedule
      }
      if ((!merged[key].customScheduleDates || merged[key].customScheduleDates.length === 0) && prev[key].customScheduleDates && prev[key].customScheduleDates.length > 0) {
        merged[key].customScheduleDates = prev[key].customScheduleDates
      }
      if (!merged[key].installmentSchedule && prev[key].installmentSchedule) {
        merged[key].installmentSchedule = prev[key].installmentSchedule
      }
    })
    return merged
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const [aptRes, salesRes, detailsRes] = await Promise.all([
          fetch('/api/apartments'),
          fetch('/api/sales'),
          fetch('/api/sale-details'),
        ])

        const [aptData, salesData, detailsData] = await Promise.all([
          aptRes.json(),
          salesRes.json(),
          detailsRes.json(),
        ])

        setApartments(Array.isArray(aptData) ? aptData : [])
        setSalesRecords(Array.isArray(salesData) ? salesData : [])
        setSaleDetailsMap(prev => mergeSaleDetails(prev, detailsData || {}))
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [refreshKey])

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetch('/api/sales')
        .then(r => r.json())
        .then(data => setSalesRecords(Array.isArray(data) ? data : []))
        .catch(() => undefined)

      fetch('/api/sale-details')
        .then(r => r.json())
        .then(data => setSaleDetailsMap(prev => mergeSaleDetails(prev, data || {})))
        .catch(() => undefined)
    }, 3000)

    return () => clearInterval(intervalId)
  }, [])

  const getSaleDetails = (apartmentId: string) => {
    return saleDetailsMap[apartmentId] || null
  }
  // Apply payment to sale details
  const applyPayment = (apartmentId: string, amt: number, label: string) => {
    const details = getSaleDetails(apartmentId)
    if (!details) return alert('Satış detayı bulunamadı')
    
    // ⭐ Kontrol: Yeni toplam ödeme ≤ Daire Bedeli
    const depositAmount = details.depositAmount || 0
    const salePrice = details.salePrice || 0
    const currentTotalPayments = (details.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
    const newTotalPayment = depositAmount + currentTotalPayments + amt
    
    if (newTotalPayment > salePrice) {
      return alert(`Hata: Toplam ödeme (₺${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0 }).format(newTotalPayment)}) daire bedelini (₺${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0 }).format(salePrice)}) aşamaz!`)
    }
    
    const payment = { amount: amt, date: new Date().toISOString(), label }
    details.payments = details.payments || []
    details.payments.push(payment)
    
    const oldBalance = details.remainingBalance || (details.salePrice - (details.depositAmount || 0))
    details.remainingBalance = Math.max(0, oldBalance - amt)
    
    // ⭐ SADECE "Ara Ödeme" için custom schedule'ı eşit olarak azalt!
    if (label === 'Ara Ödeme' && details.customSchedule && details.customSchedule.length > 0 && amt > 0) {
      const schedule = details.customSchedule
      const paidAmountInstallments = (details.payments || [])
        .filter((p: any) => p.label !== 'Ara Ödeme')
        .reduce((s: number, p: any) => s + (p.amount || 0), 0)
      const paidCount = getInstallmentsPaidCount(schedule, paidAmountInstallments)
      const unpaidCount = Math.max(0, schedule.length - paidCount)
      
      if (unpaidCount > 0) {
        // Ara ödemeyi sadece ödenmemiş taksitlere dağıt
        const amountPerInstallment = amt / unpaidCount
        const newSchedule = [...schedule]
        
        for (let i = paidCount; i < schedule.length; i++) {
          newSchedule[i] = Math.max(0, schedule[i] - amountPerInstallment)
        }
        
        details.customSchedule = newSchedule
        if (details.installmentSchedule) {
          details.installmentSchedule = newSchedule
        }
      }
    }
    
    const updated = { ...saleDetailsMap, [apartmentId]: details }
    setSaleDetailsMap(updated)
    fetch('/api/sale-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    }).catch(err => console.error('Sale details save error:', err))
    setPayAmount('')
    setSelectedApt(null)
    setRefreshKey(k => k + 1)
  }

  const cancelPayment = (apartmentId: string, paymentIndex: number) => {
    const details = getSaleDetails(apartmentId)
    if (!details || !details.payments) return
    
    const cancelledPayment = details.payments[paymentIndex]
    const updatedPayments = details.payments.filter((_: any, i: number) => i !== paymentIndex)
    const totalPaid = updatedPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0)
    const totalDebt = (details.salePrice || 0) - (details.depositAmount || 0)
    details.payments = updatedPayments
    details.remainingBalance = Math.max(0, totalDebt - totalPaid)

    // ⭐ Ara ödeme iptal edilirse, custom schedule'ı eşit olarak restore et
    if (cancelledPayment?.label === 'Ara Ödeme' && details.customSchedule && details.customSchedule.length > 0) {
      const schedule = details.customSchedule
      const paidAmountInstallments = (updatedPayments || [])
        .filter((p: any) => p.label !== 'Ara Ödeme')
        .reduce((s: number, p: any) => s + (p.amount || 0), 0)
      const paidCount = getInstallmentsPaidCount(schedule, paidAmountInstallments)
      const unpaidCount = Math.max(0, schedule.length - paidCount)
      
      if (unpaidCount > 0 && cancelledPayment?.amount) {
        // İptal edilen tutarı sadece ödenmemiş taksitlere geri ekle
        const amountPerInstallment = (cancelledPayment.amount || 0) / unpaidCount
        const newSchedule = [...schedule]
        
        for (let i = paidCount; i < schedule.length; i++) {
          newSchedule[i] = newSchedule[i] + amountPerInstallment
        }
        
        details.customSchedule = newSchedule
        if (details.installmentSchedule) {
          details.installmentSchedule = newSchedule
        }
      }
    }

    const updated = { ...saleDetailsMap, [apartmentId]: details }
    setSaleDetailsMap(updated)
    fetch('/api/sale-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    }).catch(err => console.error('Sale details save error:', err))
    setRefreshKey(k => k + 1)
  }

  const openPaymentModal = (apartmentId: string, amount: number, label: string) => {
    setPendingPayment({ apartmentId, amount, label })
    setPaymentModalOpen(true)
  }

  const confirmPayment = (amount: number, print: boolean) => {
    if (!pendingPayment) return
    applyPayment(pendingPayment.apartmentId, amount, pendingPayment.label)
    setPaymentModalOpen(false)

    if (print) {
      const apt = apartments.find(a => a.id === pendingPayment.apartmentId)
      const saleRec = salesRecords.find(r => r.apartmentId === pendingPayment.apartmentId)
      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Fiş</title>
            <style>body{font-family:Arial,sans-serif;padding:20px} .h{font-weight:700;margin-bottom:10px}</style>
          </head>
          <body>
            <div class="h">Ödeme Fişi</div>
            <div>Daire: ${apt ? apt.block + ' - ' + apt.number : pendingPayment.apartmentId}</div>
            <div>Müşteri: ${saleRec?.customerName || '-'}</div>
            <div>Telefon: ${saleRec?.customerPhone || '-'}</div>
            <div>Tutar: ${new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0}).format(amount)}</div>
            <div>Tarih: ${new Date().toLocaleString('tr-TR')}</div>
          </body>
        </html>`
      const w = window.open('', '_blank')
      if (w) {
        w.document.write(html)
        w.document.close()
        w.focus()
        w.print()
      }
    }

    setPendingPayment(null)
  }

  const handleManageInstallment = (apartmentId: string) => {
    setSelectedAptForManage(apartmentId)
    setManageModalOpen(true)
  }

  const handleSaveInstallment = (data: InstallmentManageData) => {
    if (!selectedAptForManage) return

    const details = getSaleDetails(selectedAptForManage)
    if (!details) return

    // ⭐ Yeni peşinat varsa kullan, yoksa mevcut peşinatı koru
    const newDepositAmount = data.depositAmount !== undefined ? data.depositAmount : (details.depositAmount || 0)
    const salePrice = details.salePrice || 0
    const schedule = data.installmentSchedule || []
    const scheduleTotalAmount = schedule.reduce((sum, amt) => sum + amt, 0)
    const totalPayment = newDepositAmount + scheduleTotalAmount
    
    if (totalPayment > salePrice) {
      alert(`Hata: Toplam ödeme (${new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0
      }).format(totalPayment)}) daire bedelini (${new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0
      }).format(salePrice)}) aşamaz!`)
      return
    }

    details.startDate = data.startDate
    details.monthlyPayment = data.monthlyPayment
    details.installmentMonths = data.installmentMonths
    details.paymentMethod = data.paymentMethod
    
    // Peşinat güncelle ve kalan borç hesapla
    details.depositAmount = newDepositAmount
    const totalPaid = (details.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
    details.remainingBalance = Math.max(0, salePrice - newDepositAmount - totalPaid)
    
    // Taksit çizelgesini kaydet (API customSchedule kullanir)
    if (data.installmentSchedule && data.installmentSchedule.length > 0) {
      details.customSchedule = data.installmentSchedule
      details.installmentSchedule = data.installmentSchedule
    }
    if (data.installmentScheduleDates && data.installmentScheduleDates.length > 0) {
      details.customScheduleDates = data.installmentScheduleDates
    }

    setSaleDetailsMap(prev => ({ ...prev, [selectedAptForManage]: details }))
    fetch('/api/sale-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    }).catch(err => console.error('Sale details save error:', err))
    setRefreshKey(k => k + 1)
    setSelectedAptForManage(null)
  }

  if (loading) return <div className="p-8">Yükleniyor...</div>

  const soldRecords = salesRecords.filter(r => r.saleType === 'sold')

  const filteredSoldRecords = soldRecords.filter(rec => {
    const apt = apartments.find(a => a.id === rec.apartmentId)
    const details = getSaleDetails(rec.apartmentId)
    const remainingBalance = details?.remainingBalance || (details?.salePrice || 0) - (details?.depositAmount || 0)

    // Sıfır borç olan daireleri gizle
    if (remainingBalance <= 0) return false

    // Block filter
    if (blockFilter !== 'all' && apt?.block !== blockFilter) return false

    // Search filter: match apartment number or customer name or phone
    if (searchTerm.trim() === '') return true
    const term = searchTerm.trim().toLowerCase()
    const aptNumber = apt?.number?.toString() || ''
    if (aptNumber.includes(term)) return true
    if (rec.customerName.toLowerCase().includes(term)) return true
    if (rec.customerPhone.toLowerCase().includes(term)) return true
    return false
  })

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Taksitler ve Ara Ödemeler</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Dashboard'a Dön
          </button>
        </div>
      <div className="grid grid-cols-1 gap-6">
        <div className="flex gap-3 items-center mb-2">
          <label className="text-sm text-gray-600">Blok:</label>
          <select value={blockFilter} onChange={e => setBlockFilter(e.target.value as any)} className="px-3 py-2 border rounded">
            <option value="all">Tüm Bloklar</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>

          <input
            placeholder="Ara: daire no, müşteri veya telefon"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="ml-4 px-3 py-2 border rounded flex-1"
          />

          <button onClick={() => setRefreshKey(k => k + 1)} className="px-3 py-2 bg-gray-100 rounded">Yenile</button>
        </div>
        {filteredSoldRecords.length === 0 && (
          <div className="p-4 bg-yellow-50 rounded">Henüz satılan daire yok.</div>
        )}

        {filteredSoldRecords.map((rec, idx) => {
          const apt = apartments.find(a => a.id === rec.apartmentId)
          const details = getSaleDetails(rec.apartmentId)
          const paidFromPayments = (details?.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
          const totalPaid = (details?.depositAmount || 0) + paidFromPayments

          return (
            <div key={idx} className="p-4 bg-white rounded shadow">
              <div className="flex justify-between items-start">
                <div>
                {paymentModalOpen && pendingPayment && (
                  <PaymentModal
                    isOpen={paymentModalOpen}
                    onClose={() => setPaymentModalOpen(false)}
                    onConfirm={(amt, print) => confirmPayment(amt, print)}
                    apartment={apartments.find(a => a.id === pendingPayment.apartmentId)}
                    details={getSaleDetails(pendingPayment.apartmentId)}
                    amount={pendingPayment.amount}
                    label={pendingPayment.label}
                  />
                )}
                  <div className="text-sm text-gray-600">Blok / Daire</div>
                  <div className="font-bold text-lg">{apt?.block} - {apt?.number}</div>
                  <div className="text-sm text-gray-600">Müşteri: {rec.customerName} ({rec.customerPhone})</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Satış Fiyatı</div>
                  <div className="font-bold text-green-600">{details ? new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0}).format(details.salePrice) : '-'}</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-4">
                <div>
                  <div className="text-sm text-gray-600">Peşinat</div>
                  <div className="font-semibold">{details ? new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0}).format(details.depositAmount || 0) : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Ödenen (Ara Ödemeler)</div>
                  <div className="font-semibold">{new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0}).format(paidFromPayments || 0)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Kalan Borç</div>
                  <div className="font-semibold text-red-600">{details ? new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0}).format(details.remainingBalance || 0) : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Aylık</div>
                  <div className="font-semibold">{details && details.monthlyPayment ? new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0}).format(details.monthlyPayment) : '-'}</div>
                </div>
              </div>

                {/* Ödeme kaydetme */}
              <div className="mt-4 flex gap-2 flex-wrap">
                <input value={selectedApt === rec.apartmentId ? payAmount : ''} onChange={e => { setSelectedApt(rec.apartmentId); setPayAmount(e.target.value) }} className="px-3 py-2 border rounded w-56" placeholder="Ara ödeme tutarı" />
                <button onClick={() => { const amt = parseInt(payAmount || '0'); if (!amt || amt <= 0) return alert('Geçerli bir tutar girin'); openPaymentModal(rec.apartmentId, amt, 'Ara Ödeme') }} className="px-4 py-2 bg-blue-600 text-white rounded">Ara Ödeme Kaydet</button>
                <button onClick={() => { const details = getSaleDetails(rec.apartmentId); if (!details) return alert('Satış detayı bulunamadı'); setSelectedAptForInstallment(rec.apartmentId); setInstallmentSelectOpen(true) }} className="px-4 py-2 bg-green-600 text-white rounded">Aylık Ödeme Al</button>
                <button onClick={() => { const details = getSaleDetails(rec.apartmentId); if (!details) return alert('Satış detayı bulunamadı'); const remaining = details.remainingBalance || (details.salePrice - (details.depositAmount || 0)); if (!remaining || remaining <= 0) return alert('Ödenecek bakiye yok'); openPaymentModal(rec.apartmentId, remaining, 'Tamamını Öde') }} className="px-4 py-2 bg-red-600 text-white rounded">Tamamını Öde</button>
                <button onClick={() => handleManageInstallment(rec.apartmentId)} className="px-4 py-2 bg-purple-600 text-white rounded">⚙️ Taksit Bilgileri</button>
                <div className="ml-auto text-sm text-gray-400">Son Ödemeler:</div>
              </div>

              {details?.payments?.length > 0 && (
                <div className="mt-3">
                  {details.payments.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <span>{formatDateTimeTr(parsePaymentDate(p.date))} - {new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0}).format(p.amount)}</span>
                      {p.label && <span className="text-xs text-gray-500">({p.label})</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Taksit çizelgesi */}
              {details && details.installmentMonths > 0 && details.monthlyPayment && (
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">Taksit Çizelgesi</div>
                  <div className="flex gap-2 flex-wrap">
                    {(() => {
                      const schedule = details.customSchedule || details.installmentSchedule
                      const scheduleDates = details.customScheduleDates
                      const startDate = details.startDate ? new Date(details.startDate) : new Date()

                      const paidFromInstallments = (details.payments || [])
                        .filter((p: any) => p.label !== 'Ara Ödeme')
                        .reduce((s: number, p: any) => s + (p.amount || 0), 0)
                      const scheduleAmounts = buildScheduleAmounts(details)
                      const adjustedSchedule = buildAdjustedSchedule(details, scheduleAmounts, paidFromInstallments)
                      const installmentsPaid = getInstallmentsPaidCount(scheduleAmounts, paidFromInstallments)
                      const installmentPaymentMap = getInstallmentPaymentIndexMap(scheduleAmounts, details.payments || [])

                      const installments = Array.from({ length: details.installmentMonths }).map((_, mIdx) => {
                        const installmentAmount = schedule ? (schedule[mIdx] || 0) : details.monthlyPayment
                        const dateValue = scheduleDates?.[mIdx]
                        const installmentDate = dateValue ? new Date(dateValue) : new Date(startDate)
                        if (!dateValue) {
                          installmentDate.setMonth(installmentDate.getMonth() + mIdx)
                        }
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        installmentDate.setHours(0, 0, 0, 0)
                        const isDelayed = installmentDate < today
                        const isPaid = mIdx < installmentsPaid

                        return {
                          key: `inst-${mIdx}`,
                          type: 'installment' as const,
                          date: installmentDate,
                          amount: adjustedSchedule[mIdx] ?? installmentAmount,
                          isPaid,
                          isDelayed,
                          cancelIndex: installmentPaymentMap[mIdx],
                        }
                      })

                      const extras = (details.payments || [])
                        .filter((p: any) => p.label === 'Ara Ödeme')
                        .map((p: any, idx: number) => ({
                          key: `extra-${idx}`,
                          type: 'extra' as const,
                          date: parsePaymentDate(p.date),
                          amount: p.amount || 0,
                          cancelIndex: details.payments.indexOf(p),
                        }))

                      const allItems = [...installments, ...extras].sort((a, b) => a.date.getTime() - b.date.getTime())

                      return allItems.map(item => {
                        if (item.type === 'extra') {
                          return (
                            <div key={item.key} className="text-center">
                              <div className="px-3 py-2 rounded-lg text-sm font-medium min-w-[110px] border bg-yellow-50 text-yellow-800 border-yellow-300">
                                <div className="text-xs opacity-80 font-semibold">
                                  {formatDateTr(item.date)}
                                </div>
                                <div className="font-bold text-sm">
                                  {new Intl.NumberFormat('tr-TR', {
                                    style: 'currency',
                                    currency: 'TRY',
                                    minimumFractionDigits: 0,
                                  }).format(item.amount)}
                                </div>
                                <div className="text-xs mt-1">Ara ödeme yapıldı</div>
                                <button
                                  onClick={() => cancelPayment(rec.apartmentId, item.cancelIndex as number)}
                                  className="mt-1 px-2 py-0.5 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200"
                                >
                                  İptal
                                </button>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div key={item.key} className="text-center">
                            <div className={`px-3 py-2 rounded-lg text-sm font-medium min-w-[110px] border ${
                              item.isPaid
                                ? 'bg-green-100 text-green-800 border-green-300'
                                : item.isDelayed
                                ? 'bg-red-100 text-red-800 border-red-300'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              <div className="text-xs opacity-80 font-semibold">
                                {formatDateTr(item.date)}
                              </div>
                              <div className="font-bold text-sm">
                                {new Intl.NumberFormat('tr-TR', {
                                  style: 'currency',
                                  currency: 'TRY',
                                  minimumFractionDigits: 0,
                                }).format(item.amount)}
                              </div>
                              {item.isPaid && (
                                <div className="text-xs mt-1">
                                  ✓ Ödendi
                                  {item.cancelIndex !== null && (
                                    <button
                                      onClick={() => cancelPayment(rec.apartmentId, item.cancelIndex as number)}
                                      className="ml-2 px-2 py-0.5 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200"
                                    >
                                      İptal
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {item.isDelayed && !item.isPaid && (
                              <div className="text-xs text-red-600 font-bold mt-1 text-center">
                                ⚠️ Gecikme Var
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Taksit Yönetim Modal */}
      {selectedAptForManage && (() => {
        const saleDetails = getSaleDetails(selectedAptForManage)
        const enrichedData = saleDetails ? {
          ...saleDetails,
          installmentSchedule: saleDetails.customSchedule || saleDetails.installmentSchedule,
          installmentScheduleDates: saleDetails.customScheduleDates || saleDetails.installmentScheduleDates,
          totalDebt: saleDetails.salePrice || 0, // Toplam Borç = Satış Fiyatı
          paidAmount: (saleDetails.depositAmount || 0) + (saleDetails.payments || []).reduce((sum: number, p: { amount?: number }) => sum + (p.amount || 0), 0), // İlk Kapora + Tüm Odemeler
          remainingBalance: (saleDetails.salePrice || 0) - ((saleDetails.depositAmount || 0) + (saleDetails.payments || []).reduce((sum: number, p: { amount?: number }) => sum + (p.amount || 0), 0)) // Kalan = Satis Fiyati - Yapilan Odemeler
        } : undefined
        
        return (
          <InstallmentManageModal
            isOpen={manageModalOpen}
            onClose={() => setManageModalOpen(false)}
            onSave={handleSaveInstallment}
            currentData={enrichedData}
          />
        )
      })()}

      
      {/* Taksit Seçim Modal */}
      {installmentSelectOpen && selectedAptForInstallment && (() => {
        const details = getSaleDetails(selectedAptForInstallment)
        const baseSchedule = buildScheduleAmounts(details)
        const paidAmountInstallments = (details?.payments || [])
          .filter((p: any) => p.label !== 'Ara Ödeme')
          .reduce((sum: number, p: { amount?: number }) => sum + (p.amount || 0), 0)
        const installmentSchedule = buildAdjustedSchedule(details, baseSchedule, paidAmountInstallments)
        const installmentScheduleDates = (details?.customScheduleDates || details?.installmentScheduleDates || []) as string[]
        
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-md w-full mx-4 shadow-2xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-t-lg">
                <h2 className="text-lg font-bold">Hangi Taksiti Ödemek İstiyorsunuz?</h2>
              </div>

              {/* Content */}
              <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
                {installmentSchedule.length > 0 ? (
                  // Özel taksit çizelgesi varsa
                  installmentSchedule.map((amount: number, index: number) => {
                    const startDate = details?.startDate ? new Date(details.startDate) : new Date()
                    const dueDate = installmentScheduleDates[index]
                      ? new Date(installmentScheduleDates[index])
                      : new Date(startDate)
                    if (!installmentScheduleDates[index]) {
                      dueDate.setMonth(dueDate.getMonth() + index)
                    }
                    
                    const paymentDate = new Date()
                    const alreadyPaid = paidAmountInstallments >= (installmentSchedule.slice(0, index + 1).reduce((a, b) => a + b, 0))
                    
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          if (alreadyPaid) {
                            alert('Bu taksit zaten ödenmiş.')
                            return
                          }
                          openPaymentModal(selectedAptForInstallment, amount, `${index + 1}. Taksit`)
                          setInstallmentSelectOpen(false)
                        }}
                        disabled={alreadyPaid}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                          alreadyPaid
                            ? 'bg-gray-50 border-gray-300 cursor-not-allowed opacity-50'
                            : 'bg-green-50 border-green-300 hover:bg-green-100 hover:border-green-500 cursor-pointer'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-gray-800">
                              {index + 1}. Taksit
                            </div>
                            <div className="text-sm text-gray-600">
                              {formatDateTr(dueDate)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">
                              {new Intl.NumberFormat('tr-TR', {
                                style: 'currency',
                                currency: 'TRY',
                                minimumFractionDigits: 0,
                              }).format(amount)}
                            </div>
                            {alreadyPaid && <div className="text-xs text-gray-500">✓ Ödendi</div>}
                          </div>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  // Standart aylık ödeme
                  Array.from({ length: details?.installmentMonths || 1 }).map((_, index) => {
                    const monthlyPayment = details?.monthlyPayment || 0
                    const startDate = details?.startDate ? new Date(details.startDate) : new Date()
                    const dueDate = new Date(startDate)
                    dueDate.setMonth(dueDate.getMonth() + index)
                    
                    const alreadyPaid = paidAmountInstallments >= (monthlyPayment * (index + 1))
                    
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          if (alreadyPaid) {
                            alert('Bu taksit zaten ödenmiş.')
                            return
                          }
                          openPaymentModal(selectedAptForInstallment, monthlyPayment, `${index + 1}. Taksit`)
                          setInstallmentSelectOpen(false)
                        }}
                        disabled={alreadyPaid}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                          alreadyPaid
                            ? 'bg-gray-50 border-gray-300 cursor-not-allowed opacity-50'
                            : 'bg-green-50 border-green-300 hover:bg-green-100 hover:border-green-500 cursor-pointer'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-gray-800">
                              {index + 1}. Taksit
                            </div>
                            <div className="text-sm text-gray-600">
                              {formatDateTr(dueDate)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">
                              {new Intl.NumberFormat('tr-TR', {
                                style: 'currency',
                                currency: 'TRY',
                                minimumFractionDigits: 0,
                              }).format(monthlyPayment)}
                            </div>
                            {alreadyPaid && <div className="text-xs text-gray-500">✓ Ödendi</div>}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t flex justify-end">
                <button
                  onClick={() => setInstallmentSelectOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      </div>
    </div>
  )
}
