-- Create activity logs table
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only superadmins can view all logs
CREATE POLICY "Superadmins can view all activity logs"
ON public.activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Users can view their own activity
CREATE POLICY "Users can view own activity"
ON public.activity_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own logs
CREATE POLICY "Users can log own activity"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for activity logs
ALTER TABLE public.activity_logs REPLICA IDENTITY FULL;