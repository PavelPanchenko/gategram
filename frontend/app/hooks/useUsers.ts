import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, TelegramUser } from '@/app/lib/api'

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
    },
  })
}

