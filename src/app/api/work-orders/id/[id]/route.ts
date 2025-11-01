/**
 * GET /api/work-orders/id/[id] - Get single work order by UUID
 * PATCH /api/work-orders/id/[id] - Update work order by UUID
 * DELETE /api/work-orders/id/[id] - Delete work order by UUID
 * 
 * Internal endpoint using GUID (UUID) - currently unused
 * Reserved for future internal operations
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
// GET - Get Single Work Order (GUID only - internal)
// =============================================

export const GET = route()
  .auth()
  .requireCompanyAccess('work_orders')
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createServiceRoleClient();

    // Fetch with JOINs for expanded data
    const { data, error } = await buildWorkOrderQuery(supabase)
      .eq('id', params.id)
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
// PATCH - Update Work Order (Internal - GUID only)
// =============================================

export const PATCH = route()
  .auth()
  .validateFields('work_orders') // Validates fields and parses body
  .requireCompanyAccess('work_orders')
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params, body } = context;

    // Use service role client
    const supabase = createServiceRoleClient();

    // Update work order
    const { error: updateError } = await supabase
      .from('work_orders')
      .update(body)
      .eq('id', params.id)
      .eq('company_id', user!.companyId);

    if (updateError) {
      console.error('Error updating work order:', updateError);
      return badRequest(updateError.message);
    }

    // Fetch updated work order with expanded data
    const { data, error } = await buildWorkOrderQuery(supabase)
      .eq('id', params.id)
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
// DELETE - Delete Work Order (Admin-only, Internal - GUID only)
// =============================================

export const DELETE = route()
  .auth()
  .requireAdmin()
  .requireCompanyAccess('work_orders')
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from('work_orders')
      .delete()
      .eq('id', params.id)
      .eq('company_id', user!.companyId);

    if (error) {
      console.error('Error deleting work order:', error);
      return badRequest(error.message);
    }

    return success({ success: true, message: 'Work order deleted' });
  });

