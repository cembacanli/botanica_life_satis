'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

type CostItem = {
  id: string
  name: string
  unit: string
  quantity: number
  unitPrice: number
  category: string
}

type MainCategory = 'Hafriyat' | 'Kaba' | 'Ince' | 'Mekanik' | 'Elektrik' | 'Cevre Duzenleme' | 'Diger'

const MAIN_CATEGORY_LABELS: Record<MainCategory, string> = {
  Hafriyat: 'Hafriyat',
  Kaba: 'Kaba İnşaat',
  Ince: 'İnce İnşaat',
  Mekanik: 'Mekanik Tesisat',
  Elektrik: 'Elektrik Tesisatı',
  'Cevre Duzenleme': 'Çevre Düzenleme',
  Diger: 'Diğer Giderler',
}

type BlockInput = {
  id: string
  name: string
  baseArea: number
  floorCount: number
  basementCount: number
  unitCount: number
  averageNetArea: number
  items: CostItem[]
}

type ScenarioInputs = {
  scenarioName: string
  landArea: number
  commonAreaRatio: number
  indirectCostRate: number
  contingencyRate: number
  permitAndProjectCost: number
  financingCost: number
  targetProfitRate: number
  vatRate: number
}

type SavedScenario = {
  id: string
  savedAt: string
  inputs: ScenarioInputs
  blocks: BlockInput[]
}

const defaultScenarioInputs: ScenarioInputs = {
  scenarioName: 'Yeni Senaryo',
  landArea: 2500,
  commonAreaRatio: 0.28,
  indirectCostRate: 0.12,
  contingencyRate: 0.07,
  permitAndProjectCost: 3500000,
  financingCost: 2500000,
  targetProfitRate: 0.2,
  vatRate: 0.1,
}

// Default unit prices template
const defaultUnitPrices: Record<string, { unit: string; price: number; category: string }> = {
  'Kazı metrajı': { unit: 'm³', price: 180, category: 'Hafriyat' },
  'Dolgu metrajı': { unit: 'm³', price: 220, category: 'Hafriyat' },
  'Temel altı grobeton metrajı': { unit: 'm³', price: 2600, category: 'Kaba' },
  'Temel/perde/kolon/kiriş/döşe beton metrajı': { unit: 'm³', price: 2800, category: 'Kaba' },
  'Demir ton metrajı': { unit: 'ton', price: 29000, category: 'Kaba' },
  'Kalıp metrajı': { unit: 'm²', price: 450, category: 'Kaba' },
  'Duvar imalatı metrajı': { unit: 'm²', price: 600, category: 'Kaba' },
  'Su yalıtımı metrajı': { unit: 'm²', price: 250, category: 'Kaba' },
  'Kaba inşaat işçilik metrajı': { unit: 'm²', price: 800, category: 'Kaba' },
  'İç cephe kaba sıva metrajı': { unit: 'm²', price: 250, category: 'Ince' },
  'Alçı sıva / makina alçısı metrajı': { unit: 'm²', price: 200, category: 'Ince' },
  'Saten alçı metrajı': { unit: 'm²', price: 180, category: 'Ince' },
  'Zemin seramik kaplama metrajı': { unit: 'm²', price: 800, category: 'Ince' },
  'Duvar seramik kaplama metrajı': { unit: 'm²', price: 750, category: 'Ince' },
  'Şap / self leveling metrajı': { unit: 'm²', price: 180, category: 'Ince' },
  'Laminat parke metrajı': { unit: 'm²', price: 450, category: 'Ince' },
  'İç cephe boya metrajı': { unit: 'm²', price: 140, category: 'Ince' },
  'Tavan boya metrajı': { unit: 'm²', price: 120, category: 'Ince' },
  'Asma tavan metrajı': { unit: 'm²', price: 350, category: 'Ince' },
  'İç kapı adet/metraj': { unit: 'adet', price: 6500, category: 'Ince' },
  'Süpürgelik metrajı': { unit: 'mtül', price: 110, category: 'Ince' },
  'Mutfak dolabı': { unit: 'adet', price: 48000, category: 'Ince' },
  'Banyo dolabı': { unit: 'adet', price: 16000, category: 'Ince' },
  'Duşakabin': { unit: 'adet', price: 8500, category: 'Ince' },
  'Vitrifiye grupları': { unit: 'adet', price: 13000, category: 'Ince' },
  'Elektrik tesisatı kaba+ince metrajı': { unit: 'm²', price: 1300, category: 'Elektrik' },
  'Zayıf akım metrajı': { unit: 'm²', price: 500, category: 'Elektrik' },
  'Temiz su tesisatı metrajı': { unit: 'mtül', price: 400, category: 'Mekanik' },
  'Pis su tesisatı metrajı': { unit: 'mtül', price: 500, category: 'Mekanik' },
  'Yangın tesisatı metrajı': { unit: 'mtül', price: 600, category: 'Mekanik' },
  'HVAC / havalandırma metrajı': { unit: 'm²', price: 900, category: 'Mekanik' },
  'Peyzaj uygulaması': { unit: 'm²', price: 1200, category: 'Cevre Duzenleme' },
}

