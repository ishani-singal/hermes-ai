# User & Company Setup - Application Layer Tasks

**Status:** 🔴 Not Implemented  
**Priority:** Critical (Required for MVP)  
**Related Migration:** `20251018225729_initial_schema.sql`

---

## Overview

These business rules must be enforced in the **application layer** (API routes) since they involve complex logic that cannot be handled by database constraints or RLS policies alone.

---

## Tasks

### ✅ Task 1: Email Immutability

**Rule:** Users cannot change their email address after signup

**Why:** 
- Email is synced between `auth.users` and `public.users`
- Email is used for authentication (login)
- Changing email would require complex sync logic

**Implementation:**
- Location: Profile update API endpoint (`app/api/users/[userId]/route.ts`)
- Validation: Block any requests that include email changes
- Response: Return error message directing user to create new account
- Alternative: User creates new account and contacts support to transfer data

**Test Cases:**
- [ ] User attempts to change email → Returns error
- [ ] User can update full_name → Succeeds
- [ ] User can update default_company_id → Succeeds

---

### ✅ Task 2: Company Must Have at Least One Admin

**Rule:** A company must always have at least one active admin user

**Why:**
- Prevents company from becoming inaccessible
- Ensures someone can manage users and settings
- Critical for operational continuity

**Implementation:**
- Location: User role update/deactivation endpoints (`app/api/user-companies/[id]/route.ts`)
- Validation: Before removing/demoting admin, count remaining active admins
- Check: If count <= 1, block the operation
- Response: Return error "Cannot remove or demote the last admin"
- Also applies to: User deletion endpoint, user account deactivation endpoint

**Test Cases:**
- [ ] Last admin tries to change role → Blocked
- [ ] Last admin tries to deactivate → Blocked
- [ ] Last admin tries to delete account → Blocked
- [ ] Company with 2+ admins can remove one → Succeeds
- [ ] Non-admin user can be removed → Succeeds

---

### ✅ Task 3: First User is Automatically Admin

**Rule:** When a company is created, the creator automatically becomes the first admin

**Why:**
- Someone needs to manage the company
- Creator should have full access
- Simplifies onboarding flow

**Implementation:**
- Location: Company creation/signup endpoint (`app/api/auth/signup/route.ts`)
- Flow: Create auth user → Create company → Add user_companies with role='admin'
- Set default_company_id to new company
- Transaction: Use rollback logic if any step fails (ensure atomicity)

**Test Cases:**
- [ ] New user creates company → Becomes admin
- [ ] User-company association created with role='admin'
- [ ] default_company_id set to new company
- [ ] Failure at any step → Proper rollback

---

## Additional Considerations

### Company Invitation Flow (Future)

When admin invites user to existing company:
- Invited users get role specified in invite (editor, viewer, etc.)
- NOT automatically admin (only first user during company creation becomes admin)
- Location: `app/api/invites/accept/route.ts`

---

## Testing Checklist

- [ ] Email immutability enforced in all profile update endpoints
- [ ] Last admin protection in role change endpoint
- [ ] Last admin protection in user deactivation endpoint
- [ ] Last admin protection in user deletion endpoint
- [ ] First user becomes admin during company creation
- [ ] Integration test: Full signup flow creates admin correctly
- [ ] Integration test: Cannot remove last admin
- [ ] Unit tests for each validation function

---

## Related Files

- **Migration:** `supabase/migrations/20251018225729_initial_schema.sql`
- **API Routes (to create):**
  - `app/api/auth/signup/route.ts`
  - `app/api/users/[userId]/route.ts`
  - `app/api/user-companies/[id]/route.ts`
  - `app/api/companies/[companyId]/route.ts`
  - `app/api/invites/accept/route.ts` (future)

---

## Notes

- All these rules use **service role key** (`supabaseAdmin`) to bypass RLS
- RLS policies only handle SELECT (reads) - writes are controlled by API
- Consider adding unit tests for each validation before implementing UI
- Error messages should be user-friendly and actionable

---

**Last Updated:** October 18, 2025  
**Next Review:** After MVP implementation
