-- Migration: Create password reset IT form workflow table
-- Purpose: Allow users to request password resets with IT-manager approval,
-- assignment to IT staff, and requester completion confirmation.

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
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT password_reset_requests_status_check CHECK (
    status IN (
      'pending_manager',
      'assigned',
      'in_progress',
      'awaiting_user_confirmation',
      'completed',
      'reopened',
      'rejected'
    )
  ),
  CONSTRAINT password_reset_requests_urgency_check CHECK (
    urgency IN ('low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT password_reset_requests_confirmation_status_check CHECK (
    confirmation_status IS NULL OR confirmation_status IN ('approved', 'rejected')
  ),
  CONSTRAINT password_reset_requests_other_system_required CHECK (
    system_name <> 'Other' OR (other_system_name IS NOT NULL AND btrim(other_system_name) <> '')
  )
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status
  ON public.password_reset_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_requester
  ON public.password_reset_requests(requested_by_id, requested_by_email);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_assignee
  ON public.password_reset_requests(assigned_to_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_location
  ON public.password_reset_requests(requester_location, status);

COMMENT ON TABLE public.password_reset_requests IS 'IT form workflow for account and application password reset requests';
COMMENT ON COLUMN public.password_reset_requests.system_name IS 'Target system/app name for password reset';
COMMENT ON COLUMN public.password_reset_requests.other_system_name IS 'Custom system name when system_name = Other';
COMMENT ON COLUMN public.password_reset_requests.status IS 'Workflow: pending_manager -> assigned/in_progress -> awaiting_user_confirmation -> completed';
COMMENT ON COLUMN public.password_reset_requests.user_confirmed IS 'Requester confirmed that new/reset password is working';
