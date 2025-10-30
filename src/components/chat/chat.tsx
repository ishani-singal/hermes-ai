'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
}

type ChatProps = {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  threadId: string | null
  setThreadId: React.Dispatch<React.SetStateAction<string | null>>
}

export function Chat({ messages, setMessages, threadId, setThreadId }: ChatProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // Initialize with welcome message only if messages are empty
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'm-system-1',
          role: 'system',
          text: 'Ask me about maintenance procedures, troubleshooting, or equipment details. I can act on your behalf if needed.',
        },
      ])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text?: string) => {
    const messageText = (text ?? input).trim()
    if (!messageText) return

    setError(null)

    const userMessage: Message = {
      id: String(Date.now()) + Math.random().toString(16).slice(2),
      role: 'user',
      text: messageText,
    }

    setMessages((m) => [...m, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // include cookies so backend auth middleware receives user context
        credentials: 'include',
        body: JSON.stringify({ 
          message: messageText,
          threadId: threadId || undefined,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      const json = await res.json()

      // Extract threadId from response and save it in state only (not localStorage)
      // This keeps the conversation context within the session, but doesn't persist across page reloads
      const responseThreadId = json?.data?.threadId || json?.threadId
      if (responseThreadId && responseThreadId !== threadId) {
        setThreadId(responseThreadId)
      }

      // backend success shape may vary; prefer known shapes and fallback to raw
      const assistantText =
        json?.assistant?.text ?? json?.data?.assistant?.text ?? json?.message ?? JSON.stringify(json)

      const assistantMessage: Message = {
        id: 'a-' + String(Date.now()) + Math.random().toString(16).slice(2),
        role: 'assistant',
        text: String(assistantText),
      }

      setMessages((m) => [...m, assistantMessage])
    } catch (err: unknown) {
      console.error('chat send error', err)
      setError(err instanceof Error ? err.message : String(err))
      setMessages((m) => [
        ...m,
        {
          id: 'a-err-' + String(Date.now()),
          role: 'assistant',
          text: 'Sorry — something went wrong. ' + (err instanceof Error ? err.message : ''),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Chat Header - Only show on larger screens */}
      <div className="hidden sm:flex items-center gap-3 mb-4">
        <MessageCircle className="h-6 w-6 text-gray-600" />
        <div>
          <h3 className="text-lg font-medium text-gray-900">AI Chat Assistant</h3>
          <p className="text-sm text-gray-500">Ask about procedures, troubleshooting, or equipment.</p>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-auto p-3 sm:p-4 bg-white rounded-lg border border-gray-200 shadow-sm min-h-[400px] sm:min-h-[320px]">
        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'text-right' : m.role === 'system' ? 'text-center' : 'text-left'}>
              <div
                className={
                  'inline-block px-4 py-2 rounded-lg max-w-[95%] break-words ' +
                  (m.role === 'user' ? 'bg-blue-600 text-white' : m.role === 'system' ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-900')
                }
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-1">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ ...props }) => (
                          <div className="overflow-x-auto my-2">
                            <table className="min-w-full divide-y divide-gray-300 border border-gray-300" {...props} />
                          </div>
                        ),
                        thead: ({ ...props }) => <thead className="bg-gray-50" {...props} />,
                        th: ({ ...props }) => (
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border border-gray-300" {...props} />
                        ),
                        td: ({ ...props }) => (
                          <td className="px-3 py-2 text-sm text-gray-700 border border-gray-300" {...props} />
                        ),
                        tr: ({ ...props }) => <tr className="hover:bg-gray-50" {...props} />,
                        p: ({ ...props }) => <p className="my-1" {...props} />,
                        h2: ({ ...props }) => <h2 className="text-lg font-bold mt-3 mb-2" {...props} />,
                        h3: ({ ...props }) => <h3 className="text-base font-semibold mt-2 mb-1" {...props} />,
                        strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
                        code: ({ ...props }) => (
                          <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono" {...props} />
                        ),
                      }}
                    >
                      {m.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <span>{m.text}</span>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="animate-spin h-4 w-4" />
              <span>Assistant is thinking…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="mt-4">
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your question here. Press Enter to send, Shift+Enter for newline."
            className="flex-1 min-h-[54px] p-3 rounded-md border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="Chat message"
          />

          <button
            onClick={() => void send()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
            <span className="text-sm">Send</span>
          </button>
        </div>
      </div>
    </div>
  )
}
