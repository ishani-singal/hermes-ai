'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { UserPlus, LogOut } from 'lucide-react'

export function UserMenu() {
  const router = useRouter()
  const { user, activeRole, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="relative">
      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white font-medium">
          {user.full_name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <span className="hidden md:block text-sm font-medium text-gray-700">
          {user.full_name}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
            <div className="px-4 py-2 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
              {activeRole && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-brand/10 text-brand rounded capitalize">
                  {activeRole}
                </span>
              )}
            </div>

            {/* Admin Menu Items */}
            {activeRole === 'admin' && (
              <div className="py-1 border-b border-gray-200">
                <Link
                  href="/dashboard/admin/invites"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <UserPlus className="h-4 w-4" />
                  Invite Team Members
                </Link>
              </div>
            )}

            <button
              onClick={handleSignOut}
              disabled={isLoading}
              className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {isLoading ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
