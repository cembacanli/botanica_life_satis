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
function getCDGridCoords(number: number, floor: number) {
  const startNum = floor === 1 ? 1 : 12 + (floor - 2) * 12
  const k = number - startNum

  if (floor === 1) {
    if (k === 0) return { col: 1, row: 0 } // number 1
    if (k === 1) return { col: 2, row: 0 } // number 2
    if (k === 2) return { col: 3, row: 0 } // number 3
    if (k === 3) return { col: 4, row: 0 } // number 4
    if (k === 4) return { col: 4, row: 1 } // number 5
    if (k === 5) return { col: 4, row: 2 } // number 6 (bottom-right)
    if (k === 6) return { col: 3, row: 2 } // number 7
    if (k === 7) return { col: 1, row: 2 } // number 8
    if (k === 8) return { col: 0, row: 2 } // number 9 (bottom-left)
    if (k === 9) return { col: 0, row: 1 } // number 10
    if (k === 10) return { col: 0, row: 0 } // number 11
    return { col: 2, row: 2 }
  } else {
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
function getCDFacadeDescription(number: number, floor: number, block: 'C' | 'D') {
  const { col, row } = getCDGridCoords(number, floor)

  if (row === 0) {
    if (col === 0) return block === 'C' ? 'Kuzey-Batı Köşe (Yol & Petrol Ofisi)' : 'Kuzey-Batı Köşe (Yol & İç Avlu)'
    if (col === 4) return block === 'C' ? 'Kuzey-Doğu Köşe (Yol & İç Avlu)' : 'Kuzey-Doğu Köşe (Yol & Botanica)'
    return 'Kuzey Cephe (Yol Tarafı)'
  }
  if (row === 2) {
    if (col === 0) return block === 'C' ? 'Güney-Batı Köşe (Giriş & Petrol Ofisi)' : 'Güney-Batı Köşe (Giriş & İç Avlu)'
    if (col === 4) return block === 'C' ? 'Güney-Doğu Köşe (Giriş & İç Avlu)' : 'Güney-Doğu Köşe (Giriş & Botanica)'
    return 'Güney Cephe (Giriş Tarafı)'
  }
  if (row === 1) {
    if (col === 0) return block === 'C' ? 'Batı Cephe (Petrol Ofisi Tarafı)' : 'Batı Cephe (İç Avlu Tarafı)'
    if (col === 4) return block === 'C' ? 'Doğu Cephe (İç Avlu Tarafı)' : 'Doğu Cephe (Botanica Tarafı)'
  }
  return 'İç Avlu / Koridor'
}

// Grid mapping coordinates for A & B blocks (2+1 layouts, 6 units per floor)
function getABGridCoords(number: number) {
  const k = (number - 1) % 6
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

// Crisp, high-contrast horizontal plane text label creator for ground layout
function createGroundLabelMesh(text: string, color: string, width = 36, height = 9) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 1024, 256)
    
    // Draw card background
    ctx.fillStyle = 'rgba(9, 12, 22, 0.95)'
    ctx.beginPath()
    ctx.roundRect(10, 10, 1004, 236, 32)
    ctx.fill()
    
    // Border stroke
    ctx.lineWidth = 10
    ctx.strokeStyle = color
    ctx.stroke()
    
    // Text drawing (crisp, dynamic scaling to prevent border overflow)
    let fontSize = 48
    ctx.font = `Bold ${fontSize}px Arial`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Auto-shrink text font size if it exceeds the card margins
    const maxTextWidth = 880
    let textMetrics = ctx.measureText(text)
    while (textMetrics.width > maxTextWidth && fontSize > 20) {
      fontSize -= 2
      ctx.font = `Bold ${fontSize}px Arial`
      textMetrics = ctx.measureText(text)
    }
    
    ctx.fillText(text, 512, 128)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false

  const geometry = new THREE.PlaneGeometry(width, height)
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  return mesh
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
    ctx.clearRect(0, 0, 512, 128)
    ctx.fillStyle = 'rgba(11, 15, 25, 0.9)'
    ctx.beginPath()
    ctx.roundRect(10, 10, 492, 108, 16)
    ctx.fill()
    ctx.lineWidth = 2.5
    ctx.strokeStyle = color
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, 256, 64)
  }
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(scale, scale / 4, 1)
  return sprite
}

