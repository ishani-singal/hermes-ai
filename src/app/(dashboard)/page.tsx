'use client'

import { useAuth } from '@/lib/auth/context'
import Link from 'next/link'

export default function HomePage() {
  const { user, companies, activeCompanyId, isLoading } = useAuth()

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If NOT authenticated, show landing page
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Manufacturing Technician Assistant
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Your AI-powered copilot for maintenance tasks, equipment management, 
              and work order tracking.
            </p>
            
            <div className="flex gap-4 justify-center">
              <Link
                href="/login"
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-6 py-3 bg-white text-blue-600 font-medium rounded-md border-2 border-blue-600 hover:bg-blue-50 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>

          <div className="mt-20 grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🤖 AI Chat Assistant
              </h3>
              <p className="text-gray-600">
                Get instant help with maintenance procedures, troubleshooting, and equipment questions.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                📋 Work Order Management
              </h3>
              <p className="text-gray-600">
                Track and manage maintenance tasks with intelligent automation and insights.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🔧 Equipment Tracking
              </h3>
              <p className="text-gray-600">
                Maintain comprehensive records of all your manufacturing equipment and assets.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If authenticated, show dashboard
  const activeCompany = companies.find(
    (uc) => uc.company_id === activeCompanyId
  )

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Welcome back, {user?.full_name}!
      </h1>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Your Profile
        </h2>

        <dl className="space-y-3">
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="text-sm text-gray-900">{user?.email}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500">Company</dt>
            <dd className="text-sm text-gray-900">
              {activeCompany?.company.name || 'No company'}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500">Role</dt>
            <dd className="text-sm text-gray-900 capitalize">
              {activeCompany?.role || 'No role'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          🎉 Your account is set up!
        </h3>
        <p className="text-sm text-blue-700">
          You've successfully signed in. The chat interface, equipment management, 
          and other features will be available here once implemented.
        </p>
      </div>
    </div>
  )
}
