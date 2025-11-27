import { useState, useCallback } from 'react'

interface UseFileUploadProps {
    endpoint: string
    onSuccess?: () => void
    maxSize?: number // in bytes
    acceptedTypes?: string[] // e.g., ['image/jpeg', 'application/pdf']
}

export function useFileUpload({ endpoint, onSuccess, maxSize = 10 * 1024 * 1024, acceptedTypes }: UseFileUploadProps) {
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
    const [error, setError] = useState<string | null>(null)

    const handleFileSelect = useCallback((selectedFile: File) => {
        setError(null)

        // Validate size
        if (selectedFile.size > maxSize) {
            setError(`File size exceeds the limit of ${maxSize / 1024 / 1024}MB`)
            return
        }

        // Validate type
        if (acceptedTypes && !acceptedTypes.some(type => {
            if (type.endsWith('/*')) {
                const baseType = type.split('/')[0]
                return selectedFile.type.startsWith(baseType)
            }
            return selectedFile.type === type
        })) {
            setError('Invalid file type')
            return
        }

        setFile(selectedFile)
        setStatus('idle')

        // Create preview for images
        if (selectedFile.type.startsWith('image/')) {
            const url = URL.createObjectURL(selectedFile)
            setPreviewUrl(url)
        } else {
            setPreviewUrl(null)
        }
    }, [maxSize, acceptedTypes])

    const uploadFile = async (additionalData: Record<string, any>) => {
        if (!file) {
            setError('No file selected')
            return
        }

        try {
            setStatus('uploading')
            setUploadProgress(0)
            setError(null)

            const formData = new FormData()
            formData.append('file', file)

            // Append additional data
            Object.entries(additionalData).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    formData.append(key, value)
                }
            })

            // Simulate progress (since fetch doesn't support it natively easily without XHR)
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval)
                        return 90
                    }
                    return prev + 10
                })
            }, 200)

            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            })

            clearInterval(progressInterval)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Upload failed')
            }

            setUploadProgress(100)
            setStatus('success')
            if (onSuccess) onSuccess()
        } catch (err) {
            console.error('Upload error:', err)
            setError(err instanceof Error ? err.message : 'Upload failed')
            setStatus('error')
        }
    }

    const reset = () => {
        setFile(null)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        setUploadProgress(0)
        setStatus('idle')
        setError(null)
    }

    return {
        file,
        previewUrl,
        uploadProgress,
        status,
        error,
        handleFileSelect,
        uploadFile,
        reset,
    }
}
