'use client'

import { useState, useMemo, useEffect } from 'react'

type TakeoffLine = {
  id: string
  description: string
  category: 'ic-duvar' | 'ic-tavan' | 'dis-cephe'
  application: 'siva-boya' | 'sadece-siva' | 'sadece-boya' | 'mantolama-siva-boya'
  width: number
  height: number
  count: number
  deduction: number
}

type ConsumptionRates = {
  gypsumPlasterThickness: number // cm
  gypsumPlasterDensity: number // kg/m2 per cm (e.g. 10)
  satenPlasterDensity: number // kg/m2
  cornerProfileRatio: number // m/m2
  interiorPaintDensity: number // kg/m2 (for double coat)
  interiorPrimerDensity: number // kg/m2
  epsBoardWaste: number // factor (e.g. 1.05)
  dowelRatio: number // Adet/m2
  exteriorAdhesiveDensity: number // kg/m2
  exteriorPlasterDensity: number // kg/m2
  exteriorMeshRatio: number // factor (e.g. 1.1)
  exteriorPaintDensity: number // kg/m2
  exteriorPrimerDensity: number // kg/m2
}

type Prices = {
  gypsumPlasterBag: number // TL/25kg Bag
  satenPlasterBag: number // TL/25kg Bag
  cornerProfile: number // TL/Adet (2.7m)
  interiorPrimerBucket: number // TL/15L (approx 20kg)
  interiorPaintBucket: number // TL/15L (approx 20kg)
  epsBoard: number // TL/m2
  exteriorAdhesivePackage: number // TL/m2 (incl adhesive and dowels)
  exteriorPlasterBag: number // TL/25kg Bag
  exteriorMesh: number // TL/m2
  exteriorPrimerBucket: number // TL/15L (approx 20kg)
  exteriorPaintBucket: number // TL/15L (approx 20kg)
  
  // Labor
  laborInteriorPlaster: number // TL/m2
  laborInteriorPaint: number // TL/m2
  laborExteriorInsulation: number // TL/m2
  laborExteriorPaint: number // TL/m2
}

