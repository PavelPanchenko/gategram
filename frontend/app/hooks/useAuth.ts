import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/app/lib/api'
import { useRouter, usePathname } from 'next/navigation'

export function useAuth() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()

  // Не загружаем данные пользователя на странице логина
  const isLoginPage = pathname === '/login'

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.getMe(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 минут
    enabled: !isLoginPage, // Отключаем запрос на странице логина
  })

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard'
      }
    },
    onError: (error: Error) => {
      // Ошибка логируется, но пробрасывается через Promise.reject в функции login
      console.error('Login error:', error)
    },
  })

  const registerMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.register(email, password),
    onError: (error: Error) => {
      // Ошибка логируется, но пробрасывается через Promise.reject в функции register
      console.error('Register error:', error)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      queryClient.clear()
      router.push('/login')
    },
  })

  return {
    user,
    isLoading,
    error,
    login: (data: { email: string; password: string }) => {
      return new Promise<void>((resolve, reject) => {
        loginMutation.mutate(data, {
          onSuccess: () => resolve(),
          onError: (error) => reject(error),
        })
      })
    },
    register: async (data: { email: string; password: string }) => {
      return new Promise<void>((resolve, reject) => {
        registerMutation.mutate(data, {
          onSuccess: async () => {
            // После регистрации автоматически логинимся
            try {
              await loginMutation.mutateAsync(data)
              resolve()
            } catch (error) {
              // Если логин не удался, пробрасываем ошибку
              reject(error)
            }
          },
          onError: (error) => reject(error),
        })
      })
    },
    logout: () => logoutMutation.mutate(),
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  }
}

