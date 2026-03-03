-- ============================================================
-- RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR (one at a time or all)
-- Order: 1 through 9
-- ============================================================

-- ========== 1. 20251207015820 ==========
-- Create enum for clearance status
CREATE TYPE public.clearance_status AS ENUM ('pending', 'in_progress', 'approved', 'rejected');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('student', 'signatory', 'superadmin');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  student_id TEXT UNIQUE,
  year_level TEXT,
  course TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create signatories table
CREATE TABLE public.signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  department TEXT NOT NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create clearance_requests table
CREATE TABLE public.clearance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status clearance_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create clearance_files table
CREATE TABLE public.clearance_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clearance_request_id UUID REFERENCES public.clearance_requests(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create clearance_signatures table
CREATE TABLE public.clearance_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clearance_request_id UUID REFERENCES public.clearance_requests(id) ON DELETE CASCADE NOT NULL,
  signatory_id UUID REFERENCES public.signatories(id) ON DELETE CASCADE NOT NULL,
  status clearance_status DEFAULT 'pending',
  signed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearance_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearance_signatures ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Superadmins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'superadmin'));

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Superadmins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'superadmin'));

-- Signatories policies
CREATE POLICY "Anyone can view active signatories" ON public.signatories FOR SELECT USING (is_active = true);
CREATE POLICY "Superadmins can manage signatories" ON public.signatories FOR ALL USING (public.has_role(auth.uid(), 'superadmin'));

-- Clearance requests policies
CREATE POLICY "Students can view own requests" ON public.clearance_requests FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can create own requests" ON public.clearance_requests FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can update own requests" ON public.clearance_requests FOR UPDATE USING (auth.uid() = student_id);
CREATE POLICY "Signatories can view assigned requests" ON public.clearance_requests FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clearance_signatures cs
    JOIN public.signatories s ON cs.signatory_id = s.id
    WHERE cs.clearance_request_id = clearance_requests.id AND s.user_id = auth.uid()
  )
);
CREATE POLICY "Superadmins can view all requests" ON public.clearance_requests FOR SELECT USING (public.has_role(auth.uid(), 'superadmin'));

-- Clearance files policies
CREATE POLICY "Users can view files for own requests" ON public.clearance_files FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clearance_requests cr WHERE cr.id = clearance_request_id AND cr.student_id = auth.uid())
);
CREATE POLICY "Users can upload files to own requests" ON public.clearance_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clearance_requests cr WHERE cr.id = clearance_request_id AND cr.student_id = auth.uid())
);
CREATE POLICY "Signatories can view assigned files" ON public.clearance_files FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clearance_signatures cs
    JOIN public.signatories s ON cs.signatory_id = s.id
    WHERE cs.clearance_request_id = clearance_files.clearance_request_id AND s.user_id = auth.uid()
  )
);

-- Clearance signatures policies
CREATE POLICY "Students can view signatures for own requests" ON public.clearance_signatures FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clearance_requests cr WHERE cr.id = clearance_request_id AND cr.student_id = auth.uid())
);
CREATE POLICY "Students can add signatures to own requests" ON public.clearance_signatures FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clearance_requests cr WHERE cr.id = clearance_request_id AND cr.student_id = auth.uid())
);
CREATE POLICY "Signatories can update own signatures" ON public.clearance_signatures FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.signatories s WHERE s.id = signatory_id AND s.user_id = auth.uid())
);
CREATE POLICY "Signatories can view own signatures" ON public.clearance_signatures FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.signatories s WHERE s.id = signatory_id AND s.user_id = auth.uid())
);

-- Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('clearance-files', 'clearance-files', false);

CREATE POLICY "Users can upload clearance files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'clearance-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'clearance-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Signatories can view files" ON storage.objects
  FOR SELECT USING (bucket_id = 'clearance-files' AND public.has_role(auth.uid(), 'signatory'));

-- Trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clearance_requests_updated_at BEFORE UPDATE ON public.clearance_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_signatories_updated_at BEFORE UPDATE ON public.signatories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.clearance_signatures;


-- ========== 2. 20251207015828 ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ========== 3. 20251209012530 ==========
DROP POLICY IF EXISTS "Students can view signatures for own requests" ON public.clearance_signatures;
DROP POLICY IF EXISTS "Signatories can view own signatures" ON public.clearance_signatures;

CREATE OR REPLACE FUNCTION public.user_owns_clearance_request(request_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM clearance_requests WHERE id = request_id AND student_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.user_is_signatory(sig_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM signatories WHERE id = sig_id AND user_id = auth.uid());
$$;

CREATE POLICY "Students can view signatures for own requests"
ON public.clearance_signatures FOR SELECT
USING (public.user_owns_clearance_request(clearance_request_id));

CREATE POLICY "Signatories can view own signatures"
ON public.clearance_signatures FOR SELECT
USING (public.user_is_signatory(signatory_id));


-- ========== 4. 20251210013633 ==========
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view all activity logs" ON public.activity_logs FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Users can view own activity" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can log own activity" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.activity_logs REPLICA IDENTITY FULL;


-- ========== 5. 20260103062429 ==========
CREATE POLICY "Students can delete own unsigned requests" ON public.clearance_requests FOR DELETE 
USING (
  auth.uid() = student_id 
  AND NOT EXISTS (
    SELECT 1 FROM clearance_signatures cs 
    WHERE cs.clearance_request_id = clearance_requests.id AND cs.status != 'pending'
  )
);

CREATE POLICY "Students can delete signatures from own unsigned requests" ON public.clearance_signatures FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM clearance_requests cr 
    WHERE cr.id = clearance_signatures.clearance_request_id AND cr.student_id = auth.uid()
  )
  AND status = 'pending'
);

