'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { api } from '@/app/lib/api'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Bot, Send, LogOut, FileText, Tag, Zap, Users, Menu, X } from 'lucide-react'

export default function Sidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
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

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="sm:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="sm:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col z-40
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        sm:translate-x-0 sm:flex
      `}>
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
                onClick={closeMobileMenu}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <Icon size={20} />
                <span className="text-base font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => {
              closeMobileMenu()
              handleLogout()
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Выйти</span>
          </button>
        </div>
      </div>
    </>
  )
}

