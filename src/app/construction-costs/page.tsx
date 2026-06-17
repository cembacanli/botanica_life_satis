
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

type EditableFieldType = 'text' | 'number' | 'currency' | 'percent' | 'integer'
type MainCategory = 'Hafriyat' | 'Kaba' | 'Ince' | 'Mekanik' | 'Elektrik' | 'Cevre Duzenleme' | 'Diger'

const MAIN_CATEGORY_ORDER: MainCategory[] = ['Hafriyat', 'Kaba', 'Ince', 'Mekanik', 'Elektrik', 'Cevre Duzenleme']
const MAIN_CATEGORY_LABELS: Record<MainCategory, string> = {
  Hafriyat: 'Hafriyat',
  Kaba: 'Kaba',
  Ince: 'İnce',
  Mekanik: 'Mekanik',
  Elektrik: 'Elektrik',
  'Cevre Duzenleme': 'Çevre Düzenleme',
  Diger: 'Diğer',
}
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

type ScenarioFieldConfig = {
  key: keyof ScenarioInputs
  label: string
  type: EditableFieldType
  description: string
}

type BlockFieldConfig = {
  key: keyof Omit<BlockInput, 'id' | 'items'>
  label: string
  type: EditableFieldType
  description: string
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

const SCENARIO_FIELDS: ScenarioFieldConfig[] = [
  { key: 'scenarioName', label: 'Senaryo adı', type: 'text', description: 'Kayıt listesinde bu isimle görünür.' },
  { key: 'landArea', label: 'Arsa alanı (m²)', type: 'number', description: 'Toplam parsel alanı.' },
  { key: 'commonAreaRatio', label: 'Ortak alan oran hedefi (%)', type: 'percent', description: 'Yüzde olarak girin.' },
  { key: 'indirectCostRate', label: 'Genel gider oranı (%)', type: 'percent', description: 'Şantiye genel gider payı.' },
  { key: 'contingencyRate', label: 'Beklenmeyen gider oranı (%)', type: 'percent', description: 'Risk ve sapma rezervi.' },
  { key: 'permitAndProjectCost', label: 'Ruhsat ve proje gideri', type: 'currency', description: 'Sabit resmî ve proje giderleri.' },
  { key: 'financingCost', label: 'Finansman gideri', type: 'currency', description: 'Faiz ve finansman maliyetleri.' },
  { key: 'targetProfitRate', label: 'Hedef kâr oranı (%)', type: 'percent', description: 'Satış hedefi için kâr marjı.' },
  { key: 'vatRate', label: 'KDV oranı (%)', type: 'percent', description: 'Yüzde KDV değeri.' },
]

const BLOCK_FIELDS: BlockFieldConfig[] = [
  { key: 'name', label: 'Blok adı', type: 'text', description: 'Raporlarda görünen blok ismi.' },
  { key: 'baseArea', label: 'Taban oturumu (m²)', type: 'number', description: 'Tek kat taban alanı.' },
  { key: 'floorCount', label: 'Normal kat adedi', type: 'integer', description: 'Zemin üstü kat sayısı.' },
  { key: 'basementCount', label: 'Bodrum kat adedi', type: 'integer', description: 'Toplam bodrum sayısı.' },
  { key: 'unitCount', label: 'Bağımsız bölüm adedi', type: 'integer', description: 'Bu bloktaki toplam daire / dükkân.' },
  { key: 'averageNetArea', label: 'Ortalama net alan / daire (m²)', type: 'number', description: 'Ortalama satılabilir net m².' },
]

const LEGACY_HAFRIYAT_CATEGORY = 'Kaba - Hafriyat'
const TURKISH_TEXT_REPLACEMENTS: Array<[string, string]> = [
  ['Cevre Duzenleme', 'Çevre Düzenleme'],
  ['Diger', 'Diğer'],
  ['diger', 'diğer'],
  ['Bagimsiz', 'Bağımsız'],
  ['Yukleniyor', 'Yükleniyor'],
  ['Guncelle', 'Güncelle'],
  ['gorunum', 'görünüm'],
  ['Gorunum', 'Görünüm'],
  ['goruntuleniyor', 'görüntüleniyor'],
  ['Once', 'Önce'],
  ['once', 'önce'],
  ['Ozet', 'Özet'],
  ['Sablonu', 'Şablonu'],
  ['Secili', 'Seçili'],
  ['Canli', 'Canlı'],
  ['Brut', 'Brüt'],
  ['Dogrudan', 'Doğrudan'],
  ['Dagilimi', 'Dağılımı'],
  ['Kayitli', 'Kayıtlı'],
  ['kayitli', 'kayıtlı'],
  ['Henuz', 'Henüz'],
  ['Satilabilir', 'Satılabilir'],
  ['Satis', 'Satış'],
  ['Yuklu', 'Yüklü'],
  ['Kazi', 'Kazı'],
  ['Yalitim', 'Yalıtım'],
  ['Iscilik', 'İşçilik'],
  ['Ince', 'İnce'],
  ['Ic ', 'İç '],
  ['Alci', 'Alçı'],
  ['Sap ', 'Şap '],
  ['Kapi', 'Kapı'],
  ['Supurgelik', 'Süpürgelik'],
  ['Dograma', 'Doğrama'],
  ['Dusakabin', 'Duşakabin'],
  ['gruplari', 'grupları'],
  ['tesisati', 'tesisatı'],
  ['Zayif', 'Zayıf'],
  ['Sihhi', 'Sıhhi'],
  ['Yangin', 'Yangın'],
  ['havalandirma', 'havalandırma'],
  ['uygulamasi', 'uygulaması'],
  ['Yuruyus', 'Yürüyüş'],
  ['tas', 'taş'],
  ['Bahce', 'Bahçe'],
  ['cevre', 'çevre'],
  ['duzenleme', 'düzenleme'],
  ['Altyapi', 'Altyapı'],
  ['Aydinlatma', 'Aydınlatma'],
  ['Kalip', 'Kalıp'],
  ['metraji', 'metrajı'],
  ['m2', 'm²'],
  ['m3', 'm³'],
  ['mtul', 'mtül'],
  ['alti', 'altı'],
  ['kiris', 'kiriş'],
  ['doese', 'döşe'],
  ['imalati', 'imalatı'],
  ['insaat', 'inşaat'],
  ['siva', 'sıva'],
  ['makina alcisi', 'makina alçısı'],
  ['dolabi', 'dolabı'],
]

function normalizeTurkishText(value: string) {
  return TURKISH_TEXT_REPLACEMENTS.reduce(
    (current, [search, replacement]) => current.split(search).join(replacement),
    String(value || '')
  )
}

function getMainCategoryLabel(category: MainCategory | '') {
  return category ? MAIN_CATEGORY_LABELS[category] || category : ''
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

const createHafriyatTemplateItems = (): CostItem[] => [
  createItem('Kazı metrajı', 'Hafriyat - Kazı', 'm³'),
  createItem('Dolgu metrajı', 'Hafriyat - Dolgu', 'm³'),
]

const createKabaTemplateItems = (): CostItem[] => [
  createItem('Temel altı grobeton metrajı', 'Kaba - Beton', 'm³'),
  createItem('Temel/perde/kolon/kiriş/döşe beton metrajı', 'Kaba - Beton', 'm³'),
  createItem('Demir ton metrajı', 'Kaba - Demir', 'ton'),
  createItem('Kalıp metrajı', 'Kaba - Kalıp', 'm²'),
  createItem('Duvar imalatı metrajı', 'Kaba - Duvar', 'm²'),
  createItem('Su yalıtımı metrajı', 'Kaba - Yalıtım', 'm²'),
  createItem('Kaba inşaat işçilik metrajı', 'Kaba - İşçilik', 'm²'),
]

const createInceTemplateItems = (): CostItem[] => [
  createItem('İç cephe kaba sıva metrajı', 'İnce - Sıva', 'm²'),
  createItem('Alçı sıva / makina alçısı metrajı', 'İnce - Alçı', 'm²'),
  createItem('Saten alçı metrajı', 'İnce - Alçı', 'm²'),
  createItem('Zemin seramik kaplama metrajı', 'İnce - Seramik', 'm²'),
  createItem('Duvar seramik kaplama metrajı', 'İnce - Seramik', 'm²'),
  createItem('Şap / self leveling metrajı', 'İnce - Zemin', 'm²'),
  createItem('Laminat parke metrajı', 'İnce - Zemin', 'm²'),
  createItem('İç cephe boya metrajı', 'İnce - Boya', 'm²'),
  createItem('Tavan boya metrajı', 'İnce - Boya', 'm²'),
  createItem('Asma tavan metrajı', 'İnce - Tavan', 'm²'),
  createItem('İç kapı adet/metraj', 'İnce - Kapı', 'adet'),
  createItem('Süpürgelik metrajı', 'İnce - Doğrama', 'mtül'),
  createItem('Mutfak dolabı', 'İnce - Mobilya', 'adet'),
  createItem('Banyo dolabı', 'İnce - Mobilya', 'adet'),
  createItem('Duşakabin', 'İnce - Vitrifiye', 'adet'),
  createItem('Vitrifiye grupları', 'İnce - Vitrifiye', 'adet'),
]

const createMechanicalElectricalTemplateItems = (): CostItem[] => [
  createItem('Elektrik tesisatı kaba+ince metrajı', 'Elektrik - Kuvvetli Akım', 'm²'),
  createItem('Zayıf akım metrajı', 'Elektrik - Zayıf Akım', 'm²'),
  createItem('Temiz su tesisatı metrajı', 'Mekanik - Sıhhi Tesisat', 'mtül'),
  createItem('Pis su tesisatı metrajı', 'Mekanik - Sıhhi Tesisat', 'mtül'),
  createItem('Yangın tesisatı metrajı', 'Mekanik - Yangın', 'mtül'),
  createItem('HVAC / havalandırma metrajı', 'Mekanik - HVAC', 'm²'),
]

const createEnvironmentTemplateItems = (): CostItem[] => [
  createItem('Peyzaj uygulaması', 'Çevre Düzenleme - Peyzaj', 'm²'),
  createItem('Yürüyüş yolu / kilit taş', 'Çevre Düzenleme - Sert Zemin', 'm²'),
  createItem('Bahçe duvarı / çevre duvarı', 'Çevre Düzenleme - Duvar', 'mtül'),
  createItem('Otopark düzenleme', 'Çevre Düzenleme - Sert Zemin', 'm²'),
  createItem('Sulama altyapısı', 'Çevre Düzenleme - Altyapı', 'mtül'),
]

const createDefaultItems = (): CostItem[] => [
  ...createHafriyatTemplateItems(),
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
    return `₺${formatNumber(value / 1_000, 2)} Bin`
  }
  return formatCurrency(value)
}

function formatCompactPercent(value: number) {
  return `%${formatNumber(value, 2)}`
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0)
}

