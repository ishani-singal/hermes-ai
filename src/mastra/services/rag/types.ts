/**
 * RAG Service Types
 * 
 * Shared types for all RAG operations (indexing, retrieval)
 */

// ============================================
// CONTENT TYPES
// ============================================

export type ContentType = 'document' | 'photo' | 'video' | 'chat';

export type FileStatus = 'uploaded' | 'analyzing' | 'indexing' | 'ready' | 'failed';

// ============================================
// INDEXING TYPES
// ============================================

export interface IndexDocumentParams {
  documentId: string;
  companyId: string;
  documentTitle: string;
  documentType: string;
  equipmentId?: string;
  equipmentName?: string;
  workOrderId?: string;
  workOrderTitle?: string;
  scope: 'company' | 'equipment';
  fileUrl: string;
}

export interface IndexPhotoParams {
  photoId: string;
  companyId: string;
  fileUrl: string;
  content?: string;  // Pre-extracted description from vision analysis
  equipmentId?: string;
  equipmentName?: string;
  workOrderId?: string;
  workOrderTitle?: string;
}

/**
 * Generic content indexing params - used by the router function
 */
export interface IndexContentParams {
  type: ContentType;
  resourceId: string;
  companyId: string;
  fileUrl?: string;
  content?: string;  // Pre-extracted text (for photo descriptions)
  metadata: Record<string, unknown>;
  // Document-specific fields (used when type === 'document')
  documentTitle?: string;
  documentType?: string;
  scope?: 'company' | 'equipment';
}

// ============================================
// SEARCH/RETRIEVAL TYPES
// ============================================

export interface SearchParams {
  query: string;
  companyId: string;
  equipmentId?: string;
  documentType?: string;
  topK?: number;
}

export interface SearchResult {
  text: string;
  documentTitle?: string;
  documentType?: string;
  pageNumber?: number;
  score: number;
  resourceId: string;
  resourceType: ContentType;
  equipmentId?: string;
  equipmentName?: string;
}

// ============================================
// PINECONE RECORD TYPES
// ============================================

export interface PineconeRecord {
  _id: string;
  text: string;
  company_id: string;
  resource_id: string;
  resource_type: ContentType;
  chunk_index: number;
  created_at: string;
  // Optional fields
  document_title?: string;
  document_type?: string;
  scope?: string;
  equipment_id?: string;
  equipment_name?: string;
  work_order_id?: string;
  work_order_title?: string;
}

// ============================================
// ANALYSIS RESULT TYPES
// ============================================

export interface DocumentAnalysisResult {
  summary: string;
  documentType: string;
  extractedEquipment?: {
    name?: string;
    manufacturer?: string;
    model?: string;
    type?: string;
    serial_number?: string;
    confidence: number;
  };
  wasSmartTruncated: boolean;
}

export interface PhotoAnalysisResult {
  description: string;
  detectedObjects?: string[];
  sceneType?: string;
}
