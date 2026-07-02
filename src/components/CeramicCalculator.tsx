'use client'

import { useState, useMemo, useEffect } from 'react'

type TileProfile = {
  id: string
  name: string
  wCm: number
  hCm: number
  boxAreaM2: number
  m2Price: number
  wasteRate: number // %
}

type TakeoffLine = {
  id: string
  description: string
  type: 'zemin' | 'duvar'
  width: number
  height: number
  count: number
  deduction: number // m2
  tileProfileId: string
}

type ConsumableRates = {
  adhesiveKgPerM2: number // default 5.0
  groutKgPerM2: number // default 0.35
  clipsCoveragePerM2: number // m2 covered by 1 pack (default 20 m2)
}

type ConsumablePrices = {
  adhesiveBag: number // TL/25kg Bag
  groutBag: number // TL/5kg Bag
  clipsPackage: number // TL/Package
  
  // Labor
  laborZemin: number // TL/m2
  laborDuvar: number // TL/m2
}

type SavedProject = {
  id: string
  projectName: string
  project: {
    isCeramic: boolean
    projectName: string
    takeoffs: TakeoffLine[]
    tileProfiles: TileProfile[]
    consumableRates: ConsumableRates
    consumablePrices: ConsumablePrices
  }
  username: string
  createdAt: string
  updatedAt: string
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const defaultTileProfiles = (): TileProfile[] => [
  { id: 'profile-1', name: '60x120 Rektifiyeli Porselen', wCm: 60, hCm: 120, boxAreaM2: 1.44, m2Price: 250, wasteRate: 10 },
  { id: 'profile-2', name: '30x60 Duvar Seramiği', wCm: 30, hCm: 60, boxAreaM2: 1.62, m2Price: 180, wasteRate: 8 },
  { id: 'profile-3', name: '60x60 Yer Seramiği', wCm: 60, hCm: 60, boxAreaM2: 1.44, m2Price: 200, wasteRate: 8 },
  { id: 'profile-4', name: '45x45 Zemin Seramiği', wCm: 45, hCm: 45, boxAreaM2: 1.62, m2Price: 160, wasteRate: 7 }
]

const defaultConsumableRates: ConsumableRates = {
  adhesiveKgPerM2: 5.0,
  groutKgPerM2: 0.35,
  clipsCoveragePerM2: 20
}

const defaultConsumablePrices: ConsumablePrices = {
  adhesiveBag: 150,
  groutBag: 120,
  clipsPackage: 90,
  
  laborZemin: 140,
  laborDuvar: 160
}

const defaultTakeoff = (profiles: TileProfile[]): TakeoffLine => ({
  id: createId(),
  description: '',
  type: 'zemin',
  width: 0,
  height: 0,
  count: 1,
  deduction: 0,
  tileProfileId: profiles[0]?.id || ''
})

export default function CeramicCalculator({ username }: { username: string }) {
  // --- STATE ---
  const [projectName, setProjectName] = useState<string>('')
  const [tileProfiles, setTileProfiles] = useState<TileProfile[]>(defaultTileProfiles())
  const [takeoffs, setTakeoffs] = useState<TakeoffLine[]>([])
  const [consumableRates, setConsumableRates] = useState<ConsumableRates>(defaultConsumableRates)
  const [consumablePrices, setConsumablePrices] = useState<ConsumablePrices>(defaultConsumablePrices)
  
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'loading'>('idle')
  const [serverMessage, setServerMessage] = useState<string>('')
  const [showConfig, setShowConfig] = useState<boolean>(false)

  // Initialize takeoffs on mount once profiles are available
  useEffect(() => {
    if (takeoffs.length === 0) {
      setTakeoffs([defaultTakeoff(tileProfiles)])
    }
  }, [tileProfiles])

  // --- DATABASE SYNC ---
  const refreshSavedProjects = async (nextActiveId?: string | null) => {
    const response = await fetch('/api/material-procurement-projects')
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Kayıtlar yenilenemedi.')
    }
    const nextProjects = Array.isArray(data) ? data : []
    const filtered = nextProjects.filter((p: any) => p.project?.isCeramic === true)
    setSavedProjects(filtered)
    if (typeof nextActiveId !== 'undefined') {
      setActiveProjectId(nextActiveId)
    }
    return filtered
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
      setServerMessage('Supabase kaydı için önce bir proje/blok adı girin (Örn: A Blok Seramik Metrajı).')
      return
    }

    setSaveState('saving')
    setServerMessage('')

    try {
      const payload = {
        id: activeProjectId || undefined,
        project: {
          isCeramic: true,
          projectName: projectName,
          takeoffs,
          tileProfiles,
          consumableRates,
          consumablePrices
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

  const deleteProjectFromSupabase = async (id: string) => {
    if (!confirm('Bu projeyi tamamen silmek istediğinizden emin misiniz?')) return
    setSaveState('saving')
    setServerMessage('')

    try {
      const response = await fetch(`/api/material-procurement-projects?id=${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Silme işlemi başarısız.')
      }

      if (activeProjectId === id) {
        clearForm()
      } else {
        await refreshSavedProjects()
      }
      setServerMessage('Kayıt Supabase üzerinden silindi.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Silme işlemi başarısız.'
      setServerMessage(message)
    } finally {
      setSaveState('idle')
    }
  }

  const loadSavedProject = (saved: SavedProject) => {
    const proj = saved.project || {}
    setProjectName(saved.projectName || '')
    setTileProfiles(proj.tileProfiles || defaultTileProfiles())
    setTakeoffs(proj.takeoffs || [defaultTakeoff(proj.tileProfiles || defaultTileProfiles())])
    setConsumableRates(proj.consumableRates || defaultConsumableRates)
    setConsumablePrices(proj.consumablePrices || defaultConsumablePrices)
    setActiveProjectId(saved.id)
    setServerMessage(`"${saved.projectName}" projesi Supabase üzerinden yüklendi.`)
  }

  const clearForm = () => {
    setProjectName('')
    setTileProfiles(defaultTileProfiles())
    setTakeoffs([defaultTakeoff(defaultTileProfiles())])
    setConsumableRates(defaultConsumableRates)
    setConsumablePrices(defaultConsumablePrices)
    setActiveProjectId(null)
    setServerMessage('')
  }

  const fillDemo = () => {
    setProjectName('Örnek Blok Seramik Metrajı')
    const currentProfiles = tileProfiles.length > 0 ? tileProfiles : defaultTileProfiles()
    setTakeoffs([
      {
        id: createId(),
        description: 'Kat 1 - Banyo Zemin (60x60 Yer Seramiği)',
        type: 'zemin',
        width: 2.4,
        height: 3.5,
        count: 2,
        deduction: 0.8,
        tileProfileId: 'profile-3'
      },
      {
        id: createId(),
        description: 'Kat 1 - Banyo Duvarları (30x60 Duvar Seramiği)',
        type: 'duvar',
        width: 11.8,
        height: 2.7,
        count: 2,
        deduction: 3.6,
        tileProfileId: 'profile-2'
      },
      {
        id: createId(),
        description: 'Kat 1 - Salon Balkonu (60x120 Porselen)',
        type: 'zemin',
        width: 1.8,
        height: 6.2,
        count: 2,
        deduction: 0,
        tileProfileId: 'profile-1'
      }
    ])
    setServerMessage('Demo verisi yüklendi.')
  }

  // --- DYNAMIC CALCULATIONS ---
  const calculations = useMemo(() => {
    let totalZeminArea = 0
    let totalDuvarArea = 0
    let totalNetArea = 0

    // Process each takeoff row
    const processedRows = takeoffs.map(row => {
      const grossArea = row.width * row.height * row.count
      const netArea = Math.max(grossArea - row.deduction, 0)
      const selectedTile = tileProfiles.find(p => p.id === row.tileProfileId)

      return {
        ...row,
        grossArea,
        netArea,
        selectedTileName: selectedTile ? selectedTile.name : 'Seçilmemiş'
      }
    })

    // Sum areas
    processedRows.forEach(row => {
      totalNetArea += row.netArea
      if (row.type === 'zemin') {
        totalZeminArea += row.netArea
      } else {
        totalDuvarArea += row.netArea
      }
    })

    // Group by selected Tile Profile to compute required tiles, boxes, and ordering details
    const tileSummaryMap = new Map<string, {
      profile: TileProfile
      netArea: number
      withWasteArea: number
      requiredBoxes: number
      orderedArea: number
      cost: number
    }>()

    processedRows.forEach(row => {
      const selectedTile = tileProfiles.find(p => p.id === row.tileProfileId)
      if (!selectedTile) return

      const existing = tileSummaryMap.get(row.tileProfileId) || {
        profile: selectedTile,
        netArea: 0,
        withWasteArea: 0,
        requiredBoxes: 0,
        orderedArea: 0,
        cost: 0
      }

      existing.netArea += row.netArea
      tileSummaryMap.set(row.tileProfileId, existing)
    })

    // Compute boxes and totals per tile profile
    const tileSummaries = Array.from(tileSummaryMap.values()).map(summary => {
      const withWasteArea = summary.netArea * (1 + summary.profile.wasteRate / 100)
      const requiredBoxes = Math.ceil(withWasteArea / summary.profile.boxAreaM2)
      const orderedArea = requiredBoxes * summary.profile.boxAreaM2
      const cost = orderedArea * summary.profile.m2Price
      
      return {
        ...summary,
        withWasteArea,
        requiredBoxes,
        orderedArea,
        cost
      }
    })

    // Consumables quantities
    const totalAdhesiveKg = totalNetArea * consumableRates.adhesiveKgPerM2
    const adhesiveBags = Math.ceil(totalAdhesiveKg / 25)

    const totalGroutKg = totalNetArea * consumableRates.groutKgPerM2
    const groutBags = Math.ceil(totalGroutKg / 5)

    const clipsPackages = Math.ceil(totalNetArea / consumableRates.clipsCoveragePerM2)

    // Bill of Materials & Subcontractor Labor Costing
    const items: Array<{
      group: 'Seramik Malzemeleri' | 'Sarf Malzemeler' | 'İşçilik Kalemleri'
      name: string
      amount: number
      unit: string
      price: number
    }> = []

    // 1. Add Ceramics
    tileSummaries.forEach(summary => {
      items.push({
        group: 'Seramik Malzemeleri',
        name: `${summary.profile.name} (Sipariş: ${summary.requiredBoxes} Kutu)`,
        amount: summary.orderedArea,
        unit: 'm²',
        price: summary.profile.m2Price
      })
    })

    // 2. Add Consumables
    if (totalNetArea > 0) {
      items.push({
        group: 'Sarf Malzemeler',
        name: 'Seramik Yapıştırıcısı (Kalekim - 25 kg)',
        amount: adhesiveBags,
        unit: 'Torba',
        price: consumablePrices.adhesiveBag
      })
      items.push({
        group: 'Sarf Malzemeler',
        name: 'Derz Dolgusu (5 kg)',
        amount: groutBags,
        unit: 'Torba',
        price: consumablePrices.groutBag
      })
      items.push({
        group: 'Sarf Malzemeler',
        name: 'Derz Artısı / Klips Sistemi Paketi',
        amount: clipsPackages,
        unit: 'Paket',
        price: consumablePrices.clipsPackage
      })

      // 3. Add Labor
      if (totalZeminArea > 0) {
        items.push({
          group: 'İşçilik Kalemleri',
          name: 'Zemin Seramiği Döşeme İşçiliği',
          amount: totalZeminArea,
          unit: 'm²',
          price: consumablePrices.laborZemin
        })
      }
      if (totalDuvarArea > 0) {
        items.push({
          group: 'İşçilik Kalemleri',
          name: 'Duvar Seramiği Döşeme İşçiliği',
          amount: totalDuvarArea,
          unit: 'm²',
          price: consumablePrices.laborDuvar
        })
      }
    }

    const calculatedItems = items.map(item => {
      const net = item.amount * item.price
      const kdv = net * 0.20
      const total = net + kdv
      return {
        ...item,
        net,
        kdv,
        total
      }
    })

    const ceramicTotal = calculatedItems
      .filter(item => item.group === 'Seramik Malzemeleri')
      .reduce((sum, item) => sum + item.total, 0)
      
    const consumableTotal = calculatedItems
      .filter(item => item.group === 'Sarf Malzemeler')
      .reduce((sum, item) => sum + item.total, 0)

    const laborTotal = calculatedItems
      .filter(item => item.group === 'İşçilik Kalemleri')
      .reduce((sum, item) => sum + item.total, 0)

    const grandNet = calculatedItems.reduce((sum, item) => sum + item.net, 0)
    const grandKdv = calculatedItems.reduce((sum, item) => sum + item.kdv, 0)
    const grandTotal = grandNet + grandKdv

    return {
      rows: processedRows,
      totalZeminArea,
      totalDuvarArea,
      totalNetArea,
      tileSummaries,
      items: calculatedItems,
      ceramicTotal,
      consumableTotal,
      laborTotal,
      grandNet,
      grandKdv,
      grandTotal
    }
  }, [takeoffs, tileProfiles, consumableRates, consumablePrices])

  // --- ACTIONS ---
  const addTakeoffRow = () => {
    setTakeoffs(prev => [...prev, defaultTakeoff(tileProfiles)])
  }

  const updateTakeoffRow = (id: string, field: keyof TakeoffLine, value: any) => {
    setTakeoffs(prev =>
      prev.map(row => (row.id === id ? { ...row, [field]: value } : row))
    )
  }

  const duplicateTakeoffRow = (row: TakeoffLine) => {
    setTakeoffs(prev => [
      ...prev,
      {
        ...row,
        id: createId(),
        description: row.description ? `${row.description} (Kopya)` : ''
      }
    ])
  }

  const deleteTakeoffRow = (id: string) => {
    if (takeoffs.length <= 1) {
      setTakeoffs([defaultTakeoff(tileProfiles)])
      return
    }
    setTakeoffs(prev => prev.filter(row => row.id !== id))
  }

  // Configurations
  const addTileProfile = () => {
    setTileProfiles(prev => [
      ...prev,
      { id: createId(), name: 'Yeni Seramik Boyutu', wCm: 60, hCm: 60, boxAreaM2: 1.44, m2Price: 200, wasteRate: 8 }
    ])
  }

  const updateTileProfile = (id: string, field: keyof TileProfile, value: any) => {
    setTileProfiles(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  const deleteTileProfile = (id: string) => {
    if (tileProfiles.length <= 1) return
    setTileProfiles(prev => prev.filter(p => p.id !== id))
    // Fallback rows to first profile if current was deleted
    const remaining = tileProfiles.filter(p => p.id !== id)
    setTakeoffs(prev =>
      prev.map(row => (row.tileProfileId === id ? { ...row, tileProfileId: remaining[0]?.id || '' } : row))
    )
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  return (
    <div className="space-y-6 pb-20">
      
      {/* Database Controls Banner */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-stone-400">AKTİF SERAMİK HESAP ADI</div>
            <input
              type="text"
              placeholder="Örn: B Blok Banyo Seramik Metrajı"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="mt-0.5 bg-transparent text-sm font-bold text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-b focus:ring-amber-500 border-b border-dashed border-stone-300 pb-0.5 min-w-[240px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={saveProjectToSupabase}
            disabled={saveState === 'saving'}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {saveState === 'saving' ? 'Kaydediliyor...' : 'Kaydet (Supabase)'}
          </button>
          
          <button
            onClick={clearForm}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition cursor-pointer"
          >
            Yeni / Temizle
          </button>

          <button
            onClick={fillDemo}
            className="rounded-xl border border-stone-200 bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200 transition cursor-pointer"
          >
            Demo Yükle
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer"
          >
            <svg className="h-4 w-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Yazdır / PDF
          </button>
        </div>
      </div>

      {serverMessage && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs font-semibold text-amber-800 flex items-center justify-between animate-fade-in">
          <span>{serverMessage}</span>
          <button onClick={() => setServerMessage('')} className="text-amber-500 hover:text-amber-800 font-bold ml-2">Kapat</button>
        </div>
      )}

      {/* KPI summaries dashboard */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <span className="text-xs font-semibold text-stone-400 block uppercase">Zemin Seramiği</span>
          <span className="mt-2 text-2xl font-black text-stone-900 block">{formatNumber(calculations.totalZeminArea)} m²</span>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <span className="text-xs font-semibold text-stone-400 block uppercase">Duvar Seramiği</span>
          <span className="mt-2 text-2xl font-black text-stone-900 block">{formatNumber(calculations.totalDuvarArea)} m²</span>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <span className="text-xs font-semibold text-stone-400 block uppercase">Toplam Net Alan</span>
          <span className="mt-2 text-2xl font-black text-stone-900 block">{formatNumber(calculations.totalNetArea)} m²</span>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <span className="text-xs font-semibold text-stone-400 block uppercase">Malzeme Maliyeti</span>
          <span className="mt-2 text-2xl font-black text-stone-900 block">{formatNumber(calculations.ceramicTotal + calculations.consumableTotal)} TL</span>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 bg-amber-50/50">
          <span className="text-xs font-bold text-amber-800 block uppercase">Toplam Hakediş</span>
          <span className="mt-2 text-2xl font-black text-amber-900 block">{formatNumber(calculations.grandTotal)} TL</span>
          <span className="text-[10px] text-amber-800/60 mt-1 block">KDV Dahil</span>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Takeoff sheet and costing list */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metraj cetveli mahal listesi */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">1. Seramik Metraj Cetveli</h3>
                <p className="text-xs text-stone-500 mt-1">İlgili mahal ve seramik boyutlarını seçerek adetleri girin. Kapı, küvet vb. için minha alanı düşülebilir.</p>
              </div>
              <button
                onClick={addTakeoffRow}
                className="flex items-center gap-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 text-xs font-bold transition cursor-pointer"
              >
                + Satır Ekle
              </button>
            </div>

            {/* Takeoff Grid Spreadsheet */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-400 uppercase font-semibold">
                    <th className="py-2.5 w-[5%] text-center">#</th>
                    <th className="py-2.5 w-[25%] pl-2">Mahal / Açıklama</th>
                    <th className="py-2.5 w-[15%]">Uygulama</th>
                    <th className="py-2.5 w-[22%]">Seramik Boyutu / Türü</th>
                    <th className="py-2.5 w-[8%] text-center">En (m)</th>
                    <th className="py-2.5 w-[8%] text-center">Boy (m)</th>
                    <th className="py-2.5 w-[6%] text-center">Adet</th>
                    <th className="py-2.5 w-[8%] text-center">Minha (m²)</th>
                    <th className="py-2.5 w-[10%] text-right pr-2">Net (m²)</th>
                    <th className="py-2.5 w-[8%] text-center">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {takeoffs.map((row, idx) => {
                    const gross = row.width * row.height * row.count
                    const net = Math.max(gross - row.deduction, 0)
                    
                    return (
                      <tr key={row.id} className="hover:bg-stone-50/50">
                        <td className="py-2.5 text-center text-stone-400">{idx + 1}</td>
                        <td className="py-2.5 pl-2">
                          <input
                            type="text"
                            value={row.description}
                            placeholder="Örn: 2. Kat Ebeveyn Banyo"
                            onChange={(e) => updateTakeoffRow(row.id, 'description', e.target.value)}
                            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 px-2 py-1 text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <select
                            value={row.type}
                            onChange={(e) => updateTakeoffRow(row.id, 'type', e.target.value)}
                            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 px-2 py-1 text-xs text-stone-900 focus:bg-white focus:outline-none font-medium cursor-pointer"
                          >
                            <option value="zemin">Zemin Seramiği</option>
                            <option value="duvar">Duvar Seramiği</option>
                          </select>
                        </td>
                        <td className="py-2.5 pr-2">
                          <select
                            value={row.tileProfileId}
                            onChange={(e) => updateTakeoffRow(row.id, 'tileProfileId', e.target.value)}
                            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 px-2 py-1 text-xs text-stone-900 focus:bg-white focus:outline-none font-medium cursor-pointer"
                          >
                            {tileProfiles.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.wCm}x{p.hCm}cm)</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-1">
                          <input
                            type="number"
                            step="0.01"
                            value={row.width || ''}
                            placeholder="0"
                            onChange={(e) => updateTakeoffRow(row.id, 'width', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 px-1 py-1 text-center text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                          />
                        </td>
                        <td className="py-2.5 px-1">
                          <input
                            type="number"
                            step="0.01"
                            value={row.height || ''}
                            placeholder="0"
                            onChange={(e) => updateTakeoffRow(row.id, 'height', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 px-1 py-1 text-center text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                          />
                        </td>
                        <td className="py-2.5 px-1">
                          <input
                            type="number"
                            value={row.count || ''}
                            placeholder="1"
                            onChange={(e) => updateTakeoffRow(row.id, 'count', parseInt(e.target.value) || 1)}
                            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 px-1 py-1 text-center text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                          />
                        </td>
                        <td className="py-2.5 px-1">
                          <input
                            type="number"
                            step="0.1"
                            value={row.deduction || ''}
                            placeholder="0"
                            onChange={(e) => updateTakeoffRow(row.id, 'deduction', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 px-1 py-1 text-center text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                          />
                        </td>
                        <td className="py-2.5 text-right pr-2 font-bold text-stone-950">
                          {formatNumber(net)}
                        </td>
                        <td className="py-2.5 text-center flex items-center justify-center gap-1.5 mt-0.5">
                          <button
                            onClick={() => duplicateTakeoffRow(row)}
                            title="Kopyala"
                            className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 transition cursor-pointer"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteTakeoffRow(row.id)}
                            title="Sil"
                            className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Costing breakdown */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <h3 className="text-lg font-bold text-stone-900 mb-4">2. Sipariş Listesi ve Yaklaşık Hakediş</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 text-xs">
                    <th className="py-2.5 font-bold">Kategori</th>
                    <th className="py-2.5 font-bold pl-2">Kalem Tanımı</th>
                    <th className="py-2.5 font-bold text-right">Gerekli Miktar</th>
                    <th className="py-2.5 font-bold text-center">Birim</th>
                    <th className="py-2.5 font-bold text-right">Birim Fiyat</th>
                    <th className="py-2.5 font-bold text-right">KDV Dahil Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs font-semibold">
                  {calculations.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/50">
                      <td className="py-3 text-stone-400 text-[10px] uppercase font-bold">{item.group}</td>
                      <td className="py-3 pl-2 text-stone-900 font-bold">{item.name}</td>
                      <td className="py-3 text-right text-stone-700">{formatNumber(item.amount)}</td>
                      <td className="py-3 text-center text-stone-500 font-medium">{item.unit}</td>
                      <td className="py-3 text-right text-stone-900">{formatNumber(item.price)} TL</td>
                      <td className="py-3 text-right text-stone-950 font-bold">{formatNumber(item.total)} TL</td>
                    </tr>
                  ))}
                  
                  {calculations.items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-stone-400 font-medium">Metraj cetveline değer girildiğinde malzeme maliyetleri burada hesaplanır.</td>
                    </tr>
                  )}

                  <tr className="bg-stone-900 text-white font-bold text-xs">
                    <td className="py-3 px-2 rounded-l-2xl" colSpan={2}>HAKEDİŞ GENEL TOPLAMI</td>
                    <td colSpan={3}></td>
                    <td className="py-3 text-right pr-2 rounded-r-2xl text-amber-300 font-black text-sm">{formatNumber(calculations.grandTotal)} TL</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-6 text-xs font-semibold text-stone-500 justify-end">
              <div>Net Tutar: <span className="text-stone-900">{formatNumber(calculations.grandNet)} TL</span></div>
              <div>KDV (%20): <span className="text-stone-900">{formatNumber(calculations.grandKdv)} TL</span></div>
              <div>Genel Toplam: <span className="text-amber-800 font-bold">{formatNumber(calculations.grandTotal)} TL</span></div>
            </div>
          </div>
        </div>

        {/* Right Column: Settings and DB list */}
        <div className="space-y-6">
          {/* Settings panel */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex w-full items-center justify-between text-left focus:outline-none cursor-pointer"
            >
              <div>
                <h3 className="text-base font-bold text-stone-900">Birim Fiyat ve Seramik Ayarları</h3>
                <p className="text-[10px] text-stone-500 mt-0.5">Derz katsayılarını, seramik ebatlarını ve birim maliyetleri yönetin.</p>
              </div>
              <span className={`text-stone-400 transition-transform ${showConfig ? 'rotate-180' : ''}`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>

            {showConfig && (
              <div className="mt-6 space-y-6 border-t border-stone-100 pt-5">
                
                {/* Tile Profiles Configuration */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">Seramik Ebat Tanımları</h4>
                    <button
                      onClick={addTileProfile}
                      className="text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-0.5 rounded cursor-pointer"
                    >
                      + Yeni Ebat
                    </button>
                  </div>
                  
                  <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                    {tileProfiles.map(p => (
                      <div key={p.id} className="p-3 bg-stone-50 rounded-xl border border-stone-100 space-y-2 relative">
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => updateTileProfile(p.id, 'name', e.target.value)}
                          className="w-[85%] text-xs font-bold text-stone-900 bg-transparent border-b border-dashed border-stone-300 focus:outline-none pb-0.5"
                        />
                        
                        <button
                          onClick={() => deleteTileProfile(p.id)}
                          className="absolute top-2 right-2 text-stone-400 hover:text-red-500 transition cursor-pointer"
                          title="Sil"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-stone-500">
                          <div>
                            <span>Kutu Alanı (m²):</span>
                            <input
                              type="number"
                              step="0.01"
                              value={p.boxAreaM2}
                              onChange={(e) => updateTileProfile(p.id, 'boxAreaM2', parseFloat(e.target.value) || 0)}
                              className="mt-0.5 w-full rounded border border-stone-200 bg-white p-1 text-stone-900 font-bold text-center"
                            />
                          </div>
                          <div>
                            <span>Fiyat (TL/m²):</span>
                            <input
                              type="number"
                              value={p.m2Price}
                              onChange={(e) => updateTileProfile(p.id, 'm2Price', parseFloat(e.target.value) || 0)}
                              className="mt-0.5 w-full rounded border border-stone-200 bg-white p-1 text-stone-900 font-bold text-center"
                            />
                          </div>
                          <div className="col-span-2">
                            <span>Metraj Fire Oranı (%):</span>
                            <input
                              type="number"
                              value={p.wasteRate}
                              onChange={(e) => updateTileProfile(p.id, 'wasteRate', parseFloat(e.target.value) || 0)}
                              className="mt-0.5 w-full rounded border border-stone-200 bg-white p-1 text-stone-900 font-bold text-center"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Consumables configuration */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3">Sarfiyat ve Birim Fiyatlar</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Yapıştırıcı (kg/m²):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={consumableRates.adhesiveKgPerM2}
                        onChange={(e) => setConsumableRates(prev => ({ ...prev, adhesiveKgPerM2: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-center font-semibold text-stone-700"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Yapıştırıcı Torba (TL/25kg):</span>
                      <input
                        type="number"
                        value={consumablePrices.adhesiveBag}
                        onChange={(e) => setConsumablePrices(prev => ({ ...prev, adhesiveBag: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Derz Dolgusu (kg/m²):</span>
                      <input
                        type="number"
                        step="0.01"
                        value={consumableRates.groutKgPerM2}
                        onChange={(e) => setConsumableRates(prev => ({ ...prev, groutKgPerM2: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-center font-semibold text-stone-700"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Derz Dolgusu Paket (TL/5kg):</span>
                      <input
                        type="number"
                        value={consumablePrices.groutBag}
                        onChange={(e) => setConsumablePrices(prev => ({ ...prev, groutBag: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Derz Artısı/Klips (TL/Paket):</span>
                      <input
                        type="number"
                        value={consumablePrices.clipsPackage}
                        onChange={(e) => setConsumablePrices(prev => ({ ...prev, clipsPackage: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Subcontractor Labor */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3">Döşeme İşçilik Fiyatları</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Zemin Döşeme (TL/m²):</span>
                      <input
                        type="number"
                        value={consumablePrices.laborZemin}
                        onChange={(e) => setConsumablePrices(prev => ({ ...prev, laborZemin: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Duvar Döşeme (TL/m²):</span>
                      <input
                        type="number"
                        value={consumablePrices.laborDuvar}
                        onChange={(e) => setConsumablePrices(prev => ({ ...prev, laborDuvar: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Saved Projects list */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <h3 className="text-base font-bold text-stone-900 mb-4">Kayıtlı Projeler</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {savedProjects.map(saved => (
                <div key={saved.id} className={`flex items-center justify-between p-3 rounded-2xl border transition ${activeProjectId === saved.id ? 'border-amber-500 bg-amber-50/20' : 'border-stone-100 bg-stone-50/30 hover:bg-stone-50'}`}>
                  <button
                    onClick={() => loadSavedProject(saved)}
                    className="flex-1 text-left focus:outline-none cursor-pointer"
                  >
                    <span className="text-xs font-bold text-stone-950 block">{saved.projectName}</span>
                    <span className="text-[10px] text-stone-400 mt-0.5 block">{new Date(saved.updatedAt || saved.createdAt).toLocaleDateString('tr-TR')} - {saved.username}</span>
                  </button>
                  <button
                    onClick={() => deleteProjectFromSupabase(saved.id)}
                    className="p-1.5 text-stone-400 hover:text-red-600 transition rounded-lg hover:bg-red-50 cursor-pointer ml-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              
              {savedProjects.length === 0 && (
                <div className="text-center text-stone-400 text-xs py-8">Supabase üzerinde henüz seramik metraj kaydı bulunmuyor.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= PRINT VIEW (FORMAL REPORT) ================= */}
      <div className="hidden print:block bg-white p-4 text-stone-900 text-xs font-sans leading-normal">
        {/* Document Header */}
        <div className="flex items-start justify-between border-b-2 border-stone-800 pb-4 mb-6">
          <div>
            <div className="text-sm font-bold tracking-widest text-amber-800">BOTANICA LIFE</div>
            <h1 className="text-lg font-black text-stone-900 mt-1">SERAMİK METRAJ VE MALİYET RAPORU</h1>
            <p className="text-[10px] text-stone-500">Zemin & Duvar Seramiği İmalat Sipariş Listesi</p>
          </div>
          <div className="text-right text-[10px] text-stone-500 space-y-1">
            <div><strong>Tarih:</strong> {new Date().toLocaleDateString('tr-TR')}</div>
            <div><strong>Rapor ID:</strong> BTL-CER-{Date.now().toString().slice(-6)}</div>
            <div><strong>Hazırlayan:</strong> {username || 'Sistem Yöneticisi'}</div>
          </div>
        </div>

        {/* Technical Data Summary */}
        <div className="border border-stone-200 rounded-xl p-3 bg-stone-50 mb-6">
          <h3 className="font-bold border-b border-stone-200 pb-1 mb-2 text-stone-800 uppercase tracking-wide text-[10px]">1. SERAMİK METRAJ ÖZETİ</h3>
          <table className="w-full text-left text-[10px]">
            <tbody>
              <tr><td className="text-stone-500 py-0.5">Proje/Blok Adı:</td><td className="text-right font-bold text-amber-900">{projectName || 'Belirtilmemiş'}</td></tr>
              <tr><td className="text-stone-500 py-0.5">Toplam Zemin Seramiği Alanı:</td><td className="text-right font-bold">{formatNumber(calculations.totalZeminArea)} m²</td></tr>
              <tr><td className="text-stone-500 py-0.5">Toplam Duvar Seramiği Alanı:</td><td className="text-right font-bold">{formatNumber(calculations.totalDuvarArea)} m²</td></tr>
              <tr><td className="text-stone-500 py-0.5">Toplam Metraj Alanı (Net):</td><td className="text-right font-bold">{formatNumber(calculations.totalNetArea)} m²</td></tr>
              <tr className="border-t border-stone-200 font-bold text-stone-800"><td className="py-1">Seramik & Yapıştırıcı Maliyeti:</td><td className="text-right py-1">{formatNumber(calculations.ceramicTotal + calculations.consumableTotal)} TL</td></tr>
              <tr className="font-bold text-stone-800"><td>İşçilik Hakediş Toplamı:</td><td className="text-right">{formatNumber(calculations.laborTotal)} TL</td></tr>
              <tr className="font-bold text-amber-950 text-xs"><td>GENEL TOPLAM (KDV DAHİL):</td><td className="text-right">{formatNumber(calculations.grandTotal)} TL</td></tr>
            </tbody>
          </table>
        </div>

        {/* Detailed Takeoff Cetveli */}
        <div className="mb-6">
          <h3 className="font-bold border-b border-stone-800 pb-1 mb-2 text-stone-800 uppercase tracking-wide text-[10px]">2. DETAYLI METRAJ CETVELİ</h3>
          <table className="w-full text-left text-[9px] border-collapse">
            <thead>
              <tr className="border-b border-stone-300 text-stone-500 uppercase font-semibold">
                <th className="py-1">#</th>
                <th className="py-1 pl-2">Mahal Açıklaması</th>
                <th className="py-1">Uygulama</th>
                <th className="py-1">Seramik Seçimi</th>
                <th className="py-1 text-center">En (m)</th>
                <th className="py-1 text-center">Boy (m)</th>
                <th className="py-1 text-center">Adet</th>
                <th className="py-1 text-center">Minha (m²)</th>
                <th className="py-1 text-right">Net Alan (m²)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {calculations.rows.map((row, idx) => (
                <tr key={row.id}>
                  <td className="py-1 text-stone-400">{idx + 1}</td>
                  <td className="py-1 pl-2 text-stone-900 font-bold">{row.description || '-'}</td>
                  <td className="py-1 text-stone-600">{row.type === 'zemin' ? 'Zemin Seramiği' : 'Duvar Seramiği'}</td>
                  <td className="py-1 text-stone-600">{row.selectedTileName}</td>
                  <td className="py-1 text-center">{formatNumber(row.width)}</td>
                  <td className="py-1 text-center">{formatNumber(row.height)}</td>
                  <td className="py-1 text-center">{row.count}</td>
                  <td className="py-1 text-center text-red-600">-{formatNumber(row.deduction)}</td>
                  <td className="py-1 text-right font-bold text-stone-950">{formatNumber(row.netArea)} m²</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tiles Ordered Summary */}
        <div className="mb-6">
          <h3 className="font-bold border-b border-stone-800 pb-1 mb-2 text-stone-800 uppercase tracking-wide text-[10px]">3. SERAMİK EBAT BAZLI SİPARİŞ LİSTESİ</h3>
          <table className="w-full text-left text-[9px] border-collapse">
            <thead>
              <tr className="border-b border-stone-300 text-stone-500 uppercase font-semibold">
                <th className="py-1 pl-2">Seramik Türü</th>
                <th className="py-1 text-right">Net Alan (m²)</th>
                <th className="py-1 text-right">Fireli Alan (m²)</th>
                <th className="py-1 text-center">Kutu Alanı (m²)</th>
                <th className="py-1 text-right font-bold text-amber-800">Sipariş (Kutu)</th>
                <th className="py-1 text-right">Sipariş Alan (m²)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {calculations.tileSummaries.map(s => (
                <tr key={s.profile.id}>
                  <td className="py-1 pl-2 text-stone-900 font-bold">{s.profile.name}</td>
                  <td className="py-1 text-right">{formatNumber(s.netArea)} m²</td>
                  <td className="py-1 text-right">{formatNumber(s.withWasteArea)} m²</td>
                  <td className="py-1 text-center">{formatNumber(s.profile.boxAreaM2)} m²</td>
                  <td className="py-1 text-center font-bold text-amber-900">{s.requiredBoxes} Kutu</td>
                  <td className="py-1 text-right font-bold text-stone-900">{formatNumber(s.orderedArea)} m²</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detailed Consumables & Labor Costings */}
        <div className="mb-8">
          <h3 className="font-bold border-b border-stone-800 pb-1 mb-2 text-stone-800 uppercase tracking-wide text-[10px]">4. HAKEDİŞ DETAYLARI</h3>
          <table className="w-full text-left text-[9px] border-collapse">
            <thead>
              <tr className="border-b border-stone-300 text-stone-500 uppercase font-semibold">
                <th className="py-1">Grup</th>
                <th className="py-1 pl-2">Kalem Tanımı</th>
                <th className="py-1 text-right">Miktar</th>
                <th className="py-1 text-center">Birim</th>
                <th className="py-1 text-right">Birim Fiyat</th>
                <th className="py-1 text-right">KDV Dahil Toplam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {calculations.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1 text-stone-400 uppercase font-bold text-[8px]">{item.group}</td>
                  <td className="py-1 pl-2 text-stone-900 font-bold">{item.name}</td>
                  <td className="py-1 text-right">{formatNumber(item.amount)}</td>
                  <td className="py-1 text-center text-stone-500">{item.unit}</td>
                  <td className="py-1 text-right">{formatNumber(item.price)} TL</td>
                  <td className="py-1 text-right font-bold text-stone-950">{formatNumber(item.total)} TL</td>
                </tr>
              ))}
              <tr className="border-t-2 border-stone-800 font-bold text-stone-950 text-[10px]">
                <td className="py-2" colSpan={2}>HAKEDİŞ GENEL TOPLAMI (KDV DAHİL)</td>
                <td colSpan={3}></td>
                <td className="py-2 text-right text-amber-900 font-black">{formatNumber(calculations.grandTotal)} TL</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signature Box */}
        <div className="mt-12 grid grid-cols-3 gap-6 text-center text-[10px] pt-4 border-t border-stone-200">
          <div>
            <div className="font-bold text-stone-800">Hazırlayan</div>
            <div className="text-stone-400 mt-8">İmza</div>
          </div>
          <div>
            <div className="font-bold text-stone-800">Kontrol Eden</div>
            <div className="text-stone-400 mt-8">İmza</div>
          </div>
          <div>
            <div className="font-bold text-stone-800">Onaylayan (Şantiye Şefi)</div>
            <div className="text-stone-400 mt-8">İmza</div>
          </div>
        </div>
      </div>
      
    </div>
  )
}
