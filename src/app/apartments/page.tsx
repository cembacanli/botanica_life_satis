import { Metadata } from 'next'
import ApartmentsList from '@/components/ApartmentsList'

export const metadata: Metadata = {
  title: 'Daireler | Satış Programı',
  description: 'Tüm satılık daireleri göz at',
}

export default function ApartmentsPage() {
  return <ApartmentsList />
}
