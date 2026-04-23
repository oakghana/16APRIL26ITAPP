-- Migration: Add dual-signature fields for IT forms approvals
-- Purpose: Persist HOD and IT Head/Admin digital signatures for audit and PDF export

-- Requisition workflow signatures
ALTER TABLE IF EXISTS public.it_equipment_requisitions
  ADD COLUMN IF NOT EXISTS department_head_signature text,
  ADD COLUMN IF NOT EXISTS it_head_signature text,
  ADD COLUMN IF NOT EXISTS admin_signature text;

-- New gadget workflow signatures
ALTER TABLE IF EXISTS public.new_gadget_requests
  ADD COLUMN IF NOT EXISTS department_head_signature text,
  ADD COLUMN IF NOT EXISTS it_head_signature text,
  ADD COLUMN IF NOT EXISTS admin_signature text;

-- Maintenance workflow signatures
ALTER TABLE IF EXISTS public.maintenance_repair_requests
  ADD COLUMN IF NOT EXISTS department_head_signature text,
  ADD COLUMN IF NOT EXISTS it_head_signature text,
  ADD COLUMN IF NOT EXISTS admin_signature text;

COMMENT ON COLUMN public.it_equipment_requisitions.department_head_signature IS 'Base64 PNG digital signature with embedded QCC IT APP hologram watermark';
COMMENT ON COLUMN public.it_equipment_requisitions.it_head_signature IS 'Base64 PNG digital signature with embedded QCC IT APP hologram watermark';
COMMENT ON COLUMN public.it_equipment_requisitions.admin_signature IS 'Base64 PNG digital signature with embedded QCC IT APP hologram watermark';

COMMENT ON COLUMN public.new_gadget_requests.department_head_signature IS 'Base64 PNG digital signature with embedded QCC IT APP hologram watermark';
COMMENT ON COLUMN public.new_gadget_requests.it_head_signature IS 'Base64 PNG digital signature with embedded QCC IT APP hologram watermark';
COMMENT ON COLUMN public.new_gadget_requests.admin_signature IS 'Base64 PNG digital signature with embedded QCC IT APP hologram watermark';

COMMENT ON COLUMN public.maintenance_repair_requests.department_head_signature IS 'Base64 PNG digital signature with embedded QCC IT APP hologram watermark';
COMMENT ON COLUMN public.maintenance_repair_requests.it_head_signature IS 'Base64 PNG digital signature with embedded QCC IT APP hologram watermark';
COMMENT ON COLUMN public.maintenance_repair_requests.admin_signature IS 'Base64 PNG digital signature with embedded QCC IT APP hologram watermark';
