-- =============================================
-- Add User-Facing IDs Migration
-- Created: 2025-10-31
-- =============================================

-- =============================================
-- 1. Add new columns (idempotent - safe to run multiple times)
-- =============================================

-- Add company_code to companies table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'company_code'
  ) THEN
    ALTER TABLE companies ADD COLUMN company_code VARCHAR(20);
  END IF;
END $$;

-- Add user_id to users table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN user_id VARCHAR(50);
  END IF;
END $$;

-- Add display_id to work_orders table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'display_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN display_id VARCHAR(50);
  END IF;
END $$;

-- =============================================
-- 2. Create helper functions
-- =============================================

-- Function to generate company_code from company name
CREATE OR REPLACE FUNCTION generate_company_code(p_company_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  seq_num INTEGER;
  generated_code TEXT;
BEGIN
  -- Extract first 4-6 letters, remove special chars
  base_code := UPPER(REGEXP_REPLACE(p_company_name, '[^a-zA-Z]', '', 'g'));
  base_code := SUBSTRING(base_code, 1, 6);
  
  -- If base_code already unique, use it
  IF NOT EXISTS (SELECT 1 FROM companies c WHERE c.company_code = base_code) THEN
    RETURN base_code;
  END IF;
  
  -- Otherwise append number
  FOR seq_num IN 1..99 LOOP
    generated_code := base_code || seq_num::TEXT;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM companies c WHERE c.company_code = generated_code);
  END LOOP;
  
  RETURN generated_code;
END;
$$ LANGUAGE plpgsql;

-- Function to generate user_id from full_name
CREATE OR REPLACE FUNCTION generate_user_id(p_full_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_name TEXT;
  seq_num INTEGER;
  generated_user_id TEXT;
  first_name TEXT;
  last_name TEXT;
  name_parts TEXT[];
BEGIN
  -- Handle null or empty names
  IF p_full_name IS NULL OR TRIM(p_full_name) = '' THEN
    p_full_name := 'user';
  END IF;
  
  -- Split name into parts
  name_parts := string_to_array(TRIM(p_full_name), ' ');
  
  -- Get first and last name
  first_name := name_parts[1];
  last_name := CASE 
    WHEN array_length(name_parts, 1) > 1 THEN name_parts[array_length(name_parts, 1)]
    ELSE NULL
  END;
  
  -- Create base name (minimum 3 characters)
  IF last_name IS NOT NULL THEN
    -- First letter of first name + up to 4 letters of last name
    base_name := LOWER(REGEXP_REPLACE(
      SUBSTRING(first_name, 1, 1) || last_name,
      '[^a-zA-Z]', '', 'g'
    ));
    base_name := SUBSTRING(base_name, 1, 5);
  ELSE
    -- Only first name available, use up to 5 letters
    base_name := LOWER(REGEXP_REPLACE(first_name, '[^a-zA-Z]', '', 'g'));
    base_name := SUBSTRING(base_name, 1, 5);
  END IF;
  
  -- Ensure base_name is at least 3 characters (pad with first letter if needed)
  WHILE LENGTH(base_name) < 3 LOOP
    base_name := base_name || SUBSTRING(base_name, 1, 1);
  END LOOP;
  
  -- Find next available sequence number (no leading zeros)
  FOR seq_num IN 1..9999 LOOP
    generated_user_id := base_name || seq_num::TEXT;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = generated_user_id);
  END LOOP;
  
  RETURN generated_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate work_order display_id
CREATE OR REPLACE FUNCTION generate_work_order_display_id(p_company_code TEXT, p_created_date DATE)
RETURNS TEXT AS $$
DECLARE
  seq_num INTEGER;
  generated_display_id TEXT;
  comp_id UUID;
