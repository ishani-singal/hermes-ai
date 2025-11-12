-- =============================================
-- Add Equipment Foreign Key to Work Orders
-- Created: 2025-11-11
-- Purpose: Link work orders to equipment after equipment table exists
-- =============================================

-- Add the foreign key constraint that was previously deferred
ALTER TABLE work_orders
ADD CONSTRAINT fk_work_orders_equipment_id
FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL;

-- =============================================
-- Notes
-- =============================================

-- This migration completes the equipment-work order relationship.
-- Previously, equipment_id was a column without a FK constraint
-- to avoid circular dependencies. Now that the equipment table exists,
-- we can safely add the constraint.
