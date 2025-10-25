# Work Order API Implementation Checklist

## ✅ Completed

- [x] Authorization Service layer (`src/lib/auth/authorization.ts`)
- [x] Authorization wrapper HOFs (`src/lib/auth/with-authorization.ts`)
- [x] Work Order TypeScript types (`src/types/work-order.ts`)
- [x] Service Role Client function (`src/lib/supabase/server.ts`)
- [x] POST /api/work-orders - Create work order
- [x] GET /api/work-orders - List work orders with filtering
- [x] GET /api/work-orders/:id - Get single work order
- [x] PATCH /api/work-orders/:id - Update work order with field validation
- [x] DELETE /api/work-orders/:id - Delete work order (admin-only)
- [x] GET /api/work-orders/summary - Get statistics
- [x] Complete documentation (`docs/code/authorization-architecture.md`)
- [x] API summary (`docs/code/work-order-apis.md`)

## ⏳ To Do Before Testing

### 1. Add Environment Variable
```bash
# Add to .env.local
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret_key
```

**How to get it:**
1. Go to Supabase Dashboard
2. Project Settings → API
3. Copy "service_role" key (starts with `eyJ...`)
4. ⚠️ **NEVER commit this to git** - it bypasses RLS!

### 2. Verify Database is Running
```bash
# If using local Supabase
cd supabase
supabase start
```

### 3. Optional: Simplify RLS Policies

Since we're doing authorization in business logic, you can simplify RLS to just company scoping:

```sql
-- Create migration: supabase/migrations/20251024000000_simplify_work_order_rls.sql

-- Drop existing policies
DROP POLICY IF EXISTS work_orders_insert_admin_policy ON work_orders;
DROP POLICY IF EXISTS work_orders_update_admin_policy ON work_orders;
DROP POLICY IF EXISTS work_orders_delete_admin_policy ON work_orders;

-- Add simplified policies (company scoping only)
CREATE POLICY work_orders_insert_policy ON work_orders
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
    AND created_by = auth.uid()
  );

CREATE POLICY work_orders_update_policy ON work_orders
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY work_orders_delete_policy ON work_orders
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );
```

Run migration:
```bash
supabase db push
```

## 🧪 Testing

### Test 1: Create Work Order (User)
```bash
# Using curl or Postman
POST http://localhost:3000/api/work-orders
Headers:
  Authorization: Bearer <user_token>
Body:
{
  "title": "Test Work Order",
  "description": "Testing creation",
  "priority": "medium"
}

Expected: 201 Created
```

### Test 2: Create Work Order with Assignment (User - Should Fail)
```bash
POST http://localhost:3000/api/work-orders
Body:
{
  "title": "Test",
  "assigned_to": "some-user-id"
}

Expected: 403 Forbidden
Message: "Only admins can assign work orders to users"
```

### Test 3: Update Status (User - Should Succeed)
```bash
PATCH http://localhost:3000/api/work-orders/:id
Body:
{
  "status": "in_progress"
}

Expected: 200 OK
```

### Test 4: Update Assignment (User - Should Fail)
```bash
PATCH http://localhost:3000/api/work-orders/:id
Body:
{
  "assigned_to": "other-user-id"
}

Expected: 403 Forbidden
Message: "You cannot update the following fields: assigned_to"
```

### Test 5: Update Assignment (Admin - Should Succeed)
```bash
PATCH http://localhost:3000/api/work-orders/:id
Headers:
  Authorization: Bearer <admin_token>
Body:
{
  "assigned_to": "user-id",
  "priority": "high"
}

Expected: 200 OK
```

### Test 6: Delete (User - Should Fail)
```bash
DELETE http://localhost:3000/api/work-orders/:id
Headers:
  Authorization: Bearer <user_token>

Expected: 403 Forbidden
```

### Test 7: Delete (Admin - Should Succeed)
```bash
DELETE http://localhost:3000/api/work-orders/:id
Headers:
  Authorization: Bearer <admin_token>

Expected: 200 OK
```

### Test 8: List with Filters
```bash
GET http://localhost:3000/api/work-orders?status=open&priority=high&page=1&limit=10

Expected: 200 OK with data array and pagination
```

### Test 9: Summary
```bash
GET http://localhost:3000/api/work-orders/summary

Expected: 200 OK with counts
```

## 🚀 Next Steps

### Phase 1: Frontend Integration
- [ ] Create React hooks for work order APIs
- [ ] Build work order list view
- [ ] Build work order detail view
- [ ] Build work order creation form

### Phase 2: AI Chatbot Integration
- [ ] Add function calling definitions for work orders
- [ ] Implement natural language work order creation
- [ ] Implement work order status updates via chat
- [ ] Add work order search via chat

### Phase 3: Additional Features
- [ ] Equipment APIs (similar pattern)
- [ ] Document APIs (similar pattern)
- [ ] Attachments for work orders
- [ ] Comments/activity log
- [ ] Email notifications

## 📝 Notes

### Architecture Benefits
✅ **Centralized** - All auth logic in one place
✅ **Reusable** - Compose wrappers for any scenario
✅ **Portable** - Not locked to Supabase/Postgres
✅ **Testable** - Can unit test AuthorizationService
✅ **Extensible** - Easy to add roles/resources

### Similar to .NET
- `AuthorizationService` = Authorization Service
- `withAuth()` = `[Authorize]` attribute
- `requireAdmin()` = `[Authorize(Roles = "Admin")]`
- `RESOURCE_PERMISSIONS` = Authorization Policies
- Composable wrappers = Action Filters

### No RLS for Field-Level Permissions
We're using business logic instead because:
- More flexible
- Better error messages
- Easier to test
- No database migrations for permission changes
- More portable

### Defense in Depth
Even with simplified RLS, we have multiple security layers:
1. Supabase Auth (authentication)
2. AuthorizationService (authorization)
3. Company scoping (data isolation)
4. Service role client (controlled privilege escalation)
