// Для клиентской стороны используем относительный URL или полный
const API_URL = 
  typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
    : 'http://localhost:8000'

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

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    let token = this.getToken()
    
    // Проверяем истечение токена перед запросом
    if (token && isTokenExpired(token)) {
      // Пытаемся обновить токен
      token = await refreshAccessToken()
      if (!token) {
        throw new Error('Session expired')
      }
    }

    const headers: HeadersInit = {
      ...options.headers,
    }

    // Добавляем Content-Type только если его нет и это не FormData
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    })

    if (!response.ok) {
      // Если 401, пытаемся обновить токен и повторить запрос
      if (response.status === 401) {
        const newToken = await refreshAccessToken()
        if (newToken && endpoint !== '/auth/refresh') {
          // Повторяем запрос с новым токеном
          headers['Authorization'] = `Bearer ${newToken}`
          const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include',
          })
          
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
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Invalid credentials' }))
      throw new Error(error.detail || 'Invalid credentials')
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
  async getBroadcasts(botId?: number, status?: string): Promise<Broadcast[]> {
    const params = new URLSearchParams()
    if (botId) params.append('bot_id', botId.toString())
    if (status) params.append('status_filter', status)
    const query = params.toString()
    return this.request<Broadcast[]>(`/broadcasts${query ? `?${query}` : ''}`)
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
    const headers: HeadersInit = {}
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

  async deleteBroadcast(broadcastId: number): Promise<void> {
    return this.request<void>(`/broadcasts/${broadcastId}`, {
      method: 'DELETE',
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
    const headers: HeadersInit = {}
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
}

export const api = new ApiClient(API_URL)

