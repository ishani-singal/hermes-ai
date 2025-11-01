/**
 * Work Order API Helper Functions
 * 
 * Centralized logic for:
 * - Building queries with JOINs for expanded user/company data
 * - Resolving display_id or GUID to actual GUID
 * - Transforming flat JOIN results to nested structures
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { WorkOrder, WorkOrderUser, WorkOrderCompany } from '@/types';

/**
 * Default select fields with JOINs for work orders
 */
const WORK_ORDER_SELECT_WITH_JOINS = `
  *,
  created_by_user:created_by (
    id,
    email,
    full_name,
    user_id
  ),
  assigned_to_user:assigned_to (
    id,
    email,
    full_name,
    user_id
  ),
  company:company_id (
    id,
    name,
    company_code
  )
`;

/**
 * Build work order query with JOINs for expanded data
 * 
 * @param supabase - Supabase client
 * @param selectFields - Optional custom select fields (defaults to full JOIN query)
 * @returns Query builder with JOINs
 */
export function buildWorkOrderQuery(
  supabase: SupabaseClient,
  selectFields?: string
) {
  return supabase
    .from('work_orders')
    .select(selectFields || WORK_ORDER_SELECT_WITH_JOINS);
}

/**
 * Type guard for work order user data
 */
function isWorkOrderUserData(data: unknown): data is WorkOrderUser {
  return (
    data !== null &&
    typeof data === 'object' &&
    'id' in data &&
    'email' in data &&
    'full_name' in data &&
    'user_id' in data
  );
}

/**
 * Type guard for work order company data
 */
function isWorkOrderCompanyData(data: unknown): data is WorkOrderCompany {
  return (
    data !== null &&
    typeof data === 'object' &&
    'id' in data &&
    'name' in data &&
    'company_code' in data
  );
}

/**
 * Expand work order response from flat JOIN result to nested structure
 * 
 * Transforms Supabase JOIN response with nested foreign key data
 * into the proper WorkOrder interface structure
 * 
 * @param workOrder - Raw work order data from Supabase (with JOINs)
 * @returns Properly structured WorkOrder object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function expandWorkOrderResponse(workOrder: any): WorkOrder {
  const expanded: WorkOrder = {
    id: workOrder.id as string,
    display_id: workOrder.display_id as string,
    company_id: workOrder.company_id as string,
    equipment_id: workOrder.equipment_id as string | undefined,
    title: workOrder.title as string,
    description: workOrder.description as string | undefined,
    status: workOrder.status as WorkOrder['status'],
    priority: workOrder.priority as WorkOrder['priority'],
    created_by: workOrder.created_by as string,
    assigned_to: workOrder.assigned_to as string | undefined,
    due_date: workOrder.due_date as string | undefined,
    completed_at: workOrder.completed_at as string | undefined,
    custom_fields: (workOrder.custom_fields as Record<string, unknown>) || {},
    created_at: workOrder.created_at as string,
    updated_at: workOrder.updated_at as string,
  };

  // Add expanded user data if available
  if (isWorkOrderUserData(workOrder.created_by_user)) {
    expanded.created_by_user = workOrder.created_by_user;
  }

  if (workOrder.assigned_to_user) {
    if (isWorkOrderUserData(workOrder.assigned_to_user)) {
      expanded.assigned_to_user = workOrder.assigned_to_user;
    }
  } else {
    expanded.assigned_to_user = null;
  }

  // Add expanded company data if available
  if (isWorkOrderCompanyData(workOrder.company)) {
    expanded.company = workOrder.company;
  }

  return expanded;
}

/**
 * Expand multiple work order responses
 * 
 * @param workOrders - Array of raw work order data from Supabase
 * @returns Array of properly structured WorkOrder objects
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function expandWorkOrderResponses(workOrders: any[]): WorkOrder[] {
  return workOrders.map(expandWorkOrderResponse);
}

