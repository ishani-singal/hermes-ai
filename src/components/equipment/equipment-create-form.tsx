'use client'

import { useState, FormEvent, useRef } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { CreateEquipmentRequest } from '@/types'
import { Upload, X } from 'lucide-react'

export interface EquipmentCreateFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EquipmentCreateForm({ open, onOpenChange, onSuccess }: EquipmentCreateFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<CreateEquipmentRequest & { documentName?: string; documentType?: string; documentDescription?: string }>({
    name: '',
    type: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    location: '',
    documentName: '',
    documentType: 'manual',
    documentDescription: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name?.trim()) {
      newErrors.name = 'Equipment name is required'
    } else if (formData.name.length > 255) {
      newErrors.name = 'Name must be 255 characters or less'
    }

    if (selectedFile && !formData.documentName?.trim()) {
      newErrors.documentName = 'Document name is required when uploading a file'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      // Suggest document name based on file name if not already set
      if (!formData.documentName) {
        setFormData(prev => ({
          ...prev,
          documentName: file.name.replace(/\.[^/.]+$/, '')
        }))
      }
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
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
    setWarning(null)

    try {
      // Step 1: Create equipment
      const submitData: CreateEquipmentRequest = {
        name: formData.name.trim(),
        type: formData.type?.trim() || undefined,
        manufacturer: formData.manufacturer?.trim() || undefined,
        model: formData.model?.trim() || undefined,
        serial_number: formData.serial_number?.trim() || undefined,
        location: formData.location?.trim() || undefined,
      }

      const equipmentResponse = await fetch('/api/equipment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      if (!equipmentResponse.ok) {
        const errorData = await equipmentResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create equipment')
      }

      const createdEquipment = await equipmentResponse.json()

      // Step 2: Upload document if provided
      let documentUploadError: string | null = null
      if (selectedFile && formData.documentName?.trim() && createdEquipment?.id) {
        try {
          const docFormData = new FormData()
          docFormData.append('file', selectedFile)
          docFormData.append('title', formData.documentName.trim())
          docFormData.append('type', formData.documentType || 'manual')
          docFormData.append('scope', 'equipment')
          docFormData.append('equipment_id', createdEquipment.id)
          if (formData.documentDescription?.trim()) {
            docFormData.append('description', formData.documentDescription.trim())
          }

          const documentResponse = await fetch('/api/documents', {
            method: 'POST',
            body: docFormData,
          })

          if (!documentResponse.ok) {
            const errorData = await documentResponse.json().catch(() => ({}))
            documentUploadError = errorData.error || 'Failed to upload document'
            console.warn('Document upload warning:', documentUploadError)
          }
        } catch (docErr) {
          documentUploadError = docErr instanceof Error ? docErr.message : 'Failed to upload document'
          console.warn('Document upload error:', docErr)
        }
      }

      // Reset form
      setFormData({
        name: '',
        type: '',
        manufacturer: '',
        model: '',
        serial_number: '',
        location: '',
        documentName: '',
        documentType: 'manual',
        documentDescription: '',
      })
      setSelectedFile(null)
      setErrors({})

      // Show warning if document upload failed, but keep dialog open briefly
      if (documentUploadError) {
        setWarning(`Equipment created successfully! However, the document upload failed: ${documentUploadError}. You can add the document later from the Equipment or Documents tab.`)
        // Close after showing warning
        setTimeout(() => {
          setWarning(null)
          onOpenChange(false)
          onSuccess()
        }, 5000) // 5 seconds to read the message
      } else {
        // Close dialog and notify parent immediately
        onOpenChange(false)
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (!isSubmitting) {
      setFormData({
        name: '',
        type: '',
        manufacturer: '',
        model: '',
        serial_number: '',
        location: '',
        documentName: '',
        documentType: 'manual',
        documentDescription: '',
      })
      setSelectedFile(null)
      setErrors({})
      setError(null)
      setWarning(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Equipment"
      description="Add a new equipment record to your inventory"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {warning && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">{warning}</p>
          </div>
        )}

        {/* Equipment Information Section */}
        <div className="space-y-4 pb-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Equipment Information</h3>

          <Input
            label="Equipment Name *"
            placeholder="e.g., Conveyor Belt #3"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
            disabled={isSubmitting}
            maxLength={255}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Type"
              placeholder="e.g., Conveyor"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              disabled={isSubmitting}
            />

            <Input
              label="Manufacturer"
              placeholder="e.g., Acme Corp"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Model"
              placeholder="e.g., CB-500"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              disabled={isSubmitting}
            />

            <Input
              label="Serial Number"
              placeholder="e.g., SN12345"
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <Input
            label="Location"
            placeholder="e.g., Warehouse B, Zone 3"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            disabled={isSubmitting}
          />
        </div>

        {/* Document Upload Section (Optional) */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Attach Document (Optional)</h3>

          {/* File Input */}
          <div>
            <label htmlFor="document-file" className="block text-sm font-medium text-gray-700 mb-2">
              Document File
            </label>
            <div className="relative">
              <input
                id="document-file"
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                disabled={isSubmitting}
                className="sr-only"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                aria-label="Upload document file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand hover:bg-brand/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Click to upload document"
              >
                <Upload className="h-4 w-4 mr-2 text-gray-600" />
                <span className="text-sm text-gray-600">
                  {selectedFile ? selectedFile.name : 'Click to upload document'}
                </span>
              </button>
            </div>
          </div>

          {/* Selected File Display */}
          {selectedFile && (
            <div className="p-3 bg-brand/5 border border-brand/30 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-shrink-0 text-brand">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 16.5a.5.5 0 01-.5-.5v-5H5.707l2.147-2.146a.5.5 0 00-.707-.708l-3 3a.5.5 0 000 .708l3 3a.5.5 0 00.707-.708L5.707 11H7.5v5a.5.5 0 01-.5.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={isSubmitting}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                title="Remove file"
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Document Information (shown when file is selected) */}
          {selectedFile && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
              <Input
                label="Document Name *"
                placeholder="e.g., Operation Manual"
                value={formData.documentName}
                onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
                error={errors.documentName}
                disabled={isSubmitting}
              />

              <div>
                <label htmlFor="document-type" className="block text-sm font-medium text-gray-700 mb-1">
                  Document Type
                </label>
                <select
                  id="document-type"
                  value={formData.documentType}
                  onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                >
                  <option value="manual">Operation Manual</option>
                  <option value="safety">Safety Guidelines</option>
                  <option value="sop">Standard Operating Procedure</option>
                  <option value="troubleshooting">Troubleshooting Guide</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <Textarea
                label="Description"
                placeholder="Optional: Add a brief description of the document"
                value={formData.documentDescription}
                onChange={(e) => setFormData({ ...formData, documentDescription: e.target.value })}
                disabled={isSubmitting}
                rows={2}
                maxLength={500}
              />
            </div>
          )}

          <p className="text-xs text-gray-500">
            💡 Document upload is optional. You can attach it now or add it later from the Equipment or Document tabs.
          </p>
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
            disabled={isSubmitting}
          >
            Create Equipment
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
