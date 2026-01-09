'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashboardLayout from '@/app/components/DashboardLayout'
import { api, TelegramUser, Bot } from '@/app/lib/api'
import { showToast, confirmAction } from '@/app/utils/toast'
import Link from 'next/link'
import { MessageCircle, Lock, Unlock, Loader2, X } from 'lucide-react'

function getUserDisplayName(user: TelegramUser) {
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim()
  }
  if (user.username) {
    return `@${user.username}`
  }
  return `User #${user.telegram_user_id}`
}

export default function BotUsersPage() {
  const params = useParams()
  const router = useRouter()
  const botId = Number(params.id)
  const [users, setUsers] = useState<TelegramUser[]>([])
  const [bot, setBot] = useState<Bot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [sources, setSources] = useState<string[]>([])

  useEffect(() => {
    if (botId) {
      loadData()
    }
  }, [botId, statusFilter, sourceFilter])

  const loadData = async () => {
    try {
      setLoading(true)
      const [usersData, botData] = await Promise.all([
        api.getBotUsers(botId, statusFilter || undefined, sourceFilter || undefined),
        api.getBot(botId),
      ])
      setUsers(usersData)
      setBot(botData)
      
      // Собираем уникальные источники
      const uniqueSources = Array.from(new Set(usersData.map((u) => u.source).filter(Boolean))) as string[]
      setSources(uniqueSources)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      blocked: 'bg-red-100 text-red-800',
      left: 'bg-gray-100 text-gray-800',
    }
    const labels: Record<string, string> = {
      active: 'Активен',
      blocked: 'Заблокирован',
      left: 'Покинул',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.active}`}>
        {labels[status] || status}
      </span>
    )
  }


  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Загрузка...</div>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !bot) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Бот не найден'}
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Link href="/bots" className="text-indigo-600 hover:text-indigo-800 mb-2 inline-block">
              ← Назад к ботам
            </Link>
            <h1 className="text-3xl font-bold">
              Пользователи бота: {bot.name || bot.username || `Bot #${bot.id}`}
            </h1>
          </div>
        </div>

        {/* Фильтры */}
        <div className="bg-white p-4 rounded-lg shadow flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Все статусы</option>
              <option value="active">Активен</option>
              <option value="blocked">Заблокирован</option>
              <option value="left">Покинул</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Источник</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Все источники</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Всего пользователей</div>
            <div className="text-2xl font-bold mt-2">{users.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Активных</div>
            <div className="text-2xl font-bold mt-2 text-green-600">
              {users.filter((u) => u.status === 'active').length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Заблокированных</div>
            <div className="text-2xl font-bold mt-2 text-red-600">
              {users.filter((u) => u.status === 'blocked').length}
            </div>
          </div>
        </div>

        {/* Список пользователей */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Нет пользователей для этого бота.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Пользователь
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Telegram ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Источник
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Присоединился
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Последняя активность
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getUserDisplayName(user)}
                        </div>
                        {user.username && (
                          <div className="text-sm text-gray-500">@{user.username}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.telegram_user_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.source || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(user.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.joined_at).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.last_activity).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <UserActions
                          user={user}
                          botId={botId}
                          onAction={() => loadData()}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

function UserActions({
  user,
  botId,
  onAction,
}: {
  user: TelegramUser
  botId: number
  onAction: () => void
}) {
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [blockLoading, setBlockLoading] = useState(false)
  
  // Функция для определения типа медиа по расширению файла
  const getMediaType = (file: File): string => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return 'photo'
    }
    if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) {
      return 'video'
    }
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
      return 'audio'
    }
    return 'document'
  }
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Проверяем размер файла (максимум 50MB для Telegram)
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        setError('Размер файла не должен превышать 50MB')
        return
      }
      setMediaFile(file)
      setError('')
    }
  }

  const handleBlock = async () => {
    const action = user.status === 'blocked' ? 'разблокировать' : 'заблокировать'
    confirmAction(
      `Вы уверены, что хотите ${action} пользователя ${getUserDisplayName(user)}?`,
      async () => {
        setBlockLoading(true)
        try {
          const updatedUser = await api.blockUser(botId, user.id, user.status !== 'blocked')
          // Обновляем локальное состояние пользователя
          user.status = updatedUser.status
          // Перезагружаем данные для обновления UI
          onAction()
          showToast.success(`Пользователь ${action === 'заблокировать' ? 'заблокирован' : 'разблокирован'}`)
        } catch (err: any) {
          showToast.error(err.message || 'Ошибка при изменении статуса пользователя')
        } finally {
          setBlockLoading(false)
        }
      }
    )
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() && !mediaFile) {
      setError('Введите текст сообщения или выберите медиа файл')
      return
    }

    setLoading(true)
    setError('')

    try {
      const mediaType = mediaFile ? getMediaType(mediaFile) : null
      await api.sendMessageToUser(botId, user.id, messageText || '', mediaFile, mediaType)
      setShowMessageModal(false)
      setMessageText('')
      setMediaFile(null)
      onAction()
      showToast.success('Сообщение отправлено успешно')
    } catch (err: any) {
      setError(err.message || 'Ошибка при отправке сообщения')
      showToast.error(err.message || 'Ошибка при отправке сообщения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setShowMessageModal(true)}
          disabled={user.status === 'blocked'}
          className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={user.status === 'blocked' ? 'Нельзя отправить сообщение заблокированному пользователю' : 'Отправить сообщение'}
        >
          <MessageCircle size={16} />
        </button>
        <button
          onClick={handleBlock}
          disabled={blockLoading}
          className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            user.status === 'blocked'
              ? 'bg-green-50 text-green-600 hover:bg-green-100'
              : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
          }`}
          title={user.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}
        >
          {blockLoading ? <Loader2 size={16} className="animate-spin" /> : user.status === 'blocked' ? <Unlock size={16} /> : <Lock size={16} />}
        </button>
      </div>

      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">
              Отправить сообщение пользователю {getUserDisplayName(user)}
            </h3>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={6}
              maxLength={4096}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 mb-4"
              placeholder="Введите текст сообщения..."
            />
            
            {/* Медиа файл */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Медиа файл (необязательно)
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {mediaFile && (
                <div className="mt-2 flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-sm text-gray-700">
                    {mediaFile.name} ({(mediaFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => setMediaFile(null)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Поддерживаются: изображения, видео, аудио, документы (макс. 50MB)
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleSendMessage}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Отправка...' : 'Отправить'}
              </button>
              <button
                onClick={() => {
                  setShowMessageModal(false)
                  setMessageText('')
                  setMediaFile(null)
                  setError('')
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

