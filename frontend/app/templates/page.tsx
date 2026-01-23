'use client'

import { useState } from 'react'
import DashboardLayout from '@/app/components/DashboardLayout'
import Modal from '@/app/components/Modal'
import { useAllTemplates } from '@/app/hooks/useTemplates'
import { useBots } from '@/app/hooks/useBots'
import { useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from '@/app/hooks/useTemplates'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { showToast, confirmAction } from '@/app/utils/toast'
import { FileText, Info, Edit2, Trash2, Plus, Bot } from 'lucide-react'
import Link from 'next/link'

const templateSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  content: z.string().min(1, 'Содержимое обязательно'),
  bot_id: z.string().optional(),
})

type TemplateFormData = z.infer<typeof templateSchema>

export default function TemplatesPage() {
  const [selectedBotId, setSelectedBotId] = useState<number | undefined>(undefined)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data: bots } = useBots()
  const { data: templates, isLoading } = useAllTemplates(selectedBotId)
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()
  const deleteTemplate = useDeleteTemplate()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      bot_id: '',
    },
  })

  const selectedBotIdForm = watch('bot_id')

  const onSubmit = async (data: TemplateFormData) => {
    // Используем выбранный в фильтре бот, если он есть, иначе из формы
    const botId = selectedBotId || parseInt(data.bot_id || '')
    if (!botId) {
      showToast.error('Выберите бота')
      return
    }
    
    try {
      if (editingId) {
        await updateTemplate.mutateAsync({ 
          botId, 
          templateId: editingId, 
          data: { name: data.name, content: data.content } 
        })
        setEditingId(null)
      } else {
        await createTemplate.mutateAsync({ 
          botId, 
          data: { name: data.name, content: data.content } 
        })
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
    reset({
      name: template.name,
      content: template.content,
      bot_id: template.bot_id.toString(),
    })
    setShowForm(true)
  }

  const handleDelete = async (template: any) => {
    confirmAction(
      `Вы уверены, что хотите удалить шаблон "${template.name}"?`,
      async () => {
        try {
          await deleteTemplate.mutateAsync({ botId: template.bot_id, templateId: template.id })
          showToast.success('Шаблон удален')
        } catch (error: any) {
          showToast.error(error.message || 'Ошибка при удалении шаблона')
        }
      },
      undefined,
      'Удалить шаблон?'
    )
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
              reset({ name: '', content: '', bot_id: selectedBotId ? selectedBotId.toString() : '' })
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
                <li>• Создайте шаблон с названием, содержащим слово «welcome» — он будет использоваться как приветственное сообщение</li>
                <li>• Используйте переменные: <code className="bg-blue-100 px-1 rounded">{'{{user_name}}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{{source}}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{{user_id}}'}</code></li>
                <li>• Активный шаблон «welcome» заменит стандартное приветственное сообщение бота</li>
                <li>• Шаблоны можно использовать в триггерах для автоматических сообщений</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Модальное окно создания/редактирования */}
        <Modal
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setEditingId(null)
            reset()
          }}
          title={editingId ? 'Редактировать шаблон' : 'Создать шаблон'}
          size="lg"
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
                placeholder="Например: welcome_message"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Содержимое</label>
              <textarea
                {...register('content')}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Текст шаблона с переменными {{user_name}}, {{source}} и т.д."
              />
              {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content.message}</p>}
              <p className="text-xs text-gray-500 mt-1">
                Доступные переменные: {'{{ user_name }}'}, {'{{ user_first_name }}'}, {'{{ user_last_name }}'}, {'{{ user_username }}'}, {'{{ source }}'}
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
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

