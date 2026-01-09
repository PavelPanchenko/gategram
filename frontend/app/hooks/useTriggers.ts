import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Trigger } from '@/app/lib/api'

export function useTriggers(botId: number) {
  return useQuery<Trigger[]>({
    queryKey: ['triggers', botId],
    queryFn: () => api.getTriggers(botId),
    enabled: !!botId,
  })
}

export function useAllTriggers(botId?: number) {
  return useQuery<Trigger[]>({
    queryKey: ['all-triggers', botId],
    queryFn: () => api.getAllTriggers(botId),
  })
}

export function useTrigger(botId: number, triggerId: number) {
  return useQuery<Trigger>({
    queryKey: ['trigger', botId, triggerId],
    queryFn: () => api.getTrigger(botId, triggerId),
    enabled: !!botId && !!triggerId,
  })
}

export function useCreateTrigger(botId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Trigger>) => api.createTrigger(botId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggers', botId] })
    },
  })
}

export function useUpdateTrigger(botId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ triggerId, data }: { triggerId: number; data: Partial<Trigger> }) =>
      api.updateTrigger(botId, triggerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggers', botId] })
    },
  })
}

export function useDeleteTrigger(botId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (triggerId: number) => api.deleteTrigger(botId, triggerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggers', botId] })
    },
  })
}

