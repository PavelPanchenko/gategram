'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTriggers, useCreateTrigger, useUpdateTrigger, useDeleteTrigger } from '@/app/hooks/useTriggers'
import { useBots } from '@/app/hooks/useBots'
import { useTags } from '@/app/hooks/useTags'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { showToast, confirmAction } from '@/app/utils/toast'
import DashboardLayout from '@/app/components/DashboardLayout'
import { Settings, Zap, Info, Pause, Play, Edit2, Trash2, Tag, FileText } from 'lucide-react'

const triggerSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  event_type: z.string().min(1, 'Тип события обязателен'),
  action_type: z.string().min(1, 'Тип действия обязателен'),
  is_active: z.boolean().default(true),
  conditions: z.record(z.string(), z.unknown()).optional(),
  action_data: z.record(z.string(), z.unknown()).optional(),
})

type TriggerFormData = z.infer<typeof triggerSchema>

const EVENT_TYPES = [
  { value: 'user_registered', label: 'Регистрация пользователя' },
  { value: 'user_inactive', label: 'Пользователь неактивен' },
  { value: 'user_joined_channel', label: 'Пользователь присоединился к каналу' },
  { value: 'user_left_channel', label: 'Пользователь отписался от канала' },
]

const ACTION_TYPES = [
  { value: 'send_message', label: 'Отправить сообщение' },
  { value: 'add_tag', label: 'Добавить тег' },
  { value: 'remove_tag', label: 'Удалить тег' },
]

