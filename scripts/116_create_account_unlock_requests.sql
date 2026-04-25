-- Migration: Account Unlock Requests
-- Workflow: pending_manager -> assigned -> in_progress -> awaiting_user_confirmation -> completed / rejected / reopened

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

  CONSTRAINT account_unlock_status_check CHECK (
    status IN ('pending_manager','assigned','in_progress','awaiting_user_confirmation','completed','reopened','rejected')
  ),
  CONSTRAINT account_unlock_urgency_check CHECK (
    urgency IN ('low','medium','high','critical')
  )
);

CREATE INDEX IF NOT EXISTS idx_account_unlock_status ON public.account_unlock_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_unlock_requester ON public.account_unlock_requests(requested_by_id, requested_by_email);
CREATE INDEX IF NOT EXISTS idx_account_unlock_assignee ON public.account_unlock_requests(assigned_to_id, status);

COMMENT ON TABLE public.account_unlock_requests IS 'IT workflow for locked account unlock requests';
