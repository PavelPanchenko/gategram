'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import DashboardLayout from '@/app/components/DashboardLayout'
import { useBots } from '@/app/hooks/useBots'
import { useCreateBroadcast } from '@/app/hooks/useBroadcasts'
import { useAllTemplates } from '@/app/hooks/useTemplates'
import { useTags } from '@/app/hooks/useTags'
import { BroadcastFilters } from '@/app/lib/api'
import { Info, AlertCircle, ChevronDown, ChevronUp, Filter, FileText, X, Tag } from 'lucide-react'

const broadcastSchema = z.object({
  bot_id: z.string().min(1, 'Выберите бота'),
  message_text: z.string().min(1, 'Текст сообщения обязателен').max(4096, 'Максимум 4096 символов'),
  template_id: z.string().optional(),
  media_file: z.instanceof(File).optional().or(z.literal(null)),
  media_files: z.array(z.instanceof(File)).optional(),
  scheduled_at: z.string().optional(),
})

type BroadcastFormData = z.infer<typeof broadcastSchema>

export default function NewBroadcastPage() {
  const router = useRouter()
  const { data: bots, isLoading: loadingBots } = useBots()
  const createBroadcast = useCreateBroadcast()
  
  // Состояние для фильтров
  const [filters, setFilters] = useState<BroadcastFilters>({})
  const [showFilters, setShowFilters] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BroadcastFormData>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: {
      bot_id: '',
      message_text: '',
      media_file: null,
      scheduled_at: '',
    },
  })

  const messageText = watch('message_text')
  const mediaFile = watch('media_file')
  const mediaFiles = watch('media_files') || []
  const selectedBotId = watch('bot_id')
  const selectedTemplateId = watch('template_id')
  const { data: templates } = useAllTemplates(selectedBotId ? Number(selectedBotId) : undefined)
  const { data: tags } = useTags(selectedBotId ? Number(selectedBotId) : undefined)

  const getMediaType = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return 'photo'
    } else if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext || '')) {
      return 'video'
    } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) {
      return 'audio'
    } else if (ext) {
      return 'document'
    }
    return null
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      // Поддержка множественной загрузки (до 10 файлов)
      const filesArray = Array.from(files).slice(0, 10)
      setValue('media_files', filesArray)
      // Для обратной совместимости сохраняем первый файл в media_file
      if (filesArray.length === 1) {
        setValue('media_file', filesArray[0])
      } else {
        setValue('media_file', null)
      }
    } else {
      setValue('media_files', [])
      setValue('media_file', null)
    }
  }

  const onSubmit = async (data: BroadcastFormData) => {
    try {
      const mediaType = data.media_file ? getMediaType(data.media_file) : null
      
      // Подготавливаем фильтры - убираем пустые значения
      const cleanFilters: BroadcastFilters = {}
      if (filters.new_users_days && filters.new_users_days > 0) {
        cleanFilters.new_users_days = filters.new_users_days
      }
      if (filters.inactive_days && filters.inactive_days > 0) {
        cleanFilters.inactive_days = filters.inactive_days
      }
      if (filters.source && filters.source.trim()) {
        cleanFilters.source = filters.source.trim()
      }
      if (filters.tags && filters.tags.length > 0) {
        cleanFilters.tags = filters.tags
      }
      
      await createBroadcast.mutateAsync({
        bot_id: Number(data.bot_id),
        message_text: data.message_text,
        template_id: data.template_id ? Number(data.template_id) : null,
        media_type: mediaType,
        media_file: data.media_file || null,
        media_files: data.media_files && data.media_files.length > 0 ? data.media_files : null,
        scheduled_at: data.scheduled_at 
          ? (() => {
              try {
                // datetime-local возвращает формат YYYY-MM-DDTHH:mm без таймзоны
                // Интерпретируем как локальное время и конвертируем в UTC
                const localDate = new Date(data.scheduled_at)
                // Проверяем, что дата валидна
                if (isNaN(localDate.getTime())) {
                  return null
                }
                // Конвертируем в ISO формат (UTC)
                const isoString = localDate.toISOString()
                return isoString
              } catch (error) {
                return null
              }
            })()
          : null,
        filters: Object.keys(cleanFilters).length > 0 ? cleanFilters : null,
      })
      router.push('/broadcasts')
    } catch (error: any) {
      showToast.error(error.message || 'Ошибка при создании рассылки')
    }
  }

  const activeBots = bots?.filter((bot) => bot.is_active) || []

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Создать рассылку
          </h1>
          <p className="text-gray-600">Отправьте сообщение всем активным пользователям бота</p>
        </div>

        {createBroadcast.isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {createBroadcast.error?.message || 'Ошибка создания рассылки'}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 space-y-6">
          <div>
            <label htmlFor="bot_id" className="block text-sm font-medium text-gray-700 mb-2">
              Бот <span className="text-red-500">*</span>
            </label>
            <select
              id="bot_id"
              {...register('bot_id')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={loadingBots}
            >
              <option value="">Выберите бота</option>
              {activeBots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name || bot.username || `Bot #${bot.id}`}
                </option>
              ))}
            </select>
            {errors.bot_id && <p className="text-red-500 text-sm mt-1">{errors.bot_id.message}</p>}
          </div>

          {/* Выбор шаблона */}
          {selectedBotId && (
            <div>
              <label htmlFor="template_id" className="block text-sm font-medium text-gray-700 mb-2">
                <FileText size={16} className="inline mr-1" />
                Шаблон (необязательно)
              </label>
              {templates && templates.length > 0 ? (
                <>
                  <select
                    id="template_id"
                    {...register('template_id')}
                    onChange={(e) => {
                      const templateId = e.target.value
                      if (templateId) {
                        const template = templates.find(t => t.id === Number(templateId))
                        if (template) {
                          setValue('message_text', template.content)
                        }
                      } else {
                        setValue('message_text', '')
                      }
                      register('template_id').onChange(e)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Не использовать шаблон</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    При выборе шаблона его содержимое будет подставлено в поле текста. Переменные (например, {'{'}{'{'} user_name {'}'}{'}'}) будут автоматически заменены на данные каждого пользователя при отправке.
                  </p>
                </>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-sm text-gray-600">
                    Нет активных шаблонов для этого бота. Создайте шаблон на странице{' '}
                    <a href="/templates" className="text-indigo-600 hover:text-indigo-800 underline">
                      Шаблоны
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="message_text" className="block text-sm font-medium text-gray-700 mb-2">
              Текст сообщения <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message_text"
              {...register('message_text')}
              rows={6}
              maxLength={4096}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Введите текст сообщения для рассылки..."
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-sm text-gray-500">
                {messageText?.length || 0} / 4096 символов
              </p>
              {errors.message_text && <p className="text-red-500 text-sm">{errors.message_text.message}</p>}
            </div>
          </div>

          {/* Медиа секция */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">📎 Медиа файлы (необязательно)</h3>
            
            <div>
              <label htmlFor="media_file" className="block text-sm font-medium text-gray-700 mb-2">
                Выберите файлы (до 10 файлов)
              </label>
              <input
                type="file"
                id="media_file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                multiple
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {mediaFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {mediaFiles.map((file, index) => (
                    <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Файл {index + 1}:</span> {file.name}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Размер:</span> {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Тип:</span> {getMediaType(file) === 'photo' ? '📷 Фото' : 
                                                                       getMediaType(file) === 'video' ? '🎥 Видео' :
                                                                       getMediaType(file) === 'audio' ? '🎵 Аудио' :
                                                                       getMediaType(file) === 'document' ? '📄 Документ' : 'Неизвестно'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newFiles = mediaFiles.filter((_, i) => i !== index)
                            setValue('media_files', newFiles)
                            if (newFiles.length === 1) {
                              setValue('media_file', newFiles[0])
                            } else if (newFiles.length === 0) {
                              setValue('media_file', null)
                            }
                          }}
                          className="ml-2 text-red-600 hover:text-red-800"
                          title="Удалить файл"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {errors.media_file && <p className="text-red-500 text-sm mt-1">{errors.media_file.message}</p>}
            </div>

            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md flex gap-2">
              <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                <strong>Совет:</strong> Выберите до 10 файлов с вашего компьютера. 
                Файлы будут отправлены группой. Тип медиа определится автоматически по расширению файла.
                Текст сообщения будет использован как подпись к первому файлу в группе.
              </p>
            </div>
          </div>

          {/* Фильтры пользователей */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Фильтры пользователей (необязательно)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
              >
                {showFilters ? (
                  <>
                    <ChevronUp size={16} />
                    <span>Скрыть</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    <span>Показать</span>
                  </>
                )}
              </button>
            </div>
            
            {showFilters && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Новые пользователи (дней)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Например: 7"
                      value={filters.new_users_days || ''}
                      onChange={(e) => setFilters({ ...filters, new_users_days: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Зарегистрировались за последние N дней</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Неактивные пользователи (дней)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Например: 30"
                      value={filters.inactive_days || ''}
                      onChange={(e) => setFilters({ ...filters, inactive_days: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Не заходили N дней</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Источник (source)
                    </label>
                    <input
                      type="text"
                      placeholder="Например: ad1, utm_source"
                      value={filters.source || ''}
                      onChange={(e) => setFilters({ ...filters, source: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Фильтр по источнику трафика</p>
                  </div>
                </div>

                {/* Фильтр по тегам */}
                {selectedBotId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Tag size={14} className="inline mr-1" />
                      Теги пользователей
                    </label>
                    {tags && tags.length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {tags.map((tag) => {
                            const isSelected = filters.tags?.includes(tag.name) || false
                            return (
                              <label
                                key={tag.id}
                                className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                                style={{
                                  borderColor: isSelected ? tag.color : '#e5e7eb',
                                  backgroundColor: isSelected ? `${tag.color}10` : 'white',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const currentTags = filters.tags || []
                                    if (e.target.checked) {
                                      setFilters({ ...filters, tags: [...currentTags, tag.name] })
                                    } else {
                                      setFilters({ ...filters, tags: currentTags.filter(t => t !== tag.name) })
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: tag.color }}
                                />
                                <span className="text-sm font-medium truncate">{tag.name}</span>
                              </label>
                            )
                          })}
                        </div>
                        <p className="text-xs text-gray-500">
                          Рассылка будет отправлена только пользователям, у которых есть <strong>все</strong> выбранные теги
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                        <p className="text-sm text-gray-600">
                          Нет доступных тегов для этого бота. Создайте теги на странице{' '}
                          <a href="/tags" className="text-indigo-600 hover:text-indigo-800 underline">
                            Теги
                          </a>
                          .
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md space-y-2">
                  <div className="flex gap-2">
                    <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-800">
                      <strong>Совет:</strong> Фильтры можно комбинировать. Если не указаны фильтры, рассылка будет отправлена всем активным пользователям бота.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-800">
                      <strong>Важно:</strong> Рассылка отправляется только активным пользователям (которые не заблокировали бота). Заблокированным пользователям отправить сообщение невозможно.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="scheduled_at" className="block text-sm font-medium text-gray-700 mb-2">
              ⏰ Запланировать отправку (необязательно)
            </label>
            <input
              type="datetime-local"
              id="scheduled_at"
              {...register('scheduled_at')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Если не указано, рассылка начнется сразу после создания
            </p>
            {errors.scheduled_at && <p className="text-red-500 text-sm mt-1">{errors.scheduled_at.message}</p>}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={createBroadcast.isPending}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg transform transition hover:scale-105"
            >
              {createBroadcast.isPending ? 'Создание...' : '🚀 Создать рассылку'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-medium"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
