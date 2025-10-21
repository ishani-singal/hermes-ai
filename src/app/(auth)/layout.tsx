import { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

/**
 * Layout for authentication pages (login, signup)
 * Centered card design, mobile-friendly
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Technician Assistant
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Manufacturing AI Copilot
          </p>
        </div>

        {/* Auth Form Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-500">
          © 2024 Technician Assistant. All rights reserved.
        </p>
      </div>
    </div>
  )
}
