import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Bot, Channel } from '@/app/lib/api'
import { useRouter } from 'next/navigation'

export function useBots() {
  return useQuery({
    queryKey: ['bots'],
    queryFn: () => api.getBots(),
  })
}

export function useBot(botId: number) {
  return useQuery({
    queryKey: ['bots', botId],
    queryFn: () => api.getBot(botId),
    enabled: !!botId,
  })
}

export function useCreateBot() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (botData: {
      token: string
      name?: string
      welcome_message?: string
      required_interaction?: boolean
      interaction_delay_seconds?: number
      continue_button_text?: string
      channels?: Channel[]
      channel_link?: string
    }) => api.createBot(botData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      router.push('/bots')
    },
  })
}

export function useUpdateBot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      botId,
      botData,
    }: {
      botId: number
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
    }) => api.updateBot(botId, botData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      queryClient.invalidateQueries({ queryKey: ['bots', variables.botId] })
    },
  })
}

export function useDeleteBot() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (botId: number) => api.deleteBot(botId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      router.push('/bots')
    },
  })
}

export function useStartBot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (botId: number) => api.startBot(botId),
    onSuccess: (_, botId) => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      queryClient.invalidateQueries({ queryKey: ['bots', botId] })
    },
  })
}

export function useStopBot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (botId: number) => api.stopBot(botId),
    onSuccess: (_, botId) => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      queryClient.invalidateQueries({ queryKey: ['bots', botId] })
    },
  })
}

