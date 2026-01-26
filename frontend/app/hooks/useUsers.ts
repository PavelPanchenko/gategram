import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, TelegramUser } from '@/app/lib/api'

export function useAllUsers(botId?: number, status?: string, source?: string) {
  return useQuery({
    queryKey: ['users', 'all', botId, status, source],
    queryFn: () => api.getAllUsers(botId, status, source),
    // Отключаем SSR для этого запроса - загружаем только на клиенте
    // Это предотвращает блокировку рендеринга страницы
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000, // 30 секунд - данные считаются свежими
    gcTime: 5 * 60 * 1000, // 5 минут в кеше
    retry: 1, // Только 1 повторная попытка
    retryDelay: 1000, // Задержка 1 секунда
  })
}

export function useBotUsers(botId: number, status?: string, source?: string) {
  return useQuery({
    queryKey: ['bots', botId, 'users', status, source],
    queryFn: () => api.getBotUsers(botId, status, source),
    enabled: !!botId,
  })
}

export function useBlockUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      botId,
      userId,
      blocked,
    }: {
      botId: number
      userId: number
      blocked: boolean
    }) => api.blockUser(botId, userId, blocked),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bots', variables.botId, 'users'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] })
    },
  })
}

export function useSendMessageToUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      botId,
      userId,
      messageText,
      mediaFile,
      mediaType,
    }: {
      botId: number
      userId: number
      messageText: string
      mediaFile?: File | null
      mediaType?: string | null
    }) => api.sendMessageToUser(botId, userId, messageText, mediaFile, mediaType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bots', variables.botId, 'users'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] })
    },
  })
}

