/**
 * Route Builder - Fluent API for Next.js API Route Protection
 * 
 * Provides a clean, chainable interface for applying middleware to API routes.
 * Similar to Express/tRPC middleware patterns.
 * 
 * @example Simple authentication
 * export const GET = route()
 *   .auth()
 *   .handle(async (req, ctx) => { ... });
 * 
 * @example Admin-only route
 * export const DELETE = route()
 *   .auth()
 *   .requireAdmin()
 *   .handle(async (req, ctx) => { ... });
 * 
 * @example Update with field validation
 * export const PATCH = route()
 *   .auth()
 *   .validateFields('work_orders')
 *   .requireCompanyAccess('work_orders')
 *   .handle(async (req, ctx) => { ... });
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticatedUser } from './helpers';
import type { UserRole } from './helpers';
import * as middleware from './middleware';

// =============================================
// Types
// =============================================

/**
 * Enhanced context passed to route handlers
 */
export interface RouteContext {
  /** Route parameters (e.g., { id: '123' }) */
  params: Record<string, string>;
  /** Authenticated user (available after .auth() middleware) */
  user?: AuthenticatedUser;
  /** Parsed and validated request body (available after .validateFields()) */
  body?: Record<string, unknown>;
}

/**
 * Route handler function signature
 */
export type RouteHandler = (
  request: NextRequest,
  context: RouteContext
) => Promise<Response> | Response;

/**
 * Next.js route handler signature
 */
type NextRouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<Response>;

// =============================================
// Route Builder Class
// =============================================

/**
 * Fluent API builder for creating protected API routes
 */
export class RouteBuilder {
  private middlewares: Array<(
    request: NextRequest,
    context: RouteContext,
    next: () => Promise<Response>
  ) => Promise<Response>> = [];

  /**
   * Authenticate the request and inject user into context.
   * Must be called first before other middleware.
   * 
   * @example
   * route().auth().handle(handler)
   */
  auth(): this {
    this.middlewares.push(middleware.authenticate);
    return this;
  }

  /**
   * Require user to be an admin.
   * Must be called after .auth()
   * 
   * @example
   * route().auth().requireAdmin().handle(handler)
   */
  requireAdmin(): this {
    this.middlewares.push(middleware.requireAdmin);
    return this;
  }

  /**
   * Require user to have one of the specified roles.
   * Must be called after .auth()
   * 
   * @param roles - Array of allowed roles
   * 
   * @example
   * route().auth().requireRoles(['admin', 'editor']).handle(handler)
   */
  requireRoles(roles: UserRole[]): this {
    this.middlewares.push(middleware.requireRoles(roles));
    return this;
  }

  /**
   * Validate that user can update the requested fields based on their role.
   * Automatically parses request body and injects into context.body
   * Must be called after .auth()
   * 
   * @param resource - Resource name (e.g., 'work_orders')
   * 
   * @example
   * route().auth().validateFields('work_orders').handle(handler)
   */
  validateFields(resource: string): this {
    this.middlewares.push(middleware.validateUpdateFields(resource));
    return this;
  }

  /**
   * Verify user has access to a resource in their company.
   * Checks that resource exists and belongs to user's company.
   * Must be called after .auth()
   * 
   * @param table - Database table name
   * @param paramName - Route parameter name containing resource ID (default: 'id')
   * 
   * @example
   * route().auth().requireCompanyAccess('work_orders').handle(handler)
   */
  requireCompanyAccess(table: string, paramName: string = 'id'): this {
    this.middlewares.push(middleware.requireCompanyAccess(table, paramName));
    return this;
  }

  /**
   * Execute the route handler with all configured middleware.
   * This must be called last in the chain.
   * 
   * @param handler - Your business logic handler
   * @returns Next.js route handler
   * 
   * @example
   * export const POST = route()
   *   .auth()
   *   .handle(async (req, ctx) => {
   *     // ctx.user is available
   *     return NextResponse.json({ success: true });
   *   });
   */
  handle(handler: RouteHandler): NextRouteHandler {
    return async (request: NextRequest, { params }: { params: Promise<Record<string, string>> }) => {
      // Await params (Next.js 15+)
      const resolvedParams = await params;
      const context: RouteContext = { params: resolvedParams };

      // Create middleware chain
      const executeMiddleware = async (index: number): Promise<Response> => {
        if (index >= this.middlewares.length) {
          // All middleware passed, execute handler
          return handler(request, context);
        }

        const currentMiddleware = this.middlewares[index];
        return currentMiddleware(request, context, () => executeMiddleware(index + 1));
      };

      try {
        return await executeMiddleware(0);
      } catch (error) {
        console.error('Route error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Internal server error' },
          { status: 500 }
        );
      }
    };
  }
}

// =============================================
// Factory Function
// =============================================

/**
 * Create a new route builder.
 * Start of the fluent API chain.
 * 
 * @example
 * export const GET = route()
 *   .auth()
 *   .handle(handler);
 */
export function route(): RouteBuilder {
  return new RouteBuilder();
}
