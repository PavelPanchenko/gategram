'use client'

import { useState } from 'react'
import DashboardLayout from '@/app/components/DashboardLayout'
import { useAllTemplates } from '@/app/hooks/useTemplates'
import { useBots } from '@/app/hooks/useBots'
import { useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from '@/app/hooks/useTemplates'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { showToast, confirmAction } from '@/app/utils/toast'
import { FileText, Info, Pause, Play, Edit2, Trash2, Plus, Bot } from 'lucide-react'
import Link from 'next/link'

const templateSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  content: z.string().min(1, 'Содержимое обязательно'),
  is_active: z.boolean().default(true),
  bot_id: z.string().optional(),
})

type TemplateFormData = z.infer<typeof templateSchema>

export default function TemplatesPage() {
  const [selectedBotId, setSelectedBotId] = useState<number | undefined>(undefined)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingBotId, setEditingBotId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data: bots } = useBots()
  const { data: templates, isLoading } = useAllTemplates(selectedBotId)
  const createTemplate = useCreateTemplate(editingBotId || 0)
  const updateTemplate = useUpdateTemplate(editingBotId || 0)
  const deleteTemplate = useDeleteTemplate(editingBotId || 0)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      is_active: true,
      bot_id: '',
    },
  })

  const selectedBotIdForm = watch('bot_id')

  const onSubmit = async (data: TemplateFormData) => {
    // Используем выбранный в фильтре бот, если он есть, иначе из формы
    const botId = selectedBotId || parseInt(data.bot_id)
    if (!botId) {
      showToast.error('Выберите бота')
      return
    }
    setEditingBotId(botId)
    
    try {
      if (editingId) {
        await updateTemplate.mutateAsync({ templateId: editingId, data: { name: data.name, content: data.content, is_active: data.is_active } })
        setEditingId(null)
        setEditingBotId(null)
      } else {
        await createTemplate.mutateAsync({ name: data.name, content: data.content, is_active: data.is_active })
      }
      reset()
      setShowForm(false)
      showToast.success(editingId ? 'Шаблон обновлен' : 'Шаблон создан')
    } catch (error: any) {
      showToast.error(error.message || 'Ошибка при сохранении шаблона')
    }
  }

  const handleEdit = (template: any) => {
    setEditingId(template.id)
    setEditingBotId(template.bot_id)
    reset({
      name: template.name,
      content: template.content,
      is_active: template.is_active,
      bot_id: template.bot_id.toString(),
    })
    setShowForm(true)
  }

  const handleDelete = async (template: any) => {
    confirmAction(
      `Вы уверены, что хотите удалить шаблон "${template.name}"?`,
      async () => {
        setEditingBotId(template.bot_id)
        try {
          await deleteTemplate.mutateAsync(template.id)
          showToast.success('Шаблон удален')
        } catch (error: any) {
          showToast.error(error.message || 'Ошибка при удалении шаблона')
        } finally {
          setEditingBotId(null)
        }
      },
      undefined,
      'Удалить шаблон?'
    )
  }

  const handleToggleActive = async (template: any) => {
    setEditingBotId(template.bot_id)
    try {
      await updateTemplate.mutateAsync({
        templateId: template.id,
        data: {
          name: template.name,
          content: template.content,
          is_active: !template.is_active,
        },
      })
      showToast.success(template.is_active ? 'Шаблон деактивирован' : 'Шаблон активирован')
    } catch (error: any) {
      showToast.error(error.message || 'Ошибка при изменении статуса шаблона')
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
            <h1 className="text-2xl font-semibold text-gray-900">Шаблоны сообщений</h1>
            <p className="text-gray-500 mt-1">Управление шаблонами для всех ботов</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null)
              setEditingBotId(null)
              reset({ name: '', content: '', is_active: true, bot_id: selectedBotId ? selectedBotId.toString() : '' })
              setShowForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span>Создать шаблон</span>
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
              <h3 className="font-semibold text-blue-900 mb-2">Как использовать шаблоны</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Создайте шаблон с названием, содержащим слово "welcome" - он будет использоваться как приветственное сообщение</li>
                <li>• Используйте переменные: <code className="bg-blue-100 px-1 rounded">{'{{user_name}}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{{source}}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{{user_id}}'}</code></li>
                <li>• Активный шаблон "welcome" заменит стандартное приветственное сообщение бота</li>
                <li>• Шаблоны можно использовать в триггерах для автоматических сообщений</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Форма создания/редактирования */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">{editingId ? 'Редактировать шаблон' : 'Создать шаблон'}</h2>
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
                  placeholder="Например: welcome_message"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Содержимое</label>
                <textarea
                  {...register('content')}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Текст шаблона с переменными {{user_name}}, {{source}} и т.д."
                />
                {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content.message}</p>}
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

        {/* Список шаблонов */}
        {isLoading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : templates && templates.length > 0 ? (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div key={template.id} className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                      {template.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">Активен</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full font-medium">Неактивен</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Bot size={14} />
                      <Link href={`/bots/${template.bot_id}`} className="text-indigo-600 hover:text-indigo-800 hover:underline">
                        {template.bot_name || getBotName(template.bot_id)}
                      </Link>
                    </div>
                    <p className="text-gray-600 mt-2 whitespace-pre-wrap">{template.content}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Создан: {new Date(template.created_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`p-2 rounded-lg transition-colors ${
                        template.is_active
                          ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                      title={template.is_active ? 'Деактивировать' : 'Активировать'}
                    >
                      {template.is_active ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Редактировать"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
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
            {selectedBotId ? 'Нет шаблонов для выбранного бота' : 'Нет шаблонов. Создайте первый шаблон.'}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