BEGIN
  -- Get company_id from company_code
  SELECT id INTO comp_id
  FROM companies 
  WHERE company_code = p_company_code;
  
  -- Get next sequence number for this company and date
  SELECT COALESCE(MAX(
    CASE 
      WHEN wo.display_id ~ '^WO-[A-Z0-9]+-[0-9]{8}-[0-9]{4}$' THEN
        CAST(SPLIT_PART(wo.display_id, '-', 4) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO seq_num
  FROM work_orders wo
  WHERE wo.company_id = comp_id
    AND DATE(wo.created_at) = p_created_date;
  
  -- Format: WO-<company_code>-YYYYMMDD-####
  generated_display_id := FORMAT('WO-%s-%s-%s', 
    p_company_code,
    TO_CHAR(p_created_date, 'YYYYMMDD'),
    LPAD(seq_num::TEXT, 4, '0')
  );
  
  RETURN generated_display_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 3. Backfill existing data
-- =============================================

-- Backfill company_code
UPDATE companies
SET company_code = generate_company_code(name)
WHERE company_code IS NULL;

-- Backfill user_id
UPDATE public.users
SET user_id = generate_user_id(COALESCE(full_name, email))
WHERE user_id IS NULL;

-- Backfill work_orders display_id
-- Must be done in order of creation to maintain sequence
DO $$
DECLARE
  wo_record RECORD;
  generated_display_id TEXT;
BEGIN
  FOR wo_record IN 
    SELECT wo.id, wo.company_id, wo.created_at, c.company_code
    FROM work_orders wo
    JOIN companies c ON c.id = wo.company_id
    WHERE wo.display_id IS NULL
    ORDER BY wo.company_id, wo.created_at
  LOOP
    -- Generate display_id first, store in variable
    generated_display_id := generate_work_order_display_id(
      wo_record.company_code,
      DATE(wo_record.created_at)
    );
    
    -- Update using the variable
    UPDATE work_orders
    SET display_id = generated_display_id
    WHERE id = wo_record.id;
  END LOOP;
END $$;

-- =============================================
-- 4. Add constraints (idempotent)
-- =============================================

-- Make columns NOT NULL after backfill
DO $$ 
BEGIN
  -- Set company_code NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' 
    AND column_name = 'company_code' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE companies ALTER COLUMN company_code SET NOT NULL;
  END IF;

  -- Set user_id NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'users' 
    AND column_name = 'user_id' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN user_id SET NOT NULL;
  END IF;

  -- Set display_id NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' 
    AND column_name = 'display_id' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE work_orders ALTER COLUMN display_id SET NOT NULL;
  END IF;
END $$;

-- Add unique constraints (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_company_code_unique'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_company_code_unique UNIQUE (company_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_user_id_unique'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_user_id_unique UNIQUE (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_display_id_unique'
  ) THEN
    ALTER TABLE work_orders ADD CONSTRAINT work_orders_display_id_unique UNIQUE (display_id);
  END IF;
END $$;

-- =============================================
-- 5. Create indexes (idempotent)
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_company_code ON companies(company_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_id ON public.users(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_display_id ON work_orders(display_id);

-- =============================================
-- 6. Create trigger for auto-generating display_id (idempotent)
-- =============================================

CREATE OR REPLACE FUNCTION set_work_order_display_id()
RETURNS TRIGGER AS $$
DECLARE
  comp_code TEXT;
BEGIN
  -- Only generate if display_id is not already set
  IF NEW.display_id IS NULL THEN
    -- Get company code
    SELECT company_code INTO comp_code
    FROM companies WHERE id = NEW.company_id;
    
    IF comp_code IS NULL THEN
      RAISE EXCEPTION 'Company not found for company_id: %', NEW.company_id;
    END IF;
    
    -- Generate and set display_id
    NEW.display_id := generate_work_order_display_id(comp_code, COALESCE(DATE(NEW.created_at), CURRENT_DATE));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS work_orders_set_display_id ON work_orders;

CREATE TRIGGER work_orders_set_display_id
  BEFORE INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_work_order_display_id();

-- =============================================
-- 7. Create trigger for auto-generating user_id on new users
-- =============================================

-- Update the existing handle_new_user function to generate user_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  full_name_val TEXT;
BEGIN
  full_name_val := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  
  INSERT INTO public.users (id, email, full_name, user_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    public.generate_user_id(full_name_val)
  );
  RETURN NEW;
END;
$$;

