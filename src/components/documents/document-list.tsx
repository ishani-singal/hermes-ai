'use client'

import { File } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteConfirmDialog } from '@/components/common/delete-confirm-dialog'
import { useAuth } from '@/lib/auth/context'
import { DataHubFile } from '@/components/common/datahub/types'
import { useFileList } from '@/components/common/datahub/hooks/use-file-list'
import { useFileEdit } from '@/components/common/datahub/hooks/use-file-edit'
import { FileListHeader } from '@/components/common/datahub/components/file-list-header'
import { FileTableView } from '@/components/common/datahub/components/file-table-view'
import { FileEditDialog } from '@/components/common/datahub/components/file-edit-dialog'

// Re-export Document type for compatibility if needed
export type Document = DataHubFile

export interface DocumentListProps {
  onCreateClick: () => void
  onBulkUploadClick?: () => void
}

export function DocumentList({ onCreateClick, onBulkUploadClick }: DocumentListProps) {
  const { companies, activeCompanyId } = useAuth()

  // Use shared hooks
  const {
    files: documents,
    isLoading,
    error,
    isRefreshing,
    deletingId,
    showDeleteConfirm,
    fileToDelete: documentToDelete,
    handleRefresh,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useFileList({ endpoint: '/api/documents' })

  const {
    editingFile: editingDocument,
    showEditDialog,
    isSaving: isSavingEdit,
    editFormData,
    setEditFormData,
    equipment,
    workOrders,
    loadingEquipment,
    loadingWorkOrders,
    handleEditClick,
    handleEditCancel,
    handleEditSave,
  } = useFileEdit({
    endpoint: '/api/documents',
    onSaveSuccess: () => handleRefresh()
  })

  const activeCompany = companies.find(uc => uc.company_id === activeCompanyId)
  const canCreate = activeCompany !== undefined
  const isAdmin = activeCompany?.role === 'admin'
  const canEdit = activeCompany?.role === 'admin' || activeCompany?.role === 'editor'

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
              <File className="h-4 w-4 mr-1" />
              Upload Document
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <FileListHeader
        title="Documents"
        count={documents.length}
        onRefresh={handleRefresh}
        onCreateClick={onCreateClick}
        onBulkUploadClick={onBulkUploadClick}
        isRefreshing={isRefreshing}
        canCreate={canCreate}
        createButtonText="Upload Document"
        bulkUploadButtonText="Bulk Upload"
      />

      <FileTableView
        files={documents}
        fileType="document"
        canEdit={canEdit}
        canDelete={isAdmin}
        deletingId={deletingId}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      {/* Created date footer */}
      <div className="text-xs text-gray-500 mt-4 text-center">
        Created dates reflect upload time in your local timezone
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        title="Delete Document"
        itemName={documentToDelete?.title || ''}
        isDeleting={deletingId === documentToDelete?.id}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Edit Dialog */}
      <FileEditDialog
        open={showEditDialog}
        file={editingDocument}
        formData={editFormData}
        setFormData={setEditFormData}
        equipment={equipment}
        workOrders={workOrders}
        loadingEquipment={loadingEquipment}
        loadingWorkOrders={loadingWorkOrders}
        isSaving={isSavingEdit}
        onCancel={handleEditCancel}
        onSave={handleEditSave}
      />
    </div>
  )
}
