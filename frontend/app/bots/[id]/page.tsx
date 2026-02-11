'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray, useFormContext, FormProvider } from 'react-hook-form'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/app/components/DashboardLayout'
import { Channel } from '@/app/lib/api'
import { useBot, useUpdateBot } from '@/app/hooks/useBots'
import { useChannelInfo } from '@/app/hooks/useChannelInfo'
import { useTemplates } from '@/app/hooks/useTemplates'
import { useBotUsers } from '@/app/hooks/useUsers'
import { useBotStats } from '@/app/hooks/useAnalytics'
import {
  useReferralLinks,
  useCreateReferralLink,
  useDeleteReferralLink,
  type ReferralLink,
} from '@/app/hooks/useReferralLinks'
import { Settings, FileText, Tag, Zap, X, CheckCircle, Users, Link2, Copy, Plus } from 'lucide-react'
import { showToast } from '@/app/utils/toast'
import { copyToClipboardWithToast } from '@/app/utils/clipboard'

type FormData = {
  name: string
  welcome_message: string
  required_interaction: boolean
  interaction_delay_seconds: number
  continue_button_text: string
  channels: Channel[]
  is_active: boolean
  settings: {
    ui_texts: {
      ru: {
        channelsIntro: string
        thanks: string
        channelsNotConfigured: string
        chooseChannel: string
      }
      en: {
        channelsIntro: string
        thanks: string
        channelsNotConfigured: string
        chooseChannel: string
      }
    }
  }
}

