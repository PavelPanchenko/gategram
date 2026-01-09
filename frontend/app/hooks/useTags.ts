import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, UserTag } from '@/app/lib/api'

export function useTags(botId: number) {
  return useQuery<UserTag[]>({
    queryKey: ['tags', botId],
    queryFn: () => api.getTags(botId),
    enabled: !!botId,
  })
}

export function useAllTags(botId?: number) {
  return useQuery<UserTag[]>({
    queryKey: ['all-tags', botId],
    queryFn: () => api.getAllTags(botId),
  })
}

export function useCreateTag(botId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<UserTag>) => api.createTag(botId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', botId] })
      // Инвалидируем все запросы all-tags (с фильтром и без)
      queryClient.invalidateQueries({ queryKey: ['all-tags'] })
      queryClient.invalidateQueries({ queryKey: ['all-tags', botId] })
    },
  })
}

export function useUpdateTag(botId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tagId, data }: { tagId: number; data: Partial<UserTag> }) =>
      api.updateTag(botId, tagId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', botId] })
      // Инвалидируем все запросы all-tags (с фильтром и без)
      queryClient.invalidateQueries({ queryKey: ['all-tags'] })
      queryClient.invalidateQueries({ queryKey: ['all-tags', botId] })
    },
  })
}

export function useDeleteTag(botId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tagId: number) => api.deleteTag(botId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', botId] })
      // Инвалидируем все запросы all-tags (с фильтром и без)
      queryClient.invalidateQueries({ queryKey: ['all-tags'] })
      queryClient.invalidateQueries({ queryKey: ['all-tags', botId] })
      queryClient.invalidateQueries({ queryKey: ['bot-users', botId] })
    },
  })
}

export function useAssignTagsToUser(botId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, tagIds }: { userId: number; tagIds: number[] }) =>
      api.assignTagsToUser(botId, userId, tagIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-users', botId] })
    },
  })
}

