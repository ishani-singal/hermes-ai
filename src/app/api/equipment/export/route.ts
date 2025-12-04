/**
 * GET /api/equipment/export - Export equipment to CSV
 * 
 * Query parameters:
 * - template=true: Return empty template (headers + instruction row only)
 * - Otherwise: Export all equipment data
 * 
 * Authorization: Authenticated users only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { badRequest } from '@/lib/auth/middleware';
import {
  getCompanyMetadataKeys,
  generateEquipmentCsv,
  generateEquipmentCsvTemplate,
} from '@/lib/api/equipment-helpers';
import type { Equipment } from '@/types';

export const GET = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user } = context;
    const { searchParams } = new URL(request.url);
    
    const isTemplate = searchParams.get('template') === 'true';
    
    const supabase = createServiceRoleClient();
    
    // Get metadata keys in use for this company
    const metadataKeys = await getCompanyMetadataKeys(supabase, user!.companyId);
    
    let csvContent: string;
    let filename: string;
    
    if (isTemplate) {
      // Generate empty template
      csvContent = generateEquipmentCsvTemplate(metadataKeys);
      filename = 'equipment-import-template.csv';
    } else {
      // Fetch all equipment for the company
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('company_id', user!.companyId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching equipment for export:', error);
        return badRequest(error.message);
      }
      
      const equipment = (data || []) as Equipment[];
      csvContent = generateEquipmentCsv(equipment, metadataKeys, true);
      filename = `equipment-export-${new Date().toISOString().split('T')[0]}.csv`;
    }
    
    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  });
