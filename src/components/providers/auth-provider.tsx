'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth/context'

interface ProvidersProps {
  children: ReactNode
}

/**
 * Wraps the app with all context providers
 * Currently just Auth, but can add more providers here (theme, etc.)
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}
