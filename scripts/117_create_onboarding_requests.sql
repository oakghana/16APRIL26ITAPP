-- Migration: New User Onboarding Requests
-- Workflow: pending_manager -> assigned -> in_progress -> completed / rejected

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
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT onboarding_status_check CHECK (
    status IN ('pending_manager','assigned','in_progress','completed','rejected')
  )
);

CREATE INDEX IF NOT EXISTS idx_onboarding_status ON public.onboarding_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_requester ON public.onboarding_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_assignee ON public.onboarding_requests(assigned_to_id, status);

COMMENT ON TABLE public.onboarding_requests IS 'IT workflow for new staff onboarding requests';
