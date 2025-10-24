-- =============================================
-- Work Orders Migration
-- Created: 2025-10-23
-- =============================================

-- =============================================
-- Work Orders Table
-- =============================================
CREATE TABLE work_orders (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  equipment_id UUID, -- Will add FK constraint when equipment table is created
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL NOT NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Core fields
  title VARCHAR(255) NOT NULL,
  description TEXT CHECK (length(description) <= 5000),
  
  -- Status and priority
  status TEXT NOT NULL DEFAULT 'open' 
    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- Dates
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Flexible fields for company-specific data (type, cost, vendor, etc.)
  custom_fields JSONB DEFAULT '{}' NOT NULL,
  
  -- Constraints
  CONSTRAINT completed_at_requires_completed_status 
    CHECK (
      (status = 'completed' AND completed_at IS NOT NULL) OR
      (status != 'completed' AND completed_at IS NULL)
    )
);

-- =============================================
-- Work Order Attachments Table
-- =============================================
CREATE TABLE work_order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  file_type VARCHAR(100),
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================
-- Indexes
-- =============================================

-- Work Orders: Foreign key indexes (critical for JOINs and RLS performance)
CREATE INDEX idx_work_orders_company_id ON work_orders(company_id);
CREATE INDEX idx_work_orders_equipment_id ON work_orders(equipment_id);
CREATE INDEX idx_work_orders_created_by ON work_orders(created_by);
CREATE INDEX idx_work_orders_assigned_to ON work_orders(assigned_to);

-- Work Orders: Status filtering (very common query)
CREATE INDEX idx_work_orders_status ON work_orders(status);

-- Work Orders: Composite indexes for common query patterns
CREATE INDEX idx_work_orders_company_status ON work_orders(company_id, status);
CREATE INDEX idx_work_orders_assigned_status ON work_orders(assigned_to, status) 
  WHERE assigned_to IS NOT NULL;

-- Work Orders: Date-based queries
CREATE INDEX idx_work_orders_due_date ON work_orders(due_date) 
  WHERE due_date IS NOT NULL AND status != 'completed';

-- Work Orders: JSONB index for custom field queries
CREATE INDEX idx_work_orders_custom_fields ON work_orders USING GIN (custom_fields);

-- Work Order Attachments: Foreign key indexes
CREATE INDEX idx_work_order_attachments_work_order ON work_order_attachments(work_order_id);
CREATE INDEX idx_work_order_attachments_uploaded_by ON work_order_attachments(uploaded_by);

-- =============================================
-- Triggers
-- =============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_updated_at();

-- Auto-set completed_at when status changes to completed
CREATE OR REPLACE FUNCTION set_work_order_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  ELSIF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_orders_auto_complete
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION set_work_order_completed_at();

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_attachments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - READ (All authenticated users)
-- =============================================

-- Work Orders: Users can view work orders from their companies
CREATE POLICY work_orders_select_policy ON work_orders
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Work Order Attachments: Users can view attachments for work orders they can access
CREATE POLICY work_order_attachments_select_policy ON work_order_attachments
  FOR SELECT
  USING (
    work_order_id IN (
      SELECT id FROM work_orders
      WHERE company_id IN (
        SELECT company_id FROM user_companies 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- =============================================
-- RLS POLICIES - WRITE (Admin-only for MVP)
-- =============================================

-- MVP STRATEGY: Only admins can create/update/delete work orders
-- This allows API endpoints to use user session (createServerClient)
-- without complex permission logic during pilot phase
--
-- POST-MVP: Can either:
--   1. Add more granular RLS policies for different roles, OR
--   2. Switch API to service role + custom permission system

-- Work Orders: INSERT (Admin-only)
CREATE POLICY work_orders_insert_admin_policy ON work_orders
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
    AND created_by = auth.uid()
  );

-- Work Orders: UPDATE (Admin-only)
CREATE POLICY work_orders_update_admin_policy ON work_orders
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

-- Work Orders: DELETE (Admin-only)
CREATE POLICY work_orders_delete_admin_policy ON work_orders
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- Work Order Attachments: INSERT (Admin-only)
CREATE POLICY work_order_attachments_insert_admin_policy ON work_order_attachments
  FOR INSERT
  WITH CHECK (
    work_order_id IN (
      SELECT id FROM work_orders
      WHERE company_id IN (
        SELECT company_id FROM user_companies 
        WHERE user_id = auth.uid() 
          AND is_active = true 
          AND role = 'admin'
      )
    )
    AND uploaded_by = auth.uid()
  );

-- Work Order Attachments: DELETE (Admin-only)
CREATE POLICY work_order_attachments_delete_admin_policy ON work_order_attachments
  FOR DELETE
  USING (
    work_order_id IN (
      SELECT id FROM work_orders
      WHERE company_id IN (
        SELECT company_id FROM user_companies 
        WHERE user_id = auth.uid() 
          AND is_active = true 
          AND role = 'admin'
      )
    )
  );
