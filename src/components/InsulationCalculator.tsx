'use client'

import { useState, useMemo, useEffect } from 'react'

export default function InsulationCalculator({ username }: { username: string }) {
  // --- DATABASE / STATE SYNC ---
  const [projectName, setProjectName] = useState<string>('')
  const [savedProjects, setSavedProjects] = useState<any[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'loading'>('idle')
  const [serverMessage, setServerMessage] = useState<string>('')

  const refreshSavedProjects = async (nextActiveId?: string | null) => {
    const response = await fetch('/api/material-procurement-projects')
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Kayıtlar yenilenemedi.')
    }
    const nextProjects = Array.isArray(data) ? data : []
    const insulationProjects = nextProjects.filter((p: any) => p.project?.isInsulation === true)
    setSavedProjects(insulationProjects)
    if (typeof nextActiveId !== 'undefined') {
      setActiveProjectId(nextActiveId)
    }
    return insulationProjects
  }

  useEffect(() => {
    const loadInit = async () => {
      setSaveState('loading')
      try {
        await refreshSavedProjects()
      } catch (err) {
        setServerMessage(err instanceof Error ? err.message : 'Kayıtlar yüklenemedi.')
      } finally {
        setSaveState('idle')
      }
    }
    loadInit()
  }, [])

  const saveProjectToSupabase = async () => {
    if (!projectName.trim()) {
      setServerMessage('Supabase kaydı için önce bir proje/blok adı girin (Örn: C Blok Yalıtım).')
      return
    }

    setSaveState('saving')
    setServerMessage('')

    try {
      const payload = {
        id: activeProjectId || undefined,
        project: {
          isInsulation: true,
          projectName: projectName,
          temelAlani,
          ampatmanYuksekligi,
          ampatmanYuksekligiM,
          asansorCevresi,
          asansorYuksekligi,
          ampatmanGenisligi,
          korumaBetonuKalinligi,
          membranFiyat,
          proofMembranFiyat,
          astarFiyat,
          korumaBetonuFiyat,
          temelIscilikFiyat,
          temelYalitimTipi,
          perdeUzunlugu,
          perdeYuksekligi,
          perdeAmpatmanAlani,
          tamirHarciFiyat,
          surmeYalitimFiyat,
          xpsFiyat,
          drenajLevhasiFiyat,
          perdeIscilikFiyat
        },
        mortar: {},
        materials: [],
        walls: [],
        username,
      }

      const response = await fetch('/api/material-procurement-projects', {
        method: activeProjectId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Kayıt işlemi başarısız.')
      }

      await refreshSavedProjects(data.id)
      setServerMessage(`"${data.projectName}" projesi Supabase'e kaydedildi.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kayıt işlemi başarısız.'
      setServerMessage(message)
    } finally {
      setSaveState('idle')
    }
  }

  const loadSavedProject = (saved: any) => {
    const proj = saved.project || {}
    setProjectName(saved.projectName || '')
    setTemelAlani(proj.temelAlani ?? 914)
    setAmpatmanYuksekligi(proj.ampatmanYuksekligi ?? 124.2)
    setAmpatmanYuksekligiM(proj.ampatmanYuksekligiM ?? 0.9)
    setAsansorCevresi(proj.asansorCevresi ?? 20)
    setAsansorYuksekligi(proj.asansorYuksekligi ?? 1.5)
    setAmpatmanGenisligi(proj.ampatmanGenisligi ?? 1)
    setKorumaBetonuKalinligi(proj.korumaBetonuKalinligi ?? 5)
    
    setMembranFiyat(proj.membranFiyat ?? 100)
    setProofMembranFiyat(proj.proofMembranFiyat ?? 155)
    setAstarFiyat(proj.astarFiyat ?? 3000)
    setKorumaBetonuFiyat(proj.korumaBetonuFiyat ?? 150)
    setTemelIscilikFiyat(proj.temelIscilikFiyat ?? 25)
    setTemelYalitimTipi(proj.temelYalitimTipi ?? 'klasik')
    
    setPerdeUzunlugu(proj.perdeUzunlugu ?? 117)
    setPerdeYuksekligi(proj.perdeYuksekligi ?? 3.5)
    setPerdeAmpatmanAlani(proj.perdeAmpatmanAlani ?? 124)
    
    setTamirHarciFiyat(proj.tamirHarciFiyat ?? 400)
    setSurmeYalitimFiyat(proj.surmeYalitimFiyat ?? 3250)
    setXpsFiyat(proj.xpsFiyat ?? 200)
    setDrenajLevhasiFiyat(proj.drenajLevhasiFiyat ?? 40)
    setPerdeIscilikFiyat(proj.perdeIscilikFiyat ?? 120)

    setActiveProjectId(saved.id)
    setServerMessage(`"${saved.projectName}" yalıtım kaydı başarıyla yüklendi.`)
  }

  const deleteSavedProject = async (projectId: string) => {
    const target = savedProjects.find(item => item.id === projectId)
    const confirmed = window.confirm(`"${target?.projectName || 'Bu kayıt'}" Supabase'den silinsin mi?`)
    if (!confirmed) return

    setSaveState('saving')
    setServerMessage('')
    try {
      const response = await fetch('/api/material-procurement-projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Silme işlemi başarısız.')
      }

      await refreshSavedProjects(activeProjectId === projectId ? null : activeProjectId)
      if (activeProjectId === projectId) {
        setActiveProjectId(null)
        setProjectName('')
      }
      setServerMessage('Kayıt Supabase üzerinden silindi.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Silme işlemi başarısız.'
      setServerMessage(message)
    } finally {
      setSaveState('idle')
    }
  }

  // --- TEMEL YALITIM STATES ---
  const [temelYalitimTipi, setTemelYalitimTipi] = useState<'klasik' | 'proof' | null>(null)
  const [temelAlani, setTemelAlani] = useState<number>(914)
  const [ampatmanYuksekligi, setAmpatmanYuksekligi] = useState<number>(124.2)
  const [ampatmanYuksekligiM, setAmpatmanYuksekligiM] = useState<number>(0.9)
  const [asansorCevresi, setAsansorCevresi] = useState<number>(20)
  const [asansorYuksekligi, setAsansorYuksekligi] = useState<number>(1.5)
  const [ampatmanGenisligi, setAmpatmanGenisligi] = useState<number>(1)
  const [korumaBetonuKalinligi, setKorumaBetonuKalinligi] = useState<number>(5)
  
  // Temel Birim Fiyatlar
  const [membranFiyat, setMembranFiyat] = useState<number>(100)
  const [proofMembranFiyat, setProofMembranFiyat] = useState<number>(155)
  const [astarFiyat, setAstarFiyat] = useState<number>(3000)
  const [korumaBetonuFiyat, setKorumaBetonuFiyat] = useState<number>(150)
  const [temelIscilikFiyat, setTemelIscilikFiyat] = useState<number>(25)

  // --- PERDE YALITIM STATES ---
  const [perdeUzunlugu, setPerdeUzunlugu] = useState<number>(117)
  const [perdeYuksekligi, setPerdeYuksekligi] = useState<number>(3.5)
  const [perdeAmpatmanAlani, setPerdeAmpatmanAlani] = useState<number>(124)
  
  // Perde Birim Fiyatlar
  const [tamirHarciFiyat, setTamirHarciFiyat] = useState<number>(400)
  const [surmeYalitimFiyat, setSurmeYalitimFiyat] = useState<number>(3250)
  const [xpsFiyat, setXpsFiyat] = useState<number>(200)
  const [drenajLevhasiFiyat, setDrenajLevhasiFiyat] = useState<number>(40)
  const [perdeIscilikFiyat, setPerdeIscilikFiyat] = useState<number>(120)

  // --- TEMEL HESAPLAMALAR ---
  const temelCalcs = useMemo(() => {
    const ampatmanAlani = ampatmanYuksekligi * ampatmanYuksekligiM
    const asansorAlani = asansorCevresi * asansorYuksekligi
    const ampatmanUzeriAlani = ampatmanGenisligi * ampatmanYuksekligi
    const toplamAlan = temelAlani + ampatmanAlani + asansorAlani + ampatmanUzeriAlani
    
    const isProof = temelYalitimTipi === 'proof'
    const faydaliAlan = isProof ? 8.88 : 8.91
    const malzemeMetraji = toplamAlan / faydaliAlan
    const siparisAdedi = Math.ceil(malzemeMetraji)
    const siparisAdediM2 = siparisAdedi * 10

    // İş kalemleri tablosu
    const items = isProof
      ? [
          {
            name: 'Alteks Proof 3,5mm',
            miktar: siparisAdediM2,
            birim: 'm²',
            birimFiyat: proofMembranFiyat,
            kdvRate: 0.20
          },
          {
            name: 'İşçilik',
            miktar: toplamAlan,
            birim: 'm²',
            birimFiyat: temelIscilikFiyat,
            kdvRate: 0
          }
        ]
      : [
          {
            name: 'Membran',
            miktar: siparisAdediM2,
            birim: 'm²',
            birimFiyat: membranFiyat,
            kdvRate: 0.20
          },
          {
            name: 'Astar',
            miktar: (temelAlani + asansorAlani + ampatmanUzeriAlani) / 250,
            birim: 'Adet',
            birimFiyat: astarFiyat,
            kdvRate: 0.20
          },
          {
            name: 'Koruma Betonu',
            miktar: temelAlani * (korumaBetonuKalinligi / 100),
            birim: 'm³',
            birimFiyat: korumaBetonuFiyat,
            kdvRate: 0.20
          },
          {
            name: 'İşçilik',
            miktar: toplamAlan,
            birim: 'm²',
            birimFiyat: temelIscilikFiyat,
            kdvRate: 0.20
          }
        ]

    const itemsCalculated = items.map(item => {
      const tutar = item.miktar * item.birimFiyat
      const kdv = tutar * item.kdvRate
      const toplam = tutar + kdv
      return { ...item, tutar, kdv, toplam }
    })

    const toplamTutar = itemsCalculated.reduce((sum, item) => sum + item.tutar, 0)
    const toplamKdv = itemsCalculated.reduce((sum, item) => sum + item.kdv, 0)
    const genelToplam = itemsCalculated.reduce((sum, item) => sum + item.toplam, 0)

    return {
      ampatmanAlani,
      asansorAlani,
      ampatmanUzeriAlani,
      toplamAlan,
      faydaliAlan,
      malzemeMetraji,
      siparisAdedi,
      siparisAdediM2,
      items: itemsCalculated,
      toplamTutar,
      toplamKdv,
      genelToplam
    }
  }, [temelAlani, ampatmanYuksekligi, ampatmanYuksekligiM, asansorCevresi, asansorYuksekligi, ampatmanGenisligi, korumaBetonuKalinligi, membranFiyat, proofMembranFiyat, astarFiyat, korumaBetonuFiyat, temelIscilikFiyat, temelYalitimTipi])

  // --- PERDE HESAPLAMALAR ---
  const perdeCalcs = useMemo(() => {
    const perdeAlani = perdeUzunlugu * perdeYuksekligi
    const toplamAlan = perdeAlani + perdeAmpatmanAlani

    // İş kalemleri
    const items = [
      {
        name: 'Tamir Harcı',
        miktar: perdeAlani / 12,
        birim: 'Torba',
        birimFiyat: tamirHarciFiyat,
      },
      {
        name: 'Sürme Yalıtım',
        miktar: toplamAlan * 4.4 / 32,
        birim: 'Kova',
        birimFiyat: surmeYalitimFiyat,
      },
      {
        name: 'Xps',
        miktar: toplamAlan,
        birim: 'm²',
        birimFiyat: xpsFiyat,
      },
      {
        name: 'Drenaj Levhası',
        miktar: toplamAlan,
        birim: 'm²',
        birimFiyat: drenajLevhasiFiyat,
      },
      {
        name: 'İşçilik',
        miktar: toplamAlan,
        birim: 'm²',
        birimFiyat: perdeIscilikFiyat,
      }
    ]

    const itemsCalculated = items.map(item => {
      const tutar = item.miktar * item.birimFiyat
      const kdv = tutar * 0.20
      const toplam = tutar + kdv
      return { ...item, tutar, kdv, toplam }
    })

    const toplamTutar = itemsCalculated.reduce((sum, item) => sum + item.tutar, 0)
    const toplamKdv = itemsCalculated.reduce((sum, item) => sum + item.kdv, 0)
    const genelToplam = itemsCalculated.reduce((sum, item) => sum + item.toplam, 0)

    return {
      perdeAlani,
      toplamAlan,
      items: itemsCalculated,
      toplamTutar,
      toplamKdv,
      genelToplam
    }
  }, [perdeUzunlugu, perdeYuksekligi, perdeAmpatmanAlani, tamirHarciFiyat, surmeYalitimFiyat, xpsFiyat, drenajLevhasiFiyat, perdeIscilikFiyat])

  // --- KARŞILAŞTIRMA HESAPLAMALARI ---
  const comparisonCalcs = useMemo(() => {
    const ampatmanAlani = ampatmanYuksekligi * ampatmanYuksekligiM
    const asansorAlani = asansorCevresi * asansorYuksekligi
    const ampatmanUzeriAlani = ampatmanGenisligi * ampatmanYuksekligi
    const toplamAlan = temelAlani + ampatmanAlani + asansorAlani + ampatmanUzeriAlani

    // 1. Klasik Membran
    const classicFaydaliAlan = 8.91
    const classicSiparisAdediM2 = Math.ceil(toplamAlan / classicFaydaliAlan) * 10
    const classicMembranTutar = classicSiparisAdediM2 * membranFiyat
    const classicAstarTutar = ((temelAlani + asansorAlani + ampatmanUzeriAlani) / 250) * astarFiyat
    const classicKorumaBetonuTutar = (temelAlani * (korumaBetonuKalinligi / 100)) * korumaBetonuFiyat
    const classicIscilikTutar = toplamAlan * temelIscilikFiyat

    const classicTutarNet = classicMembranTutar + classicAstarTutar + classicKorumaBetonuTutar + classicIscilikTutar
    const classicKdv = classicTutarNet * 0.20
    const classicTotal = classicTutarNet + classicKdv

    // 2. Proof Membran
    const proofFaydaliAlan = 8.88
    const proofSiparisAdediM2 = Math.ceil(toplamAlan / proofFaydaliAlan) * 10
    const proofMembranTutar = proofSiparisAdediM2 * proofMembranFiyat
    const proofIscilikTutar = toplamAlan * temelIscilikFiyat

    const proofKdv = proofMembranTutar * 0.20
    const proofTotal = (proofMembranTutar + proofKdv) + proofIscilikTutar

    // 3. Fark
    const diff = Math.abs(classicTotal - proofTotal)
    const isProofCheaper = proofTotal < classicTotal
    const cheaperOption = isProofCheaper ? 'Proof Membran' : 'Klasik Membran'
    const expensiveOption = isProofCheaper ? 'Klasik Membran' : 'Proof Membran'
    const percentage = classicTotal > 0 || proofTotal > 0 ? (diff / Math.max(classicTotal, proofTotal)) * 100 : 0

    return {
      classicTotal,
      proofTotal,
      diff,
      isProofCheaper,
      cheaperOption,
      expensiveOption,
      percentage
    }
  }, [temelAlani, ampatmanYuksekligi, ampatmanYuksekligiM, asansorCevresi, asansorYuksekligi, ampatmanGenisligi, membranFiyat, proofMembranFiyat, astarFiyat, korumaBetonuFiyat, korumaBetonuKalinligi, temelIscilikFiyat])

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* ================= SCREEN VIEW (ACTIVE CALCULATOR) ================= */}
      <div className="space-y-8 print:hidden">
        {/* Header Controls */}
        <div className="flex items-center justify-between rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-medium text-stone-600">
              Aktif Kullanıcı: <strong className="text-stone-900">{username || 'Admin'}</strong>
            </span>
          </div>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Yazdır / PDF Kaydet
          </button>
        </div>

        {/* Supabase Yalıtım Kayıtları Panel */}
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-grow max-w-md">
              <h3 className="text-xl font-semibold text-stone-900">Supabase Yalıtım Kayıtları</h3>
              <p className="mt-1 text-sm text-stone-500">Hesaplama verilerini bir blok adı belirleyerek Supabase'e kaydedebilir veya güncelleyebilirsiniz.</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Proje / Blok Adı (Örn: C Blok Yalıtım)"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <button
                onClick={saveProjectToSupabase}
                disabled={saveState !== 'idle'}
                className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveState === 'saving' ? 'Kaydediliyor...' : activeProjectId ? 'Kaydı Güncelle' : 'Kaydet'}
              </button>
              <button
                onClick={() => {
                  setActiveProjectId(null)
                  setProjectName('')
                  setTemelYalitimTipi(null)
                }}
                className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Temizle / Yeni Kayıt
              </button>
              <button
                onClick={() => refreshSavedProjects().catch(err => setServerMessage(err.message))}
                disabled={saveState !== 'idle'}
                className="rounded-full border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Listeyi Yenile
              </button>
            </div>
          </div>

          {serverMessage && (
            <div className="mt-4 rounded-2xl border border-stone-200 bg-amber-50 px-4 py-3 text-sm text-stone-700">
              {serverMessage}
            </div>
          )}

          {/* Saved Projects Table */}
          {savedProjects.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200">
              <table className="min-w-full text-sm">
                <thead className="bg-stone-50">
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="px-4 py-2.5 font-bold">Kayıt Adı</th>
                    <th className="px-4 py-2.5 font-bold">Kullanıcı</th>
                    <th className="px-4 py-2.5 font-bold">Güncelleme Tarihi</th>
                    <th className="px-4 py-2.5 font-bold">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {savedProjects.map((item) => (
                    <tr key={item.id} className={activeProjectId === item.id ? 'bg-amber-50/50' : ''}>
                      <td className="px-4 py-3 font-semibold text-stone-900">{item.projectName}</td>
                      <td className="px-4 py-3 text-stone-600">{item.username || '-'}</td>
                      <td className="px-4 py-3 text-stone-500">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleString('tr-TR') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadSavedProject(item)}
                            className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                          >
                            Yükle
                          </button>
                          <button
                            onClick={() => deleteSavedProject(item.id)}
                            className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* ==================== TEMEL YALITIMI HESAP ADIMLARI ==================== */}
          <div className="flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <div className="mb-6 border-b border-stone-100 pb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-stone-900">Temel Yalıtım Hesap Adımları</h2>
                <p className="mt-1 text-sm text-stone-500">Sarı alanlar veri giriş bölümleridir. Diğer hesaplamalar otomatiktir.</p>
              </div>
              {temelYalitimTipi && (
                <div className="inline-flex rounded-full bg-stone-100 p-0.5 border border-stone-200">
                  <button
                    onClick={() => setTemelYalitimTipi('proof')}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${temelYalitimTipi === 'proof' ? 'bg-amber-600 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    Proof Membran
                  </button>
                  <button
                    onClick={() => setTemelYalitimTipi('klasik')}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${temelYalitimTipi === 'klasik' ? 'bg-amber-600 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    Klasik Membran
                  </button>
                </div>
              )}
            </div>

            {!temelYalitimTipi ? (
              /* Step 1: Product Selection Wizard */
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-6 my-auto">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-stone-900">Temel Yalıtım Ürünü Seçimi</h3>
                  <p className="text-sm text-stone-500 max-w-md">Temel yalıtımında kullanmak istediğiniz ürünü seçerek hesaplamaya başlayabilirsiniz.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 w-full max-w-lg">
                  <button
                    onClick={() => setTemelYalitimTipi('proof')}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-amber-50/30 hover:border-amber-500 transition cursor-pointer text-center focus:outline-none ring-1 ring-transparent hover:ring-amber-500/20"
                  >
                    <div className="p-3 bg-amber-500/10 text-amber-600 rounded-full mb-3">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <span className="text-base font-bold text-stone-900">Proof Membran</span>
                    <span className="text-xs text-stone-500 mt-2 leading-relaxed">Alteks Proof 3.5mm taze betona yapışan membran (astar ve koruma betonu gerektirmez).</span>
                  </button>
                  <button
                    onClick={() => setTemelYalitimTipi('klasik')}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-amber-50/30 hover:border-amber-500 transition cursor-pointer text-center focus:outline-none ring-1 ring-transparent hover:ring-amber-500/20"
                  >
                    <div className="p-3 bg-stone-500/10 text-stone-600 rounded-full mb-3">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <span className="text-base font-bold text-stone-900">Klasik Membran</span>
                    <span className="text-xs text-stone-500 mt-2 leading-relaxed">2 kat membran uygulaması ve astar kullanımı gerektirir.</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Inputs and Calculations */
              <>
                {/* Inputs Section */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Temel Alanı (m²)</label>
                    <input
                      type="number"
                      value={temelAlani}
                      onChange={(e) => setTemelAlani(parseFloat(e.target.value) || 0)}
                      className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-amber-50 px-4 py-3 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Ampatman Çevresi (m)</label>
                    <input
                      type="number"
                      value={ampatmanYuksekligi}
                      onChange={(e) => setAmpatmanYuksekligi(parseFloat(e.target.value) || 0)}
                      className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-amber-50 px-4 py-3 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Temel Ampatman Yüksekliği (m)</label>
                    <input
                      type="number"
                      value={ampatmanYuksekligiM}
                      onChange={(e) => setAmpatmanYuksekligiM(parseFloat(e.target.value) || 0)}
                      className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-amber-50 px-4 py-3 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Asansör Çukuru Çevresi (m)</label>
                    <input
                      type="number"
                      value={asansorCevresi}
                      onChange={(e) => setAsansorCevresi(parseFloat(e.target.value) || 0)}
                      className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-amber-50 px-4 py-3 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Asansör Çukuru Yüksekliği (m)</label>
                    <input
                      type="number"
                      value={asansorYuksekligi}
                      onChange={(e) => setAsansorYuksekligi(parseFloat(e.target.value) || 0)}
                      className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-amber-50 px-4 py-3 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Ampatman Genişliği (m)</label>
                    <input
                      type="number"
                      value={ampatmanGenisligi}
                      onChange={(e) => setAmpatmanGenisligi(parseFloat(e.target.value) || 0)}
                      className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-amber-50 px-4 py-3 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                {/* Intermediate Calculations Display */}
                <div className="mt-6 rounded-2xl bg-stone-50 p-4 border border-stone-100 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Hesaplanan Ara Değerler</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600">Ampatman Yalıtım Alanı (+Çevre * {formatNumber(ampatmanYuksekligiM)}):</span>
                    <span className="font-semibold text-stone-900">{formatNumber(temelCalcs.ampatmanAlani)} m²</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600">Asansör Çukuru (+Cevre * Yukseklik):</span>
                    <span className="font-semibold text-stone-900">{formatNumber(temelCalcs.asansorAlani)} m²</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600">Ampatman Üzeri Alanı (+Genislik * Çevre):</span>
                    <span className="font-semibold text-stone-900">{formatNumber(temelCalcs.ampatmanUzeriAlani)} m²</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-stone-200/60 pt-2 font-medium">
                    <span className="text-stone-900 font-bold">Toplam Alan:</span>
                    <span className="text-stone-950 font-bold">{formatNumber(temelCalcs.toplamAlan)} m²</span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-500 pt-1">
                    <span>Faydalı Alan (10m² Ruloda):</span>
                    <span>{formatNumber(temelCalcs.faydaliAlan)} m²</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600">Malzeme Metrajı:</span>
                    <span className="font-semibold text-stone-900">{formatNumber(temelCalcs.malzemeMetraji)} Adet</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-amber-900">
                    <span>Sipariş Rulo Adedi (Yukarı Yuvarlanır):</span>
                    <span>{temelCalcs.siparisAdedi} Adet</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-amber-950">
                    <span>Toplam Sipariş Metrajı (Rulo * 10):</span>
                    <span>{temelCalcs.siparisAdediM2} m²</span>
                  </div>
                </div>

                {/* Pricing inputs & Work items */}
                <div className="mt-8">
                  <h3 className="text-lg font-bold text-stone-900 mb-4">Temel Yalıtım Birim Fiyat Girişleri</h3>
                  
                  {temelYalitimTipi === 'proof' ? (
                    <div className="grid gap-4 sm:grid-cols-2 mb-6">
                      <div>
                        <label className="block text-xs font-semibold text-stone-500">Proof Malzeme Fiyatı (TL/m²)</label>
                        <input
                          type="number"
                          value={proofMembranFiyat}
                          onChange={(e) => setProofMembranFiyat(parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-3 py-2 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-500">İşçilik Fiyatı (TL/m²)</label>
                        <input
                          type="number"
                          value={temelIscilikFiyat}
                          onChange={(e) => setTemelIscilikFiyat(parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-3 py-2 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
                      <div>
                        <label className="block text-xs font-semibold text-stone-500">Membran Fiyatı (TL/m²)</label>
                        <input
                          type="number"
                          value={membranFiyat}
                          onChange={(e) => setMembranFiyat(parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-3 py-2 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-500">Astar Fiyatı (TL/Adet)</label>
                        <input
                          type="number"
                          value={astarFiyat}
                          onChange={(e) => setAstarFiyat(parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-3 py-2 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-500">Koruma Betonu Kalınlığı (cm)</label>
                        <input
                          type="number"
                          value={korumaBetonuKalinligi}
                          onChange={(e) => setKorumaBetonuKalinligi(parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-3 py-2 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-500">Koruma Betonu Fiyatı (TL/m³)</label>
                        <input
                          type="number"
                          value={korumaBetonuFiyat}
                          onChange={(e) => setKorumaBetonuFiyat(parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-3 py-2 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-500">İşçilik Fiyatı (TL/m²)</label>
                        <input
                          type="number"
                          value={temelIscilikFiyat}
                          onChange={(e) => setTemelIscilikFiyat(parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-3 py-2 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-500">
                          <th className="py-2.5 font-bold">İş Kalemi</th>
                          <th className="py-2.5 font-bold text-right">Miktar</th>
                          <th className="py-2.5 font-bold text-center">Birim</th>
                          <th className="py-2.5 font-bold text-right">B. Fiyat</th>
                          <th className="py-2.5 font-bold text-right">Tutar</th>
                          <th className="py-2.5 font-bold text-right">KDV (%20)</th>
                          <th className="py-2.5 font-bold text-right">KDV Dahil</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {temelCalcs.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-stone-50/50">
                            <td className="py-3 font-semibold text-stone-900">{item.name}</td>
                            <td className="py-3 text-right text-stone-700">{formatNumber(item.miktar)}</td>
                            <td className="py-3 text-center text-stone-500">{item.birim}</td>
                            <td className="py-3 text-right text-stone-900">{formatNumber(item.birimFiyat)} TL</td>
                            <td className="py-3 text-right text-stone-900 font-medium">{formatNumber(item.tutar)} TL</td>
                            <td className="py-3 text-right text-stone-500">{item.kdv > 0 ? `${formatNumber(item.kdv)} TL` : '-'}</td>
                            <td className="py-3 text-right text-stone-900 font-bold">{formatNumber(item.toplam)} TL</td>
                          </tr>
                        ))}
                        <tr className="bg-stone-900 text-white font-bold">
                          <td className="py-3 px-2 rounded-l-2xl">TOPLAM</td>
                          <td colSpan={3}></td>
                          <td className="py-3 text-right">{formatNumber(temelCalcs.toplamTutar)} TL</td>
                          <td className="py-3 text-right">{formatNumber(temelCalcs.toplamKdv)} TL</td>
                          <td className="py-3 text-right pr-2 rounded-r-2xl">{formatNumber(temelCalcs.genelToplam)} TL</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ==================== PERDE YALITIMI HESAP ADIMLARI ==================== */}
          <div className="flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <div className="mb-6 border-b border-stone-100 pb-4">
              <h2 className="text-2xl font-bold tracking-tight text-stone-900">Perde Yalıtım Hesap Adımları</h2>
              <p className="mt-1 text-sm text-stone-500">Sarı alanlar veri giriş bölümleridir. Diğer hesaplamalar otomatiktir.</p>
            </div>

            {/* Inputs Section */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Perde Uzunluğu (m)</label>
                <input
                  type="number"
                  value={perdeUzunlugu}
                  onChange={(e) => setPerdeUzunlugu(parseFloat(e.target.value) || 0)}
                  className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-amber-50 px-4 py-3 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Perde Yüksekliği (m)</label>
                <input
                  type="number"
                  value={perdeYuksekligi}
                  onChange={(e) => setPerdeYuksekligi(parseFloat(e.target.value) || 0)}
                  className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-amber-50 px-4 py-3 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Perde Ampatman Alanı (m²)</label>
                <input
                  type="number"
                  value={perdeAmpatmanAlani}
                  onChange={(e) => setPerdeAmpatmanAlani(parseFloat(e.target.value) || 0)}
                  className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-amber-50 px-4 py-3 text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* Intermediate Calculations Display */}
            <div className="mt-6 rounded-2xl bg-stone-50 p-4 border border-stone-100 space-y-2 flex-grow">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Hesaplanan Ara Değerler</h3>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Perde Alanı (+Uzunluk * Yukseklik):</span>
                <span className="font-semibold text-stone-900">{formatNumber(perdeCalcs.perdeAlani)} m²</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Perde Ampatman Alanı:</span>
                <span className="font-semibold text-stone-900">{formatNumber(perdeAmpatmanAlani)} m²</span>
              </div>
              <div className="flex justify-between text-sm border-t border-stone-200/60 pt-2 font-bold text-stone-900">
                <span>Toplam Alan (Perde + Ampatman):</span>
                <span>{formatNumber(perdeCalcs.toplamAlan)} m²</span>
              </div>
            </div>

            {/* Pricing inputs & Work items */}
            <div className="mt-8">
              <h3 className="text-lg font-bold text-stone-900 mb-4">Perde Yalıtım Birim Fiyat Girişleri</h3>
              <div className="grid gap-3 sm:grid-cols-5 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-stone-500">Tamir H. (Torba)</label>
                  <input
                    type="number"
                    value={tamirHarciFiyat}
                    onChange={(e) => setTamirHarciFiyat(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-2 py-2 text-xs text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500">Sürme Y. (Kova)</label>
                  <input
                    type="number"
                    value={surmeYalitimFiyat}
                    onChange={(e) => setSurmeYalitimFiyat(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-2 py-2 text-xs text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500">Xps (m²)</label>
                  <input
                    type="number"
                    value={xpsFiyat}
                    onChange={(e) => setXpsFiyat(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-2 py-2 text-xs text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500">Drenaj L. (m²)</label>
                  <input
                    type="number"
                    value={drenajLevhasiFiyat}
                    onChange={(e) => setDrenajLevhasiFiyat(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-2 py-2 text-xs text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500">İşçilik (m²)</label>
                  <input
                    type="number"
                    value={perdeIscilikFiyat}
                    onChange={(e) => setPerdeIscilikFiyat(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-amber-50 px-2 py-2 text-xs text-stone-900 font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-2.5 font-bold">İş Kalemi</th>
                      <th className="py-2.5 font-bold text-right">Miktar</th>
                      <th className="py-2.5 font-bold text-center">Birim</th>
                      <th className="py-2.5 font-bold text-right">B. Fiyat</th>
                      <th className="py-2.5 font-bold text-right">Tutar</th>
                      <th className="py-2.5 font-bold text-right">KDV (%20)</th>
                      <th className="py-2.5 font-bold text-right">KDV Dahil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {perdeCalcs.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-stone-50/50">
                        <td className="py-3 font-semibold text-stone-900">{item.name}</td>
                        <td className="py-3 text-right text-stone-700">{formatNumber(item.miktar)}</td>
                        <td className="py-3 text-center text-stone-500">{item.birim}</td>
                        <td className="py-3 text-right text-stone-900">{formatNumber(item.birimFiyat)} TL</td>
                        <td className="py-3 text-right text-stone-900 font-medium">{formatNumber(item.tutar)} TL</td>
                        <td className="py-3 text-right text-stone-500">{formatNumber(item.kdv)} TL</td>
                        <td className="py-3 text-right text-stone-900 font-bold">{formatNumber(item.toplam)} TL</td>
                      </tr>
                    ))}
                    <tr className="bg-stone-900 text-white font-bold">
                      <td className="py-3 px-2 rounded-l-2xl">TOPLAM</td>
                      <td colSpan={3}></td>
                      <td className="py-3 text-right">{formatNumber(perdeCalcs.toplamTutar)} TL</td>
                      <td className="py-3 text-right">{formatNumber(perdeCalcs.toplamKdv)} TL</td>
                      <td className="py-3 text-right pr-2 rounded-r-2xl">{formatNumber(perdeCalcs.genelToplam)} TL</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* GRAND TOTAL BOARD */}
        <div className="rounded-3xl bg-gradient-to-r from-stone-900 to-amber-900 p-8 text-white shadow-xl">
          <h3 className="text-xl font-bold tracking-wide uppercase text-amber-200">GENEL HAKEDİŞ VE MALZEME ÖZETİ</h3>
          <div className="grid gap-6 mt-6 md:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-5 backdrop-blur border border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Temel Yalıtımı Hakediş</span>
              <div className="mt-2 text-3xl font-extrabold text-white">{formatNumber(temelCalcs.genelToplam)} TL</div>
              <div className="mt-1 text-xs text-white/50">KDV Dahil ({formatNumber(temelCalcs.toplamTutar)} TL + KDV)</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-5 backdrop-blur border border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Perde Yalıtımı Hakediş</span>
              <div className="mt-2 text-3xl font-extrabold text-white">{formatNumber(perdeCalcs.genelToplam)} TL</div>
              <div className="mt-1 text-xs text-white/50">KDV Dahil ({formatNumber(perdeCalcs.toplamTutar)} TL + KDV)</div>
            </div>
            <div className="rounded-2xl bg-amber-500/20 p-5 backdrop-blur border border-amber-500/30">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-200">GENEL YALITIM TOPLAMI</span>
              <div className="mt-2 text-3xl font-black text-amber-100">{formatNumber(temelCalcs.genelToplam + perdeCalcs.genelToplam)} TL</div>
              <div className="mt-1 text-xs text-amber-200/60">KDV Dahil ({formatNumber(temelCalcs.toplamTutar + perdeCalcs.toplamTutar)} TL + KDV)</div>
            </div>
          </div>
        </div>

        {/* HESAP SEÇENEK KARŞILAŞTIRMASI */}
        {temelYalitimTipi && (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <h3 className="text-xl font-bold text-stone-900 mb-1">Temel Yalıtım Seçenek Karşılaştırması</h3>
            <p className="text-sm text-stone-500 mb-6">Farklı malzeme türlerinin toplam hakediş (KDV Dahil) karşılaştırması aşağıda listelenmiştir.</p>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch">
              {/* Klasik Membran Option Card */}
              <div className={`rounded-2xl p-5 border-2 transition ${temelYalitimTipi === 'klasik' ? 'border-amber-500 bg-amber-50/20' : 'border-stone-200 bg-stone-50/50'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-stone-900">Klasik Membran Çözümü</h4>
                    <p className="text-xs text-stone-500 mt-1">2 Kat Membran + Astar + Koruma Betonu + İşçilik</p>
                  </div>
                  {temelYalitimTipi === 'klasik' && (
                    <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase shadow-sm">Aktif Seçim</span>
                  )}
                </div>
                <div className="mt-6">
                  <span className="text-xs text-stone-400 font-semibold block uppercase">Toplam Maliyet (KDV Dahil)</span>
                  <span className="text-2xl font-black text-stone-900 mt-1 block">{formatNumber(comparisonCalcs.classicTotal)} TL</span>
                </div>
              </div>

              {/* Proof Membran Option Card */}
              <div className={`rounded-2xl p-5 border-2 transition ${temelYalitimTipi === 'proof' ? 'border-amber-500 bg-amber-50/20' : 'border-stone-200 bg-stone-50/50'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-stone-900">Proof Membran Çözümü</h4>
                    <p className="text-xs text-stone-500 mt-1">Alteks Proof 3.5mm + İşçilik (Astar ve Betonsuz)</p>
                  </div>
                  {temelYalitimTipi === 'proof' && (
                    <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase shadow-sm">Aktif Seçim</span>
                  )}
                </div>
                <div className="mt-6">
                  <span className="text-xs text-stone-400 font-semibold block uppercase">Toplam Maliyet (KDV Dahil)</span>
                  <span className="text-2xl font-black text-stone-900 mt-1 block">{formatNumber(comparisonCalcs.proofTotal)} TL</span>
                </div>
              </div>

              {/* Comparison Summary Card */}
              <div className="rounded-2xl p-5 bg-gradient-to-br from-amber-500/10 to-amber-900/10 border border-amber-500/20 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-amber-900">Maliyet Karşılaştırma Sonucu</h4>
                  <p className="text-xs text-amber-800/80 mt-0.5">En ekonomik seçenek hangisi?</p>
                </div>
                
                <div className="mt-4">
                  {comparisonCalcs.diff === 0 ? (
                    <div className="text-sm font-semibold text-stone-700">Her iki seçenek de eşit maliyettedir.</div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-stone-800">
                        <strong className="text-amber-800">{comparisonCalcs.cheaperOption}</strong> seçeneği, {comparisonCalcs.expensiveOption} seçeneğine kıyasla daha ekonomiktir.
                      </div>
                      <div className="text-xs text-stone-500">
                        Aradaki fark:
                      </div>
                      <div className="text-xl font-extrabold text-emerald-700">
                        {formatNumber(comparisonCalcs.diff)} TL ({formatNumber(comparisonCalcs.percentage, 1)}%)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= PRINT VIEW (FORMAL REPORT) ================= */}
      <div className="hidden print:block bg-white p-4 text-stone-900 text-xs font-sans leading-normal">
        {/* Document Header */}
        <div className="flex items-start justify-between border-b-2 border-stone-800 pb-4 mb-6">
          <div>
            <div className="text-sm font-bold tracking-widest text-amber-800">BOTANICA LIFE</div>
            <h1 className="text-lg font-black text-stone-900 mt-1">YALITIM METRAJ VE MALİYET RAPORU</h1>
            <p className="text-[10px] text-stone-500">Temel ve Perde Yalıtım İşleri Hakediş ve Sipariş Detayları</p>
          </div>
          <div className="text-right text-[10px] text-stone-500 space-y-1">
            <div><strong>Tarih:</strong> {new Date().toLocaleDateString('tr-TR')}</div>
            <div><strong>Rapor ID:</strong> BTL-INS-{Date.now().toString().slice(-6)}</div>
            <div><strong>Hazırlayan:</strong> {username || 'Sistem Yöneticisi'}</div>
          </div>
        </div>

        {/* Technical Data & Summary Cards */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Temel Parametreler */}
          <div className="border border-stone-200 rounded-xl p-3 bg-stone-50">
            <h3 className="font-bold border-b border-stone-200 pb-1 mb-2 text-stone-800 uppercase tracking-wide">1. TEMEL YALITIM METRAJLARI</h3>
            <table className="w-full text-left text-[10px] space-y-1">
              <tbody>
                <tr><td className="text-stone-500">Yalıtım Tipi:</td><td className="text-right font-bold text-amber-900">{temelYalitimTipi === 'proof' ? 'Proof Membran' : 'Klasik Membran'}</td></tr>
                <tr><td className="text-stone-500">Temel Alanı:</td><td className="text-right font-bold">{formatNumber(temelAlani)} m²</td></tr>
                <tr><td className="text-stone-500">Ampatman Çevresi:</td><td className="text-right font-bold">{formatNumber(ampatmanYuksekligi)} m</td></tr>
                <tr><td className="text-stone-500">Ampatman Yüksekliği:</td><td className="text-right font-bold">{formatNumber(ampatmanYuksekligiM)} m</td></tr>
                {temelYalitimTipi === 'klasik' && (
                  <tr><td className="text-stone-500">Koruma Betonu Kalınlığı:</td><td className="text-right font-bold">{korumaBetonuKalinligi} cm</td></tr>
                )}
                <tr><td className="text-stone-500">Ampatman Yalıtım Alanı:</td><td className="text-right font-bold">{formatNumber(temelCalcs.ampatmanAlani)} m²</td></tr>
                <tr><td className="text-stone-500">Asansör Çukuru Alanı:</td><td className="text-right font-bold">{formatNumber(temelCalcs.asansorAlani)} m²</td></tr>
                <tr><td className="text-stone-500">Ampatman Üzeri Alanı:</td><td className="text-right font-bold">{formatNumber(temelCalcs.ampatmanUzeriAlani)} m²</td></tr>
                <tr className="border-t border-stone-200 pt-1 font-bold"><td className="text-stone-800">Toplam Yalıtım Alanı:</td><td className="text-right">{formatNumber(temelCalcs.toplamAlan)} m²</td></tr>
                <tr className="font-bold text-amber-900"><td className="text-amber-800">Sipariş Rulo Adedi:</td><td className="text-right">{temelCalcs.siparisAdedi} Adet ({temelCalcs.siparisAdediM2} m²)</td></tr>
              </tbody>
            </table>
          </div>

          {/* Perde Parametreler */}
          <div className="border border-stone-200 rounded-xl p-3 bg-stone-50">
            <h3 className="font-bold border-b border-stone-200 pb-1 mb-2 text-stone-800 uppercase tracking-wide">2. PERDE YALITIM METRAJLARI</h3>
            <table className="w-full text-left text-[10px]">
              <tbody>
                <tr><td className="text-stone-500">Perde Uzunluğu:</td><td className="text-right font-bold">{formatNumber(perdeUzunlugu)} m</td></tr>
                <tr><td className="text-stone-500">Perde Yüksekliği:</td><td className="text-right font-bold">{formatNumber(perdeYuksekligi)} m</td></tr>
                <tr><td className="text-stone-500">Perde Alanı:</td><td className="text-right font-bold">{formatNumber(perdeCalcs.perdeAlani)} m²</td></tr>
                <tr><td className="text-stone-500">Perde Ampatman Alanı:</td><td className="text-right font-bold">{formatNumber(perdeAmpatmanAlani)} m²</td></tr>
                <tr className="border-t border-stone-200 pt-1 font-bold"><td className="text-stone-800">Toplam Yalıtım Alanı:</td><td className="text-right">{formatNumber(perdeCalcs.toplamAlan)} m²</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost Tables (A4 Fit) */}
        <div className="space-y-6">
          {/* Temel Kalemler Tablosu */}
          <div>
            <h4 className="font-bold text-[10px] text-stone-800 mb-1.5 uppercase">Temel Yalıtımı Hakediş Detayı ({temelYalitimTipi === 'proof' ? 'Proof Membran' : 'Klasik Membran'})</h4>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-y border-stone-800 text-stone-700 bg-stone-100">
                  <th className="py-1 text-left px-2 font-bold">İş Kalemi</th>
                  <th className="py-1 text-right px-2 font-bold">Miktar</th>
                  <th className="py-1 text-center px-2 font-bold">Birim</th>
                  <th className="py-1 text-right px-2 font-bold">Birim Fiyat</th>
                  <th className="py-1 text-right px-2 font-bold">Tutar</th>
                  <th className="py-1 text-right px-2 font-bold">KDV</th>
                  <th className="py-1 text-right px-2 font-bold">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {temelCalcs.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1.5 px-2 font-bold text-stone-800">{item.name}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(item.miktar)}</td>
                    <td className="py-1.5 px-2 text-center text-stone-500">{item.birim}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(item.birimFiyat)} TL</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(item.tutar)} TL</td>
                    <td className="py-1.5 px-2 text-right text-stone-500">{item.kdv > 0 ? `${formatNumber(item.kdv)} TL` : '-'}</td>
                    <td className="py-1.5 px-2 text-right font-bold">{formatNumber(item.toplam)} TL</td>
                  </tr>
                ))}
                <tr className="bg-stone-50 font-bold border-t border-stone-400">
                  <td className="py-1.5 px-2">TEMEL TOPLAMI</td>
                  <td colSpan={3}></td>
                  <td className="py-1.5 px-2 text-right">{formatNumber(temelCalcs.toplamTutar)} TL</td>
                  <td className="py-1.5 px-2 text-right">{formatNumber(temelCalcs.toplamKdv)} TL</td>
                  <td className="py-1.5 px-2 text-right font-black">{formatNumber(temelCalcs.genelToplam)} TL</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Perde Kalemler Tablosu */}
          <div>
            <h4 className="font-bold text-[10px] text-stone-800 mb-1.5 uppercase">Perde Yalıtımı Hakediş Detayı</h4>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-y border-stone-800 text-stone-700 bg-stone-100">
                  <th className="py-1 text-left px-2 font-bold">İş Kalemi</th>
                  <th className="py-1 text-right px-2 font-bold">Miktar</th>
                  <th className="py-1 text-center px-2 font-bold">Birim</th>
                  <th className="py-1 text-right px-2 font-bold">Birim Fiyat</th>
                  <th className="py-1 text-right px-2 font-bold">Tutar</th>
                  <th className="py-1 text-right px-2 font-bold">KDV (%20)</th>
                  <th className="py-1 text-right px-2 font-bold">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {perdeCalcs.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1.5 px-2 font-bold text-stone-800">{item.name}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(item.miktar)}</td>
                    <td className="py-1.5 px-2 text-center text-stone-500">{item.birim}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(item.birimFiyat)} TL</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(item.tutar)} TL</td>
                    <td className="py-1.5 px-2 text-right text-stone-500">{formatNumber(item.kdv)} TL</td>
                    <td className="py-1.5 px-2 text-right font-bold">{formatNumber(item.toplam)} TL</td>
                  </tr>
                ))}
                <tr className="bg-stone-50 font-bold border-t border-stone-400">
                  <td className="py-1.5 px-2">PERDE TOPLAMI</td>
                  <td colSpan={3}></td>
                  <td className="py-1.5 px-2 text-right">{formatNumber(perdeCalcs.toplamTutar)} TL</td>
                  <td className="py-1.5 px-2 text-right">{formatNumber(perdeCalcs.toplamKdv)} TL</td>
                  <td className="py-1.5 px-2 text-right font-black">{formatNumber(perdeCalcs.genelToplam)} TL</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Grand Total Board */}
        <div className="mt-8 border-2 border-stone-900 rounded-xl p-4 bg-stone-900 text-white flex items-center justify-between">
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-400">GENEL TOPLAM</h4>
            <p className="text-[9px] text-stone-300">Temel ve Perde Yalıtım Maliyeti Birleşik Özeti</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-black">{formatNumber(temelCalcs.genelToplam + perdeCalcs.genelToplam)} TL</div>
            <div className="text-[9px] text-stone-400">KDV Dahil ({formatNumber(temelCalcs.toplamTutar + perdeCalcs.toplamTutar)} TL + KDV)</div>
          </div>
        </div>

        {/* Signatures Section */}
        <div className="mt-12 grid grid-cols-2 gap-12 text-center pt-8 border-t border-stone-200">
          <div>
            <div className="text-[10px] text-stone-500 uppercase">Hazırlayan</div>
            <div className="mt-8 font-bold border-b border-stone-300 pb-1 text-stone-800">{username || 'Sistem Yöneticisi'}</div>
            <div className="text-[9px] text-stone-400">İmza / Tarih</div>
          </div>
          <div>
            <div className="text-[10px] text-stone-500 uppercase">Kontrol Eden / Onaylayan</div>
            <div className="mt-8 font-bold border-b border-stone-300 pb-1 text-stone-800">............................................</div>
            <div className="text-[9px] text-stone-400">İmza / Tarih</div>
          </div>
        </div>
      </div>
    </>
  )
}
