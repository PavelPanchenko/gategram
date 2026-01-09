import { useQuery } from '@tanstack/react-query'
import { api } from '@/app/lib/api'

export function useChannelInfo(url: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['channel-info', url],
    queryFn: async () => {
      try {
        const result = await api.getChannelInfo(url)
        // Если получили нормализованный URL, обновляем его
        if (result.normalized_url && result.normalized_url !== url) {
          return { ...result, url: result.normalized_url }
        }
        return result
      } catch (error: any) {
        // Если ошибка 422, возможно проблема с валидацией, пробуем обработать локально
        if (error.message?.includes('422') || error.message?.includes('Unprocessable')) {
          // Для формата @username извлекаем название локально
          if (url.startsWith('@')) {
            const username = url.slice(1)
            const readableName = username
              .replace(/_/g, ' ')
              .replace(/-/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
            return {
              name: readableName,
              normalized_url: `https://t.me/${username}`,
            }
          }
        }
        throw error
      }
    },
    enabled: enabled && !!url && (url.startsWith('http') || url.startsWith('@') || url.length > 3),
    staleTime: Infinity, // Кешируем навсегда, так как URL канала не меняется
    retry: false, // Не повторяем запрос при ошибке
  })
}

