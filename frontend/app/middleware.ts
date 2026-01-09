import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // В middleware мы не можем использовать localStorage, только cookies
  // Токен будет проверяться на клиенте через DashboardLayout
  const isAuthPage = request.nextUrl.pathname === '/login'
  const isProtectedPage = request.nextUrl.pathname.startsWith('/dashboard') || 
                         request.nextUrl.pathname.startsWith('/bots')

  // Для защищенных страниц - редирект на логин (проверка токена будет на клиенте)
  if (isProtectedPage && !request.cookies.get('access_token')) {
    // Проверка токена будет в DashboardLayout через API
    // Здесь просто пропускаем, чтобы не блокировать навигацию
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

