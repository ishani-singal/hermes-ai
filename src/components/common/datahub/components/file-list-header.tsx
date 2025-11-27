import { Plus, RefreshCw, Grid3x3, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ViewMode } from '../types'

interface FileListHeaderProps {
    title: string
    count: number
    viewMode?: ViewMode
    onViewModeChange?: (mode: ViewMode) => void
    onRefresh: () => void
    onCreateClick: () => void
    isRefreshing: boolean
    canCreate: boolean
    createButtonText: string
}

export function FileListHeader({
    title,
    count,
    viewMode,
    onViewModeChange,
    onRefresh,
    onCreateClick,
    isRefreshing,
    canCreate,
    createButtonText,
}: FileListHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">
                    {title}
                </h2>
                <p className="text-sm text-gray-500">
                    {count} {count === 1 ? title.slice(0, -1).toLowerCase() : title.toLowerCase()}
                </p>
            </div>
            <div className="flex gap-2">
                {/* View Mode Toggle (only if viewMode is provided) */}
                {viewMode && onViewModeChange && (
                    <div className="flex border border-gray-300 rounded-md">
                        <button
                            onClick={() => onViewModeChange('grid')}
                            className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'grid'
                                ? 'bg-brand text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                } rounded-l-md`}
                            title="Grid view"
                        >
                            <Grid3x3 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => onViewModeChange('list')}
                            className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'list'
                                ? 'bg-brand text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                } rounded-r-md border-l border-gray-300`}
                            title="List view"
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    isLoading={isRefreshing}
                >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>

                {canCreate && (
                    <Button size="sm" onClick={onCreateClick}>
                        <Plus className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">{createButtonText}</span>
                        <span className="sm:hidden">Upload</span>
                    </Button>
                )}
            </div>
        </div>
    )
}
