
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

type MainCategory = 'Kaba' | 'Ince' | 'Mekanik' | 'Elektrik' | 'Cevre Duzenleme' | 'Diger'

const MAIN_CATEGORY_ORDER: MainCategory[] = ['Kaba', 'Ince', 'Mekanik', 'Elektrik', 'Cevre Duzenleme']
const CATEGORY_SEPARATOR = ' - '
const SUBCATEGORY_ACCENTS = [
  {
    dot: 'bg-rose-500',
    active: 'border-rose-300 bg-rose-50 text-rose-800',
    idle: 'border-rose-200 bg-white text-stone-700 hover:border-rose-300 hover:bg-rose-50/60',
  },
  {
    dot: 'bg-sky-500',
    active: 'border-sky-300 bg-sky-50 text-sky-800',
    idle: 'border-sky-200 bg-white text-stone-700 hover:border-sky-300 hover:bg-sky-50/60',
  },
  {
    dot: 'bg-emerald-500',
    active: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    idle: 'border-emerald-200 bg-white text-stone-700 hover:border-emerald-300 hover:bg-emerald-50/60',
  },
  {
    dot: 'bg-violet-500',
    active: 'border-violet-300 bg-violet-50 text-violet-800',
    idle: 'border-violet-200 bg-white text-stone-700 hover:border-violet-300 hover:bg-violet-50/60',
  },
  {
    dot: 'bg-amber-500',
    active: 'border-amber-300 bg-amber-50 text-amber-800',
    idle: 'border-amber-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50/60',
  },
  {
    dot: 'bg-cyan-500',
    active: 'border-cyan-300 bg-cyan-50 text-cyan-800',
    idle: 'border-cyan-200 bg-white text-stone-700 hover:border-cyan-300 hover:bg-cyan-50/60',
  },
] as const

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

type SubCategoryContextMenuState = {
  blockId: string
  mainCategory: MainCategory | ''
  category: string
  x: number
  y: number
}

type BlockMetrics = {
  id: string
  name: string
  grossArea: number
  netSellableArea: number
  commonArea: number
  actualCommonAreaRatio: number
  baseFootprint: number
  unitCount: number
  directCost: number
  costPerGrossM2: number
  costPerNetM2: number
  costPerUnit: number
  categoryTotals: Record<string, number>
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

function createItem(name: string, category: string, unit: string, quantity = 0, unitPrice = 0): CostItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    category,
    unit,
    quantity,
    unitPrice,
  }
}

const createKabaTemplateItems = (): CostItem[] => [
  createItem('Hafriyat metraji', 'Kaba - Hafriyat', 'm3'),
  createItem('Temel alti grobeton metraji', 'Kaba - Beton', 'm3'),
  createItem('Temel/perde/kolon/kiris/doese beton metraji', 'Kaba - Beton', 'm3'),
  createItem('Demir ton metraji', 'Kaba - Demir', 'ton'),
  createItem('Kalip metraji', 'Kaba - Kalip', 'm2'),
  createItem('Duvar imalati metraji', 'Kaba - Duvar', 'm2'),
  createItem('Su yalitimi metraji', 'Kaba - Yalitım', 'm2'),
  createItem('Kaba insaat iscilik metraji', 'Kaba - Iscilik', 'm2'),
]

const createInceTemplateItems = (): CostItem[] => [
  createItem('Ic cephe kaba siva metraji', 'Ince - Siva', 'm2'),
  createItem('Alci siva / makina alcisi metraji', 'Ince - Alci', 'm2'),
  createItem('Saten alci metraji', 'Ince - Alci', 'm2'),
  createItem('Zemin seramik kaplama metraji', 'Ince - Seramik', 'm2'),
  createItem('Duvar seramik kaplama metraji', 'Ince - Seramik', 'm2'),
  createItem('Sap / self leveling metraji', 'Ince - Zemin', 'm2'),
  createItem('Laminat parke metraji', 'Ince - Zemin', 'm2'),
  createItem('Ic cephe boya metraji', 'Ince - Boya', 'm2'),
  createItem('Tavan boya metraji', 'Ince - Boya', 'm2'),
  createItem('Asma tavan metraji', 'Ince - Tavan', 'm2'),
  createItem('Ic kapi adet/metraj', 'Ince - Kapi', 'adet'),
  createItem('Supurgelik metraji', 'Ince - Dograma', 'mtul'),
  createItem('Mutfak dolabi', 'Ince - Mobilya', 'adet'),
  createItem('Banyo dolabi', 'Ince - Mobilya', 'adet'),
  createItem('Dusakabin', 'Ince - Vitrifiye', 'adet'),
  createItem('Vitrifiye gruplari', 'Ince - Vitrifiye', 'adet'),
]

const createMechanicalElectricalTemplateItems = (): CostItem[] => [
  createItem('Elektrik tesisati kaba+ince metraji', 'Elektrik - Kuvvetli Akim', 'm2'),
  createItem('Zayif akim metraji', 'Elektrik - Zayif Akim', 'm2'),
  createItem('Temiz su tesisati metraji', 'Mekanik - Sihhi Tesisat', 'mtul'),
  createItem('Pis su tesisati metraji', 'Mekanik - Sihhi Tesisat', 'mtul'),
  createItem('Yangin tesisati metraji', 'Mekanik - Yangin', 'mtul'),
  createItem('HVAC / havalandirma metraji', 'Mekanik - HVAC', 'm2'),
]

const createEnvironmentTemplateItems = (): CostItem[] => [
  createItem('Peyzaj uygulamasi', 'Cevre Duzenleme - Peyzaj', 'm2'),
  createItem('Yuruyus yolu / kilit tas', 'Cevre Duzenleme - Sert Zemin', 'm2'),
  createItem('Bahce duvari / cevre duvari', 'Cevre Duzenleme - Duvar', 'mtul'),
  createItem('Otopark duzenleme', 'Cevre Duzenleme - Sert Zemin', 'm2'),
  createItem('Sulama altyapisi', 'Cevre Duzenleme - Altyapi', 'mtul'),
]

const createDefaultItems = (): CostItem[] => [
  ...createKabaTemplateItems(),
  ...createInceTemplateItems(),
  ...createMechanicalElectricalTemplateItems(),
  ...createEnvironmentTemplateItems(),
]

