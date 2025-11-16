'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, File, Download, Trash2 } from 'lucide-react'
import { Document, DocumentListResponse } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth/context'

export interface DocumentListProps {
  onCreateClick: () => void
}

export function DocumentList({ onCreateClick }: DocumentListProps) {
  const { companies, activeCompanyId } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null)

  const activeCompany = companies.find(uc => uc.company_id === activeCompanyId)
  const canCreate = activeCompany !== undefined
  const isAdmin = activeCompany?.role === 'admin'

  const fetchDocuments = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const response = await fetch('/api/documents')

      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }

      const data: DocumentListResponse = await response.json()
      setDocuments(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleRefresh = () => {
    fetchDocuments(true)
  }

  const handleDeleteClick = (doc: Document) => {
    setDocumentToDelete(doc)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return

    try {
      setDeletingId(documentToDelete.id)
      setShowDeleteConfirm(false)

      const response = await fetch(`/api/documents/${documentToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete document')
      }

      // Remove from local state
      setDocuments(prev => prev.filter(d => d.id !== documentToDelete.id))
      setDocumentToDelete(null)
    } catch (err) {
      console.error('Error deleting document:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete document')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
    setDocumentToDelete(null)
  }

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      manual: 'Manual',
      safety: 'Safety',
      sop: 'SOP',
      troubleshooting: 'Troubleshooting',
      other: 'Other',
    }
    return labels[type] || type
  }

  const getScopeLabel = (scope: string): string => {
    return scope === 'company' ? 'Company-wide' : 'Equipment'
  }

  const getStatusBadgeVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      uploaded: 'success',
      failed: 'danger',
    }
    return variants[status] || 'default'
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-gray-200 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center px-4">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Documents</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <File className="mx-auto h-16 w-16" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents</h3>
          <p className="text-sm text-gray-500 mb-6">
            Upload your first document to get started.
          </p>
          {canCreate && (
            <Button onClick={onCreateClick}>
              <Plus className="h-4 w-4 mr-1" />
              Upload Document
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Documents
          </h2>
          <p className="text-sm text-gray-500">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            isLoading={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          {canCreate && (
            <Button size="sm" onClick={onCreateClick}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Upload Document</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          )}
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Equipment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Scope</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.title}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {doc.display_id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {getTypeLabel(doc.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {doc.equipment ? (
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.equipment.name}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {doc.equipment.display_id}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="info" size="sm">
                      {getScopeLabel(doc.scope)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusBadgeVariant(doc.status)} size="sm">
                      {doc.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {doc.file_url && doc.status === 'uploaded' && (
                        <a
                          href={doc.file_url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-2 text-brand hover:bg-brand/10 rounded transition-colors"
                          title="Download document"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteClick(doc)}
                          disabled={deletingId === doc.id}
                          className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Created date footer */}
      <div className="text-xs text-gray-500 mt-4 text-center">
        Created dates reflect upload time in your local timezone
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && documentToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Document
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <span className="font-medium">"{documentToDelete.title}"</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleDeleteCancel}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                isLoading={deletingId === documentToDelete.id}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
