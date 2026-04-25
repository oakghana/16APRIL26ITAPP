-- Migration: User Offboarding / Access Revocation Requests
-- Workflow: pending_manager -> assigned -> in_progress -> completed / rejected

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

  CONSTRAINT offboarding_status_check CHECK (
    status IN ('pending_manager','assigned','in_progress','completed','rejected')
  ),
  CONSTRAINT offboarding_departure_reason_check CHECK (
    departure_reason IN ('resignation','transfer','retirement','contract_end','termination','other')
  )
);

CREATE INDEX IF NOT EXISTS idx_offboarding_status ON public.offboarding_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offboarding_requester ON public.offboarding_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_assignee ON public.offboarding_requests(assigned_to_id, status);

COMMENT ON TABLE public.offboarding_requests IS 'IT workflow for staff offboarding and access revocation';
