'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface Apartment {
  id: string
  block: 'A' | 'B' | 'C' | 'D'
  floor: number
  number: number
  facade: 'ana_yol' | 'arka_cephe'
  area: number
  type: string
  price: number
  status: 'available' | 'reserved' | 'deposited' | 'sold'
}

interface SaleRecord {
  id: string
  apartmentId: string
  saleType: 'sold' | 'deposit' | 'reservation' | 'barter' | 'landowner'
  customerName?: string
  customerPhone?: string
  date: string
}

interface SaleDetails {
  apartmentId: string
  salePrice: number
  depositAmount: number
  remainingBalance: number
}

// Grid mapping coordinates for C & D blocks ring layout (5x3 grid)
// Returns { col, row } where col is 0..4 (West-East) and row is 0..2 (North-South)
function getCDGridCoords(number: number, floor: number) {
  // Floor 1: numbers 1 to 11
  // Floor 2: numbers 12 to 23
  // Floor 3: numbers 24 to 35, etc.
  const startNum = floor === 1 ? 1 : 12 + (floor - 2) * 12
  const k = number - startNum // 0-indexed relative position on the floor

  if (floor === 1) {
    // Floor 1 has 11 units. k goes 0..10. Slot (col=0, row=2) is empty for Building Entrance.
    if (k === 0) return { col: 1, row: 0 } // number 1
    if (k === 1) return { col: 2, row: 0 } // number 2
    if (k === 2) return { col: 3, row: 0 } // number 3
    if (k === 3) return { col: 4, row: 0 } // number 4
    if (k === 4) return { col: 4, row: 1 } // number 5
    if (k === 5) return { col: 4, row: 2 } // number 6
    if (k === 6) return { col: 3, row: 2 } // number 7
    if (k === 7) return { col: 2, row: 2 } // number 8
    if (k === 8) return { col: 1, row: 2 } // number 9
    if (k === 9) return { col: 0, row: 1 } // number 10
    if (k === 10) return { col: 0, row: 0 } // number 11
    return { col: 0, row: 2 } // fallback (entrance space)
  } else {
    // Floors 2-10 have 12 units. k goes 0..11.
    if (k === 0) return { col: 1, row: 0 }
    if (k === 1) return { col: 2, row: 0 }
    if (k === 2) return { col: 3, row: 0 }
    if (k === 3) return { col: 4, row: 0 }
    if (k === 4) return { col: 4, row: 1 }
    if (k === 5) return { col: 4, row: 2 }
    if (k === 6) return { col: 3, row: 2 }
    if (k === 7) return { col: 2, row: 2 }
    if (k === 8) return { col: 1, row: 2 }
    if (k === 9) return { col: 0, row: 2 }
    if (k === 10) return { col: 0, row: 1 }
    if (k === 11) return { col: 0, row: 0 }
    return { col: 0, row: 0 }
  }
}

// Facade string builder based on grid position for C & D blocks
function getCDFacadeDescription(number: number, floor: number) {
  const { col, row } = getCDGridCoords(number, floor)

  if (row === 0) {
    if (col === 0) return 'Kuzey-Batı Köşe (Yol & Petrol Ofisi)'
    if (col === 4) return 'Kuzey-Doğu Köşe (Yol & Botanica)'
    return 'Kuzey Cephe (Yol Tarafı)'
  }
  if (row === 2) {
    if (col === 0) return 'Güney-Batı Köşe (Giriş & Petrol Ofisi)'
    if (col === 4) return 'Güney-Doğu Köşe (Giriş & Botanica)'
    return 'Güney Cephe (Giriş Tarafı)'
  }
  if (row === 1) {
    if (col === 0) return 'Batı Cephe (Petrol Ofisi Tarafı)'
    if (col === 4) return 'Doğu Cephe (Botanica Tarafı)'
  }
  return 'İç Avlu / Koridor'
}

