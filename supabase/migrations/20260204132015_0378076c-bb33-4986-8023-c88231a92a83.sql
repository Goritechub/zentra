
-- Create enums
CREATE TYPE public.user_role AS ENUM ('client', 'freelancer', 'admin');
CREATE TYPE public.availability_type AS ENUM ('full_time', 'part_time', 'weekends', 'flexible');
CREATE TYPE public.job_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.proposal_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE public.contract_status AS ENUM ('active', 'completed', 'disputed', 'cancelled');

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  state TEXT,
  city TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'client',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create freelancer_profiles table
CREATE TABLE public.freelancer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  bio TEXT,
  title TEXT,
  skills TEXT[] DEFAULT '{}',
  hourly_rate INTEGER,
  min_project_rate INTEGER,
  availability availability_type DEFAULT 'flexible',
  years_experience INTEGER DEFAULT 0,
  total_jobs_completed INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  show_whatsapp BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create portfolio_items table
CREATE TABLE public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_profile_id UUID REFERENCES public.freelancer_profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  software_used TEXT[] DEFAULT '{}',
  project_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  required_skills TEXT[] DEFAULT '{}',
  required_software TEXT[] DEFAULT '{}',
  budget_min INTEGER,
  budget_max INTEGER,
  is_hourly BOOLEAN DEFAULT FALSE,
  delivery_days INTEGER,
  state TEXT,
  city TEXT,
  is_remote BOOLEAN DEFAULT TRUE,
  status job_status DEFAULT 'open',
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create proposals table
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  freelancer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  cover_letter TEXT NOT NULL,
  bid_amount INTEGER NOT NULL,
  delivery_days INTEGER NOT NULL,
  status proposal_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, freelancer_id)
);

-- Create contracts table
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  freelancer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  status contract_status DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  reviewee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contract_id, reviewer_id)
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table for CAD services
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Freelancer profiles policies
CREATE POLICY "Freelancer profiles are viewable by everyone" ON public.freelancer_profiles FOR SELECT USING (true);
CREATE POLICY "Freelancers can update own profile" ON public.freelancer_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Freelancers can insert own profile" ON public.freelancer_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Portfolio items policies
CREATE POLICY "Portfolio items are viewable by everyone" ON public.portfolio_items FOR SELECT USING (true);
CREATE POLICY "Freelancers can manage own portfolio" ON public.portfolio_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.freelancer_profiles WHERE id = portfolio_items.freelancer_profile_id AND user_id = auth.uid())
);

-- Jobs policies
CREATE POLICY "Jobs are viewable by everyone" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Clients can create jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "Clients can delete own jobs" ON public.jobs FOR DELETE USING (auth.uid() = client_id);

-- Proposals policies
CREATE POLICY "Proposals viewable by job owner or proposer" ON public.proposals FOR SELECT USING (
  auth.uid() = freelancer_id OR 
  EXISTS (SELECT 1 FROM public.jobs WHERE id = proposals.job_id AND client_id = auth.uid())
);
CREATE POLICY "Freelancers can create proposals" ON public.proposals FOR INSERT WITH CHECK (auth.uid() = freelancer_id);
CREATE POLICY "Freelancers can update own proposals" ON public.proposals FOR UPDATE USING (auth.uid() = freelancer_id);

-- Contracts policies
CREATE POLICY "Contracts viewable by participants" ON public.contracts FOR SELECT USING (
  auth.uid() = freelancer_id OR auth.uid() = client_id
);
CREATE POLICY "Clients can create contracts" ON public.contracts FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Participants can update contracts" ON public.contracts FOR UPDATE USING (
  auth.uid() = freelancer_id OR auth.uid() = client_id
);

-- Reviews policies
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Contract participants can create reviews" ON public.reviews FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.contracts WHERE id = reviews.contract_id AND (freelancer_id = auth.uid() OR client_id = auth.uid()))
);

-- Messages policies
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Receivers can update messages (mark read)" ON public.messages FOR UPDATE USING (auth.uid() = receiver_id);

-- Categories policies
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_freelancer_profiles_updated_at BEFORE UPDATE ON public.freelancer_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default categories
INSERT INTO public.categories (name, slug, description, icon) VALUES
  ('Architectural Drafting', 'architectural-drafting', 'Floor plans, elevations, sections, and construction drawings', 'building'),
  ('Mechanical CAD', 'mechanical-cad', 'Machine parts, assemblies, and mechanical systems', 'cog'),
  ('Electrical CAD', 'electrical-cad', 'Electrical layouts, wiring diagrams, and panel designs', 'zap'),
  ('3D Modeling', '3d-modeling', '3D product visualization and rendering', 'box'),
  ('BIM/Revit', 'bim-revit', 'Building Information Modeling and Revit projects', 'layers'),
  ('AutoCAD 2D Plans', 'autocad-2d', 'Technical 2D drawings and documentation', 'pen-tool'),
  ('SolidWorks', 'solidworks', 'SolidWorks design and simulation', 'cube'),
  ('Fusion 360', 'fusion-360', 'Fusion 360 product design and manufacturing', 'rotate-3d'),
  ('Civil/Structural', 'civil-structural', 'Civil engineering and structural drawings', 'landmark');
