'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 минут - данные считаются свежими
            gcTime: 10 * 60 * 1000, // 10 минут - хранение в кеше
            refetchOnWindowFocus: false, // Не перезапрашивать при фокусе окна
            refetchOnReconnect: true, // Перезапросить при восстановлении соединения
            retry: 1, // 1 повторная попытка при ошибке
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Экспоненциальная задержка
          },
          mutations: {
            retry: 1,
            // Убираем console.error из production
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

