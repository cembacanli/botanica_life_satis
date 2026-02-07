import type { Metadata } from 'next'
import './globals.css'
import ClientMount from '@/components/ClientMount'

export const metadata: Metadata = {
  title: 'Daire Satış Programı',
  description: 'Modern daire satış yönetim sistemi',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0ea5a4" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-gray-50">
        {children}
        {/* Client-side mount for install prompt */}
        {/* @ts-ignore Server Component can render client component import */}
        <ClientMount />
      </body>
    </html>
  )
}
