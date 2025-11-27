'use client'

import { Download, Trash2, Edit } from 'lucide-react'

export interface FileItemActionsProps {
    fileUrl?: string
    fileName: string
    status?: string
    canEdit?: boolean
    canDelete?: boolean
    isDeleting?: boolean
    onEdit?: () => void
    onDelete?: () => void
}

export function FileItemActions({
    fileUrl,
    fileName,
    status,
    canEdit = false,
    canDelete = false,
    isDeleting = false,
    onEdit,
    onDelete,
}: FileItemActionsProps) {
    return (
        <div className="flex items-center gap-1">
            {/* Download Button */}
            {fileUrl && (status === 'uploaded' || status === 'ready') && (
                <a
                    href={fileUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center p-2 text-brand hover:bg-brand/10 rounded transition-colors"
                    title={`Download ${fileName}`}
                >
                    <Download className="h-4 w-4" />
                </a>
            )}

            {/* Edit Button */}
            {canEdit && onEdit && (
                <button
                    onClick={onEdit}
                    className="inline-flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Edit"
                >
                    <Edit className="h-4 w-4" />
                </button>
            )}

            {/* Delete Button */}
            {canDelete && onDelete && (
                <button
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            )}
        </div>
    )
}
