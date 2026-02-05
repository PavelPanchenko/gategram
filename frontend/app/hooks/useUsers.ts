import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

export function useAllUsersPaged(
  botId?: number,
  status?: string,
  source?: string,
  page: number = 1,
  pageSize: number = 100
) {
  return useQuery({
    queryKey: ['users', 'all', 'paged', botId, status, source, page, pageSize],
    queryFn: () => api.getAllUsersPaged(botId, status, source, page, pageSize),
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    retryDelay: 1000,
  })
}

export function useAllUsersInfinite(
  botId?: number,
  status?: string,
  source?: string,
  pageSize: number = 100
) {
  return useInfiniteQuery({
    queryKey: ['users', 'all', 'infinite', botId, status, source, pageSize],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.getAllUsers(botId, status, source, pageParam, pageSize),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < pageSize ? undefined : allPages.length * pageSize,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    retryDelay: 1000,
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

export function useDeleteBotUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ botId, userId }: { botId: number; userId: number }) =>
      api.deleteBotUser(botId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bots', variables.botId, 'users'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] })
    },
  })
}

