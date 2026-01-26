import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, UserTag } from '@/app/lib/api'

export function useTags(botId?: number) {
  return useQuery<UserTag[]>({
    queryKey: ['tags', botId],
    queryFn: () => api.getTags(botId as number),
    enabled: typeof botId === 'number' && !Number.isNaN(botId) && botId > 0,
  })
}

export function useAllTags(botId?: number) {
  return useQuery<UserTag[]>({
    queryKey: ['all-tags', botId],
    queryFn: () => api.getAllTags(botId),
  })
}

export function useCreateTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, data }: { botId: number; data: Partial<UserTag> }) => 
      api.createTag(botId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', variables.botId] })
      queryClient.invalidateQueries({ queryKey: ['all-tags'] })
    },
  })
}

export function useUpdateTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, tagId, data }: { botId: number; tagId: number; data: Partial<UserTag> }) =>
      api.updateTag(botId, tagId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', variables.botId] })
      queryClient.invalidateQueries({ queryKey: ['all-tags'] })
    },
  })
}

export function useDeleteTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, tagId }: { botId: number; tagId: number }) => 
      api.deleteTag(botId, tagId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', variables.botId] })
      queryClient.invalidateQueries({ queryKey: ['all-tags'] })
      queryClient.invalidateQueries({ queryKey: ['bots', variables.botId, 'users'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] })
    },
  })
}

export function useAssignTagsToUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, userId, tagIds }: { botId: number; userId: number; tagIds: number[] }) =>
      api.assignTagsToUser(botId, userId, tagIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bots', variables.botId, 'users'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] })
    },
  })
}

