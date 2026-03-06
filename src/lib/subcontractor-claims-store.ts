export type ClaimStatus = 'taslak' | 'onaylandi' | 'odendi'

export interface SubcontractorClaimRecord {
  id: string
  subcontractorId: string
  subcontractorName: string
  workItem: string
  contractAmount: number
  progressPercent: number
  completedAmount: number
  previousPaidAmount: number
  currentClaimAmount: number
  deductionAmount: number
  netPayableAmount: number
  claimDate: string
  status: ClaimStatus
  note?: string
  createdAt: string
}

const claimRecords: SubcontractorClaimRecord[] = []

function sortClaims(records: SubcontractorClaimRecord[]) {
  return [...records].sort((a, b) => {
    const aTime = new Date(a.claimDate || a.createdAt).getTime()
    const bTime = new Date(b.claimDate || b.createdAt).getTime()
    return bTime - aTime
  })
}

export function getSubcontractorClaimRecords(): SubcontractorClaimRecord[] {
  return sortClaims(claimRecords)
}

export function getSubcontractorClaimRecordsBySubcontractorId(
  subcontractorId: string
): SubcontractorClaimRecord[] {
  return sortClaims(claimRecords.filter(item => item.subcontractorId === subcontractorId))
}

export function addSubcontractorClaimRecord(
  record: Omit<SubcontractorClaimRecord, 'id' | 'createdAt'>
): SubcontractorClaimRecord {
  const createdAt = new Date().toISOString()
  const newRecord: SubcontractorClaimRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    ...record,
  }
  claimRecords.unshift(newRecord)
  return newRecord
}

export function updateSubcontractorClaimRecord(
  id: string,
  updates: Partial<Omit<SubcontractorClaimRecord, 'id' | 'createdAt'>>
): SubcontractorClaimRecord | null {
  const idx = claimRecords.findIndex(r => r.id === id)
  if (idx < 0) return null

  const next: SubcontractorClaimRecord = {
    ...claimRecords[idx],
    ...updates,
  }
  claimRecords[idx] = next
  return next
}

export function removeSubcontractorClaimRecord(id: string): boolean {
  const idx = claimRecords.findIndex(r => r.id === id)
  if (idx < 0) return false
  claimRecords.splice(idx, 1)
  return true
}

export function removeSubcontractorClaimRecordsBySubcontractorId(subcontractorId: string): number {
  let deletedCount = 0
  for (let i = claimRecords.length - 1; i >= 0; i -= 1) {
    if (claimRecords[i].subcontractorId === subcontractorId) {
      claimRecords.splice(i, 1)
      deletedCount += 1
    }
  }
  return deletedCount
}
