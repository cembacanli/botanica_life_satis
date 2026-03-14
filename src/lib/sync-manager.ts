/**
 * Gercek zamanli senkronizasyon yoneticisi
 * Tarayici ici event bazli degisiklik bildirimi saglar.
 */

type SyncCallback = () => void
type SyncEvent = 'salesRecords' | 'saleDetails'

const syncListeners: Map<SyncEvent, Set<SyncCallback>> = new Map()

export function addSyncListener(event: SyncEvent, callback: SyncCallback) {
  if (!syncListeners.has(event)) {
    syncListeners.set(event, new Set())
  }
  syncListeners.get(event)!.add(callback)

  return () => {
    syncListeners.get(event)?.delete(callback)
  }
}

function notifyListeners(event: SyncEvent) {
  const listeners = syncListeners.get(event)
  if (listeners) {
    listeners.forEach(callback => callback())
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('salesRecordsChanged', () => {
    notifyListeners('salesRecords')
  })

  window.addEventListener('saleDetailsChanged', () => {
    notifyListeners('saleDetails')
  })
}

export function setSalesRecords(records: any[]) {
  void records
  window.dispatchEvent(new CustomEvent('salesRecordsChanged'))
}

export function setSaleDetails(apartmentId: string, details: any) {
  void apartmentId
  void details
  window.dispatchEvent(new CustomEvent('saleDetailsChanged'))
}

export function startPolling(event: SyncEvent, interval: number = 1000) {
  const pollData = () => {
    notifyListeners(event)
  }

  const intervalId = setInterval(pollData, interval)
  return () => clearInterval(intervalId)
}
