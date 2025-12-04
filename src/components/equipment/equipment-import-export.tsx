'use client'

import { useState, useRef } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle, 
  SkipForward,
  X
} from 'lucide-react'
import type { EquipmentImportResult } from '@/lib/api/equipment-helpers'

// =============================================
// Import Dialog Component
// =============================================

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function ImportDialog({ open, onOpenChange, onSuccess }: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EquipmentImportResult | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setResult(null)

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    // Validate file size (1MB max)
    if (file.size > 1024 * 1024) {
      setError('File size must be less than 1MB')
      return
    }

    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/equipment/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import equipment')
      }

      setResult(data as EquipmentImportResult)

      // If we created any equipment, notify parent to refresh
      if (data.created > 0) {
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFile(null)
      setError(null)
      setResult(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      onOpenChange(false)
    }
  }

  const handleDownloadTemplate = () => {
    window.open('/api/equipment/export?template=true', '_blank')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title="Import Equipment from CSV"
      description="Upload a CSV file to create multiple equipment records at once"
      size="lg"
    >
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">CSV Import Guidelines</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-blue-700">
                <li>Maximum 100 equipment per import</li>
                <li>Required column: <code className="bg-blue-100 px-1 rounded">name</code></li>
                <li>Duplicate serial numbers will be skipped</li>
                <li>Lines starting with # are ignored</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-center">
                <div className="text-2xl font-bold text-green-700">{result.created}</div>
                <div className="text-xs text-green-600">Created</div>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-center">
                <div className="text-2xl font-bold text-yellow-700">{result.skipped}</div>
                <div className="text-xs text-yellow-600">Skipped</div>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-center">
                <div className="text-2xl font-bold text-red-700">{result.errors}</div>
                <div className="text-xs text-red-600">Errors</div>
              </div>
            </div>

            {/* Detailed Results */}
            {(result.skipped > 0 || result.errors > 0) && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Row</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.results
                      .filter(r => r.status !== 'created')
                      .map((row, idx) => (
                        <tr key={idx} className={row.status === 'error' ? 'bg-red-50' : 'bg-yellow-50'}>
                          <td className="px-3 py-2 text-gray-600">{row.row}</td>
                          <td className="px-3 py-2 text-gray-900 truncate max-w-[150px]">{row.name}</td>
                          <td className="px-3 py-2">
                            {row.status === 'skipped' ? (
                              <span className="inline-flex items-center gap-1 text-yellow-700">
                                <SkipForward className="h-3 w-3" />
                                Skipped
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-700">
                                <AlertCircle className="h-3 w-3" />
                                Error
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{row.reason}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* File Selection (only show if no result yet) */}
        {!result && (
          <div className="space-y-4">
            {/* Template Download */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md">
              <div className="text-sm text-gray-600">
                Need a template? Download one with the correct format.
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-4 w-4 mr-1" />
                Template
              </Button>
            </div>

            {/* File Input */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="sr-only"
                id="equipment-csv-upload"
              />
              <label
                htmlFor="equipment-csv-upload"
                className={`
                  flex flex-col items-center justify-center w-full px-4 py-8
                  border-2 border-dashed rounded-lg cursor-pointer
                  transition-colors
                  ${selectedFile 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-300 hover:border-brand hover:bg-brand/5'
                  }
                  ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {selectedFile ? (
                  <>
                    <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                    <span className="text-sm font-medium text-gray-900">{selectedFile.name}</span>
                    <span className="text-xs text-gray-500 mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-600">
                      Click to select CSV file
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      Maximum 1MB
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              isLoading={isUploading}
            >
              <Upload className="h-4 w-4 mr-1" />
              Import Equipment
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}

// =============================================
// Main Export Component
// =============================================

export interface EquipmentImportExportProps {
  onImportSuccess: () => void
  hasEquipment: boolean
}

export function EquipmentImportExport({ onImportSuccess, hasEquipment }: EquipmentImportExportProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      // Trigger download via direct link
      window.open('/api/equipment/export', '_blank')
    } finally {
      // Small delay to show loading state
      setTimeout(() => setIsExporting(false), 500)
    }
  }

  const handleDownloadTemplate = () => {
    window.open('/api/equipment/export?template=true', '_blank')
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Download Template Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownloadTemplate}
          title="Download CSV template"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Template</span>
        </Button>

        {/* Export Button (only show if there's equipment) */}
        {hasEquipment && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            title="Export all equipment to CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Export</span>
          </Button>
        )}

        {/* Import Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportDialogOpen(true)}
          title="Import equipment from CSV"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Import</span>
        </Button>
      </div>

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={onImportSuccess}
      />
    </>
  )
}
