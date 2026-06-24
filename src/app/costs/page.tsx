'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

// ─── Kategoriler ───────────────────────────────────────────────────────────────
export const COST_CATEGORIES = [
  { value: 'insaat',       label: 'İnşaat',        color: '#f59e0b' },
  { value: 'iscilik',      label: 'İşçilik',        color: '#3b82f6' },
  { value: 'elektrik',     label: 'Elektrik',        color: '#eab308' },
  { value: 'su_tesisat',   label: 'Su/Tesisat',     color: '#06b6d4' },
  { value: 'ruhsat',       label: 'Ruhsat/Vergi',   color: '#8b5cf6' },
  { value: 'pazarlama',    label: 'Pazarlama',       color: '#ec4899' },
  { value: 'danismanlik',  label: 'Danışmanlık',    color: '#10b981' },
  { value: 'malzeme',      label: 'Malzeme',         color: '#f97316' },
  { value: 'nakliye',      label: 'Nakliye',         color: '#6366f1' },
  { value: 'diger',        label: 'Diğer',           color: '#6b7280' },
]

// Eski Türkçe kategori adlarını da renkle eşleştiren palet
const FALLBACK_PALETTE = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
]
const _colorCache: Record<string, string> = {}
let _colorIdx = 0

const normalizeForMatch = (value: string) =>
  value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const getCategoryMeta = (val: string) => {
  // Tam eşleşme
  const exact = COST_CATEGORIES.find(c => c.value === val)
  if (exact) return exact
  // Türkçe normalize eşleşme (büyük/küçük harf, aksan)
  const normVal = normalizeForMatch(val)
  const fuzzy = COST_CATEGORIES.find(c => normalizeForMatch(c.label).includes(normVal) || normVal.includes(normalizeForMatch(c.label)))
  if (fuzzy) return { label: val, color: fuzzy.color }
  // Bilinmeyen → kalıcı renk ata
  if (!_colorCache[val]) { _colorCache[val] = FALLBACK_PALETTE[_colorIdx++ % FALLBACK_PALETTE.length] }
  return { label: val, color: _colorCache[val] }
}

const fmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFull = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₺${(n / 1_000).toFixed(0)}K`
  return fmt.format(n)
}

type CostPeriodMeta = {
  year: string
  monthKey: string
  label: string
  sortKey: string
}

const getCostPeriodMeta = (cost: any): CostPeriodMeta => {
  const itemName = String(cost?.itemName || '')
  const normalizedName = normalizeForMatch(itemName)

  const explicitYear = normalizedName.match(/\b(20\d{2})\b/)?.[1]
  const explicitMonthRaw = normalizedName.match(/\b(\d{1,2})\s*\.?\s*ay\b/)?.[1]
  const explicitMonth = explicitMonthRaw ? Number(explicitMonthRaw) : null
  const rawLowerName = itemName.toLowerCase()
  const looksLikeYearBucket =
    normalizedName.includes('yil') ||
    normalizedName.includes('gider') ||
    rawLowerName.includes('yÄ±l') ||
    rawLowerName.includes('gider')

  if (explicitYear && explicitMonth && explicitMonth >= 1 && explicitMonth <= 12) {
    const monthValue = String(explicitMonth).padStart(2, '0')
    const monthKey = `${explicitYear}-${monthValue}`
    return {
      year: explicitYear,
      monthKey,
      label: new Date(`${monthKey}-01`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
      sortKey: monthKey,
    }
  }

  if (explicitYear && !explicitMonth && looksLikeYearBucket) {
    return {
      year: explicitYear,
      monthKey: `${explicitYear}-genel`,
      label: `${explicitYear} Genel`,
      sortKey: `${explicitYear}-00`,
    }
  }

  const date = String(cost?.date || '')
  const dateYear = date.slice(0, 4)
  const dateMonth = date.slice(0, 7)

  if (dateYear && dateMonth.length === 7) {
    return {
      year: dateYear,
      monthKey: dateMonth,
      label: new Date(`${dateMonth}-01`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
      sortKey: dateMonth,
    }
  }

  return {
    year: 'Bilinmiyor',
    monthKey: 'bilinmiyor',
    label: 'Dönemi Belirsiz',
    sortKey: '0000-00',
  }
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
interface CostForm {
  id?: string
  itemName: string
  category: string
  amount: string
  date: string
  note: string
}

function CostModal({
  open, onClose, onSave, initial, isAdmin,
}: {
  open: boolean
  onClose: () => void
  onSave: (d: CostForm) => Promise<void>
  initial: CostForm | null
  isAdmin: boolean
}) {
  const blank = (): CostForm => ({
    itemName: '', category: 'insaat', amount: '', date: new Date().toISOString().slice(0, 10), note: '',
  })
  const [form, setForm] = useState<CostForm>(blank)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) { setForm(initial ?? blank()); setErr('') }
  }, [open, initial])

  if (!open) return null

  const set = (k: keyof CostForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async () => {
    if (!form.itemName.trim()) return setErr('Kalem adı zorunlu.')
    if (!form.category) return setErr('Kategori seçiniz.')
    const amt = parseFloat(form.amount.replace(',', '.'))
    if (!amt || amt <= 0) return setErr('Tutar 0\'dan büyük olmalı.')
    if (!form.date) return setErr('Tarih zorunlu.')
    setSaving(true)
    try { await onSave({ ...form, amount: String(amt) }); onClose() }
    catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-700 to-slate-900 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{form.id ? '✏️ Maliyet Düzenle' : '➕ Yeni Maliyet Ekle'}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {err}</div>}

          {/* Kategori */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select value={form.category} onChange={set('category')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 bg-white">
              {COST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Kalem Adı */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kalem Adı</label>
            <input value={form.itemName} onChange={set('itemName')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              placeholder="Örn: Demir alımı, Kalıpçı işçiliği…" />
          </div>

          {/* Tutar & Tarih */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tutar (₺)</label>
              <input type="number" step="0.01" value={form.amount} onChange={set('amount')} inputMode="decimal"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                placeholder="0,00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
              <input type="date" value={form.date} onChange={set('date')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500" />
            </div>
          </div>

          {/* Not */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama <span className="text-gray-400">(isteğe bağlı)</span></label>
            <textarea value={form.note} onChange={set('note')} rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 resize-none"
              placeholder="Fatura no, tedarikçi adı vb." />
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} disabled={saving}
            className="px-5 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-colors">
            İptal
          </button>
          <button onClick={submit} disabled={saving}
            className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-medium transition-colors disabled:opacity-50">
            {saving ? '⏳ Kaydediliyor…' : form.id ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bar Chart ──────────────────────────────────────────────────────────────────
const BAR_COLORS = [
  ['#6366f1', '#818cf8'], ['#f59e0b', '#fbbf24'], ['#10b981', '#34d399'],
  ['#ef4444', '#f87171'], ['#ec4899', '#f472b6'], ['#06b6d4', '#22d3ee'],
  ['#8b5cf6', '#a78bfa'], ['#f97316', '#fb923c'], ['#14b8a6', '#2dd4bf'],
  ['#3b82f6', '#60a5fa'], ['#a855f7', '#c084fc'], ['#84cc16', '#a3e635'],
]

function BarChart({ data }: { data: { label: string; amount: number }[] }) {
  const CHART_H = 160 // px — sabit grafik yüksekliği
  const max = Math.max(...data.map(d => d.amount), 1)
  if (data.length === 0) return <p className="text-gray-400 text-sm text-center py-8">Veri yok</p>
  return (
    <div className="w-full">
      {/* Bar alanı */}
      <div className="flex items-end gap-2 w-full px-1" style={{ height: CHART_H }}>
        {data.map((d, i) => {
          const [from, to] = BAR_COLORS[i % BAR_COLORS.length]
          const barH = Math.max(Math.round((d.amount / max) * CHART_H), 8)
          return (
            <div key={i} className="flex-1 relative group" style={{ height: CHART_H }}>
              {/* Tooltip */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-1 bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-lg">
                {fmtShort(d.amount)}
              </div>
              {/* Bar */}
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-lg shadow-md transition-all duration-500 hover:brightness-110 cursor-pointer"
                style={{ height: barH, background: `linear-gradient(to top, ${from}, ${to})` }}
              />
            </div>
          )
        })}
      </div>
      {/* Ay etiketleri */}
      <div className="flex gap-2 w-full mt-2 px-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-xs text-gray-500 text-center truncate">{d.label}</div>
        ))}
      </div>
    </div>
  )
}


// ─── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0 || data.length === 0) return <p className="text-gray-400 text-sm text-center py-8">Veri yok</p>
  let offset = 0
  const radius = 56
  const strokeWidth = 22
  const circ = 2 * Math.PI * radius
  const GAP = 2 // px gap between segments
  const segments = data.map(d => {
    const pct = d.value / total
    const dash = Math.max(pct * circ - GAP, 0)
    const seg = { ...d, pct, dash, offset }
    offset += pct * circ
    return seg
  })
  const totalFormatted = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(total)
  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="relative flex-shrink-0">
        <svg viewBox="0 0 140 140" className="w-40 h-40 -rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" strokeWidth={strokeWidth} stroke="#f1f5f9" />
          {segments.map((s, i) => (
            <circle key={i} cx="70" cy="70" r={radius} fill="none" strokeWidth={strokeWidth}
              stroke={s.color}
              strokeDasharray={`${s.dash} ${circ - s.dash}`}
              strokeDashoffset={-s.offset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center rotate-0">
          <span className="text-xs text-gray-400">Toplam</span>
          <span className="text-sm font-bold text-gray-800 leading-tight">{totalFormatted}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {segments.filter(s => s.pct > 0.001).map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-gray-700 flex-1 truncate">{s.label}</span>
            <span className="text-gray-500 text-xs">{fmtShort(s.value)}</span>
            <span className="font-bold text-gray-900 flex-shrink-0 w-10 text-right">%{(s.pct * 100).toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Export Utils ───────────────────────────────────────────────────────────────
const escapeExcelXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

function exportExcel(costs: any[]) {
  const sortedCosts = [...costs].sort((a, b) => {
    const periodCompare = getCostPeriodMeta(a).sortKey.localeCompare(getCostPeriodMeta(b).sortKey)
    if (periodCompare !== 0) return periodCompare
    return String(a.date || '').localeCompare(String(b.date || ''))
  })

  const totalAmount = sortedCosts.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0)

  const yearlyTotals = sortedCosts.reduce<Record<string, number>>((acc, cost) => {
    const year = getCostPeriodMeta(cost).year
    acc[year] = (acc[year] || 0) + (Number(cost.amount) || 0)
    return acc
  }, {})

  const monthlyTotals = sortedCosts.reduce<Record<string, { year: string; label: string; sortKey: string; total: number }>>((acc, cost) => {
    const period = getCostPeriodMeta(cost)
    if (!acc[period.monthKey]) {
      acc[period.monthKey] = { year: period.year, label: period.label, sortKey: period.sortKey, total: 0 }
    }
    acc[period.monthKey].total += Number(cost.amount) || 0
    return acc
  }, {})

  const detailRows = sortedCosts.map(cost => {
    const period = getCostPeriodMeta(cost)
    const category = getCategoryMeta(cost.category).label
    return `
      <Row>
        <Cell><Data ss:Type="String">${escapeExcelXml(period.year)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeExcelXml(period.label)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeExcelXml(String(cost.date || ''))}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeExcelXml(category)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeExcelXml(String(cost.itemName || ''))}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeExcelXml(String(cost.note || ''))}</Data></Cell>
        <Cell ss:StyleID="currency"><Data ss:Type="Number">${Number(cost.amount) || 0}</Data></Cell>
      </Row>`
  }).join('')

  const yearRows = Object.entries(yearlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, total]) => `
      <Row>
        <Cell><Data ss:Type="String">${escapeExcelXml(year)}</Data></Cell>
        <Cell ss:StyleID="currency"><Data ss:Type="Number">${total}</Data></Cell>
      </Row>`)
    .join('')

  const monthRows = Object.values(monthlyTotals)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(item => `
      <Row>
        <Cell><Data ss:Type="String">${escapeExcelXml(item.year)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeExcelXml(item.label)}</Data></Cell>
        <Cell ss:StyleID="currency"><Data ss:Type="Number">${item.total}</Data></Cell>
      </Row>`)
    .join('')

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="currency">
   <NumberFormat ss:Format="[$₺-41F] #,##0.00"/>
  </Style>
  <Style ss:ID="total">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="[$₺-41F] #,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Maliyet Detayı">
  <Table>
   <Column ss:Width="80"/>
   <Column ss:Width="140"/>
   <Column ss:Width="90"/>
   <Column ss:Width="120"/>
   <Column ss:Width="240"/>
   <Column ss:Width="280"/>
   <Column ss:Width="120"/>
   <Row>
    <Cell ss:StyleID="header"><Data ss:Type="String">Yıl</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Dönem</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Tarih</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Kategori</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Kalem Adı</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Açıklama</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Tutar</Data></Cell>
   </Row>
   ${detailRows}
   <Row>
    <Cell><Data ss:Type="String">Genel Toplam</Data></Cell>
    <Cell/>
    <Cell/>
    <Cell/>
    <Cell/>
    <Cell/>
    <Cell ss:StyleID="total" ss:Formula="=SUM(R2C7:R${sortedCosts.length + 1}C7)"><Data ss:Type="Number">${totalAmount}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Yıllık Özet">
  <Table>
   <Column ss:Width="80"/>
   <Column ss:Width="140"/>
   <Row>
    <Cell ss:StyleID="header"><Data ss:Type="String">Yıl</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Toplam Tutar</Data></Cell>
   </Row>
   ${yearRows}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Aylık Özet">
  <Table>
   <Column ss:Width="80"/>
   <Column ss:Width="160"/>
   <Column ss:Width="140"/>
   <Row>
    <Cell ss:StyleID="header"><Data ss:Type="String">Yıl</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Ay</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Toplam Tutar</Data></Cell>
   </Row>
   ${monthRows}
  </Table>
 </Worksheet>
</Workbook>`

  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `maliyet-raporu_${new Date().toISOString().slice(0, 10)}.xml`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── ANA SAYFA ─────────────────────────────────────────────────────────────────
