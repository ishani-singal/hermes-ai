export interface DataHubFile {
    id: string
    company_id: string
    equipment_id?: string | null
    work_order_id?: string | null
    display_id: string
    title?: string // For documents
    description?: string // For photos
    file_url: string
    file_size: number
    type?: string // For documents
    link_type?: string // For photos
    scope?: string // For documents
    status: 'uploaded' | 'processing' | 'ready' | 'failed'
    created_at: string
    updated_at: string
    equipment?: {
        id: string
        display_id: string
        name: string
    }
    work_order?: {
        id: string
        display_id: string
        title: string
    }
}

export type ViewMode = 'grid' | 'list'

export interface FileListProps {
    onCreateClick: () => void
    onFileClick?: (file: DataHubFile) => void
    viewMode?: ViewMode
}

export interface EquipmentOption {
    id: string
    display_id: string
    name: string
}

export interface WorkOrderOption {
    id: string
    display_id: string
    title: string
}