const DEFAULT_UI_TEXTS = {
  ru: {
    channelsIntro: 'Отлично! Вот ссылки на наши каналы:',
    thanks: 'Спасибо за взаимодействие!',
    channelsNotConfigured: 'Каналы не настроены.',
    chooseChannel: 'Выберите канал:',
  },
  en: {
    channelsIntro: 'Great! Here are links to our channels:',
    thanks: 'Thanks for your interaction!',
    channelsNotConfigured: 'No channels configured.',
    chooseChannel: 'Choose a channel:',
  },
} as const

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
  const { watch, setValue, getFieldState } = useFormContext<FormData>()
  const url = watch(`channels.${index}.url`)
  const currentName = watch(`channels.${index}.name`)
  const { data: channelInfo, isLoading } = useChannelInfo(
    url || channelUrl || '',
    !!(url || channelUrl) && ((url || channelUrl).startsWith('http') || (url || channelUrl).startsWith('@') || (url || channelUrl).length > 3)
  )

  useEffect(() => {
    const nameState = getFieldState(`channels.${index}.name`)
    const urlState = getFieldState(`channels.${index}.url`)

    // Автозаполнение имени — только если пользователь ещё НЕ трогал поле
    if (channelInfo?.name && !currentName && !nameState.isDirty && !nameState.isTouched) {
      setValue(`channels.${index}.name`, channelInfo.name, { shouldValidate: true })
    }
    // Обновляем URL на нормализованный, если он был изменен
    // Только если пользователь ещё НЕ редактирует поле URL (иначе это "стирает" ввод)
    if (
      channelInfo?.normalized_url &&
      channelInfo.normalized_url !== url &&
      url &&
      !urlState.isDirty &&
      !urlState.isTouched
    ) {
      setValue(`channels.${index}.url`, channelInfo.normalized_url, { shouldValidate: true })
    }
  }, [channelInfo, index, currentName, url, setValue, getFieldState])

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
  const { data: users } = useBotUsers(botId)
  const { data: botStats } = useBotStats(botId)
  const updateBot = useUpdateBot()
  const { data: referralLinks = [], isLoading: loadingLinks } = useReferralLinks(botId)
  const createReferralLink = useCreateReferralLink()
  const deleteReferralLink = useDeleteReferralLink()
  
  // Хуки должны быть объявлены до всех условных возвратов
  const [newSource, setNewSource] = useState('')
  
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
      settings: {
        ui_texts: {
          ru: { ...DEFAULT_UI_TEXTS.ru },
          en: { ...DEFAULT_UI_TEXTS.en },
        },
      },
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: 'channels',
  })

  const requiredInteraction = methods.watch('required_interaction')
  const channels = methods.watch('channels')

  // Загружаем данные бота в форму
  const didHydrateFormRef = useRef(false)
  useEffect(() => {
    if (bot) {
      // Если пользователь уже начал редактировать форму — НЕ перезатираем введённые значения при refetch
      if (didHydrateFormRef.current && methods.formState.isDirty) {
        return
      }

      const channels = Array.isArray(bot.channels) ? [...bot.channels] : []
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
        settings: {
          ui_texts: {
            ru: {
              channelsIntro:
                bot.settings?.ui_texts?.ru?.channelsIntro ||
                bot.settings?.uiTexts?.ru?.channelsIntro ||
                DEFAULT_UI_TEXTS.ru.channelsIntro,
              thanks:
                bot.settings?.ui_texts?.ru?.thanks ||
                bot.settings?.uiTexts?.ru?.thanks ||
                DEFAULT_UI_TEXTS.ru.thanks,
              channelsNotConfigured:
                bot.settings?.ui_texts?.ru?.channelsNotConfigured ||
                bot.settings?.uiTexts?.ru?.channelsNotConfigured ||
                DEFAULT_UI_TEXTS.ru.channelsNotConfigured,
              chooseChannel:
                bot.settings?.ui_texts?.ru?.chooseChannel ||
                bot.settings?.uiTexts?.ru?.chooseChannel ||
                DEFAULT_UI_TEXTS.ru.chooseChannel,
            },
            en: {
              channelsIntro:
                bot.settings?.ui_texts?.en?.channelsIntro ||
                bot.settings?.uiTexts?.en?.channelsIntro ||
                DEFAULT_UI_TEXTS.en.channelsIntro,
              thanks:
                bot.settings?.ui_texts?.en?.thanks ||
                bot.settings?.uiTexts?.en?.thanks ||
                DEFAULT_UI_TEXTS.en.thanks,
              channelsNotConfigured:
                bot.settings?.ui_texts?.en?.channelsNotConfigured ||
                bot.settings?.uiTexts?.en?.channelsNotConfigured ||
                DEFAULT_UI_TEXTS.en.channelsNotConfigured,
              chooseChannel:
                bot.settings?.ui_texts?.en?.chooseChannel ||
                bot.settings?.uiTexts?.en?.chooseChannel ||
                DEFAULT_UI_TEXTS.en.chooseChannel,
            },
          },
        },
      })
      didHydrateFormRef.current = true
    }
  }, [bot, methods])

  const onSubmit = (data: FormData) => {
    const prevSettings =
      bot?.settings && typeof bot.settings === 'object' ? (bot.settings as Record<string, any>) : {}
    const nextSettings = (data.settings || {}) as any
    const mergedSettings: Record<string, any> = { ...prevSettings, ...nextSettings }

    // Глубокий merge для ui_texts
    if (nextSettings?.ui_texts) {
      mergedSettings.ui_texts = {
        ...(prevSettings as any).ui_texts,
        ...nextSettings.ui_texts,
        ru: { ...(prevSettings as any).ui_texts?.ru, ...nextSettings.ui_texts.ru },
        en: { ...(prevSettings as any).ui_texts?.en, ...nextSettings.ui_texts.en },
      }
    }

    const updateData = {
      ...data,
      settings: mergedSettings,
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

  const generateReferralLink = () => {
    if (!newSource.trim()) {
      showToast.error('Введите название источника')
      return
    }
    
    if (referralLinks.some(link => link.source === newSource.trim())) {
      showToast.error('Ссылка с таким источником уже существует')
      return
    }

    if (!bot?.username) {
      showToast.error('У бота нет username')
      return
    }

    createReferralLink.mutate(
      {
        botId,
        data: { source: newSource.trim() },
      },
      {
        onSuccess: () => {
          setNewSource('')
          showToast.success('Ссылка создана')
        },
        onError: (error: any) => {
          showToast.error(error?.response?.data?.detail || 'Ошибка при создании ссылки')
        },
      }
    )
  }

  const copyToClipboard = (text: string) => {
    copyToClipboardWithToast(text)
  }

  const removeReferralLink = (linkId: number) => {
    deleteReferralLink.mutate(
      { botId, linkId },
      {
        onSuccess: () => {
          showToast.success('Ссылка удалена')
        },
        onError: (error: any) => {
          showToast.error(error?.response?.data?.detail || 'Ошибка при удалении ссылки')
        },
      }
    )
  }

  // Статистика по источникам — из API аналитики (по всем пользователям), а не по первым 100
  const usersBySource = botStats?.users_by_source ?? {}
  const sortedSources = Object.entries(usersBySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // Топ 10 источников

  return (
    <DashboardLayout>
      <div className="max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Управление ботом
          </h1>
          
        </div>

        {/* Генератор реферальных ссылок */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="text-indigo-600" size={24} />
            <h2 className="text-2xl font-bold text-gray-900">Реферальные ссылки</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Создавайте уникальные ссылки для отслеживания источников трафика. Параметр будет сохранен в поле «source» пользователя.
          </p>

          {/* Базовая ссылка на бота */}
          {bot?.username && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-900 mb-2">Базовая ссылка на бота:</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-blue-800 font-mono break-all">
                  https://t.me/{bot.username}
                </code>
                <button
                  onClick={() => copyToClipboard(`https://t.me/${bot.username}`)}
                  className="px-3 py-1 text-blue-600 hover:bg-blue-100 rounded transition-colors flex items-center gap-1"
                  title="Скопировать"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Форма создания новой ссылки */}
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && generateReferralLink()}
              placeholder="Название источника (например: instagram, youtube, vk)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              onClick={generateReferralLink}
              disabled={createReferralLink.isPending || !bot?.username}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              {createReferralLink.isPending ? 'Создание...' : 'Создать ссылку'}
            </button>
          </div>

          {/* Список созданных ссылок */}
          {loadingLinks ? (
            <div className="text-center py-8 text-gray-500">Загрузка ссылок...</div>
          ) : referralLinks.length > 0 ? (
            <div className="space-y-3">
              {referralLinks.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700 mb-1">
                      Источник: <span className="text-indigo-600">{item.source}</span>
                    </div>
                    {item.link && (
                      <div className="text-sm text-gray-600 font-mono break-all">
                        {item.link}
                      </div>
                    )}
                  </div>
                  {item.link && (
                    <button
                      onClick={() => copyToClipboard(item.link!)}
                      className="px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                      title="Скопировать ссылку"
                    >
                      <Copy size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => removeReferralLink(item.id)}
                    disabled={deleteReferralLink.isPending}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Удалить"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Link2 size={48} className="mx-auto mb-2 opacity-50" />
              <p>Нет созданных ссылок</p>
              <p className="text-sm">Создайте первую ссылку для отслеживания источников трафика</p>
            </div>
          )}

          {/* Статистика по источникам */}
          {sortedSources.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Статистика по источникам трафика
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedSources.map(([source, count]) => (
                  <div
                    key={source}
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100"
                  >
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-indigo-600" />
                      <span className="font-medium text-gray-900">{source === 'unknown' ? 'Без источника' : source}</span>
                    </div>
                    <span className="text-lg font-bold text-indigo-600">{count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-gray-500 text-center">
                Всего пользователей: <span className="font-semibold text-gray-700">{botStats?.total_users ?? 0}</span>
              </div>
            </div>
          )}
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
                    href="/templates"
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors flex items-center gap-1"
                  >
                    <FileText size={14} />
                    <span>Используется шаблон «{welcomeTemplate.name}»</span>
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
                    Бот использует шаблон «<strong>{welcomeTemplate.name}</strong>» вместо этого поля. 
                    Чтобы использовать это поле, деактивируйте или удалите шаблон на странице{' '}
                    <Link href="/templates" className="underline font-semibold">
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
                  Нет каналов. Нажмите «Добавить канал», чтобы добавить.
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
                    Текст кнопки «Продолжить»
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

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Тексты сообщений (RU/EN)</h3>
              <p className="text-sm text-gray-500 mb-4">
                Эти тексты используются, когда бот показывает кнопки с каналами после нажатия «Продолжить» или по команде
                /channels. Язык определяется по Telegram <code className="px-1 bg-gray-100 rounded">language_code</code>.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Русский</h4>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Текст перед списком каналов</label>
                    <textarea
                      rows={2}
                      {...methods.register('settings.ui_texts.ru.channelsIntro')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Если каналов нет</label>
                    <textarea
                      rows={2}
                      {...methods.register('settings.ui_texts.ru.channelsNotConfigured')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Подпись команды /channels</label>
                    <textarea
                      rows={2}
                      {...methods.register('settings.ui_texts.ru.chooseChannel')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Если каналов нет после «Продолжить»</label>
                    <textarea
                      rows={2}
                      {...methods.register('settings.ui_texts.ru.thanks')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">English</h4>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Intro before channel links</label>
                    <textarea
                      rows={2}
                      {...methods.register('settings.ui_texts.en.channelsIntro')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">If no channels configured</label>
                    <textarea
                      rows={2}
                      {...methods.register('settings.ui_texts.en.channelsNotConfigured')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Caption for /channels</label>
                    <textarea
                      rows={2}
                      {...methods.register('settings.ui_texts.en.chooseChannel')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">If no channels after “Continue”</label>
                    <textarea
                      rows={2}
                      {...methods.register('settings.ui_texts.en.thanks')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

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

