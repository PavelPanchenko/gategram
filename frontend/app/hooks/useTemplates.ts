import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, MessageTemplate } from '@/app/lib/api'

export function useTemplates(botId: number) {
  return useQuery<MessageTemplate[]>({
    queryKey: ['templates', botId],
    queryFn: () => api.getTemplates(botId),
    enabled: !!botId,
  })
}

export function useAllTemplates(botId?: number) {
  return useQuery<MessageTemplate[]>({
    queryKey: ['all-templates', botId],
    queryFn: () => api.getAllTemplates(botId),
  })
}

export function useTemplate(botId: number, templateId: number) {
  return useQuery<MessageTemplate>({
    queryKey: ['template', botId, templateId],
    queryFn: () => api.getTemplate(botId, templateId),
    enabled: !!botId && !!templateId,
  })
}

export function useCreateTemplate(botId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<MessageTemplate>) => api.createTemplate(botId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', botId] })
    },
  })
}

export function useUpdateTemplate(botId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: number; data: Partial<MessageTemplate> }) =>
      api.updateTemplate(botId, templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', botId] })
    },
  })
}

export function useDeleteTemplate(botId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (templateId: number) => api.deleteTemplate(botId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', botId] })
    },
  })
}

