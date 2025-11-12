/**
 * Equipment Types
 */

export interface Equipment {
  id: string;
  company_id: string;
  display_id: string;
  name: string;
  type?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  location?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateEquipmentRequest {
  name: string;
  type?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateEquipmentRequest {
  name?: string;
  type?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}

export interface EquipmentListFilters {
  search?: string;
  type?: string;
  manufacturer?: string;
  page?: number;
  limit?: number;
}

export interface EquipmentListResponse {
  data: Equipment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: EquipmentListFilters;
}
