import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Daire Satış Programı',
  description: 'Modern daire satış yönetim sistemi',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
