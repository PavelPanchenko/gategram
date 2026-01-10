'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import { useAuth } from '@/app/hooks/useAuth'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isLoading, error } = useAuth()

  useEffect(() => {
    if (!isLoading && (!user || error)) {
      router.push('/login')
    }
  }, [user, isLoading, error, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-indigo-50">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 sm:ml-64">
        {children}
      </main>
    </div>
  )
}

