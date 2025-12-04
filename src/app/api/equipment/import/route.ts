/**
 * POST /api/equipment/import - Import equipment from CSV
 * 
 * Accepts: multipart/form-data with 'file' field containing CSV file
 * 
 * Behavior:
 * - Creates new equipment only (no updates)
 * - Skips rows with duplicate serial_number (reports as skipped)
 * - Skips comment rows starting with #
 * - Max 100 rows per import
 * - Extra columns are stored in metadata JSONB
 * 
 * Authorization: Admin and Editor roles only
 */

import { NextRequest } from 'next/server';
import Papa from 'papaparse';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, forbidden } from '@/lib/auth/middleware';
import * as helpers from '@/lib/auth/helpers';
import {
  validateEquipmentData,
  getExistingSerialNumbers,
  EQUIPMENT_IMPORT_LIMITS,
  type EquipmentImportResult,
  type EquipmentImportRowResult,
} from '@/lib/api/equipment-helpers';
import type { Equipment } from '@/types';

export const POST = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user } = context;

    // Check if user can create equipment
    if (!helpers.canPerformAction(user!, 'create', 'equipment')) {
      return forbidden('You do not have permission to import equipment');
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return badRequest('No file provided');
    }

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return badRequest('File must be a CSV file');
    }

    // Validate file size
    if (file.size > EQUIPMENT_IMPORT_LIMITS.maxFileSize) {
      return badRequest(`File size must be less than ${EQUIPMENT_IMPORT_LIMITS.maxFileSize / 1024 / 1024}MB`);
    }

    // Read file content
    const fileContent = await file.text();

    // Parse CSV
    const parseResult = Papa.parse<Record<string, string>>(fileContent, {
      header: true,
      skipEmptyLines: true,
      comments: '#', // Skip lines starting with #
      transformHeader: (header) => header.trim().toLowerCase(),
    });

    if (parseResult.errors.length > 0) {
      const errorMessages = parseResult.errors
        .slice(0, 5) // Show max 5 errors
        .map(e => `Row ${e.row}: ${e.message}`)
        .join('; ');
      return badRequest(`CSV parsing errors: ${errorMessages}`);
    }

    const rows = parseResult.data;

    // Validate row count
    if (rows.length === 0) {
      return badRequest('CSV file has no data rows');
    }

    if (rows.length > EQUIPMENT_IMPORT_LIMITS.maxRows) {
      return badRequest(`Maximum ${EQUIPMENT_IMPORT_LIMITS.maxRows} rows allowed. Found ${rows.length} rows.`);
    }

    const supabase = createServiceRoleClient();

    // Get existing serial numbers to detect duplicates
    const existingSerialNumbers = await getExistingSerialNumbers(supabase, user!.companyId);

    // Track serial numbers within this import to detect duplicates within the file
    const importSerialNumbers = new Set<string>();

    const results: EquipmentImportRowResult[] = [];
    const equipmentToCreate: Array<{
      row: number;
      data: ReturnType<typeof validateEquipmentData>['data'];
    }> = [];

    // Validate all rows first
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 because: 1-indexed and skip header row
      const row = rows[i];

      // Validate row data
      const validation = validateEquipmentData(row);

      if (!validation.isValid || !validation.data) {
        results.push({
          row: rowNumber,
          name: row.name || '(empty)',
          serial_number: row.serial_number,
          status: 'error',
          reason: validation.errors.map(e => e.message).join(', '),
        });
        continue;
      }

      const serialNumber = validation.data.serial_number?.toLowerCase();

      // Check for duplicate serial number in existing equipment
      if (serialNumber && existingSerialNumbers.has(serialNumber)) {
        results.push({
          row: rowNumber,
          name: validation.data.name,
          serial_number: validation.data.serial_number,
          status: 'skipped',
          reason: 'Serial number already exists',
        });
        continue;
      }

      // Check for duplicate serial number within this import file
      if (serialNumber && importSerialNumbers.has(serialNumber)) {
        results.push({
          row: rowNumber,
          name: validation.data.name,
          serial_number: validation.data.serial_number,
          status: 'skipped',
          reason: 'Duplicate serial number in import file',
        });
        continue;
      }

      // Track this serial number
      if (serialNumber) {
        importSerialNumbers.add(serialNumber);
      }

      // Add to batch for creation
      equipmentToCreate.push({ row: rowNumber, data: validation.data });
    }

    // Create equipment in batch
    if (equipmentToCreate.length > 0) {
      const insertData = equipmentToCreate.map(item => ({
        company_id: user!.companyId,
        name: item.data!.name,
        type: item.data!.type || null,
        manufacturer: item.data!.manufacturer || null,
        model: item.data!.model || null,
        serial_number: item.data!.serial_number || null,
        location: item.data!.location || null,
        metadata: item.data!.metadata || {},
      }));

      const { data: createdEquipment, error: insertError } = await supabase
        .from('equipment')
        .insert(insertData)
        .select();

      if (insertError) {
        console.error('Error creating equipment batch:', insertError);
        
        // Mark all pending as error
        for (const item of equipmentToCreate) {
          results.push({
            row: item.row,
            name: item.data!.name,
            serial_number: item.data!.serial_number,
            status: 'error',
            reason: insertError.message,
          });
        }
      } else {
        // Map created equipment back to rows
        const created = (createdEquipment || []) as Equipment[];
        
        for (let i = 0; i < equipmentToCreate.length; i++) {
          const item = equipmentToCreate[i];
          const equipment = created[i];
          
          results.push({
            row: item.row,
            name: item.data!.name,
            serial_number: item.data!.serial_number,
            status: 'created',
            equipment_id: equipment?.id,
            display_id: equipment?.display_id,
          });
        }
      }
    }

    // Sort results by row number
    results.sort((a, b) => a.row - b.row);

    // Calculate summary
    const summary: EquipmentImportResult = {
      total: rows.length,
      created: results.filter(r => r.status === 'created').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
      results,
    };

    return success(summary);
  });
