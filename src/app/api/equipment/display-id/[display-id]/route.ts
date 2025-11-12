/**
 * GET /api/equipment/display-id/[display-id] - Get single equipment by display_id
 * PATCH /api/equipment/display-id/[display-id] - Update equipment by display_id
 * DELETE /api/equipment/display-id/[display-id] - Delete equipment by display_id
 * 
 * Public-facing endpoints that use display_id (e.g., EQ-ACME-0001)
 * Query directly by display_id with company_id verification
 * 
 * Primary use: AI agents that reference equipment by display_id
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, notFound, forbidden } from '@/lib/auth/middleware';
import * as helpers from '@/lib/auth/helpers';
import type { Equipment, UpdateEquipmentRequest } from '@/types';

// =============================================
// GET - Get Single Equipment by display_id
// =============================================

export const GET = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createServiceRoleClient();

    // Fetch equipment using display_id
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('display_id', params['display-id'])
      .eq('company_id', user!.companyId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching equipment:', error);
      return badRequest(error.message);
    }

    if (!data) {
      return notFound('Equipment not found');
    }

    return success<Equipment>(data as Equipment);
  });

// =============================================
// PATCH - Update Equipment by display_id
// =============================================

export const PATCH = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;

    // Check if user can update equipment
    if (!helpers.canPerformAction(user!, 'update', 'equipment')) {
      return forbidden('You do not have permission to update equipment');
    }

    const supabase = createServiceRoleClient();

    // Parse request body
    const body: UpdateEquipmentRequest = await request.json();

    // Validate field permissions (if not admin, check allowed fields)
    if (!helpers.isAdmin(user!)) {
      const requestedFields = Object.keys(body);
      const forbiddenFields = helpers.checkForbiddenFields(
        user!,
        'equipment',
        requestedFields
      );

      if (forbiddenFields.length > 0) {
        return forbidden(
          `You do not have permission to update: ${forbiddenFields.join(', ')}`
        );
      }
    }

    // Validate field lengths
    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length === 0) {
        return badRequest('Name cannot be empty');
      }
      if (body.name.length > 255) {
        return badRequest('Name must be 255 characters or less');
      }
    }

    if (body.type !== undefined && body.type && body.type.length > 100) {
      return badRequest('Type must be 100 characters or less');
    }

    if (body.manufacturer !== undefined && body.manufacturer && body.manufacturer.length > 255) {
      return badRequest('Manufacturer must be 255 characters or less');
    }

    if (body.model !== undefined && body.model && body.model.length > 255) {
      return badRequest('Model must be 255 characters or less');
    }

    if (body.serial_number !== undefined && body.serial_number && body.serial_number.length > 255) {
      return badRequest('Serial number must be 255 characters or less');
    }

    if (body.location !== undefined && body.location && body.location.length > 255) {
      return badRequest('Location must be 255 characters or less');
    }

    // Check for duplicate serial number if updating serial_number
    if (body.serial_number) {
      const { data: existingEquipment } = await supabase
        .from('equipment')
        .select('id, display_id')
        .eq('company_id', user!.companyId)
        .eq('serial_number', body.serial_number)
        .neq('display_id', params['display-id'])
        .maybeSingle();

      if (existingEquipment) {
        return badRequest('Equipment with this serial number already exists');
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type || null;
    if (body.manufacturer !== undefined) updateData.manufacturer = body.manufacturer || null;
    if (body.model !== undefined) updateData.model = body.model || null;
    if (body.serial_number !== undefined) updateData.serial_number = body.serial_number || null;
    if (body.location !== undefined) updateData.location = body.location || null;
    if (body.metadata !== undefined) updateData.metadata = body.metadata || {};

    // Update equipment using display_id
    const { error: updateError } = await supabase
      .from('equipment')
      .update(updateData)
      .eq('display_id', params['display-id'])
      .eq('company_id', user!.companyId);

    if (updateError) {
      console.error('Error updating equipment:', updateError);
      return badRequest(updateError.message);
    }

    // Fetch updated equipment
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('display_id', params['display-id'])
      .eq('company_id', user!.companyId)
      .maybeSingle();

    if (error || !data) {
      return notFound('Equipment not found after update');
    }

    return success<Equipment>(data as Equipment);
  });

// =============================================
// DELETE - Delete Equipment by display_id (Admin-only)
// =============================================

export const DELETE = route()
  .auth()
  .requireAdmin()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createServiceRoleClient();

    // Check if equipment is linked to any work orders
    const { data: linkedWorkOrders } = await supabase
      .from('work_orders')
      .select('id, display_id')
      .eq('company_id', user!.companyId)
      .eq('equipment_id', (
        await supabase
          .from('equipment')
          .select('id')
          .eq('display_id', params['display-id'])
          .eq('company_id', user!.companyId)
          .maybeSingle()
      ).data?.id || '')
      .limit(1);

    if (linkedWorkOrders && linkedWorkOrders.length > 0) {
      return badRequest(
        'Cannot delete equipment that is linked to work orders. Remove work order links first.'
      );
    }

    // Delete equipment using display_id
    // Note: Related documents will be automatically archived by the database trigger
    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('display_id', params['display-id'])
      .eq('company_id', user!.companyId);

    if (error) {
      console.error('Error deleting equipment:', error);
      return badRequest(error.message);
    }

    return success({ 
      success: true, 
      message: 'Equipment deleted. Associated documents have been archived.' 
    });
  });
