import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // В приложении нет Server Actions ('use server'), поэтому любой запрос с заголовком
  // Next-Action — это сканер (пробы CVE-2025-55182 "React2Shell" шлют Next-Action: x).
  // Отвечаем 404 до рантайма Next.js, чтобы не засорять логи "Failed to find Server Action".
  if (request.headers.has('next-action')) {
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
