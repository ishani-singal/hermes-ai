-- =============================================
-- Invites Table
-- Allows company admins to invite users with specific roles
-- =============================================

CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  email VARCHAR(255) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Admins can view invites for their company
CREATE POLICY invites_select_policy ON invites
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- NOTE: INSERT/UPDATE/DELETE operations go through API with service role
-- API enforces admin-only access for these operations

-- =============================================
-- Indexes
-- =============================================

-- Token lookup (for invite validation during signup)
CREATE UNIQUE INDEX idx_invites_token ON invites(token);

-- Company lookup (for admin listing invites)
CREATE INDEX idx_invites_company_id ON invites(company_id);

-- Email lookup (to check for existing invites)
CREATE INDEX idx_invites_email ON invites(email);

-- Pending invites (unused, not expired)
CREATE INDEX idx_invites_pending 
  ON invites(company_id, email) 
  WHERE used_at IS NULL;

-- =============================================
-- Functions
-- =============================================

-- Function to generate secure random token
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS VARCHAR(64)
LANGUAGE plpgsql
AS $$
DECLARE
  new_token VARCHAR(64);
  token_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 32 random bytes and encode as hex (64 chars)
    new_token := encode(gen_random_bytes(32), 'hex');
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM invites WHERE invites.token = new_token) INTO token_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT token_exists;
  END LOOP;
  
  RETURN new_token;
END;
$$;

-- =============================================
-- Updated_at Trigger
-- =============================================

CREATE OR REPLACE FUNCTION update_invites_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER invites_updated_at
  BEFORE UPDATE ON invites
  FOR EACH ROW
  EXECUTE FUNCTION update_invites_updated_at();
