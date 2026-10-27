-- Classify store requisitions for monthly, weekly, and quarterly reporting.
ALTER TABLE public.store_requisitions
  ADD COLUMN IF NOT EXISTS requisition_frequency TEXT NOT NULL DEFAULT 'monthly';

ALTER TABLE public.store_requisitions
  DROP CONSTRAINT IF EXISTS store_requisitions_frequency_check;

ALTER TABLE public.store_requisitions
  ADD CONSTRAINT store_requisitions_frequency_check
  CHECK (requisition_frequency IN ('weekly', 'monthly', 'quarterly'));

CREATE INDEX IF NOT EXISTS idx_store_requisitions_frequency
  ON public.store_requisitions(requisition_frequency);
