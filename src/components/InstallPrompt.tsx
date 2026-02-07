import React, { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler as EventListener)
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice && choice.outcome === 'accepted') {
      // installed
      setVisible(false)
      setDeferredPrompt(null)
    } else {
      // dismissed
      setVisible(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border shadow-lg rounded-xl px-4 py-2 flex items-center gap-4 z-50">
      <div className="flex-1">
        <div className="font-semibold">Uygulamayı Ekle</div>
        <div className="text-xs text-gray-500">Ana ekrana ekleyerek uygulamayı daha hızlı açın</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleInstall} className="px-3 py-2 bg-blue-600 text-white rounded-md">Ekle</button>
        <button onClick={() => setVisible(false)} className="px-3 py-2 text-sm text-gray-600">Kapat</button>
      </div>
    </div>
  )
}
