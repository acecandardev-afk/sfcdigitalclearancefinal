-- Add sequence_order column to clearance_signatures for sequential signing
ALTER TABLE public.clearance_signatures 
ADD COLUMN sequence_order integer NOT NULL DEFAULT 1;

-- Rename notes to remarks for clarity (already exists as 'notes', we'll add remarks separately)
ALTER TABLE public.clearance_signatures 
ADD COLUMN remarks text;

-- Create index for efficient ordering queries
CREATE INDEX idx_clearance_signatures_sequence ON public.clearance_signatures(clearance_request_id, sequence_order);