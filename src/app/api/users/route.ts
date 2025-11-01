/**
 * GET /api/users - List users in the current company
 * 
 * Authorization: Authenticated users
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest } from '@/lib/auth/middleware';
import type { User } from '@/types';

export const GET = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user } = context;
    const supabase = createServiceRoleClient();

    // Get all users that belong to the same company
    const { data: userCompanies, error: ucError } = await supabase
      .from('user_companies')
      .select('user_id')
      .eq('company_id', user!.companyId)
      .eq('is_active', true);

    if (ucError) {
      console.error('Error fetching user companies:', ucError);
      return badRequest(ucError.message);
    }

    if (!userCompanies || userCompanies.length === 0) {
      return success<User[]>([]);
    }

    // Get user details
    const userIds = userCompanies.map(uc => uc.user_id);
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, user_id, default_company_id, created_at, updated_at')
      .in('id', userIds)
      .order('full_name', { ascending: true });

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return badRequest(usersError.message);
    }

    return success<User[]>(users || []);
  });

