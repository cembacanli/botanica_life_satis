'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@/hooks/useAuth'

export default function AdminPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, addUser, getAllUsers, deleteUser, logout } = useAuth()

  const [users, setUsers] = useState<User[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/login')
        return
      }

      if (user?.role !== 'admin') {
        router.push('/')
        return
      }

      loadUsers()
    }
  }, [isAuthenticated, loading, user, router])

  const loadUsers = async () => {
    const allUsers = await getAllUsers()
    setUsers(allUsers)
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!newUsername || !newPassword) {
      setError('Kullanıcı adı ve şifre zorunludur!')
      return
    }

    if (newPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır!')
      return
    }

    if (await addUser(newUsername, newPassword, newRole)) {
      setSuccess(`${newUsername} başarıyla eklendi!`)
      setNewUsername('')
      setNewPassword('')
      setNewRole('user')
      await loadUsers()
    } else {
      setError('Bu kullanıcı adı zaten kullanılıyor!')
    }
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (userId === user?.id) {
      setError('Kendi hesabınızı silemezsiniz!')
      return
    }

    if (confirm(`${username} kullanıcısını silmek istediğinizden emin misiniz?`)) {
      if (await deleteUser(userId)) {
        setSuccess(`${username} başarıyla silindi!`)
        await loadUsers()
      } else {
        setError('Kullanıcı silinirken bir hata oluştu!')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-400 text-white py-8">
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push('/')}
              className="mb-4 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Geri Dön
            </button>
            <h1 className="text-4xl font-bold">Admin Paneli</h1>
            <p className="text-white/80 mt-2">Kullanıcı Yönetimi</p>
          </div>
          <button
            onClick={() => {
              logout()
              router.push('/login')
            }}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Mevcut Kullanıcı Bilgisi */}
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10 mb-8">
          <p className="text-gray-300">
            <span className="font-medium text-white">Giriş Yapan:</span> {user?.username}{' '}
            <span className="text-purple-400">({user?.role === 'admin' ? 'Admin' : 'Kullanıcı'})</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Yeni Kullanıcı Ekleme */}
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-6">➕ Yeni Kullanıcı Ekle</h2>

            <form onSubmit={handleAddUser} className="space-y-4">
              {/* Hata/Başarı Mesajları */}
              {error && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-300 text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 text-green-300 text-sm">
                  {success}
                </div>
              )}

              {/* Kullanıcı Adı */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Örn: satis3"
                />
              </div>

              {/* Şifre */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Şifre</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Şifreyi girin"
                />
              </div>

              {/* Rol */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rol</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="user" className="bg-gray-800">
                    Kullanıcı
                  </option>
                  <option value="admin" className="bg-gray-800">
                    Admin
                  </option>
                </select>
              </div>

              {/* Ekle Butonu */}
              <button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors mt-6"
              >
                Kullanıcı Ekle
              </button>
            </form>
          </div>

          {/* Mevcut Kullanıcılar */}
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-6">👥 Mevcut Kullanıcılar</h2>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="bg-white/10 rounded-lg p-4 border border-white/10 flex items-center justify-between hover:border-white/20 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-white">{u.username}</p>
                    <p className="text-sm text-gray-400">
                      {u.role === 'admin' ? '👤 Admin' : '👤 Kullanıcı'}
                    </p>
                  </div>
                  {user?.id !== u.id && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.username)}
                      className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                    >
                      Sil
                    </button>
                  )}
                  {user?.id === u.id && (
                    <span className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded">
                      (Siz)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
