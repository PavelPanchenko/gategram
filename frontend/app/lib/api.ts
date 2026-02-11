// Используем переменную окружения везде (клиент и сервер).
// NEXT_PUBLIC_* переменные доступны и на клиенте, и на сервере в Next.js.
//
// Важно:
// - В браузере "localhost" означает устройство пользователя, а не сервер.
// - Для SSR (серверной рендеринга) используем внутренний Docker хост (backend-node:8001) для скорости.
// - На клиенте используем внешний IP или автоматически определяем по hostname.
const envApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()
const apiPort = (process.env.NEXT_PUBLIC_API_PORT || '8001').trim()
const apiHost = process.env.NEXT_PUBLIC_API_HOST?.trim() || 'localhost'
// Для SSR используем внутренний Docker хост (если доступен) или fallback
const ssrApiHost = process.env.NEXT_PUBLIC_API_URL_SSR?.trim() || 'backend-node'

const API_URL =
  typeof window !== 'undefined'
    ? // КЛИЕНТ (браузер): используем явный URL или собираем по hostname
      (envApiUrl && envApiUrl.length > 0
        ? envApiUrl
        : `${window.location.protocol}//${window.location.hostname}:${apiPort}/api`)
    : // SSR (сервер): используем внутренний Docker хост для скорости
      (process.env.NEXT_PUBLIC_API_URL_SSR
        ? `http://${ssrApiHost}:${apiPort}/api`
        : envApiUrl && envApiUrl.length > 0
          ? envApiUrl
          : `http://${ssrApiHost}:${apiPort}/api`)

// API URL конфигурация
// В случае проблем с подключением проверьте NEXT_PUBLIC_API_URL в frontend/.env.local

// Проверка истечения токена
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp * 1000 // Конвертируем в миллисекунды
    return Date.now() >= exp
  } catch {
    return true
  }
}

// Функция для обновления токена
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken || isTokenExpired(refreshToken)) {
    // Refresh token истёк или отсутствует
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    // Редирект на логин только если мы не на странице логина
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login'
    }
    return null
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh token')
    }

    const data: TokenResponse = await response.json()
    localStorage.setItem('access_token', data.access_token)
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token)
    }
    return data.access_token
  } catch (error) {
    // Не удалось обновить токен
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    // Редирект на логин только если мы не на странице логина
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login'
    }
    return null
  }
}

