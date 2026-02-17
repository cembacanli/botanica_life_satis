export interface CostRecord {
  id: string
  itemName: string
  category: string
  amount: number
  date: string
  note?: string
  createdAt: string
}

const costRecords: CostRecord[] = []

export function getCostRecords(): CostRecord[] {
  return [...costRecords].sort((a, b) => {
    const aTime = new Date(a.date || a.createdAt).getTime()
    const bTime = new Date(b.date || b.createdAt).getTime()
    return bTime - aTime
  })
}

export function addCostRecord(record: Omit<CostRecord, 'id' | 'createdAt'>): CostRecord {
  const createdAt = new Date().toISOString()
  const newRecord: CostRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    ...record,
  }
  costRecords.unshift(newRecord)
  return newRecord
}

export function updateCostRecord(
  id: string,
  updates: Partial<Omit<CostRecord, 'id' | 'createdAt'>>
): CostRecord | null {
  const idx = costRecords.findIndex(r => r.id === id)
  if (idx < 0) return null
  const next: CostRecord = {
    ...costRecords[idx],
    ...updates,
  }
  costRecords[idx] = next
  return next
}

export function removeCostRecord(id: string): boolean {
  const idx = costRecords.findIndex(r => r.id === id)
  if (idx < 0) return false
  costRecords.splice(idx, 1)
  return true
}
