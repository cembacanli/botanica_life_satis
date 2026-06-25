'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function MaterialProcurementPage() {
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
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tracking-[0.18em] text-amber-700">BOTANICA LIFE</div>
            <h1 className="mt-2 text-3xl font-bold text-stone-900">Malzeme Alım Modülü</h1>
            <p className="mt-2 text-sm text-stone-600">Malzeme alımına ait alt modülleri bu ekrandan yönetin.</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Ana Sayfaya Dön
          </button>
        </div>

        <section className="rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 p-6 text-white shadow-sm ring-1 ring-white/10">
          <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-white/80">
            ANA MODÜL
          </div>
          <h2 className="mt-4 text-3xl font-bold">Malzeme Alım Modülü</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">
            Duvar metrajı ve malzeme sipariş hesapları gibi alt modülleri bu bölüm altında ayrı ayrı açabilirsiniz.
          </p>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <div className="mb-5">
            <h3 className="text-xl font-semibold text-stone-900">Alt Modüller</h3>
            <p className="mt-1 text-sm text-stone-500">İhtiyacınız olan işlem ekranını aşağıdaki kartlardan açın. Aktif olan modüller hemen kullanılabilir, diğer kartlar yeni geliştirmeler için hazırdır.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <button
              onClick={() => router.push('/material-procurement/wall-calculator')}
              className="group rounded-[28px] border border-stone-200 bg-stone-50 p-6 text-left transition hover:border-amber-300 hover:bg-amber-50"
            >
              <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-amber-700">
                AKTİF ALT MODÜL
              </div>
              <h4 className="mt-4 text-2xl font-bold text-stone-900">Duvar Metraj Malzeme Hesap Programı</h4>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Duvar metrajı, minha, alçı sıva, malzeme adedi, harç hesabı, maliyet ve sipariş listesi işlemlerini yönetin.
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Hazır</span>
                <span className="text-sm font-semibold text-amber-700 group-hover:text-amber-800">
                  Alt modüle git
                </span>
              </div>
            </button>

            <button
              onClick={() => router.push('/material-procurement/insulation-calculator')}
              className="group rounded-[28px] border border-stone-200 bg-stone-50 p-6 text-left transition hover:border-amber-300 hover:bg-amber-50"
            >
              <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-amber-700">
                AKTİF ALT MODÜL
              </div>
              <h4 className="mt-4 text-2xl font-bold text-stone-900">Temel ve Perde Yalıtım Hesapları</h4>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Temel ve perde yalıtımı için alan, membran rulo miktarı, sürme yalıtım, XPS, drenaj levhası, işçilik ve birim fiyat maliyetlerini yönetin.
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Hazır</span>
                <span className="text-sm font-semibold text-amber-700 group-hover:text-amber-800">
                  Alt modüle git
                </span>
              </div>
            </button>

            <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50/70 p-6">
              <div className="inline-flex rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-stone-600">
                HAZIR KART
              </div>
              <h4 className="mt-4 text-2xl font-bold text-stone-900">Sıva ve Boya Metraj Programı</h4>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                İç ve dış sıva, boya, yüzey alanı ve birim maliyet hesapları için kullanılacak hazır alt modül alanı.
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-600">Yakında</span>
                <span className="text-sm font-semibold text-stone-500">Aktif değil</span>
              </div>
            </div>

            <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50/70 p-6">
              <div className="inline-flex rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-stone-600">
                HAZIR KART
              </div>
              <h4 className="mt-4 text-2xl font-bold text-stone-900">Seramik Metraj Programı</h4>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Zemin ve duvar seramiği metrajı, fire oranı, adet ve kutu bazlı sipariş hesabı için hazır alan.
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-600">Yakında</span>
                <span className="text-sm font-semibold text-stone-500">Aktif değil</span>
              </div>
            </div>

            <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50/70 p-6">
              <div className="inline-flex rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-stone-600">
                HAZIR KART
              </div>
              <h4 className="mt-4 text-2xl font-bold text-stone-900">Demir ve Beton Hesap Programı</h4>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Beton hacmi, demir tonajı, kalıp alanı ve yaklaşık malzeme maliyetleri için ayrılmış alt modül alanı.
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-600">Yakında</span>
                <span className="text-sm font-semibold text-stone-500">Aktif değil</span>
              </div>
            </div>

            <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50/70 p-6">
              <div className="inline-flex rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-stone-600">
                HAZIR KART
              </div>
              <h4 className="mt-4 text-2xl font-bold text-stone-900">Genel Sipariş Listesi</h4>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Tüm alt modüllerden gelen malzeme siparişlerini birleştirip toplu satın alma listesi oluşturacak alan.
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-600">Yakında</span>
                <span className="text-sm font-semibold text-stone-500">Aktif değil</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
