'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/app/components/DashboardLayout'
import { api, TelegramUser } from '@/app/lib/api'
import { showToast, confirmAction } from '@/app/utils/toast'
import Link from 'next/link'
import { MessageCircle, Lock, Unlock, Loader2, X, Image as ImageIcon, Video, Music, File, Users, Bot as BotIcon, Tag, Download, Trash2 } from 'lucide-react'
import { useBots } from '@/app/hooks/useBots'
import { useTags } from '@/app/hooks/useTags'
import { useAssignTagsToUser } from '@/app/hooks/useTags'
import { useAllUsersPaged, useBlockUser, useDeleteBotUser, useSendMessageToUser } from '@/app/hooks/useUsers'
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
}: {
  user: TelegramUser
}) {
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [showTagsModal, setShowTagsModal] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  
  const { data: tags } = useTags(user.bot_id)
  const assignTagsMutation = useAssignTagsToUser()
  const sendMessageMutation = useSendMessageToUser()
  const blockUserMutation = useBlockUser()
  const deleteUserMutation = useDeleteBotUser()

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

    setError('')

    try {
      const mediaType = mediaFile ? getMediaType(mediaFile) : null
      await sendMessageMutation.mutateAsync({
        botId: user.bot_id,
        userId: user.id,
        messageText: messageText || '',
        mediaFile,
        mediaType,
      })
      setShowMessageModal(false)
      setMessageText('')
      setMediaFile(null)
      setMediaPreview(null)
      showToast.success('Сообщение отправлено успешно')
    } catch (err: any) {
      setError(err.message || 'Ошибка при отправке сообщения')
      showToast.error(err.message || 'Ошибка при отправке сообщения')
    }
  }

  const handleOpenTagsModal = () => {
    // Инициализируем выбранные теги текущими тегами пользователя
    setSelectedTagIds(user.tags?.map(tag => tag.id) || [])
    setShowTagsModal(true)
  }

  const handleSaveTags = async () => {
    try {
      await assignTagsMutation.mutateAsync({
        botId: user.bot_id,
        userId: user.id,
        tagIds: selectedTagIds,
      })
      setShowTagsModal(false)
      showToast.success('Теги обновлены')
    } catch (err: any) {
      showToast.error(err.message || 'Ошибка при обновлении тегов')
    }
  }

  const handleBlock = async () => {
    const action = user.status === 'blocked' ? 'разблокировать' : 'заблокировать'
    confirmAction(
      `Вы уверены, что хотите ${action} пользователя ${getUserDisplayName(user)}?`,
      async () => {
        try {
          await blockUserMutation.mutateAsync({
            botId: user.bot_id,
            userId: user.id,
            blocked: user.status !== 'blocked',
          })
          showToast.success(`Пользователь ${action === 'заблокировать' ? 'заблокирован' : 'разблокирован'}`)
        } catch (err: any) {
          showToast.error(err.message || 'Ошибка при изменении статуса пользователя')
        }
      }
    )
  }

  const handleDelete = async () => {
    confirmAction(
      `Удалить пользователя ${getUserDisplayName(user)} из базы? Он появится снова, если начнет взаимодействовать с ботом.`,
      async () => {
        try {
          await deleteUserMutation.mutateAsync({
            botId: user.bot_id,
            userId: user.id,
          })
          showToast.success('Пользователь удалён')
        } catch (err: any) {
          showToast.error(err.message || 'Ошибка при удалении пользователя')
        }
      }
    )
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={handleOpenTagsModal}
          className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
          title="Управление тегами"
        >
          <Tag size={16} />
        </button>
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
          disabled={blockUserMutation.isPending}
          title={user.status === 'blocked' ? 'Разблокировать пользователя' : 'Заблокировать пользователя'}
          className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            user.status === 'blocked'
              ? 'bg-green-50 text-green-600 hover:bg-green-100'
              : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
          }`}
        >
          {blockUserMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : user.status === 'blocked' ? <Unlock size={16} /> : <Lock size={16} />}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteUserMutation.isPending}
          title="Удалить пользователя"
          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {deleteUserMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
                  {mediaFile.type.startsWith('image/') && <ImageIcon size={16} className="text-gray-500" />}
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
                disabled={sendMessageMutation.isPending}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {sendMessageMutation.isPending ? 'Отправка...' : 'Отправить'}
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

      {showTagsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              Управление тегами для {getUserDisplayName(user)}
            </h3>
            
            {tags && tags.length > 0 ? (
              <div className="space-y-2 mb-4">
                {tags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id)
                  return (
                    <label
                      key={tag.id}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{
                        borderColor: isSelected ? tag.color : '#e5e7eb',
                        backgroundColor: isSelected ? `${tag.color}10` : 'white',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTagIds([...selectedTagIds, tag.id])
                          } else {
                            setSelectedTagIds(selectedTagIds.filter(id => id !== tag.id))
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{tag.name}</div>
                        {tag.description && (
                          <div className="text-sm text-gray-500">{tag.description}</div>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4">
                Нет доступных тегов. Создайте теги в разделе{' '}
                <Link href="/tags" className="underline font-semibold">
                  Теги
                </Link>
                .
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveTags}
                disabled={assignTagsMutation.isPending}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {assignTagsMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={() => {
                  setShowTagsModal(false)
                  setSelectedTagIds([])
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

function UsersPageInner() {
  const [selectedBotId, setSelectedBotId] = useState<number | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(100)
  const [isExporting, setIsExporting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data: bots } = useBots()
  const { data, isLoading: loading, error: queryError } = useAllUsersPaged(
    selectedBotId,
    statusFilter || undefined,
    sourceFilter || undefined,
    page,
    pageSize
  )
  const users = data?.items || []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const counts = data?.counts || {}
  const totalAll = (counts.active || 0) + (counts.blocked || 0) + (counts.left || 0)

  const error = queryError ? (queryError as Error).message : ''

  // Собираем уникальные источники
  const sources = Array.from(new Set(users.map((u) => u.source).filter(Boolean))) as string[]

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const { blob, filename } = await api.exportUsersCsv(
        selectedBotId,
        statusFilter || undefined,
        sourceFilter || undefined
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      showToast.success('Пользователи выгружены')
    } catch (err: any) {
      showToast.error(err?.message || 'Ошибка выгрузки пользователей')
    } finally {
      setIsExporting(false)
    }
  }

  // Синхронизация фильтров/страницы из query параметров (ссылки)
  useEffect(() => {
    const botIdRaw = searchParams.get('bot_id')
    const statusRaw = searchParams.get('status_filter') || ''
    const sourceRaw = searchParams.get('source_filter') || ''
    const pageRaw = searchParams.get('page') || '1'
    const pageSizeRaw = searchParams.get('page_size') || '100'

    const botIdParsed = botIdRaw ? parseInt(botIdRaw, 10) : undefined
    const pageParsed = parseInt(pageRaw, 10)
    const pageSizeParsed = parseInt(pageSizeRaw, 10)

    setSelectedBotId(Number.isFinite(botIdParsed as any) && (botIdParsed as any) > 0 ? botIdParsed : undefined)
    setStatusFilter(statusRaw)
    setSourceFilter(sourceRaw)
    setPage(Number.isFinite(pageParsed) && pageParsed > 0 ? pageParsed : 1)
    setPageSize(Number.isFinite(pageSizeParsed) && pageSizeParsed > 0 ? pageSizeParsed : 100)
  }, [searchParams])

  const updateUrl = (next: {
    botId?: number
    status?: string
    source?: string
    page?: number
    pageSize?: number
  }) => {
    const p = new URLSearchParams(searchParams.toString())
    if (next.botId) p.set('bot_id', String(next.botId))
    else p.delete('bot_id')
    if (next.status) p.set('status_filter', next.status)
    else p.delete('status_filter')
    if (next.source) p.set('source_filter', next.source)
    else p.delete('source_filter')
    const newPage = next.page && next.page > 0 ? next.page : 1
    p.set('page', String(newPage))
    const newPageSize = next.pageSize && next.pageSize > 0 ? next.pageSize : pageSize
    p.set('page_size', String(newPageSize))
    router.push(`/users?${p.toString()}`)
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
      <div className="space-y-4 sm:space-y-6 -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {selectedBotId 
                ? `Пользователи бота: ${bots?.find(b => b.id === selectedBotId)?.name || bots?.find(b => b.id === selectedBotId)?.username || `Bot #${selectedBotId}`}`
                : 'Пользователи'
              }
            </h1>
            <p className="text-gray-500 mt-1 text-sm sm:text-base">
              {selectedBotId 
                ? 'Управление пользователями выбранного бота'
                : 'Управление пользователями всех ботов'
              }
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-3 py-2 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-xs sm:text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center justify-center gap-2"
              title="Скачать CSV с текущими фильтрами"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Выгрузить CSV
            </button>
            {selectedBotId && (
              <button
                onClick={() => {
                  setSelectedBotId(undefined)
                  router.push('/users')
                }}
                className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
              >
                Показать всех
              </button>
            )}
          </div>
        </div>

        {/* Фильтры */}
        <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Бот</label>
            <select
              value={selectedBotId || ''}
              onChange={(e) => {
                const botId = e.target.value ? parseInt(e.target.value) : undefined
                setSelectedBotId(botId)
                setPage(1)
                updateUrl({
                  botId,
                  status: statusFilter || undefined,
                  source: sourceFilter || undefined,
                  page: 1,
                  pageSize,
                })
              }}
              className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Все боты</option>
              {bots?.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name || bot.username || `Bot #${bot.id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                const v = e.target.value
                setStatusFilter(v)
                setPage(1)
                updateUrl({
                  botId: selectedBotId,
                  status: v || undefined,
                  source: sourceFilter || undefined,
                  page: 1,
                  pageSize,
                })
              }}
              className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Все статусы</option>
              <option value="active">Активен</option>
              <option value="blocked">Заблокирован</option>
              <option value="left">Покинул</option>
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Источник</label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                const v = e.target.value
                setSourceFilter(v)
                setPage(1)
                updateUrl({
                  botId: selectedBotId,
                  status: statusFilter || undefined,
                  source: v || undefined,
                  page: 1,
                  pageSize,
                })
              }}
              className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Все источники</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">На странице</label>
            <select
              value={pageSize}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                const nextSize = Number.isFinite(v) && v > 0 ? v : 100
                setPageSize(nextSize)
                setPage(1)
                updateUrl({
                  botId: selectedBotId,
                  status: statusFilter || undefined,
                  source: sourceFilter || undefined,
                  page: 1,
                  pageSize: nextSize,
                })
              }}
              className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
              <Users size={16} className="text-gray-500 sm:w-5 sm:h-5" />
              <div className="text-xs sm:text-sm text-gray-500">Всего</div>
            </div>
            <div className="text-xl sm:text-2xl font-bold">{totalAll || total}</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
              <div className="w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full"></div>
              <div className="text-xs sm:text-sm text-gray-500">Активных</div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {counts.active ?? users.filter((u) => u.status === 'active').length}
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
              <div className="w-4 h-4 sm:w-5 sm:h-5 bg-red-500 rounded-full"></div>
              <div className="text-xs sm:text-sm text-gray-500">Заблокированных</div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-red-600">
              {counts.blocked ?? users.filter((u) => u.status === 'blocked').length}
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
              <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gray-500 rounded-full"></div>
              <div className="text-xs sm:text-sm text-gray-500">Покинувших</div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-gray-600">
              {counts.left ?? users.filter((u) => u.status === 'left').length}
            </div>
          </div>
        </div>

        {/* Список пользователей */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden -mx-4 sm:mx-0">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 text-sm">
              {error}
            </div>
          )}
          {users.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-gray-500 text-sm sm:text-base">
              {loading ? 'Загрузка...' : 'Нет пользователей'}
            </div>
          ) : (
            <>
              {/* Мобильный вид (карточки) */}
              <div className="md:hidden space-y-2 p-2">
                {users.map((user) => (
                  <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {getUserDisplayName(user)}
                        </div>
                        {user.username && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate">@{user.username}</div>
                        )}
                        {!selectedBotId && (
                          <Link
                            href={`/bots/${user.bot_id}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-1 truncate"
                          >
                            <BotIcon size={12} className="flex-shrink-0" />
                            <span className="truncate">{user.bot_name || `Bot #${user.bot_id}`}</span>
                          </Link>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {getStatusBadge(user.status)}
                        <UserActions
                          user={user}
                        />
                      </div>
                    </div>
                    {user.tags && user.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {user.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                              border: `1px solid ${tag.color}40`,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <span className="truncate">ID: {user.telegram_user_id}</span>
                      {user.source && (
                        <>
                          <span>•</span>
                          <span className="truncate">{user.source}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Десктопный вид (таблица) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:px-3">
                        Пользователь
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:px-3 hidden lg:table-cell">
                        Бот
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:px-3 hidden xl:table-cell">
                        Telegram ID
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:px-3 hidden xl:table-cell">
                        Источник
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:px-3">
                        Статус
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:px-3 hidden 2xl:table-cell">
                        Присоединился
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:px-3 hidden 2xl:table-cell">
                        Последняя активность
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:px-3">
                        Теги
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:px-3">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 lg:px-3">
                          <div className="text-xs lg:text-sm font-medium text-gray-900 max-w-[120px] lg:max-w-[180px] truncate">
                            {getUserDisplayName(user)}
                          </div>
                          {user.username && (
                            <div className="text-xs text-gray-500 truncate max-w-[120px] lg:max-w-[180px]">@{user.username}</div>
                          )}
                        </td>
                        <td className="px-2 py-2 lg:px-3 hidden lg:table-cell">
                          <Link
                            href={`/bots/${user.bot_id}`}
                            className="text-xs lg:text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 max-w-[150px] truncate"
                          >
                            <BotIcon size={12} className="flex-shrink-0" />
                            <span className="truncate">{user.bot_name || `Bot #${user.bot_id}`}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900 lg:px-3 hidden xl:table-cell">
                          {user.telegram_user_id}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900 lg:px-3 hidden xl:table-cell max-w-[100px] truncate">
                          {user.source || '—'}
                        </td>
                        <td className="px-2 py-2 lg:px-3">
                          {getStatusBadge(user.status)}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-500 lg:px-3 hidden 2xl:table-cell whitespace-nowrap">
                          {new Date(user.joined_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-500 lg:px-3 hidden 2xl:table-cell whitespace-nowrap">
                          {new Date(user.last_activity).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-2 py-2 lg:px-3">
                          <div className="flex flex-wrap gap-1 max-w-[100px] lg:max-w-[120px]">
                            {user.tags && user.tags.length > 0 ? (
                              user.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag.id}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: `${tag.color}20`,
                                    color: tag.color,
                                    border: `1px solid ${tag.color}40`,
                                  }}
                                  title={tag.name}
                                >
                                  {tag.name.length > 8 ? `${tag.name.slice(0, 8)}...` : tag.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                            {user.tags && user.tags.length > 2 && (
                              <span className="text-xs text-gray-400" title={user.tags.slice(2).map(t => t.name).join(', ')}>
                                +{user.tags.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 lg:px-3">
                          <UserActions
                            user={user}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Пагинация (ссылки) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-600">
            Всего: <span className="font-medium">{total}</span> • Страница{' '}
            <span className="font-medium">{page}</span> из{' '}
            <span className="font-medium">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                const p = Math.max(1, page - 1)
                setPage(p)
                updateUrl({ botId: selectedBotId, status: statusFilter || undefined, source: sourceFilter || undefined, page: p, pageSize })
              }}
              disabled={page <= 1}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              Назад
            </button>
            {(() => {
              const pages: number[] = []
              const start = Math.max(1, page - 2)
              const end = Math.min(totalPages, page + 2)
              if (start > 1) pages.push(1)
              for (let p = start; p <= end; p++) pages.push(p)
              if (end < totalPages) pages.push(totalPages)

              const uniq = Array.from(new Set(pages))
              const out: JSX.Element[] = []
              let prev = 0
              for (const p of uniq) {
                if (prev && p - prev > 1) {
                  out.push(<span key={`dots-${prev}`} className="px-2 text-gray-400">…</span>)
                }
                out.push(
                  <button
                    key={p}
                    onClick={() => {
                      setPage(p)
                      updateUrl({ botId: selectedBotId, status: statusFilter || undefined, source: sourceFilter || undefined, page: p, pageSize })
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p}
                  </button>
                )
                prev = p
              }
              return out
            })()}
            <button
              onClick={() => {
                const p = Math.min(totalPages, page + 1)
                setPage(p)
                updateUrl({ botId: selectedBotId, status: statusFilter || undefined, source: sourceFilter || undefined, page: p, pageSize })
              }}
              disabled={page >= totalPages}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              Вперёд
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Загрузка...</div>
          </div>
        </DashboardLayout>
      }
    >
      <UsersPageInner />
    </Suspense>
  )
}

