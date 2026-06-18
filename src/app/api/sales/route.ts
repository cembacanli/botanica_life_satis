import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatCustomerName } from '@/lib/customer-name'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are missing')
  }

  return createClient(url, anonKey)
}

export interface SalesRecord {
  apartmentId: string
  saleType: 'reservation' | 'deposit' | 'sold'
  customerName: string
  customerPhone: string
  date: string
}

function normalizeSaleDate(input: string) {
  const parsed = new Date(input)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()

  const match = String(input || '').match(/(\d{2})\.(\d{2})\.(\d{4})/)
  if (match) {
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)
    const year = parseInt(match[3], 10)
    const normalized = new Date(year, month - 1, day)
    if (!Number.isNaN(normalized.getTime())) return normalized.toISOString()
  }

  return new Date().toISOString()
}

export async function GET() {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const records = (data || []).map((row: any) => ({
      apartmentId: row.apartment_id,
      saleType: row.sale_type,
      customerName: formatCustomerName(row.customer_name || ''),
      customerPhone: row.customer_phone,
      date: row.date,
    }))

    return NextResponse.json(records)
  } catch (error) {
    console.error('Sales GET error:', error)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const records: SalesRecord[] = Array.isArray(body)
      ? body
      : Array.isArray(body.records)
        ? body.records
        : [body]

    for (const record of records) {
      const safeDate = normalizeSaleDate(record.date)
      const normalizedCustomerName = formatCustomerName(record.customerName)

      const { data: existing, error: existingError } = await supabase
        .from('sales')
        .select('id')
        .eq('apartment_id', record.apartmentId)
        .maybeSingle()

      if (existingError) throw existingError

      if (existing) {
        const { error: updateError } = await supabase
          .from('sales')
          .update({
            sale_type: record.saleType,
            customer_name: normalizedCustomerName,
            customer_phone: record.customerPhone,
            date: safeDate,
          })
          .eq('apartment_id', record.apartmentId)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('sales').insert({
          apartment_id: record.apartmentId,
          sale_type: record.saleType,
          customer_name: normalizedCustomerName,
          customer_phone: record.customerPhone,
          date: safeDate,
        })

        if (insertError) throw insertError
      }
    }

    const { data, error: listError } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    if (listError) throw listError

    const updated = (data || []).map((row: any) => ({
      apartmentId: row.apartment_id,
      saleType: row.sale_type,
      customerName: formatCustomerName(row.customer_name || ''),
      customerPhone: row.customer_phone,
      date: row.date,
    }))

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Sales POST error:', error)
    return NextResponse.json({ error: 'Failed to save sales records' }, { status: 500 })
  }
}

