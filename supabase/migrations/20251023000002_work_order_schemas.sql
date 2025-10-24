-- =============================================
-- Work Order Schemas Migration
-- Created: 2025-10-23
-- =============================================

-- =============================================
-- Work Order Schemas Table
-- Stores custom field definitions for work orders per company
-- =============================================
CREATE TABLE work_order_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  schema_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(company_id) -- One schema per company
);

-- =============================================
-- Indexes
-- =============================================

CREATE INDEX idx_work_order_schemas_company ON work_order_schemas(company_id);
CREATE INDEX idx_work_order_schemas_definition ON work_order_schemas USING GIN (schema_definition);

-- =============================================
-- Trigger for updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_work_order_schemas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_order_schemas_updated_at
  BEFORE UPDATE ON work_order_schemas
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_schemas_updated_at();

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE work_order_schemas ENABLE ROW LEVEL SECURITY;

-- READ: All company members can view their company's schema
CREATE POLICY work_order_schemas_select_policy ON work_order_schemas
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- WRITE: Admin-only (for MVP)
CREATE POLICY work_order_schemas_insert_admin_policy ON work_order_schemas
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

CREATE POLICY work_order_schemas_update_admin_policy ON work_order_schemas
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

CREATE POLICY work_order_schemas_delete_admin_policy ON work_order_schemas
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
-- Default Schema Trigger
-- =============================================

-- Function to create default work order schema when company is created
CREATE OR REPLACE FUNCTION create_default_work_order_schema()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO work_order_schemas (company_id, schema_definition)
  VALUES (
    NEW.id,
    jsonb_build_object(
      'entity_alias', 'work_order',
      'fields', jsonb_build_array(
        -- Core field: title
        jsonb_build_object(
          'internal_name', 'title',
          'display_name', 'Title',
          'type', 'text',
          'required', true,
          'core_field', true
        ),
        -- Core field: description
        jsonb_build_object(
          'internal_name', 'description',
          'display_name', 'Description',
          'type', 'textarea',
          'required', false,
          'core_field', true
        ),
        -- Core field: status
        jsonb_build_object(
          'internal_name', 'status',
          'display_name', 'Status',
          'type', 'select',
          'required', true,
          'core_field', true,
          'options', jsonb_build_array('open', 'in_progress', 'completed', 'cancelled')
        ),
        -- Core field: priority
        jsonb_build_object(
          'internal_name', 'priority',
          'display_name', 'Priority',
          'type', 'select',
          'required', true,
          'core_field', true,
          'options', jsonb_build_array('low', 'medium', 'high', 'critical')
        ),
        -- Core field: due_date
        jsonb_build_object(
          'internal_name', 'due_date',
          'display_name', 'Due Date',
          'type', 'date',
          'required', false,
          'core_field', true
        ),
        -- Custom field: type (default for all companies)
        jsonb_build_object(
          'internal_name', 'type',
          'display_name', 'Work Order Type',
          'type', 'select',
          'required', false,
          'core_field', false,
          'options', jsonb_build_array('Corrective', 'Preventive', 'Inspection', 'Emergency', 'Project')
        ),
        -- Custom field: cost_estimate
        jsonb_build_object(
          'internal_name', 'cost_estimate',
          'display_name', 'Estimated Cost',
          'type', 'number',
          'required', false,
          'core_field', false
        ),
        -- Custom field: parts_needed
        jsonb_build_object(
          'internal_name', 'parts_needed',
          'display_name', 'Parts Needed',
          'type', 'multiselect',
          'required', false,
          'core_field', false
        )
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create default schema when company is created
CREATE TRIGGER on_company_created_work_order_schema
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_work_order_schema();

-- =============================================
-- Seed Default Schemas for Existing Companies
-- =============================================

-- Add default work order schema for any existing companies
INSERT INTO work_order_schemas (company_id, schema_definition)
SELECT 
  c.id,
  jsonb_build_object(
    'entity_alias', 'work_order',
    'fields', jsonb_build_array(
      jsonb_build_object(
        'internal_name', 'title',
        'display_name', 'Title',
        'type', 'text',
        'required', true,
        'core_field', true
      ),
      jsonb_build_object(
        'internal_name', 'description',
        'display_name', 'Description',
        'type', 'textarea',
        'required', false,
        'core_field', true
      ),
      jsonb_build_object(
        'internal_name', 'status',
        'display_name', 'Status',
        'type', 'select',
        'required', true,
        'core_field', true,
        'options', jsonb_build_array('open', 'in_progress', 'completed', 'cancelled')
      ),
      jsonb_build_object(
        'internal_name', 'priority',
        'display_name', 'Priority',
        'type', 'select',
        'required', true,
        'core_field', true,
        'options', jsonb_build_array('low', 'medium', 'high', 'critical')
      ),
      jsonb_build_object(
        'internal_name', 'due_date',
        'display_name', 'Due Date',
        'type', 'date',
        'required', false,
        'core_field', true
      ),
      jsonb_build_object(
        'internal_name', 'type',
        'display_name', 'Work Order Type',
        'type', 'select',
        'required', false,
        'core_field', false,
        'options', jsonb_build_array('Corrective', 'Preventive', 'Inspection', 'Emergency', 'Project')
      ),
      jsonb_build_object(
        'internal_name', 'cost_estimate',
        'display_name', 'Estimated Cost',
        'type', 'number',
        'required', false,
        'core_field', false
      ),
      jsonb_build_object(
        'internal_name', 'parts_needed',
        'display_name', 'Parts Needed',
        'type', 'multiselect',
        'required', false,
        'core_field', false
      )
    )
  )
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM work_order_schemas wos 
  WHERE wos.company_id = c.id
);
