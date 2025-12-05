'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SignUpRequest } from '@/types'

export default function SignUpPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    companyName: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signup/create-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData as SignUpRequest),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign up')
      }

      // Show success message - user needs to confirm email
      setSuccess(true)

    } catch (err) {
      console.error('Signup error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Create your company
      </h2>
      <p className="text-gray-600 mb-6">
        Set up a new company account and become the admin
      </p>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg text-center">
          <div className="mb-3">
            <svg
              className="mx-auto h-10 w-10 text-green-500"
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
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Account Created!
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Your company <strong>{formData.companyName}</strong> has been set up successfully.
          </p>
          <Link 
            href="/login" 
            className="inline-block px-6 py-2 bg-brand text-white font-medium rounded-md hover:bg-brand-light transition-colors"
          >
            Sign In
          </Link>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            value={formData.fullName}
            onChange={handleChange}
            className="w-full text-base px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="John Doe"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full text-base px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="john@example.com"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            value={formData.password}
            onChange={handleChange}
            className="w-full text-base px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-gray-500">
            Minimum 8 characters
          </p>
        </div>

        {/* Company Name */}
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
            Company Name
          </label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            required
            value={formData.companyName}
            onChange={handleChange}
            className="w-full text-base px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="Acme Manufacturing"
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter a unique name for your new company
          </p>
        </div>

        {/* Admin note */}
        <div className="p-3 bg-brand/10 rounded-md border border-brand/20">
          <p className="text-sm text-gray-700">
            <strong>You&apos;ll become the admin</strong> and can invite team members after signing up.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || success}
          className="w-full min-h-[44px] px-4 py-3 bg-brand text-white font-medium rounded-md hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading ? 'Creating account...' : 'Create Company & Sign Up'}
        </button>
      </form>

      {/* Invited? Link */}
      <div className="mt-6 p-3 bg-gray-50 rounded-md border border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          <strong>Have an invite link?</strong> Use the link you received from your company admin to join.
        </p>
      </div>

      {/* Sign In Link */}
      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
