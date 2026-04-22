import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

async function readTableCount(table: string) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (error) {
    throw error
  }

  return count || 0
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const tokenParam = request.nextUrl.searchParams.get('token')
  const secret = process.env.CRON_SECRET

  if (!secret || (authHeader !== `Bearer ${secret}` && tokenParam !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [apartmentsCount, salesCount, saleDetailsCount] = await Promise.all([
      readTableCount('apartments'),
      readTableCount('sales'),
      readTableCount('sale_details'),
    ])

    return NextResponse.json({
      ok: true,
      source: 'vercel-cron',
      checkedAt: new Date().toISOString(),
      counts: {
        apartments: apartmentsCount,
        sales: salesCount,
        saleDetails: saleDetailsCount,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Keepalive failed'
    console.error('Keepalive error:', error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
