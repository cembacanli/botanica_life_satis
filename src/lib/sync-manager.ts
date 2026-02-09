/**
 * Gerçek zamanlı senkronizasyon yöneticisi
 * Farklı tarayıcı sekmeleri arasında veri senkronizasyonu sağlar
 */

type SyncCallback = () => void
type SyncEvent = 'salesRecords' | 'saleDetails'

const syncListeners: Map<SyncEvent, Set<SyncCallback>> = new Map()

// Listener'ları kaydet
export function addSyncListener(event: SyncEvent, callback: SyncCallback) {
  if (!syncListeners.has(event)) {
    syncListeners.set(event, new Set())
  }
  syncListeners.get(event)!.add(callback)

  return () => {
    syncListeners.get(event)?.delete(callback)
  }
}

// Listener'ları çağır
function notifyListeners(event: SyncEvent) {
  const listeners = syncListeners.get(event)
  if (listeners) {
    listeners.forEach(callback => callback())
  }
}

// localStorage değişikliklerini dinle
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'salesRecords') {
      notifyListeners('salesRecords')
    } else if (event.key?.startsWith('saleDetails_')) {
      notifyListeners('saleDetails')
    }
  })

  // Aynı sekmede olan değişiklikleri dinlemek için custom events kullan
  window.addEventListener('salesRecordsChanged', () => {
    notifyListeners('salesRecords')
  })

  window.addEventListener('saleDetailsChanged', () => {
    notifyListeners('saleDetails')
  })
}

// localStorage'a veri yaz ve event fırlat
export function setSalesRecords(records: any[]) {
  localStorage.setItem('salesRecords', JSON.stringify(records))
  window.dispatchEvent(new CustomEvent('salesRecordsChanged'))
}

export function setSaleDetails(apartmentId: string, details: any) {
  localStorage.setItem(`saleDetails_${apartmentId}`, JSON.stringify(details))
  window.dispatchEvent(new CustomEvent('saleDetailsChanged'))
}

// Poll-based senkronizasyon (belirlenen aralıklarla kontrol et)
export function startPolling(event: SyncEvent, interval: number = 1000) {
  const pollData = () => {
    if (event === 'salesRecords') {
      notifyListeners('salesRecords')
    } else if (event === 'saleDetails') {
      notifyListeners('saleDetails')
    }
  }

  const intervalId = setInterval(pollData, interval)
  return () => clearInterval(intervalId)
}
