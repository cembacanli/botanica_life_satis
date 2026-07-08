'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface ProgressEntry {
  id: string
  block: string
  title: string
  description: string
  progress_percent: number
  image_url?: string
  date: string
  created_at: string
}

export default function ConstructionProgressPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<ProgressEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBlock, setSelectedBlock] = useState<string>('Tümü')
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/site-progress')
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load progress entries:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (selectedBlock === 'Tümü') return entries
    return entries.filter((item) => {
      if (selectedBlock === 'general') return item.block === 'general'
      return item.block === selectedBlock
    })
  }, [entries, selectedBlock])

  // Calculate current block/general progress stats
  const progressStats = useMemo(() => {
    const blocks = ['general', 'A', 'B', 'C', 'D']
    const stats: Record<string, number> = {}

    blocks.forEach((bl) => {
      // Find latest entry for this block to get its current progress percent
      const latest = entries
        .filter((e) => e.block === bl)
        .sort((a, b) => b.date.localeCompare(a.date))[0]
      stats[bl] = latest ? latest.progress_percent : 0
    })

    // Project overall is the weighted or average, or simply the 'general' progress or average of all blocks
    const activeBlocksCount = Object.values(stats).filter((v) => v > 0).length
    const sum = Object.values(stats).reduce((a, b) => a + b, 0)
    stats['overall'] = activeBlocksCount > 0 ? Math.round(sum / 5) : stats['general'] || 0

    return stats;
  }, [entries])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f172a,_#020617_70%)] text-slate-100 p-4 md:p-8">
      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[85vh] w-full h-full flex items-center justify-center">
            <img
              src={lightboxImage}
              alt="Şantiye Görseli Büyük Boy"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all text-xl cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 bg-slate-900/50 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-2xl">
          <div>
            <button
              onClick={() => router.push('/')}
              className="mb-4 inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-semibold cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Projeye Geri Dön
            </button>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-400 font-bold">
              Botanica Life İnşaat
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Şantiye İlerleme Takibi
            </h1>
            <p className="mt-2 text-sm text-slate-400 max-w-xl">
              Projemizin inşaat aşamalarını, blok bazlı tamamlanma oranlarını ve güncel şantiye fotoğraflarını kronolojik olarak takip edin.
            </p>
          </div>

          {/* Project Overall Progress Ring */}
          <div className="flex items-center gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 shrink-0">
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-700"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-cyan-400 transition-all duration-1000 ease-out"
                  strokeWidth="3.5"
                  strokeDasharray={`${progressStats.overall}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-sm font-extrabold text-white">%{progressStats.overall}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Genel İlerleme</div>
              <div className="text-sm font-extrabold text-cyan-400 mt-0.5">Proje Tamamlanma</div>
            </div>
          </div>
        </div>

        {/* Stats Dashboard Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { key: 'general', label: 'Genel Altyapı' },
            { key: 'A', label: 'A Blok' },
            { key: 'B', label: 'B Blok' },
            { key: 'C', label: 'C Blok' },
            { key: 'D', label: 'D Blok' },
          ].map((blockMeta) => (
            <div
              key={blockMeta.key}
              className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between"
            >
              <span className="text-xs text-slate-400 font-semibold">{blockMeta.label}</span>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">%{progressStats[blockMeta.key]}</span>
                <span className="text-xs text-green-400 font-bold">Aktif</span>
              </div>
              {/* Micro Progress Bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-cyan-500 h-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressStats[blockMeta.key]}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Toolbar */}
        <div className="flex border-b border-slate-800 pb-3 gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
          {['Tümü', 'general', 'A', 'B', 'C', 'D'].map((blockKey) => (
            <button
              key={blockKey}
              onClick={() => setSelectedBlock(blockKey)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                selectedBlock === blockKey
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/50'
              }`}
            >
              {blockKey === 'Tümü'
                ? '📋 Tüm Güncellemeler'
                : blockKey === 'general'
                ? '🏗️ Genel Proje'
                : `🏢 ${blockKey} Blok`}
            </button>
          ))}
        </div>

        {/* Loading / Timeline List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400"></div>
            <p className="text-slate-400 text-sm">Güncellemeler yükleniyor...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="bg-slate-900/20 border border-slate-800 rounded-3xl p-16 text-center shadow-xl">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="text-lg font-bold text-white">Kayıt Bulunamadı</h3>
            <p className="text-sm text-slate-400 mt-2">
              Seçilen kategoriye ait herhangi bir şantiye ilerleme kaydı bulunmamaktadır.
            </p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-800 ml-4 md:ml-6 space-y-12 pb-8">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="relative pl-8 md:pl-12 group">
                {/* Timeline Node dot */}
                <div className="absolute -left-[9px] top-1.5 bg-slate-950 border-2 border-cyan-400 rounded-full w-4 h-4 group-hover:bg-cyan-400 transition-all duration-300"></div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 bg-slate-900/20 border border-slate-800/60 rounded-3xl p-5 md:p-6 hover:border-slate-700/80 transition-all duration-300 shadow-xl backdrop-blur-sm">
                  {/* Text Details */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                        {entry.block === 'general' ? 'Genel Proje' : `${entry.block} Blok`}
                      </span>
                      <span className="text-sm text-slate-400 font-medium">
                        📅 {new Date(entry.date).toLocaleDateString('tr-TR')}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors duration-300">
                        {entry.title}
                      </h2>
                      <p className="text-slate-300 text-sm leading-relaxed mt-2 whitespace-pre-wrap">
                        {entry.description}
                      </p>
                    </div>

                    {/* Progress slider info */}
                    <div className="space-y-2 max-w-md pt-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider">Aşama Tamamlanma</span>
                        <span className="text-cyan-400 font-extrabold">%{entry.progress_percent}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${entry.progress_percent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Image Block */}
                  {entry.image_url ? (
                    <div
                      className="relative rounded-2xl overflow-hidden border border-slate-800 group/img cursor-pointer aspect-video lg:aspect-square bg-slate-950"
                      onClick={() => setLightboxImage(entry.image_url || null)}
                    >
                      <img
                        src={entry.image_url}
                        alt={entry.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-all duration-300">
                        <span className="bg-white/10 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">
                          🔍 Görseli Büyüt
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-800/80 flex flex-col items-center justify-center p-6 text-center text-slate-500 aspect-video lg:aspect-square">
                      <span className="text-2xl mb-1">📷</span>
                      <span className="text-xs">Görsel Eklenmemiş</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
