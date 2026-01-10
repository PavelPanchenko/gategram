'use client'

import { useState } from 'react'
import DashboardLayout from '@/app/components/DashboardLayout'
import { Bot } from '@/app/lib/api'
import { useBots, useStartBot, useStopBot, useDeleteBot } from '@/app/hooks/useBots'
import { showToast, confirmAction } from '@/app/utils/toast'
import Link from 'next/link'
import { Edit2, Users, Play, Pause, Trash2, Plus } from 'lucide-react'

export default function BotsPage() {
  const { data: bots, isLoading: loading } = useBots()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const startBot = useStartBot()
  const stopBot = useStopBot()
  const deleteBot = useDeleteBot()

  const handleToggleBot = async (bot: Bot) => {
    try {
      if (bot.is_active) {
        stopBot.mutate(bot.id)
      } else {
        startBot.mutate(bot.id)
      }
    } catch (error: any) {
      showToast.error(error.message || 'Ошибка при изменении статуса бота')
    }
  }

  const handleDelete = async (botId: number) => {
    confirmAction(
      'Вы уверены, что хотите удалить этого бота?',
      () => {
        deleteBot.mutate(botId)
      }
    )
  }

  return (
    <DashboardLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Управление ботами</h1>
          <Link
            href="/bots/new"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span>Создать бота</span>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">Загрузка...</div>
        ) : bots.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500 mb-4">У вас пока нет ботов</p>
            <Link
              href="/bots/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              <span>Создать первого бота</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => (
              <div key={bot.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {bot.name || bot.username || `Bot #${bot.id}`}
                    </h3>
                    <p className="text-sm text-gray-500">@{bot.username || 'нет username'}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      bot.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {bot.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  {bot.welcome_message && (
                    <div>
                      <span className="font-medium text-gray-700">Welcome:</span>{' '}
                      <span className="truncate block text-gray-600">{bot.welcome_message.substring(0, 50)}...</span>
                    </div>
                  )}
                  {bot.channel_link && (
                    <div>
                      <span className="font-medium text-gray-700">Канал:</span>{' '}
                      <a
                        href={bot.channel_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        Открыть
                      </a>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-gray-700">Задержка:</span> {bot.interaction_delay_seconds}с
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/bots/${bot.id}`}
                    className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                    title="Редактировать"
                  >
                    <Edit2 size={16} />
                  </Link>
                  <Link
                    href="/users"
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    title="Пользователи"
                  >
                    <Users size={16} />
                  </Link>
                  <button
                    onClick={() => handleToggleBot(bot)}
                    disabled={startBot.isPending || stopBot.isPending}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                      bot.is_active
                        ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                    title={bot.is_active ? 'Остановить' : 'Запустить'}
                  >
                    {bot.is_active ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    onClick={() => handleDelete(bot.id)}
                    disabled={deleteBot.isPending}
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

