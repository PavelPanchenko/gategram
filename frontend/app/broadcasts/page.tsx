'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/app/components/DashboardLayout'
import { Broadcast } from '@/app/lib/api'
import { useBroadcastsPaged, useDeleteBroadcast, useCancelBroadcast } from '@/app/hooks/useBroadcasts'
import { useBots } from '@/app/hooks/useBots'
import { showToast } from '@/app/utils/toast'
import ConfirmModal from '@/app/components/ConfirmModal'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'

function BroadcastsPageInner() {
  const [selectedBotId, setSelectedBotId] = useState<number | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useBroadcastsPaged(selectedBotId, statusFilter || undefined, page, pageSize)
  const broadcasts = data?.items || []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const { data: bots = [] } = useBots()
  const deleteBroadcast = useDeleteBroadcast()
  const cancelBroadcast = useCancelBroadcast()
  
  const error = queryError ? (queryError as Error).message : ''
  
  // Состояние для модального окна подтверждения
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    showDeleteMessages?: boolean
    action?: 'cancel' | 'delete' | null
    broadcastId?: number | null
  }>({
    isOpen: false,
    title: '',
    message: '',
    showDeleteMessages: false,
    action: null,
    broadcastId: null,
  })
  
  const [deleteMessages, setDeleteMessages] = useState(false)

  // Синхронизация фильтров/страницы из query параметров (ссылки)
  useEffect(() => {
    const botIdRaw = searchParams.get('bot_id')
    const statusRaw = searchParams.get('status_filter') || ''
    const pageRaw = searchParams.get('page') || '1'
    const pageSizeRaw = searchParams.get('page_size') || '50'

    const botIdParsed = botIdRaw ? parseInt(botIdRaw, 10) : undefined
    const pageParsed = parseInt(pageRaw, 10)
    const pageSizeParsed = parseInt(pageSizeRaw, 10)

    setSelectedBotId(Number.isFinite(botIdParsed as any) && (botIdParsed as any) > 0 ? botIdParsed : undefined)
    setStatusFilter(statusRaw)
    setPage(Number.isFinite(pageParsed) && pageParsed > 0 ? pageParsed : 1)
    setPageSize(Number.isFinite(pageSizeParsed) && pageSizeParsed > 0 ? pageSizeParsed : 50)
  }, [searchParams])

  const updateUrl = (next: { botId?: number; status?: string; page?: number; pageSize?: number }) => {
    const p = new URLSearchParams(searchParams.toString())
    if (next.botId) p.set('bot_id', String(next.botId))
    else p.delete('bot_id')
    if (next.status) p.set('status_filter', next.status)
    else p.delete('status_filter')
    const newPage = next.page && next.page > 0 ? next.page : 1
    p.set('page', String(newPage))
    const newPageSize = next.pageSize && next.pageSize > 0 ? next.pageSize : pageSize
    p.set('page_size', String(newPageSize))
    router.push(`/broadcasts?${p.toString()}`)
  }

  const handleCancel = async (broadcastId: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Отменить рассылку',
      message: 'Вы уверены, что хотите отменить эту рассылку?',
      confirmText: 'Отменить',
      showDeleteMessages: false,
      action: 'cancel',
      broadcastId,
    })
  }

  const handleDelete = async (broadcastId: number) => {
    setDeleteMessages(false) // Сбрасываем чекбокс
    setConfirmModal({
      isOpen: true,
      title: 'Удалить рассылку',
      message: 'Вы уверены, что хотите удалить эту рассылку? Это действие нельзя отменить.',
      confirmText: 'Удалить',
      showDeleteMessages: true,
      action: 'delete',
      broadcastId,
    })
  }

  const handleConfirm = async () => {
    const action = confirmModal.action
    const broadcastId = confirmModal.broadcastId

    setConfirmModal((prev) => ({ ...prev, isOpen: false }))

    if (!action || !broadcastId) return

    try {
      if (action === 'cancel') {
        await cancelBroadcast.mutateAsync(broadcastId)
        showToast.success('Рассылка отменена')
        return
      }

      // action === 'delete'
      const shouldDeleteMessages = deleteMessages
      await deleteBroadcast.mutateAsync({
        broadcastId,
        deleteMessages: shouldDeleteMessages,
      })
      showToast.success('Рассылка удалена' + (shouldDeleteMessages ? ' вместе с сообщениями' : ''))
      setDeleteMessages(false)
    } catch (err: any) {
      showToast.error(err.message || 'Ошибка операции')
    }
  }

  const getStatusBadge = (status: string, scheduledAt?: string | null) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      scheduled: 'bg-blue-100 text-blue-800',
      sending: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    }
    const labels: Record<string, string> = {
      pending: 'Ожидает',
      scheduled: 'Запланирована',
      sending: 'Отправляется',
      completed: 'Завершена',
      failed: 'Ошибка',
      cancelled: 'Отменена',
    }
    
    const badge = (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
        {labels[status] || status}
      </span>
    )
    
    // Если статус "Запланирована" и есть время, показываем tooltip при наведении
    if (status === 'scheduled' && scheduledAt) {
      // scheduledAt приходит в UTC, конвертируем в локальное время
      const scheduledDate = new Date(scheduledAt)
      const formattedDate = scheduledDate.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      })
      
      return (
        <div className="relative group">
          {badge}
          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10">
            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              Запланировано на: {formattedDate}
              <div className="absolute left-2 top-full -mt-1 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      )
    }
    
    return badge
  }

  const getBotName = (botId: number) => {
    const bot = bots.find((b) => b.id === botId)
    return bot?.name || bot?.username || `Bot #${botId}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Рассылки</h1>
        <Link
          href="/broadcasts/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          + Создать рассылку
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Фильтры */}
      <div className="bg-white p-4 rounded-lg shadow flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Бот</label>
          <select
            value={selectedBotId || ''}
            onChange={(e) => {
              const botId = e.target.value ? Number(e.target.value) : undefined
              setSelectedBotId(botId)
              setPage(1)
              updateUrl({ botId, status: statusFilter || undefined, page: 1, pageSize })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Все боты</option>
            {bots.map((bot) => (
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
            onChange={(e) => {
              const v = e.target.value
              setStatusFilter(v)
              setPage(1)
              updateUrl({ botId: selectedBotId, status: v || undefined, page: 1, pageSize })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Все статусы</option>
            <option value="pending">Ожидает</option>
            <option value="scheduled">Запланирована</option>
            <option value="sending">Отправляется</option>
            <option value="completed">Завершена</option>
            <option value="failed">Ошибка</option>
            <option value="cancelled">Отменена</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">На странице</label>
          <select
            value={pageSize}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              const nextSize = Number.isFinite(v) && v > 0 ? v : 50
              setPageSize(nextSize)
              setPage(1)
              updateUrl({ botId: selectedBotId, status: statusFilter || undefined, page: 1, pageSize: nextSize })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      {/* Список рассылок */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {broadcasts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Нет рассылок. Создайте первую рассылку.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Бот
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сообщение
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Прогресс
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Создана
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {broadcasts.map((broadcast) => (
                <tr key={broadcast.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    #{broadcast.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getBotName(broadcast.bot_id)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {broadcast.message_text}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(broadcast.status, broadcast.scheduled_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {broadcast.sent_count} / {broadcast.total_users}
                    {broadcast.failed_count > 0 && (
                      <span className="text-red-600 ml-1">({broadcast.failed_count} ошибок)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(broadcast.created_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      {(broadcast.status === 'pending' || broadcast.status === 'scheduled') && (
                        <button
                          onClick={() => handleCancel(broadcast.id)}
                          className="text-yellow-600 hover:text-yellow-900 text-xs"
                        >
                          Отменить
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(broadcast.id)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Удалить рассылку"
                        disabled={deleteBroadcast.isPending}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              updateUrl({ botId: selectedBotId, status: statusFilter || undefined, page: p, pageSize })
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
                    updateUrl({ botId: selectedBotId, status: statusFilter || undefined, page: p, pageSize })
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
              updateUrl({ botId: selectedBotId, status: statusFilter || undefined, page: p, pageSize })
            }}
            disabled={page >= totalPages}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            Вперёд
          </button>
        </div>
      </div>
      
      {/* Модальное окно подтверждения */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={handleConfirm}
        onCancel={() => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }))
          setDeleteMessages(false)
        }}
        confirmText={confirmModal.confirmText}
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      >
        {confirmModal.showDeleteMessages && (
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md border border-gray-200">
            <input
              type="checkbox"
              id="delete-messages"
              checked={deleteMessages}
              onChange={(e) => setDeleteMessages(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="delete-messages" className="text-sm text-gray-700 cursor-pointer">
              Удалить также сообщения из бота у всех пользователей
            </label>
          </div>
        )}
      </ConfirmModal>
    </div>
    </DashboardLayout>
  )
}

export default function BroadcastsPage() {
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
      <BroadcastsPageInner />
    </Suspense>
  )
}

