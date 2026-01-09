'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '@/app/hooks/useTags'
import { useBots } from '@/app/hooks/useBots'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { showToast, confirmAction } from '@/app/utils/toast'
import DashboardLayout from '@/app/components/DashboardLayout'
import { Settings, Tag, Info, Edit2, Trash2, FileText, Zap } from 'lucide-react'

const tagSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  color: z.string().default('#3B82F6'),
  description: z.string().optional(),
})

type TagFormData = z.infer<typeof tagSchema>

export default function TagsPage() {
  const params = useParams()
  const botId = parseInt(params.id as string)
  const { data: bots } = useBots()
  const bot = bots?.find((b) => b.id === botId)

  const { data: tags, isLoading } = useTags(botId)
  const createTag = useCreateTag(botId)
  const updateTag = useUpdateTag(botId)
  const deleteTag = useDeleteTag(botId)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      color: '#3B82F6',
    },
  })

  const onSubmit = async (data: TagFormData) => {
    try {
      if (editingId) {
        await updateTag.mutateAsync({ tagId: editingId, data })
        setEditingId(null)
      } else {
        await createTag.mutateAsync(data)
      }
      reset()
      setShowForm(false)
    } catch (error) {
      console.error('Error saving tag:', error)
    }
  }

  const handleEdit = (tag: any) => {
    setEditingId(tag.id)
    reset({
      name: tag.name,
      color: tag.color,
      description: tag.description || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    confirmAction(
      'Удалить тег?',
      async () => {
        try {
          await deleteTag.mutateAsync(id)
          showToast.success('Тег удален')
        } catch (error) {
          console.error('Error deleting tag:', error)
          showToast.error('Ошибка при удалении тега')
        }
      }
    )
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
          <div className="p-4 bg-green-600 text-white rounded-lg text-center">
            <div className="flex justify-center mb-2">
              <Tag size={24} />
            </div>
            <div className="font-medium text-sm">Теги</div>
          </div>
          <Link
            href={`/bots/${botId}/triggers`}
            className="p-4 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all text-center"
          >
            <div className="flex justify-center mb-2">
              <Zap size={24} className="text-gray-600" />
            </div>
            <div className="font-medium text-sm text-gray-700">Триггеры</div>
          </Link>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
                Теги пользователей
              </h1>
              <p className="text-gray-600 mt-2">Бот: {bot.name || bot.username}</p>
            </div>
            <button
              onClick={() => {
                setEditingId(null)
                reset()
                setShowForm(true)
              }}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 shadow-lg transform transition hover:scale-105 font-medium"
            >
              + Создать тег
            </button>
          </div>
          
          {/* Инструкция */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Как использовать теги</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Создавайте теги для сегментации пользователей (например: VIP, Новички, Активные)</li>
                  <li>• Назначайте теги пользователям на странице "Пользователи" (будет добавлено)</li>
                  <li>• Используйте теги в триггерах для автоматических действий с определенными группами</li>
                  <li>• Фильтруйте пользователей по тегам для таргетированных рассылок</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">{editingId ? 'Редактировать тег' : 'Создать тег'}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Например: VIP"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Цвет</label>
                <input
                  {...register('color')}
                  type="color"
                  className="h-10 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание (необязательно)</label>
                <input
                  {...register('description')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Описание тега"
                />
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
        ) : tags && tags.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tags.map((tag) => (
              <div key={tag.id} className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <h3 className="text-lg font-semibold">{tag.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(tag)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(tag.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
                {tag.description && <p className="text-gray-600 mt-2 text-sm">{tag.description}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            Нет тегов. Создайте первый тег для сегментации пользователей.
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

