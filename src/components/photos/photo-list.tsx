'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, Image, Trash2, Wrench, ClipboardList, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FilePreview, PreviewFile } from '@/components/common/file-preview'
import { useAuth } from '@/lib/auth/context'

interface Photo {
  id: string
  company_id: string
  equipment_id?: string
  work_order_id?: string
  display_id: string
  description?: string
  file_url: string
  file_size: number
  link_type?: string
  status: 'uploaded' | 'processing' | 'ready' | 'failed'
  created_at: string
  updated_at: string
  equipment?: {
    id: string
    display_id: string
    name: string
  }
  work_order?: {
    id: string
    display_id: string
    title: string
  }
}

interface PhotoListResponse {
  data: Photo[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface PhotoListProps {
  onCreateClick: () => void
  onPhotoClick?: (photo: Photo) => void
}

export function PhotoList({ onCreateClick, onPhotoClick }: PhotoListProps) {
  const { companies, activeCompanyId } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null)
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const activeCompany = companies.find(uc => uc.company_id === activeCompanyId)
  const canCreate = activeCompany !== undefined
  const isAdmin = activeCompany?.role === 'admin'

  const fetchPhotos = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const response = await fetch('/api/photos')

      if (!response.ok) {
        throw new Error('Failed to fetch photos')
      }

      const data: PhotoListResponse = await response.json()
      setPhotos(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  const handleRefresh = () => {
    fetchPhotos(true)
  }

  const handleDeleteClick = (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation()
    setPhotoToDelete(photo)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!photoToDelete) return

    try {
      setDeletingId(photoToDelete.id)
      setShowDeleteConfirm(false)

      const response = await fetch(`/api/photos/${photoToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete photo')
      }

      setPhotos(prev => prev.filter(p => p.id !== photoToDelete.id))
      setPhotoToDelete(null)
    } catch (err) {
      console.error('Error deleting photo:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete photo')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
    setPhotoToDelete(null)
  }

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

  const getStatusBadgeVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      uploaded: 'default',
      processing: 'warning',
      ready: 'success',
      failed: 'danger',
    }
    return variants[status] || 'default'
  }

  // Generate thumbnail URL with size optimization
  const getThumbnailUrl = (url: string) => {
    // Supabase Storage supports image transformations via query params
    // ?width=200&height=200&resize=cover
    if (url.includes('supabase')) {
      return `${url}?width=200&height=200&resize=cover`
    }
    return url
  }

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
              <Plus className="h-4 w-4 mr-1" />
              Upload Photo
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
            Photos
          </h2>
          <p className="text-sm text-gray-500">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
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
              <span className="hidden sm:inline">Upload Photo</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          )}
        </div>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand transition-all"
            onClick={() => handlePhotoClick(photo)}
          >
            {/* Thumbnail Image */}
            <img
              src={getThumbnailUrl(photo.file_url)}
              alt={photo.description || 'Photo'}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* Overlay with info */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-xs text-white font-mono truncate">
                  {photo.display_id}
                </p>
              </div>
            </div>

            {/* Association Badge */}
            <div className="absolute top-2 left-2">
              {photo.equipment ? (
                <Badge variant="default" size="sm" className="bg-white/90 text-gray-700 shadow-sm">
                  <Wrench className="h-3 w-3 mr-1" />
                  <span className="truncate max-w-[60px]">{photo.equipment.name}</span>
                </Badge>
              ) : photo.work_order ? (
                <Badge variant="default" size="sm" className="bg-white/90 text-gray-700 shadow-sm">
                  <ClipboardList className="h-3 w-3 mr-1" />
                  <span className="truncate max-w-[60px]">WO</span>
                </Badge>
              ) : (
                <Badge variant="default" size="sm" className="bg-white/90 text-gray-700 shadow-sm">
                  <Building2 className="h-3 w-3 mr-1" />
                  <span>Company</span>
                </Badge>
              )}
            </div>

            {/* Status Badge */}
            {photo.status !== 'ready' && (
              <div className="absolute top-2 right-2">
                <Badge variant={getStatusBadgeVariant(photo.status)} size="sm">
                  {photo.status}
                </Badge>
              </div>
            )}

            {/* Delete Button (visible on hover, admin only) */}
            {isAdmin && (
              <button
                onClick={(e) => handleDeleteClick(photo, e)}
                disabled={deletingId === photo.id}
                className="absolute bottom-2 right-2 p-1.5 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-all disabled:opacity-50"
                title="Delete photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && photoToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Photo
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <span className="font-medium">{photoToDelete.display_id}</span>?
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
                isLoading={deletingId === photoToDelete.id}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

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
