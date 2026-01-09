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
  })

  const registerMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.register(email, password),
    onSuccess: (_, variables) => {
      // После регистрации автоматически логинимся
      loginMutation.mutate(variables)
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
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  }
}

