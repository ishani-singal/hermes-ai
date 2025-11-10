/**
 * Authorization Helpers
 * 
 * Simple, functional helpers for authentication and authorization.
 * These are used by the middleware layer and can also be used directly
 * in Server Components or other server-side code.
 */

import { createServerClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types';

// =============================================
// Types
// =============================================

export type { UserRole } from '@/types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  companyId: string;
}

// =============================================
// Core Authentication
// =============================================

/**
 * Get the currently authenticated user with their role and company.
 * Returns null if not authenticated or not associated with a company.
 * 
 * @example
 * const user = await getAuthenticatedUser();
 * if (!user) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createServerClient();
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Get user's company and role
  const { data: userCompany, error: companyError } = await supabase
    .from('user_companies')
    .select('company_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (companyError || !userCompany) {
    return null;
  }

  return {
    id: user.id,
    email: user.email!,
    role: userCompany.role as UserRole,
    companyId: userCompany.company_id,
  };
}

// =============================================
// Permission Checks
// =============================================

/**
 * Check if user has required role
 */
export function hasRole(user: AuthenticatedUser, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(user.role);
}

/**
 * Check if user is admin
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'admin';
}

/**
 * Check if resource belongs to user's company
 * Only works with GUIDs (UUIDs) for primary key lookups
 * For display_id lookups, use dedicated endpoints
 */
export async function belongsToCompany(
  companyId: string,
  resourceTable: string,
  resourceId: string
): Promise<boolean> {
  const supabase = await createServerClient();
  
  // Always query by primary key id (GUID)
  const { data, error } = await supabase
    .from(resourceTable)
    .select('company_id')
    .eq('id', resourceId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.company_id === companyId;
}

// =============================================
// Resource Permissions Configuration
// =============================================

interface ResourcePermissions {
  create: Record<UserRole, boolean>;
  read: Record<UserRole, boolean>;
  update: Record<UserRole, string[]>; // Allowed fields per role
  delete: Record<UserRole, boolean>;
}

const RESOURCE_PERMISSIONS: Record<string, ResourcePermissions> = {
  work_orders: {
    create: {
      admin: true,
      editor: true,
      viewer: false,
    },
    read: {
      admin: true,
      editor: true,
      viewer: true,
    },
    update: {
      admin: [
        'title',
        'description',
        'status',
        'priority',
        'assigned_to',
        'due_date',
        'equipment_id',
        'custom_fields',
      ],
      editor: ['description', 'status'],
      viewer: [],
    },
    delete: {
      admin: true,
      editor: false,
      viewer: false,
    },
  },
  // Add more resources here (equipment, documents, etc.)
};

/**
 * Check if user can perform action on resource
 */
export function canPerformAction(
  user: AuthenticatedUser,
  action: 'create' | 'read' | 'update' | 'delete',
  resource: string
): boolean {
  const permissions = RESOURCE_PERMISSIONS[resource];
  if (!permissions) {
    return false;
  }

  if (action === 'update') {
    return permissions.update[user.role].length > 0;
  }

  return permissions[action][user.role] === true;
}

/**
 * Get allowed fields for update based on user role
 */
export function getAllowedUpdateFields(
  user: AuthenticatedUser,
  resource: string
): string[] {
  const permissions = RESOURCE_PERMISSIONS[resource];
  if (!permissions) {
    return [];
  }

  return permissions.update[user.role] || [];
}

/**
 * Check which fields user cannot update
 * Returns array of forbidden fields (empty if all allowed)
 */
export function checkForbiddenFields(
  user: AuthenticatedUser,
  resource: string,
  requestedFields: string[]
): string[] {
  const allowedFields = getAllowedUpdateFields(user, resource);
  return requestedFields.filter((field) => !allowedFields.includes(field));
}
