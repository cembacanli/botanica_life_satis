export interface SubcontractorRecord {
  id: string
  name: string
  workScope: string
  phone?: string
  note?: string
  createdAt: string
}

const subcontractorRecords: SubcontractorRecord[] = []

function sortSubcontractors(records: SubcontractorRecord[]) {
  return [...records].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime()
    const bTime = new Date(b.createdAt).getTime()
    return bTime - aTime
  })
}

export function getSubcontractorRecords(): SubcontractorRecord[] {
  return sortSubcontractors(subcontractorRecords)
}

export function getSubcontractorById(id: string): SubcontractorRecord | null {
  return subcontractorRecords.find(item => item.id === id) || null
}

export function addSubcontractorRecord(
  record: Omit<SubcontractorRecord, 'id' | 'createdAt'>
): SubcontractorRecord {
  const newRecord: SubcontractorRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...record,
  }
  subcontractorRecords.unshift(newRecord)
  return newRecord
}

export function updateSubcontractorRecord(
  id: string,
  updates: Partial<Omit<SubcontractorRecord, 'id' | 'createdAt'>>
): SubcontractorRecord | null {
  const idx = subcontractorRecords.findIndex(item => item.id === id)
  if (idx < 0) return null
  const next: SubcontractorRecord = {
    ...subcontractorRecords[idx],
    ...updates,
  }
  subcontractorRecords[idx] = next
  return next
}

export function removeSubcontractorRecord(id: string): boolean {
  const idx = subcontractorRecords.findIndex(item => item.id === id)
  if (idx < 0) return false
  subcontractorRecords.splice(idx, 1)
  return true
}