function parseLocalizedNumber(value: string) {
  const compact = value.replace(/\s+/g, '')
  const normalized = compact.includes(',') && compact.includes('.')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact.includes(',')
      ? compact.replace(',', '.')
      : compact
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function getInputStep(type: EditableFieldType) {
  if (type === 'percent') return '0.01'
  if (type === 'currency' || type === 'number') return '0.01'
  if (type === 'integer') return '1'
  return undefined
}

function getInputMode(type: EditableFieldType) {
  return type === 'text' ? undefined : 'decimal'
}

function getNumericInputValue(value: number, type: EditableFieldType) {
  if (type === 'percent') {
    return Number((value * 100).toFixed(2))
  }
  return value
}

function parseInputValue(value: string, type: EditableFieldType) {
  if (type === 'text') return value
  const parsed = parseLocalizedNumber(value)
  if (type === 'percent') return parsed / 100
  if (type === 'integer') return Math.max(0, Math.round(parsed))
  return parsed
}

function getFieldHelper(value: number | string, type: EditableFieldType) {
  if (type === 'text') return String(value || '')

  const numericValue = Number(value || 0)

  if (type === 'percent') return `%${formatNumber(numericValue * 100, 2)}`
  if (type === 'currency') return formatCurrency(numericValue)
  if (type === 'integer') return formatNumber(numericValue, 0)
  return formatNumber(numericValue, 2)
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
  const normalizedCategory = normalizeTurkishText(category)
  if (normalizedCategory.includes('Demir')) return 'ton'
  if (normalizedCategory.includes('Mobilya') || normalizedCategory.includes('Vitrifiye') || normalizedCategory.includes('Kapı')) return 'adet'
  if (
    normalizedCategory.includes('Duvar') ||
    normalizedCategory.includes('Yalıt') ||
    normalizedCategory.includes('Seramik') ||
    normalizedCategory.includes('Boya') ||
    normalizedCategory.includes('Zemin') ||
    normalizedCategory.includes('Tavan') ||
    normalizedCategory.includes('Peyzaj')
  ) {
    return 'm²'
  }
  if (normalizedCategory.includes('Sıhhi') || normalizedCategory.includes('Yangın') || normalizedCategory.includes('Altyapı')) return 'mtül'
  if (normalizedCategory.includes('Beton') || normalizedCategory.includes('Hafriyat')) return 'm³'
  return 'm²'
}

function normalizeItemCategory(item: CostItem): CostItem {
  const normalizedName = normalizeTurkishText(item.name)
  const normalizedCategoryText = normalizeTurkishText(item.category)

  if (normalizedCategoryText !== LEGACY_HAFRIYAT_CATEGORY) {
    return {
      ...item,
      name: normalizedName,
      category: normalizedCategoryText,
      unit: normalizeTurkishText(item.unit),
    }
  }

  const normalizedCategory = normalizedName.toLocaleLowerCase('tr-TR').includes('dolgu')
    ? 'Hafriyat - Dolgu'
    : 'Hafriyat - Kazı'

  return {
    ...item,
    name: normalizedName,
    category: normalizedCategory,
    unit: normalizeTurkishText(item.unit),
  }
}

function normalizeBlockCategories(block: BlockInput): BlockInput {
  return {
    ...block,
    items: block.items.map(normalizeItemCategory),
  }
}

function normalizeScenarioCategories(scenario: SavedScenario): SavedScenario {
  return {
    ...scenario,
    blocks: scenario.blocks.map(normalizeBlockCategories),
  }
}

function getSubCategoryLabel(category: string, mainCategory: MainCategory | '') {
  if (!category) return ''
  if (!mainCategory || mainCategory === 'Diger') return category

  const prefix = `${getMainCategoryLabel(mainCategory)}${CATEGORY_SEPARATOR}`
  return category.startsWith(prefix) ? category.slice(prefix.length).trim() : category
}

function buildCategoryName(mainCategory: MainCategory | '', subCategoryLabel: string) {
  const trimmedLabel = normalizeTurkishText(subCategoryLabel).trim()
  if (!trimmedLabel) return ''
  if (!mainCategory || mainCategory === 'Diger') return trimmedLabel
  return `${getMainCategoryLabel(mainCategory)}${CATEGORY_SEPARATOR}${trimmedLabel}`
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
  if (mainCategory === 'Hafriyat') return 'border-orange-300 bg-orange-50 text-orange-900'
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
  const [blocks, setBlocks] = useState<BlockInput[]>([normalizeBlockCategories(createBlock(0))])
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
        setSavedScenarios(Array.isArray(data) ? data.map(normalizeScenarioCategories) : [])
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
    if (category.startsWith('Hafriyat') || category === LEGACY_HAFRIYAT_CATEGORY) return 'Hafriyat'
    if (category.startsWith('Kaba')) return 'Kaba'
    if (category.startsWith('Ince') || category.startsWith('İnce')) return 'Ince'
    if (category.startsWith('Elektrik')) return 'Elektrik'
    if (category.startsWith('Mekanik')) return 'Mekanik'
    if (category.startsWith('Cevre Duzenleme') || category.startsWith('Çevre Düzenleme')) return 'Cevre Duzenleme'
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
    const normalizedValue =
      typeof value === 'string' && (field === 'name' || field === 'category' || field === 'unit')
        ? normalizeTurkishText(value)
        : value

    setBlocks(prev =>
      prev.map(block =>
        block.id !== blockId
          ? block
          : {
              ...block,
              items: block.items.map(item => (item.id === itemId ? { ...item, [field]: normalizedValue } : item)),
            }
      )
    )
  }

  const addBlock = () => {
    setBlocks(prev => {
      const nextBlock = normalizeBlockCategories(createBlock(prev.length))
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
      const nextBlock = normalizeBlockCategories(cloneBlock(source, prev.length))
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
    const normalizedCategory = MAIN_CATEGORY_ORDER.includes(category as MainCategory)
      ? getMainCategoryLabel(category as MainCategory)
      : normalizeTurkishText(category)

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
                  category: normalizedCategory,
                  unit: getDefaultUnitForCategory(normalizedCategory),
                  quantity: 0,
                  unitPrice: 0,
                },
              ],
            }
      )
    )
  }

  const addTemplateToBlock = (blockId: string, template: 'hafriyat' | 'kaba' | 'ince' | 'mekanik' | 'cevre') => {
    const templateItems =
      template === 'hafriyat'
        ? createHafriyatTemplateItems()
        : template === 'kaba'
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
    const approved = window.confirm('Bu alt sekmedeki tüm kalemler silinecek. Devam edilsin mi?')
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
    const normalizedScenario = normalizeScenarioCategories(data)
    setSavedScenarios(prev => [normalizedScenario, ...prev].slice(0, 10))
    setActiveScenarioId(normalizedScenario.id)
  }

  const updateScenario = async () => {
    if (!activeScenarioId) {
      throw new Error('Güncellenecek kayıtlı senaryo seçili değil.')
    }

    const response = await fetch('/api/construction-cost-scenarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeScenarioId, inputs, blocks }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Senaryo güncellenemedi.')
    }

    setSavedScenarios(prev =>
      prev.map(scenario => (scenario.id === data.id ? normalizeScenarioCategories(data) : scenario))
    )
  }

  const loadScenario = (scenario: SavedScenario) => {
    const normalizedScenario = normalizeScenarioCategories(scenario)
    setActiveScenarioId(normalizedScenario.id)
    setInputs(normalizedScenario.inputs)
    setBlocks(normalizedScenario.blocks)
    setEditingSubCategoryByBlock({})
    setNewSubCategoryByBlock({})
    setActiveMainCategoryByBlock(
      normalizedScenario.blocks.reduce<Record<string, MainCategory>>((acc, block) => {
        acc[block.id] = getMainCategoriesForBlock(block)[0] || ''
        return acc
      }, {})
    )
    setActiveSubCategoryByBlock(
      normalizedScenario.blocks.reduce<Record<string, string>>((acc, block) => {
        const mainCategory = getMainCategoriesForBlock(block)[0] || ''
        acc[block.id] = getSubCategoriesForBlock(block, mainCategory)[0] || ''
        return acc
      }, {})
    )
    setSubCategoryDraftByBlock(
      normalizedScenario.blocks.reduce<Record<string, string>>((acc, block) => {
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
    return <div className="min-h-screen p-8">Yükleniyor...</div>
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return <div className="min-h-screen p-8">Yetkiniz yok.</div>
  }

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-800 to-orange-900 p-6 text-white shadow-xl md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-orange-200">Maliyet Modülü</div>
            <h1 className="mt-2 text-3xl font-semibold">İnşaat Maliyet Hesaplama</h1>
            <p className="mt-2 max-w-3xl text-sm text-stone-200">
              Her blok için farklı m², kat, daire ve maliyet kalemi tanımlayın. Sistem blokları ayrı hesaplar,
              sonra proje genelini toplar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeScenarioId && (
              <button
                onClick={async () => {
                  try {
                    await updateScenario()
                    alert('Mevcut senaryo güncellendi.')
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'Senaryo güncellenemedi.'
                    alert(message)
                  }
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Mevcut Senaryoyu Güncelle
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

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-xl font-semibold text-stone-900">Proje Varsayımları</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {SCENARIO_FIELDS.map(field => {
                  const value = inputs[field.key]
                  return (
                    <label key={field.key} className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-stone-800">{field.label}</span>
                        <div className="text-xs text-stone-500">{field.description}</div>
                      </div>
                      <input
                        type={field.type === 'text' ? 'text' : 'number'}
                        step={getInputStep(field.type)}
                        inputMode={getInputMode(field.type)}
                        value={
                          field.type === 'text'
                            ? String(value)
                            : getNumericInputValue(Number(value || 0), field.type)
                        }
                        onChange={e =>
                          updateInput(
                            field.key,
                            parseInputValue(e.target.value, field.type)
                          )
                        }
                        className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                      />
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-stone-400">Canlı görünüm</span>
                        <span className="font-medium text-stone-700">{getFieldHelper(value, field.type)}</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-stone-900">Bloklar</h2>
                  <p className="text-sm text-stone-500">Her blok için ayrı veri girilir ve ayrı hesaplanır.</p>
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
                    : block.items.filter(item => getMainCategory(item.category) === activeMainCategory)
                  const visibleSubtotal = visibleItems.reduce(
                    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
                    0
                  )
                  return (
                    <div key={block.id} className="rounded-2xl border border-stone-200 p-4">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-900">{block.name}</h3>
                          <div className="text-sm text-stone-500">Blok {index + 1} ayarları ve maliyet kalemleri</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => duplicateBlock(block.id)}
                            className="rounded-lg px-3 py-2 text-xs text-sky-700 hover:bg-sky-50"
                          >
                            Aynı Maliyetle Ekle
                          </button>
                          <button
                            onClick={() => removeBlock(block.id)}
                            disabled={blocks.length === 1}
                            className="rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300"
                          >
                            Bloğu Sil
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {BLOCK_FIELDS.map(field => {
                          const value = block[field.key]
                          return (
                            <label key={field.key} className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                              <div className="space-y-1">
                                <span className="text-sm font-medium text-stone-800">{field.label}</span>
                                <div className="text-xs text-stone-500">{field.description}</div>
                              </div>
                              <input
                                type={field.type === 'text' ? 'text' : 'number'}
                                step={getInputStep(field.type)}
                                inputMode={getInputMode(field.type)}
                                value={
                                  field.type === 'text'
                                    ? String(value)
                                    : getNumericInputValue(Number(value || 0), field.type)
                                }
                                onChange={e =>
                                  updateBlock(
                                    block.id,
                                    field.key,
                                    parseInputValue(e.target.value, field.type)
                                  )
                                }
                                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                              />
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <span className="text-stone-400">Canlı görünüm</span>
                                <span className="font-medium text-stone-700">{getFieldHelper(value, field.type)}</span>
                              </div>
                            </label>
                          )
                        })}
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-4">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <div className="text-xs text-stone-500">Brüt alan</div>
                          <div className="mt-1 text-lg font-semibold text-stone-900">{formatNumber(currentMetrics?.grossArea || 0, 2)} m²</div>
                        </div>
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <div className="text-xs text-stone-500">Net alan</div>
                          <div className="mt-1 text-lg font-semibold text-stone-900">{formatNumber(currentMetrics?.netSellableArea || 0, 2)} m²</div>
                        </div>
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <div className="text-xs text-stone-500">Doğrudan maliyet</div>
                          <div className="mt-1 text-lg font-semibold text-stone-900">{formatCurrency(currentMetrics?.directCost || 0)}</div>
                        </div>
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <div className="text-xs text-stone-500">Brüt m² maliyeti</div>
                          <div className="mt-1 text-lg font-semibold text-stone-900">{formatCurrency(currentMetrics?.costPerGrossM2 || 0)}</div>
                        </div>
                      </div>

                      <div className="mt-5 space-y-4">
                      <div className="space-y-4 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="max-w-2xl">
                          <h4 className="text-base font-semibold text-stone-900">{block.name} maliyet kalemleri</h4>
                          <p className="text-sm text-stone-500">
                            Bu tablo sadece seçili blok içindir. Metraj ve birim fiyatı girdiğinizde tutar otomatik
                            hesaplanır; blok ve proje özetleri anında güncellenir.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 xl:max-w-[34rem] xl:justify-end">
                          <button
                            onClick={() => addTemplateToBlock(block.id, 'hafriyat')}
                            className="rounded-xl bg-orange-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600"
                          >
                            Hafriyat Şablonu
                          </button>
                          <button
                            onClick={() => addTemplateToBlock(block.id, 'kaba')}
                            className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-700"
                          >
                            Kaba Şablonu
                          </button>
                          <button
                            onClick={() => addTemplateToBlock(block.id, 'ince')}
                            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-500"
                          >
                            İnce İşler Şablonu
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
                            Çevre Düzenleme
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
                                ? category === 'Hafriyat'
                                  ? 'bg-orange-700 text-white shadow-sm'
                                  : category === 'Kaba'
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
                            {getMainCategoryLabel(category)}
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
                              title="Çift tıklayıp düzenleyin, sağ tık ile menü açın"
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
                            Bu ana kategori için alt kategori yok.
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
                              Yeniden Adlandır
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
                              Çoğalt
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
                              Alt Kategori Adı
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
                              placeholder="Alt kategori adını girin"
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
                                Alt Sekme Adını Güncelle
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
                              placeholder="Örnek: Kaba Kalıp, İç Kapı, Aydınlatma"
                              className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
                            />
                            <button
                              onClick={() => createSubCategory(block.id, activeMainCategory, newSubCategoryByBlock[block.id] || '')}
                              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
                            >
                              Yeni Alt Sekme Aç
                            </button>
                          </div>
                          <div className="mt-2 text-xs text-stone-500">
                            Son kalem silinirse o alt sekme otomatik kaybolur.
                          </div>
                        </div>
                      </div>
                      </div>

                      <div className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3">
                          <div>
                            <div className="text-sm font-semibold text-stone-900">Seçili kalem listesi</div>
                            <div className="text-xs text-stone-500">
                              {visibleItems.length} kalem görüntüleniyor. Önce iş kalemini, sonra kategori ve birim bilgisini,
                              en son metraj ile birim fiyatı girin.
                            </div>
                          </div>
                          <div className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white">
                            Ara toplam: {formatCurrency(visibleSubtotal)}
                          </div>
                        </div>

                        <div className="space-y-3 p-4">
                          {visibleItems.map(item => {
                            const total = (item.quantity || 0) * (item.unitPrice || 0)
                            return (
                              <div key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
                                      İş Kalemi
                                    </div>
                                    <input
                                      value={item.name}
                                      onChange={e => updateBlockItem(block.id, item.id, 'name', e.target.value)}
                                      className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                                    />
                                  </div>
                                  <button
                                    onClick={() => removeItemFromBlock(block.id, item.id)}
                                    className="shrink-0 rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                                  >
                                    Sil
                                  </button>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                  <label className="space-y-1 md:col-span-3">
                                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">Kategori</span>
                                    <input
                                      value={item.category}
                                      onChange={e => updateBlockItem(block.id, item.id, 'category', e.target.value)}
                                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                                    />
                                  </label>

                                  <label className="space-y-1">
                                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">Birim</span>
                                    <input
                                      value={item.unit}
                                      onChange={e => updateBlockItem(block.id, item.id, 'unit', e.target.value)}
                                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                                    />
                                  </label>

                                  <label className="space-y-1">
                                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">Metraj</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      inputMode="decimal"
                                      value={item.quantity}
                                      onChange={e => updateBlockItem(block.id, item.id, 'quantity', parseLocalizedNumber(e.target.value))}
                                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-right text-sm text-stone-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                                    />
                                    <div className="text-xs text-stone-500">{getFieldHelper(item.quantity, 'number')}</div>
                                  </label>

                                  <label className="space-y-1">
                                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">Birim Fiyat</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      inputMode="decimal"
                                      value={item.unitPrice}
                                      onChange={e => updateBlockItem(block.id, item.id, 'unitPrice', parseLocalizedNumber(e.target.value))}
                                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-right text-sm text-stone-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                                      />
                                      <div className="text-xs text-stone-500">{formatCurrency(item.unitPrice || 0)} / {item.unit}</div>
                                    </label>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">Canlı Hesap</div>
                                    <div className="mt-1 text-sm font-medium text-stone-700">
                                      {formatNumber(item.quantity || 0, 2)} {item.unit || 'birim'} x {formatCurrency(item.unitPrice || 0)}
                                    </div>
                                  </div>
                                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">Toplam Tutar</div>
                                    <div className="mt-1 text-lg font-semibold text-stone-900">{formatCurrency(total)}</div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}

                          {visibleItems.length > 0 && (
                            <div className={`rounded-2xl border px-4 py-3 ${getSubtotalRowClass(activeMainCategory)}`}>
                              <div className="text-sm font-semibold">{activeSubCategory || 'Ara Toplam'}</div>
                              <div className="mt-1 text-lg font-bold">{formatCurrency(visibleSubtotal)}</div>
                            </div>
                          )}

                          {visibleItems.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
                              Seçili kategori için kalem bulunmuyor.
                            </div>
                          )}
                        </div>
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
              <h2 className="text-xl font-semibold text-stone-900">Özet Sonuçlar</h2>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0 rounded-3xl bg-gradient-to-br from-stone-900 to-stone-800 p-4 text-white shadow-sm">
                  <div className="text-[11px] font-medium tracking-[0.16em] text-stone-300">Toplam Maliyet</div>
                  <div title={formatCurrency(metrics.subtotalCost)} className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
                    {formatCompactCurrency(metrics.subtotalCost)}
                  </div>
                  <div className="mt-2 text-xs text-stone-300">{formatCurrency(metrics.subtotalCost)}</div>
                </div>
                <div className="min-w-0 rounded-3xl bg-gradient-to-br from-orange-100 to-amber-50 p-4 text-orange-950 ring-1 ring-orange-200 shadow-sm">
                  <div className="text-[11px] font-medium tracking-[0.16em] text-orange-700">Hedef Satış Cirosu</div>
                  <div title={formatCurrency(metrics.targetSaleWithVat)} className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
                    {formatCompactCurrency(metrics.targetSaleWithVat)}
                  </div>
                  <div className="mt-2 text-xs text-orange-700">{formatCurrency(metrics.targetSaleWithVat)}</div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:col-span-2 lg:grid-cols-3">
                  <div className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-[11px] font-medium tracking-[0.14em] text-stone-500">Brüt m² maliyeti</div>
                    <div title={formatCurrency(metrics.costPerGrossM2)} className="mt-2 text-xl font-semibold leading-tight text-stone-900">
                      {formatCompactCurrency(metrics.costPerGrossM2)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">{formatCurrency(metrics.costPerGrossM2)}</div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-[11px] font-medium tracking-[0.14em] text-stone-500">Net m² maliyeti</div>
                    <div title={formatCurrency(metrics.costPerNetM2)} className="mt-2 text-xl font-semibold leading-tight text-stone-900">
                      {formatCompactCurrency(metrics.costPerNetM2)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">{formatCurrency(metrics.costPerNetM2)}</div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-[11px] font-medium tracking-[0.14em] text-stone-500">Daire başı ciro</div>
                    <div title={formatCurrency(metrics.salePerUnit)} className="mt-2 text-xl font-semibold leading-tight text-stone-900">
                      {formatCompactCurrency(metrics.salePerUnit)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">{formatCurrency(metrics.salePerUnit)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:col-span-2 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="text-[11px] font-medium tracking-[0.14em] text-stone-500">Arsa oturum oranı</div>
                    <div title={`%${formatNumber(metrics.lotCoverage * 100, 2)}`} className="mt-2 text-xl font-semibold text-stone-900">
                      {formatCompactPercent(metrics.lotCoverage * 100)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">Arsa verimliliği</div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[11px] font-medium tracking-[0.14em] text-stone-500">Ortak alan oranı</div>
                          <div title={`%${formatNumber(metrics.actualCommonAreaRatio * 100, 2)}`} className="mt-2 text-xl font-semibold text-stone-900">
                            {formatCompactPercent(metrics.actualCommonAreaRatio * 100)}
                          </div>
                        </div>
                      <div className="rounded-xl bg-stone-100 px-3 py-2 text-right">
                        <div className="text-[10px] font-medium tracking-[0.14em] text-stone-500">Hedef</div>
                        <div className="text-sm font-semibold text-stone-700">
                          %{formatNumber(inputs.commonAreaRatio * 100, 2)}
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

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-xl font-semibold text-stone-900">Alan ve Maliyet Dağılımı</h2>
              <div className="mt-3 grid grid-cols-1 gap-2 text-[13px] min-[560px]:grid-cols-2 min-[560px]:gap-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2"><span className="text-stone-500">Toplam blok adedi</span><span className="font-medium text-stone-900">{formatNumber(blocks.length, 0)}</span></div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2"><span className="text-stone-500">Toplam taban oturumu</span><span className="font-medium text-stone-900">{formatNumber(metrics.totalBaseFootprint, 2)} m²</span></div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2"><span className="text-stone-500">Brüt inşaat alanı</span><span className="font-medium text-stone-900">{formatNumber(metrics.grossArea, 2)} m²</span></div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2"><span className="text-stone-500">Toplam bağımsız bölüm</span><span className="font-medium text-stone-900">{formatNumber(metrics.totalUnitCount, 0)}</span></div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2"><span className="text-stone-500">Net satılabilir alan</span><span className="font-medium text-stone-900">{formatNumber(metrics.netSellableArea, 2)} m²</span></div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2"><span className="text-stone-500">Ortak alan</span><span className="font-medium text-stone-900">{formatNumber(metrics.commonArea, 2)} m²</span></div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2"><span className="text-stone-500">Doğrudan maliyet</span><span className="font-medium text-stone-900">{formatCurrency(metrics.directCost)}</span></div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2"><span className="text-stone-500">Genel gider</span><span className="font-medium text-stone-900">{formatCurrency(metrics.indirectCost)}</span></div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2"><span className="text-stone-500">Beklenmeyen gider</span><span className="font-medium text-stone-900">{formatCurrency(metrics.contingencyCost)}</span></div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2"><span className="text-stone-500">Ruhsat ve proje</span><span className="font-medium text-stone-900">{formatCurrency(inputs.permitAndProjectCost)}</span></div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2"><span className="text-stone-500">Finansman</span><span className="font-medium text-stone-900">{formatCurrency(inputs.financingCost)}</span></div>
                <div className="min-[560px]:col-span-2 mt-1 border-t border-stone-200 pt-3">
                  <div className="grid grid-cols-1 gap-2 min-[560px]:grid-cols-2">
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-900 px-3 py-2 text-white"><span className="text-stone-200">Kar haric hedef ciro</span><span className="font-semibold">{formatCurrency(metrics.targetSaleWithoutVat)}</span></div>
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-orange-50 px-3 py-2 ring-1 ring-orange-200"><span className="text-stone-600">KDV</span><span className="font-semibold text-stone-900">{formatCurrency(metrics.vatAmount)}</span></div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-xl font-semibold text-stone-900">Blok Özetleri</h2>
              <div className="mt-4 space-y-3">
                {blockMetrics.map(block => (
                  <div key={block.id} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-stone-900">{block.name}</div>
                      <div className="text-sm font-medium text-stone-700">{formatCurrency(block.directCost)}</div>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-stone-600 md:grid-cols-2">
                      <div>Brüt alan: {formatNumber(block.grossArea, 2)} m²</div>
                      <div>Net alan: {formatNumber(block.netSellableArea, 2)} m²</div>
                      <div>Bağımsız bölüm: {formatNumber(block.unitCount, 0)}</div>
                      <div>Brüt m² maliyeti: {formatCurrency(block.costPerGrossM2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-xl font-semibold text-stone-900">Kategori Bazlı Maliyet</h2>
              <div className="mt-3 grid grid-cols-1 gap-2 min-[560px]:grid-cols-2">
                {Object.entries(metrics.categoryTotals).map(([category, total]) => {
                  const ratio = metrics.directCost > 0 ? total / metrics.directCost : 0
                  return (
                    <div key={category} className="rounded-2xl bg-stone-50/80 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                        <span className="text-stone-700">{category}</span>
                        <span className="font-medium text-stone-900">{formatCurrency(total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-stone-200">
                        <div className="h-1.5 rounded-full bg-orange-500" style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-stone-900">Kayıtlı Senaryolar</h2>
                <div className="text-sm text-stone-500">Supabase üzerinde saklanır</div>
              </div>
              <div className="mt-4 space-y-3">
                {scenariosLoading && (
                  <div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">
                    Senaryolar yükleniyor...
                  </div>
                )}
                {savedScenarios.length === 0 && (
                  <div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">
                    Henüz kayıtlı senaryo yok.
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
                              Yüklü
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
