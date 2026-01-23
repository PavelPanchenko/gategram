import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface ReferralLink {
  id: number
  source: string
  link: string | null
  created_at: string
  updated_at: string | null
}

export interface ReferralLinkCreate {
  source: string
}

export interface ReferralLinkUpdate {
  source: string
}

// Получить все реферальные ссылки бота
export function useReferralLinks(botId: number) {
  return useQuery<ReferralLink[]>({
    queryKey: ['referralLinks', botId],
    queryFn: async () => {
      const response = await api.get(`/bots/${botId}/referral-links`)
      return response.data
    },
    enabled: !!botId,
  })
}

// Создать реферальную ссылку
export function useCreateReferralLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ botId, data }: { botId: number; data: ReferralLinkCreate }) => {
      const response = await api.post(`/bots/${botId}/referral-links`, data)
      return response.data as ReferralLink
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['referralLinks', variables.botId] })
    },
  })
}

// Обновить реферальную ссылку
export function useUpdateReferralLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      botId,
      linkId,
      data,
    }: {
      botId: number
      linkId: number
      data: ReferralLinkUpdate
    }) => {
      const response = await api.put(`/bots/${botId}/referral-links/${linkId}`, data)
      return response.data as ReferralLink
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['referralLinks', variables.botId] })
    },
  })
}

// Удалить реферальную ссылку
export function useDeleteReferralLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ botId, linkId }: { botId: number; linkId: number }) => {
      await api.delete(`/bots/${botId}/referral-links/${linkId}`)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['referralLinks', variables.botId] })
    },
  })
}
