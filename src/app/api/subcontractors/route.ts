import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { formatCustomerName } from '@/lib/customer-name'

const SUBCONTRACTORS_TABLE = 'subcontractors'
const SUBCONTRACTOR_CLAIMS_TABLE = 'subcontractor_claims'

interface SubcontractorPayload {
  id?: string
  name: string
  workScope: string
  contractDate: string
  workStartDate?: string
  workDurationDays: number
  contractAmount: number
  phone?: string
  note?: string
  contractItems?: ContractItem[]
  paymentSchedule?: PaymentScheduleItem[]
  barterItems?: BarterItem[]
  contractFileUrl?: string
  contractFileName?: string
}

interface ContractItem {
  id: string
  name: string
  unit: string
  estimatedQuantity: number | string
  unitPrice: number | string
  amount: number
}

interface PaymentScheduleItem {
  id: string
  paymentDate: string
  amount: number | string
  note?: string
}

interface BarterItem {
  id: string
  block: string
  apartmentNo: string
  amount: number | string
  note?: string
}

interface ContractMeta {
  contractDate: string
  workStartDate?: string
  workDurationDays: number
  contractAmount: number
  contractItems?: ContractItem[]
  paymentSchedule?: PaymentScheduleItem[]
  barterItems?: BarterItem[]
  contractFileUrl?: string
  contractFileName?: string
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
  return `Supabase schema eksik: ${tableName}. Gerekli kolonlar: contract_date, work_start_date, work_duration_days, contract_amount, contract_items, payment_schedule, barter_items. Uygulamanin bagli oldugu project ref: ${projectRef}. Lutfen ayni projede supabase/subcontractor_module.sql dosyasini tekrar calistirin.`
}