type SavedProject = {
  id: string
  projectName: string
  project: {
    isPlasterPaint: boolean
    projectName: string
    takeoffs: TakeoffLine[]
    consumptionRates: ConsumptionRates
    prices: Prices
  }
  username: string
  createdAt: string
  updatedAt: string
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const defaultConsumptionRates: ConsumptionRates = {
  gypsumPlasterThickness: 1.5,
  gypsumPlasterDensity: 10,
  satenPlasterDensity: 1.2,
  cornerProfileRatio: 0.15,
  interiorPaintDensity: 0.20,
  interiorPrimerDensity: 0.10,
  epsBoardWaste: 1.05,
  dowelRatio: 6,
  exteriorAdhesiveDensity: 5.0,
  exteriorPlasterDensity: 5.0,
  exteriorMeshRatio: 1.10,
  exteriorPaintDensity: 0.30,
  exteriorPrimerDensity: 0.12,
}

const defaultPrices: Prices = {
  gypsumPlasterBag: 120,
  satenPlasterBag: 160,
  cornerProfile: 25,
  interiorPrimerBucket: 750,
  interiorPaintBucket: 2200,
  epsBoard: 150,
  exteriorAdhesivePackage: 45,
  exteriorPlasterBag: 140,
  exteriorMesh: 20,
  exteriorPrimerBucket: 900,
  exteriorPaintBucket: 2800,
  
  laborInteriorPlaster: 130,
  laborInteriorPaint: 70,
  laborExteriorInsulation: 250,
  laborExteriorPaint: 90,
}

const defaultTakeoff = (): TakeoffLine => ({
  id: createId(),
  description: '',
  category: 'ic-duvar',
  application: 'siva-boya',
  width: 0,
  height: 0,
  count: 1,
  deduction: 0,
})

export default function PlasterPaintCalculator({ username }: { username: string }) {
  // --- STATE ---
  const [projectName, setProjectName] = useState<string>('')
  const [takeoffs, setTakeoffs] = useState<TakeoffLine[]>([defaultTakeoff()])
  const [consumptionRates, setConsumptionRates] = useState<ConsumptionRates>(defaultConsumptionRates)
  const [prices, setPrices] = useState<Prices>(defaultPrices)
  
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'loading'>('idle')
  const [serverMessage, setServerMessage] = useState<string>('')
  const [showConfig, setShowConfig] = useState<boolean>(false)

  // --- DATABASE SYNC ---
  const refreshSavedProjects = async (nextActiveId?: string | null) => {
    const response = await fetch('/api/material-procurement-projects')
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Kayıtlar yenilenemedi.')
    }
    const nextProjects = Array.isArray(data) ? data : []
    const filtered = nextProjects.filter((p: any) => p.project?.isPlasterPaint === true)
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
      setServerMessage('Supabase kaydı için önce bir proje/blok adı girin (Örn: A Blok Sıva Boya).')
      return
    }

    setSaveState('saving')
    setServerMessage('')

    try {
      const payload = {
        id: activeProjectId || undefined,
        project: {
          isPlasterPaint: true,
          projectName: projectName,
          takeoffs,
          consumptionRates,
          prices
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
    setTakeoffs(proj.takeoffs || [defaultTakeoff()])
    setConsumptionRates(proj.consumptionRates || defaultConsumptionRates)
    setPrices(proj.prices || defaultPrices)
    setActiveProjectId(saved.id)
    setServerMessage(`"${saved.projectName}" projesi Supabase üzerinden yüklendi.`)
  }

  const clearForm = () => {
    setProjectName('')
    setTakeoffs([defaultTakeoff()])
    setConsumptionRates(defaultConsumptionRates)
    setPrices(defaultPrices)
    setActiveProjectId(null)
    setServerMessage('')
  }

  const fillDemo = () => {
    setProjectName('Örnek Blok Sıva ve Boya Metrajı')
    setTakeoffs([
      {
        id: createId(),
        description: 'Kat 1 - Salon Duvarları (Alçı Sıva + Boya)',
        category: 'ic-duvar',
        application: 'siva-boya',
        width: 14.5,
        height: 2.8,
        count: 2,
        deduction: 7.2
      },
      {
        id: createId(),
        description: 'Kat 1 - Yatak Odası Duvarları (Kaba Sıva Hariç, Sadece Boya)',
        category: 'ic-duvar',
        application: 'sadece-boya',
        width: 11.2,
        height: 2.8,
        count: 1,
        deduction: 4.5
      },
      {
        id: createId(),
        description: 'Kat 1 - Salon & Hol Tavanı (Sadece Boya)',
        category: 'ic-tavan',
        application: 'sadece-boya',
        width: 5.5,
        height: 8.2,
        count: 1,
        deduction: 0
      },
      {
        id: createId(),
        description: 'Blok Dış Cephe (Güney & Batı Cepheleri Mantolama)',
        category: 'dis-cephe',
        application: 'mantolama-siva-boya',
        width: 18.0,
        height: 14.5,
        count: 1,
        deduction: 34.8
      }
    ])
    setServerMessage('Demo verisi yüklendi.')
  }

  // --- DYNAMIC CALCULATIONS ---
  const calculations = useMemo(() => {
    let totalIcSivaArea = 0
    let totalIcBoyaArea = 0
    let totalIcTavanArea = 0
    let totalDisCepheArea = 0

    // Process each takeoff row
    const processedRows = takeoffs.map(row => {
      const grossArea = row.width * row.height * row.count
      const netArea = Math.max(grossArea - row.deduction, 0)

      let sivaArea = 0
      let boyaArea = 0

      if (row.category === 'ic-duvar') {
        if (row.application === 'siva-boya' || row.application === 'sadece-siva') {
          sivaArea = netArea
        }
        if (row.application === 'siva-boya' || row.application === 'sadece-boya') {
          boyaArea = netArea
        }
      } else if (row.category === 'ic-tavan') {
        if (row.application === 'siva-boya' || row.application === 'sadece-siva') {
          sivaArea = netArea
        }
        if (row.application === 'siva-boya' || row.application === 'sadece-boya') {
          boyaArea = netArea
        }
      } else if (row.category === 'dis-cephe') {
        sivaArea = netArea
        boyaArea = netArea
      }

      return {
        ...row,
        grossArea,
        netArea,
        sivaArea,
        boyaArea
      }
    })

    // Sum areas
    processedRows.forEach(row => {
      if (row.category === 'ic-duvar') {
        totalIcSivaArea += row.sivaArea
        totalIcBoyaArea += row.boyaArea
      } else if (row.category === 'ic-tavan') {
        totalIcTavanArea += row.boyaArea
      } else if (row.category === 'dis-cephe') {
        totalDisCepheArea += row.netArea
      }
    })

    // Material consumption calculations
    // 1. Gypsum Plaster Bags (25kg)
    const gypsumKg = totalIcSivaArea * consumptionRates.gypsumPlasterThickness * consumptionRates.gypsumPlasterDensity
    const gypsumBags = Math.ceil(gypsumKg / 25)

    // 2. Saten Plaster Bags (25kg)
    const satenKg = totalIcSivaArea * consumptionRates.satenPlasterDensity
    const satenBags = Math.ceil(satenKg / 25)

    // 3. Corner Bead Profile (Adet - 2.7m length)
    const cornerMeters = totalIcSivaArea * consumptionRates.cornerProfileRatio
    const cornerPieces = Math.ceil(cornerMeters / 2.7)

    // 4. Interior Primer Bucket (15L / approx 20kg)
    // Applied on walls and ceilings to be painted
    const totalInteriorPaintArea = totalIcBoyaArea + totalIcTavanArea
    const interiorPrimerKg = totalInteriorPaintArea * consumptionRates.interiorPrimerDensity
    const interiorPrimerBuckets = Math.ceil(interiorPrimerKg / 20)

    // 5. Interior Paint Bucket (15L / approx 20kg)
    const interiorPaintKg = totalInteriorPaintArea * consumptionRates.interiorPaintDensity
    const interiorPaintBuckets = Math.ceil(interiorPaintKg / 20)

    // 6. EPS Insulation Board (m2)
    const epsBoardArea = totalDisCepheArea * consumptionRates.epsBoardWaste

    // 7. Exterior Adhesive & Mesh Plaster Mortar (Torba - 25kg)
    const extAdhesiveKg = totalDisCepheArea * consumptionRates.exteriorAdhesiveDensity
    const extPlasterKg = totalDisCepheArea * consumptionRates.exteriorPlasterDensity
    const extMortarBags = Math.ceil((extAdhesiveKg + extPlasterKg) / 25)

    // 8. Exterior Plaster Mesh (m2)
    const extMeshArea = totalDisCepheArea * consumptionRates.exteriorMeshRatio

    // 9. Exterior Primer Bucket (15L / approx 20kg)
    const extPrimerKg = totalDisCepheArea * consumptionRates.exteriorPrimerDensity
    const extPrimerBuckets = Math.ceil(extPrimerKg / 20)

    // 10. Exterior Paint Bucket (15L / approx 20kg)
    const extPaintKg = totalDisCepheArea * consumptionRates.exteriorPaintDensity
    const extPaintBuckets = Math.ceil(extPaintKg / 20)

    // Bill of Materials & Subcontractor Labor Costing
    const items = [
      // GYPSUM PLASTER
      {
        group: 'İç Cephe Malzemeleri',
        name: 'Alçı Sıva (25 kg)',
        amount: gypsumBags,
        unit: 'Torba',
        price: prices.gypsumPlasterBag,
      },
      {
        group: 'İç Cephe Malzemeleri',
        name: 'Saten Alçı (25 kg)',
        amount: satenBags,
        unit: 'Torba',
        price: prices.satenPlasterBag,
      },
      {
        group: 'İç Cephe Malzemeleri',
        name: 'Sıva Köşebent Profili (2.7m)',
        amount: cornerPieces,
        unit: 'Adet',
        price: prices.cornerProfile,
      },
      {
        group: 'İç Cephe Malzemeleri',
        name: 'İç Cephe Astarı (15 L)',
        amount: interiorPrimerBuckets,
        unit: 'Kova',
        price: prices.interiorPrimerBucket,
      },
      {
        group: 'İç Cephe Malzemeleri',
        name: 'İç Cephe Boyası (15 L)',
        amount: interiorPaintBuckets,
        unit: 'Kova',
        price: prices.interiorPaintBucket,
      },
      
      // EXTERIOR / INSULATION
      {
        group: 'Dış Cephe Malzemeleri',
        name: 'Mantolama Levhası (EPS/Taşyünü)',
        amount: epsBoardArea,
        unit: 'm²',
        price: prices.epsBoard,
      },
      {
        group: 'Dış Cephe Malzemeleri',
        name: 'Yapıştırıcı ve Dübel Paketi',
        amount: totalDisCepheArea,
        unit: 'm²',
        price: prices.exteriorAdhesivePackage,
      },
      {
        group: 'Dış Cephe Malzemeleri',
        name: 'Dış Cephe Yapıştırıcı/Sıva Harcı (25 kg)',
        amount: extMortarBags,
        unit: 'Torba',
        price: prices.exteriorPlasterBag,
      },
      {
        group: 'Dış Cephe Malzemeleri',
        name: 'Dış Cephe Sıva Filesi',
        amount: extMeshArea,
        unit: 'm²',
        price: prices.exteriorMesh,
      },
      {
        group: 'Dış Cephe Malzemeleri',
        name: 'Dış Cephe Astarı (15 L)',
        amount: extPrimerBuckets,
        unit: 'Kova',
        price: prices.exteriorPrimerBucket,
      },
      {
        group: 'Dış Cephe Malzemeleri',
        name: 'Dış Cephe Boyası (15 L)',
        amount: extPaintBuckets,
        unit: 'Kova',
        price: prices.exteriorPaintBucket,
      },

      // LABOR
      {
        group: 'İşçilik Kalemleri',
        name: 'İç Sıva Uygulaması İşçiliği',
        amount: totalIcSivaArea,
        unit: 'm²',
        price: prices.laborInteriorPlaster,
      },
      {
        group: 'İşçilik Kalemleri',
        name: 'İç Cephe Boya Uygulaması İşçiliği',
        amount: totalInteriorPaintArea,
        unit: 'm²',
        price: prices.laborInteriorPaint,
      },
      {
        group: 'İşçilik Kalemleri',
        name: 'Dış Cephe Mantolama İşçiliği',
        amount: totalDisCepheArea,
        unit: 'm²',
        price: prices.laborExteriorInsulation,
      },
      {
        group: 'İşçilik Kalemleri',
        name: 'Dış Cephe Boya Uygulaması İşçiliği',
        amount: totalDisCepheArea,
        unit: 'm²',
        price: prices.laborExteriorPaint,
      }
    ]

    const calculatedItems = items
      .filter(item => item.amount > 0)
      .map(item => {
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

    const materialTotal = calculatedItems
      .filter(item => item.group !== 'İşçilik Kalemleri')
      .reduce((sum, item) => sum + item.total, 0)
      
    const laborTotal = calculatedItems
      .filter(item => item.group === 'İşçilik Kalemleri')
      .reduce((sum, item) => sum + item.total, 0)

    const grandTotal = materialTotal + laborTotal
    const grandNet = calculatedItems.reduce((sum, item) => sum + item.net, 0)
    const grandKdv = calculatedItems.reduce((sum, item) => sum + item.kdv, 0)

    return {
      rows: processedRows,
      totalIcSivaArea,
      totalIcBoyaArea,
      totalIcTavanArea,
      totalDisCepheArea,
      items: calculatedItems,
      materialTotal,
      laborTotal,
      grandNet,
      grandKdv,
      grandTotal
    }
  }, [takeoffs, consumptionRates, prices])

  // --- ACTIONS ---
  const addTakeoffRow = () => {
    setTakeoffs(prev => [...prev, defaultTakeoff()])
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
      setTakeoffs([defaultTakeoff()])
      return
    }
    setTakeoffs(prev => prev.filter(row => row.id !== id))
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  return (
    <div className="space-y-6 pb-20">
      
      {/* DB Sync & Status Banner */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-stone-400">AKTİF PROJE / HESAP ADI</div>
            <input
              type="text"
              placeholder="Örn: C Blok Sıva ve Boya Metrajı"
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

      {/* KPI Dashboard summaries */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <span className="text-xs font-semibold text-stone-400 block uppercase">İç Sıva Alanı</span>
          <span className="mt-2 text-2xl font-black text-stone-900 block">{formatNumber(calculations.totalIcSivaArea)} m²</span>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <span className="text-xs font-semibold text-stone-400 block uppercase">İç Boya Alanı</span>
          <span className="mt-2 text-2xl font-black text-stone-900 block">{formatNumber(calculations.totalIcBoyaArea + calculations.totalIcTavanArea)} m²</span>
          <span className="text-[10px] text-stone-400 mt-1 block">Duvar: {formatNumber(calculations.totalIcBoyaArea)} + Tavan: {formatNumber(calculations.totalIcTavanArea)}</span>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <span className="text-xs font-semibold text-stone-400 block uppercase">Dış Cephe Alanı</span>
          <span className="mt-2 text-2xl font-black text-stone-900 block">{formatNumber(calculations.totalDisCepheArea)} m²</span>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <span className="text-xs font-semibold text-stone-400 block uppercase">Malzeme Maliyeti</span>
          <span className="mt-2 text-2xl font-black text-stone-900 block">{formatNumber(calculations.materialTotal)} TL</span>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 bg-amber-50/50">
          <span className="text-xs font-bold text-amber-800 block uppercase">Hakediş Toplamı</span>
          <span className="mt-2 text-2xl font-black text-amber-900 block">{formatNumber(calculations.grandTotal)} TL</span>
          <span className="text-[10px] text-amber-800/60 mt-1 block">KDV Dahil</span>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Takeoff Cetveli (Grid Columns 2 on Large Screens) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">1. Metraj Cetveli (Mahal Listesi)</h3>
                <p className="text-xs text-stone-500 mt-1">Katları, odaları veya dış cephe alanlarını tek tek satır olarak ekleyin. Net alan hesapları otomatik yapılır.</p>
              </div>
              <button
                onClick={addTakeoffRow}
                className="flex items-center gap-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 text-xs font-bold transition cursor-pointer"
              >
                + Mahal Ekle
              </button>
            </div>

            {/* Takeoff Grid Spreadsheet */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-400 uppercase font-semibold">
                    <th className="py-2.5 w-[5%] text-center">#</th>
                    <th className="py-2.5 w-[25%] pl-2">Mahal / Açıklama</th>
                    <th className="py-2.5 w-[15%]">Kategori</th>
                    <th className="py-2.5 w-[18%]">Uygulama</th>
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
                            placeholder="Örn: 1. Kat Salon"
                            onChange={(e) => updateTakeoffRow(row.id, 'description', e.target.value)}
                            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 px-2 py-1 text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <select
                            value={row.category}
                            onChange={(e) => {
                              const cat = e.target.value as any
                              let app = row.application
                              if (cat === 'dis-cephe') {
                                app = 'mantolama-siva-boya'
                              } else if (row.category === 'dis-cephe') {
                                app = 'siva-boya'
                              }
                              updateTakeoffRow(row.id, 'category', cat)
                              updateTakeoffRow(row.id, 'application', app)
                            }}
                            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 px-2 py-1 text-xs text-stone-900 focus:bg-white focus:outline-none font-medium cursor-pointer"
                          >
                            <option value="ic-duvar">İç Cephe Duvar</option>
                            <option value="ic-tavan">İç Cephe Tavan</option>
                            <option value="dis-cephe">Dış Cephe</option>
                          </select>
                        </td>
                        <td className="py-2.5 pr-2">
                          <select
                            value={row.application}
                            onChange={(e) => updateTakeoffRow(row.id, 'application', e.target.value)}
                            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 px-2 py-1 text-xs text-stone-900 focus:bg-white focus:outline-none font-medium cursor-pointer"
                          >
                            {row.category !== 'dis-cephe' ? (
                              <>
                                <option value="siva-boya">Sıva + Boya</option>
                                <option value="sadece-siva">Sadece Sıva</option>
                                <option value="sadece-boya">Sadece Boya</option>
                              </>
                            ) : (
                              <>
                                <option value="mantolama-siva-boya">Mantolama + Sıva + Boya</option>
                                <option value="siva-boya">Sıva + Boya (Mantolamasız)</option>
                              </>
                            )}
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
                            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 px-1 py-1 text-center text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium animate-pulse"
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

          {/* Detailed costing bill */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <h3 className="text-lg font-bold text-stone-900 mb-4">2. Hakediş ve Malzeme Sipariş Listesi</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 text-xs">
                    <th className="py-2.5 font-bold">Kategori</th>
                    <th className="py-2.5 font-bold pl-2">Kalem Adı</th>
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
                      <td colSpan={6} className="py-6 text-center text-stone-400 font-medium">Metraj cetveline değer girildiğinde maliyetler burada hesaplanır.</td>
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

        {/* Right Column: Parameters and Saved Projects list */}
        <div className="space-y-6">
          {/* Collapse switch for pricing & config parameters */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex w-full items-center justify-between text-left focus:outline-none cursor-pointer"
            >
              <div>
                <h3 className="text-base font-bold text-stone-900">Birim Fiyat ve Katsayı Ayarları</h3>
                <p className="text-[10px] text-stone-500 mt-0.5">Tüketim katsayıları ve birim fiyatları buradan değiştirin.</p>
              </div>
              <span className={`text-stone-400 transition-transform ${showConfig ? 'rotate-180' : ''}`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>

            {showConfig && (
              <div className="mt-6 space-y-6 border-t border-stone-100 pt-5">
                
                {/* Material Unit Prices */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3">İç Cephe Birim Fiyatlar</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Alçı Sıva (TL/Torba):</span>
                      <input
                        type="number"
                        value={prices.gypsumPlasterBag}
                        onChange={(e) => setPrices(prev => ({ ...prev, gypsumPlasterBag: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Saten Alçı (TL/Torba):</span>
                      <input
                        type="number"
                        value={prices.satenPlasterBag}
                        onChange={(e) => setPrices(prev => ({ ...prev, satenPlasterBag: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Sıva Köşebent (TL/Adet):</span>
                      <input
                        type="number"
                        value={prices.cornerProfile}
                        onChange={(e) => setPrices(prev => ({ ...prev, cornerProfile: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">İç Cephe Boyası (TL/Kova):</span>
                      <input
                        type="number"
                        value={prices.interiorPaintBucket}
                        onChange={(e) => setPrices(prev => ({ ...prev, interiorPaintBucket: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">İç Cephe Astarı (TL/Kova):</span>
                      <input
                        type="number"
                        value={prices.interiorPrimerBucket}
                        onChange={(e) => setPrices(prev => ({ ...prev, interiorPrimerBucket: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Exterior & Insulation Prices */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3">Dış Cephe Birim Fiyatlar</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Mantolama Levhası (TL/m²):</span>
                      <input
                        type="number"
                        value={prices.epsBoard}
                        onChange={(e) => setPrices(prev => ({ ...prev, epsBoard: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Yapıştırıcı & Dübel Paketi (TL/m²):</span>
                      <input
                        type="number"
                        value={prices.exteriorAdhesivePackage}
                        onChange={(e) => setPrices(prev => ({ ...prev, exteriorAdhesivePackage: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Dış Cephe Sıva Harcı (TL/Torba):</span>
                      <input
                        type="number"
                        value={prices.exteriorPlasterBag}
                        onChange={(e) => setPrices(prev => ({ ...prev, exteriorPlasterBag: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Dış Cephe Sıva Filesi (TL/m²):</span>
                      <input
                        type="number"
                        value={prices.exteriorMesh}
                        onChange={(e) => setPrices(prev => ({ ...prev, exteriorMesh: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Dış Cephe Boyası (TL/Kova):</span>
                      <input
                        type="number"
                        value={prices.exteriorPaintBucket}
                        onChange={(e) => setPrices(prev => ({ ...prev, exteriorPaintBucket: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Dış Cephe Astarı (TL/Kova):</span>
                      <input
                        type="number"
                        value={prices.exteriorPrimerBucket}
                        onChange={(e) => setPrices(prev => ({ ...prev, exteriorPrimerBucket: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Subcontractor Labor prices */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3">İşçilik Fiyatları</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">İç Cephe Alçı Sıva (TL/m²):</span>
                      <input
                        type="number"
                        value={prices.laborInteriorPlaster}
                        onChange={(e) => setPrices(prev => ({ ...prev, laborInteriorPlaster: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">İç Cephe Boyama (TL/m²):</span>
                      <input
                        type="number"
                        value={prices.laborInteriorPaint}
                        onChange={(e) => setPrices(prev => ({ ...prev, laborInteriorPaint: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Dış Cephe Mantolama (TL/m²):</span>
                      <input
                        type="number"
                        value={prices.laborExteriorInsulation}
                        onChange={(e) => setPrices(prev => ({ ...prev, laborExteriorInsulation: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Dış Cephe Boyama (TL/m²):</span>
                      <input
                        type="number"
                        value={prices.laborExteriorPaint}
                        onChange={(e) => setPrices(prev => ({ ...prev, laborExteriorPaint: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-amber-50 px-2 py-1 text-center font-bold text-stone-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Consumption configuration details */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3">Tüketim Katsayı Değerleri</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Alçı Sıva Kalınlığı (cm):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={consumptionRates.gypsumPlasterThickness}
                        onChange={(e) => setConsumptionRates(prev => ({ ...prev, gypsumPlasterThickness: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-center font-semibold text-stone-700"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">İç Boya Tüketimi (kg/m²):</span>
                      <input
                        type="number"
                        step="0.01"
                        value={consumptionRates.interiorPaintDensity}
                        onChange={(e) => setConsumptionRates(prev => ({ ...prev, interiorPaintDensity: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-center font-semibold text-stone-700"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Dış Mantolama Firesi (%):</span>
                      <input
                        type="number"
                        step="1"
                        value={Math.round((consumptionRates.epsBoardWaste - 1) * 100)}
                        onChange={(e) => setConsumptionRates(prev => ({ ...prev, epsBoardWaste: 1 + (parseFloat(e.target.value) || 0) / 100 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-center font-semibold text-stone-700"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Dış Boya Tüketimi (kg/m²):</span>
                      <input
                        type="number"
                        step="0.01"
                        value={consumptionRates.exteriorPaintDensity}
                        onChange={(e) => setConsumptionRates(prev => ({ ...prev, exteriorPaintDensity: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-center font-semibold text-stone-700"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Database saved records list */}
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
                <div className="text-center text-stone-400 text-xs py-8">Supabase üzerinde henüz sıva/boya kaydı bulunmuyor.</div>
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
            <h1 className="text-lg font-black text-stone-900 mt-1">SIVA VE BOYA HAKEDİŞ VE METRAJ RAPORU</h1>
            <p className="text-[10px] text-stone-500">İç ve Dış Cephe Sıva, Boya ve Mantolama Metraj İcmali</p>
          </div>
          <div className="text-right text-[10px] text-stone-500 space-y-1">
            <div><strong>Tarih:</strong> {new Date().toLocaleDateString('tr-TR')}</div>
            <div><strong>Rapor ID:</strong> BTL-PLP-{Date.now().toString().slice(-6)}</div>
            <div><strong>Hazırlayan:</strong> {username || 'Sistem Yöneticisi'}</div>
          </div>
        </div>

        {/* Technical Data Summary */}
        <div className="border border-stone-200 rounded-xl p-3 bg-stone-50 mb-6">
          <h3 className="font-bold border-b border-stone-200 pb-1 mb-2 text-stone-800 uppercase tracking-wide text-[10px]">1. METRAJ ÖZETİ</h3>
          <table className="w-full text-left text-[10px]">
            <tbody>
              <tr><td className="text-stone-500 py-0.5">Proje/Blok Adı:</td><td className="text-right font-bold text-amber-900">{projectName || 'Belirtilmemiş'}</td></tr>
              <tr><td className="text-stone-500 py-0.5">Toplam İç Sıva Alanı:</td><td className="text-right font-bold">{formatNumber(calculations.totalIcSivaArea)} m²</td></tr>
              <tr><td className="text-stone-500 py-0.5">Toplam İç Boya Alanı (Duvar & Tavan):</td><td className="text-right font-bold">{formatNumber(calculations.totalIcBoyaArea + calculations.totalIcTavanArea)} m²</td></tr>
              <tr><td className="text-stone-500 py-0.5">Toplam Dış Cephe Yüzey Alanı:</td><td className="text-right font-bold">{formatNumber(calculations.totalDisCepheArea)} m²</td></tr>
              <tr className="border-t border-stone-200 font-bold text-stone-800"><td className="py-1">Malzeme Hakediş Toplamı:</td><td className="text-right py-1">{formatNumber(calculations.materialTotal)} TL</td></tr>
              <tr className="font-bold text-stone-800"><td>İşçilik Hakediş Toplamı:</td><td className="text-right">{formatNumber(calculations.laborTotal)} TL</td></tr>
              <tr className="font-bold text-amber-950 text-xs"><td>GENEL TOPLAM (KDV DAHİL):</td><td className="text-right">{formatNumber(calculations.grandTotal)} TL</td></tr>
            </tbody>
          </table>
        </div>

        {/* Dynamic Takeoff Cetveli */}
        <div className="mb-6">
          <h3 className="font-bold border-b border-stone-800 pb-1 mb-2 text-stone-800 uppercase tracking-wide text-[10px]">2. DETAYLI METRAJ CETVELİ</h3>
          <table className="w-full text-left text-[9px] border-collapse">
            <thead>
              <tr className="border-b border-stone-300 text-stone-500 uppercase font-semibold">
                <th className="py-1">#</th>
                <th className="py-1 pl-2">Mahal Açıklaması</th>
                <th className="py-1">Kategori</th>
                <th className="py-1">Uygulama</th>
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
                  <td className="py-1 text-stone-600">{row.category === 'ic-duvar' ? 'İç Duvar' : row.category === 'ic-tavan' ? 'İç Tavan' : 'Dış Cephe'}</td>
                  <td className="py-1 text-stone-600">
                    {row.application === 'siva-boya' ? 'Sıva + Boya' : row.application === 'sadece-siva' ? 'Sadece Sıva' : row.application === 'sadece-boya' ? 'Sadece Boya' : 'Mantolama + Sıva + Boya'}
                  </td>
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

        {/* Dynamic Materials & Labor Costings */}
        <div className="mb-8">
          <h3 className="font-bold border-b border-stone-800 pb-1 mb-2 text-stone-800 uppercase tracking-wide text-[10px]">3. MALZEME VE İŞÇİLİK HAKEDİŞ DETAYLARI</h3>
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
