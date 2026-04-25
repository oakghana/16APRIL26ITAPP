-- Migration: Software / App Access Requests
-- Workflow: pending_manager -> assigned -> in_progress -> awaiting_user_confirmation -> completed / rejected / reopened

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

  CONSTRAINT software_access_status_check CHECK (
    status IN ('pending_manager','assigned','in_progress','awaiting_user_confirmation','completed','reopened','rejected')
  ),
  CONSTRAINT software_access_level_check CHECK (
    access_level IN ('view_only','standard','admin')
  ),
  CONSTRAINT software_access_urgency_check CHECK (
    urgency IN ('low','medium','high','critical')
  )
);

CREATE INDEX IF NOT EXISTS idx_software_access_status ON public.software_access_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_software_access_requester ON public.software_access_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_software_access_assignee ON public.software_access_requests(assigned_to_id, status);

COMMENT ON TABLE public.software_access_requests IS 'IT workflow for software and application access grant requests';
