export interface Apartment {
  id: string
  block: 'A' | 'B' | 'C' | 'D'
  floor: number
  number: number
  facade: 'ana_yol' | 'arka_cephe'
  area: number
  type: string
  price: number
  status: 'available' | 'reserved' | 'deposited' | 'sold'
  created_at: string
}

interface ApartmentData {
  block: 'A' | 'B' | 'C' | 'D'
  floor: number
  number: number
  facade: 'ana_yol' | 'arka_cephe'
  area: number
  type: string
  price: number
  status: 'available' | 'reserved' | 'deposited' | 'sold'
}

export function generateApartments(): ApartmentData[] {
  const apartments: ApartmentData[] = []

  // A ve B Blokları: 90m² 2+1 daire - Kat bazlı fiyatlandırma
  const abBlockPrices: Record<number, number> = {
    1: 4_500_000,
    2: 4_600_000,
    3: 4_700_000,
    4: 4_700_000,
    5: 4_750_000,
    6: 4_750_000,
    7: 4_800_000,
    8: 4_850_000,
    9: 4_850_000,
    10: 4_900_000,
  }

  for (const block of ['A', 'B'] as const) {
    let apartmentNumber = 0
    for (let floor = 1; floor <= 10; floor++) {
      const floorPrice = abBlockPrices[floor]
      
      // Ana yol cephesi (3 daire)
      for (let i = 1; i <= 3; i++) {
        apartmentNumber++
        apartments.push({
          block,
          floor,
          number: apartmentNumber,
          facade: 'ana_yol',
          area: 90,
          type: '2+1',
          price: floorPrice,
          status: 'available',
        })
      }

      // Arka cephe (3 daire)
      for (let i = 4; i <= 6; i++) {
        apartmentNumber++
        apartments.push({
          block,
          floor,
          number: apartmentNumber,
          facade: 'arka_cephe',
          area: 90,
          type: '2+1',
          price: floorPrice,
          status: 'available',
        })
      }
    }
  }

  // C ve D Blokları: 45m² 1+1 daire - Kat bazlı fiyatlandırma
  const cdBlockPrices: Record<number, number> = {
    1: 2_500_000,
    2: 2_600_000,
    3: 2_600_000,
    4: 2_650_000,
    5: 2_650_000,
    6: 2_650_000,
    7: 2_650_000,
    8: 2_700_000,
    9: 2_750_000,
    10: 2_800_000,
  }

  for (const block of ['C', 'D'] as const) {
    let apartmentNumber = 0
    for (let floor = 1; floor <= 10; floor++) {
      const floorPrice = cdBlockPrices[floor]
      const floorUnits = floor === 1 ? 11 : 12
      
      for (let i = 1; i <= floorUnits; i++) {
        apartmentNumber++
        const facade = i <= 6 ? 'ana_yol' : 'arka_cephe'
        apartments.push({
          block,
          floor,
          number: apartmentNumber,
          facade,
          area: 45,
          type: '1+1',
          price: floorPrice,
          status: 'available',
        })
      }
    }
  }

  return apartments
}
