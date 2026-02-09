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
        setSaleDetailsMap(detailsData || {})
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
        .then(data => setSaleDetailsMap(data || {}))
        .catch(() => undefined)
    }, 3000)

    return () => clearInterval(intervalId)
  }, [])

  const getSaleDetails = (apartmentId: string) => {
    return saleDetailsMap[apartmentId] || null
  }
  // Apply payment to sale details
  const applyPayment = (apartmentId: string, amt: number) => {
    const details = getSaleDetails(apartmentId)
    if (!details) return alert('Satış detayı bulunamadı')
    const payment = { amount: amt, date: new Date().toLocaleString('tr-TR') }
    details.payments = details.payments || []
    details.payments.push(payment)
    details.remainingBalance = (details.remainingBalance || (details.salePrice - (details.depositAmount || 0))) - amt
    if (details.remainingBalance < 0) details.remainingBalance = 0
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

  const openPaymentModal = (apartmentId: string, amount: number, label: string) => {
    setPendingPayment({ apartmentId, amount, label })
    setPaymentModalOpen(true)
  }

  const confirmPayment = (amount: number, print: boolean) => {
    if (!pendingPayment) return
    applyPayment(pendingPayment.apartmentId, amount)
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

    details.startDate = data.startDate
    details.monthlyPayment = data.monthlyPayment
    details.installmentMonths = data.installmentMonths
    details.paymentMethod = data.paymentMethod
    
    // Taksit çizelgesini kaydet
    if (data.installmentSchedule && data.installmentSchedule.length > 0) {
      details.installmentSchedule = data.installmentSchedule
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
                    <div key={i} className="text-sm text-gray-700">{p.date} - {new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0}).format(p.amount)}</div>
                  ))}
                </div>
              )}

              {/* Taksit çizelgesi */}
              {details && details.installmentMonths > 0 && details.monthlyPayment && (
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">Taksit Çizelgesi</div>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: details.installmentMonths }).map((_, mIdx) => {
                      // Schedule varsa onu kullan, yoksa monthlyPayment kullan
                      const installmentAmount = details.installmentSchedule 
                        ? (details.installmentSchedule[mIdx] || 0)
                        : details.monthlyPayment
                      
                      // Taksit tarihini hesapla
                      const startDate = details.startDate ? new Date(details.startDate) : new Date()
                      const installmentDate = new Date(startDate)
                      installmentDate.setMonth(installmentDate.getMonth() + mIdx)
                      
                      // Gecikme kontrolü
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      installmentDate.setHours(0, 0, 0, 0)
                      const isDelayed = installmentDate < today
                      
                      const paidFromPayments = (details.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
                      const installmentsPaid = Math.floor(paidFromPayments / details.monthlyPayment)
                      const isPaid = mIdx < installmentsPaid
                      
                      return (
                        <div key={mIdx} className="text-center">
                          <div className={`px-3 py-2 rounded-lg text-sm font-medium min-w-[110px] border ${
                            isPaid 
                              ? 'bg-green-100 text-green-800 border-green-300' 
                              : isDelayed
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            <div className="text-xs opacity-80 font-semibold">
                              {installmentDate.toLocaleDateString('tr-TR', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                            <div className="font-bold text-sm">
                              {new Intl.NumberFormat('tr-TR', {
                                style: 'currency',
                                currency: 'TRY',
                                minimumFractionDigits: 0,
                              }).format(installmentAmount)}
                            </div>
                            {isPaid && <div className="text-xs mt-1">✓ Ödendi</div>}
                          </div>
                          {isDelayed && !isPaid && (
                            <div className="text-xs text-red-600 font-bold mt-1 text-center">
                              ⚠️ Gecikme Var
                            </div>
                          )}
                        </div>
                      )
                    })}
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
      {!selectedAptForManage && (
        <InstallmentManageModal
          isOpen={manageModalOpen}
          onClose={() => setManageModalOpen(false)}
          onSave={handleSaveInstallment}
          currentData={undefined}
        />
      )}
      
      {/* Taksit Seçim Modal */}
      {installmentSelectOpen && selectedAptForInstallment && (() => {
        const details = getSaleDetails(selectedAptForInstallment)
        const installmentSchedule = details?.installmentSchedule || []
        const paidAmount = (details?.payments || []).reduce((sum: number, p: { amount?: number }) => sum + (p.amount || 0), 0)
        
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
                  installmentSchedule.map((amount, index) => {
                    const startDate = details?.startDate ? new Date(details.startDate) : new Date()
                    const dueDate = new Date(startDate)
                    dueDate.setMonth(dueDate.getMonth() + index)
                    
                    const paymentDate = new Date()
                    const alreadyPaid = paidAmount >= (installmentSchedule.slice(0, index + 1).reduce((a, b) => a + b, 0))
                    
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
                              {dueDate.toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
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
                    
                    const alreadyPaid = paidAmount >= (monthlyPayment * (index + 1))
                    
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
                              {dueDate.toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
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
