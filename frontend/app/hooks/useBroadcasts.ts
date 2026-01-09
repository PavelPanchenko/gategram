import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Broadcast, BroadcastFilters } from '@/app/lib/api'
import { useRouter } from 'next/navigation'

export function useBroadcasts(botId?: number, status?: string) {
  return useQuery({
    queryKey: ['broadcasts', botId, status],
    queryFn: () => api.getBroadcasts(botId, status),
  })
}

export function useBroadcast(broadcastId: number) {
  return useQuery({
    queryKey: ['broadcasts', broadcastId],
    queryFn: () => api.getBroadcast(broadcastId),
    enabled: !!broadcastId,
  })
}

export function useCreateBroadcast() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (broadcastData: {
      bot_id: number
      message_text: string
      template_id?: number | null
      media_type?: string | null
      media_file?: File | null
      media_files?: File[] | null
      scheduled_at?: string | null
      filters?: BroadcastFilters | null
    }) => api.createBroadcast(broadcastData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })
}

export function useCancelBroadcast() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (broadcastId: number) => api.cancelBroadcast(broadcastId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })
}

export function useDeleteBroadcast() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (broadcastId: number) => api.deleteBroadcast(broadcastId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })
}

