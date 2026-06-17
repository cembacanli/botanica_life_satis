import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SUBCONTRACTORS_TABLE = 'subcontractors'
const SUBCONTRACTOR_CLAIMS_TABLE = 'subcontractor_claims'

interface SubcontractorPayload {
  id?: string
  name: string
  workScope: string
  contractDate: string
  workDurationDays: number
  contractAmount: number
  phone?: string
  note?: string
  contractItems?: ContractItem[]
}

interface ContractItem {
  id: string
  name: string
  unit: string
  estimatedQuantity: number
  unitPrice: number
  amount: number
}

interface ContractMeta {
  contractDate: string
  workDurationDays: number
  contractAmount: number
  contractItems?: ContractItem[]
}

interface NoteAnalysisResult {
  apartmentNumbers: string[]
  blockName: string
  saleAmount: number
}

const META_PREFIX = '@@CONTRACT_META@@'
const ANALYSIS_PREFIX = '[Analiz]'

function getActorUsername(request: NextRequest) {
  return String(request.headers.get('x-actor-username') || '').trim().toLocaleLowerCase('tr-TR')
}

function isSubcontractorsTableMissing(error: any) {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '')
  return code === 'PGRST205' || message.includes("could not find the table 'public.subcontractors'")
}

function getSchemaErrorMessage(tableName: string) {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  const projectRef = url.replace('https://', '').split('.')[0] || 'unknown'
  return `Supabase schema eksik: ${tableName}. Gerekli kolonlar: contract_date, work_duration_days, contract_amount. Uygulamanin bagli oldugu project ref: ${projectRef}. Lutfen ayni projede supabase/subcontractor_module.sql dosyasini tekrar calistirin.`
}

function isContractColumnCacheError(error: any) {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '')
  return (
    code === 'PGRST204' &&
    (message.includes('contract_amount') ||
      message.includes('contract_items') ||
      message.includes('contract_date') ||
      message.includes('work_duration_days') ||
      message.includes('contractamount') ||
      message.includes('contractitems') ||
      message.includes('contractdate') ||
      message.includes('workdurationdays'))
  )
}

function buildPersistedNote(note: string, meta: ContractMeta) {
  return `${META_PREFIX}${JSON.stringify(meta)}\n${note}`
}

function parsePersistedNote(rawNote: any): { userNote: string; meta: Partial<ContractMeta> } {
  const text = String(rawNote || '')
  if (!text.startsWith(META_PREFIX)) {
    return { userNote: text, meta: {} }
  }
  const endIdx = text.indexOf('\n')
  const metaChunk = endIdx >= 0 ? text.slice(META_PREFIX.length, endIdx) : text.slice(META_PREFIX.length)
  const noteChunk = endIdx >= 0 ? text.slice(endIdx + 1) : ''
  try {
    const parsed = JSON.parse(metaChunk) as Partial<ContractMeta>
    return { userNote: noteChunk, meta: parsed || {} }
  } catch {
    return { userNote: text, meta: {} }
  }
}

function sanitizeNoteForReanalysis(note: string) {
  return note
    .split('\n')
    .filter(line => !line.trim().startsWith(ANALYSIS_PREFIX))
    .join('\n')
    .trim()
}

function parseMoneyToNumber(raw: string): number {
  let cleaned = String(raw || '').trim().toLocaleLowerCase('tr-TR')
  let multiplier = 1

  if (cleaned.includes('milyar')) {
    multiplier = 1_000_000_000
    cleaned = cleaned.replace('milyar', '').trim()
  } else if (cleaned.includes('milyon')) {
    multiplier = 1_000_000
    cleaned = cleaned.replace('milyon', '').trim()
  } else if (cleaned.includes('bin')) {
    multiplier = 1_000
    cleaned = cleaned.replace('bin', '').trim()
  }

  cleaned = cleaned.replace(/tl|₺|try|türk lirası|turk lirasi|lira/gi, '').trim()
  cleaned = cleaned.replace(/\s+/g, '')

  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.')
  } else {
    cleaned = cleaned.replace(/\./g, '')
  }

  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * multiplier)
}

