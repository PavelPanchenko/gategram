'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { api } from '@/app/lib/api'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Bot, Send, LogOut, FileText, Tag, Zap, Users } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await api.logout()
    router.push('/login')
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/bots', label: 'Боты', icon: Bot },
    { href: '/users', label: 'Пользователи', icon: Users },
    { href: '/broadcasts', label: 'Рассылки', icon: Send },
    { href: '/templates', label: 'Шаблоны', icon: FileText },
    { href: '/tags', label: 'Теги', icon: Tag },
    { href: '/triggers', label: 'Триггеры', icon: Zap },
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">GateGram</h1>
        <p className="text-gray-500 text-xs mt-1">Telegram Gateway</p>
      </div>
      <nav className="mt-4 flex-1 overflow-y-auto px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          <span>Выйти</span>
        </button>
      </div>
    </div>
  )
}

