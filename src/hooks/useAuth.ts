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

const DEFAULT_USERS: User[] = [
  {
    id: '1',
    username: 'cem',
    password: '2127030cem',
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    username: 'satis1',
    password: '2127030satis1',
    role: 'user',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    username: 'satis2',
    password: '2127030satis2',
    role: 'user',
    createdAt: new Date().toISOString(),
  },
]

const STORAGE_KEY = 'auth_users'
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

  const getStoredUsers = (): User[] => {
    if (typeof window === 'undefined') return DEFAULT_USERS
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USERS))
      return DEFAULT_USERS
    }
    try {
      return JSON.parse(stored)
    } catch {
      return DEFAULT_USERS
    }
  }

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

  const login = (username: string, password: string): boolean => {
    const users = getStoredUsers()
    const user = users.find(u => u.username === username && u.password === password)

    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
      setAuthState({
        user,
        isAuthenticated: true,
      })
      return true
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

  const addUser = (username: string, password: string, role: 'admin' | 'user' = 'user'): boolean => {
    const users = getStoredUsers()

    // Kullanıcı zaten varsa eklememe
    if (users.find(u => u.username === username)) {
      return false
    }

    const newUser: User = {
      id: Date.now().toString(),
      username,
      password,
      role,
      createdAt: new Date().toISOString(),
    }

    users.push(newUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
    return true
  }

  const getAllUsers = (): User[] => {
    return getStoredUsers()
  }

  const deleteUser = (userId: string): boolean => {
    const users = getStoredUsers()
    const filtered = users.filter(u => u.id !== userId)

    if (filtered.length === users.length) {
      return false // Kullanıcı bulunamadı
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    return true
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
