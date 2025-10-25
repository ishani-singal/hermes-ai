# Authorization Architecture - Middleware & Route Builder Pattern

## Overview

This application uses a **middleware-based authorization architecture** with a **fluent route builder API**. Authorization logic is centralized, testable, and composable - similar to Express.js, tRPC, and NestJS patterns.

## Quick Start

```typescript
// Simple authenticated route
export const GET = route()
  .auth()
  .handle(async (req, ctx) => {
    // ctx.user is available
    return success({ message: 'Hello!' });
  });

// Admin-only route
export const DELETE = route()
  .auth()
  .requireAdmin()
  .handle(async (req, ctx) => {
    // Only admins reach here
  });

// Update with field validation
export const PATCH = route()
  .auth()
  .validateFields('work_orders')
  .requireCompanyAccess('work_orders')
  .handle(async (req, ctx) => {
    // ctx.body contains validated request body
    // Field permissions already checked
  });
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     API Request                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Route Handler                             │
│         export const POST = route()...                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Route Builder                                  │
│              - Chains middleware                            │
│              - Builds execution pipeline                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│             Middleware Chain                                │
│             ├── authenticate()                              │
│             ├── requireAdmin()                              │
│             ├── validateFields()                            │
│             └── requireCompanyAccess()                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 Your Handler                                │
│                 - Business logic only                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│            Service Role Supabase Client                     │
│            - Execute database operations                    │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Route Builder (`src/lib/auth/route-builder.ts`)

Fluent API for building protected routes.

**Methods:**
- `.auth()` - Authenticate user, inject into context
- `.requireAdmin()` - Require admin role
- `.requireRoles([...])` - Require specific roles
- `.validateFields(resource)` - Validate update fields
- `.requireCompanyAccess(table)` - Check company access
- `.handle(handler)` - Execute handler with middleware

**Example:**
```typescript
export const PATCH = route()
  .auth()                              // Must be first
  .validateFields('work_orders')       // Check field permissions
  .requireCompanyAccess('work_orders') // Check company access
  .handle(async (req, ctx) => {
    // All checks passed
    const { user, body, params } = ctx;
  });
```

### 2. Middleware Functions (`src/lib/auth/middleware.ts`)

Individual middleware that handle auth checks and return appropriate responses.

**Response Helpers:**
```typescript
import { success, badRequest, forbidden, unauthorized, notFound } from '@/lib/auth/middleware';

return success(data);                    // 200
return success(data, 201);               // 201 Created
return badRequest('Invalid input');      // 400
return unauthorized();                   // 401
return forbidden('Admin only');          // 403
return notFound();                       // 404
```

### 3. Authorization Helpers (`src/lib/auth/helpers.ts`)

Core functions for auth checks. Can be used in middleware OR directly in Server Components.

**Key Functions:**
```typescript
// Get authenticated user
const user = await getAuthenticatedUser();

// Permission checks
const canCreate = helpers.canPerformAction(user, 'create', 'work_orders');
const isUserAdmin = helpers.isAdmin(user);

// Field validation
const allowedFields = helpers.getAllowedUpdateFields(user, 'work_orders');
const forbiddenFields = helpers.checkForbiddenFields(user, 'work_orders', ['assigned_to']);
```

**Permission Configuration:**
```typescript
const RESOURCE_PERMISSIONS = {
  work_orders: {
    create: { admin: true, user: true },
    read: { admin: true, user: true },
    update: {
      admin: ['title', 'description', 'status', 'priority', 'assigned_to', ...],
      user: ['description', 'status']
    },
    delete: { admin: true, user: false }
  }
};
```

## Complete Examples

### Create Route
```typescript
export const POST = route()
  .auth()
  .handle(async (request, context) => {
    const { user } = context;
    const body = await request.json();
    
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('work_orders')
      .insert({ ...body, company_id: user!.companyId });
    
    return success(data, 201);
  });
```

### Update Route with Field Validation
```typescript
export const PATCH = route()
  .auth()
  .validateFields('work_orders')        // Validates + parses body
  .requireCompanyAccess('work_orders')  // Checks company access
  .handle(async (request, context) => {
    const { params, body } = context;
    
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('work_orders')
      .update(body)
      .eq('id', params.id);
    
    return success(data);
  });
```

### Admin-Only Delete
```typescript
export const DELETE = route()
  .auth()
  .requireAdmin()
  .requireCompanyAccess('work_orders')
  .handle(async (request, context) => {
    const { params } = context;
    const supabase = createServiceRoleClient();
    
    await supabase.from('work_orders').delete().eq('id', params.id);
    return success({ message: 'Deleted' });
  });
```

## Adding New Resources

**Step 1:** Add to permission configuration in `helpers.ts`

**Step 2:** Use in routes with builder pattern

```typescript
export const PATCH = route()
  .auth()
  .validateFields('equipment')
  .requireCompanyAccess('equipment')
  .handle(handler);
```

No database migrations needed!

## Why This Pattern?

✅ **No repeated auth code** - Declare once with builder  
✅ **Readable** - Clear what each route requires  
✅ **Flexible** - Easy to add roles/resources  
✅ **Type-safe** - Full TypeScript support  
✅ **Testable** - Test middleware independently  
✅ **Next.js native** - Similar to tRPC/Express patterns  

## Summary

- Use `route().auth()...handle()` for API routes
- Use helpers directly in Server Components
- Add resources by updating permission config
- No RLS for field-level permissions
