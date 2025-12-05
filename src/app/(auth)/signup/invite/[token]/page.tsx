'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { InviteValidation, AcceptInviteRequest } from '@/types'

type PageState = 'loading' | 'valid' | 'invalid' | 'submitting' | 'success'

export default function InviteSignUpPage() {
  const params = useParams()
  const token = params.token as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [inviteData, setInviteData] = useState<InviteValidation['invite'] | null>(null)

  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    confirmPassword: '',
  })

  // Validate invite token on mount
  useEffect(() => {
    async function validateInvite() {
      try {
        const response = await fetch(`/api/invites/validate/${token}`)
        const data: InviteValidation = await response.json()

        if (data.valid && data.invite) {
          setInviteData(data.invite)
          setPageState('valid')
        } else {
          setError(data.error || 'Invalid invite')
          setPageState('invalid')
        }
      } catch (err) {
        console.error('Error validating invite:', err)
        setError('Failed to validate invite. Please try again.')
        setPageState('invalid')
      }
    }

    if (token) {
      validateInvite()
    }
  }, [token])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setPageState('submitting')

    try {
      const request: AcceptInviteRequest = {
        token,
        fullName: formData.fullName,
        password: formData.password,
      }

      const response = await fetch('/api/auth/signup/accept-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account')
      }

      setPageState('success')
      // User will click the link to go to login after confirming email

    } catch (err) {
      console.error('Accept invite error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
      setPageState('valid')
    }
  }

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-4"></div>
        <p className="text-gray-600">Validating invite...</p>
      </div>
    )
  }

  // Invalid invite state
  if (pageState === 'invalid') {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Invite</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-light transition-colors"
        >
          Go to Login
        </Link>
      </div>
    )
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Account Created!</h2>
        <p className="text-gray-600 mb-4">
          Your account has been created successfully.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          You can now sign in to join <strong>{inviteData?.company.name}</strong>.
        </p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 bg-brand text-white font-medium rounded-md hover:bg-brand-light transition-colors"
        >
          Sign In
        </Link>
      </div>
    )
  }

  // Valid invite - show signup form
  return (
    <div>
      {/* Company Header */}
      <div className="text-center mb-6 pb-4 border-b border-gray-200">
        <p className="text-sm text-gray-500 mb-1">You&apos;re joining</p>
        <h2 className="text-2xl font-bold text-gray-900">
          {inviteData?.company.name}
        </h2>
        <div className="mt-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-brand/10 text-brand capitalize">
            {inviteData?.role}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Readonly Fields Section */}
        <div className="p-4 bg-gray-100 rounded-lg border border-gray-200 space-y-3">
          {/* Company (Read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Company
            </label>
            <div className="text-sm font-medium text-gray-500 bg-gray-50 px-3 py-2 rounded border border-gray-200">
              {inviteData?.company.name}
            </div>
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Email
            </label>
            <div className="text-sm font-medium text-gray-500 bg-gray-50 px-3 py-2 rounded border border-gray-200">
              {inviteData?.email}
            </div>
          </div>

          {/* Role (Read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Role
            </label>
            <div className="text-sm font-medium text-gray-500 bg-gray-50 px-3 py-2 rounded border border-gray-200 capitalize">
              {inviteData?.role}
              <span className="block text-xs text-gray-400 mt-0.5 normal-case">
                {inviteData?.role === 'admin' && 'Full access to all features and user management'}
                {inviteData?.role === 'editor' && 'Can create and edit work orders, equipment, and documents'}
                {inviteData?.role === 'viewer' && 'Read-only access to company data'}
              </span>
            </div>
          </div>
        </div>

        {/* Editable Fields Section */}
        <div className="pt-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Your Information</p>
          
          {/* Full Name */}
          <div className="mb-4">
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              value={formData.fullName}
              onChange={handleChange}
              className="w-full text-base px-3 py-3 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-white"
              placeholder="Enter your full name"
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={handleChange}
              className="w-full text-base px-3 py-3 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-white"
              placeholder="Create a password"
            />
            <p className="mt-1 text-xs text-gray-500">
              Minimum 6 characters
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full text-base px-3 py-3 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-white"
              placeholder="Confirm your password"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={pageState === 'submitting'}
          className="w-full min-h-[44px] px-4 py-3 bg-brand text-white font-medium rounded-md hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {pageState === 'submitting' ? 'Creating account...' : 'Create Account & Join'}
        </button>
      </form>

      {/* Sign In Link */}
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
