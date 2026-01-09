'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray, useFormContext, FormProvider } from 'react-hook-form'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/app/components/DashboardLayout'
import { Channel } from '@/app/lib/api'
import { useBot, useUpdateBot } from '@/app/hooks/useBots'
import { useChannelInfo } from '@/app/hooks/useChannelInfo'
import { useTemplates } from '@/app/hooks/useTemplates'
import { Settings, FileText, Tag, Zap, X, CheckCircle, Users } from 'lucide-react'

type FormData = {
  name: string
  welcome_message: string
  required_interaction: boolean
  interaction_delay_seconds: number
  continue_button_text: string
  channels: Channel[]
  is_active: boolean
}

function ChannelInput({ 
  index, 
  register, 
  onRemove, 
  channelUrl 
}: { 
  index: number
  register: any
  onRemove: (index: number) => void
  channelUrl: string
}) {
  const { watch, setValue } = useFormContext<FormData>()
  const url = watch(`channels.${index}.url`)
  const currentName = watch(`channels.${index}.name`)
  const { data: channelInfo, isLoading } = useChannelInfo(
    url || channelUrl || '',
    !!(url || channelUrl) && ((url || channelUrl).startsWith('http') || (url || channelUrl).startsWith('@') || (url || channelUrl).length > 3)
  )

  useEffect(() => {
    if (channelInfo?.name && !currentName) {
      setValue(`channels.${index}.name`, channelInfo.name, { shouldValidate: true })
    }
    // Обновляем URL на нормализованный, если он был изменен
    if (channelInfo?.normalized_url && channelInfo.normalized_url !== url && url) {
      setValue(`channels.${index}.url`, channelInfo.normalized_url, { shouldValidate: true })
    }
  }, [channelInfo, index, currentName, url, setValue])

  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1">
        <input
          type="text"
          {...register(`channels.${index}.name`)}
          placeholder={isLoading ? 'Загрузка...' : channelInfo?.name || 'Название канала'}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div className="flex-1">
        <input
          type="text"
          {...register(`channels.${index}.url`)}
          placeholder="@username или https://t.me/..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
        {isLoading && <p className="mt-1 text-xs text-gray-500">Загрузка названия...</p>}
      </div>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="px-3 py-2 text-red-600 hover:text-red-800"
        title="Удалить канал"
      >
        <X size={18} />
      </button>
    </div>
  )
}

