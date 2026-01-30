-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  related_id UUID NULL,
  related_type TEXT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" 
ON public.notifications 
FOR DELETE 
USING (auth.uid() = user_id);

-- Service role can insert notifications (for triggers/edge functions)
CREATE POLICY "Service role can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create trigger function to create notifications when signatures are approved/rejected
CREATE OR REPLACE FUNCTION public.notify_on_signature_update()
RETURNS TRIGGER AS $$
DECLARE
  clearance_title TEXT;
  student_id UUID;
  signatory_name TEXT;
  next_signatory_user_id UUID;
  next_sig RECORD;
BEGIN
  -- Only proceed if status changed to approved or rejected
  IF NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending' THEN
    -- Get clearance info
    SELECT cr.title, cr.student_id INTO clearance_title, student_id
    FROM public.clearance_requests cr
    WHERE cr.id = NEW.clearance_request_id;
    
    -- Get signatory name
    SELECT s.name INTO signatory_name
    FROM public.signatories s
    WHERE s.id = NEW.signatory_id;
    
    -- Notify the student
    INSERT INTO public.notifications (user_id, title, message, type, related_id, related_type)
    VALUES (
      student_id,
      CASE WHEN NEW.status = 'approved' THEN 'Clearance Approved' ELSE 'Clearance Rejected' END,
      signatory_name || ' has ' || NEW.status || ' your clearance "' || clearance_title || '"',
      CASE WHEN NEW.status = 'approved' THEN 'success' ELSE 'error' END,
      NEW.clearance_request_id,
      'clearance'
    );
    
    -- If approved, notify the next signatory in sequence
    IF NEW.status = 'approved' THEN
      SELECT cs.signatory_id, s.user_id INTO next_sig
      FROM public.clearance_signatures cs
      JOIN public.signatories s ON s.id = cs.signatory_id
      WHERE cs.clearance_request_id = NEW.clearance_request_id
        AND cs.sequence_order > NEW.sequence_order
        AND cs.status = 'pending'
      ORDER BY cs.sequence_order
      LIMIT 1;
      
      IF next_sig.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, related_id, related_type)
        VALUES (
          next_sig.user_id,
          'Signature Required',
          'A clearance request "' || clearance_title || '" is now ready for your signature',
          'info',
          NEW.clearance_request_id,
          'clearance'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER on_signature_status_change
  AFTER UPDATE ON public.clearance_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_signature_update();

-- Create trigger function to notify first signatory when clearance is created
CREATE OR REPLACE FUNCTION public.notify_first_signatory()
RETURNS TRIGGER AS $$
DECLARE
  clearance_title TEXT;
  first_signatory_user_id UUID;
BEGIN
  -- Get clearance title
  SELECT cr.title INTO clearance_title
  FROM public.clearance_requests cr
  WHERE cr.id = NEW.clearance_request_id;
  
  -- Only notify if this is the first signatory (sequence_order = 1)
  IF NEW.sequence_order = 1 THEN
    SELECT s.user_id INTO first_signatory_user_id
    FROM public.signatories s
    WHERE s.id = NEW.signatory_id;
    
    IF first_signatory_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_id, related_type)
      VALUES (
        first_signatory_user_id,
        'New Clearance Request',
        'A new clearance request "' || clearance_title || '" requires your signature',
        'info',
        NEW.clearance_request_id,
        'clearance'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new signatures
CREATE TRIGGER on_signature_created
  AFTER INSERT ON public.clearance_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_first_signatory();