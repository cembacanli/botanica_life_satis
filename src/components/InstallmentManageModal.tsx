'use client'

import React, { useEffect, useRef, useState } from 'react'

interface InstallmentManageModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: InstallmentManageData) => void
  currentData?: {
    startDate: string
    monthlyPayment: number
    installmentMonths: number
    paymentMethod?: string
    totalDebt?: number
    paidAmount?: number
    remainingBalance?: number
    installmentSchedule?: number[]
    installmentScheduleDates?: string[]
    depositAmount?: number
    salePrice?: number
  }
}

export interface InstallmentManageData {
  startDate: string
  monthlyPayment: number
  installmentMonths: number
  paymentMethod: 'nakit' | 'cek' | 'senet'
  installmentSchedule?: number[]
  installmentScheduleDates?: string[]
  depositAmount?: number
}

const paymentMethods = [
  { id: 'nakit', label: 'Nakit' },
  { id: 'cek', label: 'Cek' },
  { id: 'senet', label: 'Senet' },
]

const toIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseIsoDateLocal = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return new Date(value)
  const [, yyyy, mm, dd] = match
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd))
}

const normalizeDateInput = (value?: string) => {
  if (!value) return ''
  const trimmed = value.trim()

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  // dd.mm.yyyy
  const trMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (trMatch) {
    const [, dd, mm, yyyy] = trMatch
    return `${yyyy}-${mm}-${dd}`
  }

  // ISO datetime or parsable date
  const parsed = parseIsoDateLocal(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return toIsoDate(parsed)
  }

  return ''
}

const addMonthsKeepDay = (baseDate: Date, monthOffset: number) => {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth() + monthOffset
  const day = baseDate.getDate()

  const targetMonthStart = new Date(year, month, 1)
  const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate()
  const safeDay = Math.min(day, lastDayOfTargetMonth)

  return new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth(),
    safeDay
  )
}

const buildDateSeries = (startDate: string, months: number) => {
  const base = parseIsoDateLocal(startDate)
  const safeBase = Number.isNaN(base.getTime()) ? new Date() : base
  const dates: string[] = []

  for (let i = 0; i < months; i++) {
    const d = addMonthsKeepDay(safeBase, i)
    dates.push(toIsoDate(d))
  }

  return dates
}

