'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/app/hooks/useAuth'
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react'

// Zod схемы валидации
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Введите корректный email'),
  password: z
    .string()
    .min(6, 'Пароль должен содержать минимум 6 символов')
    .max(100, 'Пароль слишком длинный'),
})

const registerSchema = loginSchema.extend({
  password: z
    .string()
    .min(8, 'Пароль должен содержать минимум 8 символов')
    .max(100, 'Пароль слишком длинный')
    .regex(/[a-z]/, 'Пароль должен содержать хотя бы одну строчную букву')
    .regex(/[A-Z]/, 'Пароль должен содержать хотя бы одну заглавную букву')
    .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру'),
})

type FormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const { login, register: registerUser, isLoggingIn, isRegistering } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setFocus,
  } = useForm<FormData>({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema),
    mode: 'onBlur', // Валидация при потере фокуса
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    try {
      if (isRegister) {
        await registerUser({ email: data.email, password: data.password })
      } else {
        await login({ email: data.email, password: data.password })
      }
    } catch (err: any) {
      setError(err?.message || (isRegister ? 'Ошибка при регистрации' : 'Неверный email или пароль'))
    }
  }

  const toggleMode = () => {
    setError(null)
    setIsRegister(!isRegister)
    reset()
    // Фокус на email поле после переключения
    setTimeout(() => setFocus('email'), 100)
  }

  const isLoading = isLoggingIn || isRegistering || isSubmitting

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-50 to-indigo-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 sm:h-14 sm:w-14 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
            <svg className="h-7 w-7 sm:h-8 sm:w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {isRegister ? 'Создать аккаунт' : 'Добро пожаловать'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isRegister ? 'Зарегистрируйтесь для начала работы' : 'Войдите в свой аккаунт GateGram'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white py-6 px-4 sm:py-8 sm:px-10 rounded-xl sm:rounded-2xl shadow-xl border border-gray-100">
          <form 
            className="space-y-5 sm:space-y-6" 
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg text-sm flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={`block w-full pl-10 pr-3 py-2.5 sm:py-3 border ${
                    errors.email ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                  } rounded-lg text-sm sm:text-base placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors`}
                  placeholder="your@email.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs sm:text-sm text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Пароль
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  {...register('password')}
                  className={`block w-full pl-10 pr-12 py-2.5 sm:py-3 border ${
                    errors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                  } rounded-lg text-sm sm:text-base placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-700 text-gray-400 transition-colors touch-target"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs sm:text-sm text-red-600 flex items-start gap-1">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{errors.password.message}</span>
                </p>
              )}
              {isRegister && !errors.password && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Минимум 8 символов, включая заглавные и строчные буквы, цифры
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm sm:text-base font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isRegister ? 'Регистрация...' : 'Вход...'}</span>
                </>
              ) : (
                <span>{isRegister ? 'Зарегистрироваться' : 'Войти'}</span>
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Создать'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 px-4">
          Продолжая, вы соглашаетесь с нашими{' '}
          <a href="#" className="text-indigo-600 hover:text-indigo-500">
            условиями использования
          </a>
        </p>
      </div>
    </div>
  )
}

