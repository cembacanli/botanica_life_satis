'use client'

import { useRouter } from 'next/navigation'

const plans = [
  {
    id: 'ab',
    title: 'A / B Blok - 2+1 (90 m2)',
    description: 'Realistik 3D hissiyatli plan, satis sunumu icin optimize edildi.',
    src: '/plans/ab-2plus1-90m2.svg',
    imageClass: 'w-4/5',
  },
  {
    id: 'cd',
    title: 'C / D Blok - 1+1 (45 m2)',
    description: 'Realistik 3D hissiyatli plan, kompakt daire tipi icin optimize edildi.',
    src: '/plans/cd-1plus1-45m2.png',
    imageClass: 'w-3/5',
  },
]

export default function PlansPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">3D Daire Planlari</h1>
            <p className="text-base text-gray-600">A/B ve C/D bloklar icin hazir plan gorselleri.</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 text-base bg-gray-200 hover:bg-gray-300 text-gray-800 rounded"
          >
            Ana Sayfa
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b bg-gray-50">
                <h2 className="text-xl font-semibold text-gray-900">{plan.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
              </div>
              <div className="p-4">
                <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                  <img src={plan.src} alt={plan.title} className={`${plan.imageClass} h-auto mx-auto`} />
                </div>
                <div className="mt-4 flex gap-3">
                  <a
                    href={plan.src}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 text-sm rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    Yeni Sekmede Ac
                  </a>
                  <a
                    href={plan.src}
                    download
                    className="px-4 py-2 text-sm rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  >
                    SVG Indir
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
