import { useState, useCallback, useEffect } from 'react'
import { DataHubFile } from '../types'

interface UseFileListProps {
    endpoint: string
    bucketId?: string // 'documents' or 'photos' (for delete logic if needed specific handling)
}

export function useFileList({ endpoint }: UseFileListProps) {
    const [files, setFiles] = useState<DataHubFile[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [fileToDelete, setFileToDelete] = useState<DataHubFile | null>(null)

    const fetchFiles = useCallback(async (showRefreshIndicator = false) => {
        try {
            if (showRefreshIndicator) {
                setIsRefreshing(true)
            } else {
                setIsLoading(true)
            }
            setError(null)

            const response = await fetch(endpoint)

            if (!response.ok) {
                throw new Error('Failed to fetch files')
            }

            const data = await response.json()
            setFiles(data.data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }, [endpoint])

    useEffect(() => {
        fetchFiles()
    }, [fetchFiles])

    const handleRefresh = () => {
        fetchFiles(true)
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
