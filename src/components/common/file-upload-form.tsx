'use client'

import { useState, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Upload, File, Image } from 'lucide-react'

export type FileUploadType = 'document' | 'photo' | 'auto';

export interface FileUploadFormProps {
  // Linking options
  equipment_id?: string;
  work_order_id?: string;
  
  // Upload mode
  uploadType?: FileUploadType; // 'auto' will detect based on file type
  
  // Callbacks
  onSuccess?: (fileId: string) => void;
  onError?: (error: string) => void;
  
  // UI Options
  showDescription?: boolean;
  showLinkType?: boolean;
  buttonText?: string;
  variant?: 'inline' | 'dialog'; // Future: support dialog mode
}

// Document-specific options
const documentTypes = [
  { value: 'manual', label: 'Manual' },
  { value: 'safety', label: 'Safety Document' },
  { value: 'sop', label: 'SOP' },
  { value: 'troubleshooting', label: 'Troubleshooting Guide' },
  { value: 'other', label: 'Other' },
];

const documentScopes = [
  { value: 'company', label: 'Company-wide' },
  { value: 'equipment', label: 'Equipment-specific' },
];

// Photo-specific options
const photoLinkTypes = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'reference', label: 'Reference' },
  { value: 'profile', label: 'Profile Picture' },
  { value: 'other', label: 'Other' },
];

// Detect file type
function detectFileType(file: File): 'document' | 'photo' {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
  const documentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
  if (imageTypes.includes(file.type)) {
    return 'photo';
  } else if (documentTypes.includes(file.type)) {
    return 'document';
  }
  
  // Fallback to extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext || '')) {
    return 'photo';
  }
  return 'document';
}

export function FileUploadForm({
  equipment_id,
  work_order_id,
  uploadType = 'auto',
  onSuccess,
  onError,
  showDescription = true,
  showLinkType = false,
  buttonText = 'Upload File',
  variant = 'inline',
}: FileUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedType, setDetectedType] = useState<'document' | 'photo' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState('manual');
  const [documentScope, setDocumentScope] = useState(equipment_id ? 'equipment' : 'company');
  const [linkType, setLinkType] = useState('reference');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setTitle(file.name);
      
      // Auto-detect type if needed
      if (uploadType === 'auto') {
        const type = detectFileType(file);
        setDetectedType(type);
      }
      
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    // Determine final upload type
    const finalType = uploadType === 'auto' ? detectedType : uploadType;
    
    if (!finalType) {
      setError('Could not determine file type');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      // Build endpoint and payload based on type
      let endpoint: string;
      
      if (finalType === 'document') {
        endpoint = '/api/documents';
        formData.append('title', title || selectedFile.name);
        formData.append('type', documentType);
        formData.append('scope', documentScope);
        if (equipment_id) formData.append('equipment_id', equipment_id);
        if (description) formData.append('description', description);
      } else {
        // photo
        endpoint = '/api/photos';
        if (title && title !== selectedFile.name) {
          formData.append('description', title);
        } else if (description) {
          formData.append('description', description);
        }
        if (showLinkType) formData.append('link_type', linkType);
        if (equipment_id) formData.append('equipment_id', equipment_id);
        if (work_order_id) formData.append('work_order_id', work_order_id);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      
      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setDetectedType(null);
      
      // Success callback
      onSuccess?.(result.id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setDetectedType(null);
    setError(null);
  };

  const finalType = uploadType === 'auto' ? detectedType : uploadType;
  const isDocument = finalType === 'document';
  const isPhoto = finalType === 'photo';

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* File Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {uploadType === 'document' && 'Upload Document'}
          {uploadType === 'photo' && 'Upload Photo'}
          {uploadType === 'auto' && 'Upload File'}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept={
              uploadType === 'document' 
                ? '.pdf,.doc,.docx' 
                : uploadType === 'photo'
                ? 'image/*'
                : 'image/*,.pdf,.doc,.docx'
            }
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <label
            htmlFor="file-upload"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors"
          >
            {selectedFile ? (
              <>
                {isPhoto ? <Image className="h-5 w-5 text-brand" /> : <File className="h-5 w-5 text-brand" />}
                <span className="text-sm text-gray-900">{selectedFile.name}</span>
                <span className="text-xs text-gray-500">
                  ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">Choose file or drag here</span>
              </>
            )}
          </label>
        </div>
        
        {uploadType === 'auto' && selectedFile && detectedType && (
          <p className="text-xs text-gray-500 mt-1">
            Detected as: {detectedType === 'photo' ? '📷 Photo' : '📄 Document'}
          </p>
        )}
      </div>

      {/* Conditional Fields Based on Type */}
      {selectedFile && (
        <>
          {/* Title/Description for Documents */}
          {isDocument && (
            <>
              <Input
                label="Title *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
                disabled={isUploading}
                maxLength={255}
              />
              
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Type"
                  options={documentTypes}
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  disabled={isUploading}
                />
                
                <Select
                  label="Scope"
                  options={documentScopes}
                  value={documentScope}
                  onChange={(e) => setDocumentScope(e.target.value)}
                  disabled={isUploading || !!equipment_id}
                />
              </div>
            </>
          )}

          {/* Description for Photos */}
          {isPhoto && showDescription && (
            <Input
              label="Description (Optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what's in the photo"
              disabled={isUploading}
              maxLength={500}
            />
          )}

          {/* Link Type for Photos */}
          {isPhoto && showLinkType && (
            <Select
              label="Photo Type"
              options={photoLinkTypes}
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
              disabled={isUploading}
            />
          )}

          {/* Description (optional for both) */}
          {showDescription && isDocument && (
            <Textarea
              label="Description (Optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes..."
              disabled={isUploading}
              rows={3}
              maxLength={1000}
            />
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              isLoading={isUploading}
              disabled={isUploading || (isDocument && !title.trim())}
            >
              {buttonText}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