// Auto estimate items based on footprints & floors
function autoEstimateItems(
  baseArea: number,
  floorCount: number,
  basementCount: number,
  unitCount: number,
  averageNetArea: number
): CostItem[] {
  const grossArea = baseArea * (floorCount + basementCount)
  
  // Custom formula approximations
  const kaziMetraji = baseArea * (basementCount * 3.5 + 1.5) * 1.15
  const dolguMetraji = kaziMetraji * 0.25
  const grobeton = baseArea * 0.1
  const temelBeton = baseArea * 1.0 // 100cm foundation
  const katBeton = (floorCount + basementCount) * baseArea * 0.35
  const toplamBeton = temelBeton + katBeton
  const demirTon = (temelBeton * 85 + katBeton * 120) / 1000
  const kalipMetraji = baseArea * 0.15 + (floorCount + basementCount) * baseArea * 2.8
  const duvarMetraji = (floorCount + basementCount) * baseArea * 0.6
  const yalitimi = baseArea * 1.1 + basementCount * baseArea * 0.4
  const kabaIscilik = grossArea

  // Ince
  const siva = duvarMetraji * 2
  const alci = siva * 0.9
  const satenAlci = alci
  const seramikZemin = unitCount * 25
  const seramikDuvar = unitCount * 45
  const sap = grossArea * 0.8
  const parke = unitCount * averageNetArea * 0.7
  const boya = siva * 1.1
  const tavanBoya = grossArea * 0.9
  const asmaTavan = unitCount * 30
  const kapiAdet = unitCount * 6 // 6 doors per unit
  const supurgelik = unitCount * 65
  const mutfakDolabi = unitCount
  const banyoDolabi = unitCount * 1.5
  const dusakabin = unitCount * 1.2
  const vitrifiye = unitCount * 2.5

  // E&M
  const elektrik = grossArea
  const zayifAkim = grossArea
  const temizSu = unitCount * 45
  const pisSu = unitCount * 40
  const yanginSu = unitCount * 30
  const hvac = grossArea * 0.3

  // Landscape
  const peyzaj = baseArea * 0.4

  const estimates: Record<string, number> = {
    'Kazı metrajı': kaziMetraji,
    'Dolgu metrajı': dolguMetraji,
    'Temel altı grobeton metrajı': grobeton,
    'Temel/perde/kolon/kiriş/döşe beton metrajı': toplamBeton,
    'Demir ton metrajı': demirTon,
    'Kalıp metrajı': kalipMetraji,
    'Duvar imalatı metrajı': duvarMetraji,
    'Su yalıtımı metrajı': yalitimi,
    'Kaba inşaat işçilik metrajı': kabaIscilik,
    'İç cephe kaba sıva metrajı': siva,
    'Alçı sıva / makina alçısı metrajı': alci,
    'Saten alçı metrajı': satenAlci,
    'Zemin seramik kaplama metrajı': seramikZemin,
    'Duvar seramik kaplama metrajı': seramikDuvar,
    'Şap / self leveling metrajı': sap,
    'Laminat parke metrajı': parke,
    'İç cephe boya metrajı': boya,
    'Tavan boya metrajı': tavanBoya,
    'Asma tavan metrajı': asmaTavan,
    'İç kapı adet/metraj': kapiAdet,
    'Süpürgelik metrajı': supurgelik,
    'Mutfak dolabı': mutfakDolabi,
    'Banyo dolabı': banyoDolabi,
    'Duşakabin': dusakabin,
    'Vitrifiye grupları': vitrifiye,
    'Elektrik tesisatı kaba+ince metrajı': elektrik,
    'Zayıf akım metrajı': zayifAkim,
    'Temiz su tesisatı metrajı': temizSu,
    'Pis su tesisatı metrajı': pisSu,
    'Yangın tesisatı metrajı': yanginSu,
    'HVAC / havalandırma metrajı': hvac,
    'Peyzaj uygulaması': peyzaj,
  }

  return Object.entries(defaultUnitPrices).map(([name, conf]) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    unit: conf.unit,
    quantity: estimates[name] || 0,
    unitPrice: conf.price,
    category: conf.category,
  }))
}

