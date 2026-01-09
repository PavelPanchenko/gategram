'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray, FormProvider, useFormContext } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/app/components/DashboardLayout'
import { Channel } from '@/app/lib/api'
import { useCreateBot } from '@/app/hooks/useBots'
import { useChannelInfo } from '@/app/hooks/useChannelInfo'
import { useBotInfo } from '@/app/hooks/useBotInfo'

type FormData = {
  token: string
  name: string
  welcome_message: string
  required_interaction: boolean
  interaction_delay_seconds: number
  continue_button_text: string
  channels: Channel[]
}

export default function NewBotPage() {
  const router = useRouter()
  const createBot = useCreateBot()
  const methods = useForm<FormData>({
    defaultValues: {
      token: '',
      name: '',
      welcome_message: 'Добро пожаловать!',
      required_interaction: true,
      interaction_delay_seconds: 5,
      continue_button_text: '✅ Продолжить',
      channels: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: 'channels',
  })

  const requiredInteraction = methods.watch('required_interaction')
  const channels = methods.watch('channels')
  const token = methods.watch('token')
  const currentBotName = methods.watch('name')
  
  // Автоматическое подтягивание названия бота из токена
  const { data: botInfo, isLoading: loadingBotInfo } = useBotInfo(
    token || '',
    !!token && token.length > 20 && !currentBotName
  )

  useEffect(() => {
    if (botInfo?.first_name && !currentBotName) {
      methods.setValue('name', botInfo.first_name, { shouldValidate: true })
    }
  }, [botInfo, currentBotName, methods])

  const onSubmit = (data: FormData) => {
    // Фильтруем пустые каналы
    const createData = {
      ...data,
      channels: data.channels.filter((ch) => ch.name.trim() && ch.url.trim()),
    }
    createBot.mutate(createData)
  }

  const addChannel = () => {
    append({ name: '', url: '' })
  }

  // Обработка авто-подтягивания названий каналов
  const handleChannelUrlChange = (index: number, url: string) => {
    methods.setValue(`channels.${index}.url`, url)
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">Создать нового бота</h1>

        {createBot.isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {createBot.error?.message || 'Ошибка при создании бота'}
          </div>
        )}

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="bg-white rounded-lg shadow p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telegram Bot Token *
              </label>
            <input
              type="text"
              {...methods.register('token', { required: 'Токен обязателен' })}
              className={`w-full px-3 py-2 border ${
                methods.formState.errors.token ? 'border-red-300' : 'border-gray-300'
              } rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
            />
            {methods.formState.errors.token && (
              <p className="mt-1 text-sm text-red-600">{methods.formState.errors.token.message}</p>
            )}
            {loadingBotInfo && (
              <p className="mt-1 text-sm text-gray-500">Загрузка информации о боте...</p>
            )}
            <p className="mt-1 text-sm text-gray-500">Получите токен у @BotFather в Telegram</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Имя бота</label>
            <input
              type="text"
              {...methods.register('name')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Мой бот (будет заполнено автоматически)"
            />
            <p className="mt-1 text-sm text-gray-500">
              Оставьте пустым, чтобы использовать название бота из Telegram
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Приветственное сообщение
            </label>
            <textarea
              {...methods.register('welcome_message')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Каналы</label>
              <button
                type="button"
                onClick={addChannel}
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
                    remove={remove}
                    onUrlChange={handleChannelUrlChange}
                  />
                ))}
              </div>
            )}
            {fields.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ Важно:</strong> Для работы триггеров на подписку/отписку от канала, бот должен быть администратором канала в Telegram. 
                  Добавьте бота как администратора в настройках канала.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              {...methods.register('required_interaction')}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700">
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
                  placeholder="✅ Продолжить"
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
                  {...methods.register('interaction_delay_seconds', {
                    valueAsNumber: true,
                    min: { value: 0, message: 'Минимум 0' },
                    max: { value: 300, message: 'Максимум 300' },
                  })}
                  className={`w-full px-3 py-2 border ${
                    methods.formState.errors.interaction_delay_seconds ? 'border-red-300' : 'border-gray-300'
                  } rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                />
                {methods.formState.errors.interaction_delay_seconds && (
                  <p className="mt-1 text-sm text-red-600">
                    {methods.formState.errors.interaction_delay_seconds.message}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={createBot.isPending}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {createBot.isPending ? 'Создание...' : 'Создать бота'}
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
    </DashboardLayout>
  )
}

// Компонент для ввода канала с авто-подтягиванием названия
function ChannelInput({
  index,
  remove,
  onUrlChange,
}: {
  index: number
  remove: (index: number) => void
  onUrlChange: (index: number, url: string) => void
}) {
  const { watch, setValue, register } = useFormContext<FormData>()
  const url = watch(`channels.${index}.url`)
  const currentName = watch(`channels.${index}.name`)
  const { data: channelInfo, isLoading } = useChannelInfo(
    url || '',
    !!url && (url.startsWith('http') || url.startsWith('@') || url.length > 3)
  )

  useEffect(() => {
    if (channelInfo?.name && !currentName) {
      setValue(`channels.${index}.name`, channelInfo.name, { shouldValidate: true })
    }
    // Обновляем URL на нормализованный, если он был изменен
    if (channelInfo?.normalized_url && channelInfo.normalized_url !== url) {
      setValue(`channels.${index}.url`, channelInfo.normalized_url, { shouldValidate: true })
    }
  }, [channelInfo, index, currentName, url, setValue])

  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1">
        <input
          type="text"
          {...register(`channels.${index}.name`)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 mb-2"
          placeholder="Название канала"
        />
        <input
          type="url"
          {...register(`channels.${index}.url`)}
          onChange={(e) => onUrlChange(index, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="https://t.me/your_channel или @username"
        />
        {isLoading && <p className="mt-1 text-xs text-gray-500">Загрузка названия...</p>}
      </div>
      <button
        type="button"
        onClick={() => remove(index)}
        className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
      >
        Удалить
      </button>
    </div>
  )
}
