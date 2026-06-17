'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type SaleType = 'reservation' | 'deposit' | 'sold'

interface ReportRow {
  apartmentId: string
  block: string
  floor: number
  number: number
  saleType: SaleType
  customerName: string
  customerFirstName: string
  customerLastName: string
  customerPhone: string
  date: string
  salePrice: number
  totalPaid: number
  remainingBalance: number
}

interface BlockReport {
  block: string
  totalCount: number
  totalSalePrice: number
  totalPaid: number
  totalRemainingBalance: number
  items: ReportRow[]
}

interface ReportsResponse {
  total: number
  totals: {
    totalCount: number
    totalSalePrice: number
    totalPaid: number
    totalRemainingBalance: number
  }
  blocks: BlockReport[]
  activity: ReportRow[]
}

const emptyReport: ReportsResponse = {
  total: 0,
  totals: {
    totalCount: 0,
    totalSalePrice: 0,
    totalPaid: 0,
    totalRemainingBalance: 0,
  },
  blocks: [],
  activity: [],
}

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0)
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return dateFormatter.format(parsed)
}

function getSaleTypeBadge(type: SaleType) {
  if (type === 'sold') {
    return 'bg-emerald-100 text-emerald-700'
  }

  if (type === 'deposit') {
    return 'bg-amber-100 text-amber-700'
  }

  return 'bg-sky-100 text-sky-700'
}

function getSaleTypeLabel(type: SaleType) {
  if (type === 'sold') return 'Satış'
  if (type === 'deposit') return 'Kapora'
  return 'Rezervasyon'
}

function getBlockAccent(block: string) {
  if (block === 'A') return 'from-sky-500 to-cyan-500'
  if (block === 'B') return 'from-violet-500 to-fuchsia-500'
  if (block === 'C') return 'from-emerald-500 to-teal-500'
  if (block === 'D') return 'from-orange-500 to-amber-500'
  return 'from-stone-500 to-stone-600'
}

export default function ReportsPage() {
  const router = useRouter()
  const [report, setReport] = useState<ReportsResponse>(emptyReport)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setError('')
      const response = await fetch('/api/installments/reports', { cache: 'no-store' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Rapor verileri alınamadı.')
      }

      setReport({
        total: data?.total || 0,
        totals: data?.totals || emptyReport.totals,
        blocks: Array.isArray(data?.blocks) ? data.blocks : [],
        activity: Array.isArray(data?.activity) ? data.activity : [],
      })
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Rapor verileri alınamadı.'
      setError(message)
      setReport(emptyReport)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadData()
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <button
                onClick={() => router.back()}
                className="mb-4 inline-flex items-center gap-2 text-sm text-white/80 transition hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Geri Dön
              </button>
              <div className="text-sm uppercase tracking-[0.3em] text-sky-200">Raporlar Modülü</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Blok Bazlı Tahsilat ve Borç Raporu</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-200 md:text-base">
                Her blok için daire bazında satış bedeli, müşteri bilgisi, yapılan ödeme ve kalan borç
                durumunu tek ekranda izleyin.
              </p>
            </div>

            <button
              onClick={loadData}
              className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Yenile
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur">
              <div className="text-sm text-slate-200">Toplam Finansal Kayıt</div>
              <div className="mt-2 text-3xl font-semibold">{report.totals.totalCount}</div>
            </div>
            <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur">
              <div className="text-sm text-slate-200">Toplam Satış Bedeli</div>
              <div className="mt-2 text-3xl font-semibold">{formatCurrency(report.totals.totalSalePrice)}</div>
            </div>
            <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur">
              <div className="text-sm text-slate-200">Toplam Tahsilat</div>
              <div className="mt-2 text-3xl font-semibold">{formatCurrency(report.totals.totalPaid)}</div>
            </div>
            <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur">
              <div className="text-sm text-slate-200">Toplam Kalan Borç</div>
              <div className="mt-2 text-3xl font-semibold">{formatCurrency(report.totals.totalRemainingBalance)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8">
        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-center text-lg text-slate-500 shadow-sm ring-1 ring-slate-200">
            Rapor verileri yükleniyor...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
            {error}
          </div>
        ) : report.blocks.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-4xl">📊</div>
            <h2 className="mt-4 text-2xl font-semibold text-slate-900">Henüz finansal rapor kaydı yok</h2>
            <p className="mt-2 text-slate-500">
              Satış, kapora ve ödeme bilgileri eklendikçe burada blok bazında listelenecek.
            </p>
          </div>
        ) : (
          <>
            {report.blocks.map(blockReport => (
              <section key={blockReport.block} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className={`bg-gradient-to-r ${getBlockAccent(blockReport.block)} px-6 py-5 text-white`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-sm uppercase tracking-[0.25em] text-white/80">Blok Özeti</div>
                      <h2 className="mt-2 text-3xl font-semibold">Blok {blockReport.block}</h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                        <div className="text-xs text-white/80">Kayıt Sayısı</div>
                        <div className="mt-1 text-xl font-semibold">{blockReport.totalCount}</div>
                      </div>
                      <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                        <div className="text-xs text-white/80">Toplam Satış</div>
                        <div className="mt-1 text-xl font-semibold">{formatCurrency(blockReport.totalSalePrice)}</div>
                      </div>
                      <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                        <div className="text-xs text-white/80">Yapılan Ödeme</div>
                        <div className="mt-1 text-xl font-semibold">{formatCurrency(blockReport.totalPaid)}</div>
                      </div>
                      <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                        <div className="text-xs text-white/80">Kalan Borç</div>
                        <div className="mt-1 text-xl font-semibold">{formatCurrency(blockReport.totalRemainingBalance)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200">
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Kat</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Daire No</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Alış Bedeli</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Müşteri Adı</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Müşteri Soyadı</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Yapılan Ödeme</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Kalan Borç</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">İşlem Türü</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockReport.items.map(item => (
                        <tr key={item.apartmentId} className="border-b border-slate-100 transition hover:bg-slate-50/80">
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">{item.floor}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">{item.number}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{formatCurrency(item.salePrice)}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{item.customerFirstName}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{item.customerLastName}</td>
                          <td className="px-6 py-4 text-sm font-medium text-emerald-700">{formatCurrency(item.totalPaid)}</td>
                          <td className="px-6 py-4 text-sm font-medium text-rose-700">{formatCurrency(item.remainingBalance)}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getSaleTypeBadge(item.saleType)}`}>
                              {getSaleTypeLabel(item.saleType)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

            <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-2xl font-semibold text-slate-900">İşlem Geçmişi</h2>
                <p className="mt-1 text-sm text-slate-500">Rapor ekranındaki finansal kayıtların kaynak satış işlemleri</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Blok</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Kat</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Daire No</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Müşteri</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Telefon</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">İşlem Türü</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.activity.map(item => (
                      <tr key={`${item.apartmentId}-${item.date}`} className="border-b border-slate-100 transition hover:bg-slate-50/80">
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">Blok {item.block}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{item.floor}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{item.number}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{item.customerName}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{item.customerPhone || '-'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getSaleTypeBadge(item.saleType)}`}>
                            {getSaleTypeLabel(item.saleType)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">{formatDate(item.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