// Grid mapping coordinates for A & B blocks (2+1 layouts, 6 units per floor)
// Returns { col, row } where col is 0..2 (West-East) and row is 0 or 2 (North-South)
function getABGridCoords(number: number) {
  const k = (number - 1) % 6 // 0-indexed relative position on the floor
  if (k === 0) return { col: 0, row: 0 }
  if (k === 1) return { col: 1, row: 0 }
  if (k === 2) return { col: 2, row: 0 }
  if (k === 3) return { col: 2, row: 2 }
  if (k === 4) return { col: 1, row: 2 }
  if (k === 5) return { col: 0, row: 2 }
  return { col: 0, row: 0 }
}

function getABFacadeDescription(number: number) {
  const k = (number - 1) % 6
  if (k === 0) return 'Kuzey-Batı Köşe (Yol Tarafı)'
  if (k === 1) return 'Kuzey Cephe (Yol Tarafı)'
  if (k === 2) return 'Kuzey-Doğu Köşe (Yol Tarafı)'
  if (k === 3) return 'Güney-Doğu Köşe (Bahçe Tarafı)'
  if (k === 4) return 'Güney Cephe (Bahçe Tarafı)'
  if (k === 5) return 'Güney-Batı Köşe (Bahçe Tarafı)'
  return 'Bahçe Cephesi'
}

function createTextSprite(text: string, color: string, scale = 14) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.font = 'Bold 42px Arial'
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Clear canvas
    ctx.clearRect(0, 0, 512, 128)
    // Draw background label rounded card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
    ctx.beginPath()
    ctx.roundRect(10, 10, 492, 108, 20)
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = color
    ctx.stroke()
    // Text
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, 256, 64)
  }
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(scale, scale / 4, 1)
  return sprite
}

