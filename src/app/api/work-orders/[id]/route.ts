/**
 * GET /api/work-orders/[id] - Get single work order
 * PATCH /api/work-orders/[id] - Update work order
 * DELETE /api/work-orders/[id] - Delete work order
 * 
 * Authorization: Role-based field restrictions
 */

import { NextRequest } from 'next/server';
import { createScopedServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, notFound } from '@/lib/auth/middleware';
import type { WorkOrder } from '@/types';

// =============================================
// GET - Get Single Work Order
// =============================================

export const GET = route()
  .auth()
  .requireCompanyAccess('work_orders')
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createScopedServiceRoleClient(user!.companyId);

    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return notFound('Work order not found');
    }

    return success<WorkOrder>(data);
  });

// =============================================
// PATCH - Update Work Order
// =============================================

export const PATCH = route()
  .auth()
  .validateFields('work_orders') // Validates fields and parses body
  .requireCompanyAccess('work_orders')
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params, body } = context;

    // Use scoped service role client - automatically filters by company_id
    const supabase = createScopedServiceRoleClient(user!.companyId);

    // Perform update
    const { data, error } = await supabase
      .from('work_orders')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating work order:', error);
      return badRequest(error.message);
    }

    if (!data) {
      return notFound('Work order not found');
    }

    return success<WorkOrder>(data);
  });

// =============================================
// DELETE - Delete Work Order (Admin-only)
// =============================================

export const DELETE = route()
  .auth()
  .requireAdmin()
  .requireCompanyAccess('work_orders')
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createScopedServiceRoleClient(user!.companyId);

    const { error } = await supabase
      .from('work_orders')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting work order:', error);
      return badRequest(error.message);
    }

    return success({ success: true, message: 'Work order deleted' });
  });
