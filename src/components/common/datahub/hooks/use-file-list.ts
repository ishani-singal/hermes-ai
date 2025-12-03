import { useState, useCallback, useEffect, useRef } from 'react'
import { DataHubFile } from '../types'

interface UseFileListProps {
    endpoint: string
    bucketId?: string // 'documents' or 'photos' (for delete logic if needed specific handling)
    autoRefreshInterval?: number // Auto-refresh interval for processing files (ms)
}

// Statuses that indicate the file is still being processed
const PROCESSING_STATUSES = ['uploaded', 'analyzing', 'indexing', 'processing']

// Default to 60 seconds for auto-refresh when processing files
const DEFAULT_AUTO_REFRESH_INTERVAL = 60000

export function useFileList({ endpoint, autoRefreshInterval = DEFAULT_AUTO_REFRESH_INTERVAL }: UseFileListProps) {
    const [files, setFiles] = useState<DataHubFile[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [fileToDelete, setFileToDelete] = useState<DataHubFile | null>(null)
    const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null)

    const fetchFiles = useCallback(async (showRefreshIndicator = false, isSilentRefresh = false) => {
        try {
            // For silent refresh (auto-refresh), don't show any loading indicators
            if (!isSilentRefresh) {
                if (showRefreshIndicator) {
                    setIsRefreshing(true)
                } else {
                    setIsLoading(true)
                }
            }
            setError(null)

            const response = await fetch(endpoint)

            if (!response.ok) {
                throw new Error('Failed to fetch files')
            }

            const data = await response.json()
            setFiles(data.data)
        } catch (err) {
            // Only show error for non-silent refreshes
            if (!isSilentRefresh) {
                setError(err instanceof Error ? err.message : 'An error occurred')
            } else {
                console.error('[FileList] Silent refresh failed:', err)
            }
        } finally {
            if (!isSilentRefresh) {
                setIsLoading(false)
                setIsRefreshing(false)
            }
        }
    }, [endpoint])

    // Check if any files are still processing
    const hasProcessingFiles = files.some(f => PROCESSING_STATUSES.includes(f.status))

    // Auto-refresh when there are processing files
    useEffect(() => {
        if (hasProcessingFiles && autoRefreshInterval > 0) {
            // Clear any existing timer
            if (autoRefreshTimerRef.current) {
                clearInterval(autoRefreshTimerRef.current)
            }
            
            // Set up auto-refresh with silent mode (no loading indicators, no screen flash)
            autoRefreshTimerRef.current = setInterval(() => {
                fetchFiles(false, true) // Silent refresh
            }, autoRefreshInterval)
            
            console.log(`[FileList] Auto-refresh enabled (every ${autoRefreshInterval / 1000}s) for processing files`)
        } else {
            // Clear timer if no processing files
            if (autoRefreshTimerRef.current) {
                clearInterval(autoRefreshTimerRef.current)
                autoRefreshTimerRef.current = null
                console.log('[FileList] Auto-refresh disabled - no processing files')
            }
        }
        
        return () => {
            if (autoRefreshTimerRef.current) {
                clearInterval(autoRefreshTimerRef.current)
            }
        }
    }, [hasProcessingFiles, autoRefreshInterval, fetchFiles])

    useEffect(() => {
        fetchFiles(false, false) // Initial fetch with loading indicator
    }, [fetchFiles])

    const handleRefresh = () => {
        fetchFiles(true, false) // Manual refresh shows indicator
    }

    const handleDeleteClick = (file: DataHubFile, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        setFileToDelete(file)
        setShowDeleteConfirm(true)
    }

    const handleDeleteConfirm = async () => {
        if (!fileToDelete) return

        try {
            setDeletingId(fileToDelete.id)
            setShowDeleteConfirm(false)

            const response = await fetch(`${endpoint}/${fileToDelete.id}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                throw new Error('Failed to delete file')
            }

            setFiles(prev => prev.filter(f => f.id !== fileToDelete.id))
            setFileToDelete(null)
        } catch (err) {
            console.error('Error deleting file:', err)
            setError(err instanceof Error ? err.message : 'Failed to delete file')
        } finally {
            setDeletingId(null)
        }
    }

    const handleDeleteCancel = () => {
        setShowDeleteConfirm(false)
        setFileToDelete(null)
    }

    return {
        files,
        setFiles, // Exposed for optimistic updates from other hooks
        isLoading,
        error,
        isRefreshing,
        deletingId,
        showDeleteConfirm,
        fileToDelete,
        handleRefresh,
        handleDeleteClick,
        handleDeleteConfirm,
        handleDeleteCancel,
    }
}