function analyzeSubcontractorNote(note: string): NoteAnalysisResult {
  const apartmentSet = new Set<string>()
  const saleAmounts: number[] = []
  const noteText = String(note || '')
  const lower = noteText.toLocaleLowerCase('tr-TR')
  const blockMatch = noteText.match(/([A-Za-zÇĞİÖŞÜçğıöşü])\s*blok/i)
  const blockName = blockMatch ? String(blockMatch[1]).toUpperCase() : ''

  // "118 119 120 numarali daire" gibi kaliplardan daire no cikarimi
  const apartmentPattern = /([\d\s,.-]{1,80})\s*(?:numarali|numaralı)?\s*daire\w*/gi
  let apartmentMatch: RegExpExecArray | null
  while ((apartmentMatch = apartmentPattern.exec(noteText)) !== null) {
    const numbers = apartmentMatch[1].match(/\d{1,4}/g) || []
    numbers.forEach(n => apartmentSet.add(n))
  }

  // "toplam ... tl" gibi satis bedeli kaliplari
  const totalTlPattern = /toplam(?:da)?[^0-9]{0,20}([\d.,\s]+(?:\s*(?:milyon|milyar|bin))?)\s*(?:tl|₺|türk lirası|turk lirasi|lira)/gi
  let totalTlMatch: RegExpExecArray | null
  while ((totalTlMatch = totalTlPattern.exec(lower)) !== null) {
    const amount = parseMoneyToNumber(totalTlMatch[1])
    if (amount > 0) saleAmounts.push(amount)
  }

  // Genel "xxxx tl" pattern
  const genericTlPattern = /([\d.,\s]+(?:\s*(?:milyon|milyar|bin))?)\s*(?:tl|₺|türk lirası|turk lirasi|lira)/gi
  let genericTlMatch: RegExpExecArray | null
  while ((genericTlMatch = genericTlPattern.exec(lower)) !== null) {
    const amount = parseMoneyToNumber(genericTlMatch[1])
    if (amount > 0) saleAmounts.push(amount)
  }

  // "10000000 bedelle" gibi kaliplar
  const pricedWithBedellePattern = /([\d.,\s]+(?:\s*(?:milyon|milyar|bin))?)\s*bedelle/gi
  let bedelleMatch: RegExpExecArray | null
  while ((bedelleMatch = pricedWithBedellePattern.exec(lower)) !== null) {
    const amount = parseMoneyToNumber(bedelleMatch[1])
    if (amount > 0) saleAmounts.push(amount)
  }

  const saleAmount = saleAmounts.length > 0 ? Math.max(...saleAmounts) : 0
  return {
    apartmentNumbers: Array.from(apartmentSet),
    blockName,
    saleAmount,
  }
}

function applyNoteAnalysis(payload: ReturnType<typeof normalizeAndValidatePayload>) {
  if (!payload) return null

  const cleanNote = sanitizeNoteForReanalysis(payload.note || '')
  const analysis = analyzeSubcontractorNote(cleanNote)
  if (analysis.saleAmount <= 0) {
    return {
      ...payload,
      note: cleanNote,
    }
  }

  const remainingContractAmount = Math.max(payload.contractAmount - analysis.saleAmount, 0)
  const apartmentText =
    analysis.apartmentNumbers.length > 0
      ? `${analysis.blockName ? `${analysis.blockName} Blok ` : ''}${analysis.apartmentNumbers.join(', ')} Numaralar`
      : `${analysis.blockName ? `${analysis.blockName} Blok` : 'Daire bilgisi belirtilmedi'}`
  const analysisLine =
    `${ANALYSIS_PREFIX} Bartir verilen daireler: ${apartmentText}, ` +
    `Toplam satis bedeli: ${analysis.saleAmount.toLocaleString('tr-TR')} TL, ` +
    `Dusum sonrasi kalan bakiye: ${remainingContractAmount.toLocaleString('tr-TR')} TL`

  const finalNote = cleanNote ? `${cleanNote}\n${analysisLine}` : analysisLine

  return {
    ...payload,
    contractAmount: remainingContractAmount,
    note: finalNote,
  }
}

