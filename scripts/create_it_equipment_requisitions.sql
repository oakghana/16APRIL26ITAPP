-- Create IT Equipment Requisitions table
CREATE TABLE IF NOT EXISTS it_equipment_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  reg_no text UNIQUE NOT NULL,
  item_sn text,
  supplier_name text,
  department_id integer REFERENCES lookup_departments(id),
  department_name text,
  
  -- Request Details
  items_required text,
  purpose text,
  
  -- Requester Info
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_by_name text,
  staff_name text,
  staff_email text,
  
  -- Status & Workflow
  status text NOT NULL DEFAULT 'draft', -- draft, pending, approved_by_service_desk, approved_by_it_head, approved_by_admin, rejected, issued
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  submitted_at timestamp with time zone,
  
  -- Service Desk Head Approval
  service_desk_approved_at timestamp with time zone,
  service_desk_approved_by uuid REFERENCES profiles(id),
  service_desk_approved_by_name text,
  service_desk_approval_comments text,
  
  -- IT Head Approval
  it_head_approved_at timestamp with time zone,
  it_head_approved_by uuid REFERENCES profiles(id),
  it_head_approved_by_name text,
  it_head_approval_comments text,
  it_head_signature text,
  
  -- Admin Approval
  admin_approved_at timestamp with time zone,
  admin_approved_by uuid REFERENCES profiles(id),
  admin_approved_by_name text,
  admin_approval_comments text,
  admin_signature text,
  
  -- Rejection
  rejected_at timestamp with time zone,
  rejected_by uuid REFERENCES profiles(id),
  rejected_by_name text,
  rejection_reason text,
  
  -- Issuance
  issued_at timestamp with time zone,
  issued_by uuid REFERENCES profiles(id),
  issued_by_name text,
  siv_number text,
  waybill_number text,
  quantity_released integer,
  issuance_notes text
);

-- Create IT Equipment Requisition Approvals (Audit Trail)
CREATE TABLE IF NOT EXISTS it_equipment_requisition_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES it_equipment_requisitions(id) ON DELETE CASCADE,
  
  performed_by uuid NOT NULL REFERENCES profiles(id),
  performed_by_name text,
  performed_by_role text,
  
  action text NOT NULL, -- approve, reject, resubmit
  comments text,
  
  created_at timestamp with time zone DEFAULT now()
);

-- Create Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_it_equipment_requisitions_status ON it_equipment_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_it_equipment_requisitions_created_by ON it_equipment_requisitions(created_by);
CREATE INDEX IF NOT EXISTS idx_it_equipment_requisitions_created_at ON it_equipment_requisitions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_it_equipment_requisitions_department ON it_equipment_requisitions(department_id);
CREATE INDEX IF NOT EXISTS idx_it_equipment_requisition_approvals_requisition_id ON it_equipment_requisition_approvals(requisition_id);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_it_equipment_requisitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_it_equipment_requisitions_updated_at ON it_equipment_requisitions;
CREATE TRIGGER trigger_it_equipment_requisitions_updated_at
  BEFORE UPDATE ON it_equipment_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION update_it_equipment_requisitions_updated_at();
