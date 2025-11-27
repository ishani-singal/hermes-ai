/**
 * Photo Types
 */

export type PhotoStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export type PhotoLinkType = 'profile' | 'reference' | 'before' | 'after' | 'evidence' | 'other';

export interface Photo {
    id: string;
    company_id: string;
    equipment_id?: string;
    work_order_id?: string;
    display_id: string;
    description?: string;
    file_url: string;
    file_size: number;
    link_type?: PhotoLinkType;
    status: PhotoStatus;
    created_at: string;
    updated_at: string;
    // Joined relations
    equipment?: {
        id: string;
        display_id: string;
        name: string;
    } | null;
    work_order?: {
        id: string;
        display_id: string;
        title: string;
    } | null;
}

export interface CreatePhotoRequest {
    description?: string;
    equipment_id?: string;
    work_order_id?: string;
    link_type?: PhotoLinkType;
    file: File;
}

export interface PhotoListResponse {
    data: Photo[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