export default function ConstructionCostsPage() {
  const router = useRouter()
  const { user, loading, isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)

  // Scenarios states
  const [inputs, setInputs] = useState<ScenarioInputs>(defaultScenarioInputs)
  const [blocks, setBlocks] = useState<BlockInput[]>([
    {
      id: 'block-1',
      name: 'A Blok (Örnek)',
      baseArea: 600,
      floorCount: 10,
      basementCount: 1,
      unitCount: 60,
      averageNetArea: 75,
      items: autoEstimateItems(600, 10, 1, 60, 75),
    },
  ])

  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([])
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [compareScenarioId, setCompareScenarioId] = useState<string>('')
  const [dbState, setDbState] = useState<'idle' | 'saving' | 'loading'>('idle')
  const [serverMessage, setServerMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'inputs' | 'prices' | 'charts' | 'compare'>('inputs')
  const [selectedBlockId, setSelectedBlockId] = useState<string>('block-1')

  useEffect(() => {
    setMounted(true)
  }, [])

  const refreshScenarios = async (nextActiveId?: string | null) => {
    const response = await fetch('/api/construction-cost-scenarios')
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Kayıtlar yenilenemedi.')
    }
    const list = Array.isArray(data) ? data : []
    setSavedScenarios(list)
    if (typeof nextActiveId !== 'undefined') {
      setActiveScenarioId(nextActiveId)
    }
    return list
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
    if (!loading && isAuthenticated) {
      refreshScenarios().catch(err => console.error(err))
    }
  }, [isAuthenticated, loading, router])

  // --- CALCULATION LOGIC ---
  const calculations = useMemo(() => {
    const blockMetrics = blocks.map(block => {
      const grossArea = block.baseArea * (block.floorCount + block.basementCount)
      const netSellableArea = block.unitCount * block.averageNetArea
      
      const directCost = block.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      const costPerGrossM2 = grossArea > 0 ? directCost / grossArea : 0
      const costPerNetM2 = netSellableArea > 0 ? directCost / netSellableArea : 0
      const costPerUnit = block.unitCount > 0 ? directCost / block.unitCount : 0

      // Group totals
      const categoryTotals: Record<string, number> = {
        Hafriyat: 0,
        Kaba: 0,
        Ince: 0,
        Mekanik: 0,
        Elektrik: 0,
        'Cevre Duzenleme': 0,
      }

      block.items.forEach(item => {
        const cat = item.category
        if (cat in categoryTotals) {
          categoryTotals[cat] += item.quantity * item.unitPrice
        }
      })

      return {
        id: block.id,
        name: block.name,
        grossArea,
        netSellableArea,
        directCost,
        costPerGrossM2,
        costPerNetM2,
        costPerUnit,
        categoryTotals,
      }
    })

    const totalGrossArea = blockMetrics.reduce((sum, b) => sum + b.grossArea, 0)
    const totalNetArea = blockMetrics.reduce((sum, b) => sum + b.netSellableArea, 0)
    const totalDirectCost = blockMetrics.reduce((sum, b) => sum + b.directCost, 0)

    const indirectCost = totalDirectCost * inputs.indirectCostRate
    const contingencyCost = totalDirectCost * inputs.contingencyRate
    const permitCost = inputs.permitAndProjectCost
    const financingCost = inputs.financingCost

    const grandTotalCost = totalDirectCost + indirectCost + contingencyCost + permitCost + financingCost
    const grandCostPerGrossM2 = totalGrossArea > 0 ? grandTotalCost / totalGrossArea : 0
    const grandCostPerNetM2 = totalNetArea > 0 ? grandTotalCost / totalNetArea : 0

    const targetSalesTotal = grandTotalCost * (1 + inputs.targetProfitRate)
    const targetSalesWithVat = targetSalesTotal * (1 + inputs.vatRate)

    return {
      blockMetrics,
      totalGrossArea,
      totalNetArea,
      totalDirectCost,
      indirectCost,
      contingencyCost,
      grandTotalCost,
      grandCostPerGrossM2,
      grandCostPerNetM2,
      targetSalesTotal,
      targetSalesWithVat,
    }
  }, [blocks, inputs])

  // --- COMPARED SCENARIO LOGIC ---
  const compareCalculations = useMemo(() => {
    if (!compareScenarioId) return null
    const target = savedScenarios.find(s => s.id === compareScenarioId)
    if (!target) return null

    const compBlocks = target.blocks || []
    const compInputs = target.inputs || defaultScenarioInputs

    const compBlockMetrics = compBlocks.map(block => {
      const grossArea = block.baseArea * (block.floorCount + block.basementCount)
      const netSellableArea = block.unitCount * block.averageNetArea
      const directCost = block.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      return { grossArea, netSellableArea, directCost }
    })

    const totalGrossArea = compBlockMetrics.reduce((sum, b) => sum + b.grossArea, 0)
    const totalNetArea = compBlockMetrics.reduce((sum, b) => sum + b.netSellableArea, 0)
    const totalDirectCost = compBlockMetrics.reduce((sum, b) => sum + b.directCost, 0)

    const indirectCost = totalDirectCost * compInputs.indirectCostRate
    const contingencyCost = totalDirectCost * compInputs.contingencyRate
    const grandTotalCost = totalDirectCost + indirectCost + contingencyCost + compInputs.permitAndProjectCost + compInputs.financingCost
    const targetSalesTotal = grandTotalCost * (1 + compInputs.targetProfitRate)

    return {
      name: compInputs.scenarioName,
      totalGrossArea,
      totalNetArea,
      grandTotalCost,
      targetSalesTotal,
    }
  }, [compareScenarioId, savedScenarios])

  // --- ACTIONS ---
  const saveScenarioToDb = async () => {
    if (!inputs.scenarioName.trim()) {
      setServerMessage('Lütfen geçerli bir senaryo adı girin.')
      return
    }
    setDbState('saving')
    setServerMessage('')
    try {
      const payload = {
        id: activeScenarioId || undefined,
        inputs,
        blocks,
      }
      const response = await fetch('/api/construction-cost-scenarios', {
        method: activeScenarioId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const res = await response.json()
      if (!response.ok) {
        throw new Error(res?.error || 'Senaryo kaydedilemedi.')
      }
      await refreshScenarios(res.id)
      setServerMessage(`"${res.inputs?.scenarioName}" senaryosu başarıyla Supabase'e kaydedildi.`)
    } catch (err) {
      setServerMessage(err instanceof Error ? err.message : 'Kayıt başarısız.')
    } finally {
      setDbState('idle')
    }
  }

  const loadScenario = (saved: SavedScenario) => {
    setInputs(saved.inputs)
    setBlocks(saved.blocks)
    setActiveScenarioId(saved.id)
    if (saved.blocks.length > 0) {
      setSelectedBlockId(saved.blocks[0].id)
    }
    setServerMessage(`"${saved.inputs.scenarioName}" senaryosu başarıyla yüklendi.`)
  }

  const deleteScenario = async (id: string) => {
    const target = savedScenarios.find(s => s.id === id)
    if (!window.confirm(`"${target?.inputs.scenarioName || 'Bu senaryo'}" kaydını silmek istediğinize emin misiniz?`)) return
    setDbState('saving')
    setServerMessage('')
    try {
      const response = await fetch('/api/construction-cost-scenarios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!response.ok) {
        throw new Error('Silme işlemi başarısız.')
      }
      await refreshScenarios(activeScenarioId === id ? null : activeScenarioId)
      if (activeScenarioId === id) {
        setActiveScenarioId(null)
      }
      setServerMessage('Senaryo silindi.')
    } catch (err) {
      setServerMessage(err instanceof Error ? err.message : 'Silme başarısız.')
    } finally {
      setDbState('idle')
    }
  }

  const handleAddBlock = () => {
    const newId = `block-${Date.now()}`
    const newBlock: BlockInput = {
      id: newId,
      name: `${blocks.length + 1}. Yeni Blok`,
      baseArea: 500,
      floorCount: 5,
      basementCount: 1,
      unitCount: 20,
      averageNetArea: 80,
      items: autoEstimateItems(500, 5, 1, 20, 80),
    }
    setBlocks([...blocks, newBlock])
    setSelectedBlockId(newId)
  }

  const handleUpdateBlockField = (blockId: string, field: keyof Omit<BlockInput, 'id' | 'items'>, value: any) => {
    setBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        const updated = { ...b, [field]: value }
        // Re-estimate metraj when dimensions change
        updated.items = autoEstimateItems(
          Number(updated.baseArea),
          Number(updated.floorCount),
          Number(updated.basementCount),
          Number(updated.unitCount),
          Number(updated.averageNetArea)
        )
        return updated
      }
      return b
    }))
  }

  const handleUpdateItemPrice = (blockId: string, itemId: string, price: number) => {
    setBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          items: b.items.map(item => item.id === itemId ? { ...item, unitPrice: price } : item)
        }
      }
      return b
    }))
  }

  const handleRemoveBlock = (blockId: string) => {
    if (blocks.length <= 1) {
      alert('En az 1 adet blok bulunmalıdır.')
      return
    }
    const filtered = blocks.filter(b => b.id !== blockId)
    setBlocks(filtered)
    setSelectedBlockId(filtered[0].id)
  }

  const formatCurrency = (val: number) => {
    return val.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  // --- RENDER DYNAMIC SVG CHART DETAILS ---
  const activeBlockMetrics = calculations.blockMetrics.find(b => b.id === selectedBlockId)
  const categoryChartData = useMemo(() => {
    if (!activeBlockMetrics) return []
    const totals = activeBlockMetrics.categoryTotals
    const grand = Object.values(totals).reduce((sum, val) => sum + val, 0)
    if (grand === 0) return []

    let cumulativePercent = 0
    return Object.entries(totals).map(([cat, val], idx) => {
      const percent = val / grand
      const startAngle = cumulativePercent * 360
      cumulativePercent += percent
      const endAngle = cumulativePercent * 360

      // Calculate path arc
      const x1 = 100 + 80 * Math.cos((Math.PI * (startAngle - 90)) / 180)
      const y1 = 100 + 80 * Math.sin((Math.PI * (startAngle - 90)) / 180)
      const x2 = 100 + 80 * Math.cos((Math.PI * (endAngle - 90)) / 180)
      const y2 = 100 + 80 * Math.sin((Math.PI * (endAngle - 90)) / 180)
      const largeArc = percent > 0.5 ? 1 : 0

      // Color mapping
      const colors = ['#f43f5e', '#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#6b7280']
      const color = colors[idx % colors.length]

      return {
        category: MAIN_CATEGORY_LABELS[cat as MainCategory] || cat,
        value: val,
        percent,
        path: `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`,
        color,
      }
    })
  }, [activeBlockMetrics])

  if (!mounted || loading) {
    return <div className="min-h-screen p-8 text-stone-300 bg-[#141210]">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-[#141210] text-stone-100 p-4 md:p-8 font-sans">
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-stone-800 pb-6">
          <div>
            <div className="text-xs font-semibold tracking-[0.2em] text-amber-500 uppercase">BOTANICA LIFE</div>
            <h1 className="mt-2 text-4xl font-extrabold text-white tracking-tight">İnşaat Yaklaşık Maliyet Hesabı</h1>
            <p className="mt-2 text-sm text-stone-400">Blok boyutlarına göre otomatik metraj tahmini, birim fiyat analizleri ve senaryo kıyaslamaları.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/')}
              className="rounded-full border border-stone-800 bg-[#1c1917] px-5 py-2.5 text-sm font-medium text-stone-300 hover:bg-stone-800 hover:text-white transition"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>

        {/* Supabase Scenarios Panel */}
        <section className="mb-8 rounded-3xl bg-[#1c1917] p-6 border border-stone-800 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-grow max-w-md">
              <h3 className="text-lg font-bold text-white">Senaryoları Kaydet & Yükle</h3>
              <p className="mt-1 text-xs text-stone-400">Güncel verileri Supabase'e kaydedebilir veya kayıtlı senaryoları yükleyebilirsiniz.</p>
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Senaryo Adı (Örn: Lüks Konsept Proje)"
                  value={inputs.scenarioName}
                  onChange={(e) => setInputs({ ...inputs, scenarioName: e.target.value })}
                  className="w-full rounded-full border border-stone-800 bg-[#141210] px-4 py-2 text-sm text-stone-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <button
                onClick={saveScenarioToDb}
                disabled={dbState !== 'idle'}
                className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition"
              >
                {dbState === 'saving' ? 'Kaydediliyor...' : activeScenarioId ? 'Senaryoyu Güncelle' : 'Senaryo Kaydet'}
              </button>
              <button
                onClick={() => {
                  setActiveScenarioId(null)
                  setInputs(defaultScenarioInputs)
                  setBlocks([
                    {
                      id: 'block-1',
                      name: 'A Blok (Örnek)',
                      baseArea: 600,
                      floorCount: 10,
                      basementCount: 1,
                      unitCount: 60,
                      averageNetArea: 75,
                      items: autoEstimateItems(600, 10, 1, 60, 75),
                    },
                  ])
                }}
                className="rounded-full border border-stone-800 bg-[#141210] px-5 py-2.5 text-sm font-semibold text-stone-400 hover:text-white"
              >
                Temizle / Yeni Senaryo
              </button>
              <button
                onClick={() => refreshScenarios().catch(err => setServerMessage(err.message))}
                disabled={dbState !== 'idle'}
                className="rounded-full border border-stone-800 bg-[#141210] px-4 py-2.5 text-sm font-semibold text-stone-400 hover:text-white"
              >
                Yenile
              </button>
            </div>
          </div>

          {serverMessage && (
            <div className="mt-4 rounded-2xl bg-amber-950/20 border border-amber-900/30 px-4 py-3 text-sm text-amber-300">
              {serverMessage}
            </div>
          )}

          {/* Scenarios Table */}
          {savedScenarios.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-stone-800">
              <table className="min-w-full text-xs text-left text-stone-400">
                <thead className="bg-[#141210] text-stone-300">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Senaryo Adı</th>
                    <th className="px-4 py-2.5 font-bold">Kayıt Tarihi</th>
                    <th className="px-4 py-2.5 font-bold">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800 bg-[#1c1917]">
                  {savedScenarios.map((scen) => (
                    <tr key={scen.id} className={activeScenarioId === scen.id ? 'bg-amber-950/20' : ''}>
                      <td className="px-4 py-3 font-semibold text-white">{scen.inputs.scenarioName}</td>
                      <td className="px-4 py-3">{scen.savedAt ? new Date(scen.savedAt).toLocaleString('tr-TR') : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadScenario(scen)}
                            className="rounded-full border border-stone-800 bg-[#141210] px-3 py-1 text-xs text-stone-300 hover:text-white hover:border-stone-600"
                          >
                            Yükle
                          </button>
                          <button
                            onClick={() => deleteScenario(scen.id)}
                            className="rounded-full border border-red-900/50 bg-red-950/20 px-3 py-1 text-xs text-red-400 hover:bg-red-900 hover:text-white"
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

        {/* Tab Navigation */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-stone-800 pb-4">
          {[
            { id: 'inputs', label: '1. Senaryo & Blok Girdileri' },
            { id: 'prices', label: '2. Yaklaşık Metraj & Birim Fiyatlar' },
            { id: 'charts', label: '3. Görsel Analiz & Grafikler' },
            { id: 'compare', label: '4. Varyasyon Karşılaştırma' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-[#1c1917] text-stone-400 border border-stone-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        {activeTab === 'inputs' && (
          <div className="space-y-6">
            {/* Global parameters */}
            <div className="grid gap-6 md:grid-cols-3 bg-[#1c1917] p-6 rounded-3xl border border-stone-800">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400">Toplam Arsa Alanı (m²)</label>
                <input
                  type="number"
                  value={inputs.landArea}
                  onChange={(e) => setInputs({ ...inputs, landArea: parseFloat(e.target.value) || 0 })}
                  className="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#141210] px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400">Şantiye Genel Gider Oranı (%)</label>
                <input
                  type="number"
                  value={inputs.indirectCostRate * 100}
                  onChange={(e) => setInputs({ ...inputs, indirectCostRate: (parseFloat(e.target.value) || 0) / 100 })}
                  className="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#141210] px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400">Hedef Kâr Oranı (%)</label>
                <input
                  type="number"
                  value={inputs.targetProfitRate * 100}
                  onChange={(e) => setInputs({ ...inputs, targetProfitRate: (parseFloat(e.target.value) || 0) / 100 })}
                  className="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#141210] px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400">Ruhsat & Proje Bedeli (TL)</label>
                <input
                  type="number"
                  value={inputs.permitAndProjectCost}
                  onChange={(e) => setInputs({ ...inputs, permitAndProjectCost: parseFloat(e.target.value) || 0 })}
                  className="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#141210] px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400">Finansman Maliyeti (TL)</label>
                <input
                  type="number"
                  value={inputs.financingCost}
                  onChange={(e) => setInputs({ ...inputs, financingCost: parseFloat(e.target.value) || 0 })}
                  className="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#141210] px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Block parameters */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Blok Boyutları & Yapı Bilgileri</h3>
                <button
                  onClick={handleAddBlock}
                  className="rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition"
                >
                  + Yeni Blok Ekle
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {blocks.map((block) => (
                  <div key={block.id} className="relative rounded-3xl bg-[#1c1917] p-6 border border-stone-800 space-y-4">
                    <button
                      onClick={() => handleRemoveBlock(block.id)}
                      className="absolute top-4 right-4 text-red-500 hover:text-red-400 text-xs font-bold"
                    >
                      Bloku Kaldır
                    </button>
                    <div className="border-b border-stone-800 pb-2">
                      <input
                        type="text"
                        value={block.name}
                        onChange={(e) => handleUpdateBlockField(block.id, 'name', e.target.value)}
                        className="text-lg font-bold bg-transparent text-white border-b border-dashed border-stone-700 focus:border-amber-500 focus:outline-none py-1 w-full"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-400">Taban Oturumu (m²)</label>
                        <input
                          type="number"
                          value={block.baseArea}
                          onChange={(e) => handleUpdateBlockField(block.id, 'baseArea', parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-800 bg-[#141210] px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-400">Normal Kat Sayısı</label>
                        <input
                          type="number"
                          value={block.floorCount}
                          onChange={(e) => handleUpdateBlockField(block.id, 'floorCount', parseInt(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-800 bg-[#141210] px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-400">Bodrum Kat Sayısı</label>
                        <input
                          type="number"
                          value={block.basementCount}
                          onChange={(e) => handleUpdateBlockField(block.id, 'basementCount', parseInt(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-800 bg-[#141210] px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-400">Daire (B.B.) Sayısı</label>
                        <input
                          type="number"
                          value={block.unitCount}
                          onChange={(e) => handleUpdateBlockField(block.id, 'unitCount', parseInt(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-800 bg-[#141210] px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-400">Ortalama Daire Neti (m²)</label>
                        <input
                          type="number"
                          value={block.averageNetArea}
                          onChange={(e) => handleUpdateBlockField(block.id, 'averageNetArea', parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-stone-800 bg-[#141210] px-3 py-2 text-sm text-white"
                        />
                      </div>
                    </div>

                    {/* Calculated values block summary */}
                    <div className="mt-4 bg-[#141210] p-3 rounded-2xl border border-stone-800/60 text-xs space-y-1">
                      <div className="flex justify-between text-stone-400">
                        <span>Brüt İnşaat Alanı:</span>
                        <span className="font-semibold text-white">{block.baseArea * (block.floorCount + block.basementCount)} m²</span>
                      </div>
                      <div className="flex justify-between text-stone-400">
                        <span>Satılabilir Net Alan:</span>
                        <span className="font-semibold text-white">{block.unitCount * block.averageNetArea} m²</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'prices' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-[#1c1917] p-4 rounded-2xl border border-stone-800 mb-4">
              <span className="text-sm font-semibold text-stone-400">Hesapları görüntülenecek bloğu seçin:</span>
              <select
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                className="rounded-full border border-stone-800 bg-[#141210] px-4 py-2 text-sm text-white focus:outline-none"
              >
                {blocks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Cost Items Grid */}
            <div className="rounded-3xl bg-[#1c1917] border border-stone-800 p-6">
              <h3 className="text-xl font-bold text-white mb-4">Yaklaşık Metrajlar ve Birim Fiyat Revizeleri</h3>
              <p className="text-xs text-stone-400 mb-6">Metraj miktarları yukarıda tanımladığınız blok boyutlarına göre otomatik tahmin edilmiştir. Birim fiyatları güncel piyasa şartlarına göre değiştirebilirsiniz.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-800 text-stone-500">
                      <th className="py-2.5 px-2">İş Kalemi</th>
                      <th className="py-2.5 px-2">Kategori</th>
                      <th className="py-2.5 px-2 text-right">Otomatik Metraj</th>
                      <th className="py-2.5 px-2 text-center">Birim</th>
                      <th className="py-2.5 px-2 text-right">Birim Fiyat</th>
                      <th className="py-2.5 px-2 text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800">
                    {blocks.find(b => b.id === selectedBlockId)?.items.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-900/30">
                        <td className="py-3 px-2 font-semibold text-white">{item.name}</td>
                        <td className="py-3 px-2 text-stone-500">{item.category}</td>
                        <td className="py-3 px-2 text-right font-medium text-stone-300">
                          {item.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                        </td>
                        <td className="py-3 px-2 text-center text-stone-500">{item.unit}</td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItemPrice(selectedBlockId, item.id, parseFloat(e.target.value) || 0)}
                            className="w-24 rounded border border-stone-800 bg-[#141210] px-2 py-1 text-right text-white text-xs focus:border-amber-500"
                          />
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-white">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex items-center gap-4 bg-[#1c1917] p-4 rounded-2xl border border-stone-800 md:col-span-2">
              <span className="text-sm font-semibold text-stone-400">Analizi görüntülenecek bloğu seçin:</span>
              <select
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                className="rounded-full border border-stone-800 bg-[#141210] px-4 py-2 text-sm text-white focus:outline-none"
              >
                {blocks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Custom SVG Donut Chart */}
            <div className="rounded-3xl bg-[#1c1917] p-6 border border-stone-800 flex flex-col items-center">
              <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider text-center">Maliyet Kategori Dağılımı</h3>
              {categoryChartData.length > 0 ? (
                <div className="w-full flex flex-col sm:flex-row items-center justify-around gap-6">
                  <svg className="w-48 h-48" viewBox="0 0 200 200">
                    {categoryChartData.map((d, idx) => (
                      <path
                        key={idx}
                        d={d.path}
                        fill={d.color}
                        className="transition hover:opacity-85 cursor-pointer"
                      />
                    ))}
                    <circle cx="100" cy="100" r="50" fill="#1c1917" />
                  </svg>
                  <div className="space-y-2 text-xs">
                    {categoryChartData.map((d, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-sm block" style={{ backgroundColor: d.color }} />
                        <span className="text-stone-400 font-medium">{d.category}:</span>
                        <span className="font-bold text-white">%{Math.round(d.percent * 100)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-stone-500 text-sm py-12">Yeterli veri bulunmuyor.</p>
              )}
            </div>

            {/* Block comparisons bars */}
            <div className="rounded-3xl bg-[#1c1917] p-6 border border-stone-800">
              <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider">Blok Maliyet Karşılaştırmaları</h3>
              <div className="space-y-4">
                {calculations.blockMetrics.map((b) => {
                  const maxCost = Math.max(...calculations.blockMetrics.map(x => x.directCost), 1)
                  const percentage = (b.directCost / maxCost) * 100
                  return (
                    <div key={b.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-stone-300">
                        <span>{b.name}</span>
                        <span>{formatCurrency(b.directCost)}</span>
                      </div>
                      <div className="w-full bg-[#141210] h-3.5 rounded-full overflow-hidden border border-stone-800">
                        <div className="bg-amber-600 h-full rounded-full transition-all" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4 bg-[#1c1917] p-4 rounded-2xl border border-stone-800">
              <span className="text-sm font-semibold text-stone-400">Karşılaştırılacak Kayıtlı Senaryoyu Seçin:</span>
              <select
                value={compareScenarioId}
                onChange={(e) => setCompareScenarioId(e.target.value)}
                className="rounded-full border border-stone-800 bg-[#141210] px-4 py-2 text-sm text-white focus:outline-none"
              >
                <option value="">-- Kayıt Seçin --</option>
                {savedScenarios.map(s => (
                  <option key={s.id} value={s.id}>{s.inputs.scenarioName}</option>
                ))}
              </select>
            </div>

            {/* Side-by-side table */}
            <div className="rounded-3xl bg-[#1c1917] p-6 border border-stone-800">
              <h3 className="text-xl font-bold text-white mb-6">Senaryo Karşılaştırma Matrisi</h3>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Current Scenario */}
                <div className="border border-stone-800 rounded-2xl p-4 bg-[#141210]">
                  <h4 className="font-bold text-amber-500 border-b border-stone-800 pb-2 mb-4 uppercase text-xs">
                    Mevcut Aktif Senaryo: {inputs.scenarioName}
                  </h4>
                  <table className="w-full text-xs space-y-2">
                    <tbody>
                      <tr className="border-b border-stone-900"><td className="py-2 text-stone-400">Toplam Brüt İnşaat Alanı:</td><td className="text-right font-bold text-white">{calculations.totalGrossArea} m²</td></tr>
                      <tr className="border-b border-stone-900"><td className="py-2 text-stone-400">Toplam Satılabilir Net Alan:</td><td className="text-right font-bold text-white">{calculations.totalNetArea} m²</td></tr>
                      <tr className="border-b border-stone-900"><td className="py-2 text-stone-400">Toplam Tahmini Maliyet:</td><td className="text-right font-bold text-white">{formatCurrency(calculations.grandTotalCost)}</td></tr>
                      <tr className="border-b border-stone-900"><td className="py-2 text-stone-400">Brüt m² Maliyeti:</td><td className="text-right font-bold text-white">{formatCurrency(calculations.grandCostPerGrossM2)} / m²</td></tr>
                      <tr className="border-b border-stone-900"><td className="py-2 text-stone-400">Net m² Maliyeti:</td><td className="text-right font-bold text-white">{formatCurrency(calculations.grandCostPerNetM2)} / m²</td></tr>
                      <tr className="pt-2 font-bold text-emerald-500"><td className="py-2">Hedef Satış Toplamı:</td><td className="text-right">{formatCurrency(calculations.targetSalesTotal)}</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Compared Scenario */}
                {compareCalculations ? (
                  <div className="border border-stone-800 rounded-2xl p-4 bg-[#141210]">
                    <h4 className="font-bold text-sky-500 border-b border-stone-800 pb-2 mb-4 uppercase text-xs">
                      Karşılaştırılan Senaryo: {compareCalculations.name}
                    </h4>
                    <table className="w-full text-xs space-y-2">
                      <tbody>
                        <tr className="border-b border-stone-900"><td className="py-2 text-stone-400">Toplam Brüt İnşaat Alanı:</td><td className="text-right font-bold text-white">{compareCalculations.totalGrossArea} m²</td></tr>
                        <tr className="border-b border-stone-900"><td className="py-2 text-stone-400">Toplam Satılabilir Net Alan:</td><td className="text-right font-bold text-white">{compareCalculations.totalNetArea} m²</td></tr>
                        <tr className="border-b border-stone-900"><td className="py-2 text-stone-400">Toplam Tahmini Maliyet:</td><td className="text-right font-bold text-white">{formatCurrency(compareCalculations.grandTotalCost)}</td></tr>
                        <tr className="border-b border-stone-900"><td className="py-2 text-stone-400">Brüt m² Maliyeti:</td><td className="text-right font-bold text-white">{formatCurrency(compareCalculations.totalGrossArea > 0 ? compareCalculations.grandTotalCost / compareCalculations.totalGrossArea : 0)} / m²</td></tr>
                        <tr className="border-b border-stone-900"><td className="py-2 text-stone-400">Net m² Maliyeti:</td><td className="text-right font-bold text-white">{formatCurrency(compareCalculations.totalNetArea > 0 ? compareCalculations.grandTotalCost / compareCalculations.totalNetArea : 0)} / m²</td></tr>
                        <tr className="pt-2 font-bold text-emerald-500"><td className="py-2">Hedef Satış Toplamı:</td><td className="text-right">{formatCurrency(compareCalculations.targetSalesTotal)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-stone-800 border-dashed rounded-2xl p-6 bg-[#141210] flex items-center justify-center text-stone-500 text-xs text-center">
                    Karşılaştırmak üzere listeden kayıtlı bir senaryo seçin.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM METRICS BOARD */}
        <div className="mt-8 rounded-3xl bg-gradient-to-br from-stone-900 via-amber-950 to-stone-900 p-8 border border-stone-800 shadow-2xl">
          <h3 className="text-lg font-bold tracking-wide uppercase text-amber-500">GENEL YAPILANDIRMA VE MALİYET ANALİZİ</h3>
          <div className="grid gap-6 mt-6 md:grid-cols-4">
            <div className="rounded-2xl bg-white/5 p-5 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Toplam İnşaat Alanı</span>
              <div className="mt-2 text-2xl font-black text-white">{calculations.totalGrossArea.toLocaleString('tr-TR')} m²</div>
              <div className="mt-1 text-[10px] text-stone-400">Normal ve Bodrum Katlar Brüt Toplamı</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-5 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Tahmini Toplam Maliyet</span>
              <div className="mt-2 text-2xl font-black text-white">{formatCurrency(calculations.grandTotalCost)}</div>
              <div className="mt-1 text-[10px] text-stone-400">Doğrudan + Dolaylı Maliyetler ve Finansman</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-5 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Tahmini Net m² Birim Maliyeti</span>
              <div className="mt-2 text-2xl font-black text-white">{formatCurrency(calculations.grandCostPerNetM2)} / m²</div>
              <div className="mt-1 text-[10px] text-stone-400">Satılabilir Net Bağımsız Bölüm Maliyeti</div>
            </div>
            <div className="rounded-2xl bg-amber-500/10 p-5 border border-amber-500/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">HEDEF SATIŞ TUTARI (KDV DAHİL)</span>
              <div className="mt-2 text-2xl font-black text-amber-300">{formatCurrency(calculations.targetSalesWithVat)}</div>
              <div className="mt-1 text-[10px] text-amber-400">Hedeflenen Kâr Oranı ve Vergiler Dahil</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
