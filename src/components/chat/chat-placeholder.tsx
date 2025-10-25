'use client'

import { MessageCircle } from 'lucide-react'

export function ChatPlaceholder() {
  return (
    <div className="flex items-center justify-center min-h-[400px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <div className="text-center px-4">
        <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          AI Chat Assistant
        </h3>
        <p className="text-sm text-gray-500 max-w-sm">
          The AI-powered chat assistant will be available here soon. 
          Get instant help with maintenance procedures, troubleshooting, and equipment questions.
        </p>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-700">
            💡 Coming Soon: Real-time chat with AI assistant trained on your equipment manuals and maintenance procedures
          </p>
        </div>
      </div>
    </div>
  )
}