export default function ThreeDViewPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Data states
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>([])
  const [saleDetailsMap, setSaleDetailsMap] = useState<Record<string, SaleDetails>>({})
  const [loading, setLoading] = useState(true)

  // Interactive states
  const [selectedBlock, setSelectedBlock] = useState<'A' | 'B' | 'C' | 'D' | 'Tümü'>('Tümü')
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null)
  const [hoveredApartment, setHoveredApartment] = useState<Apartment | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Three.js instances refs for updates
  const sceneRef = useRef<THREE.Scene | null>(null)
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const selectedMeshRef = useRef<THREE.Mesh | null>(null)

  // Load database info
  const loadData = async () => {
    try {
      setLoading(true)
      const [aptsRes, salesRes, detailsRes] = await Promise.all([
        fetch('/api/apartments'),
        fetch('/api/sales'),
        fetch('/api/sale-details')
      ])

      const aptsData = await aptsRes.json()
      const salesData = await salesRes.json()
      const detailsData = await detailsRes.json()

      setApartments(Array.isArray(aptsData) ? aptsData : [])
      setSalesRecords(Array.isArray(salesData) ? salesData : [])

      const detailsMap: Record<string, SaleDetails> = {}
      if (Array.isArray(detailsData)) {
        detailsData.forEach((d: any) => {
          detailsMap[d.apartmentId] = d
        })
      }
      setSaleDetailsMap(detailsMap)
    } catch (err) {
      console.error('Error fetching 3D data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Quick lookups
  const saleRecordMap = useMemo(() => {
    const map: Record<string, SaleRecord> = {}
    salesRecords.forEach((rec) => {
      map[rec.apartmentId] = rec
    })
    return map
  }, [salesRecords])

  const getApartmentColor = (apt: Apartment) => {
    const sale = saleRecordMap[apt.id]
    if (sale) {
      if (sale.saleType === 'barter') return 0x3b82f6 // Blue
      if (sale.saleType === 'landowner') return 0x8b5cf6 // Purple
      if (sale.saleType === 'reservation') return 0xf59e0b // Yellow
      if (sale.saleType === 'deposit') return 0xf97316 // Orange
      return 0xef4444 // Red (sold)
    }
    return 0x10b981 // Green (available)
  }

  const getStatusLabel = (apt: Apartment) => {
    const sale = saleRecordMap[apt.id]
    if (sale) {
      if (sale.saleType === 'barter') return 'Barter (Takas)'
      if (sale.saleType === 'landowner') return 'Arsa Sahibi'
      if (sale.saleType === 'reservation') return 'Rezerve'
      if (sale.saleType === 'deposit') return 'Kaporalı'
      return 'Satıldı'
    }
    return 'Satılık'
  }

  const getStatusColorClass = (apt: Apartment) => {
    const sale = saleRecordMap[apt.id]
    if (sale) {
      if (sale.saleType === 'barter') return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
      if (sale.saleType === 'landowner') return 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
      if (sale.saleType === 'reservation') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
      if (sale.saleType === 'deposit') return 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
      return 'bg-red-500/20 text-red-400 border border-red-500/30'
    }
    return 'bg-green-500/20 text-green-400 border border-green-500/30'
  }

  const getApartmentFacadeText = (apt: Apartment) => {
    if (apt.block === 'C' || apt.block === 'D') {
      return getCDFacadeDescription(apt.number, apt.floor)
    }
    return getABFacadeDescription(apt.number)
  }

  // Set up Three.js Scene
  useEffect(() => {
    if (loading || apartments.length === 0 || !canvasRef.current || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0f19)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(0, 38, 90)

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2 - 0.02 // Don't go below ground
    controls.minDistance = 10
    controls.maxDistance = 200

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(30, 80, 50)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    scene.add(dirLight)

    const dirLight2 = new THREE.DirectionalLight(0x3b82f6, 0.35)
    dirLight2.position.set(-30, 30, -50)
    scene.add(dirLight2)

    // Ground Grid Helper
    const gridHelper = new THREE.GridHelper(220, 55, 0x1f2937, 0x111827)
    gridHelper.position.y = -1.5
    scene.add(gridHelper)

    // Stage Compass & Facade Sprites on ground
    const compassNorth = createTextSprite('KUZEY (YOL TARAFI)', '#ef4444', 22)
    compassNorth.position.set(0, -1.0, -54)
    scene.add(compassNorth)

    const compassSouth = createTextSprite('GÜNEY (BİNA GİRİŞLERİ)', '#10b981', 24)
    compassSouth.position.set(0, -1.0, 54)
    scene.add(compassSouth)

    const compassWest = createTextSprite('BATI (PETROL OFİSİ)', '#94a3b8', 22)
    compassWest.position.set(-54, -1.0, 0)
    scene.add(compassWest)

    const compassEast = createTextSprite('DOĞU (BOTANICA TARAFI)', '#94a3b8', 22)
    compassEast.position.set(54, -1.0, 0)
    scene.add(compassEast)

    // Render Blocks
    const meshesMap = new Map<string, THREE.Mesh>()
    meshesRef.current = meshesMap

    const buildScene = () => {
      // Clear previous meshes
      meshesMap.forEach((mesh) => scene.remove(mesh))
      meshesMap.clear()

      // Define block offset centers (A-B north, C-D south)
      const blockCenters = {
        B: { x: -24, z: -20 },
        A: { x: 24, z: -20 },
        D: { x: -24, z: 20 },
        C: { x: 24, z: 20 }
      }

      // Add visual "Bina Girişi" labels & portals for C and D blocks on Floor 1
      for (const block of ['C', 'D'] as const) {
        if (selectedBlock !== 'Tümü' && selectedBlock !== block) continue

        const center = blockCenters[block]
        // Entrance is on South-West corner: col=0, row=2 -> local position:
        // Col 0: X_local = -2 * 3.0 = -6.0
        // Row 2: Z_local = 1 * 3.0 = 3.0
        const entX = center.x - 6.0
        const entZ = center.z + 3.0
        const entY = 1 * 2.4 - 1.2 // Y position at floor 1

        // Render entrance lobby block in gray
        const entGeo = new THREE.BoxGeometry(2.4, 2.0, 2.4)
        const entMat = new THREE.MeshStandardMaterial({
          color: 0x475569,
          roughness: 0.8,
          metalness: 0.1,
          transparent: true,
          opacity: 0.65
        })
        const entMesh = new THREE.Mesh(entGeo, entMat)
        entMesh.position.set(entX, entY, entZ)
        scene.add(entMesh)
        // Store as part of map to clean up on reload
        meshesMap.set(`entrance-${block}`, entMesh)

        // Floating label
        const entSprite = createTextSprite('BİNA GİRİŞİ', '#10b981', 8)
        entSprite.position.set(entX, entY + 1.8, entZ)
        scene.add(entSprite)
        meshesMap.set(`entrance-label-${block}`, entSprite as any)
      }

      apartments.forEach((apt) => {
        // Skip if not matches filter
        if (selectedBlock !== 'Tümü' && apt.block !== selectedBlock) return

        const center = blockCenters[apt.block]
        const Y = apt.floor * 2.4 // 2.4m height per floor

        let X = center.x
        let Z = center.z
        let boxWidth = 2.4
        let boxHeight = 2.0
        let boxDepth = 2.4

        if (apt.block === 'C' || apt.block === 'D') {
          // 1+1 Apartments in C & D: ring layout based on col & row
          const { col, row } = getCDGridCoords(apt.number, apt.floor)

          // 5 Columns: spacing = 3.0m along X axis
          const X_local = (col - 2) * 3.0
          // 3 Rows: spacing = 3.0m along Z axis
          const Z_local = (row - 1) * 3.0

          X = center.x + X_local
          Z = center.z + Z_local
          boxWidth = 2.4
          boxDepth = 2.4
        } else {
          // 2+1 Apartments in A & B: 3 columns, 2 rows (North and South sides)
          const { col, row } = getABGridCoords(apt.number)
          const X_local = (col - 1) * 4.2
          const Z_local = (row - 1) * 4.2

          X = center.x + X_local
          Z = center.z + Z_local
          boxWidth = 3.8
          boxDepth = 3.2
        }

        const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth)

        // Color based on status & metadata
        const color = getApartmentColor(apt)
        const material = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.25,
          metalness: 0.05,
          transparent: true,
          opacity: 0.85
        })

        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(X, Y, Z)
        mesh.castShadow = true
        mesh.receiveShadow = true

        // Store apartment info on mesh userData
        mesh.userData = { apartment: apt }

        scene.add(mesh)
        meshesMap.set(apt.id, mesh)
      })

      // Adjust camera focus target
      if (selectedBlock !== 'Tümü') {
        const center = blockCenters[selectedBlock]
        controls.target.set(center.x, 12, center.z)
      } else {
        controls.target.set(0, 10, 0)
      }
    }

    buildScene()

    // Raycaster for Hover / Click
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onPointerMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(scene.children)

      // Find first apartment box intersected
      const intersect = intersects.find((i) => i.object.userData?.apartment)

      if (intersect) {
        const apt = intersect.object.userData.apartment as Apartment
        setHoveredApartment(apt)
        setTooltipPos({ x: event.clientX + 15, y: event.clientY + 15 })

        // Highlight hovered mesh
        const mesh = intersect.object as THREE.Mesh
        const mat = mesh.material as THREE.MeshStandardMaterial
        mat.emissive.setHex(0x3b3b3b)

        // Reset other meshes' emissive
        meshesMap.forEach((m) => {
          if (m !== mesh) {
            ;(m.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000)
          }
        })
      } else {
        setHoveredApartment(null)
        meshesMap.forEach((m) => {
          ;(m.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000)
        })
      }
    }

    const onPointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(scene.children)
      const intersect = intersects.find((i) => i.object.userData?.apartment)

      if (intersect) {
        const apt = intersect.object.userData.apartment as Apartment
        setSelectedApartment(apt)

        const mesh = intersect.object as THREE.Mesh
        if (selectedMeshRef.current && selectedMeshRef.current !== mesh) {
          const oldMat = selectedMeshRef.current.material as THREE.MeshStandardMaterial
          oldMat.opacity = 0.85
        }
        selectedMeshRef.current = mesh
        const mat = mesh.material as THREE.MeshStandardMaterial
        mat.opacity = 1.0
      }
    }

    container.addEventListener('mousemove', onPointerMove)
    container.addEventListener('click', onPointerDown)

    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener('resize', handleResize)

    let animationFrameId = 0
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
      container.removeEventListener('mousemove', onPointerMove)
      container.removeEventListener('click', onPointerDown)
      window.removeEventListener('resize', handleResize)
      controls.dispose()
      renderer.dispose()
      meshesMap.forEach((mesh) => {
        mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose())
        } else {
          mesh.material.dispose()
        }
      })
    }
  }, [loading, apartments, selectedBlock])

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-semibold mb-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Geri Dön
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">3D Dijital İkiz</h1>
            <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2.5 py-1 rounded-full font-bold border border-cyan-500/30">
              Gerçek Vaziyet & Cephe Modeli
            </span>
          </div>
        </div>

        {/* Block Selector */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0 gap-1 overflow-x-auto whitespace-nowrap">
          {['Tümü', 'A', 'B', 'C', 'D'].map((blockKey) => (
            <button
              key={blockKey}
              onClick={() => {
                setSelectedBlock(blockKey as any)
                setSelectedApartment(null)
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                selectedBlock === blockKey
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/10'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {blockKey === 'Tümü' ? 'Tüm Proje' : `${blockKey} Blok`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] relative overflow-hidden">
        {/* WebGL Canvas Container */}
        <div ref={containerRef} className="relative w-full h-full min-h-[500px]">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm z-20 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
              <p className="text-slate-300 text-sm">3D Modeller yükleniyor...</p>
            </div>
          ) : null}

          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* Interactive Hover Tooltip */}
          {hoveredApartment && (
            <div
              className="fixed bg-slate-950/95 border border-slate-800 rounded-xl p-3 shadow-2xl z-30 pointer-events-none text-xs space-y-1 backdrop-blur-md min-w-[180px]"
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
            >
              <div className="flex items-center justify-between font-bold text-white border-b border-slate-800/80 pb-1 mb-1">
                <span>Daire {hoveredApartment.number}</span>
                <span className="text-cyan-400">{hoveredApartment.block} Blok</span>
              </div>
              <div>Kat: <span className="font-semibold text-slate-200">{hoveredApartment.floor}. Kat</span></div>
              <div>Cephe: <span className="font-semibold text-cyan-300">{getApartmentFacadeText(hoveredApartment)}</span></div>
              <div>Tip: <span className="font-semibold text-slate-200">{hoveredApartment.type} ({hoveredApartment.area} m²)</span></div>
              <div>Fiyat: <span className="font-semibold text-green-400">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(hoveredApartment.price)}
              </span></div>
              <div className="pt-1 font-semibold text-slate-300 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  getStatusLabel(hoveredApartment) === 'Satılık' ? 'bg-green-500' :
                  getStatusLabel(hoveredApartment) === 'Satıldı' ? 'bg-red-500' :
                  getStatusLabel(hoveredApartment) === 'Rezerve' ? 'bg-yellow-500' :
                  getStatusLabel(hoveredApartment) === 'Kaporalı' ? 'bg-orange-500' :
                  getStatusLabel(hoveredApartment) === 'Barter (Takas)' ? 'bg-blue-500' : 'bg-purple-500'
                }`}></span>
                {getStatusLabel(hoveredApartment)}
              </div>
            </div>
          )}

          {/* Color Legend (Floating Overlay) */}
          <div className="absolute bottom-6 left-6 bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl shadow-xl backdrop-blur-md space-y-2 hidden md:block">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 border-b border-slate-800/80 pb-1">Renk Kodları</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-green-500 block"></span>
                <span>Satılık</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-red-500 block"></span>
                <span>Satıldı</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-yellow-500 block"></span>
                <span>Rezerve</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-orange-500 block"></span>
                <span>Kaporalı</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-blue-500 block"></span>
                <span>Barter (Takas)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-purple-500 block"></span>
                <span>Arsa Sahibi</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Details Sidebar */}
        <div className="bg-slate-900/40 border-t lg:border-t-0 lg:border-l border-slate-800 p-6 flex flex-col justify-between overflow-y-auto max-h-screen">
          <div>
            <h2 className="text-lg font-black text-white mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
              📊 Daire Detayları
            </h2>

            {!selectedApartment ? (
              <div className="text-slate-400 text-sm py-12 text-center space-y-2">
                <div className="text-3xl">👈</div>
                <p>Detayları görmek için 3D maketteki bir daire kutusuna tıklayın.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header Metadata */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">Daire {selectedApartment.number}</h3>
                    <p className="text-slate-400 text-sm">{selectedApartment.block} Blok, {selectedApartment.floor}. Kat</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColorClass(selectedApartment)}`}>
                    {getStatusLabel(selectedApartment)}
                  </span>
                </div>

                {/* Technical Specs */}
                <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-sm">
                  <div>
                    <span className="text-xs text-slate-400">Daire Tipi</span>
                    <div className="font-bold text-white mt-0.5">{selectedApartment.type}</div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Brüt Alan</span>
                    <div className="font-bold text-white mt-0.5">{selectedApartment.area} m²</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-400">Cephe & Yön</span>
                    <div className="font-bold text-cyan-400 mt-0.5">
                      {getApartmentFacadeText(selectedApartment)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-400">Liste Fiyatı</span>
                    <div className="font-bold text-green-400 mt-0.5">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(selectedApartment.price)}
                    </div>
                  </div>
                </div>

                {/* Sales Agreement Info */}
                {saleRecordMap[selectedApartment.id] && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-1">Müşteri ve Satış Bilgisi</h4>
                    
                    <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800 text-sm">
                      <div>
                        <span className="text-xs text-slate-400">Müşteri / Taşeron</span>
                        <div className="font-bold text-white mt-0.5">
                          {saleRecordMap[selectedApartment.id].customerName || '-'}
                        </div>
                      </div>

                      {saleRecordMap[selectedApartment.id].customerPhone && (
                        <div>
                          <span className="text-xs text-slate-400">Telefon Numarası</span>
                          <div className="font-bold text-white mt-0.5">
                            {saleRecordMap[selectedApartment.id].customerPhone}
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="text-xs text-slate-400">İşlem Tarihi</span>
                        <div className="font-bold text-slate-300 mt-0.5">
                          {new Date(saleRecordMap[selectedApartment.id].date).toLocaleDateString('tr-TR')}
                        </div>
                      </div>

                      {/* Payment values */}
                      {saleDetailsMap[selectedApartment.id] && (
                        <div className="border-t border-slate-800/80 pt-3 mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-xs text-slate-400">Satış Bedeli</span>
                            <div className="font-bold text-white">
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(saleDetailsMap[selectedApartment.id].salePrice)}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400">Ödenen Peşinat</span>
                            <div className="font-bold text-white">
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(saleDetailsMap[selectedApartment.id].depositAmount)}
                            </div>
                          </div>
                          <div className="col-span-2 border-t border-slate-900 pt-2">
                            <span className="text-xs text-slate-400">Kalan Borç / Alacak</span>
                            <div className="font-extrabold text-orange-400">
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(saleDetailsMap[selectedApartment.id].remainingBalance)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedApartment && (
            <div className="pt-6 border-t border-slate-800 mt-6">
              <button
                onClick={() => router.push(`/blocks/${selectedApartment.block}`)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-xl transition-all cursor-pointer hover:shadow-lg hover:shadow-purple-500/10 text-center"
              >
                Blok Detayına Git (Düzenle)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
