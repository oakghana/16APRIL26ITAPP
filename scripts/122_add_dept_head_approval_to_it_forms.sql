-- =============================================================================
-- Migration 122: Add Department Head Approval Workflow to
--   onboarding_requests, software_access_requests, asset_transfer_requests
--
-- New workflow for these 3 forms:
--   pending_dept_head → dept_head_approved / dept_head_rejected
--   → pending_manager → assigned → in_progress → completed / rejected
--
-- Safe to run multiple times (uses IF NOT EXISTS / constraint checks).
-- =============================================================================

-- -------------------------------------------------------
-- Helper: add column if missing
-- -------------------------------------------------------
DO $$ BEGIN
  -- onboarding_requests
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='onboarding_requests' AND column_name='dept_head_id') THEN
    ALTER TABLE public.onboarding_requests ADD COLUMN dept_head_id uuid NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='onboarding_requests' AND column_name='dept_head_name') THEN
    ALTER TABLE public.onboarding_requests ADD COLUMN dept_head_name text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='onboarding_requests' AND column_name='dept_head_email') THEN
    ALTER TABLE public.onboarding_requests ADD COLUMN dept_head_email text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='onboarding_requests' AND column_name='dept_head_approved_at') THEN
    ALTER TABLE public.onboarding_requests ADD COLUMN dept_head_approved_at timestamptz NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='onboarding_requests' AND column_name='dept_head_notes') THEN
    ALTER TABLE public.onboarding_requests ADD COLUMN dept_head_notes text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='onboarding_requests' AND column_name='dept_head_signature') THEN
    ALTER TABLE public.onboarding_requests ADD COLUMN dept_head_signature text NULL;
  END IF;

  -- software_access_requests
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='software_access_requests' AND column_name='dept_head_id') THEN
    ALTER TABLE public.software_access_requests ADD COLUMN dept_head_id uuid NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='software_access_requests' AND column_name='dept_head_name') THEN
    ALTER TABLE public.software_access_requests ADD COLUMN dept_head_name text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='software_access_requests' AND column_name='dept_head_email') THEN
    ALTER TABLE public.software_access_requests ADD COLUMN dept_head_email text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='software_access_requests' AND column_name='dept_head_approved_at') THEN
    ALTER TABLE public.software_access_requests ADD COLUMN dept_head_approved_at timestamptz NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='software_access_requests' AND column_name='dept_head_notes') THEN
    ALTER TABLE public.software_access_requests ADD COLUMN dept_head_notes text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='software_access_requests' AND column_name='dept_head_signature') THEN
    ALTER TABLE public.software_access_requests ADD COLUMN dept_head_signature text NULL;
  END IF;

  -- asset_transfer_requests
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='asset_transfer_requests' AND column_name='dept_head_id') THEN
    ALTER TABLE public.asset_transfer_requests ADD COLUMN dept_head_id uuid NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='asset_transfer_requests' AND column_name='dept_head_name') THEN
    ALTER TABLE public.asset_transfer_requests ADD COLUMN dept_head_name text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='asset_transfer_requests' AND column_name='dept_head_email') THEN
    ALTER TABLE public.asset_transfer_requests ADD COLUMN dept_head_email text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='asset_transfer_requests' AND column_name='dept_head_approved_at') THEN
    ALTER TABLE public.asset_transfer_requests ADD COLUMN dept_head_approved_at timestamptz NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='asset_transfer_requests' AND column_name='dept_head_notes') THEN
    ALTER TABLE public.asset_transfer_requests ADD COLUMN dept_head_notes text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='asset_transfer_requests' AND column_name='dept_head_signature') THEN
    ALTER TABLE public.asset_transfer_requests ADD COLUMN dept_head_signature text NULL;
  END IF;
END $$;

-- -------------------------------------------------------
-- Update status CHECK constraints to include dept_head statuses
-- Drop old constraint and add new one for each table.
-- -------------------------------------------------------

-- onboarding_requests
ALTER TABLE public.onboarding_requests
  DROP CONSTRAINT IF EXISTS onboarding_status_check;
ALTER TABLE public.onboarding_requests
  ADD CONSTRAINT onboarding_status_check CHECK (
    status IN (
      'pending_dept_head',
      'dept_head_approved',
      'dept_head_rejected',
      'pending_manager',
      'assigned',
      'in_progress',
      'completed',
      'rejected',
      'reopened'
    )
  );

-- software_access_requests
ALTER TABLE public.software_access_requests
  DROP CONSTRAINT IF EXISTS software_access_status_check;
ALTER TABLE public.software_access_requests
  ADD CONSTRAINT software_access_status_check CHECK (
    status IN (
      'pending_dept_head',
      'dept_head_approved',
      'dept_head_rejected',
      'pending_manager',
      'assigned',
      'in_progress',
      'awaiting_user_confirmation',
      'completed',
      'reopened',
      'rejected'
    )
  );

-- asset_transfer_requests
ALTER TABLE public.asset_transfer_requests
  DROP CONSTRAINT IF EXISTS asset_transfer_status_check;
ALTER TABLE public.asset_transfer_requests
  ADD CONSTRAINT asset_transfer_status_check CHECK (
    status IN (
      'pending_dept_head',
      'dept_head_approved',
      'dept_head_rejected',
      'pending_manager',
      'assigned',
      'in_progress',
      'completed',
      'rejected',
      'reopened'
    )
  );

-- -------------------------------------------------------
-- Reload PostgREST schema cache
-- -------------------------------------------------------
NOTIFY pgrst, 'reload schema';

SELECT 'Migration 122 applied: dept_head approval fields added to 3 IT form tables' AS result;