function create3DTree() {
  const tree = new THREE.Group()
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.8, 8)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.9 })
  const trunk = new THREE.Mesh(trunkGeo, trunkMat)
  trunk.position.y = 0.9
  trunk.castShadow = true
  trunk.receiveShadow = true
  tree.add(trunk)

  const foliageGeo = new THREE.DodecahedronGeometry(0.85, 1)
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85 })
  const foliage = new THREE.Mesh(foliageGeo, foliageMat)
  foliage.position.y = 2.1
  foliage.castShadow = true
  foliage.receiveShadow = true
  tree.add(foliage)

  return tree
}

function create3DCar(color: number) {
  const car = new THREE.Group()

  const bodyGeo = new THREE.BoxGeometry(1.6, 0.6, 3.2)
  const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.15, metalness: 0.8 })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = 0.4
  body.castShadow = true
  body.receiveShadow = true
  car.add(body)

  const cabinGeo = new THREE.BoxGeometry(1.4, 0.5, 1.8)
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.1, metalness: 0.9 })
  const cabin = new THREE.Mesh(cabinGeo, cabinMat)
  cabin.position.set(0, 0.85, -0.2)
  cabin.castShadow = true
  car.add(cabin)

  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.3, 12)
  wheelGeo.rotateZ(Math.PI / 2)
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
  
  const wPositions = [
    { x: 0.85, y: 0.3, z: 0.9 },
    { x: -0.85, y: 0.3, z: 0.9 },
    { x: 0.85, y: 0.3, z: -0.9 },
    { x: -0.85, y: 0.3, z: -0.9 }
  ]
  wPositions.forEach((pos) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat)
    wheel.position.set(pos.x, pos.y, pos.z)
    wheel.castShadow = true
    car.add(wheel)
  })

  return car
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

  // Camera lerp animation refs
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null)
  const targetLookAtRef = useRef<THREE.Vector3 | null>(null)
  const isAnimatingCamRef = useRef(false)

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
      if (sale.saleType === 'barter') return 0x3b82f6
      if (sale.saleType === 'landowner') return 0x8b5cf6
      if (sale.saleType === 'reservation') return 0xf59e0b
      if (sale.saleType === 'deposit') return 0xf97316
      return 0xef4444
    }
    return 0x10b981
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
      return getCDFacadeDescription(apt.number, apt.floor, apt.block)
    }
    return getABFacadeDescription(apt.number)
  }

  // Camera sweep animation trigger
  const triggerCameraAnimation = (cam: { x: number, y: number, z: number }, target: { x: number, y: number, z: number }) => {
    targetCamPosRef.current = new THREE.Vector3(cam.x, cam.y, cam.z)
    targetLookAtRef.current = new THREE.Vector3(target.x, target.y, target.z)
    isAnimatingCamRef.current = true
  }

  // Set up Three.js Scene
  useEffect(() => {
    if (loading || apartments.length === 0 || !canvasRef.current || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0c14)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(0, 36, 88)

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2 - 0.02
    controls.minDistance = 10
    controls.maxDistance = 190

    // Lights
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.45)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 0.95)
    dirLight.position.set(40, 80, 50)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    dirLight.shadow.bias = -0.0005
    scene.add(dirLight)

    const dirLight2 = new THREE.DirectionalLight(0x8b5cf6, 0.25)
    dirLight2.position.set(-40, 30, -50)
    scene.add(dirLight2)

    // Ground Grid Helper
    const gridHelper = new THREE.GridHelper(220, 55, 0x1f2937, 0x111827)
    gridHelper.position.y = -1.5
    scene.add(gridHelper)

    // --- 3D COMPASS DIAL (Pusula Kadranı) ---
    const compassRingGeo = new THREE.RingGeometry(6, 6.2, 32)
    const compassRingMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, side: THREE.DoubleSide })
    const compassRing = new THREE.Mesh(compassRingGeo, compassRingMat)
    compassRing.rotation.x = Math.PI / 2
    compassRing.position.set(0, -1.4, 0)
    scene.add(compassRing)

    const arrowGeo = new THREE.ConeGeometry(0.5, 2, 4)
    arrowGeo.rotateX(Math.PI / 2)
    const nArrowMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
    const nArrow = new THREE.Mesh(arrowGeo, nArrowMat)
    nArrow.position.set(0, -1.35, -1.8)
    scene.add(nArrow)

    const sArrow = new THREE.Mesh(arrowGeo, new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5 }))
    sArrow.position.set(0, -1.35, 1.8)
    sArrow.rotation.y = Math.PI
    scene.add(sArrow)

    const labelK = createTextSprite('K', '#ef4444', 8)
    labelK.position.set(0, -0.6, -4.5)
    scene.add(labelK)

    const labelG = createTextSprite('G', '#10b981', 8)
    labelG.position.set(0, -0.6, 4.5)
    scene.add(labelG)

    const labelD = createTextSprite('D', '#38bdf8', 8)
    labelD.position.set(4.5, -0.6, 0)
    scene.add(labelD)

    const labelB = createTextSprite('B', '#38bdf8', 8)
    labelB.position.set(-4.5, -0.6, 0)
    scene.add(labelB)

    // --- HIGH-CONTRAST GROUND FACADE LABELS (Dışarıda, Zeminde yatan tabelalar) ---
    // North Road Label
    const groundFacadeNorth = createGroundLabelMesh('KUZEY CEPHESİ (YOL TARAFI)', '#f43f5e', 24, 6)
    groundFacadeNorth.position.set(0, -1.43, -42)
    scene.add(groundFacadeNorth)

    // South Road Label
    const groundFacadeSouth = createGroundLabelMesh('GÜNEY CEPHESİ (GİRİŞ KAPILARI)', '#10b981', 24, 6)
    groundFacadeSouth.position.set(0, -1.43, 42)
    scene.add(groundFacadeSouth)

    // West Side (Petrol Ofisi) Road Label
    const groundFacadeWest = createGroundLabelMesh('BATI CEPHESİ (PETROL OFİSİ TARAFI)', '#38bdf8', 24, 6)
    groundFacadeWest.position.set(-49, -1.43, 0)
    groundFacadeWest.rotation.z = Math.PI / 2 // Rotate along West boundary Z-axis
    scene.add(groundFacadeWest)

    // East Side (Botanica) Road Label
    const groundFacadeEast = createGroundLabelMesh('DOĞU CEPHESİ (BOTANICA TARAFI)', '#38bdf8', 24, 6)
    groundFacadeEast.position.set(49, -1.43, 0)
    groundFacadeEast.rotation.z = -Math.PI / 2 // Rotate along East boundary Z-axis
    scene.add(groundFacadeEast)

    // --- LANDSCAPING ---
    const yardGeo = new THREE.BoxGeometry(34, 0.1, 26)
    const yardMat = new THREE.MeshStandardMaterial({
      color: 0x1b4d3e,
      roughness: 0.9,
      metalness: 0.05
    })
    const yardLawn = new THREE.Mesh(yardGeo, yardMat)
    yardLawn.position.set(0, -1.45, 0)
    yardLawn.receiveShadow = true
    scene.add(yardLawn)

    const westLawnGeo = new THREE.BoxGeometry(8, 0.1, 74)
    const westLawn = new THREE.Mesh(westLawnGeo, yardMat)
    westLawn.position.set(-41, -1.45, 0)
    westLawn.receiveShadow = true
    scene.add(westLawn)

    const eastLawnGeo = new THREE.BoxGeometry(8, 0.1, 74)
    const eastLawn = new THREE.Mesh(eastLawnGeo, yardMat)
    eastLawn.position.set(41, -1.45, 0)
    eastLawn.receiveShadow = true
    scene.add(eastLawn)

    const northLawnGeo = new THREE.BoxGeometry(90, 0.1, 6)
    const northLawn = new THREE.Mesh(northLawnGeo, yardMat)
    northLawn.position.set(0, -1.45, -35)
    northLawn.receiveShadow = true
    scene.add(northLawn)

    const southLawnGeo = new THREE.BoxGeometry(90, 0.1, 6)
    const southLawn = new THREE.Mesh(southLawnGeo, yardMat)
    southLawn.position.set(0, -1.45, 35)
    southLawn.receiveShadow = true
    scene.add(southLawn)

    // --- PARCEL BOUNDARY ---
    const boundaryPoints = [
      new THREE.Vector3(-45, -1.35, -38),
      new THREE.Vector3(45, -1.35, -38),
      new THREE.Vector3(45, -1.35, 38),
      new THREE.Vector3(-45, -1.35, 38),
      new THREE.Vector3(-45, -1.35, -38)
    ]
    const borderGeo = new THREE.BufferGeometry().setFromPoints(boundaryPoints)
    const borderMat = new THREE.LineBasicMaterial({ color: 0x8b5cf6, linewidth: 3 })
    const boundaryLine = new THREE.Line(borderGeo, borderMat)
    scene.add(boundaryLine)

    const borderLabel = createTextSprite('ARSA PARSEL SINIRI', '#8b5cf6', 15)
    borderLabel.position.set(-45, 0.2, -38)
    scene.add(borderLabel)

    // --- SITE MAIN ENTRANCE (Site Ana Girişi - Batı Cephesi) ---
    const boothGeo = new THREE.BoxGeometry(2, 2.2, 2)
    const boothMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.1 })
    const booth = new THREE.Mesh(boothGeo, boothMat)
    booth.position.set(-43.8, -0.4, 2)
    booth.castShadow = true
    booth.receiveShadow = true
    scene.add(booth)
    
    const boothRoofGeo = new THREE.BoxGeometry(2.4, 0.2, 2.4)
    const boothRoof = new THREE.Mesh(boothRoofGeo, new THREE.MeshStandardMaterial({ color: 0x475569 }))
    boothRoof.position.set(-43.8, 0.8, 2)
    boothRoof.castShadow = true
    scene.add(boothRoof)

    const barrierPostGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8)
    const barrierPost = new THREE.Mesh(barrierPostGeo, new THREE.MeshStandardMaterial({ color: 0x334155 }))
    barrierPost.position.set(-43.8, -0.9, 0)
    scene.add(barrierPost)

    const barrierArmGeo = new THREE.BoxGeometry(0.1, 0.15, 3.2)
    const barrierArm = new THREE.Mesh(barrierArmGeo, new THREE.MeshStandardMaterial({ color: 0xef4444 }))
    barrierArm.position.set(-43.8, -0.2, -1.6)
    scene.add(barrierArm)

    const gateLabel = createTextSprite('SİTE ANA GİRİŞİ (BATI CEPHESİ)', '#10b981', 18)
    gateLabel.position.set(-43.8, 2.6, 0)
    scene.add(gateLabel)

    // --- 3D TREES ---
    const treePositions = [
      { x: -6, z: -8 }, { x: 6, z: -8 }, { x: -6, z: 8 }, { x: 6, z: 8 },
      { x: -41, z: -25 }, { x: -41, z: 25 },
      { x: 41, z: -25 }, { x: 41, z: 0 }, { x: 41, z: 25 }
    ]

    treePositions.forEach((pos) => {
      const tree = create3DTree()
      tree.position.set(pos.x, -1.4, pos.z)
      scene.add(tree)
    })

    // --- OTOPARK & ARABALAR ---
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
    const lineGeo = new THREE.BoxGeometry(0.15, 0.02, 4.0)

    const westSlotsZ = [-12, -8, -4, 4, 8, 12]
    westSlotsZ.forEach((z) => {
      const pLine = new THREE.Mesh(lineGeo, lineMat)
      pLine.position.set(-30, -1.48, z)
      scene.add(pLine)

      if (Math.random() > 0.3) {
        const colors = [0xef4444, 0x3b82f6, 0x64748b, 0xffffff, 0x111827]
        const carColor = colors[Math.floor(Math.random() * colors.length)]
        const car = create3DCar(carColor)
        car.position.set(-32, -1.4, z)
        car.rotation.y = Math.PI / 2
        scene.add(car)
      }
    })

    const eastSlotsZ = [-12, -8, -4, 4, 8, 12]
    eastSlotsZ.forEach((z) => {
      const pLine = new THREE.Mesh(lineGeo, lineMat)
      pLine.position.set(30, -1.48, z)
      scene.add(pLine)

      if (Math.random() > 0.3) {
        const colors = [0xef4444, 0x3b82f6, 0x64748b, 0xffffff, 0x111827]
        const carColor = colors[Math.floor(Math.random() * colors.length)]
        const car = create3DCar(carColor)
        car.position.set(32, -1.4, z)
        car.rotation.y = -Math.PI / 2
        scene.add(car)
      }
    })

    // --- KUZEY YOLU (North Road Surface) ---
    const northRoadGeo = new THREE.BoxGeometry(160, 0.12, 22)
    const northRoadMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.95, metalness: 0.05 })
    const northRoad = new THREE.Mesh(northRoadGeo, northRoadMat)
    northRoad.position.set(0, -1.47, -49)
    northRoad.receiveShadow = true
    scene.add(northRoad)

    // Road center lines (dashed yellow)
    for (let rx = -70; rx < 70; rx += 8) {
      const dashGeo = new THREE.BoxGeometry(4, 0.02, 0.3)
      const dashMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.7 })
      const dash = new THREE.Mesh(dashGeo, dashMat)
      dash.position.set(rx, -1.41, -49)
      scene.add(dash)
    }
    // Road edge lines (white)
    const roadEdgeGeo = new THREE.BoxGeometry(160, 0.02, 0.2)
    const roadEdgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
    const roadEdgeN = new THREE.Mesh(roadEdgeGeo, roadEdgeMat)
    roadEdgeN.position.set(0, -1.41, -40)
    scene.add(roadEdgeN)
    const roadEdgeS = new THREE.Mesh(roadEdgeGeo, roadEdgeMat)
    roadEdgeS.position.set(0, -1.41, -58)
    scene.add(roadEdgeS)

    // Yol yazısı
    const roadLabel = createTextSprite('KUZEY (YOL)', '#fbbf24', 14)
    roadLabel.position.set(0, 0, -49)
    scene.add(roadLabel)

    // --- PETROL OFİSİ (West facade) ---
    const petrolMat = new THREE.MeshStandardMaterial({ color: 0xf0ece3, roughness: 0.35, metalness: 0.1 })
    const petrolBodyGeo = new THREE.BoxGeometry(18, 6, 20)
    const petrolBody = new THREE.Mesh(petrolBodyGeo, petrolMat)
    petrolBody.position.set(-65, 1.5, 0)
    petrolBody.castShadow = true
    petrolBody.receiveShadow = true
    scene.add(petrolBody)

    // Petrol Ofisi canopy (çatı - geniş saçak)
    const canopyGeo = new THREE.BoxGeometry(30, 0.5, 14)
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2, metalness: 0.7 })
    const canopy = new THREE.Mesh(canopyGeo, canopyMat)
    canopy.position.set(-65, 5, 0)
    canopy.castShadow = true
    scene.add(canopy)

    // Petrol Ofisi canopy support pillars
    ;[-10, 10].forEach(z => {
      const pillarGeo = new THREE.CylinderGeometry(0.4, 0.4, 6, 8)
      const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshStandardMaterial({ color: 0x78350f }))
      pillar.position.set(-67, 2, z)
      pillar.castShadow = true
      scene.add(pillar)
    })

    // Petrol Ofisi logo sign
    const petrolLabel = createTextSprite('PETROl OFİSİ', '#fef9c3', 14)
    petrolLabel.position.set(-65, 8, 0)
    scene.add(petrolLabel)

    // Petrol pump stands (2 adet)
    ;[-4, 4].forEach(z => {
      const pumpGeo = new THREE.BoxGeometry(1.2, 3, 0.6)
      const pump = new THREE.Mesh(pumpGeo, new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 }))
      pump.position.set(-57, 0, z)
      pump.castShadow = true
      scene.add(pump)
    })

    // --- BOTANİCA KOMPLEKSİ (East facade - 7 blocks, 18x18x30m each, similar layout to user's site) ---
    const botMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.12,
      metalness: 0.55,
      transparent: true,
      opacity: 0.90
    })
    const botWinMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.05,
      metalness: 0.95,
      transparent: true,
      opacity: 0.65,
      emissive: new THREE.Color(0x1d4ed8),
      emissiveIntensity: 0.18
    })

    // 7 blok koordinatları — A bloğu (z=-20) ve D bloğu (z=20) ile hizalı
    // Kuzey sırası A bloğuyla (z=-20), güney sırası D bloğuyla (z=20) hizalı
    // Parsel doğu sınırı X=45, bloklarımızdan yeterli uzaklıkla X=62'den başlıyoruz
    const botBlocks = [
      // Kuzey sırası — A blok (z=-20) ile hizalı — 4 blok
      { x: 62,  z: -20 },
      { x: 84,  z: -20 },
      { x: 106, z: -20 },
      { x: 128, z: -20 },
      // Güney sırası — D blok (z=20) ile hizalı — 3 blok
      { x: 62,  z: 20 },
      { x: 84,  z: 20 },
      { x: 106, z: 20 },
    ]

    botBlocks.forEach((pos, i) => {
      const bGeo = new THREE.BoxGeometry(18, 30, 18)
      const bMesh = new THREE.Mesh(bGeo, botMat)
      bMesh.position.set(pos.x, 13.5, pos.z)
      bMesh.castShadow = true
      bMesh.receiveShadow = true
      scene.add(bMesh)

      // Edge lines
      const bEdges = new THREE.EdgesGeometry(bGeo)
      const bLine = new THREE.LineSegments(bEdges, new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.28 }))
      bMesh.add(bLine)

      // Window grid (3 cols x 10 rows on the West-facing side)
      for (let floor = 0; floor < 10; floor++) {
        for (let col = 0; col < 3; col++) {
          const wGeo = new THREE.BoxGeometry(0.18, 1.4, 3.2)
          const win = new THREE.Mesh(wGeo, botWinMat)
          win.position.set(pos.x - 9.1, floor * 2.9 + 0.5, pos.z + col * 5 - 5)
          scene.add(win)
        }
      }

      // Kat seviyesi yatay çizgiler
      for (let f = 0; f <= 10; f++) {
        const flGeo = new THREE.BoxGeometry(0.1, 0.1, 18)
        const flMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.2 })
        const flLine = new THREE.Mesh(flGeo, flMat)
        flLine.position.set(pos.x - 9, f * 2.9, pos.z)
        scene.add(flLine)
      }
    })

    // "BOTANİCA KOMPLEKSİ" group label — merkeze hizalı
    const botanicaLabel = createTextSprite('BOTANİCA KOMPLEKSİ', '#93c5fd', 22)
    botanicaLabel.position.set(95, 32, 0)
    scene.add(botanicaLabel)

    const meshesMap = new Map<string, THREE.Mesh>()
    meshesRef.current = meshesMap

    const buildScene = () => {
      meshesMap.forEach((mesh) => scene.remove(mesh))
      meshesMap.clear()

      const blockCenters = {
        B: { x: -24, z: -20 },
        A: { x: 24, z: -20 },
        C: { x: -24, z: 20 },
        D: { x: 24, z: 20 }
      }

      const blockNames = {
        B: 'B BLOK (2+1)',
        A: 'A BLOK (2+1)',
        C: 'C BLOK (1+1)',
        D: 'D BLOK (1+1)'
      }
      for (const [block, name] of Object.entries(blockNames)) {
        if (selectedBlock !== 'Tümü' && selectedBlock !== block) continue
        const center = blockCenters[block as 'A' | 'B' | 'C' | 'D']
        const nameSprite = createTextSprite(name, '#c084fc', 20)
        nameSprite.position.set(center.x, 27, center.z)
        scene.add(nameSprite)
        meshesMap.set(`name-label-${block}`, nameSprite as any)
      }

      for (const block of ['C', 'D'] as const) {
        if (selectedBlock !== 'Tümü' && selectedBlock !== block) continue

        const center = blockCenters[block]
        const entX = center.x
        const entZ = center.z + 3.0
        const entY = 1 * 2.4 - 1.2

        const entGeo = new THREE.BoxGeometry(2.4, 2.0, 2.4)
        const entMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.75,
          metalness: 0.2,
          transparent: true,
          opacity: 0.9
        })
        const entMesh = new THREE.Mesh(entGeo, entMat)
        entMesh.position.set(entX, entY, entZ)
        scene.add(entMesh)
        meshesMap.set(`entrance-${block}`, entMesh)

        const entEdges = new THREE.EdgesGeometry(entGeo)
        const entLine = new THREE.LineSegments(entEdges, new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 }))
        entMesh.add(entLine)

        const entSprite = createTextSprite('BİNA GİRİŞİ', '#10b981', 8)
        entSprite.position.set(entX, entY + 1.8, entZ)
        scene.add(entSprite)
        meshesMap.set(`entrance-label-${block}`, entSprite as any)
      }

      apartments.forEach((apt) => {
        if (selectedBlock !== 'Tümü' && apt.block !== selectedBlock) return

        const center = blockCenters[apt.block]
        const Y = apt.floor * 2.4

        let X = center.x
        let Z = center.z
        let boxWidth = 2.4
        let boxHeight = 2.0
        let boxDepth = 2.4

        if (apt.block === 'C' || apt.block === 'D') {
          const { col, row } = getCDGridCoords(apt.number, apt.floor)
          const X_local = (col - 2) * 3.0
          const Z_local = (row - 1) * 3.0

          X = center.x + X_local
          Z = center.z + Z_local
          boxWidth = 2.4
          boxDepth = 2.4
        } else {
          const { col, row } = getABGridCoords(apt.number)
          const X_local = (col - 1) * 4.2
          const Z_local = (row - 1) * 4.2

          X = center.x + X_local
          Z = center.z + Z_local
          boxWidth = 3.8
          boxDepth = 3.2
        }

        const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth)

        const color = getApartmentColor(apt)
        const material = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.15,
          metalness: 0.35,
          transparent: true,
          opacity: 0.90
        })

        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(X, Y, Z)
        mesh.castShadow = true
        mesh.receiveShadow = true

        const edges = new THREE.EdgesGeometry(geometry)
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }))
        mesh.add(line)

        mesh.userData = { apartment: apt }

        scene.add(mesh)
        meshesMap.set(apt.id, mesh)
      })

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
      const intersect = intersects.find((i) => i.object.userData?.apartment)

      if (intersect) {
        const apt = intersect.object.userData.apartment as Apartment
        setHoveredApartment(apt)
        setTooltipPos({ x: event.clientX + 15, y: event.clientY + 15 })

        const mesh = intersect.object as THREE.Mesh
        const mat = mesh.material as THREE.MeshStandardMaterial
        if (mat && mat.emissive) {
          mat.emissive.setHex(0x3c3c3c)
        }

        meshesMap.forEach((m) => {
          if (m !== mesh && m.material && (m.material as any).emissive) {
            ;(m.material as any).emissive.setHex(0x000000)
          }
        })
      } else {
        setHoveredApartment(null)
        meshesMap.forEach((m) => {
          if (m.material && (m.material as any).emissive) {
            ;(m.material as any).emissive.setHex(0x000000)
          }
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
          oldMat.opacity = 0.90
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
      
      // Camera smooth animation lerping
      if (isAnimatingCamRef.current && targetCamPosRef.current && targetLookAtRef.current) {
        camera.position.lerp(targetCamPosRef.current, 0.07)
        controls.target.lerp(targetLookAtRef.current, 0.07)
        
        if (camera.position.distanceTo(targetCamPosRef.current) < 0.1 && controls.target.distanceTo(targetLookAtRef.current) < 0.1) {
          isAnimatingCamRef.current = false
        }
      }
      
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

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
              Vaziyet, Peyzaj & Arsa Sınır Modeli
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

          {/* Facade Camera Quick buttons HUD */}
          <div className="absolute top-4 left-4 z-20 bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-2xl shadow-xl backdrop-blur-md flex flex-wrap gap-2 max-w-[calc(100%-2rem)]">
            <span className="text-xs font-bold text-slate-400 self-center px-1.5 hidden md:inline">👁️ Hızlı Cephe Bakışı:</span>
            {[
              { name: 'Kuzey (Yol)', color: 'hover:bg-rose-500/20 border-rose-500/30 text-rose-300', cam: { x: 0, y: 25, z: -85 }, target: { x: 0, y: 8, z: 0 } },
              { name: 'Güney (Girişler)', color: 'hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300', cam: { x: 0, y: 25, z: 85 }, target: { x: 0, y: 8, z: 0 } },
              { name: 'Batı (Petrol Ofisi)', color: 'hover:bg-sky-500/20 border-sky-500/30 text-sky-300', cam: { x: -85, y: 25, z: 0 }, target: { x: 0, y: 8, z: 0 } },
              { name: 'Doğu (Botanica)', color: 'hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-300', cam: { x: 85, y: 25, z: 0 }, target: { x: 0, y: 8, z: 0 } },
            ].map((facade) => (
              <button
                key={facade.name}
                onClick={() => triggerCameraAnimation(facade.cam, facade.target)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold bg-slate-900/60 transition-all cursor-pointer ${facade.color}`}
              >
                {facade.name}
              </button>
            ))}
          </div>

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
