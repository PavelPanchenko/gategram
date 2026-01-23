'use client'

import { useState } from 'react'
import DashboardLayout from '@/app/components/DashboardLayout'
import Modal from '@/app/components/Modal'
import { useAllTags } from '@/app/hooks/useTags'
import { useBots } from '@/app/hooks/useBots'
import { useCreateTag, useUpdateTag, useDeleteTag } from '@/app/hooks/useTags'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { showToast, confirmAction } from '@/app/utils/toast'
import { Tag, Info, Edit2, Trash2, Plus, Bot } from 'lucide-react'
import Link from 'next/link'

const tagSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  color: z.string().min(1, 'Цвет обязателен'),
  description: z.string().optional(),
  bot_id: z.string().optional(),
})

type TagFormData = z.infer<typeof tagSchema>

export default function TagsPage() {
  const [selectedBotId, setSelectedBotId] = useState<number | undefined>(undefined)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingBotId, setEditingBotId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data: bots } = useBots()
  const { data: tags, isLoading } = useAllTags(selectedBotId)
  
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()
  const deleteTag = useDeleteTag()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      color: '#3B82F6',
      bot_id: '',
    },
  })

  const onSubmit = async (data: TagFormData) => {
    // Используем выбранный в фильтре бот, если он есть, иначе из формы
    const botId = selectedBotId || parseInt(data.bot_id || '')
    if (!botId) {
      showToast.error('Выберите бота')
      return
    }
    
    try {
      if (editingId) {
        await updateTag.mutateAsync({ 
          botId, 
          tagId: editingId, 
          data: { name: data.name, color: data.color, description: data.description || undefined } 
        })
        setEditingId(null)
      } else {
        await createTag.mutateAsync({ 
          botId, 
          data: { name: data.name, color: data.color, description: data.description || undefined } 
        })
      }
      reset()
      setShowForm(false)
      showToast.success(editingId ? 'Тег обновлен' : 'Тег создан')
    } catch (error: any) {
      showToast.error(error.message || 'Ошибка при сохранении тега')
    }
  }

  const handleEdit = (tag: any) => {
    setEditingId(tag.id)
    setEditingBotId(tag.bot_id)
    reset({
      name: tag.name,
      color: tag.color,
      description: tag.description || '',
      bot_id: tag.bot_id.toString(),
    })
    setShowForm(true)
  }

  const handleDelete = async (tag: any) => {
    confirmAction(
      `Вы уверены, что хотите удалить тег "${tag.name}"?`,
      async () => {
        try {
          await deleteTag.mutateAsync({ botId: tag.bot_id, tagId: tag.id })
          showToast.success('Тег удален')
        } catch (error: any) {
          showToast.error(error.message || 'Ошибка при удалении тега')
        }
      },
      undefined,
      'Удалить тег?'
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
            <h1 className="text-2xl font-semibold text-gray-900">Теги пользователей</h1>
            <p className="text-gray-500 mt-1">Управление тегами для всех ботов</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null)
              setEditingBotId(null)
              reset({ name: '', color: '#3B82F6', description: '', bot_id: selectedBotId ? selectedBotId.toString() : '' })
              setShowForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span>Создать тег</span>
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
              <h3 className="font-semibold text-blue-900 mb-2">Как использовать теги</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Создавайте теги для сегментации пользователей (например: VIP, Новички, Активные)</li>
                <li>• Назначайте теги пользователям на странице «Пользователи» конкретного бота</li>
                <li>• Используйте теги в триггерах для автоматических действий с определенными группами</li>
                <li>• Фильтруйте пользователей по тегам для таргетированных рассылок</li>
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
            setEditingBotId(null)
            reset()
          }}
          title={editingId ? 'Редактировать тег' : 'Создать тег'}
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
                placeholder="Например: VIP"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Цвет</label>
              <input
                {...register('color')}
                type="color"
                className="h-10 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание (необязательно)</label>
              <input
                {...register('description')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Описание тега"
              />
            </div>

            <div className="flex gap-2 justify-end">
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
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                {editingId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Список тегов */}
        {isLoading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : tags && tags.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tags.map((tag) => (
              <div key={tag.id} className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <h3 className="text-lg font-semibold text-gray-900">{tag.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(tag)}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Редактировать"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(tag)}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Bot size={14} />
                  <Link href={`/bots/${tag.bot_id}`} className="text-indigo-600 hover:text-indigo-800 hover:underline">
                    {tag.bot_name || getBotName(tag.bot_id)}
                  </Link>
                </div>
                {tag.description && <p className="text-gray-600 text-sm">{tag.description}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
            {selectedBotId ? 'Нет тегов для выбранного бота' : 'Нет тегов. Создайте первый тег для сегментации пользователей.'}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

