-- =============================================
-- Add RLS Policies for User Signup Flow
-- Created: 2025-10-23
-- =============================================

-- =============================================
-- COMPANIES - Add INSERT policy for signup
-- =============================================

-- Allow users to create companies during signup (create new company flow)
CREATE POLICY companies_insert_policy ON companies
  FOR INSERT
  WITH CHECK (true);  -- Any authenticated user can create a company

-- Allow company admins to update their company
CREATE POLICY companies_update_policy ON companies
  FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- Note: DELETE is intentionally not allowed via RLS
-- Company deletion should be handled through API with proper checks

-- =============================================
-- USER_COMPANIES - Add INSERT policy for signup
-- =============================================

-- Allow users to add themselves to companies during signup
-- This covers both "create company" and "join company" flows
CREATE POLICY user_companies_insert_policy ON user_companies
  FOR INSERT
  WITH CHECK (
    -- User can only insert records for themselves
    user_id = auth.uid()
  );

-- Allow admins to add/invite other users to their companies
CREATE POLICY user_companies_insert_by_admin_policy ON user_companies
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- Allow admins to update user-company associations (change roles, deactivate users)
CREATE POLICY user_companies_update_policy ON user_companies
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- Allow users to remove themselves from companies (leave company)
CREATE POLICY user_companies_delete_self_policy ON user_companies
  FOR DELETE
  USING (user_id = auth.uid());

-- Allow admins to remove users from their companies
CREATE POLICY user_companies_delete_by_admin_policy ON user_companies
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- =============================================
-- USERS - Add UPDATE policy
-- =============================================

-- Allow users to update their own profile
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Note: INSERT for users is handled by the trigger (on_auth_user_created)
-- which runs with SECURITY DEFINER, bypassing RLS
-- DELETE is not allowed - users are soft-deleted by deactivating user_companies

-- =============================================
-- Notes on Signup Flow
-- =============================================

-- CREATE NEW COMPANY FLOW:
-- 1. User signs up (auth.users created by Supabase Auth)
-- 2. Trigger creates public.users record (bypasses RLS with SECURITY DEFINER)
-- 3. API creates company (companies_insert_policy allows this)
-- 4. API creates user_companies link with role='admin' (user_companies_insert_policy allows this)

-- JOIN EXISTING COMPANY FLOW:
-- 1. User signs up (auth.users + public.users created as above)
-- 2. User enters invite code/company identifier
-- 3. API verifies invite and creates user_companies link (user_companies_insert_policy allows this)

-- Both flows work because:
-- - companies_insert_policy allows any authenticated user to create a company
-- - user_companies_insert_policy allows users to add themselves to companies
-- - API can use service role key for additional validation/business logic
