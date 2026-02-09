import { useState, useEffect } from 'react'

export interface User {
  id: string
  username: string
  password: string
  role: 'admin' | 'user'
  createdAt: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

const CURRENT_USER_KEY = 'current_user'

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  })
  const [loading, setLoading] = useState(true)

  // Başlangıçta kullanıcıları ve oturumu yükle
  useEffect(() => {
    const users = getStoredUsers()
    const currentUser = getStoredCurrentUser()

    if (currentUser) {
      setAuthState({
        user: currentUser,
        isAuthenticated: true,
      })
    }
    setLoading(false)
  }, [])

  const getStoredCurrentUser = (): User | null => {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem(CURRENT_USER_KEY)
    if (!stored) return null
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      const user = data?.user as User | undefined

      if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
        setAuthState({
          user,
          isAuthenticated: true,
        })
        return true
      }
    } catch (error) {
      console.error('Login error:', error)
    }

    return false
  }

  const logout = () => {
    localStorage.removeItem(CURRENT_USER_KEY)
    setAuthState({
      user: null,
      isAuthenticated: false,
    })
  }

  const addUser = async (
    username: string,
    password: string,
    role: 'admin' | 'user' = 'user'
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      })

      return response.ok
    } catch (error) {
      console.error('Add user error:', error)
      return false
    }
  }

  const getAllUsers = async (): Promise<User[]> => {
    try {
      const response = await fetch('/api/users')
      if (!response.ok) return []
      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error('Get users error:', error)
      return []
    }
  }

  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId }),
      })

      return response.ok
    } catch (error) {
      console.error('Delete user error:', error)
      return false
    }
  }

  return {
    ...authState,
    loading,
    login,
    logout,
    addUser,
    getAllUsers,
    deleteUser,
  }
}
