import { useQuery } from '@tanstack/react-query'
import { api } from '@/app/lib/api'

export function useBotInfo(token: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['bot-info', token],
    queryFn: () => api.validateBotToken(token),
    enabled: enabled && !!token && token.length > 20, // Минимальная длина токена
    staleTime: Infinity, // Кешируем навсегда, так как токен не меняется
  })
}

