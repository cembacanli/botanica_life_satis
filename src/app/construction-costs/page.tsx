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
  { key: 'commonAreaRatio', label: 'Ortak alan oran hedefi (%)', type: 'percent', description: 'Ortak alan m² hedef oranı.' },
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

// ==================== SVG Charts and Helpers ====================

type DonutChartProps = {
  data: { label: string; value: number; color: string }[]
}

function DonutChart({ data }: DonutChartProps) {
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const segments = useMemo(() => {
    let accumulatedPercent = 0
    const r = 36
    const circumference = 2 * Math.PI * r // ~226.195
    return data.map((item, index) => {
      const percent = total > 0 ? item.value / total : 0
      const segmentLength = percent * circumference
      const strokeDashoffset = -accumulatedPercent * circumference
      accumulatedPercent += percent

      return {
        ...item,
        percent,
        segmentLength,
        strokeDashoffset,
        r,
        circumference,
      }
    })
  }, [data, total])

  if (total === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-stone-400">
        Gösterilecek veri yok
      </div>
    )
  }

  const activeSegment = hoveredIndex !== null ? segments[hoveredIndex] : null

  return (
    <div className="relative flex flex-col items-center justify-center sm:flex-row gap-6">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <circle cx="50" cy="50" r="36" fill="transparent" stroke="#f5f5f4" strokeWidth="8" />
          {segments.map((seg, idx) => (
            <circle
              key={idx}
              cx="50"
              cy="50"
              r={seg.r}
              fill="transparent"
              stroke={seg.color}
              strokeWidth={hoveredIndex === idx ? 11 : 8}
              strokeDasharray={`${seg.segmentLength} ${seg.circumference}`}
              strokeDashoffset={seg.strokeDashoffset}
              transform="rotate(-90 50 50)"
              className="transition-all duration-300 cursor-pointer origin-center"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
          {activeSegment ? (
            <>
              <span className="text-[10px] font-bold text-stone-450 uppercase tracking-wider truncate max-w-full">
                {activeSegment.label}
              </span>
              <span className="text-sm font-extrabold text-stone-900 mt-0.5">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(activeSegment.value)}
              </span>
              <span className="text-[11px] font-bold text-orange-600 mt-0.5">
                %{(activeSegment.percent * 100).toFixed(1)}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold text-stone-450 uppercase tracking-wider">
                Toplam
              </span>
              <span className="text-sm font-extrabold text-stone-850 mt-0.5">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(total)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 justify-center">
        {segments.map((seg, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between gap-3 p-1.5 rounded-xl transition cursor-pointer ${hoveredIndex === idx ? 'bg-stone-50 ring-1 ring-stone-200' : 'hover:bg-stone-50/50'}`}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }}></span>
              <span className="text-xs font-semibold text-stone-700 truncate">{seg.label}</span>
            </div>
            <div className="flex items-center gap-2 text-right">
              <span className="text-xs font-bold text-stone-900">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(seg.value)}
              </span>
              <span className="text-[10px] font-medium text-stone-400 w-8">
                %{(seg.percent * 100).toFixed(0)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type BarChartProps = {
  data: { label: string; value: number; color: string }[]
}

function BarChart({ data }: BarChartProps) {
  const maxValue = useMemo(() => Math.max(...data.map(item => item.value), 1), [data])
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex h-48 items-end gap-3 border-b border-stone-200 pb-2 pt-6 px-2">
        {/* Y Axis Grid Lines */}
        <div className="absolute inset-x-0 top-6 bottom-2 flex flex-col justify-between pointer-events-none">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <div key={i} className="w-full border-t border-dashed border-stone-200 relative">
              <span className="absolute -top-2.5 right-0 bg-white/80 px-1 text-[9px] font-medium text-stone-400">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', notation: 'compact', maximumFractionDigits: 1 }).format(maxValue * ratio)}
              </span>
            </div>
          ))}
        </div>

        {/* Bars */}
        {data.map((item, idx) => {
          const heightPercent = (item.value / maxValue) * 100
          return (
            <div
              key={idx}
              className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer z-10"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip */}
              {hoveredIdx === idx && (
                <div className="absolute -top-12 z-20 rounded-lg bg-stone-900 px-2 py-1 text-center text-[11px] font-bold text-white shadow-lg pointer-events-none whitespace-nowrap">
                  <div className="font-bold">{item.label}</div>
                  <div>
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(item.value)}
                  </div>
                </div>
              )}

              {/* Bar Rect */}
              <div
                className="w-8 sm:w-12 rounded-t-lg transition-all duration-300 group-hover:brightness-110 shadow-sm"
                style={{
                  height: `${heightPercent}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* X Axis Labels */}
      <div className="flex justify-around gap-2 text-center">
        {data.map((item, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1 min-w-[60px] flex-1">
            <span className="text-xs font-semibold text-stone-700 truncate max-w-[80px]">{item.label}</span>
            <span className="text-[10px] text-stone-400">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', notation: 'compact', maximumFractionDigits: 1 }).format(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const CATEGORY_COLORS: Record<MainCategory, string> = {
  Hafriyat: '#ea580c', // orange-600
  Kaba: '#292524',     // stone-800
  Ince: '#f59e0b',     // amber-500
  Mekanik: '#0891b2',  // cyan-600
  Elektrik: '#4f46e5',  // indigo-600
  'Cevre Duzenleme': '#059669', // emerald-600
  Diger: '#a8a29e',    // stone-400
}

const CATEGORY_ACCENT_COLORS: Record<MainCategory, { activeBg: string; text: string }> = {
  Hafriyat: { activeBg: 'bg-orange-600', text: 'text-white' },
  Kaba: { activeBg: 'bg-stone-850', text: 'text-white' },
  Ince: { activeBg: 'bg-amber-500', text: 'text-white' },
  Mekanik: { activeBg: 'bg-cyan-600', text: 'text-white' },
  Elektrik: { activeBg: 'bg-indigo-650', text: 'text-white' },
  'Cevre Duzenleme': { activeBg: 'bg-emerald-600', text: 'text-white' },
  Diger: { activeBg: 'bg-stone-500', text: 'text-white' },
}

// ==================== Main Page Component ====================

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

  // Wizard tab & selected block states
  const [activeTab, setActiveTab] = useState<'varsayimlar' | 'bloklar' | 'analiz'>('varsayimlar')
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

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

  // Keep selectedBlockId valid when blocks change
  useEffect(() => {
    if (blocks.length > 0 && (!selectedBlockId || !blocks.some(b => b.id === selectedBlockId))) {
      setSelectedBlockId(blocks[0].id)
    }
  }, [blocks, selectedBlockId])

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
      setSelectedBlockId(nextBlock.id)
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
      setSelectedBlockId(nextBlock.id)
      return [...prev, nextBlock]
    })
  }

  const removeBlock = (blockId: string) => {
    setBlocks(prev => {
      const remaining = prev.filter(block => block.id !== blockId)
      if (remaining.length === 0) return prev
      if (selectedBlockId === blockId) {
        setSelectedBlockId(remaining[0].id)
      }
      return remaining
    })
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

    if (normalizedScenario.blocks.length > 0) {
      setSelectedBlockId(normalizedScenario.blocks[0].id)
    }

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

  // Pre-calculate visual chart data
  const donutData = useMemo(() => {
    const mainTotals: Record<MainCategory, number> = {
      Hafriyat: 0,
      Kaba: 0,
      Ince: 0,
      Mekanik: 0,
      Elektrik: 0,
      'Cevre Duzenleme': 0,
      Diger: 0,
    }

    Object.entries(metrics.categoryTotals).forEach(([category, total]) => {
      const main = getMainCategory(category)
      mainTotals[main] = (mainTotals[main] || 0) + total
    })

    return Object.entries(mainTotals)
      .map(([cat, val]) => ({
        label: getMainCategoryLabel(cat as MainCategory),
        value: val,
        color: CATEGORY_COLORS[cat as MainCategory] || '#a8a29e',
      }))
      .filter(item => item.value > 0)
  }, [metrics.categoryTotals])

  const barData = useMemo(() => {
    const barColors = ['#ea580c', '#292524', '#f59e0b', '#0891b2', '#4f46e5', '#059669']
    return blockMetrics.map((block, idx) => ({
      label: block.name,
      value: block.directCost,
      color: barColors[idx % barColors.length],
    }))
  }, [blockMetrics])

  if (!mounted || loading) {
    return <div className="min-h-screen p-8 flex items-center justify-center font-medium text-stone-500 bg-stone-100">Yükleniyor...</div>
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return <div className="min-h-screen p-8 flex items-center justify-center font-medium text-red-500 bg-stone-100">Yetkiniz yok.</div>
  }

  // Extract selected block items
  const selectedBlock = blocks.find(b => b.id === selectedBlockId) || blocks[0]
  const currentMetrics = blockMetrics.find(m => m.id === selectedBlock.id)

  const mainCategories = getMainCategoriesForBlock(selectedBlock)
  const activeMainCategory = getActiveMainCategory(selectedBlock)
  const subCategories = getSubCategoriesForBlock(selectedBlock, activeMainCategory)
  const activeSubCategory = getActiveSubCategory(selectedBlock, activeMainCategory)
  const visibleItems = activeSubCategory
    ? selectedBlock.items.filter(item => item.category === activeSubCategory)
    : selectedBlock.items.filter(item => getMainCategory(item.category) === activeMainCategory)
  const visibleSubtotal = visibleItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0
  )

  return (
    <div className="min-h-screen bg-stone-100/70 antialiased text-stone-900 font-sans">
      
      {/* ==================== SCREEN INTERFACE ==================== */}
      <div className="screen-only p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          
          {/* Main Top Banner */}
          <div className="flex flex-col gap-6 rounded-[2.5rem] bg-gradient-to-r from-stone-955 via-stone-800 to-orange-950 p-8 text-white shadow-2xl relative overflow-hidden md:flex-row md:items-center md:justify-between border border-stone-800">
            {/* Background absolute flare */}
            <div className="absolute right-0 top-0 w-80 h-80 bg-orange-600/10 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-orange-400 border border-orange-500/20">
                PROJE YÖNETİMİ
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">İnşaat Maliyet Hesaplama</h1>
              <p className="max-w-2xl text-stone-300 text-sm md:text-base leading-relaxed font-medium">
                Her blok için farklı m², kat, daire ve detaylı metraj kalemleri tanımlayın. Akıllı formüller 
                ve dinamik özetlerle maliyetinizi canlı izleyin.
              </p>
            </div>
            
            <div className="relative z-10 flex flex-wrap gap-3 shrink-0">
              {activeScenarioId && (
                <button
                  onClick={async () => {
                    try {
                      await updateScenario()
                      alert('Mevcut senaryo başarıyla güncellendi.')
                    } catch (error) {
                      const message = error instanceof Error ? error.message : 'Senaryo güncellenemedi.'
                      alert(message)
                    }
                  }}
                  className="rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20"
                >
                  Senaryoyu Güncelle
                </button>
              )}
              <button
                onClick={async () => {
                  try {
                    await saveScenario()
                    alert('Yeni senaryo başarıyla kaydedildi.')
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'Senaryo kaydedilemedi.'
                    alert(message)
                  }
                }}
                className="rounded-2xl bg-orange-600 hover:bg-orange-500 active:scale-95 transition-all px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-950/20"
              >
                Yeni Senaryo Kaydet
              </button>
              <button
                onClick={() => router.push('/')}
                className="rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all px-5 py-3 text-sm font-semibold text-white backdrop-blur border border-white/10"
              >
                Geri Dön
              </button>
            </div>
          </div>

          {/* Stepper Wizard Indicator */}
          <div className="rounded-3xl bg-white p-5 shadow-sm border border-stone-200/60">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-wrap md:flex-nowrap items-center w-full gap-2 md:gap-4">
                
                {/* Step 1 */}
                <button
                  onClick={() => setActiveTab('varsayimlar')}
                  className={`flex items-center gap-3 text-left p-2 rounded-2xl transition w-full md:w-auto ${
                    activeTab === 'varsayimlar' ? 'bg-stone-50' : 'hover:bg-stone-50/50'
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold transition-all duration-300 ${
                    activeTab === 'varsayimlar'
                      ? 'bg-stone-900 text-white shadow-md'
                      : 'bg-stone-100 text-stone-600'
                  }`}>
                    01
                  </span>
                  <div>
                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">Aşama 1</div>
                    <div className="text-sm font-bold text-stone-850">Genel Parametreler</div>
                  </div>
                </button>

                {/* Arrow / Line separator */}
                <div className="hidden md:block h-0.5 flex-1 bg-stone-250 border-t border-dashed border-stone-200 mx-2" />

                {/* Step 2 */}
                <button
                  onClick={() => setActiveTab('bloklar')}
                  className={`flex items-center gap-3 text-left p-2 rounded-2xl transition w-full md:w-auto ${
                    activeTab === 'bloklar' ? 'bg-stone-50' : 'hover:bg-stone-50/50'
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold transition-all duration-300 ${
                    activeTab === 'bloklar'
                      ? 'bg-stone-900 text-white shadow-md'
                      : 'bg-stone-100 text-stone-600'
                  }`}>
                    02
                  </span>
                  <div>
                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">Aşama 2</div>
                    <div className="text-sm font-bold text-stone-850">Blok Yapıları & Metrajlar</div>
                  </div>
                </button>

                {/* Arrow / Line separator */}
                <div className="hidden md:block h-0.5 flex-1 bg-stone-250 border-t border-dashed border-stone-200 mx-2" />

                {/* Step 3 */}
                <button
                  onClick={() => setActiveTab('analiz')}
                  className={`flex items-center gap-3 text-left p-2 rounded-2xl transition w-full md:w-auto ${
                    activeTab === 'analiz' ? 'bg-stone-50' : 'hover:bg-stone-50/50'
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold transition-all duration-300 ${
                    activeTab === 'analiz'
                      ? 'bg-stone-900 text-white shadow-md'
                      : 'bg-stone-100 text-stone-600'
                  }`}>
                    03
                  </span>
                  <div>
                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">Aşama 3</div>
                    <div className="text-sm font-bold text-stone-850">Finansal Özet & Grafik</div>
                  </div>
                </button>

              </div>
            </div>
          </div>

          {/* Core App Grid: Sidebar (Left) + Wizard Sheet (Right) */}
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            
            {/* LEFT SIDEBAR: Saved Scenarios (Glassmorphism design) */}
            <div className="w-full lg:w-80 shrink-0 space-y-6 lg:sticky lg:top-8 bg-white/80 backdrop-blur-md rounded-3xl p-6 ring-1 ring-stone-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white">
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-stone-900 tracking-tight">Kayıtlı Senaryolar</h3>
                  <p className="text-xs font-medium text-stone-400">Bulut üzerinde kayıtlı 10 senaryo</p>
                </div>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {scenariosLoading && (
                  <div className="p-4 text-center text-xs font-semibold text-stone-400 bg-stone-50 rounded-2xl">
                    Senaryolar yükleniyor...
                  </div>
                )}
                {!scenariosLoading && savedScenarios.length === 0 && (
                  <div className="p-4 text-center text-xs text-stone-400 bg-stone-50 border border-dashed border-stone-250 rounded-2xl">
                    Henüz kayıtlı senaryo bulunamadı.
                  </div>
                )}
                {savedScenarios.map(scenario => {
                  const scenarioDirectCost = scenario.blocks
                    .map(createMetricsForBlock)
                    .reduce((sum, block) => sum + block.directCost, 0)
                  const isActive = activeScenarioId === scenario.id

                  return (
                    <div
                      key={scenario.id}
                      className={`group flex flex-col gap-2.5 rounded-2xl border p-4 transition-all duration-300 ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500/20'
                          : 'border-stone-200 bg-white hover:border-orange-350 hover:bg-orange-50/20 hover:shadow-sm'
                      }`}
                    >
                      <button
                        onClick={() => loadScenario(scenario)}
                        className="text-left w-full focus:outline-none"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-extrabold text-xs text-stone-850 uppercase tracking-wide group-hover:text-orange-950 transition-colors">
                            {scenario.inputs.scenarioName}
                          </div>
                          {isActive && (
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse mt-1 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-stone-400 font-bold mt-1">
                          {new Date(scenario.savedAt).toLocaleDateString('tr-TR')} • {scenario.blocks.length} Blok
                        </div>
                      </button>
                      
                      <div className="flex items-center justify-between border-t border-stone-100/60 pt-2 mt-1">
                        <span className="text-[11px] font-bold text-stone-700">
                          {formatCompactCurrency(scenarioDirectCost)}
                        </span>
                        <button
                          onClick={() => deleteScenario(scenario.id)}
                          className="text-[10px] font-extrabold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg px-2.5 py-1.5 transition-all"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* RIGHT WORKSPACE: Step panels */}
            <div className="flex-1 min-w-0 w-full space-y-6">
              
              {/* STEP 1: General Parameters */}
              {activeTab === 'varsayimlar' && (
                <div className="space-y-6">
                  <div className="rounded-3xl bg-white p-6 shadow-sm border border-stone-200/60">
                    <div className="border-b border-stone-100 pb-4 mb-6">
                      <h2 className="text-xl font-bold text-stone-900 tracking-tight">Genel Proje Parametreleri</h2>
                      <p className="text-sm text-stone-500 mt-1">Projenin arsa, finansal gider oranları, kâr marjı ve KDV oranlarını yönetin.</p>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                      {SCENARIO_FIELDS.map(field => {
                        const value = inputs[field.key]
                        return (
                          <div key={field.key} className="flex flex-col rounded-2xl border border-stone-200 bg-stone-50/50 p-4 transition-all hover:bg-stone-50 focus-within:border-stone-450 focus-within:ring-2 focus-within:ring-stone-100">
                            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">{field.label}</span>
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
                              className="mt-2 w-full border-none bg-transparent p-0 text-sm font-bold text-stone-900 focus:outline-none focus:ring-0"
                            />
                            <div className="mt-2.5 flex items-center justify-between border-t border-stone-200/50 pt-2 text-[10px] font-semibold text-stone-400">
                              <span className="truncate max-w-[70%]">{field.description}</span>
                              <span className="text-stone-700 bg-white px-1.5 py-0.5 rounded-md border border-stone-200/80">{getFieldHelper(value, field.type)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex justify-end border-t border-stone-100 pt-6 mt-8">
                      <button
                        onClick={() => setActiveTab('bloklar')}
                        className="inline-flex items-center gap-2 rounded-2xl bg-stone-900 hover:bg-stone-850 hover:shadow-md px-6 py-3.5 text-sm font-bold text-white transition-all duration-200"
                      >
                        <span>Sonraki Aşama: Blok Metrajları</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Blocks & Metraj Kalemleri */}
              {activeTab === 'bloklar' && (
                <div className="space-y-6">
                  
                  {/* Block Selection Tabs */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm border border-stone-200/60">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-3 gap-2">
                        <div>
                          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Projedeki Bloklar</h2>
                          <p className="text-xs font-semibold text-stone-400">Aşağıdaki blok sekmelerini tıklayarak metraj düzenleyin.</p>
                        </div>
                        <button
                          onClick={addBlock}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all"
                        >
                          + Blok Ekle
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {blocks.map((block, idx) => {
                          const isBlockSelected = selectedBlockId === block.id
                          const blockDirectCost = blockMetrics.find(m => m.id === block.id)?.directCost || 0
                          
                          return (
                            <div key={block.id} className="flex items-center">
                              <button
                                onClick={() => setSelectedBlockId(block.id)}
                                className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold transition-all ${
                                  isBlockSelected
                                    ? 'bg-stone-900 text-white shadow-md'
                                    : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100/80'
                                }`}
                              >
                                <span>{block.name}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                  isBlockSelected ? 'bg-orange-600 text-white' : 'bg-stone-200 text-stone-700'
                                }`}>
                                  {formatCompactCurrency(blockDirectCost)}
                                </span>
                              </button>
                              
                              {/* Extra control buttons visible next to selected block tab */}
                              {isBlockSelected && (
                                <div className="flex items-center gap-1.5 ml-1.5 border border-stone-200/60 bg-stone-50/50 rounded-2xl p-1 shrink-0">
                                  <button
                                    onClick={() => duplicateBlock(block.id)}
                                    title="Bloğu maliyet kalemiyle kopyala"
                                    className="p-1.5 rounded-xl text-[10px] font-bold text-stone-700 hover:bg-stone-200/80 active:scale-95 transition-all"
                                  >
                                    Çoğalt
                                  </button>
                                  {blocks.length > 1 && (
                                    <button
                                      onClick={() => removeBlock(block.id)}
                                      title="Bloğu sil"
                                      className="p-1.5 rounded-xl text-[10px] font-bold text-red-600 hover:bg-red-50 active:scale-95 transition-all"
                                    >
                                      Sil
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Selected Block Parameters & Live metrics */}
                  <div className="rounded-3xl bg-white p-6 shadow-sm border border-stone-200/60 space-y-6">
                    <div className="border-b border-stone-100 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <h3 className="text-base font-extrabold text-stone-900 tracking-tight">{selectedBlock.name} Yapı Ayarları</h3>
                        <p className="text-xs font-medium text-stone-400 mt-0.5">Bu bloğun kat, daire ve alan parametreleri.</p>
                      </div>
                      
                      {/* Metric widgets inside card */}
                      <div className="grid grid-cols-2 md:flex md:items-center gap-3">
                        <div className="rounded-2xl bg-stone-50 border border-stone-200/50 p-3 min-w-[120px] text-center md:text-left">
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">M2 Brüt Alan</div>
                          <div className="text-sm font-extrabold text-stone-850 mt-0.5">{formatNumber(currentMetrics?.grossArea || 0, 1)} m²</div>
                        </div>
                        <div className="rounded-2xl bg-stone-50 border border-stone-200/50 p-3 min-w-[120px] text-center md:text-left">
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">M2 Net Alan</div>
                          <div className="text-sm font-extrabold text-stone-850 mt-0.5">{formatNumber(currentMetrics?.netSellableArea || 0, 1)} m²</div>
                        </div>
                        <div className="rounded-2xl bg-stone-50 border border-stone-200/50 p-3 min-w-[120px] text-center md:text-left">
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Direkt Maliyet</div>
                          <div className="text-sm font-extrabold text-orange-600 mt-0.5">{formatCompactCurrency(currentMetrics?.directCost || 0)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                      {BLOCK_FIELDS.map(field => {
                        const value = selectedBlock[field.key]
                        return (
                          <div key={field.key} className="flex flex-col rounded-2xl border border-stone-200 bg-stone-50/50 p-4 transition-all hover:bg-stone-50 focus-within:border-stone-450 focus-within:ring-2 focus-within:ring-stone-100">
                            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">{field.label}</span>
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
                                  selectedBlock.id,
                                  field.key,
                                  parseInputValue(e.target.value, field.type)
                                )
                              }
                              className="mt-2 w-full border-none bg-transparent p-0 text-sm font-bold text-stone-900 focus:outline-none focus:ring-0"
                            />
                            <div className="mt-2.5 flex items-center justify-between border-t border-stone-200/50 pt-2 text-[10px] font-semibold text-stone-400">
                              <span className="truncate max-w-[70%]">{field.description}</span>
                              <span className="text-stone-700 bg-white px-1.5 py-0.5 rounded-md border border-stone-200/80">{getFieldHelper(value, field.type)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Metraj ve Maliyet Kalemleri spreadsheet Editor */}
                  <div className="rounded-3xl bg-white shadow-sm border border-stone-200/60 overflow-hidden">
                    <div className="p-6 border-b border-stone-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                      <div>
                        <h3 className="text-base font-extrabold text-stone-900 tracking-tight">Metraj Maliyet Tablosu</h3>
                        <p className="text-xs font-medium text-stone-400 mt-0.5">Seçili bloğun kaba, ince ve altyapı kalemlerini birim ve birim fiyatlarla girin.</p>
                      </div>

                      {/* Fast templates loaders */}
                      <div className="flex flex-wrap gap-1.5 xl:justify-end max-w-full">
                        <button
                          onClick={() => addTemplateToBlock(selectedBlock.id, 'hafriyat')}
                          className="rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[11px] font-bold text-stone-700 px-3 py-2 transition-all"
                        >
                          Hafriyat Şablonu
                        </button>
                        <button
                          onClick={() => addTemplateToBlock(selectedBlock.id, 'kaba')}
                          className="rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[11px] font-bold text-stone-700 px-3 py-2 transition-all"
                        >
                          Kaba Şablonu
                        </button>
                        <button
                          onClick={() => addTemplateToBlock(selectedBlock.id, 'ince')}
                          className="rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[11px] font-bold text-stone-700 px-3 py-2 transition-all"
                        >
                          İnce Şablonu
                        </button>
                        <button
                          onClick={() => addTemplateToBlock(selectedBlock.id, 'mekanik')}
                          className="rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[11px] font-bold text-stone-700 px-3 py-2 transition-all"
                        >
                          Mekanik & Elektrik
                        </button>
                        <button
                          onClick={() => addTemplateToBlock(selectedBlock.id, 'cevre')}
                          className="rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[11px] font-bold text-stone-700 px-3 py-2 transition-all"
                        >
                          Çevre Şablonu
                        </button>
                        <button
                          onClick={() => addItemToBlock(selectedBlock.id, activeSubCategory || activeMainCategory || 'Diger')}
                          className="rounded-xl bg-orange-600 hover:bg-orange-500 text-[11px] font-bold text-white px-3.5 py-2 shadow-sm transition-all"
                        >
                          + Kalem Ekle
                        </button>
                      </div>
                    </div>

                    {/* Double-Decker Category Panels */}
                    <div className="bg-stone-50/50 border-b border-stone-100 p-4 space-y-4">
                      
                      {/* Main Category pill selector */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400">Ana Kategori</div>
                        <div className="flex flex-wrap gap-1.5">
                          {mainCategories.map(category => {
                            const isMainSelected = activeMainCategory === category
                            const accent = CATEGORY_ACCENT_COLORS[category as MainCategory] || { activeBg: 'bg-stone-850', text: 'text-white' }
                            
                            return (
                              <button
                                key={category}
                                onClick={() => {
                                  const nextSub = getSubCategoriesForBlock(selectedBlock, category)[0] || ''
                                  setActiveMainCategoryByBlock(prev => ({
                                    ...prev,
                                    [selectedBlock.id]: category,
                                  }))
                                  setActiveSubCategoryByBlock(prev => ({
                                    ...prev,
                                    [selectedBlock.id]: nextSub,
                                  }))
                                  syncSubCategoryDraft(selectedBlock.id, category, nextSub)
                                }}
                                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                                  isMainSelected
                                    ? `${accent.activeBg} ${accent.text} shadow-sm`
                                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                                }`}
                              >
                                {getMainCategoryLabel(category)}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Sub-Category pills */}
                      <div className="space-y-2 border-t border-stone-100 pt-3">
                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400">
                          Alt Kategori (Çift tıkla düzenle / Sağ tıkla seçenekleri gör)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {subCategories.map(category => {
                            const isSubSelected = activeSubCategory === category
                            const accent = getSubCategoryAccent(category)

                            return editingSubCategoryByBlock[selectedBlock.id] === category ? (
                              <input
                                key={category}
                                autoFocus
                                value={subCategoryDraftByBlock[selectedBlock.id] ?? getSubCategoryLabel(category, activeMainCategory)}
                                onChange={e =>
                                  setSubCategoryDraftByBlock(prev => ({
                                    ...prev,
                                    [selectedBlock.id]: e.target.value,
                                  }))
                                }
                                onBlur={() => commitInlineSubCategoryEdit(selectedBlock.id, activeMainCategory, category)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    commitInlineSubCategoryEdit(selectedBlock.id, activeMainCategory, category)
                                  }
                                  if (e.key === 'Escape') {
                                    syncSubCategoryDraft(selectedBlock.id, activeMainCategory, category)
                                    stopInlineSubCategoryEdit(selectedBlock.id)
                                  }
                                }}
                                className="min-w-[150px] rounded-xl border border-orange-500 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 outline-none ring-2 ring-orange-100"
                              />
                            ) : (
                              <button
                                key={category}
                                onClick={() => {
                                  setActiveSubCategoryByBlock(prev => ({
                                    ...prev,
                                    [selectedBlock.id]: category,
                                  }))
                                  syncSubCategoryDraft(selectedBlock.id, activeMainCategory, category)
                                }}
                                onDoubleClick={() => startInlineSubCategoryEdit(selectedBlock.id, activeMainCategory, category)}
                                onContextMenu={event => {
                                  event.preventDefault()
                                  setActiveSubCategoryByBlock(prev => ({
                                    ...prev,
                                    [selectedBlock.id]: category,
                                  }))
                                  syncSubCategoryDraft(selectedBlock.id, activeMainCategory, category)
                                  setSubCategoryContextMenu({
                                    blockId: selectedBlock.id,
                                    mainCategory: activeMainCategory,
                                    category,
                                    x: event.clientX,
                                    y: event.clientY,
                                  })
                                }}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                                  isSubSelected ? accent.active : accent.idle
                                }`}
                              >
                                <span className={`h-2 w-2 rounded-full ${accent.dot}`}></span>
                                <span>{getSubCategoryLabel(category, activeMainCategory)}</span>
                              </button>
                            )
                          })}
                          
                          {subCategories.length === 0 && (
                            <span className="text-xs text-stone-400 bg-stone-100 border border-stone-200/50 rounded-xl px-3 py-1.5">
                              Bu ana kategori altında alt sekme bulunmuyor.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right click actions popup */}
                      {subCategoryContextMenu?.blockId === selectedBlock.id && (
                        <div
                          className="fixed z-50 min-w-[160px] rounded-2xl border border-stone-200 bg-white p-2 shadow-xl"
                          style={{ left: subCategoryContextMenu.x, top: subCategoryContextMenu.y }}
                          onClick={e => e.stopPropagation()}
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
                            className="flex w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-stone-700 hover:bg-stone-50"
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
                            className="flex w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-stone-700 hover:bg-stone-50"
                          >
                            Çoğalt
                          </button>
                          <button
                            onClick={() => {
                              deleteSubCategory(subCategoryContextMenu.blockId, subCategoryContextMenu.category)
                              setSubCategoryContextMenu(null)
                            }}
                            className="flex w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            Tümünü Sil
                          </button>
                        </div>
                      )}

                      {/* Input controls to add/rename subcategories */}
                      <div className="flex flex-col md:flex-row gap-4 border-t border-stone-150 pt-4">
                        {activeSubCategory && (
                          <div className="flex-1 space-y-1.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400">Seçili Sekmeyi Düzenle</span>
                            <div className="flex gap-2">
                              <input
                                value={subCategoryDraftByBlock[selectedBlock.id] ?? getSubCategoryLabel(activeSubCategory, activeMainCategory)}
                                onChange={e =>
                                  setSubCategoryDraftByBlock(prev => ({
                                    ...prev,
                                    [selectedBlock.id]: e.target.value,
                                  }))
                                }
                                placeholder="Seçili alt sekme adını değiştir"
                                className="flex-1 rounded-xl border border-stone-250 bg-white px-3 py-2 text-xs font-bold text-stone-800 focus:border-stone-450 focus:outline-none"
                              />
                              <button
                                onClick={() =>
                                  renameSubCategory(
                                    selectedBlock.id,
                                    activeMainCategory,
                                    activeSubCategory,
                                    subCategoryDraftByBlock[selectedBlock.id] ?? ''
                                  )
                                }
                                className="rounded-xl bg-stone-900 hover:bg-stone-850 px-4 py-2 text-xs font-bold text-white transition-all"
                              >
                                Güncelle
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex-1 space-y-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400">Yeni Alt Sekme Ekle</span>
                          <div className="flex gap-2">
                            <input
                              value={newSubCategoryByBlock[selectedBlock.id] || ''}
                              onChange={e =>
                                setNewSubCategoryByBlock(prev => ({
                                  ...prev,
                                  [selectedBlock.id]: e.target.value,
                                }))
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  createSubCategory(selectedBlock.id, activeMainCategory, newSubCategoryByBlock[selectedBlock.id] || '')
                                }
                              }}
                              placeholder="Örnek: Kaba Kalıp, Tesisat İşleri..."
                              className="flex-1 rounded-xl border border-stone-250 bg-white px-3 py-2 text-xs font-bold text-stone-800 focus:border-stone-450 focus:outline-none"
                            />
                            <button
                              onClick={() => createSubCategory(selectedBlock.id, activeMainCategory, newSubCategoryByBlock[selectedBlock.id] || '')}
                              className="rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all"
                            >
                              Yeni Sekme Aç
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Table Spreadsheet layout */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-200 text-[10px] font-extrabold uppercase tracking-wider text-stone-450">
                            <th className="px-6 py-3.5 w-[35%]">İş Kalemi Açıklaması</th>
                            <th className="px-4 py-3.5 w-[25%]">Kategori</th>
                            <th className="px-4 py-3.5 w-[10%] text-center">Birim</th>
                            <th className="px-4 py-3.5 w-[10%] text-right">Metraj</th>
                            <th className="px-4 py-3.5 w-[10%] text-right">Birim Fiyat</th>
                            <th className="px-4 py-3.5 w-[15%] text-right">Toplam Tutar</th>
                            <th className="px-4 py-3.5 w-[5%] text-center">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {visibleItems.map(item => {
                            const itemTotal = (item.quantity || 0) * (item.unitPrice || 0)
                            return (
                              <tr key={item.id} className="hover:bg-stone-50/40 transition-colors">
                                {/* Item Name */}
                                <td className="px-6 py-2.5">
                                  <input
                                    value={item.name}
                                    onChange={e => updateBlockItem(selectedBlock.id, item.id, 'name', e.target.value)}
                                    placeholder="İş kalemini girin..."
                                    className="w-full border-none bg-transparent p-1 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                                  />
                                </td>
                                
                                {/* Item Category */}
                                <td className="px-4 py-2.5">
                                  <input
                                    value={item.category}
                                    onChange={e => updateBlockItem(selectedBlock.id, item.id, 'category', e.target.value)}
                                    className="w-full border-none bg-transparent p-1 text-xs font-semibold text-stone-500 focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                                  />
                                </td>

                                {/* Unit */}
                                <td className="px-4 py-2.5">
                                  <input
                                    value={item.unit}
                                    onChange={e => updateBlockItem(selectedBlock.id, item.id, 'unit', e.target.value)}
                                    className="w-full border-none bg-transparent p-1 text-xs font-bold text-stone-600 text-center focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                                  />
                                </td>

                                {/* Quantity */}
                                <td className="px-4 py-2.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.quantity}
                                    onChange={e => updateBlockItem(selectedBlock.id, item.id, 'quantity', parseLocalizedNumber(e.target.value))}
                                    className="w-full border-none bg-transparent p-1 text-xs font-bold text-stone-800 text-right focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                                  />
                                </td>

                                {/* Unit Price */}
                                <td className="px-4 py-2.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.unitPrice}
                                    onChange={e => updateBlockItem(selectedBlock.id, item.id, 'unitPrice', parseLocalizedNumber(e.target.value))}
                                    className="w-full border-none bg-transparent p-1 text-xs font-bold text-stone-850 text-right focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                                  />
                                </td>

                                {/* Total Price */}
                                <td className="px-4 py-2.5 text-right font-extrabold text-xs text-stone-900">
                                  {formatCurrency(itemTotal)}
                                </td>

                                {/* Delete */}
                                <td className="px-4 py-2.5 text-center">
                                  <button
                                    onClick={() => removeItemFromBlock(selectedBlock.id, item.id)}
                                    className="text-stone-400 hover:text-red-500 p-1 transition-colors"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            )
                          })}

                          {visibleItems.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-xs font-medium text-stone-400 bg-stone-50/50">
                                Bu alt kategoride kalem bulunmuyor. Yukarıdan hızlı şablon yükleyebilir ya da "Kalem Ekle" tuşuyla yeni satır ekleyebilirsiniz.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Footer subtotal summary */}
                    {visibleItems.length > 0 && (
                      <div className={`flex items-center justify-between border-t px-6 py-4 border-stone-200 ${getSubtotalRowClass(activeMainCategory)}`}>
                        <span className="text-xs font-bold uppercase tracking-wider">{activeSubCategory || 'Seçili Kategori Toplamı'}</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-semibold opacity-70">Toplam:</span>
                          <span className="text-base font-extrabold">{formatCurrency(visibleSubtotal)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Navigation footer buttons */}
                  <div className="flex justify-between items-center bg-white p-5 rounded-3xl border border-stone-200/60 shadow-sm mt-6">
                    <button
                      onClick={() => setActiveTab('varsayimlar')}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 px-5 py-3 text-xs font-bold text-stone-700 transition-all duration-200"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Önceki Aşama: Genel Parametreler</span>
                    </button>
                    
                    <button
                      onClick={() => setActiveTab('analiz')}
                      className="inline-flex items-center gap-2 rounded-2xl bg-stone-900 hover:bg-stone-850 hover:shadow-md px-5 py-3 text-xs font-bold text-white transition-all duration-200"
                    >
                      <span>Sonraki Aşama: Finansal Raporlama</span>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                </div>
              )}

              {/* STEP 3: Maliyet Analizi & Raporlama */}
              {activeTab === 'analiz' && (
                <div className="space-y-8">
                  
                  {/* Executive Summary Metrics Grid */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    
                    {/* Gross Area */}
                    <div className="rounded-3xl bg-white p-5 border border-stone-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.01)] hover:-translate-y-1 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">İnşaat Alanı (Brüt)</span>
                        <div className="p-2 bg-stone-50 rounded-xl border border-stone-200/50">
                          <svg className="h-5 w-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                      </div>
                      <div className="mt-4">
                        <span className="text-xl font-extrabold text-stone-850">{formatNumber(metrics.grossArea, 1)} m²</span>
                        <div className="text-[10px] font-bold text-stone-400 mt-1">Net: {formatNumber(metrics.netSellableArea, 1)} m² ({metrics.totalUnitCount} Daire)</div>
                      </div>
                    </div>

                    {/* Total Budget */}
                    <div className="rounded-3xl bg-white p-5 border border-stone-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.01)] hover:-translate-y-1 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Toplam Maliyet (Bütçe)</span>
                        <div className="p-2 bg-orange-50 rounded-xl border border-orange-100">
                          <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="mt-4">
                        <span className="text-xl font-extrabold text-stone-850">{formatCompactCurrency(metrics.subtotalCost)}</span>
                        <div className="text-[10px] font-bold text-orange-600 mt-1">Direkt: {formatCompactCurrency(metrics.directCost)}</div>
                      </div>
                    </div>

                    {/* m2 cost */}
                    <div className="rounded-3xl bg-white p-5 border border-stone-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.01)] hover:-translate-y-1 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Birim m² Maliyeti</span>
                        <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                          <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="mt-4">
                        <span className="text-xl font-extrabold text-stone-850">{formatCurrency(metrics.costPerGrossM2)}</span>
                        <div className="text-[10px] font-bold text-stone-400 mt-1">Net m²: {formatCurrency(metrics.costPerNetM2)} / m²</div>
                      </div>
                    </div>

                    {/* Target sale ciro */}
                    <div className="rounded-3xl bg-white p-5 border border-stone-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.01)] hover:-translate-y-1 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Hedef Satış Cirosu</span>
                        <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                          <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                      </div>
                      <div className="mt-4">
                        <span className="text-xl font-extrabold text-stone-850">{formatCompactCurrency(metrics.targetSaleWithVat)}</span>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">Daire Başı Ciro: {formatCompactCurrency(metrics.salePerUnit)}</div>
                      </div>
                    </div>

                  </div>

                  {/* Graphs Panel Grid */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    
                    {/* SVG Donut Chart for Categories */}
                    <div className="rounded-3xl bg-white p-6 border border-stone-200/60 shadow-sm space-y-4">
                      <div>
                        <h4 className="text-sm font-extrabold text-stone-800 uppercase tracking-wider">Kategori Bazlı Maliyet Dağılımı</h4>
                        <p className="text-xs text-stone-400 font-semibold mt-0.5">Toplam doğrudan maliyetin ana kategorilere dağılım oranları.</p>
                      </div>
                      <div className="pt-2">
                        <DonutChart data={donutData} />
                      </div>
                    </div>

                    {/* SVG Bar Chart for Blocks */}
                    <div className="rounded-3xl bg-white p-6 border border-stone-200/60 shadow-sm space-y-4">
                      <div>
                        <h4 className="text-sm font-extrabold text-stone-800 uppercase tracking-wider">Blok Maliyet Karşılaştırması</h4>
                        <p className="text-xs text-stone-400 font-semibold mt-0.5">Projedeki blokların doğrudan şantiye maliyeti karşılaştırması.</p>
                      </div>
                      <div className="pt-2">
                        {barData.length > 0 ? (
                          <BarChart data={barData} />
                        ) : (
                          <div className="flex h-52 items-center justify-center text-xs font-semibold text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                            Gösterilecek blok bulunmuyor.
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Detailed Analysis Reports tables */}
                  <div className="rounded-3xl bg-white border border-stone-200/60 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h4 className="text-base font-extrabold text-stone-900 tracking-tight">Finansal Özet Tabloları</h4>
                        <p className="text-xs font-medium text-stone-400 mt-0.5">Projenin fizibilite raporu ve m² birim analiz kırılımları.</p>
                      </div>
                      
                      <button
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 rounded-xl bg-stone-900 hover:bg-stone-800 hover:shadow-md px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-3a2 2 0 00-2-2H9a2 2 0 00-2 2v3a2 2 0 002 2zm5-12V5a3 3 0 00-3-3H9a3 3 0 00-3 3v4" />
                        </svg>
                        <span>PDF / Rapor Çıktısı Al</span>
                      </button>
                    </div>

                    <div className="p-6 grid gap-8 md:grid-cols-2">
                      {/* Left: General Project feasibility summary */}
                      <div className="space-y-4">
                        <div className="text-xs font-extrabold text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-1.5">Fizibilite ve Genel Giderler</div>
                        <div className="space-y-2 text-xs font-semibold text-stone-700">
                          <div className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl">
                            <span>Doğrudan Şantiye Maliyeti</span>
                            <span className="font-extrabold text-stone-900">{formatCurrency(metrics.directCost)}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl">
                            <span>Genel Giderler (%{formatNumber(inputs.indirectCostRate * 100, 1)})</span>
                            <span className="font-extrabold text-stone-900">{formatCurrency(metrics.indirectCost)}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl">
                            <span>Beklenmeyen Gider Sapma Payı (%{formatNumber(inputs.contingencyRate * 100, 1)})</span>
                            <span className="font-extrabold text-stone-900">{formatCurrency(metrics.contingencyCost)}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl">
                            <span>Ruhsat, Belediye ve Proje Bedelleri</span>
                            <span className="font-extrabold text-stone-900">{formatCurrency(inputs.permitAndProjectCost)}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl">
                            <span>Finansman ve Kredi Faiz Gideri</span>
                            <span className="font-extrabold text-stone-900">{formatCurrency(inputs.financingCost)}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-stone-900 text-white rounded-xl">
                            <span>Toplam Proje Maliyet Bütçesi</span>
                            <span className="font-extrabold">{formatCurrency(metrics.subtotalCost)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Revenue metrics */}
                      <div className="space-y-4">
                        <div className="text-xs font-extrabold text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-1.5">Gelir Hedefi ve Birim Paylaşım</div>
                        <div className="space-y-2 text-xs font-semibold text-stone-700">
                          <div className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl">
                            <span>Hedef Kâr Oranı (%{formatNumber(inputs.targetProfitRate * 100, 1)})</span>
                            <span className="font-extrabold text-stone-900">{formatCurrency(metrics.subtotalCost * inputs.targetProfitRate)}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl">
                            <span>KDV Hariç Hedef Satış Cirosu</span>
                            <span className="font-extrabold text-stone-900">{formatCurrency(metrics.targetSaleWithoutVat)}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl">
                            <span>KDV Toplamı (%{formatNumber(inputs.vatRate * 100, 1)})</span>
                            <span className="font-extrabold text-stone-900">{formatCurrency(metrics.vatAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-orange-50 border border-orange-200/50 rounded-xl text-orange-950">
                            <span>KDV Dahil Hedef Satış Toplamı</span>
                            <span className="font-extrabold">{formatCurrency(metrics.targetSaleWithVat)}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl">
                            <span>Ortalama Brüt m² Satış Fiyatı</span>
                            <span className="font-extrabold text-stone-900">{formatCurrency(metrics.targetSaleWithVat / Math.max(metrics.grossArea, 1))} / m²</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl">
                            <span>Ortalama Bağımsız Bölüm Satış Fiyatı</span>
                            <span className="font-extrabold text-stone-900">{formatCurrency(metrics.salePerUnit)} / Daire</span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Block Summary details table */}
                    <div className="p-6 border-t border-stone-100 space-y-4">
                      <div className="text-xs font-extrabold text-stone-400 uppercase tracking-widest">Detaylı Blok Analiz Listesi</div>
                      <div className="overflow-x-auto rounded-2xl border border-stone-200">
                        <table className="w-full text-left text-xs font-semibold border-collapse">
                          <thead>
                            <tr className="bg-stone-50 border-b border-stone-200 text-stone-450 text-[10px] font-extrabold uppercase tracking-wider">
                              <th className="px-6 py-3">Blok Adı</th>
                              <th className="px-4 py-3 text-right">Brüt İnşaat (m²)</th>
                              <th className="px-4 py-3 text-right">Net Satılabilir (m²)</th>
                              <th className="px-4 py-3 text-right">Daire Adedi</th>
                              <th className="px-4 py-3 text-right">Doğrudan Maliyet</th>
                              <th className="px-4 py-3 text-right">Brüt m² Maliyeti</th>
                              <th className="px-4 py-3 text-right">Net m² Maliyeti</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 text-stone-700">
                            {blockMetrics.map(block => (
                              <tr key={block.id} className="hover:bg-stone-50/50">
                                <td className="px-6 py-3 font-extrabold text-stone-900">{block.name}</td>
                                <td className="px-4 py-3 text-right">{formatNumber(block.grossArea, 1)} m²</td>
                                <td className="px-4 py-3 text-right">{formatNumber(block.netSellableArea, 1)} m²</td>
                                <td className="px-4 py-3 text-right">{block.unitCount} Adet</td>
                                <td className="px-4 py-3 text-right font-bold text-stone-850">{formatCurrency(block.directCost)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(block.costPerGrossM2)} / m²</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(block.costPerNetM2)} / m²</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>

                  {/* Back button to block inputs */}
                  <div className="flex justify-start bg-white p-5 rounded-3xl border border-stone-200/60 shadow-sm mt-6">
                    <button
                      onClick={() => setActiveTab('bloklar')}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 px-5 py-3 text-xs font-bold text-stone-700 transition-all duration-200"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Önceki Aşama: Blok Metraj Düzenleme</span>
                    </button>
                  </div>

                </div>
              )}

            </div>

          </div>

        </div>
      </div>

      {/* ==================== A4 PRINT OUTPUT SHEET ==================== */}
      <div className="print-only bg-white text-stone-900 p-0 font-sans">
        <div className="space-y-6">
          
          {/* Header Title */}
          <div className="text-center border-b-2 border-stone-900 pb-3">
            <h1 className="text-xl font-bold uppercase tracking-wider text-stone-900">İNŞAAT YATIRIM VE MALİYET FİZİBİLİTE RAPORU</h1>
            <div className="text-[10px] text-stone-500 font-bold mt-1 uppercase">
              Rapor Tarihi: {new Date().toLocaleDateString('tr-TR')} • Proje Adı: {inputs.scenarioName}
            </div>
          </div>

          {/* Project Parameter Summary Table */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-700 border-b border-stone-300 pb-1 mb-2">1. PROJE GENEL PARAMETRELERİ</div>
            <table className="w-full border-collapse border border-stone-300 text-[10px]">
              <tbody>
                <tr>
                  <td className="border border-stone-300 bg-stone-50 px-2 py-1 font-bold w-1/4">Senaryo Adı:</td>
                  <td className="border border-stone-300 px-2 py-1 w-1/4 font-semibold">{inputs.scenarioName}</td>
                  <td className="border border-stone-300 bg-stone-50 px-2 py-1 font-bold w-1/4">Genel Gider Oranı:</td>
                  <td className="border border-stone-300 px-2 py-1 w-1/4 font-semibold">%{formatNumber(inputs.indirectCostRate * 100, 1)}</td>
                </tr>
                <tr>
                  <td className="border border-stone-300 bg-stone-50 px-2 py-1 font-bold">Arsa Toplam Alanı:</td>
                  <td className="border border-stone-300 px-2 py-1 font-semibold">{formatNumber(inputs.landArea, 1)} m²</td>
                  <td className="border border-stone-300 bg-stone-50 px-2 py-1 font-bold">Beklenmeyen Gider Oranı:</td>
                  <td className="border border-stone-300 px-2 py-1 font-semibold">%{formatNumber(inputs.contingencyRate * 100, 1)}</td>
                </tr>
                <tr>
                  <td className="border border-stone-300 bg-stone-50 px-2 py-1 font-bold">Ortak Alan Oranı Hedefi:</td>
                  <td className="border border-stone-300 px-2 py-1 font-semibold">%{formatNumber(inputs.commonAreaRatio * 100, 1)}</td>
                  <td className="border border-stone-300 bg-stone-50 px-2 py-1 font-bold">Hedef Kâr Marjı:</td>
                  <td className="border border-stone-300 px-2 py-1 font-semibold">%{formatNumber(inputs.targetProfitRate * 100, 1)}</td>
                </tr>
                <tr>
                  <td className="border border-stone-300 bg-stone-50 px-2 py-1 font-bold">KDV Oranı:</td>
                  <td className="border border-stone-300 px-2 py-1 font-semibold">%{formatNumber(inputs.vatRate * 100, 1)}</td>
                  <td className="border border-stone-300 bg-stone-50 px-2 py-1 font-bold">Ruhsat & Proje Maliyeti:</td>
                  <td className="border border-stone-300 px-2 py-1 font-semibold">{formatCurrency(inputs.permitAndProjectCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Feasibility cost Summary Table */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-700 border-b border-stone-300 pb-1 mb-2">2. MALİYET VE CİRO FİZİBİLİTESİ</div>
            <table className="w-full border-collapse border border-stone-300 text-[10px]">
              <thead>
                <tr className="bg-stone-100 text-left">
                  <th className="border border-stone-300 px-3 py-1.5 font-bold">Maliyet Kalemi Ayrıntısı</th>
                  <th className="border border-stone-300 px-3 py-1.5 text-right font-bold w-[35%]">Tutar (TL)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-stone-300 px-3 py-1 font-semibold">Doğrudan İnşaat / Şantiye Yapım Gideri</td>
                  <td className="border border-stone-300 px-3 py-1 text-right font-bold">{formatCurrency(metrics.directCost)}</td>
                </tr>
                <tr>
                  <td className="border border-stone-300 px-3 py-1 font-semibold">Şantiye Genel Gider Payı</td>
                  <td className="border border-stone-300 px-3 py-1 text-right font-bold">{formatCurrency(metrics.indirectCost)}</td>
                </tr>
                <tr>
                  <td className="border border-stone-300 px-3 py-1 font-semibold">Beklenmeyen Gider / Risk Sapma Payı</td>
                  <td className="border border-stone-300 px-3 py-1 text-right font-bold">{formatCurrency(metrics.contingencyCost)}</td>
                </tr>
                <tr>
                  <td className="border border-stone-300 px-3 py-1 font-semibold">Ruhsat, Harç ve Proje Hazırlık Giderleri</td>
                  <td className="border border-stone-300 px-3 py-1 text-right font-bold">{formatCurrency(inputs.permitAndProjectCost)}</td>
                </tr>
                <tr>
                  <td className="border border-stone-300 px-3 py-1 font-semibold">Proje Finansman & Faiz Maliyeti</td>
                  <td className="border border-stone-300 px-3 py-1 text-right font-bold">{formatCurrency(inputs.financingCost)}</td>
                </tr>
                <tr className="bg-stone-50 font-bold">
                  <td className="border border-stone-300 px-3 py-1 text-stone-900 font-extrabold">TOPLAM PROJE YAPIM BÜTÇESİ (KDV Hariç)</td>
                  <td className="border border-stone-300 px-3 py-1 text-right text-stone-900 font-extrabold">{formatCurrency(metrics.subtotalCost)}</td>
                </tr>
                <tr>
                  <td className="border border-stone-300 px-3 py-1 font-semibold">Kâr Hedefi (%{formatNumber(inputs.targetProfitRate * 100, 1)})</td>
                  <td className="border border-stone-300 px-3 py-1 text-right font-bold">{formatCurrency(metrics.subtotalCost * inputs.targetProfitRate)}</td>
                </tr>
                <tr>
                  <td className="border border-stone-300 px-3 py-1 font-semibold">KDV Toplamı (%{formatNumber(inputs.vatRate * 100, 1)})</td>
                  <td className="border border-stone-300 px-3 py-1 text-right font-bold">{formatCurrency(metrics.vatAmount)}</td>
                </tr>
                <tr className="bg-stone-900 text-white font-bold">
                  <td className="border border-stone-900 px-3 py-1.5 font-extrabold">KDV DAHİL HEDEF SATIŞ TUTARI</td>
                  <td className="border border-stone-900 px-3 py-1.5 text-right font-extrabold">{formatCurrency(metrics.targetSaleWithVat)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Block breakdown lists */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-700 border-b border-stone-300 pb-1 mb-2">3. BLOK BAZINDA BİRİM ANALİZLERİ</div>
            <table className="w-full border-collapse border border-stone-300 text-[9px]">
              <thead>
                <tr className="bg-stone-50 text-left">
                  <th className="border border-stone-300 px-2 py-1.5 font-bold">Blok Adı</th>
                  <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">Brüt İnşaat (m²)</th>
                  <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">Net Satılabilir (m²)</th>
                  <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">Bağımsız Bölüm</th>
                  <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">Doğrudan Maliyet</th>
                  <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">Brüt m² Maliyeti</th>
                  <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">Net m² Maliyeti</th>
                </tr>
              </thead>
              <tbody>
                {blockMetrics.map(block => (
                  <tr key={block.id}>
                    <td className="border border-stone-300 px-2 py-1 font-bold">{block.name}</td>
                    <td className="border border-stone-300 px-2 py-1 text-right">{formatNumber(block.grossArea, 1)} m²</td>
                    <td className="border border-stone-300 px-2 py-1 text-right">{formatNumber(block.netSellableArea, 1)} m²</td>
                    <td className="border border-stone-300 px-2 py-1 text-right">{block.unitCount} Adet</td>
                    <td className="border border-stone-300 px-2 py-1 text-right font-bold">{formatCurrency(block.directCost)}</td>
                    <td className="border border-stone-300 px-2 py-1 text-right">{formatCurrency(block.costPerGrossM2)} / m²</td>
                    <td className="border border-stone-300 px-2 py-1 text-right">{formatCurrency(block.costPerNetM2)} / m²</td>
                  </tr>
                ))}
                <tr className="bg-stone-100 font-bold text-[9.5px]">
                  <td className="border border-stone-300 px-2 py-1 font-extrabold">PROJE TOPLAMI</td>
                  <td className="border border-stone-300 px-2 py-1 text-right font-extrabold">{formatNumber(metrics.grossArea, 1)} m²</td>
                  <td className="border border-stone-300 px-2 py-1 text-right font-extrabold">{formatNumber(metrics.netSellableArea, 1)} m²</td>
                  <td className="border border-stone-300 px-2 py-1 text-right font-extrabold">{metrics.totalUnitCount} Adet</td>
                  <td className="border border-stone-300 px-2 py-1 text-right font-extrabold">{formatCurrency(metrics.directCost)}</td>
                  <td className="border border-stone-300 px-2 py-1 text-right font-extrabold">{formatCurrency(metrics.costPerGrossM2)} / m²</td>
                  <td className="border border-stone-300 px-2 py-1 text-right font-extrabold">{formatCurrency(metrics.costPerNetM2)} / m²</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Category total breakdown table */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-700 border-b border-stone-300 pb-1 mb-2">4. KATEGORİ BAZLI YAPIM HARCAMALARI DAĞILIMI</div>
            <table className="w-full border-collapse border border-stone-300 text-[10px]">
              <thead>
                <tr className="bg-stone-50 text-left">
                  <th className="border border-stone-300 px-3 py-1 font-bold">İnşaat İmalat Kategorisi</th>
                  <th className="border border-stone-300 px-3 py-1 text-right font-bold w-[35%]">Toplam Harcama (TL)</th>
                  <th className="border border-stone-300 px-3 py-1 text-right font-bold w-[20%]">Yüzde Pay</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metrics.categoryTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, total]) => {
                    const ratio = metrics.directCost > 0 ? total / metrics.directCost : 0
                    return (
                      <tr key={category}>
                        <td className="border border-stone-300 px-3 py-1 font-semibold">{category}</td>
                        <td className="border border-stone-300 px-3 py-1 text-right font-bold">{formatCurrency(total)}</td>
                        <td className="border border-stone-300 px-3 py-1 text-right font-bold">%{formatNumber(ratio * 100, 1)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          {/* Signatures box */}
          <div className="pt-8 text-[11px]">
            <div className="grid grid-cols-2 gap-20">
              <div className="text-center border-t border-stone-400 pt-3">
                <div className="font-bold">Raporu Düzenleyen</div>
                <div className="text-stone-500 mt-1">İmza / Tarih</div>
              </div>
              <div className="text-center border-t border-stone-400 pt-3">
                <div className="font-bold">Proje Yetkilisi / Onay</div>
                <div className="text-stone-500 mt-1">İmza / Tarih</div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