export interface User {
  id: number
  email: string
  is_active: boolean
  is_superuser: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface Channel {
  name: string
  url: string
}

export interface Bot {
  id: number
  owner_id: number
  token: string
  username: string | null
  name: string | null
  is_active: boolean
  welcome_message: string | null
  required_interaction: boolean
  interaction_delay_seconds: number
  continue_button_text: string
  channel_link: string | null
  channels: Channel[]
  settings: Record<string, any>
  created_at: string
  updated_at: string | null
}

export interface BroadcastFilters {
  new_users_days?: number  // Новые пользователи (зарегистрировались за последние N дней)
  inactive_days?: number   // Неактивные пользователи (не заходили N дней)
  source?: string          // Фильтр по источнику
  tags?: string[]          // Фильтр по тегам
  // Примечание: статус всегда 'active', так как заблокированным пользователям отправить нельзя
}

export interface Broadcast {
  id: number
  bot_id: number
  owner_id: number
  message_text: string
  media_type: string | null
  media_url: string | null
  status: 'pending' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled'
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  total_users: number
  sent_count: number
  failed_count: number
  filters?: BroadcastFilters | null
  created_at: string
}

export interface PagedResult<T> {
  items: T[]
  total: number
  skip: number
  limit: number
  counts?: Record<string, number>
  /** Уникальные значения для фильтра «Источник» (все источники по текущим bot_id/status) */
  sources?: string[]
}

export interface AnalyticsOverview {
  total_bots: number
  total_users: number
  active_users: number
  total_broadcasts: number
  successful_broadcasts: number
  users_today: number
  users_this_week: number
  users_this_month: number
  users_by_day: Array<{ date: string; count: number }>
  users_by_source: Array<{
    source: string
    total_users: number
    active_users: number
    conversion_rate: number
  }>
}

export interface BotStats {
  bot_id: number
  bot_name: string | null
  total_users: number
  active_users: number
  blocked_users: number
  users_by_source: Record<string, number>
  users_today: number
  users_this_week: number
  users_this_month: number
}

export interface TelegramUser {
  id: number
  bot_id: number
  bot_name?: string | null  // Добавлено для глобального просмотра
  telegram_user_id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  source: string | null
  status: 'active' | 'blocked' | 'left'
  joined_at: string
  last_activity: string
  tags?: UserTag[]
}

export interface MessageTemplate {
  bot_name?: string | null  // Название бота (для глобальных запросов)
  id: number
  bot_id: number
  name: string
  content: string
  variables: Record<string, string>
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface UserTag {
  id: number
  bot_id: number
  name: string
  color: string
  description: string | null
  created_at: string
  bot_name?: string | null  // Название бота (для глобальных запросов)
}

export interface Trigger {
  id: number
  bot_id: number
  name: string
  event_type: string
  conditions: Record<string, any>
  // Новый формат: массив действий
  actions?: Array<{ type: string; data?: Record<string, any> }>
  // Старый формат (для совместимости)
  action_type: string
  action_data: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string | null
  bot_name?: string | null  // Название бота (для глобальных запросов)
}

// Webhook interface removed

export interface ConversionFunnel {
  step: string
  count: number
  percentage: number
}

export interface BotComparison {
  bot_id: number
  bot_name: string | null
  total_users: number
  active_users: number
  conversion_rate: number
  users_today: number
  users_this_week: number
  users_this_month: number
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private isDev() {
    return process.env.NODE_ENV !== 'production'
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    let token = this.getToken()
    
    // Проверяем истечение токена перед запросом (с запасом в 5 минут)
    if (token && isTokenExpired(token)) {
      // Пытаемся обновить токен
      token = await refreshAccessToken()
      if (!token) {
        throw new Error('Session expired')
      }
    } else if (token) {
      // Проверяем, не истекает ли токен скоро (в течение 5 минут)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const exp = payload.exp * 1000
        const timeUntilExpiry = exp - Date.now()
        // Если токен истечет в течение 5 минут, обновляем его заранее
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          const newToken = await refreshAccessToken()
          if (newToken) {
            token = newToken
          }
        }
      } catch {
        // Если не удалось проверить, продолжаем с текущим токеном
      }
    }

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    }

    // Добавляем Content-Type только если его нет и это не FormData
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const url = `${this.baseUrl}${endpoint}`

