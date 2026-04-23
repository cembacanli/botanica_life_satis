'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import WallMaterialCalculator from '@/components/WallMaterialCalculator'

export default function WallCalculatorPage() {
  const router = useRouter()
  const { user, loading, isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
    if (!loading && isAuthenticated && user?.role !== 'admin') {
      router.push('/')
    }
  }, [isAuthenticated, loading, router, user])

  if (!mounted || loading) {
    return <div className="min-h-screen p-8">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-[#f6f3ee] p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tracking-[0.18em] text-amber-700">BOTANICA LIFE</div>
            <h1 className="mt-2 text-3xl font-bold text-stone-900">Malzeme Alım Modülü</h1>
            <p className="mt-2 text-sm text-stone-600">Alt modül: Duvar Metraj Malzeme Hesap Programı</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/material-procurement')}
              className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Modüle Dön
            </button>
            <button
              onClick={() => router.push('/')}
              className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>

        <WallMaterialCalculator username={user?.username || ''} />
      </div>
    </div>
  )
}
