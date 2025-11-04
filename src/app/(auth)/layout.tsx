import { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface AuthLayoutProps {
  children: ReactNode
}

/**
 * Layout for authentication pages (login, signup)
 * Centered card design, mobile-friendly
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md">
          {/* Logo/Brand Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center mb-6 hover:opacity-80 transition-opacity">
              <div className="w-16 h-16 relative bg-white/10 backdrop-blur-md rounded-lg p-2 border border-white/20">
                <Image 
                  src="/brand/logo.png" 
                  alt="Hermes AI" 
                  width={56} 
                  height={56}
                  className="object-contain w-full h-full"
                />
              </div>
            </Link>
            <h1 className="text-3xl font-bold text-white mb-2">Hermes AI</h1>
            <p className="text-sm text-slate-300">
              Technician Assistant — Manufacturing AI Copilot
            </p>
          </div>

          {/* Auth Form Card */}
          <div className="bg-white/95 backdrop-blur rounded-xl shadow-2xl p-8 border border-white/20">
            {children}
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-400">
            © 2024 Hermes AI — Technician Assistant. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
