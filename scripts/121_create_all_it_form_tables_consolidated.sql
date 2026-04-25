-- =============================================================================
-- Migration 121: Create All IT Form Workflow Tables (Consolidated)
-- Run this in the Supabase SQL Editor to create all new IT form tables.
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$ blocks).
-- =============================================================================

-- -------------------------------------------------------
-- 1. password_reset_requests
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  staff_name text NOT NULL,
  requested_by_id uuid NULL,
  requested_by_email text NULL,
  department_name text NULL,
  requester_location text NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,

  system_name text NOT NULL,
  other_system_name text NULL,
  account_identifier text NOT NULL,
  issue_summary text NOT NULL,
  urgency text NOT NULL DEFAULT 'medium',

  status text NOT NULL DEFAULT 'pending_manager',

  manager_approved_by text NULL,
  manager_approved_by_id uuid NULL,
  manager_approved_at timestamptz NULL,
  manager_notes text NULL,
  manager_signature text NULL,

  assigned_to text NULL,
  assigned_to_id uuid NULL,
  assigned_to_name text NULL,
  assigned_to_email text NULL,
  assigned_to_role text NULL,
  assigned_at timestamptz NULL,

  work_started_at timestamptz NULL,
  work_completed_at timestamptz NULL,
  work_notes text NULL,
  submitted_for_confirmation_at timestamptz NULL,

  user_confirmed boolean NOT NULL DEFAULT false,
  user_confirmed_by text NULL,
  user_confirmed_by_id uuid NULL,
  user_confirmed_at timestamptz NULL,
  confirmation_status text NULL,
  confirmation_notes text NULL,
  closed_at timestamptz NULL,

  approval_timeline jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by text NULL,
  created_by_role text NULL,
  created_by_email text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add columns that may be missing from an older version of the table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='password_reset_requests' AND column_name='assigned_to_name') THEN
    ALTER TABLE public.password_reset_requests ADD COLUMN assigned_to_name text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='password_reset_requests' AND column_name='assigned_to_email') THEN
    ALTER TABLE public.password_reset_requests ADD COLUMN assigned_to_email text NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status
  ON public.password_reset_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_requester
  ON public.password_reset_requests(requested_by_id, requested_by_email);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_assignee
  ON public.password_reset_requests(assigned_to_id, status, updated_at DESC);

ALTER TABLE IF EXISTS public.password_reset_requests DISABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 2. account_unlock_requests
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_unlock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  staff_name text NOT NULL,
  requested_by_id uuid NULL,
  requested_by_email text NULL,
  department_name text NULL,
  requester_location text NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,

  locked_system text NOT NULL,
  other_system_name text NULL,
  account_identifier text NOT NULL,
  lock_description text NOT NULL,
  urgency text NOT NULL DEFAULT 'medium',

  status text NOT NULL DEFAULT 'pending_manager',

  manager_approved_by text NULL,
  manager_approved_by_id uuid NULL,
  manager_approved_at timestamptz NULL,
  manager_notes text NULL,
  manager_signature text NULL,

  assigned_to text NULL,
  assigned_to_id uuid NULL,
  assigned_to_name text NULL,
  assigned_to_email text NULL,
  assigned_to_role text NULL,
  assigned_at timestamptz NULL,

  work_started_at timestamptz NULL,
  work_completed_at timestamptz NULL,
  work_notes text NULL,
  submitted_for_confirmation_at timestamptz NULL,

  user_confirmed boolean NOT NULL DEFAULT false,
  user_confirmed_by text NULL,
  user_confirmed_by_id uuid NULL,
  user_confirmed_at timestamptz NULL,
  confirmation_status text NULL,
  confirmation_notes text NULL,
  closed_at timestamptz NULL,

  approval_timeline jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by text NULL,
  created_by_role text NULL,
  created_by_email text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='account_unlock_requests' AND column_name='assigned_to_name') THEN
    ALTER TABLE public.account_unlock_requests ADD COLUMN assigned_to_name text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='account_unlock_requests' AND column_name='assigned_to_email') THEN
    ALTER TABLE public.account_unlock_requests ADD COLUMN assigned_to_email text NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_account_unlock_status ON public.account_unlock_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_unlock_requester ON public.account_unlock_requests(requested_by_id, requested_by_email);
