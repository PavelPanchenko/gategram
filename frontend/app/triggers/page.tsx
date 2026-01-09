'use client'

import { useState } from 'react'
import DashboardLayout from '@/app/components/DashboardLayout'
import { useAllTriggers } from '@/app/hooks/useTriggers'
import { useBots } from '@/app/hooks/useBots'
import { useCreateTrigger, useUpdateTrigger, useDeleteTrigger } from '@/app/hooks/useTriggers'
import { useTags } from '@/app/hooks/useTags'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { showToast, confirmAction } from '@/app/utils/toast'
import { Zap, Info, Pause, Play, Edit2, Trash2, Plus, Bot } from 'lucide-react'
import Link from 'next/link'

const triggerSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  event_type: z.string().min(1, 'Тип события обязателен'),
  action_type: z.string().min(1, 'Тип действия обязателен'),
  is_active: z.boolean().default(true),
  bot_id: z.string().optional(),
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
  const [selectedBotId, setSelectedBotId] = useState<number | undefined>(undefined)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingBotId, setEditingBotId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data: bots } = useBots()
  const { data: triggers, isLoading } = useAllTriggers(selectedBotId)
  const createTrigger = useCreateTrigger(editingBotId || 0)
  const updateTrigger = useUpdateTrigger(editingBotId || 0)
  const deleteTrigger = useDeleteTrigger(editingBotId || 0)

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
      bot_id: '',
      conditions: {},
      action_data: {},
    },
  })

  const eventType = watch('event_type')
  const actionType = watch('action_type')
  
  // Получаем теги для выбранного бота (используем selectedBotId или bot_id из формы)
  const formBotId = watch('bot_id')
  const tagsBotId = selectedBotId || (formBotId ? parseInt(formBotId) : undefined)
  const { data: tags, isLoading: loadingTags } = useTags(tagsBotId || 0)

  const onSubmit = async (data: TriggerFormData) => {
    // Используем выбранный в фильтре бот, если он есть, иначе из формы
    const botId = selectedBotId || parseInt(data.bot_id)
    if (!botId) {
      showToast.error('Выберите бота')
      return
    }
    setEditingBotId(botId)
    
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
    
    try {
      if (editingId) {
        await updateTrigger.mutateAsync({
          triggerId: editingId,
          data: {
            name: data.name,
            event_type: data.event_type,
            action_type: data.action_type,
            conditions: data.conditions || {},
            action_data: actionData,
            is_active: data.is_active,
          },
        })
        setEditingId(null)
        setEditingBotId(null)
      } else {
        await createTrigger.mutateAsync({
          name: data.name,
          event_type: data.event_type,
          action_type: data.action_type,
          conditions: data.conditions || {},
          action_data: actionData,
          is_active: data.is_active,
        })
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
    setEditingBotId(trigger.bot_id)
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
      bot_id: trigger.bot_id.toString(),
    })
    setShowForm(true)
  }

  const handleDelete = async (trigger: any) => {
    confirmAction(
      `Вы уверены, что хотите удалить триггер "${trigger.name}"?`,
      async () => {
        setEditingBotId(trigger.bot_id)
        try {
          await deleteTrigger.mutateAsync(trigger.id)
          showToast.success('Триггер удален')
        } catch (error: any) {
          showToast.error(error.message || 'Ошибка при удалении триггера')
        } finally {
          setEditingBotId(null)
        }
      },
      undefined,
      'Удалить триггер?'
    )
  }

  const handleToggleActive = async (trigger: any) => {
    setEditingBotId(trigger.bot_id)
    try {
      await updateTrigger.mutateAsync({
        triggerId: trigger.id,
        data: {
          name: trigger.name,
          event_type: trigger.event_type,
          action_type: trigger.action_type,
          conditions: trigger.conditions || {},
          action_data: trigger.action_data || {},
          is_active: !trigger.is_active,
        },
      })
      showToast.success(trigger.is_active ? 'Триггер деактивирован' : 'Триггер активирован')
    } catch (error: any) {
      showToast.error(error.message || 'Ошибка при изменении статуса триггера')
    } finally {
      setEditingBotId(null)
    }
  }

  const getBotName = (botId: number) => {
    const bot = bots?.find((b) => b.id === botId)
    return bot?.name || bot?.username || `Bot #${botId}`
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Автоматические триггеры</h1>
            <p className="text-gray-500 mt-1">Управление триггерами для всех ботов</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null)
              setEditingBotId(null)
              reset({ 
                name: '', 
                event_type: '', 
                action_type: '', 
                is_active: true, 
                bot_id: selectedBotId ? selectedBotId.toString() : '', 
                conditions: {}, 
                action_data: {} 
              })
              setShowForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span>Создать триггер</span>
          </button>
        </div>

        {/* Фильтр по ботам */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Фильтр по боту</label>
          <select
            value={selectedBotId || ''}
            onChange={(e) => setSelectedBotId(e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Все боты</option>
            {bots?.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name || bot.username || `Bot #${bot.id}`}
              </option>
            ))}
          </select>
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
                <li>• <strong>Пользователь присоединился к каналу</strong> - отправить поздравление</li>
                <li>• Используйте действия: отправка сообщения, добавление/удаление тега</li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Важное предупреждение для триггеров на каналы */}
        {watch('event_type') === 'user_joined_channel' || watch('event_type') === 'user_left_channel' ? (
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

        {/* Форма создания/редактирования */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">{editingId ? 'Редактировать триггер' : 'Создать триггер'}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {!selectedBotId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Бот</label>
                  <select
                    {...register('bot_id')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={!!editingId}
                  >
                    <option value="">Выберите бота</option>
                    {bots?.map((bot) => (
                      <option key={bot.id} value={bot.id}>
                        {bot.name || bot.username || `Bot #${bot.id}`}
                      </option>
                    ))}
                  </select>
                  {errors.bot_id && <p className="text-red-500 text-sm mt-1">{errors.bot_id.message}</p>}
                </div>
              )}
              {selectedBotId && !editingId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Бот:</strong> {getBotName(selectedBotId)}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Например: Приветствие новым пользователям"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип события</label>
                <select
                  {...register('event_type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Выберите тип события</option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.event_type && <p className="text-red-500 text-sm mt-1">{errors.event_type.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип действия</label>
                <select
                  {...register('action_type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Выберите тип действия</option>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Текст сообщения или ID шаблона"
                  />
                </div>
              )}

              {(actionType === 'add_tag' || actionType === 'remove_tag') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Выберите тег</label>
                  {!tagsBotId ? (
                    <p className="text-sm text-gray-500">Сначала выберите бота</p>
                  ) : loadingTags ? (
                    <p className="text-sm text-gray-500">Загрузка тегов...</p>
                  ) : tags && tags.length > 0 ? (
                    <select
                      {...register('action_data.tag_id', {
                        setValueAs: (v) => v ? parseInt(v) : undefined
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Выберите тег</option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        Нет созданных тегов для этого бота. Создайте теги на странице{' '}
                        <Link href="/tags" className="underline font-semibold">Теги</Link>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  {...register('is_active')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                  Активен
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {editingId ? 'Сохранить' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    setEditingBotId(null)
                    reset()
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Список триггеров */}
        {isLoading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : triggers && triggers.length > 0 ? (
          <div className="grid gap-4">
            {triggers.map((trigger) => (
              <div key={trigger.id} className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{trigger.name}</h3>
                      {trigger.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">Активен</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full font-medium">Неактивен</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Bot size={14} />
                      <Link href={`/bots/${trigger.bot_id}`} className="text-indigo-600 hover:text-indigo-800 hover:underline">
                        {trigger.bot_name || getBotName(trigger.bot_id)}
                      </Link>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Событие:</span>{' '}
                        <span className="text-gray-600">
                          {EVENT_TYPES.find((t) => t.value === trigger.event_type)?.label || trigger.event_type}
                        </span>
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Действие:</span>{' '}
                        <span className="text-gray-600">
                          {ACTION_TYPES.find((t) => t.value === trigger.action_type)?.label || trigger.action_type}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
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
                      onClick={() => handleDelete(trigger)}
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
          <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
            {selectedBotId ? 'Нет триггеров для выбранного бота' : 'Нет триггеров. Создайте первый триггер для автоматизации.'}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

