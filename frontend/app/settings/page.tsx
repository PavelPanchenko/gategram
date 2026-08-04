'use client'

import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '@/app/components/DashboardLayout'
import { useBots } from '@/app/hooks/useBots'
import {
  api,
  NotificationRecipient,
  NotificationSettings,
} from '@/app/lib/api'
import { showToast } from '@/app/utils/toast'
import { Settings, Send, Info } from 'lucide-react'

function recipientLabel(u: {
  username: string | null
  first_name: string | null
  last_name: string | null
  telegram_user_id?: string
}): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  if (u.username && name) return `${name} (@${u.username})`
  if (u.username) return `@${u.username}`
  if (name) return name
  return u.telegram_user_id ? `ID ${u.telegram_user_id}` : 'Без имени'
}

export default function SettingsPage() {
  const { data: bots, isLoading: botsLoading } = useBots()
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [botId, setBotId] = useState<number | ''>('')
  const [recipientId, setRecipientId] = useState<number | ''>('')

  const loadRecipients = useCallback(async (selectedBotId: number) => {
    try {
      const list = await api.getNotificationRecipients(selectedBotId)
      setRecipients(list)
    } catch (error: any) {
      setRecipients([])
      showToast.error(error.message || 'Не удалось загрузить получателей')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.getNotificationSettings()
        if (cancelled) return
        setSettings(data)
        setEnabled(data.error_notifications_enabled)
        setBotId(data.notify_bot_id ?? '')
        setRecipientId(data.notify_telegram_user_id ?? '')
        if (data.notify_bot_id) {
          await loadRecipients(data.notify_bot_id)
        }
      } catch (error: any) {
        if (!cancelled) {
          showToast.error(error.message || 'Не удалось загрузить настройки')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadRecipients])

  const onBotChange = async (value: string) => {
    const next = value ? parseInt(value, 10) : ''
    setBotId(next)
    setRecipientId('')
    setRecipients([])
    if (typeof next === 'number') {
      await loadRecipients(next)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = await api.updateNotificationSettings({
        error_notifications_enabled: enabled,
        notify_bot_id: botId === '' ? null : botId,
        notify_telegram_user_id: recipientId === '' ? null : recipientId,
      })
      setSettings(data)
      showToast.success('Настройки сохранены')
    } catch (error: any) {
      showToast.error(error.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const result = await api.testNotificationSettings()
      showToast.success(result.message || 'Тест отправлен')
    } catch (error: any) {
      showToast.error(error.message || 'Не удалось отправить тест')
    } finally {
      setTesting(false)
    }
  }

  const canTest =
    !!settings?.notify_bot_id && !!settings?.notify_telegram_user_id

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Settings size={24} className="text-indigo-600" />
            Настройки
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Уведомления об ошибках в Telegram
          </p>
        </div>

        {loading || botsLoading ? (
          <div className="text-gray-500">Загрузка...</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-sm">
            <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-900">
              <Info size={18} className="mt-0.5 shrink-0" />
              <p>
                Получатель должен хотя бы раз написать выбранному боту — иначе
                его не будет в списке и Telegram не примет сообщение.
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-gray-900 font-medium">
                Уведомлять об ошибках в Telegram
              </span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Бот для отправки
              </label>
              <select
                value={botId === '' ? '' : String(botId)}
                onChange={(e) => onBotChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Выберите бота</option>
                {(bots || []).map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name || bot.username || `Бот #${bot.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Получатель
              </label>
              <select
                value={recipientId === '' ? '' : String(recipientId)}
                onChange={(e) =>
                  setRecipientId(
                    e.target.value ? parseInt(e.target.value, 10) : ''
                  )
                }
                disabled={botId === ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {botId === ''
                    ? 'Сначала выберите бота'
                    : recipients.length === 0
                      ? 'Нет пользователей — напишите боту'
                      : 'Выберите получателя'}
                </option>
                {recipients.map((u) => (
                  <option key={u.id} value={u.id}>
                    {recipientLabel(u)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !canTest}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                <Send size={16} />
                {testing ? 'Отправка...' : 'Отправить тест'}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