async function handleBarterCancellation(supabase: any, apartmentId: string) {
  try {
    const { data: apartment, error: aptError } = await supabase
      .from('apartments')
      .select('block, number')
      .eq('id', apartmentId)
      .maybeSingle()
    
    if (aptError || !apartment) return

    const block = String(apartment.block || '').trim().toUpperCase()
    const apartmentNo = String(apartment.number || '').trim()

    const { data: subcontractors, error: subError } = await supabase
      .from('subcontractors')
      .select('*')

    if (subError || !subcontractors) return

    for (const sub of subcontractors) {
      let hasMatch = false
      let updatedBarterItems: any[] = []

      const parsePersistedNote = (rawNote: any) => {
        const text = String(rawNote || '')
        if (!text.startsWith('@@CONTRACT_META@@')) {
          return { userNote: text, meta: {} as any }
        }
        const endIdx = text.indexOf('\n')
        const metaChunk = endIdx >= 0 ? text.slice('@@CONTRACT_META@@'.length, endIdx) : text.slice('@@CONTRACT_META@@'.length)
        const noteChunk = endIdx >= 0 ? text.slice(endIdx + 1) : ''
        try {
          const parsed = JSON.parse(metaChunk)
          return { userNote: noteChunk, meta: parsed || {} }
        } catch {
          return { userNote: text, meta: {} }
        }
      }

      const parseDecimalNumber = (value: any): number => {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0
        const raw = String(value || '').trim()
        if (!raw) return 0
        const normalized = raw.includes(',')
          ? raw.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.')
          : raw.replace(/\s+/g, '').replace(/,/g, '')
        const parsed = Number(normalized)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
      }

      const normalizeBarterItems = (items: any): any[] => {
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

      const parsed = parsePersistedNote(sub.note)
      const rowBarterItems = Array.isArray(sub.barter_items) ? normalizeBarterItems(sub.barter_items) : []
      const metaBarterItems = normalizeBarterItems(parsed.meta.barterItems)

      if (rowBarterItems.length > 0) {
        const filtered = rowBarterItems.filter(
          item => !(item.block === block && item.apartmentNo === apartmentNo)
        )
        if (filtered.length !== rowBarterItems.length) {
          hasMatch = true
          updatedBarterItems = filtered
        }
      }

      let updatedMetaBarterItems = metaBarterItems
      if (metaBarterItems.length > 0) {
        const filtered = metaBarterItems.filter(
          item => !(item.block === block && item.apartmentNo === apartmentNo)
        )
        if (filtered.length !== metaBarterItems.length) {
          hasMatch = true
          updatedMetaBarterItems = filtered
        }
      }

      if (hasMatch) {
        const updatePayload: any = {}
        
        if ('barter_items' in sub || 'barterItems' in sub) {
          const colKey = 'barter_items' in sub ? 'barter_items' : 'barterItems'
          updatePayload[colKey] = updatedBarterItems
        }
        
        const matchedItem = (rowBarterItems.length > 0 ? rowBarterItems : metaBarterItems).find(
          item => item.block === block && item.apartmentNo === apartmentNo
        )
        const amountToRestore = matchedItem ? Number(matchedItem.amount || 0) : 0
        const newContractAmount = Number(sub.contract_amount || sub.contractAmount || 0) + amountToRestore
        
        if ('contract_amount' in sub || 'contractAmount' in sub) {
          const amtKey = 'contract_amount' in sub ? 'contract_amount' : 'contractAmount'
          updatePayload[amtKey] = newContractAmount
        }

        let cleanUserNote = sub.note ? String(sub.note).split('\n').filter(line => !line.trim().startsWith('[Analiz]')).join('\n').trim() : ''

        if (sub.note && String(sub.note).startsWith('@@CONTRACT_META@@')) {
          const newMeta = {
            ...parsed.meta,
            barterItems: updatedMetaBarterItems,
            contractAmount: newContractAmount
          }
          updatePayload.note = `@@CONTRACT_META@@${JSON.stringify(newMeta)}\n${parsed.userNote}`
        } else {
          if (updatedBarterItems.length > 0) {
            const remainingAmount = updatedBarterItems.reduce((sum, item) => sum + Number(item.amount), 0)
            const aptNames = updatedBarterItems.map(item => `${item.block} Blok ${item.apartmentNo} Numaralar`).join(', ')
            const newAnalysisLine = `[Analiz] Bartir verilen daireler: ${aptNames}, Toplam satis bedeli: ${remainingAmount.toLocaleString('tr-TR')} TL, Dusum sonrasi kalan bakiye: ${newContractAmount.toLocaleString('tr-TR')} TL`
            updatePayload.note = cleanUserNote ? `${cleanUserNote}\n${newAnalysisLine}` : newAnalysisLine
          } else {
            updatePayload.note = cleanUserNote
          }
        }

        const { error: updateError } = await supabase
          .from('subcontractors')
          .update(updatePayload)
          .eq('id', sub.id)

        if (updateError) {
          console.error('Error updating subcontractor during barter cancellation:', updateError)
        }
        break
      }
    }
  } catch (err) {
    console.error('Barter cancellation handler error:', err)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const apartmentId = body?.apartmentId
    if (!apartmentId) {
      return NextResponse.json({ error: 'apartmentId required' }, { status: 400 })
    }

    // Handle subcontractor barter item cleanup first
    await handleBarterCancellation(supabase, apartmentId)

    const { error: deleteError } = await supabase.from('sales').delete().eq('apartment_id', apartmentId)
    if (deleteError) throw deleteError

    const { data, error: listError } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    if (listError) throw listError

    const updated = (data || []).map((row: any) => ({
      apartmentId: row.apartment_id,
      saleType: row.sale_type,
      customerName: formatCustomerName(row.customer_name || ''),
      customerPhone: row.customer_phone,
      date: row.date,
    }))

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Sales DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete sales record' }, { status: 500 })
  }
}
