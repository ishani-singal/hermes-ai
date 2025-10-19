-- =============================================
-- Companies Table
-- =============================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  primary_contact_email VARCHAR(255) NOT NULL,
  settings JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================
-- Users Table (extends auth.users)
-- =============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  default_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Trigger to auto-create public.users when auth.users created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' 
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- User-Companies Junction Table
-- =============================================
CREATE TABLE user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, company_id)
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

-- COMPANIES - Read only
CREATE POLICY companies_select_policy ON companies
  FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- USERS - Read only
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY users_select_company_users ON public.users
  FOR SELECT
  USING (
    id IN (
      SELECT uc.user_id 
      FROM user_companies uc
      WHERE uc.company_id IN (
        SELECT company_id FROM user_companies 
        WHERE user_id = auth.uid() AND is_active = true
      )
      AND uc.is_active = true
    )
  );

-- USER_COMPANIES - Read only
CREATE POLICY user_companies_select_own ON user_companies
  FOR SELECT
  USING (user_id = auth.uid());

-- NOTE: All INSERT/UPDATE/DELETE operations must go through API
-- API endpoints use supabaseAdmin (service role key) which bypasses RLS
-- This allows flexible business logic enforcement in application layer

-- =============================================
-- Indexes
-- =============================================

-- Foreign key indexes (critical for JOINs and RLS performance)
CREATE INDEX idx_users_default_company ON public.users(default_company_id);
CREATE INDEX idx_user_companies_user_id ON user_companies(user_id);
CREATE INDEX idx_user_companies_company_id ON user_companies(company_id);

-- Lookup indexes (for common queries)
CREATE INDEX idx_users_email ON public.users(email);

-- JSONB index (for querying settings)
CREATE INDEX idx_companies_settings ON companies USING GIN (settings);

-- Partial index for active associations (common query pattern)
CREATE INDEX idx_user_companies_active 
  ON user_companies(user_id, company_id) 
  WHERE is_active = true;