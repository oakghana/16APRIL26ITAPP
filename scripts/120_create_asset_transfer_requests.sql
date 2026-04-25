-- Migration: IT Asset Transfer Requests
-- Workflow: pending_manager -> assigned -> in_progress -> completed / rejected

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

  CONSTRAINT asset_transfer_status_check CHECK (
    status IN ('pending_manager','assigned','in_progress','completed','rejected')
  ),
  CONSTRAINT asset_transfer_condition_check CHECK (
    handover_condition IN ('good','fair','needs_repair')
  )
);

CREATE INDEX IF NOT EXISTS idx_asset_transfer_status ON public.asset_transfer_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_transfer_requester ON public.asset_transfer_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfer_assignee ON public.asset_transfer_requests(assigned_to_id, status);

COMMENT ON TABLE public.asset_transfer_requests IS 'IT workflow for inter-department or inter-branch asset transfer requests';
