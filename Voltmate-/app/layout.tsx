import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import AuthGuard from './AuthGuard'
import PlainTextInputGuard from '@/components/PlainTextInputGuard'

import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Voltmate - Employee Management System',
  description: 'Modern employee management, sales tracking, and payroll system for dealerships',
  icons: {
    icon: '/voltmate-logo.png',
    shortcut: '/voltmate-logo.png',
    apple: '/voltmate-logo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <PlainTextInputGuard />
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  )
}
