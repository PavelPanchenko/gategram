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

export function useCreateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, data }: { botId: number; data: Partial<MessageTemplate> }) => 
      api.createTemplate(botId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates', variables.botId] })
      queryClient.invalidateQueries({ queryKey: ['all-templates'] })
    },
  })
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, templateId, data }: { botId: number; templateId: number; data: Partial<MessageTemplate> }) =>
      api.updateTemplate(botId, templateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates', variables.botId] })
      queryClient.invalidateQueries({ queryKey: ['all-templates'] })
    },
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, templateId }: { botId: number; templateId: number }) => 
      api.deleteTemplate(botId, templateId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates', variables.botId] })
      queryClient.invalidateQueries({ queryKey: ['all-templates'] })
    },
  })
}

