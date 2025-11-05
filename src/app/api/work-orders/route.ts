/**
 * POST /api/work-orders - Create a new work order
 * GET /api/work-orders - List work orders with filtering
 * 
 * Authorization: Authenticated users (admin + user)
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, forbidden } from '@/lib/auth/middleware';
import * as helpers from '@/lib/auth/helpers';
import type {
  CreateWorkOrderRequest,
  WorkOrder,
  WorkOrderListFilters,
  WorkOrderListResponse,
  WorkOrderStatus,
  WorkOrderPriority,
} from '@/types';
import {
  buildWorkOrderQuery,
  expandWorkOrderResponse,
  expandWorkOrderResponses,
} from '@/lib/api/work-order-helpers';

// =============================================
// GET - List Work Orders
// =============================================

export const GET = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user } = context;

    // Parse query parameters
    const { searchParams } = new URL(request.url);

    const filters: WorkOrderListFilters = {
      status: (searchParams.get('status') as WorkOrderStatus) || undefined,
      priority: (searchParams.get('priority') as WorkOrderPriority) || undefined,
      assigned_to: searchParams.get('assigned_to') || undefined,
      equipment_id: searchParams.get('equipment_id') || undefined,
      created_by: searchParams.get('created_by') || undefined,
      due_before: searchParams.get('due_before') || undefined,
      due_after: searchParams.get('due_after') || undefined,
      search: searchParams.get('search') || undefined,
      sort: (searchParams.get('sort') as 'created_at' | 'updated_at' | 'due_date' | 'priority') || 'created_at',
      order: (searchParams.get('order') as 'asc' | 'desc') || 'desc',
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: Math.min(parseInt(searchParams.get('limit') || '25', 10), 100),
    };

    // Use service role client
    const supabase = createServiceRoleClient();

    // Build query with JOINs for expanded data
    let query = buildWorkOrderQuery(supabase)
      .eq('company_id', user!.companyId);

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }
    if (filters.equipment_id) {
      query = query.eq('equipment_id', filters.equipment_id);
    }
    if (filters.created_by) {
      query = query.eq('created_by', filters.created_by);
    }
    if (filters.due_before) {
      query = query.lte('due_date', filters.due_before);
    }
    if (filters.due_after) {
      query = query.gte('due_date', filters.due_after);
    }
    if (filters.search) {
      // Simple text search in title and description
      query = query.or(
        `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    // Apply sorting
    const ascending = filters.order === 'asc';
    query = query.order(filters.sort!, { ascending });

    // Apply pagination
    const from = (filters.page! - 1) * filters.limit!;
    const to = from + filters.limit! - 1;
    query = query.range(from, to);

    // Execute query - get count separately for expanded query
    const { data, error } = await query;

    if (error) {
      console.error('Error listing work orders:', error);
      return badRequest(error.message);
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', user!.companyId);

    // Expand nested data
    const expandedData = expandWorkOrderResponses(data || []);

    const response: WorkOrderListResponse = {
      data: expandedData,
      pagination: {
        page: filters.page!,
        limit: filters.limit!,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / filters.limit!),
      },
      filters,
    };

    return success(response);
  });

// =============================================
// POST - Create Work Order
// =============================================

export const POST = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user } = context;

    // Check if user can create work orders
    if (!helpers.canPerformAction(user!, 'create', 'work_orders')) {
      return forbidden('You do not have permission to create work orders');
    }

    // Parse request body
    const body: CreateWorkOrderRequest = await request.json();

    // Validate required fields
    if (!body.title || body.title.trim().length === 0) {
      return badRequest('Title is required');
    }

    if (body.title.length > 255) {
      return badRequest('Title must be 255 characters or less');
    }

    if (body.description && body.description.length > 5000) {
      return badRequest('Description must be 5000 characters or less');
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (body.priority && !validPriorities.includes(body.priority)) {
      return badRequest(`Priority must be one of: ${validPriorities.join(', ')}`);
    }

    // If user is not admin, they cannot assign to others
    if (body.assigned_to && !helpers.isAdmin(user!)) {
      return forbidden('Only admins can assign work orders to users');
    }

    // Use service role client with explicit company_id injection
    const supabase = createServiceRoleClient();

    // Insert work order (must explicitly add company_id)
    // display_id will be auto-generated by trigger
    const { data: insertedData, error: insertError } = await supabase
      .from('work_orders')
      .insert({
        company_id: user!.companyId,
        created_by: user!.id,
        title: body.title,
        description: body.description || null,
        equipment_id: body.equipment_id || null,
        assigned_to: body.assigned_to || null,
        priority: body.priority || 'medium',
        due_date: body.due_date || null,
        custom_fields: body.custom_fields || {},
        status: 'open', // Always starts as open
      })
      .select('id')
      .single();

    if (insertError || !insertedData) {
      console.error('Error creating work order:', insertError);
      return badRequest(insertError?.message || 'Failed to create work order');
    }

    // Fetch the created work order with expanded data
    const { data, error } = await buildWorkOrderQuery(supabase)
      .eq('id', insertedData.id)
      .single();

    if (error || !data) {
      console.error('Error fetching created work order:', error);
      return badRequest('Work order created but failed to fetch details');
    }

    // Expand nested data
    const expanded = expandWorkOrderResponse(data);

    return success<WorkOrder>(expanded, 201);
  });
