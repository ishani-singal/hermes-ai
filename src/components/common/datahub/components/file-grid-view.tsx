import { Wrench, ClipboardList, Building2, Trash2, Edit } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataHubFile } from '../types'

interface FileGridViewProps {
    files: DataHubFile[]
    onFileClick: (file: DataHubFile) => void
    onEditClick: (file: DataHubFile, e: React.MouseEvent) => void
    onDeleteClick: (file: DataHubFile, e: React.MouseEvent) => void
    canEdit: boolean
    canDelete: boolean
    deletingId: string | null
}

export function FileGridView({
    files,
    onFileClick,
    onEditClick,
    onDeleteClick,
    canEdit,
    canDelete,
    deletingId,
}: FileGridViewProps) {
    // Generate thumbnail URL with size optimization
    const getThumbnailUrl = (url: string) => {
        if (url.includes('supabase')) {
            return `${url}?width=200&height=200&resize=cover`
        }
        return url
    }

    const getStatusBadgeVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
        const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
            uploaded: 'default',
            processing: 'warning',
            ready: 'success',
            failed: 'danger',
        }
        return variants[status] || 'default'
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {files.map((file) => (
                <div
                    key={file.id}
                    className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand transition-all"
                    onClick={() => onFileClick(file)}
                >
                    {/* Thumbnail Image */}
                    <img
                        src={getThumbnailUrl(file.file_url)}
                        alt={file.description || file.title || 'File'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />

                    {/* Overlay with info */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-xs text-white font-mono truncate">
                                {file.display_id}
                            </p>
                        </div>
                    </div>

                    {/* Association Badge */}
                    <div className="absolute top-2 left-2">
                        {file.equipment ? (
                            <Badge variant="default" size="sm" className="bg-white/90 text-gray-700 shadow-sm">
                                <Wrench className="h-3 w-3 mr-1" />
                                <span className="truncate max-w-[60px]">{file.equipment.name}</span>
                            </Badge>
                        ) : file.work_order ? (
                            <Badge variant="default" size="sm" className="bg-white/90 text-gray-700 shadow-sm">
                                <ClipboardList className="h-3 w-3 mr-1" />
                                <span className="truncate max-w-[60px]">WO</span>
                            </Badge>
                        ) : (
                            <Badge variant="default" size="sm" className="bg-white/90 text-gray-700 shadow-sm">
                                <Building2 className="h-3 w-3 mr-1" />
                                <span>Company</span>
                            </Badge>
                        )}
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-2 right-2">
                        <Badge variant={getStatusBadgeVariant(file.status)} size="sm" className="shadow-sm">
                            {file.status}
                        </Badge>
                    </div>

                    {/* Action Buttons (visible on hover) */}
                    <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                            <button
                                onClick={(e) => onEditClick(file, e)}
                                className="p-1.5 bg-white text-gray-700 rounded shadow-sm hover:bg-gray-100 transition-colors"
                                title="Edit file"
                            >
                                <Edit className="h-3.5 w-3.5" />
                            </button>
                        )}

                        {canDelete && (
                            <button
                                onClick={(e) => onDeleteClick(file, e)}
                                disabled={deletingId === file.id}
                                className="p-1.5 bg-red-600 text-white rounded shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                                title="Delete file"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
