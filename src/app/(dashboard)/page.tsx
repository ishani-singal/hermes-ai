'use client'

import { useAuth } from '@/lib/auth/context'

export default function DashboardPage() {
  const { user, companies, activeCompanyId } = useAuth()

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
