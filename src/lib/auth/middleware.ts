/**
 * Route Middleware for Next.js API Routes
 * 
 * Individual middleware functions that can be composed using the route builder.
 * Each middleware follows the pattern:
 *   (request, context, next) => Promise<Response>
 * 
 * Middleware can either:
 * 1. Call next() to continue the chain
 * 2. Return a Response to short-circuit
 * 3. Modify the context object for downstream middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import * as helpers from './helpers';
import type { RouteContext } from './route-builder';

// =============================================
// Response Helpers
// =============================================

export function unauthorized(message = 'Unauthorized'): Response {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden', details?: Record<string, unknown>): Response {
  return NextResponse.json(
    { error: message, ...details },
    { status: 403 }
  );
}

export function badRequest(message: string): Response {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = 'Resource not found'): Response {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function success<T>(data: T, status = 200): Response {
  return NextResponse.json(data, { status });
}

// =============================================
// Core Middleware
// =============================================

/**
 * Authenticate the request and inject user into context.
 * This must be the first middleware in the chain.
 */
export async function authenticate(
  request: NextRequest,
  context: RouteContext,
  next: () => Promise<Response>
): Promise<Response> {
  const user = await helpers.getAuthenticatedUser();

  if (!user) {
    return unauthorized('Authentication required');
  }

  // Inject user into context for downstream middleware
  context.user = user;

  return next();
}

// =============================================
// Role-Based Middleware
// =============================================

/**
 * Require user to be an admin.
 * Must be called after authenticate middleware.
 */
export async function requireAdmin(
  request: NextRequest,
  context: RouteContext,
  next: () => Promise<Response>
): Promise<Response> {
  if (!context.user) {
    return unauthorized('Authentication required');
  }

  if (!helpers.isAdmin(context.user)) {
    return forbidden('Admin access required');
  }

  return next();
}

/**
 * Require user to have one of the specified roles.
 * Returns a middleware function that can be used in the chain.
 */
export function requireRoles(
  allowedRoles: helpers.UserRole[]
): (
  request: NextRequest,
  context: RouteContext,
  next: () => Promise<Response>
) => Promise<Response> {
  return async (request, context, next) => {
    if (!context.user) {
      return unauthorized('Authentication required');
    }

    if (!helpers.hasRole(context.user, allowedRoles)) {
      return forbidden(
        `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}`
      );
    }

    return next();
  };
}

// =============================================
// Resource-Based Middleware
// =============================================

/**
 * Verify user has access to a resource in their company.
 * Checks that resource exists and belongs to user's company.
 */
export function requireCompanyAccess(
  table: string,
  paramName = 'id'
): (
  request: NextRequest,
  context: RouteContext,
  next: () => Promise<Response>
) => Promise<Response> {
  return async (request, context, next) => {
    if (!context.user) {
      return unauthorized('Authentication required');
    }

    const resourceId = context.params[paramName];
    if (!resourceId) {
      return badRequest(`Missing ${paramName} parameter`);
    }

    const hasAccess = await helpers.belongsToCompany(
      context.user.companyId,
      table,
      resourceId
    );

    if (!hasAccess) {
      return notFound('Resource not found or access denied');
    }

    return next();
  };
}

// =============================================
// Field Validation Middleware
// =============================================

/**
 * Validate that user can update the requested fields.
 * Automatically parses request body and validates field permissions.
 * Injects parsed body into context for handler to use.
 */
export function validateUpdateFields(
  resource: string
): (
  request: NextRequest,
  context: RouteContext,
  next: () => Promise<Response>
) => Promise<Response> {
  return async (request, context, next) => {
    if (!context.user) {
      return unauthorized('Authentication required');
    }

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const requestedFields = Object.keys(body);

    // Validate fields
    const forbiddenFields = helpers.checkForbiddenFields(
      context.user,
      resource,
      requestedFields
    );

    if (forbiddenFields.length > 0) {
      return forbidden(
        `You cannot update the following fields: ${forbiddenFields.join(', ')}`,
        {
          forbidden_fields: forbiddenFields,
          allowed_fields: helpers.getAllowedUpdateFields(context.user, resource),
        }
      );
    }

    // Inject validated body into context
    context.body = body;

    return next();
  };
}

// =============================================
// Permission Check Middleware
// =============================================

/**
 * Check if user can perform a specific action on a resource.
 * Use this for simple permission checks (create, read, delete).
 * For update operations, use validateUpdateFields instead.
 */
export function requirePermission(
  action: 'create' | 'read' | 'delete',
  resource: string
): (
  request: NextRequest,
  context: RouteContext,
  next: () => Promise<Response>
) => Promise<Response> {
  return async (request, context, next) => {
    if (!context.user) {
      return unauthorized('Authentication required');
    }

    const canPerform = helpers.canPerformAction(context.user, action, resource);

    if (!canPerform) {
      return forbidden(`You do not have permission to ${action} ${resource}`);
    }

    return next();
  };
}
