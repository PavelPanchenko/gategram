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

export function useCreateTrigger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, data }: { botId: number; data: Partial<Trigger> }) => 
      api.createTrigger(botId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['triggers', variables.botId] })
      queryClient.invalidateQueries({ queryKey: ['all-triggers'] })
    },
  })
}

export function useUpdateTrigger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, triggerId, data }: { botId: number; triggerId: number; data: Partial<Trigger> }) =>
      api.updateTrigger(botId, triggerId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['triggers', variables.botId] })
      queryClient.invalidateQueries({ queryKey: ['all-triggers'] })
    },
  })
}

export function useDeleteTrigger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, triggerId }: { botId: number; triggerId: number }) => 
      api.deleteTrigger(botId, triggerId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['triggers', variables.botId] })
      queryClient.invalidateQueries({ queryKey: ['all-triggers'] })
    },
  })
}

