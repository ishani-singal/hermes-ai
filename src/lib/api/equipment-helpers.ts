/**
 * Equipment API Helper Functions
 *
 * Centralized logic for:
 * - Building queries for equipment data
 * - Resolving display_id to actual UUID
 * - Listing associated documents
 * - CSV import/export utilities
 * - Validation and metadata detection
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Equipment, Document, CreateEquipmentRequest } from '@/types';

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

// =============================================
// Field Length Constants
// =============================================

export const EQUIPMENT_FIELD_LIMITS = {
  name: 255,
  type: 100,
  manufacturer: 255,
  model: 255,
  serial_number: 255,
  location: 255,
} as const;

// Standard columns for CSV export/import (in order)
export const EQUIPMENT_CSV_COLUMNS = [
  'name',
  'type',
  'manufacturer',
  'model',
  'serial_number',
  'location',
] as const;

// Import limits
export const EQUIPMENT_IMPORT_LIMITS = {
  maxRows: 100,
  maxFileSize: 1024 * 1024, // 1MB
} as const;

// =============================================
// Validation Types
// =============================================

export interface EquipmentValidationError {
  field: string;
  message: string;
}

export interface ValidatedEquipmentRow {
  row: number;
  data: CreateEquipmentRequest | null;
  errors: EquipmentValidationError[];
  isValid: boolean;
}

// =============================================
// Validation Functions
// =============================================

/**
 * Validate a single equipment field
 */
export function validateEquipmentField(
  field: keyof typeof EQUIPMENT_FIELD_LIMITS,
  value: string | undefined | null,
  required: boolean = false
): EquipmentValidationError | null {
  const trimmedValue = value?.trim();

  if (required && (!trimmedValue || trimmedValue.length === 0)) {
    return { field, message: `${field} is required` };
  }

  if (trimmedValue && trimmedValue.length > EQUIPMENT_FIELD_LIMITS[field]) {
    return {
      field,
      message: `${field} must be ${EQUIPMENT_FIELD_LIMITS[field]} characters or less`,
    };
  }

  return null;
}

/**
 * Validate a complete equipment record for creation
 */
export function validateEquipmentData(
  data: Record<string, unknown>
): { isValid: boolean; errors: EquipmentValidationError[]; data: CreateEquipmentRequest | null } {
  const errors: EquipmentValidationError[] = [];

  // Validate required field: name
  const nameError = validateEquipmentField('name', data.name as string, true);
  if (nameError) errors.push(nameError);

  // Validate optional fields
  const optionalFields = ['type', 'manufacturer', 'model', 'serial_number', 'location'] as const;
  for (const field of optionalFields) {
    const error = validateEquipmentField(field, data[field] as string, false);
    if (error) errors.push(error);
  }

  if (errors.length > 0) {
    return { isValid: false, errors, data: null };
  }

  // Build validated request object
  const validatedData: CreateEquipmentRequest = {
    name: (data.name as string).trim(),
    type: (data.type as string)?.trim() || undefined,
    manufacturer: (data.manufacturer as string)?.trim() || undefined,
    model: (data.model as string)?.trim() || undefined,
    serial_number: (data.serial_number as string)?.trim() || undefined,
    location: (data.location as string)?.trim() || undefined,
  };

  // Handle metadata - any extra columns become metadata
  const standardColumns = new Set([...EQUIPMENT_CSV_COLUMNS]);
  const metadata: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (!standardColumns.has(key as typeof EQUIPMENT_CSV_COLUMNS[number]) && value !== undefined && value !== '') {
      metadata[key] = value;
    }
  }

  if (Object.keys(metadata).length > 0) {
    validatedData.metadata = metadata;
  }

  return { isValid: true, errors: [], data: validatedData };
}

// =============================================
// Metadata Detection
// =============================================

/**
 * Get all unique metadata keys used across equipment for a company.
 * This queries all equipment and extracts the top-level keys from metadata JSONB.
 */
