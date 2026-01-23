'use client'

import { useState } from 'react'
import DashboardLayout from '@/app/components/DashboardLayout'
import Modal from '@/app/components/Modal'
import { useAllTriggers } from '@/app/hooks/useTriggers'
import { useBots } from '@/app/hooks/useBots'
import { useCreateTrigger, useUpdateTrigger, useDeleteTrigger } from '@/app/hooks/useTriggers'
import { useTags } from '@/app/hooks/useTags'
import { useAllTemplates } from '@/app/hooks/useTemplates'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { showToast, confirmAction } from '@/app/utils/toast'
import { Zap, Info, Pause, Play, Edit2, Trash2, Plus, Bot } from 'lucide-react'
import Link from 'next/link'

const triggerSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  event_type: z.string().min(1, 'Тип события обязателен'),
  action_type: z.string().optional(), // Теперь необязательно, используется для обратной совместимости
  is_active: z.boolean(),
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

type Action = {
  type: string
  data: Record<string, any>
}

export default function TriggersPage() {
  const [selectedBotId, setSelectedBotId] = useState<number | undefined>(undefined)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingBotId, setEditingBotId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [actions, setActions] = useState<Action[]>([{ type: 'send_message', data: {} }])

  const { data: bots } = useBots()
  const { data: triggers, isLoading } = useAllTriggers(selectedBotId)
  const createTrigger = useCreateTrigger()
  const updateTrigger = useUpdateTrigger()
  const deleteTrigger = useDeleteTrigger()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
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
  
  // Получаем теги и шаблоны для выбранного бота (используем selectedBotId или bot_id из формы)
  const formBotId = watch('bot_id')
  const tagsBotId = selectedBotId || (formBotId ? parseInt(formBotId) : undefined)
  const { data: tags, isLoading: loadingTags } = useTags(tagsBotId || 0)
  const { data: templates, isLoading: loadingTemplates } = useAllTemplates(tagsBotId)

  const onSubmit = async (data: TriggerFormData) => {
    // Используем выбранный в фильтре бот, если он есть, иначе из формы
    const botId = selectedBotId || parseInt(data.bot_id || '')
    if (!botId) {
      showToast.error('Выберите бота')
      return
    }
    
    // Подготавливаем массив действий
    const preparedActions = actions.map(action => {
      const actionData: any = {}
      
      if (action.type === 'send_message') {
        if (action.data.template_id) {
          actionData.template_id = typeof action.data.template_id === 'string'
            ? parseInt(action.data.template_id)
            : action.data.template_id
        }
        if (action.data.message) {
          actionData.message = action.data.message
        }
      } else if (action.type === 'add_tag' || action.type === 'remove_tag') {
        if (action.data.tag_id) {
          actionData.tag_id = typeof action.data.tag_id === 'string'
            ? parseInt(action.data.tag_id)
            : action.data.tag_id
        }
      }
      
      return {
        type: action.type,
        data: actionData
      }
    })
    
    // Подготавливаем conditions - преобразуем days_inactive в число
    const conditions: any = {}
    if (data.conditions) {
      if (data.conditions.days_inactive) {
        conditions.days_inactive = typeof data.conditions.days_inactive === 'string'
          ? parseInt(data.conditions.days_inactive)
          : data.conditions.days_inactive
      }
    }
    
    try {
      const triggerPayload = {
        name: data.name,
        event_type: data.event_type,
        conditions: conditions,
        actions: preparedActions,
        is_active: data.is_active,
      }
      
      if (editingId) {
        await updateTrigger.mutateAsync({
          botId,
          triggerId: editingId,
          data: triggerPayload,
        })
        setEditingId(null)
      } else {
        await createTrigger.mutateAsync({
          botId,
          data: triggerPayload,
        })
      }
      reset()
      setActions([{ type: 'send_message', data: {} }]) // Сбрасываем действия
      setShowForm(false)
      showToast.success(editingId ? 'Триггер обновлен' : 'Триггер создан')
    } catch (error: any) {
      showToast.error(error.message || 'Ошибка при сохранении триггера')
    }
  }

  const handleEdit = (trigger: any) => {
    setEditingId(trigger.id)
    setEditingBotId(trigger.bot_id)
    
    // Загружаем действия из нового поля trigger.actions или старого формата
    if (trigger.actions && Array.isArray(trigger.actions) && trigger.actions.length > 0) {
      // Новый формат: массив действий в поле actions
      setActions(trigger.actions.map((action: any) => ({
        type: action.type,
        data: {
          ...action.data,
          tag_id: action.data.tag_id?.toString(),
          template_id: action.data.template_id?.toString()
        }
      })))
    } else {
      // Старый формат: одно действие в action_type/action_data
      const actionData = trigger.action_data || {}
      setActions([{
        type: trigger.action_type || 'send_message',
        data: {
          ...actionData,
          tag_id: actionData.tag_id?.toString(),
          template_id: actionData.template_id?.toString()
        }
      }])
    }
    
    reset({
      name: trigger.name,
      event_type: trigger.event_type,
      conditions: trigger.conditions || {},
      is_active: trigger.is_active,
      bot_id: trigger.bot_id.toString(),
    })
    setShowForm(true)
  }

  const handleDelete = async (trigger: any) => {
    confirmAction(
      `Вы уверены, что хотите удалить триггер "${trigger.name}"?`,
      async () => {
        try {
          await deleteTrigger.mutateAsync({ botId: trigger.bot_id, triggerId: trigger.id })
          showToast.success('Триггер удален')
        } catch (error: any) {
          showToast.error(error.message || 'Ошибка при удалении триггера')
        }
      },
      undefined,
      'Удалить триггер?'
    )
  }

  const handleToggleActive = async (trigger: any) => {
    try {
      await updateTrigger.mutateAsync({
        botId: trigger.bot_id,
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

        {/* Модальное окно создания/редактирования */}
        <Modal
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setEditingId(null)
            setEditingBotId(null)
            setActions([{ type: 'send_message', data: {} }])
            reset()
          }}
          title={editingId ? 'Редактировать триггер' : 'Создать триггер'}
          size="xl"
        >
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

              {eventType === 'user_inactive' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Период неактивности</label>
                  <select
                    {...register('conditions.days_inactive')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="7">1 неделя (7 дней)</option>
                    <option value="14">2 недели (14 дней)</option>
                    <option value="30">1 месяц (30 дней)</option>
                    <option value="90">3 месяца (90 дней)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Триггер сработает для пользователей, которые не проявляли активность указанное количество дней
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Действия</label>
                  <button
                    type="button"
                    onClick={() => setActions([...actions, { type: 'send_message', data: {} }])}
                    className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Добавить действие
                  </button>
                </div>
                
                {actions.map((action, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <select
                        value={action.type}
                        onChange={(e) => {
                          const newActions = [...actions]
                          newActions[index] = { type: e.target.value, data: {} }
                          setActions(newActions)
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {ACTION_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      {actions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setActions(actions.filter((_, i) => i !== index))}
                          className="ml-2 text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>

                    {action.type === 'send_message' && (
                      <div className="space-y-3">
                        {!tagsBotId ? (
                          <p className="text-sm text-gray-500">Сначала выберите бота</p>
                        ) : loadingTemplates ? (
                          <p className="text-sm text-gray-500">Загрузка шаблонов...</p>
                        ) : templates && templates.length > 0 ? (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Шаблон</label>
                            <select
                              value={action.data.template_id || ''}
                              onChange={(e) => {
                                const newActions = [...actions]
                                const templateId = e.target.value
                                if (templateId) {
                                  const template = templates.find(t => t.id === Number(templateId))
                                  newActions[index].data = {
                                    ...newActions[index].data,
                                    template_id: templateId,
                                    message: template?.content || ''
                                  }
                                } else {
                                  newActions[index].data = { ...newActions[index].data, template_id: '', message: '' }
                                }
                                setActions(newActions)
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="">Не использовать шаблон</option>
                              {templates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Текст сообщения</label>
                          <textarea
                            value={action.data.message || ''}
                            onChange={(e) => {
                              const newActions = [...actions]
                              newActions[index].data = { ...newActions[index].data, message: e.target.value }
                              setActions(newActions)
                            }}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Введите текст сообщения"
                          />
                        </div>
                      </div>
                    )}

                    {(action.type === 'add_tag' || action.type === 'remove_tag') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Тег</label>
                        {!tagsBotId ? (
                          <p className="text-sm text-gray-500">Сначала выберите бота</p>
                        ) : loadingTags ? (
                          <p className="text-sm text-gray-500">Загрузка тегов...</p>
                        ) : tags && tags.length > 0 ? (
                          <select
                            value={action.data.tag_id || ''}
                            onChange={(e) => {
                              const newActions = [...actions]
                              newActions[index].data = { ...newActions[index].data, tag_id: e.target.value }
                              setActions(newActions)
                            }}
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
                          <p className="text-sm text-gray-500">Нет тегов</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

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

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    setEditingBotId(null)
                    setActions([{ type: 'send_message', data: {} }])
                    reset()
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {editingId ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
        </Modal>

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
                        <span className="font-medium text-gray-700">Действия:</span>{' '}
                        <span className="text-gray-600">
                          {trigger.actions && trigger.actions.length > 0
                            ? `${trigger.actions.length} ${trigger.actions.length === 1 ? 'действие' : trigger.actions.length < 5 ? 'действия' : 'действий'}`
                            : ACTION_TYPES.find((t) => t.value === trigger.action_type)?.label || trigger.action_type}
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

