export interface SalesRecord {
  apartmentId: string
  saleType: 'reservation' | 'deposit' | 'sold'
  customerName: string
  customerPhone: string
  date: string
}

export interface SaleDetails {
  apartmentId: string
  depositAmount: number
  salePrice: number
  installmentMonths: number
  monthlyPayment: number
  payments: Array<{ amount: number; date: string }>
  remainingBalance: number
  startDate?: string
  paymentMethod?: string
}

const salesRecords: SalesRecord[] = []
const saleDetails: Record<string, SaleDetails> = {}

export function getSalesRecords(): SalesRecord[] {
  return salesRecords
}

export function upsertSalesRecords(records: SalesRecord[]) {
  records.forEach(record => {
    const idx = salesRecords.findIndex(r => r.apartmentId === record.apartmentId)
    if (idx >= 0) {
      salesRecords[idx] = record
    } else {
      salesRecords.push(record)
    }
  })
  return salesRecords
}

export function removeSalesRecord(apartmentId: string) {
  const idx = salesRecords.findIndex(r => r.apartmentId === apartmentId)
  if (idx >= 0) {
    salesRecords.splice(idx, 1)
  }
  return salesRecords
}

export function getSaleDetails(apartmentId: string) {
  return saleDetails[apartmentId] || null
}

export function getAllSaleDetails() {
  return saleDetails
}

export function upsertSaleDetails(details: SaleDetails[]) {
  details.forEach(detail => {
    saleDetails[detail.apartmentId] = detail
  })
  return saleDetails
}

export function removeSaleDetails(apartmentId: string) {
  delete saleDetails[apartmentId]
  return saleDetails
}
