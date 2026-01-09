import { useQuery } from '@tanstack/react-query'
import { api, AnalyticsOverview, BotStats, ConversionFunnel, BotComparison } from '@/app/lib/api'

export function useAnalyticsOverview(days: number = 30) {
  return useQuery<AnalyticsOverview>({
    queryKey: ['analytics', 'overview', days],
    queryFn: () => api.getAnalyticsOverview(days),
  })
}

export function useBotStats(botId: number) {
  return useQuery<BotStats>({
    queryKey: ['analytics', 'bot', botId],
    queryFn: () => api.getBotStats(botId),
    enabled: !!botId,
  })
}

export function useConversionFunnel(botId: number) {
  return useQuery<ConversionFunnel[]>({
    queryKey: ['conversion-funnel', botId],
    queryFn: () => api.getConversionFunnel(botId),
    enabled: !!botId,
  })
}

export function useBotComparison() {
  return useQuery<BotComparison[]>({
    queryKey: ['bot-comparison'],
    queryFn: () => api.compareBots(),
  })
}