CREATE INDEX IF NOT EXISTS idx_account_unlock_assignee ON public.account_unlock_requests(assigned_to_id, status);

ALTER TABLE IF EXISTS public.account_unlock_requests DISABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 3. onboarding_requests
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  staff_name text NOT NULL,
  requested_by_id uuid NULL,
  requested_by_email text NULL,
  department_name text NULL,
  requester_location text NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,

  new_staff_name text NOT NULL,
  new_staff_email text NULL,
  new_staff_role text NULL,
  new_staff_department text NOT NULL,
  new_staff_location text NOT NULL,
  start_date date NOT NULL,
  special_requirements text NULL,

  status text NOT NULL DEFAULT 'pending_manager',

  manager_approved_by text NULL,
  manager_approved_by_id uuid NULL,
  manager_approved_at timestamptz NULL,
  manager_notes text NULL,
  manager_signature text NULL,

  assigned_to text NULL,
  assigned_to_id uuid NULL,
  assigned_to_name text NULL,
  assigned_to_email text NULL,
  assigned_to_role text NULL,
  assigned_at timestamptz NULL,

  work_started_at timestamptz NULL,
  work_completed_at timestamptz NULL,
  work_notes text NULL,

  approval_timeline jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by text NULL,
  created_by_role text NULL,
  created_by_email text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='onboarding_requests' AND column_name='assigned_to_name') THEN
    ALTER TABLE public.onboarding_requests ADD COLUMN assigned_to_name text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='onboarding_requests' AND column_name='assigned_to_email') THEN
    ALTER TABLE public.onboarding_requests ADD COLUMN assigned_to_email text NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_onboarding_status ON public.onboarding_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_requester ON public.onboarding_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_assignee ON public.onboarding_requests(assigned_to_id, status);

ALTER TABLE IF EXISTS public.onboarding_requests DISABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 4. offboarding_requests
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offboarding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  staff_name text NOT NULL,
  requested_by_id uuid NULL,
  requested_by_email text NULL,
  department_name text NULL,
  requester_location text NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,

  departing_staff_name text NOT NULL,
  departing_staff_email text NULL,
  departing_staff_role text NULL,
  departing_staff_department text NOT NULL,
  last_work_date date NOT NULL,
  departure_reason text NOT NULL DEFAULT 'resignation',
  special_notes text NULL,

  status text NOT NULL DEFAULT 'pending_manager',

  manager_approved_by text NULL,
  manager_approved_by_id uuid NULL,
  manager_approved_at timestamptz NULL,
  manager_notes text NULL,
  manager_signature text NULL,

  assigned_to text NULL,
  assigned_to_id uuid NULL,
  assigned_to_name text NULL,
  assigned_to_email text NULL,
  assigned_to_role text NULL,
  assigned_at timestamptz NULL,

  work_started_at timestamptz NULL,
  work_completed_at timestamptz NULL,
  work_notes text NULL,

  approval_timeline jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by text NULL,
  created_by_role text NULL,
  created_by_email text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='offboarding_requests' AND column_name='assigned_to_name') THEN
    ALTER TABLE public.offboarding_requests ADD COLUMN assigned_to_name text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='offboarding_requests' AND column_name='assigned_to_email') THEN
    ALTER TABLE public.offboarding_requests ADD COLUMN assigned_to_email text NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_offboarding_status ON public.offboarding_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offboarding_requester ON public.offboarding_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_assignee ON public.offboarding_requests(assigned_to_id, status);

