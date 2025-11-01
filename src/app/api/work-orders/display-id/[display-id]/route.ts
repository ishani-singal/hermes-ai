/**
 * GET /api/work-orders/display-id/[display-id] - Get single work order by display_id
 * PATCH /api/work-orders/display-id/[display-id] - Update work order by display_id
 * DELETE /api/work-orders/display-id/[display-id] - Delete work order by display_id
 * 
 * Public-facing endpoints that use display_id (e.g., WO-ACME-20251031-001)
 * Query directly by display_id with company_id verification
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, notFound } from '@/lib/auth/middleware';
import type { WorkOrder } from '@/types';
import {
  buildWorkOrderQuery,
  expandWorkOrderResponse,
} from '@/lib/api/work-order-helpers';

// =============================================
// GET - Get Single Work Order by display_id
// =============================================

export const GET = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createServiceRoleClient();

    // Fetch with JOINs for expanded data using display_id
    const { data, error } = await buildWorkOrderQuery(supabase)
      .eq('display_id', params['display-id'])
      .eq('company_id', user!.companyId)
      .single();

    if (error || !data) {
      return notFound('Work order not found');
    }

    // Expand nested data
    const expanded = expandWorkOrderResponse(data);

    return success<WorkOrder>(expanded);
  });

// =============================================
// PATCH - Update Work Order by display_id
// =============================================

export const PATCH = route()
  .auth()
  .validateFields('work_orders')
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params, body } = context;
    const supabase = createServiceRoleClient();

    // Update work order using display_id
    const { error: updateError } = await supabase
      .from('work_orders')
      .update(body)
      .eq('display_id', params['display-id'])
      .eq('company_id', user!.companyId);

    if (updateError) {
      console.error('Error updating work order:', updateError);
      return badRequest(updateError.message);
    }

    // Fetch updated work order with expanded data
    const { data, error } = await buildWorkOrderQuery(supabase)
      .eq('display_id', params['display-id'])
      .eq('company_id', user!.companyId)
      .single();

    if (error || !data) {
      return notFound('Work order not found after update');
    }

    // Expand nested data
    const expanded = expandWorkOrderResponse(data);

    return success<WorkOrder>(expanded);
  });

// =============================================
// DELETE - Delete Work Order by display_id (Admin-only)
// =============================================

export const DELETE = route()
  .auth()
  .requireAdmin()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createServiceRoleClient();

    // Delete work order using display_id
    const { error } = await supabase
      .from('work_orders')
      .delete()
      .eq('display_id', params['display-id'])
      .eq('company_id', user!.companyId);

    if (error) {
      console.error('Error deleting work order:', error);
      return badRequest(error.message);
    }

    return success({ success: true, message: 'Work order deleted' });
  });

