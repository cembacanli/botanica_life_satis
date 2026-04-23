'use client'

import { useEffect, useMemo, useState } from 'react'

type Material = {
  id: string
  code: string
  name: string
  length: number
  height: number
  thickness: number
  unitPrice: number
}

type Deduction = {
  id: string
  name: string
  width: number
  height: number
  count: number
}

type Wall = {
  id: string
  name: string
  length: number
  count: number
  thickness: number
  topType: 'beam' | 'slab'
  faceCount: 1 | 2
  materialId: string
  deductions: Deduction[]
}

type ProjectSettings = {
  projectName: string
  floorHeight: number
  beamHeight: number
  slabThickness: number
}

type MortarSettings = {
  wasteRate: number
  cementPerM3: number
  sandPerM3: number
  limePerM3: number
  cementPrice: number
  sandPrice: number
  limePrice: number
}

type MaterialSummaryItem = {
  code: string
  name: string
  area: number
  units: number
  unitPrice: number
  materialCost: number
  costPerSquareMeter: number
}

type MortarItem = {
  label: string
  amount: number
  unit: string
  unitPrice: number
  totalCost: number
  note: string
}

type SavedProject = {
  id: string
  projectName: string
  project: ProjectSettings
  mortar: MortarSettings
  materials: Material[]
  walls: Wall[]
  username: string
  createdAt: string
  updatedAt: string
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const defaultMaterials: Material[] = [
  { id: createId(), code: 'BIMS-25', name: '25 Bims', length: 39, height: 19, thickness: 25, unitPrice: 0 },
  { id: createId(), code: 'BIMS-20', name: '20 Bims', length: 39, height: 19, thickness: 20, unitPrice: 0 },
  { id: createId(), code: 'BIMS-15', name: '15 Bims', length: 39, height: 19, thickness: 15, unitPrice: 0 },
  { id: createId(), code: 'BIMS-10', name: '10 Bims', length: 39, height: 19, thickness: 10, unitPrice: 0 },
  { id: createId(), code: 'TUG-135', name: '13,5 Tuğla', length: 19, height: 19, thickness: 13.5, unitPrice: 0 },
  { id: createId(), code: 'TUG-85', name: '8,5 Tuğla', length: 19, height: 19, thickness: 8.5, unitPrice: 0 },
]

const defaultProjectSettings: ProjectSettings = {
  projectName: '',
  floorHeight: 300,
  beamHeight: 50,
  slabThickness: 15,
}

const defaultMortarSettings: MortarSettings = {
  wasteRate: 10,
  cementPerM3: 250,
  sandPerM3: 1,
  limePerM3: 70,
  cementPrice: 4.5,
  sandPrice: 650,
  limePrice: 3.2,
}

const mortarCoefficients = [
  { thickness: 25, coefficient: 0.034, label: '25 cm bims' },
  { thickness: 20, coefficient: 0.027, label: '20 cm bims' },
  { thickness: 15, coefficient: 0.02, label: '15 cm bims' },
  { thickness: 10, coefficient: 0.014, label: '10 cm bims' },
  { thickness: 13.5, coefficient: 0.02, label: '13.5 cm tuğla' },
  { thickness: 8.5, coefficient: 0.013, label: '8.5 cm tuğla' },
]

function createWall(materials: Material[]): Wall {
  const matched = materials.find(material => Math.abs(material.thickness - 10) < 0.2)
  return {
    id: createId(),
    name: '',
    length: 0,
    count: 1,
    thickness: 10,
    topType: 'beam',
    faceCount: 1,
    materialId: matched?.id || '',
    deductions: [],
  }
}

function createDeduction(): Deduction {
  return {
    id: createId(),
    name: '',
    width: 0,
    height: 0,
    count: 1,
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function formatArea(value: number) {
  return `${formatMoney(value)} m²`
}

function formatVolume(value: number) {
  return `${formatMoney(value)} m³`
}

function getMortarCoefficient(thickness: number) {
  const exact = mortarCoefficients.find(item => Math.abs(item.thickness - thickness) < 0.2)
  if (exact) return exact
  if (thickness <= 0) return null

  return {
    thickness,
    coefficient: thickness * 0.00135,
    label: `${formatMoney(thickness)} cm duvar`,
  }
}

function getUnitVolume(material: Material) {
  return (material.length / 100) * (material.height / 100) * (material.thickness / 100)
}

export default function WallMaterialCalculator({ username = '' }: { username?: string }) {
  const [project, setProject] = useState<ProjectSettings>(defaultProjectSettings)
  const [mortar, setMortar] = useState<MortarSettings>(defaultMortarSettings)
  const [materials, setMaterials] = useState<Material[]>(defaultMaterials)
  const [walls, setWalls] = useState<Wall[]>([createWall(defaultMaterials)])
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'loading'>('idle')
  const [serverMessage, setServerMessage] = useState('')

  useEffect(() => {
    const loadProjects = async () => {
      setSaveState('loading')
      try {
        const response = await fetch('/api/material-procurement-projects')
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Kayıtlar yüklenemedi.')
        }
        setSavedProjects(Array.isArray(data) ? data : [])
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Kayıtlar yüklenemedi.'
        setServerMessage(message)
      } finally {
        setSaveState('idle')
      }
    }

    loadProjects()
  }, [])

  const calculations = useMemo(() => {
    let grossTotal = 0
    let deductionTotal = 0
    let netTotal = 0
    let plasterTotal = 0
    let volumeTotal = 0
    let materialCostTotal = 0
    let mortarBaseVolumeTotal = 0
    let unselectedWallCount = 0

    const materialMap = new Map<string, MaterialSummaryItem>()

    const wallRows = walls.map((wall, index) => {
      const computedHeightCm =
        wall.topType === 'beam'
          ? Math.max(project.floorHeight - project.beamHeight, 0)
          : Math.max(project.floorHeight - project.slabThickness, 0)

      const grossArea = (wall.length / 100) * (computedHeightCm / 100) * wall.count
      const wallDeductionTotal = wall.deductions.reduce((sum, deduction) => {
        return sum + (deduction.width / 100) * (deduction.height / 100) * deduction.count
      }, 0)
      const netArea = Math.max(grossArea - wallDeductionTotal, 0)
      const plasterArea = netArea * wall.faceCount
      const wallVolume = netArea * (wall.thickness / 100)
      const mortarCoefficient = getMortarCoefficient(wall.thickness)
      const mortarBaseVolume = mortarCoefficient ? netArea * mortarCoefficient.coefficient : 0

      const selectedMaterial = materials.find(material => material.id === wall.materialId)
      const unitCount =
        selectedMaterial && getUnitVolume(selectedMaterial) > 0
          ? Math.ceil(wallVolume / getUnitVolume(selectedMaterial))
          : 0
      const rowMaterialCost = selectedMaterial ? unitCount * selectedMaterial.unitPrice : 0

      grossTotal += grossArea
      deductionTotal += wallDeductionTotal
      netTotal += netArea
      plasterTotal += plasterArea
      volumeTotal += wallVolume
      mortarBaseVolumeTotal += mortarBaseVolume
      materialCostTotal += rowMaterialCost

      if (selectedMaterial && unitCount > 0) {
        const current = materialMap.get(selectedMaterial.id) || {
          code: selectedMaterial.code,
          name: selectedMaterial.name,
          area: 0,
          units: 0,
          unitPrice: selectedMaterial.unitPrice,
          materialCost: 0,
          costPerSquareMeter: 0,
        }
        current.area += netArea
        current.units += unitCount
        current.materialCost += rowMaterialCost
        current.unitPrice = selectedMaterial.unitPrice
        materialMap.set(selectedMaterial.id, current)
      } else if (netArea > 0) {
        unselectedWallCount += 1
      }

      return {
        id: wall.id,
        order: index + 1,
        name: wall.name || `Duvar ${index + 1}`,
        heightCm: computedHeightCm,
        grossArea,
        deductionArea: wallDeductionTotal,
        netArea,
        plasterArea,
        unitCount,
      }
    })

    const wasteFactor = 1 + mortar.wasteRate / 100
    const mortarVolume = mortarBaseVolumeTotal * wasteFactor
    const cementKg = mortarVolume * mortar.cementPerM3
    const sandM3 = mortarVolume * mortar.sandPerM3
    const limeKg = mortarVolume * mortar.limePerM3
    const cementCost = cementKg * mortar.cementPrice
    const sandCost = sandM3 * mortar.sandPrice
    const limeCost = limeKg * mortar.limePrice
    const mortarCost = cementCost + sandCost + limeCost

    const mortarItems: MortarItem[] =
      mortarVolume > 0
        ? [
            {
              label: 'Çimento',
              amount: cementKg,
              unit: 'kg',
              unitPrice: mortar.cementPrice,
              totalCost: cementCost,
              note: 'Kalınlık katsayısına ve fireye göre hesaplandı',
            },
            {
              label: 'Kum',
              amount: sandM3,
              unit: 'm³',
              unitPrice: mortar.sandPrice,
              totalCost: sandCost,
              note: 'Toplam harç hacmi üzerinden',
            },
            {
              label: 'Kireç',
              amount: limeKg,
              unit: 'kg',
              unitPrice: mortar.limePrice,
              totalCost: limeCost,
              note: 'Toplam harç hacmi üzerinden',
            },
          ]
        : []

    const materialSummary = Array.from(materialMap.values()).map(item => {
      const mortarShare = netTotal > 0 ? (item.area / netTotal) * mortarCost : 0
      return {
        ...item,
        costPerSquareMeter: item.area > 0 ? (item.materialCost + mortarShare) / item.area : 0,
      }
    })

    const materialSummaryLine = materialSummary
      .map(item => `${item.name}: ${formatMoney(item.area)} m² / ${item.units} adet`)
      .join(' | ')

    const reportParts: string[] = []
    if (walls.length === 0) {
      reportParts.push('Henüz veri girilmedi.')
    } else {
      if (project.projectName.trim()) {
        reportParts.push(`${project.projectName.trim()} için hesap özeti hazır.`)
      }
      reportParts.push(`${walls.length} duvar ve ${walls.reduce((sum, wall) => sum + wall.deductions.length, 0)} minha girişi üzerinden hesap yapıldı.`)
      reportParts.push(`Net duvar metrajı ${formatMoney(netTotal)} m², alçı sıva metrajı ${formatMoney(plasterTotal)} m² bulundu.`)
      reportParts.push(`Net duvar hacmi ${formatMoney(volumeTotal)} m³ bulundu.`)
      reportParts.push(`Tahmini harç hacmi ${formatMoney(mortarVolume)} m³, çimento ${formatMoney(cementKg)} kg, kum ${formatMoney(sandM3)} m³, kireç ${formatMoney(limeKg)} kg bulundu.`)
      if (materialSummaryLine) {
        reportParts.push(`Malzeme bazlı özet: ${materialSummaryLine}.`)
      }
      reportParts.push(`Toplam malzeme maliyeti ${formatMoney(materialCostTotal)} TL, harç maliyeti ${formatMoney(mortarCost)} TL.`)
      if (unselectedWallCount > 0) {
        reportParts.push(`${unselectedWallCount} duvarda malzeme seçimi olmadığı için sipariş hesabına dahil edilmedi.`)
      }
    }

    return {
      wallRows,
      grossTotal,
      deductionTotal,
      netTotal,
      plasterTotal,
      volumeTotal,
      materialCostTotal,
      mortarVolume,
      mortarCost,
      mortarItems,
      materialSummary,
      reportText: reportParts.join(' '),
      orderSummary: `${walls.length} duvar, ${walls.reduce((sum, wall) => sum + wall.deductions.length, 0)} minha, net ${formatMoney(netTotal)} m²`,
    }
  }, [materials, mortar, project, walls])

  const updateProject = <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) => {
    setProject(prev => ({ ...prev, [key]: value }))
  }

  const updateMortar = <K extends keyof MortarSettings>(key: K, value: MortarSettings[K]) => {
    setMortar(prev => ({ ...prev, [key]: value }))
  }

  const addMaterial = () => {
    setMaterials(prev => [
      ...prev,
      { id: createId(), code: '', name: '', length: 39, height: 19, thickness: 10, unitPrice: 0 },
    ])
  }

  const updateMaterial = (materialId: string, field: keyof Material, value: string | number) => {
    setMaterials(prev =>
      prev.map(material => (material.id === materialId ? { ...material, [field]: value } : material))
    )

    if (field === 'thickness') {
      const numericThickness = Number(value)
      setWalls(prev =>
        prev.map(wall => {
          if (wall.materialId !== materialId) return wall
          return { ...wall, thickness: numericThickness }
        })
      )
    }
  }

  const removeMaterial = (materialId: string) => {
    setMaterials(prev => prev.filter(material => material.id !== materialId))
    setWalls(prev =>
      prev.map(wall => (wall.materialId === materialId ? { ...wall, materialId: '' } : wall))
    )
  }

  const addWall = () => {
    setWalls(prev => [...prev, createWall(materials)])
  }

  const updateWall = (wallId: string, field: keyof Wall, value: string | number) => {
    setWalls(prev =>
      prev.map(wall => {
        if (wall.id !== wallId) return wall

        const updated = { ...wall, [field]: value }

        if (field === 'thickness') {
          const numericThickness = Number(value)
          const matches = materials.filter(material => Math.abs(material.thickness - numericThickness) < 0.2)
          if (matches.length === 1) {
            updated.materialId = matches[0].id
          }
        }

        return updated
      })
    )
  }

  const removeWall = (wallId: string) => {
    setWalls(prev => prev.filter(wall => wall.id !== wallId))
  }

  const addDeduction = (wallId: string) => {
    setWalls(prev =>
      prev.map(wall =>
        wall.id === wallId ? { ...wall, deductions: [...wall.deductions, createDeduction()] } : wall
      )
    )
  }

  const updateDeduction = (
    wallId: string,
    deductionId: string,
    field: keyof Deduction,
    value: string | number
  ) => {
    setWalls(prev =>
      prev.map(wall =>
        wall.id !== wallId
          ? wall
          : {
              ...wall,
              deductions: wall.deductions.map(deduction =>
                deduction.id === deductionId ? { ...deduction, [field]: value } : deduction
              ),
            }
      )
    )
  }

  const removeDeduction = (wallId: string, deductionId: string) => {
    setWalls(prev =>
      prev.map(wall =>
        wall.id === wallId
          ? { ...wall, deductions: wall.deductions.filter(deduction => deduction.id !== deductionId) }
          : wall
      )
    )
  }

  const fillDemo = () => {
    const seededMaterials = defaultMaterials.map(material => ({ ...material, id: createId() }))
    const bims10 = seededMaterials.find(material => material.code === 'BIMS-10')?.id || ''
    const tugla135 = seededMaterials.find(material => material.code === 'TUG-135')?.id || ''

    setProject({
      projectName: 'Botanica Örnek Blok',
      floorHeight: 320,
      beamHeight: 60,
      slabThickness: 12,
    })

    setMaterials(seededMaterials)
    setWalls([
      {
        id: createId(),
        name: 'Salon kuzey duvarı',
        length: 520,
        count: 1,
        thickness: 10,
        topType: 'beam',
        faceCount: 2,
        materialId: bims10,
        deductions: [
          { id: createId(), name: 'Pencere 150x140', width: 150, height: 140, count: 2 },
        ],
      },
      {
        id: createId(),
        name: 'Salon doğu duvarı',
        length: 380,
        count: 1,
        thickness: 13.5,
        topType: 'slab',
        faceCount: 2,
        materialId: tugla135,
        deductions: [{ id: createId(), name: 'Kapı 90x210', width: 90, height: 210, count: 1 }],
      },
    ])
  }

  const loadSavedProject = (savedProject: SavedProject) => {
    setProject(savedProject.project || defaultProjectSettings)
    setMortar(savedProject.mortar || defaultMortarSettings)
    setMaterials(Array.isArray(savedProject.materials) && savedProject.materials.length ? savedProject.materials : defaultMaterials)
    setWalls(Array.isArray(savedProject.walls) && savedProject.walls.length ? savedProject.walls : [createWall(savedProject.materials || defaultMaterials)])
    setActiveProjectId(savedProject.id)
    setServerMessage(`"${savedProject.projectName}" projesi Supabase üzerinden yüklendi.`)
  }

  const refreshSavedProjects = async (nextActiveId?: string | null) => {
    const response = await fetch('/api/material-procurement-projects')
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Kayıtlar yenilenemedi.')
    }
    const nextProjects = Array.isArray(data) ? data : []
    setSavedProjects(nextProjects)
    if (typeof nextActiveId !== 'undefined') {
      setActiveProjectId(nextActiveId)
    }
    return nextProjects
  }

  const saveProjectToSupabase = async () => {
    if (!project.projectName.trim()) {
      setServerMessage('Supabase kaydı için önce proje adı girin.')
      return
    }

    setSaveState('saving')
    setServerMessage('')

    try {
      const payload = {
        id: activeProjectId || undefined,
        project,
        mortar,
        materials,
        walls,
        username,
      }

      const response = await fetch('/api/material-procurement-projects', {
        method: activeProjectId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Kayıt işlemi başarısız.')
      }

      await refreshSavedProjects(data.id)
      setServerMessage(`"${data.projectName}" projesi Supabase'e kaydedildi.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kayıt işlemi başarısız.'
      setServerMessage(message)
    } finally {
      setSaveState('idle')
    }
  }

  const deleteSavedProject = async (projectId: string) => {
    const target = savedProjects.find(item => item.id === projectId)
    const confirmed = window.confirm(`"${target?.projectName || 'Bu kayıt'}" Supabase'den silinsin mi?`)
    if (!confirmed) return

    setSaveState('saving')
    setServerMessage('')
    try {
      const response = await fetch('/api/material-procurement-projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Silme işlemi başarısız.')
      }

      await refreshSavedProjects(activeProjectId === projectId ? null : activeProjectId)
      if (activeProjectId === projectId) {
        setActiveProjectId(null)
      }
      setServerMessage('Supabase kaydı silindi.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Silme işlemi başarısız.'
      setServerMessage(message)
    } finally {
      setSaveState('idle')
    }
  }

  const printOrderSheet = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=900')
    if (!printWindow) return

    const materialRows =
      calculations.materialSummary.length > 0
        ? calculations.materialSummary
            .map(
              item => `
                <tr>
                  <td>${item.code}</td>
                  <td>${item.name}</td>
                  <td>${formatMoney(item.area)} m²</td>
                  <td>${item.units} adet</td>
                  <td>${formatMoney(item.unitPrice)}</td>
                  <td>${formatMoney(item.costPerSquareMeter)}</td>
                </tr>
              `
            )
            .join('')
        : '<tr><td colspan="6">Henüz malzeme sipariş listesi oluşmadı.</td></tr>'

    const mortarRows =
      calculations.mortarItems.length > 0
        ? calculations.mortarItems
            .map(
              item => `
                <tr>
                  <td>${item.label}</td>
                  <td>${formatMoney(item.amount)} ${item.unit}</td>
                  <td>${formatMoney(item.unitPrice)}</td>
                  <td>${formatMoney(item.totalCost)}</td>
                </tr>
              `
            )
            .join('')
        : '<tr><td colspan="4">Henüz harç sipariş listesi oluşmadı.</td></tr>'

    printWindow.document.write(`
      <html lang="tr">
        <head>
          <title>Cem BACANLI - Sipariş Listesi</title>
          <style>
            body { font-family: Arial, sans-serif; color: #1f2937; padding: 32px; }
            h1, h2, h3, p { margin: 0; }
            .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
            .meta { text-align: right; color: #6b7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 24px; }
            th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; font-size: 14px; }
            th { background: #f3f4f6; }
            .totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 24px; }
            .box { border: 1px solid #d1d5db; border-radius: 12px; padding: 14px; }
            .label { color: #6b7280; font-size: 12px; margin-bottom: 6px; text-transform: uppercase; }
            .value { font-size: 20px; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="head">
            <div>
              <h1>Cem BACANLI - Sipariş Listesi</h1>
              <p style="margin-top:8px;">${project.projectName.trim() || 'Proje adı girilmedi.'}</p>
            </div>
            <div class="meta">
              <div>${new Date().toLocaleDateString('tr-TR')}</div>
              <div style="margin-top:8px;">${calculations.orderSummary}</div>
            </div>
          </div>

          <h3>Duvar Malzemeleri</h3>
          <table>
            <thead>
              <tr>
                <th>Kod</th>
                <th>Malzeme Adı</th>
                <th>Metraj</th>
                <th>Adet</th>
                <th>Birim Fiyat</th>
                <th>1 m² Maliyet</th>
              </tr>
            </thead>
            <tbody>${materialRows}</tbody>
          </table>

          <h3>Harç Kalemleri</h3>
          <table>
            <thead>
              <tr>
                <th>Kalem</th>
                <th>Miktar</th>
                <th>Birim Fiyat</th>
                <th>Toplam Maliyet</th>
              </tr>
            </thead>
            <tbody>${mortarRows}</tbody>
          </table>

          <div class="totals">
            <div class="box"><div class="label">Net Duvar</div><div class="value">${formatMoney(calculations.netTotal)} m²</div></div>
            <div class="box"><div class="label">Malzeme Maliyeti</div><div class="value">${formatMoney(calculations.materialCostTotal)}</div></div>
            <div class="box"><div class="label">Harç Maliyeti</div><div class="value">${formatMoney(calculations.mortarCost)}</div></div>
            <div class="box"><div class="label">Genel Toplam</div><div class="value">${formatMoney(calculations.materialCostTotal + calculations.mortarCost)}</div></div>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 p-6 text-white shadow-sm ring-1 ring-white/10">
        <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-white/80">
          1. MALZEME ALIM MODÜLÜ
        </div>
        <h2 className="mt-4 text-3xl font-bold">Duvar Metraj Malzeme Hesap Programı</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-white/80">
          Duvar metrajı, minha, alçı sıva, malzeme siparişi, harç hesabı ve maliyet özetini tek ekranda yönetin.
          Tüm girişler santimetre bazında yapılır; sonuçlar m² ve m³ olarak üretilir.
        </p>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-stone-900">Supabase Proje Kayıtları</h3>
            <p className="mt-1 text-sm text-stone-500">Bu modüldeki proje, malzeme, duvar, minha ve harç ayarları Supabase üzerinde saklanır.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={saveProjectToSupabase}
              disabled={saveState !== 'idle'}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveState === 'saving' ? 'Kaydediliyor...' : activeProjectId ? 'Projeyi Güncelle' : 'Projeyi Kaydet'}
            </button>
            <button
              onClick={() => refreshSavedProjects(activeProjectId).catch(error => setServerMessage(error instanceof Error ? error.message : 'Kayıtlar yenilenemedi.'))}
              disabled={saveState !== 'idle'}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Listeyi Yenile
            </button>
          </div>
        </div>

        {serverMessage && (
          <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            {serverMessage}
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-3xl border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50">
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="px-4 py-3">Proje Adı</th>
                  <th className="px-4 py-3">Kullanıcı</th>
                  <th className="px-4 py-3">Güncelleme</th>
                  <th className="px-4 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {savedProjects.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-stone-500">
                      Supabase üzerinde henüz kayıtlı proje yok.
                    </td>
                  </tr>
                )}
                {savedProjects.map(item => (
                  <tr key={item.id} className={`border-b border-stone-100 ${activeProjectId === item.id ? 'bg-emerald-50' : 'bg-white'}`}>
                    <td className="px-4 py-3 font-medium text-stone-900">{item.projectName}</td>
                    <td className="px-4 py-3 text-stone-600">{item.username || '-'}</td>
                    <td className="px-4 py-3 text-stone-600">{item.updatedAt ? new Date(item.updatedAt).toLocaleString('tr-TR') : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => loadSavedProject(item)}
                          className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                        >
                          Yükle
                        </button>
                        <button
                          onClick={() => deleteSavedProject(item.id)}
                          className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-stone-900">Proje Ayarları</h3>
            <p className="mt-1 text-sm text-stone-500">Kat, kiriş ve döşeme bilgileri duvar net yüksekliğini belirler.</p>
          </div>
          <button
            onClick={fillDemo}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Örnek Veri Doldur
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-stone-600">İş / Proje Adı</span>
            <input
              value={project.projectName}
              onChange={event => updateProject('projectName', event.target.value)}
              className="w-full rounded-2xl border border-stone-300 px-4 py-3"
              placeholder="Örn: Botanica A Blok"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-stone-600">Kat Yüksekliği (cm)</span>
            <input
              type="number"
              value={project.floorHeight}
              onChange={event => updateProject('floorHeight', Number(event.target.value || 0))}
              className="w-full rounded-2xl border border-stone-300 px-4 py-3"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-stone-600">Kiriş Yüksekliği (cm)</span>
            <input
              type="number"
              value={project.beamHeight}
              onChange={event => updateProject('beamHeight', Number(event.target.value || 0))}
              className="w-full rounded-2xl border border-stone-300 px-4 py-3"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-stone-600">Döşeme Kalınlığı (cm)</span>
            <input
              type="number"
              value={project.slabThickness}
              onChange={event => updateProject('slabThickness', Number(event.target.value || 0))}
              className="w-full rounded-2xl border border-stone-300 px-4 py-3"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-stone-900">Malzeme Tanımları</h3>
            <p className="mt-1 text-sm text-stone-500">Önce duvar malzemelerini tanımlayın. Duvarlarda kalınlığa göre seçim yapılır.</p>
          </div>
          <button
            onClick={addMaterial}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Malzeme Ekle
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {materials.map(material => (
            <div key={material.id} className="rounded-2xl border border-stone-200 p-4">
              <div className="grid gap-3 lg:grid-cols-[1.2fr_1.3fr_0.8fr_0.8fr_0.8fr_0.9fr_auto]">
                <input
                  value={material.code}
                  onChange={event => updateMaterial(material.id, 'code', event.target.value)}
                  className="rounded-2xl border border-stone-300 px-4 py-3"
                  placeholder="Malzeme Kodu"
                />
                <input
                  value={material.name}
                  onChange={event => updateMaterial(material.id, 'name', event.target.value)}
                  className="rounded-2xl border border-stone-300 px-4 py-3"
                  placeholder="Malzeme Adı"
                />
                <input
                  type="number"
                  value={material.length}
                  onChange={event => updateMaterial(material.id, 'length', Number(event.target.value || 0))}
                  className="rounded-2xl border border-stone-300 px-4 py-3"
                  placeholder="Boy"
                />
                <input
                  type="number"
                  value={material.height}
                  onChange={event => updateMaterial(material.id, 'height', Number(event.target.value || 0))}
                  className="rounded-2xl border border-stone-300 px-4 py-3"
                  placeholder="Yükseklik"
                />
                <input
                  type="number"
                  value={material.thickness}
                  onChange={event => updateMaterial(material.id, 'thickness', Number(event.target.value || 0))}
                  className="rounded-2xl border border-stone-300 px-4 py-3"
                  placeholder="Kalınlık"
                />
                <input
                  type="number"
                  value={material.unitPrice}
                  onChange={event => updateMaterial(material.id, 'unitPrice', Number(event.target.value || 0))}
                  className="rounded-2xl border border-stone-300 px-4 py-3"
                  placeholder="Birim Fiyat"
                />
                <button
                  onClick={() => removeMaterial(material.id)}
                  className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-stone-900">Duvar Girişleri</h3>
            <p className="mt-1 text-sm text-stone-500">Her duvar için metrajı, malzemeyi ve minehayı aynı kart içinde girin.</p>
          </div>
          <button
            onClick={addWall}
            className="rounded-full bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            Duvar Ekle
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {walls.map((wall, index) => {
            const summary = calculations.wallRows.find(item => item.id === wall.id)
            const availableMaterials = materials.filter(material => Math.abs(material.thickness - wall.thickness) < 0.2)
            const shownMaterials = availableMaterials.length ? availableMaterials : materials

            return (
              <div key={wall.id} className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-orange-700">
                      DUVAR {index + 1}
                    </div>
                    <h4 className="mt-3 text-lg font-semibold text-stone-900">{wall.name || `Duvar ${index + 1}`}</h4>
                  </div>
                  <button
                    onClick={() => removeWall(wall.id)}
                    className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Duvarı Sil
                  </button>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-12">
                  <input
                    value={wall.name}
                    onChange={event => updateWall(wall.id, 'name', event.target.value)}
                    className="rounded-2xl border border-stone-300 px-4 py-3 xl:col-span-4"
                    placeholder="Mahal / Açıklama"
                  />
                  <input
                    type="number"
                    value={wall.length}
                    onChange={event => updateWall(wall.id, 'length', Number(event.target.value || 0))}
                    className="rounded-2xl border border-stone-300 px-4 py-3 xl:col-span-2"
                    placeholder="Uzunluk (cm)"
                  />
                  <input
                    type="number"
                    value={wall.count}
                    onChange={event => updateWall(wall.id, 'count', Number(event.target.value || 0))}
                    className="rounded-2xl border border-stone-300 px-4 py-3 xl:col-span-1"
                    placeholder="Adet"
                  />
                  <input
                    type="number"
                    value={wall.thickness}
                    onChange={event => updateWall(wall.id, 'thickness', Number(event.target.value || 0))}
                    className="rounded-2xl border border-stone-300 px-4 py-3 xl:col-span-2"
                    placeholder="Kalınlık"
                  />
                  <select
                    value={wall.topType}
                    onChange={event => updateWall(wall.id, 'topType', event.target.value as Wall['topType'])}
                    className="rounded-2xl border border-stone-300 px-4 py-3 xl:col-span-1"
                  >
                    <option value="beam">Kiriş altı</option>
                    <option value="slab">Döşeme altı</option>
                  </select>
                  <select
                    value={wall.faceCount}
                    onChange={event => updateWall(wall.id, 'faceCount', Number(event.target.value) as 1 | 2)}
                    className="rounded-2xl border border-stone-300 px-4 py-3 xl:col-span-1"
                  >
                    <option value={1}>Tek yüz</option>
                    <option value={2}>Çift yüz</option>
                  </select>
                  <select
                    value={wall.materialId}
                    onChange={event => updateWall(wall.id, 'materialId', event.target.value)}
                    className="rounded-2xl border border-stone-300 px-4 py-3 xl:col-span-1"
                  >
                    <option value="">{shownMaterials.length ? 'Malzeme seçin' : 'Önce malzeme tanımlayın'}</option>
                    {shownMaterials.map(material => (
                      <option key={material.id} value={material.id}>
                        {material.code} - {material.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Net Yükseklik</div>
                    <div className="mt-2 text-xl font-bold text-stone-900">{summary ? `${summary.heightCm.toFixed(0)} cm` : '0 cm'}</div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Brüt Duvar</div>
                    <div className="mt-2 text-xl font-bold text-stone-900">{summary ? formatArea(summary.grossArea) : '0.00 m²'}</div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Minha</div>
                    <div className="mt-2 text-xl font-bold text-stone-900">{summary ? formatArea(summary.deductionArea) : '0.00 m²'}</div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Net Duvar</div>
                    <div className="mt-2 text-xl font-bold text-stone-900">{summary ? formatArea(summary.netArea) : '0.00 m²'}</div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Sıva Alanı</div>
                    <div className="mt-2 text-xl font-bold text-stone-900">{summary ? formatArea(summary.plasterArea) : '0.00 m²'}</div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Malzeme Adedi</div>
                    <div className="mt-2 text-xl font-bold text-stone-900">{summary ? `${summary.unitCount} adet` : '0 adet'}</div>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h5 className="text-base font-semibold text-stone-900">Bu Duvarın Minha Girişleri</h5>
                      <p className="mt-1 text-sm text-stone-500">Kapı, pencere ve boşlukları bu duvarın altında yönetin.</p>
                    </div>
                    <button
                      onClick={() => addDeduction(wall.id)}
                      className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
                    >
                      Minha Ekle
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {wall.deductions.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-500">
                        Bu duvar için henüz minha girilmedi.
                      </div>
                    )}

                    {wall.deductions.map(deduction => {
                      const area = (deduction.width / 100) * (deduction.height / 100) * deduction.count
                      return (
                        <div key={deduction.id} className="grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 xl:grid-cols-[2fr_1fr_1fr_0.8fr_1fr_auto]">
                          <input
                            value={deduction.name}
                            onChange={event => updateDeduction(wall.id, deduction.id, 'name', event.target.value)}
                            className="rounded-2xl border border-stone-300 px-4 py-3"
                            placeholder="Tür / Açıklama"
                          />
                          <input
                            type="number"
                            value={deduction.width}
                            onChange={event => updateDeduction(wall.id, deduction.id, 'width', Number(event.target.value || 0))}
                            className="rounded-2xl border border-stone-300 px-4 py-3"
                            placeholder="Genişlik"
                          />
                          <input
                            type="number"
                            value={deduction.height}
                            onChange={event => updateDeduction(wall.id, deduction.id, 'height', Number(event.target.value || 0))}
                            className="rounded-2xl border border-stone-300 px-4 py-3"
                            placeholder="Yükseklik"
                          />
                          <input
                            type="number"
                            value={deduction.count}
                            onChange={event => updateDeduction(wall.id, deduction.id, 'count', Number(event.target.value || 0))}
                            className="rounded-2xl border border-stone-300 px-4 py-3"
                            placeholder="Adet"
                          />
                          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700">
                            Alan: {formatArea(area)}
                          </div>
                          <button
                            onClick={() => removeDeduction(wall.id, deduction.id)}
                            className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Sil
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <h3 className="text-xl font-semibold text-stone-900">Harç Varsayımları</h3>
        <p className="mt-1 text-sm text-stone-500">Harç hesabı duvar cinsine göre m² katsayısı ile yapılır.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-7">
          <input type="number" value={mortar.wasteRate} onChange={event => updateMortar('wasteRate', Number(event.target.value || 0))} className="rounded-2xl border border-stone-300 px-4 py-3" placeholder="Harç Fire Oranı (%)" />
          <input type="number" value={mortar.cementPerM3} onChange={event => updateMortar('cementPerM3', Number(event.target.value || 0))} className="rounded-2xl border border-stone-300 px-4 py-3" placeholder="1 m3 Harca Çimento (kg)" />
          <input type="number" value={mortar.sandPerM3} onChange={event => updateMortar('sandPerM3', Number(event.target.value || 0))} className="rounded-2xl border border-stone-300 px-4 py-3" placeholder="1 m3 Harca Kum (m3)" />
          <input type="number" value={mortar.limePerM3} onChange={event => updateMortar('limePerM3', Number(event.target.value || 0))} className="rounded-2xl border border-stone-300 px-4 py-3" placeholder="1 m3 Harca Kireç (kg)" />
          <input type="number" value={mortar.cementPrice} onChange={event => updateMortar('cementPrice', Number(event.target.value || 0))} className="rounded-2xl border border-stone-300 px-4 py-3" placeholder="Çimento Birim Fiyat" />
          <input type="number" value={mortar.sandPrice} onChange={event => updateMortar('sandPrice', Number(event.target.value || 0))} className="rounded-2xl border border-stone-300 px-4 py-3" placeholder="Kum Birim Fiyat" />
          <input type="number" value={mortar.limePrice} onChange={event => updateMortar('limePrice', Number(event.target.value || 0))} className="rounded-2xl border border-stone-300 px-4 py-3" placeholder="Kireç Birim Fiyat" />
        </div>
        <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          25 cm bims: 0.034 m3/m2, 20 cm bims: 0.027 m3/m2, 15 cm bims: 0.020 m3/m2, 10 cm bims: 0.014 m3/m2, 13.5 cm tuğla: 0.020 m3/m2, 8.5 cm tuğla: 0.013 m3/m2.
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-stone-900">Metrajlar ve Sipariş Özeti</h3>
            <p className="mt-1 text-sm text-stone-500">Toplam metrajlar, malzeme özeti, harç hesabı ve sipariş dökümü.</p>
          </div>
          <button
            onClick={printOrderSheet}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Sipariş Listesi PDF Oluştur
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Toplam Brüt Duvar</div><div className="mt-2 text-2xl font-bold text-stone-900">{formatArea(calculations.grossTotal)}</div></div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Toplam Minha</div><div className="mt-2 text-2xl font-bold text-stone-900">{formatArea(calculations.deductionTotal)}</div></div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Net Duvar Metrajı</div><div className="mt-2 text-2xl font-bold text-stone-900">{formatArea(calculations.netTotal)}</div></div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Alçı Sıva Metrajı</div><div className="mt-2 text-2xl font-bold text-stone-900">{formatArea(calculations.plasterTotal)}</div></div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Net Duvar Hacmi</div><div className="mt-2 text-2xl font-bold text-stone-900">{formatVolume(calculations.volumeTotal)}</div></div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Harç Hacmi</div><div className="mt-2 text-2xl font-bold text-stone-900">{formatVolume(calculations.mortarVolume)}</div></div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Malzeme Maliyeti</div><div className="mt-2 text-2xl font-bold text-stone-900">{formatCurrency(calculations.materialCostTotal)}</div></div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="text-xs font-semibold tracking-[0.14em] text-stone-500">Harç Maliyeti</div><div className="mt-2 text-2xl font-bold text-stone-900">{formatCurrency(calculations.mortarCost)}</div></div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-stone-200">
          <div className="border-b border-stone-200 bg-stone-50 px-5 py-4 text-sm font-semibold text-stone-700">Malzeme Bazlı Sipariş Özeti</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white">
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="px-4 py-3">Malzeme Kodu</th>
                  <th className="px-4 py-3">Malzeme Adı</th>
                  <th className="px-4 py-3">Metraj</th>
                  <th className="px-4 py-3">Adet</th>
                  <th className="px-4 py-3">Birim Fiyat</th>
                  <th className="px-4 py-3">1 m² Maliyet</th>
                </tr>
              </thead>
              <tbody>
                {calculations.materialSummary.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-stone-500">Henüz malzeme sipariş listesi oluşmadı.</td>
                  </tr>
                )}
                {calculations.materialSummary.map(item => (
                  <tr key={item.code} className="border-b border-stone-100">
                    <td className="px-4 py-3 font-medium text-stone-900">{item.code}</td>
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="px-4 py-3">{formatArea(item.area)}</td>
                    <td className="px-4 py-3">{item.units} adet</td>
                    <td className="px-4 py-3">{formatMoney(item.unitPrice)}</td>
                    <td className="px-4 py-3">{formatMoney(item.costPerSquareMeter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-stone-200">
          <div className="border-b border-stone-200 bg-stone-50 px-5 py-4 text-sm font-semibold text-stone-700">Harç Kalemleri</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white">
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="px-4 py-3">Kalem</th>
                  <th className="px-4 py-3">Miktar</th>
                  <th className="px-4 py-3">Birim</th>
                  <th className="px-4 py-3">Birim Fiyat</th>
                  <th className="px-4 py-3">Toplam Maliyet</th>
                  <th className="px-4 py-3">Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {calculations.mortarItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-stone-500">Henüz harç hesabı çıkarılmadı.</td>
                  </tr>
                )}
                {calculations.mortarItems.map(item => (
                  <tr key={item.label} className="border-b border-stone-100">
                    <td className="px-4 py-3 font-medium text-stone-900">{item.label}</td>
                    <td className="px-4 py-3">{formatMoney(item.amount)}</td>
                    <td className="px-4 py-3">{item.unit}</td>
                    <td className="px-4 py-3">{formatMoney(item.unitPrice)}</td>
                    <td className="px-4 py-3">{formatMoney(item.totalCost)}</td>
                    <td className="px-4 py-3">{item.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 p-5 text-sm leading-7 text-stone-700">
          {calculations.reportText}
        </div>
      </section>
    </div>
  )
}
