import { MessageCircle, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Message } from './chat'

type ChatMessagesProps = {
  messages: Message[]
  loading: boolean
  bottomRef: React.RefObject<HTMLDivElement | null>
}

export function ChatMessages({ messages, loading, bottomRef }: ChatMessagesProps) {
  return (
    <>
      {/* Chat Header - Only show on larger screens */}
      <div className="hidden sm:flex items-center gap-3 mb-4">
        <MessageCircle className="h-6 w-6 text-gray-600" />
        <div>
          <h3 className="text-lg font-medium text-gray-900">AI Chat Assistant</h3>
          <p className="text-sm text-gray-500">Ask about procedures, troubleshooting, or equipment.</p>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="h-full overflow-auto p-3 sm:p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'text-right' : m.role === 'system' ? 'text-center' : 'text-left'}>
              <div
                className={
                  'inline-block px-4 py-2 rounded-lg max-w-[95%] break-words ' +
                  (m.role === 'user' ? 'bg-brand text-white' : m.role === 'system' ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-900')
                }
              >
                {/* Photo Attachment */}
                {m.photoAttachment && (
                  <div className="mb-2">
                    <img 
                      src={m.photoAttachment.previewUrl} 
                      alt={m.photoAttachment.displayId || 'Photo'} 
                      className="rounded-lg max-w-xs max-h-48 object-contain"
                    />
                    {m.photoAttachment.displayId && (
                      <p className="text-xs text-gray-500 mt-1">{m.photoAttachment.displayId}</p>
                    )}
                  </div>
                )}
                
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
    </>
  )
}