export default function InstallmentManageModal({
  isOpen,
  onClose,
  onSave,
  currentData,
}: InstallmentManageModalProps) {
  const initializedForOpenRef = useRef(false)
  const [startDate, setStartDate] = useState('')
  const [monthlyPayment, setMonthlyPayment] = useState(0)
  const [installmentMonths, setInstallmentMonths] = useState(12)
  const [paymentMethod, setPaymentMethod] = useState<'nakit' | 'cek' | 'senet'>('nakit')
  const [error, setError] = useState('')
  const [autoCalculate, setAutoCalculate] = useState(true)
  const [depositAmount, setDepositAmount] = useState(0)
  const [installmentDates, setInstallmentDates] = useState<string[]>([])
  const [customAmounts, setCustomAmounts] = useState<{ [key: number]: number }>({})

  const salePrice = currentData?.salePrice || 0
  const totalDebt = currentData?.totalDebt || 0
  const paidAmount = currentData?.paidAmount || 0
  const initialDepositAmount = currentData?.depositAmount || 0
  const paidWithoutDeposit = Math.max(0, paidAmount - initialDepositAmount)
  const effectiveRemainingBalance = Math.max(0, salePrice - depositAmount - paidWithoutDeposit)

  useEffect(() => {
    if (!isOpen) {
      initializedForOpenRef.current = false
      return
    }
    if (!currentData) return
    if (initializedForOpenRef.current) return

    const months = currentData.installmentMonths || 12
    const initDate = normalizeDateInput(currentData.startDate) || toIsoDate(new Date())
    const generatedDates = buildDateSeries(initDate, months)
    const savedDates = currentData.installmentScheduleDates || []
    const mergedDates = generatedDates.map((fallback, i) => savedDates[i] || fallback)

    setStartDate(initDate)
    setMonthlyPayment(currentData.monthlyPayment || 0)
    setInstallmentMonths(months)
    setPaymentMethod((currentData.paymentMethod as 'nakit' | 'cek' | 'senet') || 'nakit')
    setDepositAmount(currentData.depositAmount || 0)
    setInstallmentDates(mergedDates)
    setAutoCalculate(!currentData.installmentSchedule || currentData.installmentSchedule.length === 0)
    setError('')

    if (currentData.installmentSchedule && currentData.installmentSchedule.length > 0) {
      const amounts: { [key: number]: number } = {}
      currentData.installmentSchedule.forEach((amount, index) => {
        amounts[index] = amount
      })
      setCustomAmounts(amounts)
    } else {
      setCustomAmounts({})
    }
    initializedForOpenRef.current = true
  }, [isOpen, currentData])

  useEffect(() => {
    if (!autoCalculate || effectiveRemainingBalance <= 0 || installmentMonths <= 0) return
    setMonthlyPayment(Math.ceil(effectiveRemainingBalance / installmentMonths))
    setCustomAmounts({})
  }, [autoCalculate, effectiveRemainingBalance, installmentMonths])

  useEffect(() => {
    setInstallmentDates(prev => {
      const normalizedStart = normalizeDateInput(startDate) || toIsoDate(new Date())
      const generated = buildDateSeries(normalizedStart, installmentMonths)
      if (prev.length === installmentMonths) return prev
      return generated.map((fallback, i) => prev[i] || fallback).slice(0, installmentMonths)
    })
  }, [installmentMonths])

  const handleAmountChange = (index: number, value: number) => {
    const newAmounts = { ...customAmounts }

    if (value > 0) {
      newAmounts[index] = value
    } else {
      delete newAmounts[index]
    }

    let paidSoFar = 0
    for (let i = 0; i < index; i++) {
      paidSoFar += newAmounts[i] !== undefined ? newAmounts[i] : monthlyPayment
    }
    paidSoFar += value

    const remainingDebt = effectiveRemainingBalance - paidSoFar
    const remainingMonths = installmentMonths - index - 1

    if (remainingMonths > 0 && remainingDebt > 0) {
      const perMonth = Math.ceil(remainingDebt / remainingMonths)

      for (let i = index + 1; i < installmentMonths; i++) {
        if (i === installmentMonths - 1) {
          const beforeLast = paidSoFar + (i - index - 1) * perMonth
          newAmounts[i] = Math.max(0, effectiveRemainingBalance - beforeLast)
        } else {
          newAmounts[i] = perMonth
        }
      }
    } else if (remainingMonths === 0) {
      newAmounts[index] = Math.max(0, effectiveRemainingBalance - paidSoFar + value)
    }

    setCustomAmounts(newAmounts)
  }

  const handleRemoveInstallment = (index: number) => {
    if (installmentMonths <= 1) return

    setCustomAmounts(prev => {
      const shifted: { [key: number]: number } = {}
      for (let i = 0; i < installmentMonths; i++) {
        if (i === index) continue
        if (prev[i] === undefined) continue
        shifted[i > index ? i - 1 : i] = prev[i]
      }
      return shifted
    })

    setInstallmentDates(prev => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })

    setInstallmentMonths(prev => Math.max(1, prev - 1))
    setAutoCalculate(false)
  }

  const handleSave = () => {
    setError('')

    if (!startDate) {
      setError('Baslangic tarihi gereklidir')
      return
    }

    if (!monthlyPayment || monthlyPayment <= 0) {
      setError('Aylik odeme sifirdan buyuk olmalidir')
      return
    }

    if (!installmentMonths || installmentMonths <= 0 || installmentMonths > 360) {
      setError('Taksit ayi 1-360 arasinda olmalidir')
      return
    }

    const schedule: number[] = []
    for (let i = 0; i < installmentMonths; i++) {
      if (customAmounts[i] !== undefined) {
        schedule.push(Math.max(0, customAmounts[i]))
      } else if (i === installmentMonths - 1) {
        const allButLast = schedule.reduce((a, b) => a + b, 0)
        schedule.push(Math.max(0, effectiveRemainingBalance - allButLast))
      } else {
        schedule.push(Math.max(0, monthlyPayment))
      }
    }

    onSave({
      startDate,
      monthlyPayment,
      installmentMonths,
      paymentMethod,
      installmentSchedule: schedule,
      installmentScheduleDates: installmentDates.slice(0, installmentMonths),
      depositAmount,
    })

    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 rounded-t-lg sticky top-0 z-10">
          <h2 className="text-lg font-bold">Taksit Bilgilerini Duzenle</h2>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[calc(95vh-140px)] overflow-y-auto">
          <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

            {totalDebt > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-2">
                <h3 className="font-semibold text-gray-800">Borc Bilgileri</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Toplam Borc:</span>
                    <span className="font-bold text-blue-600">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(totalDebt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Yapilan Odemeler:</span>
                    <span className="font-bold text-green-600">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(paidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded border border-orange-200">
                    <span className="text-gray-700">Kalan Borc:</span>
                    <span className="font-bold text-orange-600 text-lg">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(effectiveRemainingBalance)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pesinat (TL)</label>
              <input
                type="number"
                min="0"
                step="50000"
                value={depositAmount}
                onChange={e => setDepositAmount(parseInt(e.target.value, 10) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Taksit Baslangic Tarihi</label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  const nextStartDate = normalizeDateInput(e.target.value) || e.target.value
                  setStartDate(nextStartDate)
                  setInstallmentDates(buildDateSeries(nextStartDate, installmentMonths))
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Taksit Ay Sayisi</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => installmentMonths > 1 && setInstallmentMonths(installmentMonths - 1)}
                  disabled={installmentMonths <= 1}
                  className="px-3 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded font-bold transition-colors"
                >
                  -
                </button>

                <input
                  type="number"
                  min="1"
                  max="360"
                  value={installmentMonths}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10)
                    if (!Number.isNaN(val) && val >= 1 && val <= 360) {
                      setInstallmentMonths(val)
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold text-center text-lg"
                />

                <button
                  type="button"
                  onClick={() => installmentMonths < 360 && setInstallmentMonths(installmentMonths + 1)}
                  disabled={installmentMonths >= 360}
                  className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded font-bold transition-colors"
                >
                  +
                </button>

                <span className="text-sm text-gray-600 whitespace-nowrap min-w-[60px] text-center">{(installmentMonths / 12).toFixed(1)} yil</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Aylik Odeme (TL)</label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCalculate}
                    onChange={e => setAutoCalculate(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span>Otomatik</span>
                </label>
              </div>
              <input
                type="number"
                min="0"
                step="100000"
                value={monthlyPayment}
                onChange={e => {
                  setMonthlyPayment(parseInt(e.target.value, 10) || 0)
                  setAutoCalculate(false)
                }}
                disabled={autoCalculate && effectiveRemainingBalance > 0}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold text-lg ${
                  autoCalculate && effectiveRemainingBalance > 0 ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Odeme Yontemi</label>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map(method => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as 'nakit' | 'cek' | 'senet')}
                    className={`px-3 py-2 rounded-lg font-medium transition-all border-2 ${
                      paymentMethod === method.id
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
              <h3 className="font-semibold text-gray-800 mb-3">Ozet</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Toplam Taksit:</span>
                  <span className="font-bold text-blue-600">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(effectiveRemainingBalance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Ay Sayisi:</span>
                  <span className="font-bold">{installmentMonths} ay</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-3 text-lg">Taksit Cizelgesi ({installmentMonths} ay)</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto bg-purple-50 p-4 rounded-lg border border-purple-200">
                {Array.from({ length: installmentMonths }).map((_, i) => {
                  const dateValue = installmentDates[i] || ''
                  const customAmount = customAmounts[i]

                  let amount = customAmount !== undefined ? customAmount : monthlyPayment
                  if (i === installmentMonths - 1 && customAmount === undefined) {
                    const allButLast = monthlyPayment * (installmentMonths - 1)
                    amount = Math.max(0, effectiveRemainingBalance - allButLast)
                  }

                  return (
                    <div key={i} className="p-3 bg-white rounded border border-purple-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-semibold text-purple-700">{i + 1}. Taksit</label>
                        <button
                          type="button"
                          onClick={() => handleRemoveInstallment(i)}
                          disabled={installmentMonths <= 1}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          Cikar
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Tarih</label>
                        <input
                          type="date"
                          value={dateValue}
                          onChange={e => {
                            const newDates = [...installmentDates]
                            newDates[i] = e.target.value
                            setInstallmentDates(newDates)
                          }}
                          className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Tutar (TL)</label>
                        <input
                          type="number"
                          min="0"
                          step="100000"
                          value={customAmount !== undefined ? customAmount : amount}
                          onChange={e => handleAmountChange(i, parseInt(e.target.value, 10) || 0)}
                          className="w-full px-2 py-1 text-sm font-bold border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t flex gap-3 justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
          >
            Iptal
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}
