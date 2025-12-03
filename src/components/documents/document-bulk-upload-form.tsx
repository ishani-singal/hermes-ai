'use client'

import { useState, FormEvent, useRef, useEffect } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Upload, X, FileText, AlertCircle, CheckCircle, Files } from 'lucide-react'
import { Equipment } from '@/types'

// Limits for bulk upload
const MAX_FILES = 10
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file

interface UploadFileStatus {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  documentId?: string
}

export interface DocumentBulkUploadFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DocumentBulkUploadForm({ open, onOpenChange, onSuccess }: DocumentBulkUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<UploadFileStatus[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)

  const [formData, setFormData] = useState({
    type: 'manual',
    scope: 'company',
    equipmentId: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch equipment when dialog opens
  useEffect(() => {
    if (open) {
      fetchEquipment()
    }
  }, [open])

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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (selectedFiles.length === 0) {
      newErrors.file = 'Please select at least 2 files for bulk upload'
    }

    if (selectedFiles.length === 1) {
      newErrors.file = 'For single file upload, use the regular "Upload Document" option'
    }

    if (selectedFiles.length > MAX_FILES) {
      newErrors.file = `Maximum ${MAX_FILES} files allowed`
    }

    if (formData.scope === 'equipment' && !formData.equipmentId) {
      newErrors.equipmentId = 'Please select an equipment'
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
      setError(`Maximum ${MAX_FILES} files allowed. You selected ${files.length}.`)
      return
    }

    // Validate each file
    const validFiles: UploadFileStatus[] = []
    const fileErrors: string[] = []
    
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        fileErrors.push(`"${file.name}" is too large (max 10MB)`)
        continue
      }
      if (file.type !== 'application/pdf') {
        fileErrors.push(`"${file.name}" is not a PDF`)
        continue
      }
      validFiles.push({
        file,
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
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
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
        // Use filename as title for bulk uploads
        bulkFormData.append('titles', fileStatus.file.name.replace(/\.[^/.]+$/, ''))
      }
      
      // Add common settings
      bulkFormData.append('type', formData.type)
      bulkFormData.append('scope', formData.scope)
      if (formData.scope === 'equipment' && formData.equipmentId) {
        bulkFormData.append('equipment_id', formData.equipmentId)
      }

      // Simulate overall progress
      let currentProgress = 10
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(currentProgress + 5, 90)
        setSelectedFiles(prev => prev.map(f => ({ ...f, progress: currentProgress })))
      }, 500)

      const response = await fetch('/api/documents/bulk', {
        method: 'POST',
        body: bulkFormData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to upload documents')
      }

      const result = await response.json()
      
      // Update individual file statuses based on response
      setSelectedFiles(prev => prev.map((f, index) => {
        const resultItem = result.data?.results?.[index]
        if (resultItem?.error) {
          return { ...f, status: 'error' as const, progress: 100, error: resultItem.error }
        }
        return { ...f, status: 'success' as const, progress: 100, documentId: resultItem?.documentId }
      }))

      // If any files failed, show summary
      const failedCount = result.data?.failed || 0
      if (failedCount > 0) {
        setError(`${result.data.successful} of ${result.data.total} files uploaded. ${failedCount} failed.`)
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
    setFormData({
      type: 'manual',
      scope: 'company',
      equipmentId: '',
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
      title="Bulk Upload Documents"
      description={`Upload multiple documents at once (up to ${MAX_FILES} files)`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bulk Upload Info Banner */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start gap-2">
            <Files className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Bulk Upload Mode</p>
              <p className="mt-1">
                All documents will share the same type, scope, and equipment settings. 
                Titles are generated from file names.
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
          <h3 className="text-sm font-semibold text-gray-900">Settings for All Documents</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bulk-doc-type" className="block text-sm font-medium text-gray-700 mb-1">
                Document Type
              </label>
              <select
                id="bulk-doc-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
              >
                <option value="manual">Operation Manual</option>
                <option value="safety">Safety Guidelines</option>
                <option value="sop">Standard Operating Procedure</option>
                <option value="troubleshooting">Troubleshooting Guide</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="bulk-doc-scope" className="block text-sm font-medium text-gray-700 mb-1">
                Scope
              </label>
              <select
                id="bulk-doc-scope"
                value={formData.scope}
                onChange={(e) => {
                  setFormData({ ...formData, scope: e.target.value, equipmentId: '' })
                  setErrors({ ...errors, equipmentId: '' })
                }}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
              >
                <option value="company">Company-wide</option>
                <option value="equipment">Equipment-specific</option>
              </select>
            </div>
          </div>

          {/* Equipment Selector - Show only when scope is equipment */}
          {formData.scope === 'equipment' && (
            <div>
              <label htmlFor="bulk-doc-equipment" className="block text-sm font-medium text-gray-700 mb-1">
                Equipment *
              </label>
              <select
                id="bulk-doc-equipment"
                value={formData.equipmentId}
                onChange={(e) => setFormData({ ...formData, equipmentId: e.target.value })}
                disabled={isSubmitting || loadingEquipment}
                className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white ${
                  errors.equipmentId ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select equipment...</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.display_id} - {eq.name}
                  </option>
                ))}
              </select>
              {errors.equipmentId && (
                <p className="mt-1 text-sm text-red-600">{errors.equipmentId}</p>
              )}
              {loadingEquipment && (
                <p className="mt-1 text-sm text-gray-500">Loading equipment...</p>
              )}
            </div>
          )}
        </div>

        {/* File Upload Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Files ({selectedFiles.length}/{MAX_FILES})
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
              id="bulk-document-file-upload"
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              disabled={isSubmitting}
              className="sr-only"
              accept=".pdf"
              multiple
              aria-label="Upload multiple document files"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting || selectedFiles.length >= MAX_FILES}
              className="w-full flex flex-col items-center justify-center px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand hover:bg-brand/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Click to upload documents"
            >
              <Upload className="h-6 w-6 mb-2 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">
                Click to select PDF files
              </span>
              <span className="text-xs text-gray-400 mt-1">
                Select 2-{MAX_FILES} files at once (max 10MB each)
              </span>
            </button>
            {errors.file && (
              <p className="mt-1 text-sm text-red-600">{errors.file}</p>
            )}
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedFiles.map((fileStatus, index) => (
                <div 
                  key={`${fileStatus.file.name}-${index}`}
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    fileStatus.status === 'success' 
                      ? 'bg-green-50 border border-green-200' 
                      : fileStatus.status === 'error'
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {fileStatus.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : fileStatus.status === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fileStatus.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                        {fileStatus.error && <span className="text-red-600 ml-2">{fileStatus.error}</span>}
                      </p>
                    </div>
                  </div>
                  {fileStatus.status === 'uploading' ? (
                    <span className="text-xs text-gray-500 ml-2">
                      {Math.round(fileStatus.progress)}%
                    </span>
                  ) : fileStatus.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      disabled={isSubmitting}
                      className="flex-shrink-0 text-gray-400 hover:text-gray-600 disabled:opacity-50 ml-2"
                      title="Remove file"
                    >
                      <X className="h-4 w-4" />
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
                  Uploading {selectedFiles.length} files...
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
            Upload {selectedFiles.length} Documents
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