export default function TriggersPage() {
  const params = useParams()
  const botId = parseInt(params.id as string)
  const { data: bots } = useBots()
  const bot = bots?.find((b) => b.id === botId)

  const { data: triggers, isLoading } = useTriggers(botId)
  const createTrigger = useCreateTrigger(botId)
  const updateTrigger = useUpdateTrigger(botId)
  const deleteTrigger = useDeleteTrigger(botId)
  const { data: tags, isLoading: loadingTags } = useTags(botId)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TriggerFormData>({
    resolver: zodResolver(triggerSchema),
    defaultValues: {
      is_active: true,
      conditions: {},
      action_data: {},
    },
  })

          const eventType = watch('event_type')
          const actionType = watch('action_type')
          const actionDataTagId = watch('action_data.tag_id')

  const onSubmit = async (data: TriggerFormData) => {
    try {
      // Подготавливаем action_data - преобразуем tag_id в число, если есть
      const actionData: any = {}
      if (data.action_data) {
        if (data.action_data.tag_id) {
          actionData.tag_id = typeof data.action_data.tag_id === 'string' 
            ? parseInt(data.action_data.tag_id) 
            : data.action_data.tag_id
        }
        if (data.action_data.message) {
          actionData.message = data.action_data.message
        }
      }
      
      const triggerData = {
        ...data,
        conditions: data.conditions || {},
        action_data: actionData,
      }
      if (editingId) {
        await updateTrigger.mutateAsync({ triggerId: editingId, data: triggerData })
        setEditingId(null)
      } else {
        await createTrigger.mutateAsync(triggerData)
      }
      reset()
      setShowForm(false)
      showToast.success(editingId ? 'Триггер обновлен' : 'Триггер создан')
    } catch (error: any) {
      showToast.error(error.message || 'Ошибка при сохранении триггера')
    }
  }

  const handleEdit = (trigger: any) => {
    setEditingId(trigger.id)
    // Преобразуем tag_id в строку для select, если есть
    const actionData = { ...(trigger.action_data || {}) }
    if (actionData.tag_id) {
      actionData.tag_id = actionData.tag_id.toString()
    }
    reset({
      name: trigger.name,
      event_type: trigger.event_type,
      action_type: trigger.action_type,
      conditions: trigger.conditions || {},
      action_data: actionData,
      is_active: trigger.is_active,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    confirmAction(
      'Удалить триггер?',
      async () => {
        try {
          await deleteTrigger.mutateAsync(id)
          showToast.success('Триггер удален')
        } catch (error) {
          console.error('Error deleting trigger:', error)
          showToast.error('Ошибка при удалении триггера')
        }
      }
    )
  }

  const handleToggleActive = async (trigger: any) => {
    try {
      await updateTrigger.mutateAsync({
        triggerId: trigger.id,
        data: {
          name: trigger.name,
          event_type: trigger.event_type,
          action_type: trigger.action_type,
          conditions: trigger.conditions,
          action_data: trigger.action_data,
          is_active: !trigger.is_active,
        },
      })
    } catch (error) {
      console.error('Error toggling trigger:', error)
    }
  }

  if (!bot) {
    return (
      <DashboardLayout>
        <div className="p-6">Бот не найден</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Навигация */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link
            href={`/bots/${botId}`}
            className="p-4 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all text-center"
          >
            <div className="flex justify-center mb-2">
              <Settings size={24} className="text-gray-600" />
            </div>
            <div className="font-medium text-sm text-gray-700">Настройки</div>
          </Link>
          <Link
            href={`/bots/${botId}/templates`}
            className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all text-center"
          >
            <div className="flex justify-center mb-2">
              <FileText size={24} className="text-gray-600" />
            </div>
            <div className="font-medium text-sm text-gray-700">Шаблоны</div>
          </Link>
          <Link
            href={`/bots/${botId}/tags`}
            className="p-4 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-sm transition-all text-center"
          >
            <div className="flex justify-center mb-2">
              <Tag size={24} className="text-gray-600" />
            </div>
            <div className="font-medium text-sm text-gray-700">Теги</div>
          </Link>
          <div className="p-4 bg-purple-600 text-white rounded-lg text-center">
            <div className="flex justify-center mb-2">
              <Zap size={24} />
            </div>
            <div className="font-medium text-sm">Триггеры</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                Автоматические триггеры
              </h1>
              <p className="text-gray-600 mt-2">Бот: {bot.name || bot.username}</p>
            </div>
            <button
              onClick={() => {
                setEditingId(null)
                reset()
                setShowForm(true)
              }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 shadow-lg transform transition hover:scale-105 font-medium"
            >
              + Создать триггер
            </button>
          </div>
          
          {/* Инструкция */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Как использовать триггеры</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Регистрация пользователя</strong> - отправить приветствие новым пользователям</li>
                  <li>• <strong>Пользователь неактивен</strong> - напомнить о боте через N дней</li>
                  <li>• <strong>Действия:</strong> отправить сообщение (из шаблона), добавить/удалить тег</li>
                  <li>• Пример: "При регистрации → Отправить сообщение → Добавить тег 'Новичок'"</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Важное предупреждение для триггеров на каналы */}
          {eventType === 'user_joined_channel' || eventType === 'user_left_channel' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-900 mb-2">⚠️ Требование для работы триггера</h3>
                  <p className="text-sm text-amber-800">
                    Для работы триггеров на подписку/отписку от канала, <strong>бот должен быть администратором канала</strong> в Telegram.
                    Без прав администратора Telegram не отправляет события о подписке/отписке пользователей.
                  </p>
                  <p className="text-sm text-amber-800 mt-2">
                    <strong>Как добавить бота администратором:</strong> Зайдите в настройки канала → Администраторы → Добавить администратора → Выберите вашего бота.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingId ? 'Редактировать триггер' : 'Создать триггер'}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Например: Приветствие новым пользователям"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Событие</label>
                <select
                  {...register('event_type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Выберите событие</option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.event_type && <p className="text-red-500 text-sm mt-1">{errors.event_type.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Действие</label>
                <select
                  {...register('action_type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Выберите действие</option>
                  {ACTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.action_type && <p className="text-red-500 text-sm mt-1">{errors.action_type.message}</p>}
              </div>

              {actionType === 'send_message' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Текст сообщения</label>
                  <textarea
                    {...register('action_data.message')}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Текст сообщения или ID шаблона"
                  />
                </div>
              )}

              {(actionType === 'add_tag' || actionType === 'remove_tag') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Выберите тег</label>
                  {loadingTags ? (
                    <p className="text-sm text-gray-500">Загрузка тегов...</p>
                  ) : tags && tags.length > 0 ? (
                    <select
                      {...register('action_data.tag_id', {
                        setValueAs: (v) => v ? parseInt(v) : undefined
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Выберите тег</option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <p className="text-sm text-yellow-800">
                        Нет созданных тегов для этого бота. Создайте теги на странице{' '}
                        <Link href={`/bots/${botId}/tags`} className="underline font-semibold">Теги</Link>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center">
                <input
                  {...register('is_active')}
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">Активен</label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  {editingId ? 'Сохранить' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    reset()
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : triggers && triggers.length > 0 ? (
          <div className="grid gap-4">
            {triggers.map((trigger) => (
              <div key={trigger.id} className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{trigger.name}</h3>
                      {trigger.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Активен</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Неактивен</span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">Событие:</span>{' '}
                        {EVENT_TYPES.find((t) => t.value === trigger.event_type)?.label || trigger.event_type}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Действие:</span>{' '}
                        {ACTION_TYPES.find((t) => t.value === trigger.action_type)?.label || trigger.action_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleActive(trigger)}
                      className={`p-2 rounded-lg transition-colors ${
                        trigger.is_active
                          ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                      title={trigger.is_active ? 'Деактивировать' : 'Активировать'}
                    >
                      {trigger.is_active ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      onClick={() => handleEdit(trigger)}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Редактировать"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(trigger.id)}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            Нет триггеров. Создайте первый триггер для автоматизации.
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

