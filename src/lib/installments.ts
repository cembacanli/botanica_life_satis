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

// Taksit seçenekleri (KULLANICI İSTEDİĞİ TAM SAYIYI GİREBİLİR)
// Bu artık referans için - SalesModal'da input field kullanılacak
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
