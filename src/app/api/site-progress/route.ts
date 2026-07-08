import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const LOCAL_DATA_DIR = path.join(process.cwd(), 'public', 'data')
const LOCAL_JSON_FILE = path.join(LOCAL_DATA_DIR, 'site_progress.json')
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'progress')

async function ensureDir(dirPath: string) {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch (err) {
    // Ignore if it already exists
  }
}

async function readLocalProgress(): Promise<any[]> {
  try {
    await ensureDir(LOCAL_DATA_DIR)
    const content = await readFile(LOCAL_JSON_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    return []
  }
}

async function writeLocalProgress(data: any[]) {
  await ensureDir(LOCAL_DATA_DIR)
  await writeFile(LOCAL_JSON_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

function isTableMissingError(error: any) {
  const message = String(error?.message || '')
  const code = String(error?.code || '')
  return code === 'PGRST205' || message.toLowerCase().includes("could not find the table 'public.site_progress'")
}

export async function GET() {
  try {
    // Try Supabase first
    const { data, error } = await supabase
      .from('site_progress')
      .select('*')
      .order('date', { ascending: false })

    if (error) {
      if (isTableMissingError(error)) {
        console.log('Supabase site_progress table not found, falling back to local JSON')
        const localData = await readLocalProgress()
        return NextResponse.json(localData)
      }
      throw error
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Get progress error, falling back to local:', error)
    const localData = await readLocalProgress()
    return NextResponse.json(localData)
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const block = formData.get('block') as string || 'general'
    const title = formData.get('title') as string || ''
    const description = formData.get('description') as string || ''
    const progressPercent = Number(formData.get('progress_percent') || 0)
    const date = formData.get('date') as string || new Date().toISOString().slice(0, 10)
    const file = formData.get('file') as File | null

    let imageUrl = ''

    if (file && file.size > 0) {
      await ensureDir(UPLOADS_DIR)
      const buffer = Buffer.from(await file.arrayBuffer())
      const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const filePath = path.join(UPLOADS_DIR, uniqueFilename)
      await writeFile(filePath, buffer)
      imageUrl = `/uploads/progress/${uniqueFilename}`
    }

    const payload = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      block,
      title,
      description,
      progress_percent: progressPercent,
      image_url: imageUrl,
      date,
      created_at: new Date().toISOString()
    }

    // Try Supabase
    try {
      const { data, error } = await supabase
        .from('site_progress')
        .insert([payload])
        .select()

      if (error) {
        if (isTableMissingError(error)) {
          // Table doesn't exist, write to local JSON
          const localData = await readLocalProgress()
          localData.push(payload)
          // Sort by date desc
          localData.sort((a, b) => b.date.localeCompare(a.date))
          await writeLocalProgress(localData)
          return NextResponse.json({ success: true, source: 'local', data: payload })
        }
        throw error
      }

      return NextResponse.json({ success: true, source: 'supabase', data: data?.[0] || payload })
    } catch (dbError) {
      console.warn('Supabase insert failed, saving locally:', dbError)
      const localData = await readLocalProgress()
      localData.push(payload)
      localData.sort((a, b) => b.date.localeCompare(a.date))
      await writeLocalProgress(localData)
      return NextResponse.json({ success: true, source: 'local', data: payload })
    }
  } catch (error: any) {
    console.error('POST progress error:', error)
    return NextResponse.json({ error: error.message || 'Failed to save progress entry' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing entry id' }, { status: 400 })
    }

    // Try Supabase
    try {
      const { error } = await supabase
        .from('site_progress')
        .delete()
        .eq('id', id)

      if (error && !isTableMissingError(error)) {
        throw error
      }
    } catch (dbError) {
      console.warn('Supabase delete failed, removing locally:', dbError)
    }

    // Always remove from local JSON as fallback/mirror
    const localData = await readLocalProgress()
    const updated = localData.filter((item: any) => item.id !== id)
    await writeLocalProgress(updated)

    return NextResponse.json({ success: true, id })
  } catch (error: any) {
    console.error('DELETE progress error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete progress entry' }, { status: 500 })
  }
}