ALTER TABLE IF EXISTS public.offboarding_requests DISABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 5. software_access_requests
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.software_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  staff_name text NOT NULL,
  requested_by_id uuid NULL,
  requested_by_email text NULL,
  department_name text NULL,
  requester_location text NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,

  software_name text NOT NULL,
  other_software_name text NULL,
  access_level text NOT NULL DEFAULT 'standard',
  justification text NOT NULL,
  urgency text NOT NULL DEFAULT 'medium',

  status text NOT NULL DEFAULT 'pending_manager',

  manager_approved_by text NULL,
  manager_approved_by_id uuid NULL,
  manager_approved_at timestamptz NULL,
  manager_notes text NULL,
  manager_signature text NULL,

  assigned_to text NULL,
  assigned_to_id uuid NULL,
  assigned_to_name text NULL,
  assigned_to_email text NULL,
  assigned_to_role text NULL,
  assigned_at timestamptz NULL,

  work_started_at timestamptz NULL,
  work_completed_at timestamptz NULL,
  work_notes text NULL,
  submitted_for_confirmation_at timestamptz NULL,

  user_confirmed boolean NOT NULL DEFAULT false,
  user_confirmed_by text NULL,
  user_confirmed_by_id uuid NULL,
  user_confirmed_at timestamptz NULL,
  confirmation_status text NULL,
  confirmation_notes text NULL,
  closed_at timestamptz NULL,

  approval_timeline jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by text NULL,
  created_by_role text NULL,
  created_by_email text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='software_access_requests' AND column_name='assigned_to_name') THEN
    ALTER TABLE public.software_access_requests ADD COLUMN assigned_to_name text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='software_access_requests' AND column_name='assigned_to_email') THEN
    ALTER TABLE public.software_access_requests ADD COLUMN assigned_to_email text NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_software_access_status ON public.software_access_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_software_access_requester ON public.software_access_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_software_access_assignee ON public.software_access_requests(assigned_to_id, status);

ALTER TABLE IF EXISTS public.software_access_requests DISABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 6. asset_transfer_requests
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  staff_name text NOT NULL,
  requested_by_id uuid NULL,
  requested_by_email text NULL,
  department_name text NULL,
  requester_location text NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,

  asset_type text NOT NULL,
  asset_description text NOT NULL,
  serial_number text NULL,
  from_department text NOT NULL,
  from_location text NOT NULL,
  to_department text NOT NULL,
  to_location text NOT NULL,
  transfer_reason text NOT NULL,
  handover_condition text NOT NULL DEFAULT 'good',

  status text NOT NULL DEFAULT 'pending_manager',

  manager_approved_by text NULL,
  manager_approved_by_id uuid NULL,
  manager_approved_at timestamptz NULL,
  manager_notes text NULL,
  manager_signature text NULL,

  assigned_to text NULL,
  assigned_to_id uuid NULL,
  assigned_to_name text NULL,
  assigned_to_email text NULL,
  assigned_to_role text NULL,
  assigned_at timestamptz NULL,

  work_started_at timestamptz NULL,
  work_completed_at timestamptz NULL,
  work_notes text NULL,

  approval_timeline jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by text NULL,
  created_by_role text NULL,
  created_by_email text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='asset_transfer_requests' AND column_name='assigned_to_name') THEN
    ALTER TABLE public.asset_transfer_requests ADD COLUMN assigned_to_name text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='asset_transfer_requests' AND column_name='assigned_to_email') THEN
    ALTER TABLE public.asset_transfer_requests ADD COLUMN assigned_to_email text NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_asset_transfer_status ON public.asset_transfer_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_transfer_requester ON public.asset_transfer_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfer_assignee ON public.asset_transfer_requests(assigned_to_id, status);

ALTER TABLE IF EXISTS public.asset_transfer_requests DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Grant permissions to authenticated and service_role
-- =============================================================================
DO $$ 
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'password_reset_requests',
    'account_unlock_requests',
    'onboarding_requests',
    'offboarding_requests',
    'software_access_requests',
    'asset_transfer_requests'
  ] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO anon', t);
  END LOOP;
END $$;

-- =============================================================================
-- Notify PostgREST to reload schema cache
-- =============================================================================
NOTIFY pgrst, 'reload schema';

SELECT 'All 6 IT form tables created/verified successfully' AS result;