CREATE POLICY "Students can delete files from own requests" ON public.clearance_files FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM clearance_requests cr 
    WHERE cr.id = clearance_files.clearance_request_id AND cr.student_id = auth.uid()
  )
);


-- ========== 6. 20260126125910 ==========
ALTER TABLE public.clearance_signatures ADD COLUMN sequence_order integer NOT NULL DEFAULT 1;
ALTER TABLE public.clearance_signatures ADD COLUMN remarks text;
CREATE INDEX idx_clearance_signatures_sequence ON public.clearance_signatures(clearance_request_id, sequence_order);


-- ========== 7. 20260129141844 ==========
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

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE OR REPLACE FUNCTION public.notify_on_signature_update()
RETURNS TRIGGER AS $$
DECLARE
  clearance_title TEXT;
  student_id UUID;
  signatory_name TEXT;
  next_sig RECORD;
BEGIN
  IF NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending' THEN
    SELECT cr.title, cr.student_id INTO clearance_title, student_id
    FROM public.clearance_requests cr WHERE cr.id = NEW.clearance_request_id;
    
    SELECT s.name INTO signatory_name FROM public.signatories s WHERE s.id = NEW.signatory_id;
    
    INSERT INTO public.notifications (user_id, title, message, type, related_id, related_type)
    VALUES (
      student_id,
      CASE WHEN NEW.status = 'approved' THEN 'Clearance Approved' ELSE 'Clearance Rejected' END,
      signatory_name || ' has ' || NEW.status || ' your clearance "' || clearance_title || '"',
      CASE WHEN NEW.status = 'approved' THEN 'success' ELSE 'error' END,
      NEW.clearance_request_id,
      'clearance'
    );
    
    IF NEW.status = 'approved' THEN
      SELECT cs.signatory_id, s.user_id INTO next_sig
      FROM public.clearance_signatures cs
      JOIN public.signatories s ON s.id = cs.signatory_id
      WHERE cs.clearance_request_id = NEW.clearance_request_id
        AND cs.sequence_order > NEW.sequence_order
        AND cs.status = 'pending'
      ORDER BY cs.sequence_order LIMIT 1;
      
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

CREATE TRIGGER on_signature_status_change
  AFTER UPDATE ON public.clearance_signatures
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_signature_update();

CREATE OR REPLACE FUNCTION public.notify_first_signatory()
RETURNS TRIGGER AS $$
DECLARE
  clearance_title TEXT;
  first_signatory_user_id UUID;
BEGIN
  SELECT cr.title INTO clearance_title FROM public.clearance_requests cr WHERE cr.id = NEW.clearance_request_id;
  IF NEW.sequence_order = 1 THEN
    SELECT s.user_id INTO first_signatory_user_id FROM public.signatories s WHERE s.id = NEW.signatory_id;
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

CREATE TRIGGER on_signature_created
  AFTER INSERT ON public.clearance_signatures
  FOR EACH ROW EXECUTE FUNCTION public.notify_first_signatory();


-- ========== 8. 20260301000000 ==========
CREATE TABLE public.clearance_default_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signatory_id UUID NOT NULL REFERENCES public.signatories(id) ON DELETE CASCADE,
  sequence_order integer NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (signatory_id)
);

CREATE INDEX idx_clearance_default_signatories_order ON public.clearance_default_signatories (sequence_order);

ALTER TABLE public.clearance_default_signatories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view default signatories" ON public.clearance_default_signatories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Superadmins can manage default signatories" ON public.clearance_default_signatories
  FOR ALL USING (public.has_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_role(auth.uid(), 'superadmin'));


-- ========== 9. 20260301100000 ==========
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value_json JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage system_settings" ON public.system_settings
  FOR ALL USING (public.has_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Authenticated can read system_settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_system_settings_key ON public.system_settings (key);

INSERT INTO public.system_settings (key, value_json)
VALUES
  ('general', '{"system_name": "SFC-G DCS", "institution_name": "Saint Francis College - Guihulngan", "admin_email": "admin@sfc-g.edu.ph"}'::jsonb),
  ('notifications', '{"email_notifications": true, "notify_on_submission": true, "notify_on_approval": true, "notify_on_rejection": true}'::jsonb),
  ('security', '{"require_all_signatures": true, "allow_multiple_clearances": false, "auto_approve_after_days": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ========== DONE. Now create your first superadmin ==========
-- 1. Go to Authentication → Users → Add user (create with email/password)
-- 2. Copy the user's UUID
-- 3. Run: INSERT INTO public.user_roles (user_id, role) VALUES ('YOUR_UUID', 'superadmin');
-- 4. (Optional) Remove student role: DELETE FROM public.user_roles WHERE user_id = 'YOUR_UUID' AND role = 'student';
