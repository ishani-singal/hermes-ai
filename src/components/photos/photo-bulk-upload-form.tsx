'use client'

import { useState, FormEvent, useRef, useEffect } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Upload, X, Camera, AlertCircle, CheckCircle, Images } from 'lucide-react'
import { Equipment, WorkOrder } from '@/types'

// Limits for bulk upload
const MAX_FILES = 10
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB per file

interface UploadFileStatus {
  file: File
  previewUrl?: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  photoId?: string
}

export interface PhotoBulkUploadFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function PhotoBulkUploadForm({ open, onOpenChange, onSuccess }: PhotoBulkUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<UploadFileStatus[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false)

  const [formData, setFormData] = useState({
    equipmentId: '',
    workOrderId: '',
    linkType: 'reference' as 'profile' | 'reference' | 'before' | 'after' | 'evidence' | 'other',
    description: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch equipment and work orders when dialog opens
  useEffect(() => {
    if (open) {
      fetchEquipment()
      fetchWorkOrders()
    }
  }, [open])

  // Clean up preview URLs on unmount or when files change
  useEffect(() => {
    return () => {
      selectedFiles.forEach(f => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl)
        }
      })
    }
  }, [selectedFiles])

  const fetchEquipment = async () => {
    setLoadingEquipment(true)
    try {
      const response = await fetch('/api/equipment')
      if (response.ok) {
        const data = await response.json()
        setEquipment(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch equipment:', err)
    } finally {
      setLoadingEquipment(false)
    }
  }

  const fetchWorkOrders = async () => {
    setLoadingWorkOrders(true)
    try {
      const response = await fetch('/api/work-orders?status=open,in_progress')
      if (response.ok) {
        const data = await response.json()
        setWorkOrders(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch work orders:', err)
    } finally {
      setLoadingWorkOrders(false)
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (selectedFiles.length === 0) {
      newErrors.file = 'Please select at least 2 photos for bulk upload'
    }

    if (selectedFiles.length === 1) {
      newErrors.file = 'For single photo upload, use the regular "Upload Photo" option'
    }

    if (selectedFiles.length > MAX_FILES) {
      newErrors.file = `Maximum ${MAX_FILES} photos allowed`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setError(null)

    // Validate file count
    if (files.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} photos allowed. You selected ${files.length}.`)
      return
    }

    // Clean up old preview URLs
    selectedFiles.forEach(f => {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl)
      }
    })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic']
    const validFiles: UploadFileStatus[] = []
    const fileErrors: string[] = []
    
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        fileErrors.push(`"${file.name}" is not a supported image format`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        fileErrors.push(`"${file.name}" is too large (max 20MB)`)
        continue
      }
      validFiles.push({
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
        progress: 0,
      })
    }

    if (fileErrors.length > 0) {
      setError(fileErrors.join('. '))
    }

    setSelectedFiles(validFiles)
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => {
      const file = prev[index]
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl)
      }
      return prev.filter((_, i) => i !== index)
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Mark all as uploading
      setSelectedFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const, progress: 10 })))

      const bulkFormData = new FormData()
      
      // Add all files
      for (const fileStatus of selectedFiles) {
        bulkFormData.append('files', fileStatus.file)
        // Use description for all if provided, otherwise empty
        bulkFormData.append('descriptions', formData.description || '')
      }
      
      // Add common settings
      bulkFormData.append('link_type', formData.linkType)
      if (formData.equipmentId) {
        bulkFormData.append('equipment_id', formData.equipmentId)
      }
      if (formData.workOrderId) {
        bulkFormData.append('work_order_id', formData.workOrderId)
      }

      // Simulate overall progress
      let currentProgress = 10
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(currentProgress + 5, 90)
        setSelectedFiles(prev => prev.map(f => ({ ...f, progress: currentProgress })))
      }, 500)

      const response = await fetch('/api/photos/bulk', {
        method: 'POST',
        body: bulkFormData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to upload photos')
      }

      const result = await response.json()
      
      // Update individual file statuses based on response
      setSelectedFiles(prev => prev.map((f, index) => {
        const resultItem = result.data?.results?.[index]
        if (resultItem?.error) {
          return { ...f, status: 'error' as const, progress: 100, error: resultItem.error }
        }
        return { ...f, status: 'success' as const, progress: 100, photoId: resultItem?.photoId }
      }))

      // If any files failed, show summary
      const failedCount = result.data?.failed || 0
      if (failedCount > 0) {
        setError(`${result.data.successful} of ${result.data.total} photos uploaded. ${failedCount} failed.`)
        // Don't close dialog if there were failures
        return
      }

      // Reset form
      resetForm()

      // Close dialog and notify parent
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    // Clean up preview URLs
    selectedFiles.forEach(f => {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl)
      }
    })
    
    setFormData({
      equipmentId: '',
      workOrderId: '',
      linkType: 'reference',
      description: '',
    })
    setSelectedFiles([])
    setErrors({})
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCancel = () => {
    if (!isSubmitting) {
      resetForm()
      onOpenChange(false)
    }
  }

  const totalProgress = selectedFiles.length > 0
    ? selectedFiles.reduce((sum, f) => sum + f.progress, 0) / selectedFiles.length
    : 0

  const successCount = selectedFiles.filter(f => f.status === 'success').length
  const errorCount = selectedFiles.filter(f => f.status === 'error').length

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bulk Upload Photos"
      description={`Upload multiple photos at once (up to ${MAX_FILES} photos)`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bulk Upload Info Banner */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start gap-2">
            <Images className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Bulk Upload Mode</p>
              <p className="mt-1">
                All photos will share the same equipment, work order, and type settings.
                Photos will be analyzed by AI for search indexing.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Common Settings Section */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Settings for All Photos</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bulk-photo-equipment" className="block text-sm font-medium text-gray-700 mb-1">
                Link to Equipment
              </label>
              <select
                id="bulk-photo-equipment"
                value={formData.equipmentId}
                onChange={(e) => setFormData({ ...formData, equipmentId: e.target.value })}
                disabled={isSubmitting || loadingEquipment}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
              >
                <option value="">No equipment</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.display_id} - {eq.name}
                  </option>
                ))}
              </select>
              {loadingEquipment && (
                <p className="mt-1 text-xs text-gray-500">Loading...</p>
              )}
            </div>

            <div>
              <label htmlFor="bulk-photo-work-order" className="block text-sm font-medium text-gray-700 mb-1">
                Link to Work Order
              </label>
              <select
                id="bulk-photo-work-order"
                value={formData.workOrderId}
                onChange={(e) => setFormData({ ...formData, workOrderId: e.target.value })}
                disabled={isSubmitting || loadingWorkOrders}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
              >
                <option value="">No work order</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.display_id} - {wo.title}
                  </option>
                ))}
              </select>
              {loadingWorkOrders && (
                <p className="mt-1 text-xs text-gray-500">Loading...</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="bulk-photo-link-type" className="block text-sm font-medium text-gray-700 mb-1">
              Photo Type
            </label>
            <select
              id="bulk-photo-link-type"
              value={formData.linkType}
              onChange={(e) => setFormData({ ...formData, linkType: e.target.value as typeof formData.linkType })}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
            >
              <option value="reference">Reference Photo</option>
              <option value="profile">Equipment Profile</option>
              <option value="before">Before (Repair)</option>
              <option value="after">After (Repair)</option>
              <option value="evidence">Issue Evidence</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Textarea
            label="Description (applies to all photos)"
            placeholder="Optional: Add notes about these photos"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            disabled={isSubmitting}
            rows={2}
            maxLength={500}
          />
        </div>

        {/* File Upload Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Photos ({selectedFiles.length}/{MAX_FILES})
            </h3>
            {selectedFiles.length > 0 && !isSubmitting && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            )}
          </div>

          {/* File Input */}
          <div>
            <input
              id="bulk-photo-file-upload"
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              disabled={isSubmitting}
              className="sr-only"
              accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
              multiple
              aria-label="Upload multiple photo files"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting || selectedFiles.length >= MAX_FILES}
              className="w-full flex flex-col items-center justify-center px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand hover:bg-brand/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Click to upload photos"
            >
              <Camera className="h-6 w-6 mb-2 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">
                Click to select photos
              </span>
              <span className="text-xs text-gray-400 mt-1">
                Select 2-{MAX_FILES} photos at once (JPEG, PNG, GIF, WebP, HEIC - max 20MB each)
              </span>
            </button>
            {errors.file && (
              <p className="mt-1 text-sm text-red-600">{errors.file}</p>
            )}
          </div>

          {/* Selected Files Grid */}
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-64 overflow-y-auto p-2">
              {selectedFiles.map((fileStatus, index) => (
                <div 
                  key={`${fileStatus.file.name}-${index}`}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                    fileStatus.status === 'success' 
                      ? 'border-green-500' 
                      : fileStatus.status === 'error'
                      ? 'border-red-500'
                      : 'border-gray-200'
                  }`}
                >
                  {fileStatus.previewUrl && (
                    <img
                      src={fileStatus.previewUrl}
                      alt={fileStatus.file.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  {/* Status overlay */}
                  {fileStatus.status === 'success' && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                  )}
                  {fileStatus.status === 'error' && (
                    <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                      <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                  )}
                  {fileStatus.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {Math.round(fileStatus.progress)}%
                      </span>
                    </div>
                  )}
                  
                  {/* Remove button */}
                  {fileStatus.status === 'pending' && !isSubmitting && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                      title="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload Progress */}
          {isSubmitting && totalProgress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Uploading {selectedFiles.length} photos...
                </span>
                <span className="text-sm text-gray-500">{Math.round(totalProgress)}%</span>
              </div>
              <ProgressBar progress={totalProgress} />
            </div>
          )}

          {/* Summary after upload */}
          {!isSubmitting && (successCount > 0 || errorCount > 0) && (
            <div className="flex items-center gap-4 text-sm">
              {successCount > 0 && (
                <span className="text-green-600">
                  <CheckCircle className="h-4 w-4 inline mr-1" />
                  {successCount} uploaded
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-600">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  {errorCount} failed
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting || selectedFiles.length < 2}
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload {selectedFiles.length} Photos
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
