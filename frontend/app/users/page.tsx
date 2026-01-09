'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/app/components/DashboardLayout'
import { api, TelegramUser, Bot } from '@/app/lib/api'
import { showToast, confirmAction } from '@/app/utils/toast'
import Link from 'next/link'
import { MessageCircle, Lock, Unlock, Loader2, X, Image, Video, Music, File, Users, Bot as BotIcon } from 'lucide-react'
import { useBots } from '@/app/hooks/useBots'
// Tooltip component removed - using title attribute instead

function getUserDisplayName(user: TelegramUser) {
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim()
  }
  if (user.username) {
    return `@${user.username}`
  }
  return `User #${user.telegram_user_id}`
}

function UserActions({
  user,
  onAction,
}: {
  user: TelegramUser
  onAction: () => void
}) {
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [blockLoading, setBlockLoading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 50 * 1024 * 1024) {
        showToast.error('Размер файла не должен превышать 50MB.')
        setMediaFile(null)
        setMediaPreview(null)
        return
      }
      setMediaFile(file)
      setMediaPreview(URL.createObjectURL(file))
    } else {
      setMediaFile(null)
      setMediaPreview(null)
    }
  }

  const getMediaType = (file: File): string => {
    if (file.type.startsWith('image/')) return 'photo'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    return 'document'
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() && !mediaFile) {
      setError('Введите текст сообщения или прикрепите медиафайл')
      return
    }

    setLoading(true)
    setError('')

    try {
      const mediaType = mediaFile ? getMediaType(mediaFile) : null
      await api.sendMessageToUser(user.bot_id, user.id, messageText || '', mediaFile, mediaType)
      setShowMessageModal(false)
      setMessageText('')
      setMediaFile(null)
      setMediaPreview(null)
      onAction()
      showToast.success('Сообщение отправлено успешно')
    } catch (err: any) {
      setError(err.message || 'Ошибка при отправке сообщения')
      showToast.error(err.message || 'Ошибка при отправке сообщения')
    } finally {
      setLoading(false)
    }
  }

  const handleBlock = async () => {
    const action = user.status === 'blocked' ? 'разблокировать' : 'заблокировать'
    confirmAction(
      `Вы уверены, что хотите ${action} пользователя ${getUserDisplayName(user)}?`,
      async () => {
        setBlockLoading(true)
        try {
          const updatedUser = await api.blockUser(user.bot_id, user.id, user.status !== 'blocked')
          user.status = updatedUser.status
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

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setShowMessageModal(true)}
          disabled={user.status === 'blocked'}
          title={user.status === 'blocked' ? 'Нельзя отправить сообщение заблокированному пользователю' : 'Отправить сообщение'}
          className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <MessageCircle size={16} />
        </button>
        <button
          onClick={handleBlock}
          disabled={blockLoading}
          title={user.status === 'blocked' ? 'Разблокировать пользователя' : 'Заблокировать пользователя'}
          className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            user.status === 'blocked'
              ? 'bg-green-50 text-green-600 hover:bg-green-100'
              : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
          }`}
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
              rows={4}
              maxLength={4096}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 mb-4"
              placeholder="Введите текст сообщения..."
            />

            {/* Media Upload */}
            <div className="mb-4">
              <label htmlFor="media-upload" className="block text-sm font-medium text-gray-700 mb-2">
                Прикрепить медиа (фото, видео, аудио, документ до 50MB)
              </label>
              <input
                type="file"
                id="media-upload"
                accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100"
              />
              {mediaFile && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                  {mediaFile.type.startsWith('image/') && <Image size={16} className="text-gray-500" />}
                  {mediaFile.type.startsWith('video/') && <Video size={16} className="text-gray-500" />}
                  {mediaFile.type.startsWith('audio/') && <Music size={16} className="text-gray-500" />}
                  {!mediaFile.type.startsWith('image/') && !mediaFile.type.startsWith('video/') && !mediaFile.type.startsWith('audio/') && <File size={16} className="text-gray-500" />}
                  <span className="text-sm text-gray-700 truncate">
                    {mediaFile.name} ({Math.round(mediaFile.size / 1024 / 1024)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaFile(null)
                      setMediaPreview(null)
                    }}
                    className="text-red-600 hover:text-red-800 text-sm ml-auto"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
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
                  setMediaPreview(null)
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

export default function UsersPage() {
  const [users, setUsers] = useState<TelegramUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBotId, setSelectedBotId] = useState<number | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [sources, setSources] = useState<string[]>([])

  const { data: bots } = useBots()

  useEffect(() => {
    loadData()
  }, [selectedBotId, statusFilter, sourceFilter])

  const loadData = async () => {
    try {
      setLoading(true)
      const usersData = await api.getAllUsers(
        selectedBotId,
        statusFilter || undefined,
        sourceFilter || undefined
      )
      setUsers(usersData)
      
      // Собираем уникальные источники
      const uniqueSources = Array.from(new Set(usersData.map((u) => u.source).filter(Boolean))) as string[]
      setSources(uniqueSources)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных')
      showToast.error(err.message || 'Ошибка загрузки пользователей')
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

  if (loading && users.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Загрузка...</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Пользователи</h1>
            <p className="text-gray-500 mt-1">Управление пользователями всех ботов</p>
          </div>
        </div>

        {/* Фильтры */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Бот</label>
            <select
              value={selectedBotId || ''}
              onChange={(e) => setSelectedBotId(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Все боты</option>
              {bots?.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name || bot.username || `Bot #${bot.id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className="text-gray-500" />
              <div className="text-sm text-gray-500">Всего пользователей</div>
            </div>
            <div className="text-2xl font-bold">{users.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-green-500 rounded-full"></div>
              <div className="text-sm text-gray-500">Активных</div>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {users.filter((u) => u.status === 'active').length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-red-500 rounded-full"></div>
              <div className="text-sm text-gray-500">Заблокированных</div>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {users.filter((u) => u.status === 'blocked').length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-gray-500 rounded-full"></div>
              <div className="text-sm text-gray-500">Покинувших</div>
            </div>
            <div className="text-2xl font-bold text-gray-600">
              {users.filter((u) => u.status === 'left').length}
            </div>
          </div>
        </div>

        {/* Список пользователей */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3">
              {error}
            </div>
          )}
          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {loading ? 'Загрузка...' : 'Нет пользователей'}
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
                      Бот
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
                        {user.tags && user.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {user.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="px-2 py-0.5 rounded text-xs"
                                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/bots/${user.bot_id}`}
                          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <BotIcon size={14} />
                          {user.bot_name || `Bot #${user.bot_id}`}
                        </Link>
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

