'use client'

import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">Manufacturing Technician Assistant</h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Your AI-powered copilot for maintenance tasks, equipment management, and work order tracking.
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🤖 AI Chat Assistant</h3>
            <p className="text-gray-600">Get instant help with maintenance procedures, troubleshooting, and equipment questions.</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">📋 Work Order Management</h3>
            <p className="text-gray-600">Track and manage maintenance tasks with intelligent automation and insights.</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🔧 Equipment Tracking</h3>
            <p className="text-gray-600">Maintain comprehensive records of all your manufacturing equipment and assets.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
