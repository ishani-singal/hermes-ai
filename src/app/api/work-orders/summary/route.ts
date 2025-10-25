/**
 * GET /api/work-orders/summary
 * Get work order statistics and counts
 * 
 * Authorization: Authenticated users
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest } from '@/lib/auth/middleware';
import type { WorkOrderSummary } from '@/types';

export const GET = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user } = context;
    const { searchParams } = new URL(request.url);

    const assigned_to = searchParams.get('assigned_to') || undefined;
    const equipment_id = searchParams.get('equipment_id') || undefined;

    const supabase = createServiceRoleClient();

    // Base query with explicit company_id filter
    let baseQuery = supabase
      .from('work_orders')
      .select('status, priority, due_date, assigned_to')
      .eq('company_id', user!.companyId);

    // Apply filters if provided
    if (assigned_to) {
      baseQuery = baseQuery.eq('assigned_to', assigned_to);
    }
    if (equipment_id) {
      baseQuery = baseQuery.eq('equipment_id', equipment_id);
    }

    const { data, error } = await baseQuery;

    if (error) {
      console.error('Error fetching work order summary:', error);
      return badRequest(error.message);
    }

    // Calculate summary
    const summary: WorkOrderSummary = {
      total: data.length,
      by_status: {
        open: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
      },
      by_priority: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      overdue_count: 0,
    };

    const now = new Date();

    data.forEach((wo) => {
      // Count by status
      summary.by_status[wo.status as keyof typeof summary.by_status]++;

      // Count by priority
      summary.by_priority[wo.priority as keyof typeof summary.by_priority]++;

      // Count overdue (past due_date and not completed)
      if (wo.due_date && wo.status !== 'completed' && wo.status !== 'cancelled') {
        const dueDate = new Date(wo.due_date);
        if (dueDate < now) {
          summary.overdue_count++;
        }
      }
    });

    // If filtering by assigned_to, add that count
    if (assigned_to) {
      summary.assigned_to_me = data.length;
    }

    return success<WorkOrderSummary>(summary);
  });