    // Таймаут для запросов (30 секунд по умолчанию, для /users - 60 секунд)
    const timeoutMs = endpoint.includes('/users') ? 60000 : 30000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs / 1000} seconds`)
      }
      throw error
    }

    if (!response.ok) {
      // Если 401, пытаемся обновить токен и повторить запрос
      if (response.status === 401) {
        const newToken = await refreshAccessToken()
        if (newToken && endpoint !== '/auth/refresh') {
          // Повторяем запрос с новым токеном (с таймаутом)
          headers['Authorization'] = `Bearer ${newToken}`
          const retryController = new AbortController()
          const retryTimeoutId = setTimeout(() => retryController.abort(), timeoutMs)
          try {
            const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
              ...options,
              headers,
              credentials: 'include',
              signal: retryController.signal,
            })
            clearTimeout(retryTimeoutId)
            
            if (!retryResponse.ok) {
              this.removeToken()
              throw new Error('Unauthorized')
            }
            
            // Проверяем, есть ли контент для парсинга
            const contentType = retryResponse.headers.get('content-type')
            if (retryResponse.status === 204 || !contentType?.includes('application/json')) {
              return null as T
            }
            
            const text = await retryResponse.text()
            return text ? JSON.parse(text) : null as T
          } catch (retryError: any) {
            clearTimeout(retryTimeoutId)
            if (retryError.name === 'AbortError') {
              throw new Error(`Request timeout after ${timeoutMs / 1000} seconds`)
            }
            throw retryError
          }
        }
        this.removeToken()
      }
      // Для 422 ошибок пытаемся получить детали
      if (response.status === 422) {
        const error = await response.json().catch(() => ({ detail: 'Validation error' }))
        throw new Error(error.detail || error.message || `HTTP error! status: ${response.status}`)
      }
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(error.detail || `HTTP error! status: ${response.status}`)
    }

    // Обрабатываем пустые ответы (204 No Content)
    if (response.status === 204) {
      return null as T
    }

    // Проверяем, есть ли контент для парсинга
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const text = await response.text()
      return (text ? JSON.parse(text) : null) as T
    }

    const text = await response.text()
    if (!text) {
      return null as T
    }

    try {
      return JSON.parse(text)
    } catch (e) {
      // Если не удалось распарсить JSON, возвращаем null
      return null as T
    }
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('access_token')
  }

  private setToken(token: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('access_token', token)
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('refresh_token')
  }

  private setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('refresh_token', token)
  }

  private isTokenExpired(token: string): boolean {
    return isTokenExpired(token)
  }

  private async refreshToken(refreshToken: string): Promise<TokenResponse> {
    return refreshAccessToken().then(async (newToken) => {
      if (!newToken) {
        throw new Error('Failed to refresh token')
      }
      // Получаем новый refresh token из ответа
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!response.ok) {
        throw new Error('Failed to refresh token')
      }
      return response.json()
    })
  }

  private removeToken(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  // Auth
  async register(email: string, password: string): Promise<User> {
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async login(email: string, password: string): Promise<TokenResponse> {
    const url = `${this.baseUrl}/auth/login`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Неверный email или пароль' }))
      throw new Error(error.detail || 'Неверный email или пароль')
    }

    const data = await response.json()
    // Сохраняем токены
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
    }
    return data
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me')
  }

  async logout(): Promise<void> {
    this.removeToken()
  }

  // Bots
  async getBots(): Promise<Bot[]> {
    return this.request<Bot[]>('/bots')
  }

  async getBot(botId: number): Promise<Bot> {
    return this.request<Bot>(`/bots/${botId}`)
  }

  async createBot(botData: {
    token: string
    name?: string
    welcome_message?: string
    required_interaction?: boolean
    interaction_delay_seconds?: number
    continue_button_text?: string
    channels?: Channel[]
    channel_link?: string
  }): Promise<Bot> {
    return this.request<Bot>('/bots', {
      method: 'POST',
      body: JSON.stringify(botData),
    })
  }

  async updateBot(
    botId: number,
    botData: {
      name?: string
      is_active?: boolean
      welcome_message?: string
      required_interaction?: boolean
      interaction_delay_seconds?: number
      continue_button_text?: string
      channels?: Channel[]
      channel_link?: string
    }
  ): Promise<Bot> {
    return this.request<Bot>(`/bots/${botId}`, {
      method: 'PUT',
      body: JSON.stringify(botData),
    })
  }

  async getChannelInfo(url: string): Promise<{ name: string | null; normalized_url?: string }> {
    return this.request<{ name: string | null; normalized_url?: string }>(`/bots/channel-info?url=${encodeURIComponent(url)}`)
  }

  async validateBotToken(token: string): Promise<{ username: string | null; first_name: string | null }> {
    // Используем временный эндпоинт для валидации токена
    // Можно создать отдельный эндпоинт или использовать существующий
    const response = await fetch(`${this.baseUrl}/bots/validate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getToken()}`,
      },
      body: JSON.stringify({ token }),
    })
    if (!response.ok) {
      throw new Error('Неверный токен')
    }
    return response.json()
  }

  async deleteBot(botId: number): Promise<void> {
    return this.request<void>(`/bots/${botId}`, {
      method: 'DELETE',
    })
  }

  async startBot(botId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/bots/${botId}/start`, {
      method: 'POST',
    })
  }

  async stopBot(botId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/bots/${botId}/stop`, {
      method: 'POST',
    })
  }

  // Broadcasts
  async getBroadcasts(
    botId?: number,
    status?: string,
    skip: number = 0,
    limit: number = 50
  ): Promise<Broadcast[]> {
    const params = new URLSearchParams()
    if (botId) params.append('bot_id', botId.toString())
    if (status) params.append('status_filter', status)
    params.append('skip', skip.toString())
    params.append('limit', limit.toString())
    const query = params.toString()
    return this.request<Broadcast[]>(`/broadcasts${query ? `?${query}` : ''}`)
  }

  async getBroadcastsPaged(
    botId?: number,
    status?: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<PagedResult<Broadcast>> {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1
    const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 1000) : 50
    const skip = (safePage - 1) * safeSize
    const limit = safeSize

    const params = new URLSearchParams()
    if (botId) params.append('bot_id', botId.toString())
    if (status) params.append('status_filter', status)
    params.append('skip', skip.toString())
    params.append('limit', limit.toString())
    params.append('include_total', '1')

    return this.request<PagedResult<Broadcast>>(`/broadcasts?${params.toString()}`)
  }

  async getBroadcast(broadcastId: number): Promise<Broadcast> {
    return this.request<Broadcast>(`/broadcasts/${broadcastId}`)
  }

  async createBroadcast(broadcastData: {
    bot_id: number
    message_text: string
    template_id?: number | null
    media_type?: string | null
    media_file?: File | null
    media_files?: File[] | null
    scheduled_at?: string | null
    filters?: BroadcastFilters | null
  }): Promise<Broadcast> {
    const formData = new FormData()
    formData.append('bot_id', broadcastData.bot_id.toString())
    formData.append('message_text', broadcastData.message_text)
    if (broadcastData.template_id) {
      formData.append('template_id', broadcastData.template_id.toString())
    }
    
    // Добавляем множественные файлы (приоритет над одиночным файлом)
    if (broadcastData.media_files && broadcastData.media_files.length > 0) {
      for (const file of broadcastData.media_files) {
        formData.append('media_files', file)
      }
    } else if (broadcastData.media_type && broadcastData.media_file) {
      // Обратная совместимость: одиночный файл
      formData.append('media_type', broadcastData.media_type)
      formData.append('media_file', broadcastData.media_file)
    }
    
    if (broadcastData.scheduled_at) {
      formData.append('scheduled_at', broadcastData.scheduled_at)
    }
    
    if (broadcastData.filters && Object.keys(broadcastData.filters).length > 0) {
      formData.append('filters', JSON.stringify(broadcastData.filters))
    }

    const token = this.getToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${this.baseUrl}/broadcasts`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    })

    if (!response.ok) {
      if (response.status === 401) {
        const refreshToken = this.getRefreshToken()
        if (refreshToken && !this.isTokenExpired(refreshToken)) {
          // Пытаемся обновить токен и повторить запрос
          try {
            const newTokens = await this.refreshToken(refreshToken)
            this.setToken(newTokens.access_token)
            this.setRefreshToken(newTokens.refresh_token)
            headers['Authorization'] = `Bearer ${newTokens.access_token}`
            
            const retryResponse = await fetch(`${this.baseUrl}/broadcasts`, {
              method: 'POST',
              headers,
              body: formData,
              credentials: 'include',
            })
            
            if (retryResponse.ok) {
              return retryResponse.json()
            }
          } catch (refreshError) {
            this.removeToken()
            throw refreshError
          }
        } else {
          this.removeToken()
        }
      }
      
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(error.detail || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async cancelBroadcast(broadcastId: number): Promise<Broadcast> {
    return this.request<Broadcast>(`/broadcasts/${broadcastId}/cancel`, {
      method: 'POST',
    })
  }

  async deleteBroadcast(broadcastId: number, deleteMessages: boolean = false): Promise<void> {
    const url = `/broadcasts/${broadcastId}`
    const headers: Record<string, string> = {}

    if (deleteMessages) {
      headers['X-Delete-Messages'] = 'true'
      const body = JSON.stringify({ delete_messages: true })
      return this.request<void>(url, {
        method: 'DELETE',
        headers,
        body,
      })
    }
    
    return this.request<void>(url, {
      method: 'DELETE',
      headers,
    })
  }

  // Analytics
  async getAnalyticsOverview(days: number = 30): Promise<AnalyticsOverview> {
    return this.request<AnalyticsOverview>(`/analytics/overview?days=${days}`)
  }

  async getBotStats(botId: number): Promise<BotStats> {
    return this.request<BotStats>(`/analytics/bots/${botId}/stats`)
  }

  // Telegram Users
  async getBotUsers(
    botId: number,
    status?: string,
    source?: string,
    skip: number = 0,
    limit: number = 100
  ): Promise<TelegramUser[]> {
    const params = new URLSearchParams()
    if (status) params.append('status_filter', status)
    if (source) params.append('source_filter', source)
    params.append('skip', skip.toString())
    params.append('limit', limit.toString())
    return this.request<TelegramUser[]>(`/bots/${botId}/users?${params.toString()}`)
  }

  async deleteBotUser(botId: number, userId: number): Promise<void> {
    return this.request<void>(`/bots/${botId}/users/${userId}`, {
      method: 'DELETE',
    })
  }

  async getAllUsers(
    botId?: number,
    statusFilter?: string,
    sourceFilter?: string,
    skip: number = 0,
    limit: number = 100
  ): Promise<TelegramUser[]> {
    const params = new URLSearchParams()
    if (botId) params.append('bot_id', botId.toString())
    if (statusFilter) params.append('status_filter', statusFilter)
    if (sourceFilter) params.append('source_filter', sourceFilter)
    params.append('skip', skip.toString())
    params.append('limit', limit.toString())
    return this.request<TelegramUser[]>(`/users?${params.toString()}`)
  }

  async getAllUsersPaged(
    botId?: number,
    statusFilter?: string,
    sourceFilter?: string,
    page: number = 1,
    pageSize: number = 100
  ): Promise<PagedResult<TelegramUser>> {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1
    const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 1000) : 100
    const skip = (safePage - 1) * safeSize
    const limit = safeSize

    const params = new URLSearchParams()
    if (botId) params.append('bot_id', botId.toString())
    if (statusFilter) params.append('status_filter', statusFilter)
    if (sourceFilter) params.append('source_filter', sourceFilter)
    params.append('skip', skip.toString())
    params.append('limit', limit.toString())
    params.append('include_total', '1')

    return this.request<PagedResult<TelegramUser>>(`/users?${params.toString()}`)
  }

  async exportUsersCsv(
    botId?: number,
    statusFilter?: string,
    sourceFilter?: string
  ): Promise<{ blob: Blob; filename: string }> {
    const params = new URLSearchParams()
    if (botId) params.append('bot_id', botId.toString())
    if (statusFilter) params.append('status_filter', statusFilter)
    if (sourceFilter) params.append('source_filter', sourceFilter)

    const token = this.getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const url = `${this.baseUrl}/users/export?${params.toString()}`
    let response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    })

    if (response.status === 401) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`
        response = await fetch(url, {
          method: 'GET',
          headers,
          credentials: 'include',
        })
      }
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `HTTP error! status: ${response.status}`)
    }

    const disposition = response.headers.get('content-disposition') || ''
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i)
    const filename = match?.[1] || 'users.csv'
    const blob = await response.blob()

    return { blob, filename }
  }

  async blockUser(botId: number, userId: number, blocked: boolean): Promise<TelegramUser> {
    return this.request<TelegramUser>(`/bots/${botId}/users/${userId}/block`, {
      method: 'POST',
      body: JSON.stringify({ blocked }),
    })
  }

  async sendMessageToUser(
    botId: number, 
    userId: number, 
    messageText: string,
    mediaFile?: File | null,
    mediaType?: string | null
  ): Promise<{ message: string }> {
    const formData = new FormData()
    formData.append('message_text', messageText)
    
    if (mediaFile) {
      formData.append('media_file', mediaFile)
      if (mediaType) {
        formData.append('media_type', mediaType)
      }
    }

    const token = this.getToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${this.baseUrl}/bots/${botId}/users/${userId}/send-message`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    })

    if (!response.ok) {
      if (response.status === 401) {
        const refreshToken = this.getRefreshToken()
        if (refreshToken && !this.isTokenExpired(refreshToken)) {
          try {
            const newTokens = await this.refreshToken(refreshToken)
            this.setToken(newTokens.access_token)
            this.setRefreshToken(newTokens.refresh_token)
            headers['Authorization'] = `Bearer ${newTokens.access_token}`
            
            const retryResponse = await fetch(`${this.baseUrl}/bots/${botId}/users/${userId}/send-message`, {
              method: 'POST',
              headers,
              body: formData,
              credentials: 'include',
            })
            if (!retryResponse.ok) {
              throw new Error('Unauthorized after token refresh')
            }
            return retryResponse.json()
          } catch (refreshError) {
            console.error("Error refreshing token:", refreshError);
            this.removeToken()
            throw new Error('Session expired. Please log in again.')
          }
        }
        this.removeToken()
        throw new Error('Unauthorized. Please log in again.')
      }
      let errorDetail = `HTTP error! status: ${response.status}`
      try {
        const errorBody = await response.json()
        errorDetail = errorBody.detail || errorBody.message || errorDetail
      } catch (jsonError) {
        console.error("Failed to parse error response JSON:", jsonError);
      }
      throw new Error(errorDetail)
    }

    return response.json()
  }

  // Message Templates
  async getTemplates(botId: number): Promise<MessageTemplate[]> {
    return this.request<MessageTemplate[]>(`/bots/${botId}/templates`)
  }

  async getAllTemplates(botId?: number): Promise<MessageTemplate[]> {
    const url = botId ? `/templates?bot_id=${botId}` : '/templates'
    return this.request<MessageTemplate[]>(url)
  }

  async getTemplate(botId: number, templateId: number): Promise<MessageTemplate> {
    return this.request<MessageTemplate>(`/bots/${botId}/templates/${templateId}`)
  }

  async createTemplate(botId: number, data: Partial<MessageTemplate>): Promise<MessageTemplate> {
    return this.request<MessageTemplate>(`/bots/${botId}/templates`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateTemplate(botId: number, templateId: number, data: Partial<MessageTemplate>): Promise<MessageTemplate> {
    return this.request<MessageTemplate>(`/bots/${botId}/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteTemplate(botId: number, templateId: number): Promise<void> {
    return this.request<void>(`/bots/${botId}/templates/${templateId}`, {
      method: 'DELETE',
    })
  }

  // User Tags
  async getTags(botId: number): Promise<UserTag[]> {
    return this.request<UserTag[]>(`/bots/${botId}/tags`)
  }

  async getAllTags(botId?: number): Promise<UserTag[]> {
    const url = botId ? `/tags?bot_id=${botId}` : '/tags'
    return this.request<UserTag[]>(url)
  }

  async createTag(botId: number, data: Partial<UserTag>): Promise<UserTag> {
    return this.request<UserTag>(`/bots/${botId}/tags`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateTag(botId: number, tagId: number, data: Partial<UserTag>): Promise<UserTag> {
    return this.request<UserTag>(`/bots/${botId}/tags/${tagId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteTag(botId: number, tagId: number): Promise<void> {
    return this.request<void>(`/bots/${botId}/tags/${tagId}`, {
      method: 'DELETE',
    })
  }

  async assignTagsToUser(botId: number, userId: number, tagIds: number[]): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/bots/${botId}/tags/users/${userId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ tag_ids: tagIds }),
    })
  }

  // Triggers
  async getTriggers(botId: number): Promise<Trigger[]> {
    return this.request<Trigger[]>(`/bots/${botId}/triggers`)
  }

  async getAllTriggers(botId?: number): Promise<Trigger[]> {
    const url = botId ? `/triggers?bot_id=${botId}` : '/triggers'
    return this.request<Trigger[]>(url)
  }

  async getTrigger(botId: number, triggerId: number): Promise<Trigger> {
    return this.request<Trigger>(`/bots/${botId}/triggers/${triggerId}`)
  }

  async createTrigger(botId: number, data: Partial<Trigger>): Promise<Trigger> {
    return this.request<Trigger>(`/bots/${botId}/triggers`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateTrigger(botId: number, triggerId: number, data: Partial<Trigger>): Promise<Trigger> {
    return this.request<Trigger>(`/bots/${botId}/triggers/${triggerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteTrigger(botId: number, triggerId: number): Promise<void> {
    return this.request<void>(`/bots/${botId}/triggers/${triggerId}`, {
      method: 'DELETE',
    })
  }

  // Webhooks functionality removed

  // Extended Analytics
  async getConversionFunnel(botId: number): Promise<ConversionFunnel[]> {
    return this.request<ConversionFunnel[]>(`/analytics/bots/${botId}/funnel`)
  }

  async compareBots(): Promise<BotComparison[]> {
    return this.request<BotComparison[]>('/analytics/bots/comparison')
  }

  // Удобные методы для HTTP запросов
  async get<T = any>(endpoint: string): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint)
    return { data }
  }

  async post<T = any>(endpoint: string, body?: any): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
    return { data }
  }

  async put<T = any>(endpoint: string, body?: any): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
    return { data }
  }

  async delete<T = any>(endpoint: string): Promise<void> {
    await this.request<T>(endpoint, {
      method: 'DELETE',
    })
  }
}

export const api = new ApiClient(API_URL)

