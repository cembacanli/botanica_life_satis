'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@/hooks/useAuth'

export default function AdminPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, addUser, getAllUsers, deleteUser, logout } = useAuth()

  // Tabs: 'users' | 'pricing' | 'progress'
  const [activeTab, setActiveTab] = useState<'users' | 'pricing' | 'progress'>('users')

  // User Management state
  const [users, setUsers] = useState<User[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user')
  const [userError, setUserError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')

  // Bulk Pricing state
  const [bulkBlock, setBulkBlock] = useState<'A' | 'B' | 'C' | 'D' | 'Tümü'>('Tümü')
  const [bulkFloor, setBulkFloor] = useState<string>('Tümü')
  const [bulkFacade] = useState<string>('Tümü') // Facade filter kept default/hidden for simplicity, or visible
  const [bulkOpType, setBulkOpType] = useState<'percentage' | 'fixed'>('percentage')
  const [bulkValue, setBulkValue] = useState<string>('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState('')
  const [bulkErrorMessage, setBulkErrorMessage] = useState('')

  // Construction Progress state
  const [progressEntries, setProgressEntries] = useState<any[]>([])
  const [progressBlock, setProgressBlock] = useState<string>('general')
  const [progressTitle, setProgressTitle] = useState('')
  const [progressDescription, setProgressDescription] = useState('')
  const [progressPercent, setProgressPercent] = useState<string>('')
  const [progressDate, setProgressDate] = useState(new Date().toISOString().slice(0, 10))
  const [progressFile, setProgressFile] = useState<File | null>(null)
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressSuccessMessage, setProgressSuccessMessage] = useState('')
  const [progressErrorMessage, setProgressErrorMessage] = useState('')

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
      loadProgressEntries()
    }
  }, [isAuthenticated, loading, user, router])

  const loadUsers = async () => {
    const allUsers = await getAllUsers()
    setUsers(allUsers)
  }

  const loadProgressEntries = async () => {
    try {
      const res = await fetch('/api/site-progress')
      const data = await res.json()
      setProgressEntries(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load progress entries:', err)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserError('')
    setUserSuccess('')

    if (!newUsername || !newPassword) {
      setUserError('Kullanıcı adı ve şifre zorunludur!')
      return
    }

    if (newPassword.length < 6) {
      setUserError('Şifre en az 6 karakter olmalıdır!')
      return
    }

    if (await addUser(newUsername, newPassword, newRole)) {
      setUserSuccess(`${newUsername} başarıyla eklendi!`)
      setNewUsername('')
      setNewPassword('')
      setNewRole('user')
      await loadUsers()
    } else {
      setUserError('Bu kullanıcı adı zaten kullanılıyor!')
    }
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (userId === user?.id) {
      setUserError('Kendi hesabınızı silemezsiniz!')
      return
    }

    if (confirm(`${username} kullanıcısını silmek istediğinizden emin misiniz?`)) {
      if (await deleteUser(userId)) {
        setUserSuccess(`${username} başarıyla silindi!`)
        await loadUsers()
      } else {
        setUserError('Kullanıcı silinirken bir hata oluştu!')
      }
    }
  }

  const handleBulkPriceUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setBulkSuccessMessage('')
    setBulkErrorMessage('')

    if (bulkValue === '') {
      setBulkErrorMessage('Lütfen bir değer girin!')
      return
    }

    const valNum = Number(bulkValue)
    if (Number.isNaN(valNum)) {
      setBulkErrorMessage('Lütfen geçerli bir sayı girin!')
      return
    }

    const targetDescription = `${bulkBlock === 'Tümü' ? 'Tüm bloklar' : `${bulkBlock} Blok`}${
      bulkFloor === 'Tümü' ? '' : `, ${bulkFloor}. Kat`
    } satıştaki daireler`

    const confirmMsg = `${targetDescription} için fiyatlar ${
      bulkOpType === 'percentage' ? `%${valNum}` : `${new Intl.NumberFormat('tr-TR').format(valNum)} TL`
    } oranında güncellenecektir. Devam etmek istiyor musunuz?`

    if (!confirm(confirmMsg)) return

    setBulkLoading(true)
    try {
      const res = await fetch('/api/apartments/bulk-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block: bulkBlock,
          floor: bulkFloor,
          facade: 'Tümü',
          operationType: bulkOpType,
          value: valNum,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fiyat güncelleme başarısız.')

      setBulkSuccessMessage(data.message || 'Fiyatlar başarıyla güncellendi.')
      setBulkValue('')
    } catch (err: any) {
      setBulkErrorMessage(err.message || 'Bir hata oluştu.')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleAddProgress = async (e: React.FormEvent) => {
    e.preventDefault()
    setProgressSuccessMessage('')
    setProgressErrorMessage('')

    if (!progressTitle) {
      setProgressErrorMessage('Başlık alanı zorunludur!')
      return
    }

    setProgressLoading(true)
    try {
      const formData = new FormData()
      formData.append('block', progressBlock)
      formData.append('title', progressTitle)
      formData.append('description', progressDescription)
      formData.append('progress_percent', String(progressPercent || 0))
      formData.append('date', progressDate)
      if (progressFile) {
        formData.append('file', progressFile)
      }

      const res = await fetch('/api/site-progress', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'İlerleme eklenemedi.')

      setProgressSuccessMessage('Şantiye ilerleme kaydı başarıyla eklendi.')
      setProgressTitle('')
      setProgressDescription('')
      setProgressPercent('')
      setProgressFile(null)

      const fileInput = document.getElementById('progress-file-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      await loadProgressEntries()
    } catch (err: any) {
      setProgressErrorMessage(err.message || 'Bir hata oluştu.')
    } finally {
      setProgressLoading(false)
    }
  }

  const handleDeleteProgress = async (id: string) => {
    if (!confirm('Bu ilerleme kaydını silmek istediğinizden emin misiniz?')) return

    try {
      const res = await fetch('/api/site-progress', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Silme işlemi başarısız.')
      }

      await loadProgressEntries()
    } catch (err: any) {
      alert(err.message)
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Geri Dön
            </button>
            <h1 className="text-4xl font-bold">Admin Paneli</h1>
            <p className="text-white/80 mt-2">Sistem ve İçerik Yönetimi</p>
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
        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 mb-8 gap-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-2 font-medium text-lg border-b-2 transition-all ${
              activeTab === 'users'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            👥 Kullanıcı Yönetimi
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`pb-4 px-2 font-medium text-lg border-b-2 transition-all ${
              activeTab === 'pricing'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            📈 Toplu Fiyat Sihirbazı
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`pb-4 px-2 font-medium text-lg border-b-2 transition-all ${
              activeTab === 'progress'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🏗️ Şantiye İlerlemesi
          </button>
        </div>

        {/* Tab 1: Users */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Yeni Kullanıcı Ekleme */}
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-6">➕ Yeni Kullanıcı Ekle</h2>

              <form onSubmit={handleAddUser} className="space-y-4">
                {userError && (
                  <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-300 text-sm">
                    {userError}
                  </div>
                )}
                {userSuccess && (
                  <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 text-green-300 text-sm">
                    {userSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Kullanıcı Adı</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Örn: satis3"
                  />
                </div>

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

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Rol</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="user" className="bg-gray-800">Kullanıcı</option>
                    <option value="admin" className="bg-gray-800">Admin</option>
                  </select>
                </div>

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
        )}

        {/* Tab 2: Pricing */}
        {activeTab === 'pricing' && (
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">📈 Toplu Fiyatlandırma Sihirbazı</h2>
            <p className="text-gray-300 text-sm mb-6 leading-relaxed">
              Bu sihirbaz, seçtiğiniz blok ve kattaki <strong>yalnızca satılmamış (satışa açık)</strong> dairelerin fiyatlarını toplu olarak artırmanızı veya düşürmenizi sağlar.
            </p>

            <form onSubmit={handleBulkPriceUpdate} className="space-y-6">
              {bulkErrorMessage && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-300 text-sm">
                  {bulkErrorMessage}
                </div>
              )}
              {bulkSuccessMessage && (
                <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 text-green-300 text-sm">
                  {bulkSuccessMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Blok Seçimi</label>
                  <select
                    value={bulkBlock}
                    onChange={(e) => setBulkBlock(e.target.value as any)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Tümü" className="bg-gray-800">Tümü</option>
                    <option value="A" className="bg-gray-800">A Blok</option>
                    <option value="B" className="bg-gray-800">B Blok</option>
                    <option value="C" className="bg-gray-800">C Blok</option>
                    <option value="D" className="bg-gray-800">D Blok</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Kat Seçimi</label>
                  <select
                    value={bulkFloor}
                    onChange={(e) => setBulkFloor(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Tümü" className="bg-gray-800">Tümü</option>
                    {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((fl) => (
                      <option key={fl} value={fl} className="bg-gray-800">{fl}. Kat</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Güncelleme Türü</label>
                <div className="flex gap-4">
                  <label className="flex items-center text-white cursor-pointer gap-2">
                    <input
                      type="radio"
                      name="opType"
                      checked={bulkOpType === 'percentage'}
                      onChange={() => setBulkOpType('percentage')}
                      className="accent-purple-500"
                    />
                    Yüzdesel Değişim (%)
                  </label>
                  <label className="flex items-center text-white cursor-pointer gap-2">
                    <input
                      type="radio"
                      name="opType"
                      checked={bulkOpType === 'fixed'}
                      onChange={() => setBulkOpType('fixed')}
                      className="accent-purple-500"
                    />
                    Sabit Tutar Değişimi (TL)
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {bulkOpType === 'percentage' ? 'Artış / Azalış Yüzdesi (%)' : 'Artış / Azalış Tutarı (TL)'}
                </label>
                <input
                  type="text"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  placeholder={bulkOpType === 'percentage' ? 'Örn: 10 (Artış için) veya -5 (İndirim için)' : 'Örn: 250000 veya -100000'}
                />
              </div>

              <button
                type="submit"
                disabled={bulkLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-medium py-3 px-4 rounded-lg transition-colors mt-6 cursor-pointer"
              >
                {bulkLoading ? 'Fiyatlar Güncelleniyor...' : 'Fiyatları Toplu Güncelle'}
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Progress */}
        {activeTab === 'progress' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Şantiye İlerleme Ekleme */}
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-6">🏗️ Şantiye İlerleme Ekle</h2>

              <form onSubmit={handleAddProgress} className="space-y-4">
                {progressErrorMessage && (
                  <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-300 text-sm">
                    {progressErrorMessage}
                  </div>
                )}
                {progressSuccessMessage && (
                  <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 text-green-300 text-sm">
                    {progressSuccessMessage}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Blok Seçimi</label>
                    <select
                      value={progressBlock}
                      onChange={(e) => setProgressBlock(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="general" className="bg-gray-800">Genel Proje</option>
                      <option value="A" className="bg-gray-800">A Blok</option>
                      <option value="B" className="bg-gray-800">B Blok</option>
                      <option value="C" className="bg-gray-800">C Blok</option>
                      <option value="D" className="bg-gray-800">D Blok</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Tamamlanma Oranı (%)</label>
                    <input
                      type="number"
                      value={progressPercent}
                      onChange={(e) => setProgressPercent(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="Örn: 65"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Başlık / Aşama Adı</label>
                  <input
                    type="text"
                    value={progressTitle}
                    onChange={(e) => setProgressTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Örn: Kaba İnşaat ve Beton Dökümü"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tarih</label>
                  <input
                    type="date"
                    value={progressDate}
                    onChange={(e) => setProgressDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Açıklama</label>
                  <textarea
                    value={progressDescription}
                    onChange={(e) => setProgressDescription(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 h-24"
                    placeholder="Yapılan işlemler hakkında detaylı bilgi..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Fotoğraf Yükle</label>
                  <input
                    id="progress-file-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProgressFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={progressLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors mt-6 cursor-pointer"
                >
                  {progressLoading ? 'Kaydediliyor...' : 'İlerlemeyi Kaydet'}
                </button>
              </form>
            </div>

            {/* Kayıtlı Şantiye Güncellemeleri */}
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-6">📋 Kayıtlı Şantiye Güncellemeleri</h2>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {progressEntries.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Henüz şantiye güncellemesi girilmemiş.</p>
                ) : (
                  progressEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-white/10 rounded-lg p-4 border border-white/10 flex items-start gap-4 hover:border-white/20 transition-colors"
                    >
                      {entry.image_url && (
                        <img
                          src={entry.image_url}
                          alt={entry.title}
                          className="w-20 h-20 object-cover rounded-lg border border-white/10 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-600/30 text-purple-300">
                            {entry.block === 'general' ? 'Genel Proje' : `${entry.block} Blok`}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(entry.date).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                        <h4 className="text-white font-bold truncate">{entry.title}</h4>
                        <p className="text-sm text-gray-300 line-clamp-2 mt-1">{entry.description}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-green-400 font-semibold">
                            İlerleme: %{entry.progress_percent}
                          </span>
                          <button
                            onClick={() => handleDeleteProgress(entry.id)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded transition-colors"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
