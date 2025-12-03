/**
 * Document Types
 */

export type DocumentType = 'manual' | 'safety' | 'sop' | 'troubleshooting' | 'other';
export type DocumentScope = 'company' | 'equipment';
// Document status tracks the full processing lifecycle:
// uploaded -> analyzing (AI summary) -> indexing (RAG) -> ready
export type DocumentStatus = 'uploaded' | 'analyzing' | 'indexing' | 'ready' | 'failed';

/**
 * Extracted equipment information from document analysis
 */
export interface ExtractedEquipmentInfo {
  name?: string;
  manufacturer?: string;
  model?: string;
  type?: string;
  serial_number?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface Document {
  id: string;
  company_id: string;
  equipment_id?: string;
  display_id: string;
  title: string;
  type: DocumentType;
  scope: DocumentScope;
  file_url: string;
  file_size: number;
  page_count?: number;
  status: DocumentStatus;
  archived_at?: string; // null if not archived, ISO timestamp if archived
  archive_reason?: string; // e.g., 'equipment_deleted', 'manual_archive'
  created_at: string;
  updated_at: string;
  // Joined relation (when fetched with equipment join)
  equipment?: {
    id: string;
    display_id: string;
    name: string;
  } | null;
}

export interface CreateDocumentRequest {
  title: string;
  type: DocumentType;
  scope: DocumentScope;
  equipment_id?: string;
  file: File;
}

export interface DocumentUploadResponse {
  documentId: string;
  status: DocumentStatus;
  message: string;
}

export interface DocumentListFilters {
  equipment_id?: string;
  work_order_id?: string;
  type?: DocumentType;
  scope?: DocumentScope;
  status?: DocumentStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DocumentListResponse {
  data: Document[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: DocumentListFilters;
}

/**
 * Document chunk as stored in Pinecone
 * (Not in Supabase - for reference only)
 */
export interface PineconeDocumentMetadata {
  company_id: string;
  document_id: string;
  document_title: string;
  document_type: DocumentType;
  equipment_id?: string;
  equipment_name?: string;
  scope: DocumentScope;
  page_number: number;
  chunk_index: number;
  chunk_text: string;
  created_at: string;
}