function normalizeAndValidatePayload(body: SubcontractorPayload) {
  const name = String(body?.name || '').trim()
  const workScope = String(body?.workScope || '').trim()
  const contractDate = String(body?.contractDate || '').trim()
  const workDurationDays = Math.round(Number(body?.workDurationDays || 0))
  const contractItems = normalizeContractItems(body?.contractItems)
  const contractItemsTotal = contractItems.reduce((sum, item) => sum + item.amount, 0)
  const contractAmount = Math.round(Number(body?.contractAmount || contractItemsTotal || 0))
  const phone = String(body?.phone || '').trim()
  const note = String(body?.note || '').trim()
  if (!name || !workScope || !contractDate) return null
  if (!Number.isFinite(workDurationDays) || workDurationDays <= 0) return null
  if (!Number.isFinite(contractAmount) || contractAmount <= 0) return null
  return { name, workScope, contractDate, workDurationDays, contractAmount, phone, note, contractItems }
}

function normalizeContractItems(items: any): ContractItem[] {
  if (!Array.isArray(items)) return []

  return items
    .map((item, index) => {
      const estimatedQuantity = Number(item?.estimatedQuantity || 0)
      const unitPrice = Number(item?.unitPrice || 0)
      const amount = Math.round(Number(item?.amount || estimatedQuantity * unitPrice || 0))
      return {
        id: String(item?.id || `item-${Date.now()}-${index}`),
        name: String(item?.name || '').trim(),
        unit: String(item?.unit || '').trim(),
        estimatedQuantity: Number.isFinite(estimatedQuantity) && estimatedQuantity > 0 ? estimatedQuantity : 0,
        unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
      }
    })
    .filter(item => item.name && item.unit && item.estimatedQuantity > 0 && item.unitPrice > 0 && item.amount > 0)
}

