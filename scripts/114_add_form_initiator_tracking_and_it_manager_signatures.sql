-- Migration: Add form initiator tracking and extend signature support to IT Manager
-- Purpose: Track which IT staff/Regional IT Head initiated each form request,
--          and enable IT Manager to upload and manage signatures.

-- 1) Add initiator tracking columns to IT request forms
ALTER TABLE IF EXISTS public.new_gadget_requests
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS created_by_email text;

ALTER TABLE IF EXISTS public.maintenance_repair_requests
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS created_by_email text;

ALTER TABLE IF EXISTS public.it_equipment_requisitions
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS created_by_email text;

COMMENT ON COLUMN public.new_gadget_requests.created_by IS 'Name of IT staff or Regional IT Head who initiated the request';
COMMENT ON COLUMN public.new_gadget_requests.created_by_role IS 'Role of person who initiated (it_staff or regional_it_head)';
COMMENT ON COLUMN public.new_gadget_requests.created_by_email IS 'Email of the initiator for tracking';

COMMENT ON COLUMN public.maintenance_repair_requests.created_by IS 'Name of IT staff or Regional IT Head who initiated the request';
COMMENT ON COLUMN public.maintenance_repair_requests.created_by_role IS 'Role of person who initiated (it_staff or regional_it_head)';
COMMENT ON COLUMN public.maintenance_repair_requests.created_by_email IS 'Email of the initiator for tracking';

COMMENT ON COLUMN public.it_equipment_requisitions.created_by IS 'Name of IT staff or Regional IT Head who initiated the request';
COMMENT ON COLUMN public.it_equipment_requisitions.created_by_role IS 'Role of person who initiated (it_staff or regional_it_head)';
COMMENT ON COLUMN public.it_equipment_requisitions.created_by_email IS 'Email of the initiator for tracking';

-- 2) Backfill created_by information from existing data where available
-- For new_gadget_requests: use created_at and staff_name as approximation
UPDATE public.new_gadget_requests
SET
  created_by = COALESCE(created_by, staff_name),
  created_by_role = COALESCE(created_by_role, 'it_staff'),
  updated_at = now()
WHERE created_by IS NULL AND staff_name IS NOT NULL;

-- For maintenance_repair_requests: use from created_at timestamp
UPDATE public.maintenance_repair_requests
SET
  created_by_role = COALESCE(created_by_role, 'it_staff'),
  updated_at = now()
WHERE created_by_role IS NULL;

-- 3) Create table for IT Manager signature profiles (extends existing signature support)
-- This allows IT Manager (who may be department_head of IT department) to store signatures
INSERT INTO public.it_form_signature_profiles (user_id, role, signature_data_url, created_at, updated_at)
SELECT DISTINCT
  p.id,
  'it_manager' as role,
  NULL::text as signature_data_url,
  now(),
  now()
FROM public.profiles p
WHERE lower(p.role) = 'department_head'
  AND lower(p.department) LIKE '%it%'
  AND NOT EXISTS (
    SELECT 1 FROM public.it_form_signature_profiles sp
    WHERE sp.user_id = p.id AND sp.role = 'it_manager'
  );

-- 4) Create index for faster initiator lookups
CREATE INDEX IF NOT EXISTS idx_new_gadget_created_by 
  ON public.new_gadget_requests(created_by, created_by_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_created_by 
  ON public.maintenance_repair_requests(created_by, created_by_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_created_by 
  ON public.it_equipment_requisitions(created_by, created_by_role, created_at DESC);
