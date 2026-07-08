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
    camera.position.set(0, 30, 80)

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
    controls.maxDistance = 180

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(20, 60, 40)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    scene.add(dirLight)

    const dirLight2 = new THREE.DirectionalLight(0x3b82f6, 0.3)
    dirLight2.position.set(-20, 30, -40)
    scene.add(dirLight2)

    // Ground Grid
    const gridHelper = new THREE.GridHelper(200, 50, 0x1f2937, 0x111827)
    gridHelper.position.y = -1.5
    scene.add(gridHelper)

    // Render Blocks
    const meshesMap = new Map<string, THREE.Mesh>()
    meshesRef.current = meshesMap

    const buildScene = () => {
      // Clear previous meshes
      meshesMap.forEach((mesh) => scene.remove(mesh))
      meshesMap.clear()

      // Define blocks layout offsets in 3D
      // A-B are 30 units (2+1), C-D are 119 units (1+1)
      const blockOffsets = {
        A: -36,
        B: -12,
        C: 12,
        D: 36
      }

      apartments.forEach((apt) => {
        // Skip if not matches filter
        if (selectedBlock !== 'Tümü' && apt.block !== selectedBlock) return

        // Compute local grid coordinates based on Block name and Facade
        const X_center = blockOffsets[apt.block]
        const Y = apt.floor * 2.4 // 2.4m height per floor

        // On each floor, sort apartments by number to place them horizontally
        const blockApts = apartments.filter((a) => a.block === apt.block && a.floor === apt.floor && a.facade === apt.facade)
        blockApts.sort((a, b) => a.number - b.number)
        const index = blockApts.findIndex((a) => a.id === apt.id)
        const count = blockApts.length

        // Space apartments along Z or X axis depending on block
        // We will layout facades: Z = +2.5 for front (ana_yol), Z = -2.5 for back (arka_cephe)
        const Z = apt.facade === 'ana_yol' ? 3 : -3
        const X_offset = count > 1 ? (index - (count - 1) / 2) * 3.4 : 0
        const X = X_center + X_offset

        // Mesh Dimensions (1+1 compact rooms or 2+1 wider rooms)
        const boxWidth = apt.block === 'A' || apt.block === 'B' ? 3.0 : 2.5
        const boxHeight = 1.9
        const boxDepth = 2.8

        const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth)

        // Color based on status
        const color = getApartmentColor(apt)
        const material = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.2,
          metalness: 0.1,
          transparent: true,
          opacity: 0.9
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

      // Adjust controls target
      if (selectedBlock !== 'Tümü') {
        controls.target.set(blockOffsets[selectedBlock], 10, 0)
      } else {
        controls.target.set(0, 10, 0)
      }
    }

    buildScene()

    // Raycaster for Hover / Click
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onPointerMove = (event: MouseEvent) => {
      // Calculate mouse position in normalized device coordinates
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
        mat.emissive.setHex(0x333333)

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

        // Highlight selected mesh border / color
        const mesh = intersect.object as THREE.Mesh
        if (selectedMeshRef.current && selectedMeshRef.current !== mesh) {
          // Restore opacity of old selected mesh
          const oldMat = selectedMeshRef.current.material as THREE.MeshStandardMaterial
          oldMat.opacity = 0.9
        }
        selectedMeshRef.current = mesh
        const mat = mesh.material as THREE.MeshStandardMaterial
        mat.opacity = 1.0
      }
    }

    container.addEventListener('mousemove', onPointerMove)
    container.addEventListener('click', onPointerDown)

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener('resize', handleResize)

    // Animation Loop
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
              Three.js / WebGL
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
              className="fixed bg-slate-950/95 border border-slate-800 rounded-xl p-3 shadow-2xl z-30 pointer-events-none text-xs space-y-1 backdrop-blur-md min-w-[150px]"
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
            >
              <div className="flex items-center justify-between font-bold text-white border-b border-slate-800 pb-1 mb-1">
                <span>Daire {hoveredApartment.number}</span>
                <span className="text-cyan-400">{hoveredApartment.block} Blok</span>
              </div>
              <div>Kat: <span className="font-semibold text-slate-200">{hoveredApartment.floor}. Kat</span></div>
              <div>Tip: <span className="font-semibold text-slate-200">{hoveredApartment.type}</span></div>
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
                  <div>
                    <span className="text-xs text-slate-400">Cephe Yönü</span>
                    <div className="font-bold text-white mt-0.5">
                      {selectedApartment.facade === 'ana_yol' ? 'Ana Yol Cephe' : 'Arka Cephe'}
                    </div>
                  </div>
                  <div>
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
