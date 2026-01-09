'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from '@/app/hooks/useTemplates'
import { useBots } from '@/app/hooks/useBots'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { showToast, confirmAction } from '@/app/utils/toast'
import DashboardLayout from '@/app/components/DashboardLayout'
import { Settings, FileText, Info, Pause, Play, Edit2, Trash2 } from 'lucide-react'

const templateSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  content: z.string().min(1, 'Содержимое обязательно'),
  is_active: z.boolean().default(true),
})

type TemplateFormData = z.infer<typeof templateSchema>

export default function TemplatesPage() {
  const params = useParams()
  const router = useRouter()
  const botId = parseInt(params.id as string)
  const { data: bots } = useBots()
  const bot = bots?.find((b) => b.id === botId)

  const { data: templates, isLoading } = useTemplates(botId)
  const createTemplate = useCreateTemplate(botId)
  const updateTemplate = useUpdateTemplate(botId)
  const deleteTemplate = useDeleteTemplate(botId)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      is_active: true,
    },
  })

  const onSubmit = async (data: TemplateFormData) => {
    try {
      if (editingId) {
        await updateTemplate.mutateAsync({ templateId: editingId, data })
        setEditingId(null)
      } else {
        await createTemplate.mutateAsync(data)
      }
      reset()
      setShowForm(false)
    } catch (error) {
      console.error('Error saving template:', error)
    }
  }

  const handleEdit = (template: any) => {
    setEditingId(template.id)
    reset({
      name: template.name,
      content: template.content,
      is_active: template.is_active,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    confirmAction(
      'Удалить шаблон?',
      async () => {
        try {
          await deleteTemplate.mutateAsync(id)
          showToast.success('Шаблон удален')
        } catch (error) {
          console.error('Error deleting template:', error)
          showToast.error('Ошибка при удалении шаблона')
        }
      }
    )
  }

  const handleToggleActive = async (template: any) => {
    try {
      await updateTemplate.mutateAsync({
        templateId: template.id,
        data: {
          name: template.name,
          content: template.content,
          is_active: !template.is_active,
        },
      })
    } catch (error) {
      console.error('Error toggling template:', error)
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
          <div className="p-4 bg-indigo-600 text-white rounded-lg text-center">
            <div className="flex justify-center mb-2">
              <FileText size={24} />
            </div>
            <div className="font-medium text-sm">Шаблоны</div>
          </div>
          <Link
            href={`/bots/${botId}/tags`}
            className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all text-center"
          >
            <div className="text-3xl mb-2">🏷️</div>
            <div className="font-semibold text-gray-700">Теги</div>
          </Link>
          <Link
            href={`/bots/${botId}/triggers`}
            className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all text-center"
          >
            <div className="text-3xl mb-2">⚡</div>
            <div className="font-semibold text-gray-700">Триггеры</div>
          </Link>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Шаблоны сообщений
              </h1>
              <p className="text-gray-600 mt-2">Бот: {bot.name || bot.username}</p>
            </div>
            <button
              onClick={() => {
                setEditingId(null)
                reset()
                setShowForm(true)
              }}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg transform transition hover:scale-105 font-medium"
            >
              + Создать шаблон
            </button>
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
        </div>

        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingId ? 'Редактировать шаблон' : 'Создать шаблон'}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Например: Welcome Message"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Содержимое</label>
                <textarea
                  {...register('content')}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Привет, {{user_name}}! Добро пожаловать!"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Доступные переменные: {'{{user_name}}'}, {'{{source}}'}, {'{{user_id}}'}
                </p>
                {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content.message}</p>}
              </div>

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
        ) : templates && templates.length > 0 ? (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div key={template.id} className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{template.name}</h3>
                      {template.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Активен</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Неактивен</span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-2 whitespace-pre-wrap">{template.content}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Создан: {new Date(template.created_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="flex gap-2">
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
                      onClick={() => handleDelete(template.id)}
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
            Нет шаблонов. Создайте первый шаблон.
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

