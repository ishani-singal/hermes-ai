'use client'

import { useState } from 'react'
import { Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilePreview, PreviewFile } from '@/components/common/file-preview'
import { DeleteConfirmDialog } from '@/components/common/delete-confirm-dialog'
import { useAuth } from '@/lib/auth/context'
import { DataHubFile, ViewMode } from '@/components/common/datahub/types'
import { useFileList } from '@/components/common/datahub/hooks/use-file-list'
import { useFileEdit } from '@/components/common/datahub/hooks/use-file-edit'
import { FileListHeader } from '@/components/common/datahub/components/file-list-header'
import { FileGridView } from '@/components/common/datahub/components/file-grid-view'
import { FileTableView } from '@/components/common/datahub/components/file-table-view'
import { FileEditDialog } from '@/components/common/datahub/components/file-edit-dialog'

// Re-export Photo type for compatibility if needed, but internally use DataHubFile
export type Photo = DataHubFile

export interface PhotoListProps {
  onCreateClick: () => void
  onBulkUploadClick?: () => void
  onPhotoClick?: (photo: Photo) => void
  viewMode?: ViewMode
}

export function PhotoList({ onCreateClick, onBulkUploadClick, onPhotoClick, viewMode = 'grid' }: PhotoListProps) {
  const { companies, activeCompanyId } = useAuth()
  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(viewMode)
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Use shared hooks
  const {
    files: photos,
    isLoading,
    error,
    isRefreshing,
    deletingId,
    showDeleteConfirm,
    fileToDelete: photoToDelete,
    handleRefresh,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useFileList({ endpoint: '/api/photos' })

  const {
    editingFile: editingPhoto,
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
    endpoint: '/api/photos',
    onSaveSuccess: () => handleRefresh()
  })

  const activeCompany = companies.find(uc => uc.company_id === activeCompanyId)
  const canCreate = activeCompany !== undefined
  const isAdmin = activeCompany?.role === 'admin'
  const canEdit = activeCompany?.role === 'admin' || activeCompany?.role === 'editor'

  const handlePhotoClick = (photo: Photo) => {
    if (onPhotoClick) {
      onPhotoClick(photo)
    } else {
      // Default: open in lightbox preview
      setPreviewPhoto(photo)
      setShowPreview(true)
    }
  }

  // Convert photos to PreviewFile format for the lightbox
  const previewFiles: PreviewFile[] = photos.map(p => ({
    id: p.id,
    file_url: p.file_url,
    file_name: p.display_id,
    file_type: 'image/jpeg', // Photos are always images
    description: p.description,
  }))

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="aspect-square bg-gray-200 rounded-lg animate-pulse"
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Photos</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <Image className="mx-auto h-16 w-16" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Photos</h3>
          <p className="text-sm text-gray-500 mb-6">
            Upload your first photo to get started.
          </p>
          {canCreate && (
            <Button onClick={onCreateClick}>
              <Image className="h-4 w-4 mr-1" />
              Upload Photo
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <FileListHeader
        title="Photos"
        count={photos.length}
        viewMode={currentViewMode}
        onViewModeChange={setCurrentViewMode}
        onRefresh={handleRefresh}
        onCreateClick={onCreateClick}
        onBulkUploadClick={onBulkUploadClick}
        isRefreshing={isRefreshing}
        canCreate={canCreate}
        createButtonText="Upload Photo"
        bulkUploadButtonText="Bulk Upload"
      />

      {currentViewMode === 'grid' ? (
        <FileGridView
          files={photos}
          onFileClick={handlePhotoClick}
          onEditClick={handleEditClick}
          onDeleteClick={handleDeleteClick}
          canEdit={canEdit}
          canDelete={isAdmin}
          deletingId={deletingId}
        />
      ) : (
        <FileTableView
          files={photos}
          fileType="photo"
          canEdit={canEdit}
          canDelete={isAdmin}
          deletingId={deletingId}
          onEditClick={handleEditClick}
          onDeleteClick={handleDeleteClick}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        title="Delete Photo"
        itemName={photoToDelete?.display_id || ''}
        isDeleting={deletingId === photoToDelete?.id}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Edit Dialog */}
      <FileEditDialog
        open={showEditDialog}
        file={editingPhoto}
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

      {/* Photo Preview Lightbox */}
      <FilePreview
        file={previewPhoto ? {
          id: previewPhoto.id,
          file_url: previewPhoto.file_url,
          file_name: previewPhoto.display_id,
          file_type: 'image/jpeg',
          description: previewPhoto.description,
        } : null}
        files={previewFiles}
        open={showPreview}
        onOpenChange={setShowPreview}
      />
    </div>
  )
}