function isContractColumnCacheError(error: any) {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '')
  return (
    code === 'PGRST204' &&
    (message.includes('contract_amount') ||
      message.includes('contract_items') ||
      message.includes('payment_schedule') ||
      message.includes('barter_items') ||
      message.includes('contract_date') ||
      message.includes('work_start_date') ||
      message.includes('work_duration_days') ||
      message.includes('contractamount') ||
      message.includes('contractitems') ||
      message.includes('paymentschedule') ||
      message.includes('barteritems') ||
      message.includes('contractdate') ||
      message.includes('workstartdate') ||
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
  if (payload.barterItems.length > 0) return payload

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
  const workStartDate = String(body?.workStartDate || contractDate || '').trim()
  const workDurationDays = Math.round(Number(body?.workDurationDays || 0))
  const contractItems = normalizeContractItems(body?.contractItems)
  const paymentSchedule = normalizePaymentSchedule(body?.paymentSchedule)
  const barterItems = normalizeBarterItems(body?.barterItems)
  const contractItemsTotal = contractItems.reduce((sum, item) => sum + item.amount, 0)
  const contractAmount = Number(Number(contractItemsTotal || body?.contractAmount || 0).toFixed(2))
  const phone = String(body?.phone || '').trim()
  const note = String(body?.note || '').trim()
  const contractFileUrl = String(body?.contractFileUrl || '').trim()
  const contractFileName = String(body?.contractFileName || '').trim()
  if (!name || !workScope || !contractDate || !workStartDate) return null
  if (!Number.isFinite(workDurationDays) || workDurationDays <= 0) return null
  if (!Number.isFinite(contractAmount) || contractAmount <= 0) return null
  return {
    name,
    workScope,
    contractDate,
    workStartDate,
    workDurationDays,
    contractAmount,
    phone,
    note,
    contractItems,
    paymentSchedule,
    barterItems,
    contractFileUrl,
    contractFileName,
  }
}

function normalizeContractItems(items: any): ContractItem[] {
  if (!Array.isArray(items)) return []

  return items
    .map((item, index) => {
      const estimatedQuantity = parseDecimalNumber(item?.estimatedQuantity)
      const unitPrice = parseDecimalNumber(item?.unitPrice)
      const amount = Number((parseDecimalNumber(item?.amount) || estimatedQuantity * unitPrice || 0).toFixed(2))
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

function normalizePaymentSchedule(items: any): PaymentScheduleItem[] {
  if (!Array.isArray(items)) return []

  return items
    .map((item, index) => {
      const amount = Number(parseDecimalNumber(item?.amount).toFixed(2))
      return {
        id: String(item?.id || `payment-${Date.now()}-${index}`),
        paymentDate: String(item?.paymentDate || item?.payment_date || '').trim(),
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
        note: String(item?.note || '').trim(),
      }
    })
    .filter(item => item.paymentDate && Number(item.amount) > 0)
}

function normalizeBarterItems(items: any): BarterItem[] {
  if (!Array.isArray(items)) return []

  return items
    .map((item, index) => {
      const amount = Number(parseDecimalNumber(item?.amount).toFixed(2))
      return {
        id: String(item?.id || `barter-${Date.now()}-${index}`),
        block: String(item?.block || '').trim().toUpperCase(),
        apartmentNo: String(item?.apartmentNo || item?.apartment_no || '').trim(),
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
        note: String(item?.note || '').trim(),
      }
    })
    .filter(item => item.block && item.apartmentNo && Number(item.amount) > 0)
}

function parseDecimalNumber(value: any): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const raw = String(value || '').trim()
  if (!raw) return 0

  const normalized = raw.includes(',')
    ? raw.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.')
    : raw.replace(/\s+/g, '').replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

async function syncBarterSales(payload: ReturnType<typeof normalizeAndValidatePayload>) {
  if (!payload || payload.barterItems.length === 0) return

  for (const item of payload.barterItems) {
    const apartmentNumber = Number.parseInt(item.apartmentNo, 10)

    const { data: apartment, error: apartmentError } = await supabase
      .from('apartments')
      .select('id, block, number')
      .eq('block', item.block)
      .eq('number', apartmentNumber)
      .maybeSingle()

    if (apartmentError) throw apartmentError
    if (!apartment?.id) {
      throw new Error(`Barter dairesi bulunamadi: Blok ${item.block}, Daire ${item.apartmentNo}`)
    }

    const saleDate = new Date().toISOString()
    const customerName = formatCustomerName(`${payload.name} Barter`)

    const { data: existingSale, error: existingSaleError } = await supabase
      .from('sales')
      .select('id, customer_name')
      .eq('apartment_id', apartment.id)
      .maybeSingle()

    if (existingSaleError) throw existingSaleError

    const saleRecord = {
      apartment_id: apartment.id,
      sale_type: 'sold',
      customer_name: customerName,
      customer_phone: payload.phone,
      date: saleDate,
    }

    if (existingSale?.customer_name && existingSale.customer_name !== customerName) {
      throw new Error(
        `Barter satisi olusturulamadi: Blok ${item.block}, Daire ${item.apartmentNo} zaten ${existingSale.customer_name} adina kayitli.`
      )
    }

    if (existingSale) {
      const { error } = await supabase.from('sales').update(saleRecord).eq('apartment_id', apartment.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('sales').insert(saleRecord)
      if (error) throw error
    }

    const saleDetailRecord = {
      apartment_id: apartment.id,
      deposit_amount: Number(item.amount),
      sale_price: Number(item.amount),
      installment_months: 0,
      monthly_payment: 0,
      payments: [],
      remaining_balance: 0,
      start_date: payload.contractDate,
      payment_method: 'barter',
      custom_schedule: [],
      custom_schedule_dates: [],
      updated_at: new Date().toISOString(),
    }

    const { data: existingDetail, error: existingDetailError } = await supabase
      .from('sale_details')
      .select('id')
      .eq('apartment_id', apartment.id)
      .maybeSingle()

    if (existingDetailError) throw existingDetailError

    if (existingDetail) {
      const { error } = await supabase.from('sale_details').update(saleDetailRecord).eq('apartment_id', apartment.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('sale_details').insert(saleDetailRecord)
      if (error) throw error
    }

    await supabase.from('apartments').update({ status: 'sold' }).eq('id', apartment.id)
  }
}

async function cancelBarterSales(barterItems: BarterItem[]) {
  if (!barterItems || barterItems.length === 0) return

  for (const item of barterItems) {
    const apartmentNumber = Number.parseInt(item.apartmentNo, 10)
    if (!Number.isFinite(apartmentNumber)) continue

    const { data: apartment, error: apartmentError } = await supabase
      .from('apartments')
      .select('id')
      .eq('block', item.block)
      .eq('number', apartmentNumber)
      .maybeSingle()

    if (apartmentError || !apartment?.id) continue

    // Delete records from sales and sale_details
    await supabase.from('sales').delete().eq('apartment_id', apartment.id)
    await supabase.from('sale_details').delete().eq('apartment_id', apartment.id)

    // Update status to available
    await supabase.from('apartments').update({ status: 'available' }).eq('id', apartment.id)
  }
}

function getSubcontractorBarterItems(row: any): BarterItem[] {
  if (!row) return []
  const parsed = parsePersistedNote(row.note)
  const rowBarterItems = Array.isArray(row.barter_items) ? normalizeBarterItems(row.barter_items) : []
  const metaBarterItems = normalizeBarterItems(parsed.meta.barterItems)
  return rowBarterItems.length > 0 ? rowBarterItems : metaBarterItems
}


async function validateBarterSales(payload: ReturnType<typeof normalizeAndValidatePayload>) {
  if (!payload || payload.barterItems.length === 0) return

  for (const item of payload.barterItems) {
    await assertBarterItemCanSync(payload, item)
  }
}

async function assertBarterItemCanSync(payload: ReturnType<typeof normalizeAndValidatePayload>, item: BarterItem) {
  if (!payload) return

  const apartmentNumber = Number.parseInt(item.apartmentNo, 10)
  if (!Number.isFinite(apartmentNumber) || apartmentNumber <= 0) {
    throw new Error(`Barter daire no gecersiz: ${item.apartmentNo}`)
  }

  const { data: apartment, error: apartmentError } = await supabase
    .from('apartments')
    .select('id')
    .eq('block', item.block)
    .eq('number', apartmentNumber)
    .maybeSingle()

  if (apartmentError) throw apartmentError
  if (!apartment?.id) {
    throw new Error(`Barter dairesi bulunamadi: Blok ${item.block}, Daire ${item.apartmentNo}`)
  }

  const { data: existingSale, error: existingSaleError } = await supabase
    .from('sales')
    .select('customer_name')
    .eq('apartment_id', apartment.id)
    .maybeSingle()

  if (existingSaleError) throw existingSaleError

  const customerName = formatCustomerName(`${payload.name} Barter`)
  if (existingSale?.customer_name && existingSale.customer_name !== customerName) {
    throw new Error(
      `Barter satisi olusturulamadi: Blok ${item.block}, Daire ${item.apartmentNo} zaten ${existingSale.customer_name} adina kayitli.`
    )
  }
}

function mapRow(row: any) {
  const parsed = parsePersistedNote(row.note)
  const contractDate = row.contract_date ?? row.contractDate ?? parsed.meta.contractDate ?? ''
  const workStartDate = row.work_start_date ?? row.workStartDate ?? parsed.meta.workStartDate ?? contractDate
  const workDurationDays = row.work_duration_days ?? row.workDurationDays ?? parsed.meta.workDurationDays ?? 0
  const persistedContractAmount = row.contract_amount ?? row.contractAmount ?? parsed.meta.contractAmount ?? 0
  const rowContractItems = Array.isArray(row.contract_items) ? normalizeContractItems(row.contract_items) : []
  const metaContractItems = normalizeContractItems(parsed.meta.contractItems)
  const contractItems = rowContractItems.length > 0 ? rowContractItems : metaContractItems
  const rowPaymentSchedule = Array.isArray(row.payment_schedule) ? normalizePaymentSchedule(row.payment_schedule) : []
  const metaPaymentSchedule = normalizePaymentSchedule(parsed.meta.paymentSchedule)
  const paymentSchedule = rowPaymentSchedule.length > 0 ? rowPaymentSchedule : metaPaymentSchedule
  const rowBarterItems = Array.isArray(row.barter_items) ? normalizeBarterItems(row.barter_items) : []
  const metaBarterItems = normalizeBarterItems(parsed.meta.barterItems)
  const barterItems = rowBarterItems.length > 0 ? rowBarterItems : metaBarterItems
  const contractItemsTotal = contractItems.reduce((sum, item) => sum + item.amount, 0)
  const contractAmount = contractItemsTotal > 0 ? contractItemsTotal : persistedContractAmount
  const contractFileUrl = row.contract_file_url ?? row.contractFileUrl ?? parsed.meta.contractFileUrl ?? ''
  const contractFileName = row.contract_file_name ?? row.contractFileName ?? parsed.meta.contractFileName ?? ''
  return {
    id: row.id,
    name: row.name,
    workScope: row.work_scope ?? row.workScope ?? '',
    contractDate,
    workStartDate,
    workDurationDays,
    contractAmount,
    contractItems,
    paymentSchedule,
    barterItems,
    phone: row.phone || '',
    note: parsed.userNote,
    contractFileUrl,
    contractFileName,
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
    await validateBarterSales(payload)

        const insertPayload = {
      name: payload.name,
      work_scope: payload.workScope,
      contract_date: payload.contractDate,
      work_start_date: payload.workStartDate,
      work_duration_days: payload.workDurationDays,
      contract_amount: payload.contractAmount,
      contract_items: payload.contractItems,
      payment_schedule: payload.paymentSchedule,
      barter_items: payload.barterItems,
      phone: payload.phone,
      note: payload.note,
      contract_file_url: payload.contractFileUrl,
      contract_file_name: payload.contractFileName,
      created_at: new Date().toISOString(),
    }

    const legacyInsertPayload = {
      name: payload.name,
      work_scope: payload.workScope,
      contractDate: payload.contractDate,
      workStartDate: payload.workStartDate,
      workDurationDays: payload.workDurationDays,
      contractAmount: payload.contractAmount,
      contractItems: payload.contractItems,
      paymentSchedule: payload.paymentSchedule,
      barterItems: payload.barterItems,
      phone: payload.phone,
      note: payload.note,
      contractFileUrl: payload.contractFileUrl,
      contractFileName: payload.contractFileName,
      created_at: new Date().toISOString(),
    }

    const compatibilityInsertPayload = {
      name: payload.name,
      work_scope: payload.workScope,
      phone: payload.phone,
      note: buildPersistedNote(payload.note, {
        contractDate: payload.contractDate,
        workStartDate: payload.workStartDate,
        workDurationDays: payload.workDurationDays,
        contractAmount: payload.contractAmount,
        contractItems: payload.contractItems,
        paymentSchedule: payload.paymentSchedule,
        barterItems: payload.barterItems,
        contractFileUrl: payload.contractFileUrl,
        contractFileName: payload.contractFileName,
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

    await syncBarterSales(payload)

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
    await validateBarterSales(payload)

    const { data: oldSub } = await supabase
      .from(SUBCONTRACTORS_TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle()


        const updatePayload = {
      name: payload.name,
      work_scope: payload.workScope,
      contract_date: payload.contractDate,
      work_start_date: payload.workStartDate,
      work_duration_days: payload.workDurationDays,
      contract_amount: payload.contractAmount,
      contract_items: payload.contractItems,
      payment_schedule: payload.paymentSchedule,
      barter_items: payload.barterItems,
      phone: payload.phone,
      note: payload.note,
      contract_file_url: payload.contractFileUrl,
      contract_file_name: payload.contractFileName,
    }

    const legacyUpdatePayload = {
      name: payload.name,
      work_scope: payload.workScope,
      contractDate: payload.contractDate,
      workStartDate: payload.workStartDate,
      workDurationDays: payload.workDurationDays,
      contractAmount: payload.contractAmount,
      contractItems: payload.contractItems,
      paymentSchedule: payload.paymentSchedule,
      barterItems: payload.barterItems,
      phone: payload.phone,
      note: payload.note,
      contractFileUrl: payload.contractFileUrl,
      contractFileName: payload.contractFileName,
    }

    const compatibilityUpdatePayload = {
      name: payload.name,
      work_scope: payload.workScope,
      phone: payload.phone,
      note: buildPersistedNote(payload.note, {
        contractDate: payload.contractDate,
        workStartDate: payload.workStartDate,
        workDurationDays: payload.workDurationDays,
        contractAmount: payload.contractAmount,
        contractItems: payload.contractItems,
        paymentSchedule: payload.paymentSchedule,
        barterItems: payload.barterItems,
        contractFileUrl: payload.contractFileUrl,
        contractFileName: payload.contractFileName,
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

    if (oldSub) {
      const oldBarterItems = getSubcontractorBarterItems(oldSub)
      const newBarterItems = payload.barterItems

      const removedBarterItems = oldBarterItems.filter(
        oldItem => !newBarterItems.some(
          newItem => newItem.block === oldItem.block && newItem.apartmentNo === oldItem.apartmentNo
        )
      )

      if (removedBarterItems.length > 0) {
        await cancelBarterSales(removedBarterItems)
      }
    }

    await syncBarterSales(payload)


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

    const { data: subcontractor } = await supabase
      .from(SUBCONTRACTORS_TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (subcontractor) {
      const barterItems = getSubcontractorBarterItems(subcontractor)
      if (barterItems.length > 0) {
        await cancelBarterSales(barterItems)
      }
    }

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