export default function EditBotPage() {
  const router = useRouter()
  const params = useParams()
  const botId = parseInt(params.id as string)
  
  const { data: bot, isLoading: loadingBot, error: loadError } = useBot(botId)
  const { data: templates } = useTemplates(botId)
  const updateBot = useUpdateBot()
  
  // Проверяем, есть ли активный шаблон с "welcome" в названии
  const welcomeTemplate = templates?.find(
    (t) => t.is_active && t.name.toLowerCase().includes('welcome')
  )

  const methods = useForm<FormData>({
    defaultValues: {
      name: '',
      welcome_message: '',
      required_interaction: true,
      interaction_delay_seconds: 5,
      continue_button_text: 'Продолжить',
      channels: [],
      is_active: false,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: 'channels',
  })

  const requiredInteraction = methods.watch('required_interaction')
  const channels = methods.watch('channels')

  // Загружаем данные бота в форму
  useEffect(() => {
    if (bot) {
      const channels = bot.channels || []
      // Если есть старый channel_link и его нет в channels, добавляем
      if (bot.channel_link && !channels.some((ch) => ch.url === bot.channel_link)) {
        channels.push({ name: 'Канал', url: bot.channel_link })
      }

      methods.reset({
        name: bot.name || '',
        welcome_message: bot.welcome_message || '',
        required_interaction: bot.required_interaction,
        interaction_delay_seconds: bot.interaction_delay_seconds,
        continue_button_text: bot.continue_button_text || 'Продолжить',
        channels: channels,
        is_active: bot.is_active,
      })
    }
  }, [bot, methods])

  const onSubmit = (data: FormData) => {
    const updateData = {
      ...data,
      channels: data.channels.filter((ch) => ch.name.trim() && ch.url.trim()),
      // Явно преобразуем interaction_delay_seconds в число
      interaction_delay_seconds: typeof data.interaction_delay_seconds === 'string' 
        ? parseInt(data.interaction_delay_seconds, 10) || 0
        : data.interaction_delay_seconds,
    }
    
    updateBot.mutate(
      { botId, botData: updateData },
      {
        onSuccess: () => {
          router.push('/bots')
        },
      }
    )
  }

  if (loadingBot) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Загрузка...</div>
      </DashboardLayout>
    )
  }

  if (loadError || !bot) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-red-600">
          {loadError ? 'Ошибка при загрузке бота' : 'Бот не найден'}
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Управление ботом
          </h1>
          
          {/* Быстрые ссылки */}
          <div className="flex gap-3 mb-6">
            <Link
              href="/templates"
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all text-sm font-medium text-gray-700 flex items-center gap-2"
            >
              <FileText size={16} />
              <span>Шаблоны</span>
            </Link>
            <Link
              href="/tags"
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-sm transition-all text-sm font-medium text-gray-700 flex items-center gap-2"
            >
              <Tag size={16} />
              <span>Теги</span>
            </Link>
            <Link
              href="/triggers"
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all text-sm font-medium text-gray-700 flex items-center gap-2"
            >
              <Zap size={16} />
              <span>Триггеры</span>
            </Link>
            <Link
              href={`/bots/${botId}/users`}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all text-sm font-medium text-gray-700 flex items-center gap-2"
            >
              <Users size={16} />
              <span>Пользователи</span>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Основные настройки</h2>

          {updateBot.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {updateBot.error?.message || 'Ошибка при обновлении бота'}
            </div>
          )}

          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Имя бота
              </label>
              <input
                type="text"
                {...methods.register('name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Приветственное сообщение
                </label>
                {welcomeTemplate && (
                  <Link
                    href={`/bots/${botId}/templates`}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors flex items-center gap-1"
                  >
                    <FileText size={14} />
                    <span>Используется шаблон "{welcomeTemplate.name}"</span>
                  </Link>
                )}
              </div>
              <textarea
                {...methods.register('welcome_message')}
                rows={4}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                  welcomeTemplate 
                    ? 'border-blue-300 bg-blue-50 opacity-75' 
                    : 'border-gray-300'
                }`}
                disabled={!!welcomeTemplate}
              />
              {welcomeTemplate ? (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800 mb-2 flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    <strong>Активен шаблон приветствия</strong>
                  </p>
                  <p className="text-xs text-blue-700 mb-2">
                    Бот использует шаблон "<strong>{welcomeTemplate.name}</strong>" вместо этого поля. 
                    Чтобы использовать это поле, деактивируйте или удалите шаблон на странице{' '}
                    <Link href={`/bots/${botId}/templates`} className="underline font-semibold">
                      Шаблоны
                    </Link>.
                  </p>
                  <p className="text-xs text-blue-600">
                    Текст шаблона: <span className="font-mono bg-white px-2 py-1 rounded">{welcomeTemplate.content}</span>
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  Доступные переменные: {'{'}{'{'} user_name {'}'}{'}'}, {'{'}{'{'} user_first_name {'}'}{'}'}, {'{'}{'{'} source {'}'}{'}'}
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Каналы</label>
                <button
                  type="button"
                  onClick={() => append({ name: '', url: '' })}
                  className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                >
                  + Добавить канал
                </button>
              </div>
              {fields.length === 0 ? (
                <div className="text-sm text-gray-500 mb-2">
                  Нет каналов. Нажмите "Добавить канал" чтобы добавить.
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <ChannelInput
                      key={field.id}
                      index={index}
                      register={methods.register}
                      onRemove={remove}
                      channelUrl={channels[index]?.url || ''}
                    />
                  ))}
                </div>
              )}
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ Важно:</strong> Для работы триггеров на подписку/отписку от канала, бот должен быть администратором канала в Telegram. 
                  Добавьте бота как администратора в настройках канала.
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="required_interaction"
                {...methods.register('required_interaction')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="required_interaction" className="ml-2 block text-sm text-gray-700">
                Требовать взаимодействие перед доступом к каналу
              </label>
            </div>

            {requiredInteraction && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Текст кнопки "Продолжить"
                  </label>
                  <input
                    type="text"
                    {...methods.register('continue_button_text')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Продолжить"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Задержка перед доступом (секунды)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    step="1"
                    {...methods.register('interaction_delay_seconds', { 
                      setValueAs: (v) => {
                        const num = v === '' || v === null || v === undefined ? 0 : parseInt(String(v), 10)
                        return isNaN(num) ? 0 : Math.max(0, Math.min(300, num))
                      },
                      validate: (v) => {
                        const num = typeof v === 'number' ? v : parseInt(String(v), 10)
                        return (num >= 0 && num <= 300) || 'Значение должно быть от 0 до 300'
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {methods.formState.errors.interaction_delay_seconds && (
                    <p className="mt-1 text-sm text-red-600">
                      {methods.formState.errors.interaction_delay_seconds.message}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                {...methods.register('is_active')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                Бот активен
              </label>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={updateBot.isPending}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {updateBot.isPending ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Отмена
              </button>
            </div>
          </form>
          </FormProvider>
        </div>
      </div>
    </DashboardLayout>
  )
}