export async function getCompanyMetadataKeys(
  supabase: SupabaseClient,
  companyId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select('metadata')
    .eq('company_id', companyId)
    .not('metadata', 'is', null);

  if (error || !data) {
    console.error('Error fetching equipment metadata:', error);
    return [];
  }

  // Collect all unique keys across all equipment metadata
  const keysSet = new Set<string>();
  
  for (const row of data) {
    if (row.metadata && typeof row.metadata === 'object') {
      for (const key of Object.keys(row.metadata as Record<string, unknown>)) {
        keysSet.add(key);
      }
    }
  }

  return Array.from(keysSet).sort();
}

// =============================================
// CSV Generation Utilities
// =============================================

/**
 * Escape a CSV field value (handles quotes and commas)
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Generate CSV header row
 */
export function generateCsvHeader(metadataKeys: string[] = []): string {
  const columns = [...EQUIPMENT_CSV_COLUMNS, ...metadataKeys];
  return columns.join(',');
}

/**
 * Generate CSV instruction row (commented with #)
 */
export function generateCsvInstructionRow(metadataKeys: string[] = []): string {
  const standardExample = '# Example: Kitchen Oven,Oven,GE,JB645RKSS,SN-12345,Building A Floor 1';
  const metadataPlaceholders = metadataKeys.map(() => '').join(',');
  return metadataPlaceholders ? `${standardExample},${metadataPlaceholders}` : standardExample;
}

/**
 * Convert equipment record to CSV row
 */
export function equipmentToCsvRow(equipment: Equipment, metadataKeys: string[] = []): string {
  const standardFields = EQUIPMENT_CSV_COLUMNS.map(col => 
    escapeCsvField(equipment[col as keyof Equipment])
  );
  
  const metadataFields = metadataKeys.map(key => 
    escapeCsvField((equipment.metadata as Record<string, unknown>)?.[key])
  );
  
  return [...standardFields, ...metadataFields].join(',');
}

/**
 * Generate complete CSV content for equipment export
 */
export function generateEquipmentCsv(
  equipment: Equipment[],
  metadataKeys: string[] = [],
  includeInstructionRow: boolean = true
): string {
  const lines: string[] = [];
  
  // Header row
  lines.push(generateCsvHeader(metadataKeys));
  
  // Instruction row (commented)
  if (includeInstructionRow) {
    lines.push(generateCsvInstructionRow(metadataKeys));
  }
  
  // Data rows
  for (const eq of equipment) {
    lines.push(equipmentToCsvRow(eq, metadataKeys));
  }
  
  return lines.join('\n');
}

/**
 * Generate empty CSV template for equipment import
 */
export function generateEquipmentCsvTemplate(metadataKeys: string[] = []): string {
  const lines: string[] = [];
  
  // Header row
  lines.push(generateCsvHeader(metadataKeys));
  
  // Instruction row (commented)
  lines.push(generateCsvInstructionRow(metadataKeys));
  
  return lines.join('\n');
}

// =============================================
// Duplicate Detection
// =============================================

/**
 * Get existing serial numbers for a company
 */
export async function getExistingSerialNumbers(
  supabase: SupabaseClient,
  companyId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('equipment')
    .select('serial_number')
    .eq('company_id', companyId)
    .not('serial_number', 'is', null);

  if (error || !data) {
    console.error('Error fetching serial numbers:', error);
    return new Set();
  }

  return new Set(
    data
      .map(row => row.serial_number?.toLowerCase())
      .filter((sn): sn is string => sn !== null && sn !== undefined)
  );
}

// =============================================
// Import Result Types
// =============================================

export interface EquipmentImportRowResult {
  row: number;
  name: string;
  serial_number?: string;
  status: 'created' | 'skipped' | 'error';
  equipment_id?: string;
  display_id?: string;
  reason?: string;
}

export interface EquipmentImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: number;
  results: EquipmentImportRowResult[];
}
