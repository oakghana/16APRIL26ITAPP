-- Add column to track when ticket entered awaiting_confirmation status
ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS awaiting_confirmation_since TIMESTAMP WITH TIME ZONE;

-- Index for finding tickets eligible for auto-confirmation
CREATE INDEX IF NOT EXISTS idx_service_tickets_awaiting_confirmation 
  ON public.service_tickets(status, awaiting_confirmation_since)
  WHERE status = 'awaiting_confirmation';

-- Add column to track if auto-confirmation was applied
ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS auto_confirmed BOOLEAN DEFAULT FALSE;
