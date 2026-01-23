'use client'

import DashboardLayout from '@/app/components/DashboardLayout'
import { useBots } from '@/app/hooks/useBots'
import { useAnalyticsOverview, useBotComparison, useConversionFunnel } from '@/app/hooks/useAnalytics'
import Link from 'next/link'
import { useState } from 'react'
import { Bot, Users, CheckCircle, Send, Calendar, TrendingUp, BarChart3, Target, Edit2, Play, Pause, Trash2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function DashboardPage() {
  const { data: bots, isLoading: botsLoading, error: botsError } = useBots()
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useAnalyticsOverview(30)
  const { data: comparison, isLoading: comparisonLoading } = useBotComparison()
  const [selectedBotId, setSelectedBotId] = useState<number | null>(bots?.[0]?.id || null)
  const { data: funnel, isLoading: funnelLoading } = useConversionFunnel(selectedBotId || 0)

  const loading = botsLoading || analyticsLoading || comparisonLoading
  const error = botsError || analyticsError

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Загрузка...</div>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !analytics) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error?.message || 'Ошибка загрузки данных'}
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-2">Обзор вашей Telegram-платформы</p>
        </div>

        {/* Основная статистика */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Всего ботов</p>
                <p className="text-3xl font-semibold text-gray-900">{analytics.total_bots}</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg">
                <Bot size={24} className="text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Всего пользователей</p>
                <p className="text-3xl font-semibold text-gray-900">{analytics.total_users}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users size={24} className="text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Активных</p>
                <p className="text-3xl font-semibold text-gray-900">{analytics.active_users}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle size={24} className="text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Рассылок</p>
                <p className="text-3xl font-semibold text-gray-900">{analytics.total_broadcasts}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <Send size={24} className="text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Статистика по времени */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Сегодня</p>
                <p className="text-3xl font-semibold text-gray-900">{analytics.users_today}</p>
                <p className="text-xs text-gray-500 mt-1">новых пользователей</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg">
                <Calendar size={20} className="text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">За неделю</p>
                <p className="text-3xl font-semibold text-gray-900">{analytics.users_this_week}</p>
                <p className="text-xs text-gray-500 mt-1">новых пользователей</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <BarChart3 size={20} className="text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">За месяц</p>
                <p className="text-3xl font-semibold text-gray-900">{analytics.users_this_month}</p>
                <p className="text-xs text-gray-500 mt-1">новых пользователей</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <TrendingUp size={20} className="text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* График пользователей по дням */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <TrendingUp size={20} className="text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Новые пользователи</h2>
          </div>
          {analytics.users_by_day && analytics.users_by_day.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analytics.users_by_day.map(point => ({
                    date: new Date(point.date).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                    }),
                    count: point.count,
                    fullDate: new Date(point.date).toLocaleDateString('ru-RU')
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      padding: '8px 12px'
                    }}
                    labelStyle={{ color: 'white', fontWeight: 'bold' }}
                    formatter={((value: number | string | undefined) => [`${value ?? 0} пользователей`, '']) as any}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#6366f1"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="text-sm text-gray-600 text-center">
                Показаны последние {analytics.users_by_day.length} {analytics.users_by_day.length === 1 ? 'день' : 'дней'}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-2">Нет данных за последние 30 дней</p>
              <p className="text-sm text-gray-400">Пользователи появятся на графике после регистрации</p>
            </div>
          )}
        </div>

        {/* Статистика по источникам */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Target size={20} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Статистика по источникам</h2>
          </div>
          {analytics.users_by_source && analytics.users_by_source.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Источник
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Всего
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Активных
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Конверсия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.users_by_source.map((source, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {source.source || 'unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {source.total_users}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {source.active_users}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {source.conversion_rate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-12">Нет данных по источникам</p>
          )}
        </div>

        {/* Статистика по рассылкам */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Всего рассылок</p>
                <p className="text-3xl font-semibold text-gray-900">{analytics.total_broadcasts}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <Send size={20} className="text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Успешных</p>
                <p className="text-3xl font-semibold text-gray-900">{analytics.successful_broadcasts}</p>
                {analytics.total_broadcasts > 0 && (
                  <p className="text-sm text-green-600 font-medium mt-1">
                    {((analytics.successful_broadcasts / analytics.total_broadcasts) * 100).toFixed(1)}% успешных
                  </p>
                )}
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle size={20} className="text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Воронка конверсии */}
        {bots && bots.length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Target size={20} className="text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Воронка конверсии</h2>
                </div>
                <p className="text-sm text-gray-600 ml-11">
                  Показывает путь пользователя от первого контакта до активного использования
                </p>
              </div>
              <select
                value={selectedBotId || ''}
                onChange={(e) => setSelectedBotId(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name || bot.username || `Bot #${bot.id}`}
                  </option>
                ))}
              </select>
            </div>
            {funnelLoading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : funnel && funnel.length > 0 ? (
              <div className="space-y-4">
                {funnel.map((step, index) => {
                  const stepLabels: Record<string, string> = {
                    'started': '🚀 Начали (нажали /start)',
                    'active': '✅ Активные (не заблокировали)',
                    'interacted': '💬 Взаимодействовали'
                  }
                  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500']
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-700">
                          {stepLabels[step.step] || step.step}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900">{step.count}</span>
                          <span className="text-sm text-gray-500">({step.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className={`${colors[index]} h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3`}
                          style={{ width: `${Math.max(step.percentage, 5)}%` }}
                        >
                          {step.percentage > 15 && (
                            <span className="text-white text-sm font-medium">
                              {step.count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Target size={48} className="mx-auto mb-2 opacity-50" />
                <p>Нет данных для воронки</p>
                <p className="text-sm mt-1">Данные появятся после регистрации пользователей</p>
              </div>
            )}
          </div>
        )}

        {/* Сравнение ботов */}
        {comparison && comparison.length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Bot size={20} className="text-purple-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Сравнение ботов</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Бот</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Всего</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Активных</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Конверсия</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сегодня</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Неделя</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Месяц</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {comparison.map((bot) => (
                    <tr key={bot.bot_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {bot.bot_name || `Bot #${bot.bot_id}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bot.total_users}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bot.active_users}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bot.conversion_rate.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bot.users_today}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bot.users_this_week}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bot.users_this_month}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Последние боты */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Bot size={20} className="text-indigo-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Ваши боты</h2>
            </div>
            <Link
              href="/bots"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
            >
              Управление ботами
            </Link>
          </div>
          {bots && bots.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              У вас пока нет ботов. Создайте первого бота!
            </div>
          ) : (
            <div className="divide-y">
              {bots?.slice(0, 5).map((bot) => (
                <div key={bot.id} className="p-6 flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <div className="font-semibold">
                      {bot.name || bot.username || `Bot #${bot.id}`}
                    </div>
                    <div className="text-sm text-gray-500">@{bot.username || 'нет username'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/bots/${bot.id}`}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                      title="Редактировать"
                    >
                      <Edit2 size={16} />
                    </Link>
                    <Link
                      href="/users"
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Пользователи"
                    >
                      <Users size={16} />
                    </Link>
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        bot.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {bot.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

