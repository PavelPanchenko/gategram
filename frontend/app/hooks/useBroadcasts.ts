import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Broadcast, BroadcastFilters } from '@/app/lib/api'
import { useRouter } from 'next/navigation'

export function useBroadcasts(botId?: number, status?: string) {
  return useQuery({
    queryKey: ['broadcasts', botId, status],
    queryFn: () => api.getBroadcasts(botId, status),
    refetchInterval: (query) => {
      // Автоматически обновляем каждые 2 секунды, если есть рассылки в процессе или запланированные
      const broadcasts = query.state.data as Broadcast[] | undefined
      const hasActiveOrScheduled = broadcasts?.some(
        (b) => b.status === 'sending' || b.status === 'scheduled' || b.status === 'pending'
      )
      return hasActiveOrScheduled ? 2000 : false
    },
    refetchOnWindowFocus: true, // Обновлять при возврате на вкладку
    staleTime: 1000, // Данные считаются устаревшими через 1 секунду
  })
}

export function useBroadcastsInfinite(botId?: number, status?: string, pageSize: number = 50) {
  return useInfiniteQuery({
    queryKey: ['broadcasts', 'infinite', botId, status, pageSize],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.getBroadcasts(botId, status, pageParam, pageSize),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < pageSize ? undefined : allPages.length * pageSize,
    refetchInterval: (query) => {
      const data = query.state.data as { pages: Broadcast[][] } | undefined
      const flat = data?.pages?.flat() || []
      const hasActiveOrScheduled = flat.some(
        (b) => b.status === 'sending' || b.status === 'scheduled' || b.status === 'pending'
      )
      return hasActiveOrScheduled ? 2000 : false
    },
    refetchOnWindowFocus: true,
    staleTime: 1000,
  })
}

export function useBroadcastsPaged(
  botId?: number,
  status?: string,
  page: number = 1,
  pageSize: number = 50
) {
  return useQuery({
    queryKey: ['broadcasts', 'paged', botId, status, page, pageSize],
    queryFn: () => api.getBroadcastsPaged(botId, status, page, pageSize),
    refetchInterval: (query) => {
      const data = query.state.data as { items: Broadcast[] } | undefined
      const broadcasts = data?.items
      const hasActiveOrScheduled = broadcasts?.some(
        (b) => b.status === 'sending' || b.status === 'scheduled' || b.status === 'pending'
      )
      return hasActiveOrScheduled ? 2000 : false
    },
    refetchOnWindowFocus: true,
    staleTime: 1000,
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
    onSuccess: (_, broadcastId) => {
      // Оптимистичное обновление: обновляем статус рассылки в кэше
      queryClient.setQueriesData<Broadcast[]>(
        { queryKey: ['broadcasts'] },
        (old) => {
          if (!old) return old
          return old.map((broadcast) =>
            broadcast.id === broadcastId
              ? { ...broadcast, status: 'cancelled' }
              : broadcast
          )
        }
      )
      // Инвалидируем для полного обновления
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })
}

export function useDeleteBroadcast() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ broadcastId, deleteMessages }: { broadcastId: number; deleteMessages?: boolean }) => 
      api.deleteBroadcast(broadcastId, deleteMessages || false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })
}

