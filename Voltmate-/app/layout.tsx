import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import AuthGuard from './AuthGuard'

import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Voltmate - Employee Management System',
  description: 'Modern employee management, sales tracking, and payroll system for dealerships',
  icons: {
    icon: '/voltmate-logo.svg',
    shortcut: '/voltmate-logo.svg',
    apple: '/voltmate-logo.svg',
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
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  )
}
