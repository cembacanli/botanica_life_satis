import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ClaimStatus } from '@/lib/subcontractor-claims-store'

const SUBCONTRACTOR_CLAIMS_TABLE = 'subcontractor_claims'
const allowedStatuses = new Set<ClaimStatus>(['taslak', 'onaylandi', 'odendi'])

interface ClaimPayload {
  id?: string
  subcontractorId: string
  subcontractorName: string
  workItem: string
  contractAmount: number
  progressPercent: number
  previousPaidAmount: number
  currentClaimAmount: number
  deductionAmount: number
  claimDate: string
  status: ClaimStatus
  note?: string
}

function getActorUsername(request: NextRequest) {
  return String(request.headers.get('x-actor-username') || '').trim().toLocaleLowerCase('tr-TR')
}

function isClaimsSchemaUnavailable(error: any) {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '')
  return (
    code === 'PGRST205' ||
    message.includes("could not find the table 'public.subcontractor_claims'") ||
    message.includes('subcontractor_id') ||
    message.includes('subcontractor_name')
  )
}

function getSchemaErrorMessage() {
  return 'Supabase tablo/kolon yapisi eksik veya erisilemez: subcontractor_claims. Lutfen supabase/subcontractor_module.sql dosyasini Supabase SQL Editor uzerinden calistirin.'
}

function normalizeAndValidatePayload(body: ClaimPayload) {
  const subcontractorId = String(body?.subcontractorId || '').trim()
  const subcontractorName = String(body?.subcontractorName || '').trim()
  const workItem = String(body?.workItem || '').trim()
  const contractAmount = Math.round(Number(body?.contractAmount || 0))
  const progressPercent = Number(body?.progressPercent || 0)
  const previousPaidAmount = Math.round(Number(body?.previousPaidAmount || 0))
  const currentClaimAmount = Math.round(Number(body?.currentClaimAmount || 0))
  const deductionAmount = Math.round(Number(body?.deductionAmount || 0))
  const claimDate = String(body?.claimDate || '').trim()
  const status = String(body?.status || '').trim() as ClaimStatus
  const note = String(body?.note || '').trim()

  if (!subcontractorId || !subcontractorName || !workItem || !claimDate) return null
  if (!Number.isFinite(contractAmount) || contractAmount <= 0) return null
  if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) return null
  if (!Number.isFinite(previousPaidAmount) || previousPaidAmount < 0) return null
  if (!Number.isFinite(currentClaimAmount) || currentClaimAmount <= 0) return null
  if (!Number.isFinite(deductionAmount) || deductionAmount < 0) return null
  if (!allowedStatuses.has(status)) return null

  const completedAmount = Math.round((contractAmount * progressPercent) / 100)
  const netPayableAmount = Math.max(currentClaimAmount - deductionAmount, 0)

  return {
    subcontractorId,
    subcontractorName,
    workItem,
    contractAmount,
    progressPercent,
    completedAmount,
    previousPaidAmount,
    currentClaimAmount,
    deductionAmount,
    netPayableAmount,
    claimDate,
    status,
    note,
  }
}

function mapRow(row: any) {
  return {
    id: row.id,
    subcontractorId: row.subcontractor_id,
    subcontractorName: row.subcontractor_name,
    workItem: row.work_item,
    contractAmount: row.contract_amount || 0,
    progressPercent: row.progress_percent || 0,
    completedAmount: row.completed_amount || 0,
    previousPaidAmount: row.previous_paid_amount || 0,
    currentClaimAmount: row.current_claim_amount || 0,
    deductionAmount: row.deduction_amount || 0,
    netPayableAmount: row.net_payable_amount || 0,
    claimDate: row.claim_date,
    status: row.status as ClaimStatus,
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const subcontractorIdFilter = String(request.nextUrl.searchParams.get('subcontractorId') || '').trim()

    const query = supabase
      .from(SUBCONTRACTOR_CLAIMS_TABLE)
      .select('*')
      .order('claim_date', { ascending: false })
      .order('created_at', { ascending: false })

    const { data, error } = subcontractorIdFilter
      ? await query.eq('subcontractor_id', subcontractorIdFilter)
      : await query

    if (error) {
      if (isClaimsSchemaUnavailable(error)) {
        return NextResponse.json({ error: getSchemaErrorMessage() }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json((data || []).map(mapRow))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractor claims fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = normalizeAndValidatePayload((await request.json()) as ClaimPayload)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const insertPayload = {
      subcontractor_id: payload.subcontractorId,
      subcontractor_name: payload.subcontractorName,
      work_item: payload.workItem,
      contract_amount: payload.contractAmount,
      progress_percent: payload.progressPercent,
      completed_amount: payload.completedAmount,
      previous_paid_amount: payload.previousPaidAmount,
      current_claim_amount: payload.currentClaimAmount,
      deduction_amount: payload.deductionAmount,
      net_payable_amount: payload.netPayableAmount,
      claim_date: payload.claimDate,
      status: payload.status,
      note: payload.note,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from(SUBCONTRACTOR_CLAIMS_TABLE)
      .insert(insertPayload)
      .select('*')
      .single()

    if (error) {
      if (isClaimsSchemaUnavailable(error)) {
        return NextResponse.json({ error: getSchemaErrorMessage() }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(mapRow(data))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractor claim create failed'
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

    const body = (await request.json()) as ClaimPayload
    const id = String(body?.id || '').trim()
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const payload = normalizeAndValidatePayload(body)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const updatePayload = {
      subcontractor_id: payload.subcontractorId,
      subcontractor_name: payload.subcontractorName,
      work_item: payload.workItem,
      contract_amount: payload.contractAmount,
      progress_percent: payload.progressPercent,
      completed_amount: payload.completedAmount,
      previous_paid_amount: payload.previousPaidAmount,
      current_claim_amount: payload.currentClaimAmount,
      deduction_amount: payload.deductionAmount,
      net_payable_amount: payload.netPayableAmount,
      claim_date: payload.claimDate,
      status: payload.status,
      note: payload.note,
    }

    const { data, error } = await supabase
      .from(SUBCONTRACTOR_CLAIMS_TABLE)
      .update(updatePayload)
      .eq('id', id)
      .select('*')

    if (error) {
      if (isClaimsSchemaUnavailable(error)) {
        return NextResponse.json({ error: getSchemaErrorMessage() }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Kayit bulunamadi veya veritabani update policy izin vermiyor.' },
        { status: 404 }
      )
    }

    return NextResponse.json(mapRow(data[0]))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractor claim update failed'
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
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { error } = await supabase.from(SUBCONTRACTOR_CLAIMS_TABLE).delete().eq('id', id)
    if (error) {
      if (isClaimsSchemaUnavailable(error)) {
        return NextResponse.json({ error: getSchemaErrorMessage() }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subcontractor claim delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
