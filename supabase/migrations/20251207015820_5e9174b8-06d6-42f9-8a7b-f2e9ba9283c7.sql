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
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Superadmins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'superadmin'));

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Superadmins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'superadmin'));

-- Signatories policies
CREATE POLICY "Anyone can view active signatories" ON public.signatories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Superadmins can manage signatories" ON public.signatories
  FOR ALL USING (public.has_role(auth.uid(), 'superadmin'));

-- Clearance requests policies
CREATE POLICY "Students can view own requests" ON public.clearance_requests
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can create own requests" ON public.clearance_requests
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own requests" ON public.clearance_requests
  FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "Signatories can view assigned requests" ON public.clearance_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clearance_signatures cs
      JOIN public.signatories s ON cs.signatory_id = s.id
      WHERE cs.clearance_request_id = clearance_requests.id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Superadmins can view all requests" ON public.clearance_requests
  FOR SELECT USING (public.has_role(auth.uid(), 'superadmin'));

-- Clearance files policies
CREATE POLICY "Users can view files for own requests" ON public.clearance_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clearance_requests cr
      WHERE cr.id = clearance_request_id AND cr.student_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload files to own requests" ON public.clearance_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clearance_requests cr
      WHERE cr.id = clearance_request_id AND cr.student_id = auth.uid()
    )
  );

CREATE POLICY "Signatories can view assigned files" ON public.clearance_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clearance_signatures cs
      JOIN public.signatories s ON cs.signatory_id = s.id
      WHERE cs.clearance_request_id = clearance_files.clearance_request_id
      AND s.user_id = auth.uid()
    )
  );

-- Clearance signatures policies
CREATE POLICY "Students can view signatures for own requests" ON public.clearance_signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clearance_requests cr
      WHERE cr.id = clearance_request_id AND cr.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can add signatures to own requests" ON public.clearance_signatures
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clearance_requests cr
      WHERE cr.id = clearance_request_id AND cr.student_id = auth.uid()
    )
  );

CREATE POLICY "Signatories can update own signatures" ON public.clearance_signatures
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.signatories s
      WHERE s.id = signatory_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Signatories can view own signatures" ON public.clearance_signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.signatories s
      WHERE s.id = signatory_id AND s.user_id = auth.uid()
    )
  );

-- Create storage bucket for clearance files
INSERT INTO storage.buckets (id, name, public) VALUES ('clearance-files', 'clearance-files', false);

-- Storage policies
CREATE POLICY "Users can upload clearance files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'clearance-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'clearance-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Signatories can view files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'clearance-files' AND 
    public.has_role(auth.uid(), 'signatory')
  );

-- Trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clearance_requests_updated_at
  BEFORE UPDATE ON public.clearance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_signatories_updated_at
  BEFORE UPDATE ON public.signatories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for clearance_signatures
ALTER PUBLICATION supabase_realtime ADD TABLE public.clearance_signatures;