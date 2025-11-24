/**
 * Equipment API Helper Functions
 *
 * Centralized logic for:
 * - Building queries for equipment data
 * - Resolving display_id to actual UUID
 * - Listing associated documents
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Equipment, Document } from '@/types';

/**
 * Resolve equipment by either UUID id or display_id
 *
 * @param supabase - Supabase client
 * @param companyId - Company UUID (for data isolation)
 * @param equipmentRef - Either UUID or display_id string
 * @returns Equipment record or null if not found
 */
export async function resolveEquipmentId(
  supabase: SupabaseClient,
  companyId: string,
  equipmentRef: string
): Promise<Equipment | null> {
  // First try exact match on display_id (user-facing reference)
  const { data: displayIdMatch } = await supabase
    .from('equipment')
    .select('*')
    .eq('company_id', companyId)
    .eq('display_id', equipmentRef.toUpperCase())
    .maybeSingle();

  if (displayIdMatch) {
    return displayIdMatch as Equipment;
  }

  // Then try UUID match (internal reference)
  const { data: uuidMatch } = await supabase
    .from('equipment')
    .select('*')
    .eq('company_id', companyId)
    .eq('id', equipmentRef)
    .maybeSingle();

  return (uuidMatch as Equipment) || null;
}

/**
 * Get equipment with associated documents
 *
 * @param supabase - Supabase client
 * @param companyId - Company UUID
 * @param equipmentId - Equipment UUID
 * @returns Equipment with linked documents
 */
export async function getEquipmentWithDocuments(
  supabase: SupabaseClient,
  companyId: string,
  equipmentId: string
): Promise<(Equipment & { documents?: Document[] }) | null> {
  // Get equipment
  const { data: equipment } = await supabase
    .from('equipment')
    .select('*')
    .eq('company_id', companyId)
    .eq('id', equipmentId)
    .maybeSingle();

  if (!equipment) return null;

  // Get associated documents (both equipment-specific and company-wide)
  const { data: documents } = await supabase
    .from('files')
    .select('*')
    .eq('bucket_id', 'documents')
    .eq('company_id', companyId)
    .or(`equipment_id.eq.${equipmentId},scope.eq.company`)
    .eq('archived_at', null) // Exclude archived documents
    .order('created_at', { ascending: false });

  return {
    ...(equipment as Equipment),
    documents: (documents || []) as Document[],
  };
}

/**
 * List equipment for a company with pagination
 *
 * @param supabase - Supabase client
 * @param companyId - Company UUID
 * @param options - Pagination and filter options
 * @returns Equipment list with pagination info
 */
export async function listEquipment(
  supabase: SupabaseClient,
  companyId: string,
  options: {
    search?: string;
    type?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{
  data: Equipment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const page = options.page || 1;
  const limit = options.limit || 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('equipment')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId);

  // Apply filters
  if (options.search) {
    const searchTerm = `%${options.search}%`;
    query = query.or(
      `name.ilike.${searchTerm},manufacturer.ilike.${searchTerm},model.ilike.${searchTerm},serial_number.ilike.${searchTerm},display_id.ilike.${searchTerm}`
    );
  }

  if (options.type) {
    query = query.eq('type', options.type);
  }

  // Execute query with pagination
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: (data || []) as Equipment[],
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Type guard for Equipment
 */
export function isEquipment(data: unknown): data is Equipment {
  return (
    data !== null &&
    typeof data === 'object' &&
    'id' in data &&
    'company_id' in data &&
    'display_id' in data &&
    'name' in data
  );
}
