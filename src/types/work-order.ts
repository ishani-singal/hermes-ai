/**
 * Work Order Types
 */

export type WorkOrderStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical';

export interface WorkOrder {
  id: string;
  company_id: string;
  equipment_id?: string;
  title: string;
  description?: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  created_by: string;
  assigned_to?: string;
  due_date?: string;
  completed_at?: string;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkOrderRequest {
  title: string;
  description?: string;
  equipment_id?: string;
  assigned_to?: string;
  priority?: WorkOrderPriority;
  due_date?: string;
  custom_fields?: Record<string, unknown>;
}

export interface UpdateWorkOrderRequest {
  title?: string;
  description?: string;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  assigned_to?: string;
  due_date?: string;
  equipment_id?: string;
  custom_fields?: Record<string, unknown>;
}

export interface WorkOrderListFilters {
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  assigned_to?: string;
  equipment_id?: string;
  created_by?: string;
  due_before?: string;
  due_after?: string;
  search?: string;
  sort?: 'created_at' | 'updated_at' | 'due_date' | 'priority';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface WorkOrderListResponse {
  data: WorkOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: WorkOrderListFilters;
}

export interface WorkOrderSummary {
  total: number;
  by_status: Record<WorkOrderStatus, number>;
  by_priority: Record<WorkOrderPriority, number>;
  overdue_count: number;
  assigned_to_me?: number;
}
