import { supabase } from '@/lib/supabase'
import { generateApartments, type Apartment } from '@/lib/data-generator'

const APARTMENTS_TABLE = 'apartments'

interface ApartmentRow {
  id: string
  block: 'A' | 'B' | 'C' | 'D'
  floor: number
  number: number
  facade: 'ana_yol' | 'arka_cephe'
  area: number
  type: string
  price: number
  status: 'available' | 'reserved' | 'deposited' | 'sold' | null
  created_at: string | null
}

function mapApartmentRow(row: ApartmentRow): Apartment {
  return {
    id: row.id,
    block: row.block,
    floor: row.floor,
    number: row.number,
    facade: row.facade,
    area: row.area,
    type: row.type,
    price: row.price,
    status: row.status || 'available',
    created_at: row.created_at || new Date().toISOString(),
  }
}

export async function ensureApartmentsSeeded() {
  const { data, error } = await supabase.from(APARTMENTS_TABLE).select('id').limit(1)
  if (error) throw error
  if (data && data.length > 0) return

  const generated = generateApartments().map((apt, idx) => ({
    id: `apt-${idx}`,
    block: apt.block,
    floor: apt.floor,
    number: apt.number,
    facade: apt.facade,
    area: apt.area,
    type: apt.type,
    price: apt.price,
    status: apt.status,
    created_at: new Date().toISOString(),
  }))

  const { error: insertError } = await supabase.from(APARTMENTS_TABLE).insert(generated)
  if (insertError) throw insertError
}

export async function listApartments(filters?: {
  block?: string | null
  floor?: string | null
  facade?: string | null
}) {
  await ensureApartmentsSeeded()

  let query = supabase
    .from(APARTMENTS_TABLE)
    .select('id, block, floor, number, facade, area, type, price, status, created_at')
    .order('block', { ascending: true })
    .order('number', { ascending: true })

  if (filters?.block) query = query.eq('block', filters.block)
  if (filters?.floor) query = query.eq('floor', Number.parseInt(filters.floor, 10))
  if (filters?.facade) query = query.eq('facade', filters.facade)

  const { data, error } = await query
  if (error) throw error

  return ((data || []) as ApartmentRow[]).map(mapApartmentRow)
}

export async function getApartmentStats() {
  await ensureApartmentsSeeded()

  const { count, error } = await supabase
    .from(APARTMENTS_TABLE)
    .select('*', { count: 'exact', head: true })

  if (error) throw error

  return {
    totalApartments: count || 0,
    blocks: {
      'A-B': '60 daire (2+1, 90m²)',
      'C-D': '120 daire (1+1, 45m²)',
    },
  }
}
