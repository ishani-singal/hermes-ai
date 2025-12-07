 'use client'

import { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { UserMenu } from '@/components/auth/user-menu'

interface DashboardLayoutProps {
  children: ReactNode
}

/**
 * Layout for protected dashboard pages
 * Includes header with user menu and responsive side navigation
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-brand/5 to-slate-50">
      {/* Header - Fixed at top on all screens with safe area padding for notched devices */}
      <header className="bg-gradient-to-r from-white via-white to-brand/10 backdrop-blur-sm border-b border-brand/20 shadow-sm flex-shrink-0 sticky top-0 z-50" style={{ paddingTop: 'var(--safe-area-inset-top)' }}>
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
                <div className="w-10 h-10 relative bg-gradient-to-br from-brand to-brand-dark rounded-lg p-1.5 shadow-md group-hover:shadow-lg transition-shadow">
                  <Image 
                    src="/brand/logo.png" 
                    alt="Hermes AI" 
                    width={40} 
                    height={40}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="leading-tight hidden sm:block border-l border-brand/30 pl-3">
                  <span className="text-sm font-bold text-brand-dark block">Hermes AI</span>
                  <span className="text-xs text-slate-500">Technician Assistant</span>
                </div>
              </Link>
            </div>

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