const createBlock = (index: number): BlockInput => ({
  id: `block-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  name: `Blok ${String.fromCharCode(65 + index)}`,
  baseArea: 850,
  floorCount: 8,
  basementCount: 1,
  unitCount: 32,
  averageNetArea: 120,
  items: createDefaultItems(),
})

function cloneBlock(source: BlockInput, index: number): BlockInput {
  return {
    ...source,
    id: `block-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${source.name} Kopya`,
    items: source.items.map(item => ({
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    })),
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatCompactCurrency(value: number) {
  const abs = Math.abs(value || 0)
  if (abs >= 1_000_000_000) {
    return `₺${formatNumber(value / 1_000_000_000, 2)} Mr`
  }
  if (abs >= 1_000_000) {
    return `₺${formatNumber(value / 1_000_000, 2)} Mn`
  }
  if (abs >= 1_000) {
    return `₺${formatNumber(value / 1_000, 1)} B`
  }
  return formatCurrency(value)
}

function formatCompactPercent(value: number) {
  return `%${formatNumber(value, 1)}`
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0)
}

function createMetricsForBlock(block: BlockInput): BlockMetrics {
  const grossArea = block.baseArea * (block.floorCount + block.basementCount)
  const netSellableArea = block.unitCount * block.averageNetArea
  const commonArea = Math.max(grossArea - netSellableArea, 0)
  const actualCommonAreaRatio = netSellableArea > 0 ? commonArea / netSellableArea : 0
  const categoryTotals = block.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + ((item.quantity || 0) * (item.unitPrice || 0))
    return acc
  }, {})
  const directCost = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0)

  return {
    id: block.id,
    name: block.name,
    grossArea,
    netSellableArea,
    commonArea,
    actualCommonAreaRatio,
    baseFootprint: block.baseArea,
    unitCount: block.unitCount,
    directCost,
    costPerGrossM2: grossArea > 0 ? directCost / grossArea : 0,
    costPerNetM2: netSellableArea > 0 ? directCost / netSellableArea : 0,
    costPerUnit: block.unitCount > 0 ? directCost / block.unitCount : 0,
    categoryTotals,
  }
}

function getDefaultUnitForCategory(category: string) {
  if (category.includes('Demir')) return 'ton'
  if (category.includes('Mobilya') || category.includes('Vitrifiye') || category.includes('Kapi')) return 'adet'
  if (category.includes('Duvar') || category.includes('Yalit') || category.includes('Seramik') || category.includes('Boya') || category.includes('Zemin') || category.includes('Tavan') || category.includes('Peyzaj')) return 'm2'
  if (category.includes('Sihhi') || category.includes('Yangin') || category.includes('Altyapi')) return 'mtul'
  if (category.includes('Beton') || category.includes('Hafriyat')) return 'm3'
  return 'm2'
}

function getSubCategoryLabel(category: string, mainCategory: MainCategory | '') {
  if (!category) return ''
  if (!mainCategory || mainCategory === 'Diger') return category

  const prefix = `${mainCategory}${CATEGORY_SEPARATOR}`
  return category.startsWith(prefix) ? category.slice(prefix.length).trim() : category
}

function buildCategoryName(mainCategory: MainCategory | '', subCategoryLabel: string) {
  const trimmedLabel = subCategoryLabel.trim()
  if (!trimmedLabel) return ''
  if (!mainCategory || mainCategory === 'Diger') return trimmedLabel
  return `${mainCategory}${CATEGORY_SEPARATOR}${trimmedLabel}`
}

function getSubCategoryAccent(category: string) {
  const source = String(category || '')
  let hash = 0
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0
  }
  return SUBCATEGORY_ACCENTS[hash % SUBCATEGORY_ACCENTS.length]
}

function getSubtotalRowClass(mainCategory: MainCategory | '') {
  if (mainCategory === 'Kaba') return 'border-stone-300 bg-stone-100 text-stone-900'
  if (mainCategory === 'Ince') return 'border-amber-300 bg-amber-50 text-amber-900'
  if (mainCategory === 'Mekanik') return 'border-cyan-300 bg-cyan-50 text-cyan-900'
  if (mainCategory === 'Elektrik') return 'border-indigo-300 bg-indigo-50 text-indigo-900'
  if (mainCategory === 'Cevre Duzenleme') return 'border-emerald-300 bg-emerald-50 text-emerald-900'
  return 'border-stone-300 bg-stone-50 text-stone-900'
}

export default function ConstructionCostsPage() {
  const router = useRouter()
  const { user, loading, isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [inputs, setInputs] = useState<ScenarioInputs>(defaultScenarioInputs)
  const [blocks, setBlocks] = useState<BlockInput[]>([createBlock(0)])
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([])
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [scenariosLoading, setScenariosLoading] = useState(false)
  const [activeMainCategoryByBlock, setActiveMainCategoryByBlock] = useState<Record<string, MainCategory>>({})
  const [activeSubCategoryByBlock, setActiveSubCategoryByBlock] = useState<Record<string, string>>({})
  const [subCategoryDraftByBlock, setSubCategoryDraftByBlock] = useState<Record<string, string>>({})
  const [editingSubCategoryByBlock, setEditingSubCategoryByBlock] = useState<Record<string, string>>({})
  const [newSubCategoryByBlock, setNewSubCategoryByBlock] = useState<Record<string, string>>({})
  const [subCategoryContextMenu, setSubCategoryContextMenu] = useState<SubCategoryContextMenuState | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const closeMenu = () => setSubCategoryContextMenu(null)
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
    if (!loading && isAuthenticated && user?.role !== 'admin') {
      router.push('/')
    }
  }, [isAuthenticated, loading, router, user])

  useEffect(() => {
    if (!mounted || !isAuthenticated || user?.role !== 'admin') return
    const loadScenarios = async () => {
      setScenariosLoading(true)
      try {
        const response = await fetch('/api/construction-cost-scenarios')
        const data = await response.json()
        setSavedScenarios(Array.isArray(data) ? data : [])
      } catch {
        setSavedScenarios([])
      } finally {
        setScenariosLoading(false)
      }
    }
    loadScenarios()
  }, [mounted, isAuthenticated, user])

  useEffect(() => {
    setActiveMainCategoryByBlock(prev => {
      let changed = false
      const next = { ...prev }

      blocks.forEach(block => {
        const categories = getMainCategoriesForBlock(block)
        const fallbackCategory = categories[0] || ''
        const currentCategory = prev[block.id]

        if (!fallbackCategory) {
          if (currentCategory) {
            changed = true
            delete next[block.id]
          }
          return
        }

        if (!currentCategory || !categories.includes(currentCategory)) {
          changed = true
          next[block.id] = fallbackCategory
        }
      })

      return changed ? next : prev
    })
  }, [blocks])

  useEffect(() => {
    setActiveSubCategoryByBlock(prev => {
      let changed = false
      const next = { ...prev }

      blocks.forEach(block => {
        const mainCategory =
          activeMainCategoryByBlock[block.id] && getMainCategoriesForBlock(block).includes(activeMainCategoryByBlock[block.id])
            ? activeMainCategoryByBlock[block.id]
            : getMainCategoriesForBlock(block)[0] || ''
        const categories = getSubCategoriesForBlock(block, mainCategory)
        const fallbackCategory = categories[0] || ''
        const currentCategory = prev[block.id]

        if (!fallbackCategory) {
          if (currentCategory) {
            changed = true
            delete next[block.id]
          }
          return
        }

        if (!currentCategory || !categories.includes(currentCategory)) {
          changed = true
          next[block.id] = fallbackCategory
        }
      })

      return changed ? next : prev
    })
  }, [activeMainCategoryByBlock, blocks])

  useEffect(() => {
    setSubCategoryDraftByBlock(prev => {
      const next = { ...prev }
      blocks.forEach(block => {
        const mainCategory = getActiveMainCategory(block)
        const subCategory = getActiveSubCategory(block, mainCategory)
        next[block.id] = getSubCategoryLabel(subCategory, mainCategory)
      })
      return next
    })
  }, [activeMainCategoryByBlock, activeSubCategoryByBlock, blocks])

  const blockMetrics = useMemo(() => blocks.map(createMetricsForBlock), [blocks])

  const metrics = useMemo(() => {
    const totalBaseFootprint = blockMetrics.reduce((sum, block) => sum + block.baseFootprint, 0)
    const grossArea = blockMetrics.reduce((sum, block) => sum + block.grossArea, 0)
    const netSellableArea = blockMetrics.reduce((sum, block) => sum + block.netSellableArea, 0)
    const commonArea = blockMetrics.reduce((sum, block) => sum + block.commonArea, 0)
    const totalUnitCount = blockMetrics.reduce((sum, block) => sum + block.unitCount, 0)
    const directCost = blockMetrics.reduce((sum, block) => sum + block.directCost, 0)
    const actualCommonAreaRatio = netSellableArea > 0 ? commonArea / netSellableArea : 0
    const lotCoverage = inputs.landArea > 0 ? totalBaseFootprint / inputs.landArea : 0
    const indirectCost = directCost * inputs.indirectCostRate
    const contingencyCost = (directCost + indirectCost) * inputs.contingencyRate
    const subtotalCost =
      directCost +
      indirectCost +
      contingencyCost +
      inputs.permitAndProjectCost +
      inputs.financingCost
    const targetSaleWithoutVat = subtotalCost * (1 + inputs.targetProfitRate)
    const vatAmount = targetSaleWithoutVat * inputs.vatRate
    const targetSaleWithVat = targetSaleWithoutVat + vatAmount

    const categoryTotals = blockMetrics.reduce<Record<string, number>>((acc, block) => {
      Object.entries(block.categoryTotals).forEach(([category, total]) => {
        acc[category] = (acc[category] || 0) + total
      })
      return acc
    }, {})

    return {
      totalBaseFootprint,
      grossArea,
      netSellableArea,
      commonArea,
      totalUnitCount,
      directCost,
      actualCommonAreaRatio,
      lotCoverage,
      indirectCost,
      contingencyCost,
      subtotalCost,
      targetSaleWithoutVat,
      vatAmount,
      targetSaleWithVat,
      categoryTotals,
      costPerGrossM2: grossArea > 0 ? subtotalCost / grossArea : 0,
      costPerNetM2: netSellableArea > 0 ? subtotalCost / netSellableArea : 0,
      salePerUnit: totalUnitCount > 0 ? targetSaleWithVat / totalUnitCount : 0,
    }
  }, [blockMetrics, inputs])

  const updateInput = (key: keyof ScenarioInputs, value: number | string) => {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  const getMainCategory = (category: string): MainCategory => {
    if (category.startsWith('Kaba')) return 'Kaba'
    if (category.startsWith('Ince')) return 'Ince'
    if (category.startsWith('Elektrik')) return 'Elektrik'
    if (category.startsWith('Mekanik')) return 'Mekanik'
    if (category.startsWith('Cevre Duzenleme')) return 'Cevre Duzenleme'
    return 'Diger'
  }

  const getMainCategoriesForBlock = (block: BlockInput) => {
    const existing = new Set(block.items.map(item => getMainCategory(item.category)))
    const ordered = MAIN_CATEGORY_ORDER.filter(category => existing.has(category) || MAIN_CATEGORY_ORDER.includes(category))
    if (block.items.some(item => getMainCategory(item.category) === 'Diger')) {
      ordered.push('Diger')
    }
    return ordered
  }

  const getSubCategoriesForBlock = (block: BlockInput, mainCategory: MainCategory | '') => {
    return Array.from(
      new Set(block.items.filter(item => getMainCategory(item.category) === mainCategory).map(item => item.category))
    ).sort((a, b) => a.localeCompare(b, 'tr'))
  }

  const getActiveMainCategory = (block: BlockInput): MainCategory | '' => {
    const categories = getMainCategoriesForBlock(block)
    if (categories.length === 0) return ''
    return activeMainCategoryByBlock[block.id] && categories.includes(activeMainCategoryByBlock[block.id])
      ? activeMainCategoryByBlock[block.id]
      : categories[0]
  }

  const getActiveSubCategory = (block: BlockInput, mainCategory: MainCategory | '') => {
    const categories = getSubCategoriesForBlock(block, mainCategory)
    if (categories.length === 0) return ''
    return activeSubCategoryByBlock[block.id] && categories.includes(activeSubCategoryByBlock[block.id])
      ? activeSubCategoryByBlock[block.id]
      : categories[0]
  }

  const syncSubCategoryDraft = (blockId: string, mainCategory: MainCategory | '', category: string) => {
    setSubCategoryDraftByBlock(prev => ({
      ...prev,
      [blockId]: getSubCategoryLabel(category, mainCategory),
    }))
  }
  const updateBlock = (blockId: string, field: keyof Omit<BlockInput, 'id' | 'items'>, value: string | number) => {
    setBlocks(prev => prev.map(block => (block.id === blockId ? { ...block, [field]: value } : block)))
  }

  const updateBlockItem = (blockId: string, itemId: string, field: keyof CostItem, value: string | number) => {
    setBlocks(prev =>
      prev.map(block =>
        block.id !== blockId
          ? block
          : {
              ...block,
              items: block.items.map(item => (item.id === itemId ? { ...item, [field]: value } : item)),
            }
      )
    )
  }

  const addBlock = () => {
    setBlocks(prev => {
      const nextBlock = createBlock(prev.length)
      const nextMain = getMainCategoriesForBlock(nextBlock)[0] || ''
      const nextSub = getSubCategoriesForBlock(nextBlock, nextMain)[0] || ''
      setActiveMainCategoryByBlock(current => ({
        ...current,
        [nextBlock.id]: nextMain,
      }))
      setActiveSubCategoryByBlock(current => ({
        ...current,
        [nextBlock.id]: nextSub,
      }))
      setSubCategoryDraftByBlock(current => ({
        ...current,
        [nextBlock.id]: getSubCategoryLabel(nextSub, nextMain),
      }))
      return [...prev, nextBlock]
    })
  }

  const duplicateBlock = (blockId: string) => {
    setBlocks(prev => {
      const source = prev.find(block => block.id === blockId)
      if (!source) return prev
      const nextBlock = cloneBlock(source, prev.length)
      const nextMain = getMainCategoriesForBlock(nextBlock)[0] || ''
      const nextSub = getSubCategoriesForBlock(nextBlock, nextMain)[0] || ''
      setActiveMainCategoryByBlock(current => ({
        ...current,
        [nextBlock.id]: nextMain,
      }))
      setActiveSubCategoryByBlock(current => ({
        ...current,
        [nextBlock.id]: nextSub,
      }))
      setSubCategoryDraftByBlock(current => ({
        ...current,
        [nextBlock.id]: getSubCategoryLabel(nextSub, nextMain),
      }))
      return [...prev, nextBlock]
    })
  }

  const removeBlock = (blockId: string) => {
    setBlocks(prev => (prev.length === 1 ? prev : prev.filter(block => block.id !== blockId)))
    setActiveMainCategoryByBlock(prev => {
      const next = { ...prev }
      delete next[blockId]
      return next
    })
    setActiveSubCategoryByBlock(prev => {
      const next = { ...prev }
      delete next[blockId]
      return next
    })
    setSubCategoryDraftByBlock(prev => {
      const next = { ...prev }
      delete next[blockId]
      return next
    })
    setEditingSubCategoryByBlock(prev => {
      const next = { ...prev }
      delete next[blockId]
      return next
    })
    setNewSubCategoryByBlock(prev => {
      const next = { ...prev }
      delete next[blockId]
      return next
    })
  }

  const addItemToBlock = (blockId: string, category = 'Diger') => {
    setBlocks(prev =>
      prev.map(block =>
        block.id !== blockId
          ? block
          : {
              ...block,
              items: [
                ...block.items,
                {
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  name: 'Yeni kalem',
                  category,
                  unit: getDefaultUnitForCategory(category),
                  quantity: 0,
                  unitPrice: 0,
                },
              ],
            }
      )
    )
  }

  const addTemplateToBlock = (blockId: string, template: 'kaba' | 'ince' | 'mekanik' | 'cevre') => {
    const templateItems =
      template === 'kaba'
        ? createKabaTemplateItems()
        : template === 'ince'
          ? createInceTemplateItems()
          : template === 'cevre'
            ? createEnvironmentTemplateItems()
            : createMechanicalElectricalTemplateItems()

    setBlocks(prev =>
      prev.map(block =>
        block.id !== blockId
          ? block
          : {
              ...block,
              items: [...block.items, ...templateItems],
            }
      )
    )
  }

  const removeItemFromBlock = (blockId: string, itemId: string) => {
    setBlocks(prev =>
      prev.map(block =>
        block.id !== blockId
          ? block
          : { ...block, items: block.items.filter(item => item.id !== itemId) }
      )
    )
  }

  const renameSubCategory = (blockId: string, mainCategory: MainCategory | '', currentCategory: string, nextLabel: string) => {
    const nextCategory = buildCategoryName(mainCategory, nextLabel)
    if (!currentCategory || !nextCategory) return

    setBlocks(prev =>
      prev.map(block =>
        block.id !== blockId
          ? block
          : {
              ...block,
              items: block.items.map(item =>
                item.category === currentCategory ? { ...item, category: nextCategory } : item
              ),
            }
      )
    )

    setActiveSubCategoryByBlock(prev => ({
      ...prev,
      [blockId]: nextCategory,
    }))

    setSubCategoryDraftByBlock(prev => ({
      ...prev,
      [blockId]: getSubCategoryLabel(nextCategory, mainCategory),
    }))
  }

  const startInlineSubCategoryEdit = (blockId: string, mainCategory: MainCategory | '', category: string) => {
    setEditingSubCategoryByBlock(prev => ({
      ...prev,
      [blockId]: category,
    }))
    setSubCategoryDraftByBlock(prev => ({
      ...prev,
      [blockId]: getSubCategoryLabel(category, mainCategory),
    }))
  }

  const stopInlineSubCategoryEdit = (blockId: string) => {
    setEditingSubCategoryByBlock(prev => {
      const next = { ...prev }
      delete next[blockId]
      return next
    })
  }

  const commitInlineSubCategoryEdit = (blockId: string, mainCategory: MainCategory | '', category: string) => {
    renameSubCategory(blockId, mainCategory, category, subCategoryDraftByBlock[blockId] ?? '')
    stopInlineSubCategoryEdit(blockId)
  }

  const createSubCategory = (blockId: string, mainCategory: MainCategory | '', label: string) => {
    const nextCategory = buildCategoryName(mainCategory, label)
    if (!nextCategory) return

    const targetBlock = blocks.find(block => block.id === blockId)
    const alreadyExists = targetBlock?.items.some(item => item.category === nextCategory)

    if (!alreadyExists) {
      addItemToBlock(blockId, nextCategory)
    }

    setActiveSubCategoryByBlock(prev => ({
      ...prev,
      [blockId]: nextCategory,
    }))
    setSubCategoryDraftByBlock(prev => ({
      ...prev,
      [blockId]: getSubCategoryLabel(nextCategory, mainCategory),
    }))
    setNewSubCategoryByBlock(prev => ({
      ...prev,
      [blockId]: '',
    }))
  }

  const buildUniqueSubCategoryName = (block: BlockInput | undefined, mainCategory: MainCategory | '', baseLabel: string) => {
    const cleanBase = baseLabel.trim()
    if (!cleanBase) return ''

    let nextLabel = cleanBase
    let index = 2
    let nextCategory = buildCategoryName(mainCategory, nextLabel)

    while (block?.items.some(item => item.category === nextCategory)) {
      nextLabel = `${cleanBase} ${index}`
      nextCategory = buildCategoryName(mainCategory, nextLabel)
      index += 1
    }

    return nextCategory
  }

  const duplicateSubCategory = (blockId: string, mainCategory: MainCategory | '', category: string) => {
    const block = blocks.find(item => item.id === blockId)
    const sourceItems = block?.items.filter(item => item.category === category) || []
    if (sourceItems.length === 0) return

    const baseLabel = `${getSubCategoryLabel(category, mainCategory)} Kopya`
    const nextCategory = buildUniqueSubCategoryName(block, mainCategory, baseLabel)
    if (!nextCategory) return

    setBlocks(prev =>
      prev.map(currentBlock =>
        currentBlock.id !== blockId
          ? currentBlock
          : {
              ...currentBlock,
              items: [
                ...currentBlock.items,
                ...sourceItems.map(item => ({
                  ...item,
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  category: nextCategory,
                })),
              ],
            }
      )
    )

    setActiveSubCategoryByBlock(prev => ({
      ...prev,
      [blockId]: nextCategory,
    }))
    setSubCategoryDraftByBlock(prev => ({
      ...prev,
      [blockId]: getSubCategoryLabel(nextCategory, mainCategory),
    }))
  }

  const deleteSubCategory = (blockId: string, category: string) => {
    const approved = window.confirm('Bu alt sekmedeki tum kalemler silinecek. Devam edilsin mi?')
    if (!approved) return

    setBlocks(prev =>
      prev.map(block =>
        block.id !== blockId
          ? block
          : {
              ...block,
              items: block.items.filter(item => item.category !== category),
            }
      )
    )
  }

  const saveScenario = async () => {
    const response = await fetch('/api/construction-cost-scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs, blocks }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Senaryo kaydedilemedi.')
    }
    setSavedScenarios(prev => [data, ...prev].slice(0, 10))
    setActiveScenarioId(data.id)
  }

  const updateScenario = async () => {
    if (!activeScenarioId) {
      throw new Error('Guncellenecek kayitli senaryo secili degil.')
    }

    const response = await fetch('/api/construction-cost-scenarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeScenarioId, inputs, blocks }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Senaryo guncellenemedi.')
    }

    setSavedScenarios(prev =>
      prev.map(scenario => (scenario.id === data.id ? data : scenario))
    )
  }

  const loadScenario = (scenario: SavedScenario) => {
    setActiveScenarioId(scenario.id)
    setInputs(scenario.inputs)
    setBlocks(scenario.blocks)
    setEditingSubCategoryByBlock({})
    setNewSubCategoryByBlock({})
    setActiveMainCategoryByBlock(
      scenario.blocks.reduce<Record<string, MainCategory>>((acc, block) => {
        acc[block.id] = getMainCategoriesForBlock(block)[0] || ''
        return acc
      }, {})
    )
    setActiveSubCategoryByBlock(
      scenario.blocks.reduce<Record<string, string>>((acc, block) => {
        const mainCategory = getMainCategoriesForBlock(block)[0] || ''
        acc[block.id] = getSubCategoriesForBlock(block, mainCategory)[0] || ''
        return acc
      }, {})
    )
    setSubCategoryDraftByBlock(
      scenario.blocks.reduce<Record<string, string>>((acc, block) => {
        const mainCategory = getMainCategoriesForBlock(block)[0] || ''
        const subCategory = getSubCategoriesForBlock(block, mainCategory)[0] || ''
        acc[block.id] = getSubCategoryLabel(subCategory, mainCategory)
        return acc
      }, {})
    )
  }

  const deleteScenario = async (scenarioId: string) => {
    const approved = window.confirm('Bu senaryoyu silmek istiyor musunuz?')
    if (!approved) return
    const response = await fetch('/api/construction-cost-scenarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: scenarioId }),
    })
    const data = await response.json()
    if (!response.ok) {
      alert(data?.error || 'Senaryo silinemedi.')
      return
    }
    setSavedScenarios(prev => prev.filter(scenario => scenario.id !== scenarioId))
    if (activeScenarioId === scenarioId) {
      setActiveScenarioId(null)
    }
  }

  if (!mounted || loading) {
    return <div className="min-h-screen p-8">Yukleniyor...</div>
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return <div className="min-h-screen p-8">Yetkiniz yok.</div>
  }

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-800 to-orange-900 p-6 text-white shadow-xl md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-orange-200">Maliyet Modulu</div>
            <h1 className="mt-2 text-3xl font-semibold">Insaat Maliyet Hesaplama</h1>
            <p className="mt-2 max-w-3xl text-sm text-stone-200">
              Her blok icin farkli m2, kat, daire ve maliyet kalemi tanimlayin. Sistem bloklari ayri hesaplar,
              sonra proje genelini toplar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeScenarioId && (
              <button
                onClick={async () => {
                  try {
                    await updateScenario()
                    alert('Mevcut senaryo guncellendi.')
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'Senaryo guncellenemedi.'
                    alert(message)
                  }
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Mevcut Senaryoyu Guncelle
              </button>
            )}
            <button
              onClick={() => router.push('/')}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Ana Sayfa
            </button>
            <button
              onClick={async () => {
                try {
                  await saveScenario()
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Senaryo kaydedilemedi.'
                  alert(message)
                }
              }}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
            >
              Senaryoyu Kaydet
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.05fr]">
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-xl font-semibold text-stone-900">Proje Varsayimlari</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ['scenarioName', 'Senaryo adi', 'text'],
                  ['landArea', 'Arsa alani (m2)', 'number'],
                  ['commonAreaRatio', 'Ortak alan oran hedefi', 'percent'],
                  ['indirectCostRate', 'Genel gider orani', 'percent'],
                  ['contingencyRate', 'Beklenmeyen gider orani', 'percent'],
                  ['permitAndProjectCost', 'Ruhsat ve proje gideri', 'number'],
                  ['financingCost', 'Finansman gideri', 'number'],
                  ['targetProfitRate', 'Hedef kar orani', 'percent'],
                  ['vatRate', 'KDV orani', 'percent'],
                ].map(([key, label, type]) => {
                  const inputKey = key as keyof ScenarioInputs
                  const value = inputs[inputKey]
                  return (
                    <label key={key} className="space-y-2">
                      <span className="text-sm font-medium text-stone-700">{label}</span>
                      <input
                        type={type === 'text' ? 'text' : 'number'}
                        step={type === 'percent' ? '0.01' : '1'}
                        value={type === 'percent' ? Number(value) : value}
                        onChange={e =>
                          updateInput(
                            inputKey,
                            type === 'text' ? e.target.value : Number(e.target.value || 0)
                          )
                        }
                        className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-orange-500"
                      />
                    </label>
                  )
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-stone-900">Bloklar</h2>
                  <p className="text-sm text-stone-500">Her blok icin ayri veri girilir ve ayri hesaplanir.</p>
                </div>
                <button
                  onClick={addBlock}
                  className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
                >
                  Blok Ekle
                </button>
              </div>

              <div className="mt-5 space-y-6">
                {blocks.map((block, index) => {
                  const currentMetrics = blockMetrics.find(item => item.id === block.id)
                  const mainCategories = getMainCategoriesForBlock(block)
                  const activeMainCategory = getActiveMainCategory(block)
                  const subCategories = getSubCategoriesForBlock(block, activeMainCategory)
                  const activeSubCategory = getActiveSubCategory(block, activeMainCategory)
                  const visibleItems = activeSubCategory
                    ? block.items.filter(item => item.category === activeSubCategory)
                    : block.items
                  const visibleSubtotal = visibleItems.reduce(
                    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
                    0
                  )
                  return (
                    <div key={block.id} className="rounded-2xl border border-stone-200 p-4">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-900">{block.name}</h3>
                          <div className="text-sm text-stone-500">Blok {index + 1} ayarlari ve maliyet kalemleri</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => duplicateBlock(block.id)}
                            className="rounded-lg px-3 py-2 text-xs text-sky-700 hover:bg-sky-50"
                          >
                            Ayni Maliyetle Ekle
                          </button>
                          <button
                            onClick={() => removeBlock(block.id)}
                            disabled={blocks.length === 1}
                            className="rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300"
                          >
                            Blogu Sil
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[
                          ['name', 'Blok adi', 'text'],
                          ['baseArea', 'Taban oturumu (m2)', 'number'],
                          ['floorCount', 'Normal kat adedi', 'number'],
                          ['basementCount', 'Bodrum kat adedi', 'number'],
                          ['unitCount', 'Bagimsiz bolum adedi', 'number'],
                          ['averageNetArea', 'Ortalama net alan / daire (m2)', 'number'],
                        ].map(([key, label, type]) => {
                          const blockKey = key as keyof Omit<BlockInput, 'id' | 'items'>
                          const value = block[blockKey]
                          return (
                            <label key={key} className="space-y-2">
                              <span className="text-sm font-medium text-stone-700">{label}</span>
                              <input
                                type={type}
                                step={type === 'text' ? undefined : '1'}
                                value={value}
                                onChange={e =>
                                  updateBlock(
                                    block.id,
                                    blockKey,
                                    type === 'text' ? e.target.value : Number(e.target.value || 0)
                                  )
                                }
                                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-orange-500"
                              />
                            </label>
                          )
                        })}
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-4">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <div className="text-xs text-stone-500">Brut alan</div>
                          <div className="mt-1 text-lg font-semibold text-stone-900">{formatNumber(currentMetrics?.grossArea || 0)} m2</div>
                        </div>
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <div className="text-xs text-stone-500">Net alan</div>
                          <div className="mt-1 text-lg font-semibold text-stone-900">{formatNumber(currentMetrics?.netSellableArea || 0)} m2</div>
                        </div>
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <div className="text-xs text-stone-500">Dogrudan maliyet</div>
                          <div className="mt-1 text-lg font-semibold text-stone-900">{formatCurrency(currentMetrics?.directCost || 0)}</div>
                        </div>
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <div className="text-xs text-stone-500">Brut m2 maliyeti</div>
                          <div className="mt-1 text-lg font-semibold text-stone-900">{formatCurrency(currentMetrics?.costPerGrossM2 || 0)}</div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:items-start">
                      <div className="xl:sticky xl:top-24 xl:z-20 space-y-3 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                        <div className="flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-base font-semibold text-stone-900">{block.name} maliyet kalemleri</h4>
                          <p className="text-sm text-stone-500">
                            Bu tablo sadece secili blok icindir. Metraj ve birim fiyati girdiginizde tutar otomatik
                            hesaplanir; blok ve proje ozetleri aninda guncellenir.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => addTemplateToBlock(block.id, 'kaba')}
                            className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-700"
                          >
                            Kaba Sablonu
                          </button>
                          <button
                            onClick={() => addTemplateToBlock(block.id, 'ince')}
                            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-500"
                          >
                            Ince Isler Sablonu
                          </button>
                          <button
                            onClick={() => addTemplateToBlock(block.id, 'mekanik')}
                            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cyan-600"
                          >
                            Mekanik + Elektrik
                          </button>
                          <button
                            onClick={() => addTemplateToBlock(block.id, 'cevre')}
                            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-600"
                          >
                            Cevre Duzenleme
                          </button>
                          <button
                            onClick={() => addItemToBlock(block.id, activeSubCategory || activeMainCategory || 'Diger')}
                            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
                          >
                            Kalem Ekle
                          </button>
                        </div>
                        </div>

                      <div className="rounded-2xl border border-stone-200 bg-gradient-to-r from-stone-50 to-white p-3">
                        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
                          Ana Kategori
                        </div>
                        <div className="flex flex-wrap gap-2">
                        {mainCategories.map(category => (
                          <button
                            key={category}
                            onClick={() =>
                              {
                                const nextSub = getSubCategoriesForBlock(block, category)[0] || ''
                                setActiveMainCategoryByBlock(prev => ({
                                  ...prev,
                                  [block.id]: category,
                                }))
                                setActiveSubCategoryByBlock(prev => ({
                                  ...prev,
                                  [block.id]: nextSub,
                                }))
                                syncSubCategoryDraft(block.id, category, nextSub)
                              }
                            }
                            className={`rounded-xl px-4 py-2 text-xs font-semibold tracking-[0.08em] transition ${
                              activeMainCategory === category
                                ? category === 'Kaba'
                                  ? 'bg-stone-900 text-white shadow-sm'
                                  : category === 'Ince'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : category === 'Mekanik'
                                      ? 'bg-cyan-700 text-white shadow-sm'
                                      : category === 'Elektrik'
                                        ? 'bg-indigo-700 text-white shadow-sm'
                                        : category === 'Cevre Duzenleme'
                                          ? 'bg-emerald-700 text-white shadow-sm'
                                          : 'bg-stone-900 text-white shadow-sm'
                                : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            {category}
                          </button>
                        ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
                          Alt Kategori
                        </div>
                        <div className="flex flex-wrap gap-2">
                        {subCategories.map(category => (
                          editingSubCategoryByBlock[block.id] === category ? (
                            <input
                              key={category}
                              autoFocus
                              value={subCategoryDraftByBlock[block.id] ?? getSubCategoryLabel(category, activeMainCategory)}
                              onChange={e =>
                                setSubCategoryDraftByBlock(prev => ({
                                  ...prev,
                                  [block.id]: e.target.value,
                                }))
                              }
                              onBlur={() => commitInlineSubCategoryEdit(block.id, activeMainCategory, category)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  commitInlineSubCategoryEdit(block.id, activeMainCategory, category)
                                }
                                if (e.key === 'Escape') {
                                  syncSubCategoryDraft(block.id, activeMainCategory, category)
                                  stopInlineSubCategoryEdit(block.id)
                                }
                              }}
                              className="min-w-[180px] rounded-xl border border-orange-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 outline-none ring-2 ring-orange-100"
                            />
                          ) : (
                            <button
                              key={category}
                              onClick={() => {
                                setActiveSubCategoryByBlock(prev => ({
                                  ...prev,
                                  [block.id]: category,
                                }))
                                syncSubCategoryDraft(block.id, activeMainCategory, category)
                              }}
                              onDoubleClick={() => startInlineSubCategoryEdit(block.id, activeMainCategory, category)}
                              onContextMenu={event => {
                                event.preventDefault()
                                setActiveSubCategoryByBlock(prev => ({
                                  ...prev,
                                  [block.id]: category,
                                }))
                                syncSubCategoryDraft(block.id, activeMainCategory, category)
                                setSubCategoryContextMenu({
                                  blockId: block.id,
                                  mainCategory: activeMainCategory,
                                  category,
                                  x: event.clientX,
                                  y: event.clientY,
                                })
                              }}
                              title="Cift tiklayip duzenleyin, sag tik ile menu acin"
                              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                                activeSubCategory === category
                                  ? getSubCategoryAccent(category).active
                                  : getSubCategoryAccent(category).idle
                              }`}
                            >
                              <span className={`h-2.5 w-2.5 rounded-full ${getSubCategoryAccent(category).dot}`}></span>
                              <span>{category}</span>
                            </button>
                          )
                        ))}
                        {subCategories.length === 0 && (
                          <div className="rounded-xl border border-dashed border-stone-300 bg-white px-3 py-2 text-xs text-stone-500">
                            Bu ana kategori icin alt kategori yok.
                          </div>
                        )}
                        </div>
                        {subCategoryContextMenu?.blockId === block.id && (
                          <div
                            className="fixed z-50 min-w-[190px] rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl"
                            style={{ left: subCategoryContextMenu.x, top: subCategoryContextMenu.y }}
                            onClick={event => event.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                startInlineSubCategoryEdit(
                                  subCategoryContextMenu.blockId,
                                  subCategoryContextMenu.mainCategory,
                                  subCategoryContextMenu.category
                                )
                                setSubCategoryContextMenu(null)
                              }}
                              className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
                            >
                              Yeniden Adlandir
                            </button>
                            <button
                              onClick={() => {
                                duplicateSubCategory(
                                  subCategoryContextMenu.blockId,
                                  subCategoryContextMenu.mainCategory,
                                  subCategoryContextMenu.category
                                )
                                setSubCategoryContextMenu(null)
                              }}
                              className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
                            >
                              Cogalt
                            </button>
                            <button
                              onClick={() => {
                                deleteSubCategory(subCategoryContextMenu.blockId, subCategoryContextMenu.category)
                                setSubCategoryContextMenu(null)
                              }}
                              className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              Sil
                            </button>
                          </div>
                        )}
                        {activeSubCategory && (
                          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-3">
                            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
                              Alt Kategori Adi
                            </div>
                            <div className="flex flex-col gap-2 md:flex-row">
                              <input
                                value={subCategoryDraftByBlock[block.id] ?? getSubCategoryLabel(activeSubCategory, activeMainCategory)}
                                onChange={e =>
                                  setSubCategoryDraftByBlock(prev => ({
                                    ...prev,
                                    [block.id]: e.target.value,
                                  }))
                                }
                                placeholder="Alt kategori adini girin"
                                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
                              />
                              <button
                                onClick={() =>
                                  renameSubCategory(
                                    block.id,
                                    activeMainCategory,
                                    activeSubCategory,
                                    subCategoryDraftByBlock[block.id] ?? ''
                                  )
                                }
                                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
                              >
                                Alt Sekme Adini Guncelle
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white p-3">
                          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
                            Yeni Alt Sekme
                          </div>
                          <div className="flex flex-col gap-2 md:flex-row">
                            <input
                              value={newSubCategoryByBlock[block.id] || ''}
                              onChange={e =>
                                setNewSubCategoryByBlock(prev => ({
                                  ...prev,
                                  [block.id]: e.target.value,
                                }))
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  createSubCategory(block.id, activeMainCategory, newSubCategoryByBlock[block.id] || '')
                                }
                              }}
                              placeholder="Ornek: Kaba Kalip, Ic Kapi, Aydinlatma"
                              className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
                            />
                            <button
                              onClick={() => createSubCategory(block.id, activeMainCategory, newSubCategoryByBlock[block.id] || '')}
                              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
                            >
                              Yeni Alt Sekme Ac
                            </button>
                          </div>
                          <div className="mt-2 text-xs text-stone-500">
                            Son kalem silinirse o alt sekme otomatik kaybolur.
                          </div>
                        </div>
                      </div>
                      </div>

                      <div className="min-w-0 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 z-10 bg-white shadow-sm">
                            <tr className="border-b border-stone-200 text-left text-stone-500">
                              <th className="px-3 py-3">Is Kalemi</th>
                              <th className="px-3 py-3">Kategori</th>
                              <th className="px-3 py-3">Birim</th>
                              <th className="px-3 py-3">Metraj</th>
                              <th className="px-3 py-3">Birim Fiyat</th>
                              <th className="px-3 py-3">Tutar</th>
                              <th className="px-3 py-3"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleItems.map(item => {
                              const total = (item.quantity || 0) * (item.unitPrice || 0)
                              return (
                                <tr key={item.id} className="border-b border-stone-100 align-top">
                                  <td className="py-3 pr-3">
                                    <input
                                      value={item.name}
                                      onChange={e => updateBlockItem(block.id, item.id, 'name', e.target.value)}
                                      className="w-44 rounded-xl border border-stone-300 px-3 py-2"
                                    />
                                  </td>
                                  <td className="py-3 pr-3">
                                    <input
                                      value={item.category}
                                      onChange={e => updateBlockItem(block.id, item.id, 'category', e.target.value)}
                                      className="w-36 rounded-xl border border-stone-300 px-3 py-2"
                                    />
                                  </td>
                                  <td className="py-3 pr-3">
                                    <input
                                      value={item.unit}
                                      onChange={e => updateBlockItem(block.id, item.id, 'unit', e.target.value)}
                                      className="w-24 rounded-xl border border-stone-300 px-3 py-2"
                                    />
                                  </td>
                                  <td className="py-3 pr-3">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.quantity}
                                      onChange={e => updateBlockItem(block.id, item.id, 'quantity', Number(e.target.value || 0))}
                                      className="w-28 rounded-xl border border-stone-300 px-3 py-2"
                                    />
                                  </td>
                                  <td className="py-3 pr-3">
                                    <input
                                      type="number"
                                      value={item.unitPrice}
                                      onChange={e => updateBlockItem(block.id, item.id, 'unitPrice', Number(e.target.value || 0))}
                                      className="w-32 rounded-xl border border-stone-300 px-3 py-2"
                                    />
                                  </td>
                                  <td className="py-3 pr-3 font-medium text-stone-900">{formatCurrency(total)}</td>
                                  <td className="py-3 text-right">
                                    <button
                                      onClick={() => removeItemFromBlock(block.id, item.id)}
                                      className="rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                                    >
                                      Sil
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                            {visibleItems.length > 0 && (
                              <tr className={`border-t-2 ${getSubtotalRowClass(activeMainCategory)}`}>
                                <td colSpan={5} className="py-3 pr-3 text-sm font-semibold">
                                  {activeSubCategory || 'Ara Toplam'}
                                </td>
                                <td className="py-3 pr-3 text-sm font-bold">
                                  {formatCurrency(visibleSubtotal)}
                                </td>
                                <td></td>
                              </tr>
                            )}
                            {visibleItems.length === 0 && (
                              <tr>
                                <td colSpan={7} className="py-6 text-center text-sm text-stone-500">
                                  Secili kategori icin kalem bulunmuyor.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-xl font-semibold text-stone-900">Ozet Sonuclar</h2>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0 rounded-3xl bg-gradient-to-br from-stone-900 to-stone-800 p-4 text-white shadow-sm">
                  <div className="text-[11px] font-medium tracking-[0.16em] text-stone-300">Toplam Maliyet</div>
                  <div title={formatCurrency(metrics.subtotalCost)} className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
                    {formatCompactCurrency(metrics.subtotalCost)}
                  </div>
                  <div className="mt-2 text-xs text-stone-300">{formatCurrency(metrics.subtotalCost)}</div>
                </div>
                <div className="min-w-0 rounded-3xl bg-gradient-to-br from-orange-100 to-amber-50 p-4 text-orange-950 ring-1 ring-orange-200 shadow-sm">
                  <div className="text-[11px] font-medium tracking-[0.16em] text-orange-700">Hedef Satis Ciro</div>
                  <div title={formatCurrency(metrics.targetSaleWithVat)} className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
                    {formatCompactCurrency(metrics.targetSaleWithVat)}
                  </div>
                  <div className="mt-2 text-xs text-orange-700">{formatCurrency(metrics.targetSaleWithVat)}</div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:col-span-2 lg:grid-cols-3">
                  <div className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-[11px] font-medium tracking-[0.14em] text-stone-500">Brut m2 maliyeti</div>
                    <div title={formatCurrency(metrics.costPerGrossM2)} className="mt-2 text-xl font-semibold leading-tight text-stone-900">
                      {formatCompactCurrency(metrics.costPerGrossM2)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">{formatCurrency(metrics.costPerGrossM2)}</div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-[11px] font-medium tracking-[0.14em] text-stone-500">Net m2 maliyeti</div>
                    <div title={formatCurrency(metrics.costPerNetM2)} className="mt-2 text-xl font-semibold leading-tight text-stone-900">
                      {formatCompactCurrency(metrics.costPerNetM2)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">{formatCurrency(metrics.costPerNetM2)}</div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-[11px] font-medium tracking-[0.14em] text-stone-500">Daire basi ciro</div>
                    <div title={formatCurrency(metrics.salePerUnit)} className="mt-2 text-xl font-semibold leading-tight text-stone-900">
                      {formatCompactCurrency(metrics.salePerUnit)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">{formatCurrency(metrics.salePerUnit)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:col-span-2 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="text-[11px] font-medium tracking-[0.14em] text-stone-500">Arsa oturum orani</div>
                    <div title={`%${formatNumber(metrics.lotCoverage * 100, 1)}`} className="mt-2 text-xl font-semibold text-stone-900">
                      {formatCompactPercent(metrics.lotCoverage * 100)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">Arsa verimliligi</div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[11px] font-medium tracking-[0.14em] text-stone-500">Ortak alan orani</div>
                          <div title={`%${formatNumber(metrics.actualCommonAreaRatio * 100, 1)}`} className="mt-2 text-xl font-semibold text-stone-900">
                            {formatCompactPercent(metrics.actualCommonAreaRatio * 100)}
                          </div>
                        </div>
                      <div className="rounded-xl bg-stone-100 px-3 py-2 text-right">
                        <div className="text-[10px] font-medium tracking-[0.14em] text-stone-500">Hedef</div>
                        <div className="text-sm font-semibold text-stone-700">
                          %{formatNumber(inputs.commonAreaRatio * 100, 1)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-stone-100">
                      <div
                        className={`h-2 rounded-full ${metrics.actualCommonAreaRatio <= inputs.commonAreaRatio ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min((metrics.actualCommonAreaRatio / Math.max(inputs.commonAreaRatio, 0.01)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-xl font-semibold text-stone-900">Alan ve Maliyet Dagilimi</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-stone-500">Toplam blok adedi</span><span className="font-medium">{formatNumber(blocks.length)}</span></div>
                <div className="flex items-center justify-between"><span className="text-stone-500">Toplam taban oturumu</span><span className="font-medium">{formatNumber(metrics.totalBaseFootprint)} m2</span></div>
                <div className="flex items-center justify-between"><span className="text-stone-500">Brut insaat alani</span><span className="font-medium">{formatNumber(metrics.grossArea)} m2</span></div>
                <div className="flex items-center justify-between"><span className="text-stone-500">Toplam bagimsiz bolum</span><span className="font-medium">{formatNumber(metrics.totalUnitCount)}</span></div>
                <div className="flex items-center justify-between"><span className="text-stone-500">Net satilabilir alan</span><span className="font-medium">{formatNumber(metrics.netSellableArea)} m2</span></div>
                <div className="flex items-center justify-between"><span className="text-stone-500">Ortak alan</span><span className="font-medium">{formatNumber(metrics.commonArea)} m2</span></div>
                <div className="flex items-center justify-between"><span className="text-stone-500">Dogrudan maliyet</span><span className="font-medium">{formatCurrency(metrics.directCost)}</span></div>
                <div className="flex items-center justify-between"><span className="text-stone-500">Genel gider</span><span className="font-medium">{formatCurrency(metrics.indirectCost)}</span></div>
                <div className="flex items-center justify-between"><span className="text-stone-500">Beklenmeyen gider</span><span className="font-medium">{formatCurrency(metrics.contingencyCost)}</span></div>
                <div className="flex items-center justify-between"><span className="text-stone-500">Ruhsat ve proje</span><span className="font-medium">{formatCurrency(inputs.permitAndProjectCost)}</span></div>
                <div className="flex items-center justify-between"><span className="text-stone-500">Finansman</span><span className="font-medium">{formatCurrency(inputs.financingCost)}</span></div>
                <div className="flex items-center justify-between border-t border-stone-200 pt-3"><span className="text-stone-500">Kar haric hedef ciro</span><span className="font-medium">{formatCurrency(metrics.targetSaleWithoutVat)}</span></div>
                <div className="flex items-center justify-between"><span className="text-stone-500">KDV</span><span className="font-medium">{formatCurrency(metrics.vatAmount)}</span></div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-xl font-semibold text-stone-900">Blok Ozetleri</h2>
              <div className="mt-4 space-y-3">
                {blockMetrics.map(block => (
                  <div key={block.id} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-stone-900">{block.name}</div>
                      <div className="text-sm font-medium text-stone-700">{formatCurrency(block.directCost)}</div>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-stone-600 md:grid-cols-2">
                      <div>Brut alan: {formatNumber(block.grossArea)} m2</div>
                      <div>Net alan: {formatNumber(block.netSellableArea)} m2</div>
                      <div>Bagimsiz bolum: {formatNumber(block.unitCount)}</div>
                      <div>Brut m2 maliyeti: {formatCurrency(block.costPerGrossM2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-xl font-semibold text-stone-900">Kategori Bazli Maliyet</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(metrics.categoryTotals).map(([category, total]) => {
                  const ratio = metrics.directCost > 0 ? total / metrics.directCost : 0
                  return (
                    <div key={category}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-stone-700">{category}</span>
                        <span className="font-medium text-stone-900">{formatCurrency(total)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-100">
                        <div className="h-2 rounded-full bg-orange-500" style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-stone-900">Kayitli Senaryolar</h2>
                <div className="text-sm text-stone-500">Supabase uzerinde saklanir</div>
              </div>
              <div className="mt-4 space-y-3">
                {scenariosLoading && (
                  <div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">
                    Senaryolar yukleniyor...
                  </div>
                )}
                {savedScenarios.length === 0 && (
                  <div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">
                    Henuz kayitli senaryo yok.
                  </div>
                )}
                {savedScenarios.map(scenario => {
                  const scenarioDirectCost = scenario.blocks
                    .map(createMetricsForBlock)
                    .reduce((sum, block) => sum + block.directCost, 0)
                  return (
                    <div
                      key={scenario.id}
                      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                        activeScenarioId === scenario.id
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-stone-200 hover:border-orange-400 hover:bg-orange-50'
                      }`}
                    >
                      <button
                        onClick={() => loadScenario(scenario)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2 font-medium text-stone-900">
                          <span>{scenario.inputs.scenarioName}</span>
                          {activeScenarioId === scenario.id && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                              Yuklu
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-500">
                          {new Date(scenario.savedAt).toLocaleString('tr-TR')} - {scenario.blocks.length} blok
                        </div>
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-stone-700">{formatCurrency(scenarioDirectCost)}</div>
                        <button
                          onClick={() => deleteScenario(scenario.id)}
                          className="rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-100"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
