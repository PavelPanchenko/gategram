import type { Metadata } from 'next'
import './globals.css'
import QueryProvider from './providers/QueryProvider'
import ToastContainer from './components/ToastContainer'
import ConfirmProvider from './components/ConfirmProvider'

export const metadata: Metadata = {
  title: 'GateGram - Telegram Traffic Gateway',
  description: 'SaaS platform for routing ad traffic through Telegram bots',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>
        <QueryProvider>
          <ConfirmProvider>
            {children}
            <ToastContainer />
          </ConfirmProvider>
        </QueryProvider>
      </body>
    </html>
  )
}

