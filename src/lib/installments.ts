// Taksit sistemi modeli
export interface InstallmentPlan {
  months: number
  interestRate: number // 0% (faiz yok)
  monthlyPayment: number
  totalAmount: number
  totalInterest: number
}

export interface InstallmentOption {
  months: number
  interestRate: number
  description: string
}

// Vade durumu
export type DueStatus = 'overdue' | 'due-soon' | 'upcoming' | 'paid' | 'pending'

// Taksit çizelge öğesi
export interface InstallmentScheduleItem {
  month: number
  dueDate: Date
  amount: number
  paidAmount: number
  status: DueStatus
  paymentDate?: Date
  daysUntilDue?: number
}

// Taksit durumu özeti
export interface InstallmentStatus {
  totalDue: number
  totalPaid: number
  remainingBalance: number
  completionPercentage: number
  nextDueDate?: Date
  nextDueAmount?: number
  overdueAmount: number
  items: InstallmentScheduleItem[]
  dueStatus: DueStatus
}

// Taksit geçmişi
export interface InstallmentHistory {
  id: string
  apartmentId: string
  timestamp: Date
  changeType: 'created' | 'updated' | 'payment' | 'schedule_change'
  oldValue?: Record<string, any>
  newValue: Record<string, any>
  changedBy?: string
  notes?: string
}

// Taksit seçenekleri (KULLANICI İSTEDİĞİ TAM SAYIYI GİREBİLİR)
export const INSTALLMENT_OPTIONS: InstallmentOption[] = [
  { months: 1, interestRate: 0, description: 'Peşin Ödeme' },
  { months: 3, interestRate: 0, description: '3 Ay' },
  { months: 6, interestRate: 0, description: '6 Ay' },
  { months: 12, interestRate: 0, description: '12 Ay' },
  { months: 24, interestRate: 0, description: '24 Ay' },
  { months: 36, interestRate: 0, description: '36 Ay' },
]

// Taksit hesaplama - FAİZ YOK, İLK ÖDEME DÜŞÜLÜ
export function calculateInstallment(
  totalPrice: number,
  depositAmount: number,
  months: number
): InstallmentPlan {
  // Kalan tutar = Toplam Fiyat - İlk Ödeme (Kapora)
  const remainingAmount = totalPrice - depositAmount
  
  // Aylık ödeme = Kalan Tutar / Ay Sayısı (FAİZ YOK)
  const monthlyPayment = remainingAmount / months
  
  return {
    months,
    interestRate: 0, // Faiz yok
    monthlyPayment: Math.round(monthlyPayment),
    totalAmount: Math.round(remainingAmount),
    totalInterest: 0, // Faiz yok
  }
}

// Bir fiyat için tüm taksit seçeneklerini hesapla (eski - kullanılmayacak)
export function getAllInstallmentPlans(price: number): InstallmentPlan[] {
  return INSTALLMENT_OPTIONS.map(option =>
    calculateInstallment(price, 0, option.months)
  )
}

// Para formatı
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
  }).format(price)
}

// ============ YENİ FONKSİYONLAR ============

// Vade durumunu belirle
export function determineDueStatus(dueDate: Date, isPaymentMade: boolean): DueStatus {
  if (isPaymentMade) return 'paid'
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDateNormalized = new Date(dueDate)
  dueDateNormalized.setHours(0, 0, 0, 0)
  
  const timeDiff = dueDateNormalized.getTime() - today.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  if (daysDiff < 0) return 'overdue'
  if (daysDiff <= 7) return 'due-soon'
  return 'upcoming'
}

// Gün sayısını hesapla
export function calculateDaysUntilDue(dueDate: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDateNormalized = new Date(dueDate)
  dueDateNormalized.setHours(0, 0, 0, 0)
  
  const timeDiff = dueDateNormalized.getTime() - today.getTime()
  return Math.ceil(timeDiff / (1000 * 3600 * 24))
}

// Taksit çizelgesi oluştur
export function generateInstallmentSchedule(
  startDate: Date,
  months: number,
  monthlyPayment: number,
  schedule?: number[],
  payments?: Array<{ date: string; amount: number }>
): InstallmentScheduleItem[] {
  const items: InstallmentScheduleItem[] = []
  
  for (let i = 0; i < months; i++) {
    const dueDate = new Date(startDate)
    dueDate.setMonth(dueDate.getMonth() + i + 1)
    dueDate.setDate(1) // Ayın 1. günü
    dueDate.setHours(0, 0, 0, 0)
    
    const amount = schedule ? schedule[i] : monthlyPayment
    
    // Ödeme bilgisini bul
    let paidAmount = 0
    let paymentDate: Date | undefined
    
    if (payments) {
      const payment = payments.find(p => {
        const pDate = new Date(p.date)
        return pDate.getMonth() === dueDate.getMonth() && pDate.getFullYear() === dueDate.getFullYear()
      })
      if (payment) {
        paidAmount = payment.amount
        paymentDate = new Date(payment.date)
      }
    }
    
    const status = determineDueStatus(dueDate, paidAmount >= amount)
    
    items.push({
      month: i + 1,
      dueDate,
      amount,
      paidAmount,
      status,
      paymentDate,
      daysUntilDue: calculateDaysUntilDue(dueDate),
    })
  }
  
  return items
}

// Taksit durumu özeti
export function getInstallmentStatus(
  startDate: Date,
  months: number,
  monthlyPayment: number,
  schedule?: number[],
  payments?: Array<{ date: string; amount: number }>
): InstallmentStatus {
  const items = generateInstallmentSchedule(startDate, months, monthlyPayment, schedule, payments)
  
  const totalDue = items.reduce((sum, item) => sum + item.amount, 0)
  const totalPaid = items.reduce((sum, item) => sum + item.paidAmount, 0)
  const remainingBalance = totalDue - totalPaid
  const completionPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0
  
  // Overdue ile riski hesapla
  const overdueAmount = items
    .filter(item => item.status === 'overdue')
    .reduce((sum, item) => sum + (item.amount - item.paidAmount), 0)
  
  // Sonraki vadeyi bul
  const nextDueItem = items.find(item => item.status === 'due-soon' || item.status === 'upcoming' || item.status === 'overdue')
  
  // Genel durum belirle
  const dueStatus = items.length > 0 ? (items[0].status) : 'pending'
  
  return {
    totalDue,
    totalPaid,
    remainingBalance,
    completionPercentage,
    nextDueDate: nextDueItem?.dueDate,
    nextDueAmount: nextDueItem?.amount,
    overdueAmount,
    items,
    dueStatus,
  }
}

// Tarih formatı
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Duruma göre renk (tailwind)
export function getStatusColor(status: DueStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800 border-green-300'
    case 'overdue':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'due-soon':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'upcoming':
      return 'bg-blue-100 text-blue-800 border-blue-300'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

// Duruma göre emoji
export function getStatusEmoji(status: DueStatus): string {
  switch (status) {
    case 'paid':
      return '✅'
    case 'overdue':
      return '⚠️'
    case 'due-soon':
      return '⏰'
    case 'upcoming':
      return '📅'
    default:
      return '⏳'
  }
}

// Duruma göre Türkçe ad
export function getStatusLabel(status: DueStatus): string {
  switch (status) {
    case 'paid':
      return 'Ödendi'
    case 'overdue':
      return 'Geçmiş Vade'
    case 'due-soon':
      return 'Yaklaşan Vade'
    case 'upcoming':
      return 'Gelecek Vade'
    default:
      return 'Beklemede'
  }
}
