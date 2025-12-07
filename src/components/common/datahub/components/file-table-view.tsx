import { File, Image } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { FileItemActions } from '@/components/common/file-item-actions'
import { DataHubFile } from '../types'

interface FileTableViewProps {
    files: DataHubFile[]
    fileType: 'photo' | 'document'
    canEdit: boolean
    canDelete: boolean
    deletingId: string | null
    onEditClick: (file: DataHubFile) => void
    onDeleteClick: (file: DataHubFile) => void
}

export function FileTableView({
    files,
    fileType,
    canEdit,
    canDelete,
    deletingId,
    onEditClick,
    onDeleteClick,
}: FileTableViewProps) {
    const getTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
            manual: 'Manual',
            safety: 'Safety',
            sop: 'SOP',
            troubleshooting: 'Troubleshooting',
            other: 'Other',
            // Photo types
            reference: 'Reference',
            profile: 'Profile',
            before: 'Before',
            after: 'After',
            evidence: 'Evidence',
        }
        return labels[type] || type
    }

    const getScopeLabel = (scope: string): string => {
        return scope === 'company' ? 'Company-wide' : 'Equipment'
    }

    const getStatusBadgeVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
        const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
            uploaded: 'default',
            analyzing: 'info',
            indexing: 'warning',
            processing: 'warning',
            ready: 'success',
            failed: 'danger',
        }
        // Override for documents if needed, but 'default' is fine for 'uploaded'
        if (fileType === 'document' && status === 'uploaded') return 'info'
        return variants[status] || 'default'
    }

    const getStatusLabel = (status: string): string => {
        const labels: Record<string, string> = {
            uploaded: 'Uploaded',
            analyzing: 'Analyzing...',
            indexing: 'Indexing...',
            processing: 'Processing...',
            ready: 'Ready',
            failed: 'Failed',
        }
        return labels[status] || status
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-900">
                                {fileType === 'document' ? 'Title' : 'File'}
                            </th>
                            <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-900">Type</th>
                            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-900">Equipment</th>
                            <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-900">
                                {fileType === 'document' ? 'Scope' : 'Link'}
                            </th>
                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
                            <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-900">Size</th>
                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {files.map((file) => (
                            <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-3 sm:px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {fileType === 'document' ? (
                                            <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        ) : (
                                            <Image className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate max-w-[120px] sm:max-w-[200px]" title={file.title || file.description}>
                                                {file.title || file.description || 'Untitled'}
                                            </p>
                                            <p className="text-xs text-gray-500 font-mono">
                                                {file.display_id}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="hidden sm:table-cell px-4 py-3">
                                    <span className="text-sm text-gray-700">
                                        {getTypeLabel(file.type || file.link_type || 'other')}
                                    </span>
                                </td>
                                <td className="hidden md:table-cell px-4 py-3">
                                    {file.equipment ? (
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]" title={file.equipment.name}>
                                                {file.equipment.name}
                                            </p>
                                            <p className="text-xs text-gray-500 font-mono">
                                                {file.equipment.display_id}
                                            </p>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-gray-400 italic">-</span>
                                    )}
                                </td>
                                <td className="hidden lg:table-cell px-4 py-3">
                                    {fileType === 'document' ? (
                                        <Badge variant="info" size="sm">
                                            {getScopeLabel(file.scope || 'company')}
                                        </Badge>
                                    ) : (
                                        file.work_order ? (
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]" title={file.work_order.title}>
                                                    {file.work_order.title}
                                                </p>
                                                <p className="text-xs text-gray-500 font-mono">
                                                    {file.work_order.display_id}
                                                </p>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400 italic">-</span>
                                        )
                                    )}
                                </td>
                                <td className="px-3 sm:px-4 py-3">
                                    <Badge variant={getStatusBadgeVariant(file.status)} size="sm">
                                        {getStatusLabel(file.status)}
                                    </Badge>
                                </td>
                                <td className="hidden sm:table-cell px-4 py-3">
                                    <span className="text-sm text-gray-700">
                                        {(file.file_size / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                </td>
                                <td className="px-3 sm:px-4 py-3">
                                    <FileItemActions
                                        fileUrl={file.file_url}
                                        fileName={file.title || file.display_id}
                                        status={file.status}
                                        canEdit={canEdit}
                                        canDelete={canDelete}
                                        isDeleting={deletingId === file.id}
                                        onEdit={() => onEditClick(file)}
                                        onDelete={() => onDeleteClick(file)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