function mapRow(row: any) {
  const parsed = parsePersistedNote(row.note)
  const contractDate = row.contract_date ?? row.contractDate ?? parsed.meta.contractDate ?? ''
  const workDurationDays = row.work_duration_days ?? row.workDurationDays ?? parsed.meta.workDurationDays ?? 0
  const contractAmount = row.contract_amount ?? row.contractAmount ?? parsed.meta.contractAmount ?? 0
  const contractItems = Array.isArray(row.contract_items)
    ? normalizeContractItems(row.contract_items)
    : normalizeContractItems(parsed.meta.contractItems)
  return {
    id: row.id,
    name: row.name,
    workScope: row.work_scope ?? row.workScope ?? '',
    contractDate,
    workDurationDays,
    contractAmount,
    contractItems,
    phone: row.phone || '',
    note: parsed.userNote,
    createdAt: row.created_at,
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from(SUBCONTRACTORS_TABLE)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      if (isSubcontractorsTableMissing(error)) {
        return NextResponse.json({ error: getSchemaErrorMessage(SUBCONTRACTORS_TABLE) }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json((data || []).map(mapRow))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractors fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = applyNoteAnalysis(normalizeAndValidatePayload((await request.json()) as SubcontractorPayload))
    if (!payload) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    const insertPayload = {
      name: payload.name,
      work_scope: payload.workScope,
      contract_date: payload.contractDate,
      work_duration_days: payload.workDurationDays,
      contract_amount: payload.contractAmount,
      contract_items: payload.contractItems,
      phone: payload.phone,
      note: payload.note,
      created_at: new Date().toISOString(),
    }

    const legacyInsertPayload = {
      name: payload.name,
      work_scope: payload.workScope,
      contractDate: payload.contractDate,
      workDurationDays: payload.workDurationDays,
      contractAmount: payload.contractAmount,
      contractItems: payload.contractItems,
      phone: payload.phone,
      note: payload.note,
      created_at: new Date().toISOString(),
    }

    const compatibilityInsertPayload = {
      name: payload.name,
      work_scope: payload.workScope,
      phone: payload.phone,
      note: buildPersistedNote(payload.note, {
        contractDate: payload.contractDate,
        workDurationDays: payload.workDurationDays,
        contractAmount: payload.contractAmount,
        contractItems: payload.contractItems,
      }),
      created_at: new Date().toISOString(),
    }

    let { data, error } = await supabase.from(SUBCONTRACTORS_TABLE).insert(insertPayload).select('*').single()
    if (error && isContractColumnCacheError(error)) {
      const fallbackResult = await supabase.from(SUBCONTRACTORS_TABLE).insert(legacyInsertPayload).select('*').single()
      data = fallbackResult.data
      error = fallbackResult.error
    }
    if (error && isContractColumnCacheError(error)) {
      const compatibilityResult = await supabase
        .from(SUBCONTRACTORS_TABLE)
        .insert(compatibilityInsertPayload)
        .select('*')
        .single()
      data = compatibilityResult.data
      error = compatibilityResult.error
    }

    if (error) {
      if (isSubcontractorsTableMissing(error)) {
        return NextResponse.json({ error: getSchemaErrorMessage(SUBCONTRACTORS_TABLE) }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(mapRow(data))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractor create failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = getActorUsername(request)
    if (actor !== 'cem') {
      return NextResponse.json(
        { error: 'Bu islem icin yetkiniz yok. Sadece cem kullanicisi duzenleme yapabilir.' },
        { status: 403 }
      )
    }

    const body = (await request.json()) as SubcontractorPayload
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const payload = normalizeAndValidatePayload(body)
    if (!payload) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    const updatePayload = {
      name: payload.name,
      work_scope: payload.workScope,
      contract_date: payload.contractDate,
      work_duration_days: payload.workDurationDays,
      contract_amount: payload.contractAmount,
      contract_items: payload.contractItems,
      phone: payload.phone,
      note: payload.note,
    }

    const legacyUpdatePayload = {
      name: payload.name,
      work_scope: payload.workScope,
      contractDate: payload.contractDate,
      workDurationDays: payload.workDurationDays,
      contractAmount: payload.contractAmount,
      contractItems: payload.contractItems,
      phone: payload.phone,
      note: payload.note,
    }

    const compatibilityUpdatePayload = {
      name: payload.name,
      work_scope: payload.workScope,
      phone: payload.phone,
      note: buildPersistedNote(payload.note, {
        contractDate: payload.contractDate,
        workDurationDays: payload.workDurationDays,
        contractAmount: payload.contractAmount,
        contractItems: payload.contractItems,
      }),
    }

    let { data, error } = await supabase
      .from(SUBCONTRACTORS_TABLE)
      .update(updatePayload)
      .eq('id', id)
      .select('*')

    if (error && isContractColumnCacheError(error)) {
      const fallbackResult = await supabase
        .from(SUBCONTRACTORS_TABLE)
        .update(legacyUpdatePayload)
        .eq('id', id)
        .select('*')
      data = fallbackResult.data
      error = fallbackResult.error
    }
    if (error && isContractColumnCacheError(error)) {
      const compatibilityResult = await supabase
        .from(SUBCONTRACTORS_TABLE)
        .update(compatibilityUpdatePayload)
        .eq('id', id)
        .select('*')
      data = compatibilityResult.data
      error = compatibilityResult.error
    }

    if (error) {
      if (isSubcontractorsTableMissing(error)) {
        return NextResponse.json({ error: getSchemaErrorMessage(SUBCONTRACTORS_TABLE) }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Kayit bulunamadi.' }, { status: 404 })
    }

    return NextResponse.json(mapRow(data[0]))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractor update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = getActorUsername(request)
    if (actor !== 'cem') {
      return NextResponse.json(
        { error: 'Bu islem icin yetkiniz yok. Sadece cem kullanicisi silme yapabilir.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase.from(SUBCONTRACTORS_TABLE).delete().eq('id', id)
    if (error) {
      if (isSubcontractorsTableMissing(error)) {
        return NextResponse.json({ error: getSchemaErrorMessage(SUBCONTRACTORS_TABLE) }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from(SUBCONTRACTOR_CLAIMS_TABLE).delete().eq('subcontractor_id', id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractor delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
