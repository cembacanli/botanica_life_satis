'use client'

import { useEffect, useState } from 'react'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  const [initialized, setInitialized] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    initializeDatabase()
  }, [])

  const initializeDatabase = async () => {
    try {
      const response = await fetch('/api/init')
      const data = await response.json()
      console.log('Database initialized:', data)
      setInitialized(true)
    } catch (error) {
      console.error('Error initializing database:', error)
      setInitialized(true) // Hata olsa da devam et
    } finally {
      setInitializing(false)
    }
  }

  if (initializing) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return <Dashboard />
}