export default function CostsPage() {
  const router = useRouter()
  const { user, loading, isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [costs, setCosts] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'liste' | 'grafik'>('liste')
  const [selectedYear, setSelectedYear] = useState<string>('')

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    setMounted(true)
    if (!loading && !isAuthenticated) { router.push('/login'); return }
    fetchCosts()
  }, [isAuthenticated, loading, router])

  const fetchCosts = () =>
    fetch('/api/costs').then(r => r.json()).then(d => setCosts(Array.isArray(d) ? d : [])).catch(() => setCosts([]))

  // ── Mevcut yıllar (veriden otomatik)
  const availableYears = useMemo(() => {
    const yrs = [...new Set(costs.map(c => getCostPeriodMeta(c).year).filter(Boolean))]
    return yrs.sort()
  }, [costs])

  const availableMonthsForSelectedYear = useMemo(() => {
    return [...new Set(
      costs
        .filter(c => {
          const period = getCostPeriodMeta(c)
          const yearMatch = selectedYear ? period.year === selectedYear : true
          const categoryMatch = filterCat ? c.category === filterCat : true
          return yearMatch && categoryMatch
        })
        .map(c => {
          const period = getCostPeriodMeta(c)
          return `${period.monthKey}::${period.label}::${period.sortKey}`
        })
        .filter(Boolean)
    )]
      .sort((a, b) => {
        const [, , aSort] = a.split('::')
        const [, , bSort] = b.split('::')
        return aSort.localeCompare(bSort)
      })
      .map(month => {
        const [value, label] = month.split('::')
        return {
          value,
          label: label.replace(/\s+\d{4}$/, ''),
        }
      })
  }, [costs, selectedYear, filterCat])

  // Varsayılan yılı ayarla (ilk veri gelince)
  useEffect(() => {
    if (!selectedYear && availableYears.length > 0) setSelectedYear(availableYears[0])
  }, [availableYears, selectedYear])

  // ── Filtreli liste (ay + kategori + yıl)
  const filteredCosts = useMemo(() => {
    return costs.filter(c => {
      const period = getCostPeriodMeta(c)
      const monthMatch = filterMonth ? period.monthKey === filterMonth : true
      const catMatch = filterCat ? c.category === filterCat : true
      const yearMatch = selectedYear ? period.year === selectedYear : true
      return monthMatch && catMatch && yearMatch
    })
  }, [costs, filterMonth, filterCat, selectedYear])

  useEffect(() => {
    if (!selectedYear) return
    if (!filterMonth) return
    const existsInSelectedYear = availableMonthsForSelectedYear.some(month => month.value === filterMonth)
    if (!existsInSelectedYear) {
      setFilterMonth('')
    }
  }, [selectedYear, filterMonth, availableMonthsForSelectedYear])

  // ── Aylık gruplar
  const monthGroups = useMemo(() => {
    const groups: Record<string, { items: any[]; label: string; sortKey: string }> = {}
    filteredCosts.forEach(c => {
      const period = getCostPeriodMeta(c)
      if (!groups[period.monthKey]) {
        groups[period.monthKey] = {
          items: [],
          label: period.label,
          sortKey: period.sortKey,
        }
      }
      groups[period.monthKey].items.push(c)
    })
    return Object.entries(groups)
      .sort(([, a], [, b]) => b.sortKey.localeCompare(a.sortKey))
      .map(([month, group]) => ({
        month,
        label: group.label,
        items: group.items.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
        total: group.items.reduce((s, i) => s + (i.amount || 0), 0),
      }))
  }, [filteredCosts])

  // ── Grafikler için veri
  const monthChartData = useMemo(() => {
    return monthGroups.slice(0, 12).reverse().map(g => ({
      label: g.month.endsWith('-genel')
        ? `${g.month.slice(2, 4)} Gn`
        : new Date(g.month + '-01').toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
      amount: g.total,
    }))
  }, [monthGroups])

  const categoryChartData = useMemo(() => {
    const totals: Record<string, number> = {}
    filteredCosts.forEach(c => { totals[c.category] = (totals[c.category] || 0) + (c.amount || 0) })
    return Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, val]) => {
        const meta = getCategoryMeta(cat)
        return { label: meta.label.replace(/^[^ ]+ /, ''), value: val, color: meta.color }
      })
  }, [filteredCosts])

  // ── Özet sayılar
  const totalAll = costs.reduce((s, c) => s + (c.amount || 0), 0)
  const totalFiltered = filteredCosts.reduce((s, c) => s + (c.amount || 0), 0)
  const thisMonthKey = new Date().toISOString().slice(0, 7)
  const lastMonthKey = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) })()
  const thisMonthTotal = costs.filter(c => (c.date || '').startsWith(thisMonthKey)).reduce((s, c) => s + (c.amount || 0), 0)
  const lastMonthTotal = costs.filter(c => (c.date || '').startsWith(lastMonthKey)).reduce((s, c) => s + (c.amount || 0), 0)
  const monthDiff = thisMonthTotal - lastMonthTotal
  const topCat = categoryChartData[0]

  // ── CRUD
  const handleSave = async (form: any) => {
    const isEdit = Boolean(form.id)
    const res = await fetch('/api/costs', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-actor-username': user?.username || '' },
      body: JSON.stringify({
        id: form.id,
        itemName: form.itemName,
        category: form.category,
        amount: parseFloat(form.amount),
        date: form.date,
        note: form.note,
      }),
    })
    if (!res.ok) { const j = await res.json(); throw new Error(j?.error || 'Kaydedilemedi.') }
    fetchCosts()
  }

  const handleDelete = async (item: any) => {
    if (!window.confirm(`"${item.itemName}" silinsin mi?`)) return
    const res = await fetch('/api/costs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-actor-username': user?.username || '' },
      body: JSON.stringify({ id: item.id }),
    })
    if (!res.ok) { const j = await res.json(); alert(j?.error || 'Silinemedi.'); return }
    fetchCosts()
  }

  const toggleMonth = (m: string) => setExpandedMonths(prev => {
    const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n
  })

  if (!mounted || loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin w-8 h-8 border-4 border-slate-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-6 shadow-xl">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button onClick={() => router.push('/')} className="text-white/60 hover:text-white text-sm mb-2 flex items-center gap-1 transition-colors">
              ← Ana Sayfa
            </button>
            <h1 className="text-2xl font-bold">💰 Maliyet Yönetimi</h1>
            <p className="text-white/60 text-sm mt-0.5">Proje harcamalarını aylık takip edin</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => exportExcel(filteredCosts)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              📤 Excel İndir
            </button>
            <button onClick={() => { setEditItem(null); setModalOpen(true) }}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-lg">
              ➕ Yeni Maliyet
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Özet Kartlar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Toplam Maliyet</div>
            <div className="text-xl font-bold text-red-600 leading-tight">{fmtFull.format(totalAll)}</div>
            <div className="text-xs text-gray-400 mt-1">{costs.length} kayıt</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Bu Ay</div>
            <div className="text-2xl font-bold text-slate-700">{fmtShort(thisMonthTotal)}</div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${monthDiff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {monthDiff > 0 ? '▲' : '▼'} {fmtShort(Math.abs(monthDiff))} geçen aya göre
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Geçen Ay</div>
            <div className="text-2xl font-bold text-gray-600">{fmtShort(lastMonthTotal)}</div>
            <div className="text-xs text-gray-400 mt-1">
              {new Date(lastMonthKey + '-01').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">En Yüksek Kategori</div>
            <div className="text-lg font-bold text-slate-700 truncate">{topCat?.label || '—'}</div>
            <div className="text-xs text-gray-400 mt-1">{topCat ? fmtShort(topCat.value) : ''}</div>
          </div>
        </div>

        {/* Filtreler + Tab */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 mr-2">
            {(['liste', 'grafik'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === t ? 'bg-slate-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {t === 'liste' ? '📋 Liste' : '📊 Grafik'}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-0 flex flex-wrap gap-2">
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 bg-white">
              <option value="">📅 Tüm Aylar</option>
              {[...new Set(costs.map(c => (c.date || '').slice(0, 7)).filter(Boolean))].sort().reverse().map(m => (
                <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</option>
              ))}
            </select>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 bg-white">
              <option value="">🏷️ Tüm Kategoriler</option>
              {COST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {(filterMonth || filterCat) && (
              <button onClick={() => { setFilterMonth(''); setFilterCat('') }}
                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 transition-colors">
                ✕ Temizle
              </button>
            )}
          </div>
          {(filterMonth || filterCat) && (
            <div className="text-sm font-semibold text-slate-700">{fmt.format(totalFiltered)}</div>
          )}
        </div>

        {/* İçerik */}
        {activeTab === 'grafik' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">📈 Aylık Harcama Trendi</h3>
              {monthChartData.length > 0 ? <BarChart data={monthChartData} /> : <p className="text-gray-400 text-sm">Veri yok</p>}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">🥧 Kategori Dağılımı</h3>
              {categoryChartData.length > 0 ? <DonutChart data={categoryChartData} /> : <p className="text-gray-400 text-sm">Veri yok</p>}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">📊 Kategori Özeti</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categoryChartData.map((c, i) => (
                  <div key={i} className="rounded-lg p-3 flex items-center gap-3" style={{ background: c.color + '18', borderLeft: `3px solid ${c.color}` }}>
                    <div>
                      <div className="text-xs text-gray-600">{c.label}</div>
                      <div className="font-bold text-gray-900 text-sm">{fmtShort(c.value)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Yıl Alt Sekmeleri */}
            {availableYears.length > 1 && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <div className="inline-flex items-center gap-2 border-b border-slate-200 pb-2">
                    {availableYears.map(yr => {
                      const yrTotal = costs
                        .filter(c => getCostPeriodMeta(c).year === yr)
                        .reduce((s, c) => s + (c.amount || 0), 0)
                      const isActive = selectedYear === yr
                      return (
                        <button
                          key={yr}
                          onClick={() => { setSelectedYear(yr); setFilterMonth('') }}
                          className={`flex min-w-[220px] items-center justify-between rounded-t-xl border border-b-0 px-4 py-3 text-left transition-all ${
                            isActive
                              ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800'
                          }`}
                        >
                          <span className="text-sm font-bold">{yr}</span>
                          <span className={`ml-3 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${
                            isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {fmtFull.format(yrTotal)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {availableMonthsForSelectedYear.length > 0 && (
                  <div className="overflow-x-auto">
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      <button
                        onClick={() => setFilterMonth('')}
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                          filterMonth === ''
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-300'
                            : 'text-slate-600 hover:bg-white'
                        }`}
                      >
                        Tümü
                      </button>
                      {availableMonthsForSelectedYear.map(month => {
                        const isActive = filterMonth === month.value
                        return (
                          <button
                            key={month.value}
                            onClick={() => setFilterMonth(month.value)}
                            className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition-all ${
                              isActive
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-white'
                            }`}
                          >
                            {month.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Aylık Listeler */}
            <div className="space-y-3">
            {monthGroups.length === 0 && (
              <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">
                {selectedYear ? `${selectedYear} yılına ait kayıt yok.` : 'Henüz maliyet kaydı yok.'}<br />
                <button onClick={() => setModalOpen(true)} className="mt-3 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm">İlk Kaydı Ekle</button>
              </div>
            )}
            {monthGroups.map(({ month, label, items, total }) => {
              const expanded = expandedMonths.has(month)
              return (
                <div key={month} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Ay Başlığı */}
                  <button onClick={() => toggleMonth(month)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{expanded ? '▾' : '▸'}</span>
                      <div className="text-left">
                        <div className="font-semibold text-gray-900">{label}</div>
                        <div className="text-xs text-gray-500">{items.length} harcama kalemi</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">{fmt.format(total)}</div>
                      <div className="text-xs text-gray-400">Toplam</div>
                    </div>
                  </button>

                  {/* Kalemler */}
                  {expanded && (
                    <div className="border-t border-gray-100">
                      {items.map((item: any, i: number) => {
                        const catMeta = getCategoryMeta(item.category)
                        return (
                          <div key={item.id || i} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: catMeta.color }} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">{item.itemName}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                <span>{catMeta.label}</span>
                                <span>·</span>
                                <span>{item.date}</span>
                                {item.note && <><span>·</span><span className="truncate max-w-xs">{item.note}</span></>}
                              </div>
                            </div>
                            <div className="font-bold text-gray-900 text-sm flex-shrink-0">{fmt.format(item.amount || 0)}</div>
                            {isAdmin && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => { setEditItem(item); setModalOpen(true) }}
                                  className="px-2.5 py-1 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">✏️</button>
                                <button onClick={() => handleDelete(item)}
                                  className="px-2.5 py-1 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">🗑️</button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          </div>
        )}
      </div>

      <CostModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null) }}
        onSave={handleSave}
        initial={editItem ? { id: editItem.id, itemName: editItem.itemName, category: editItem.category || 'diger', amount: String(editItem.amount), date: editItem.date, note: editItem.note || '' } : null}
        isAdmin={isAdmin}
      />
    </div>
  )
}
