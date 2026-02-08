
-- Table to store generated apps
CREATE TABLE public.generated_apps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled App',
  slug TEXT NOT NULL UNIQUE,
  html_content TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_apps ENABLE ROW LEVEL SECURITY;

-- Owner policies
CREATE POLICY "Users can view own apps" ON public.generated_apps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create apps" ON public.generated_apps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own apps" ON public.generated_apps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own apps" ON public.generated_apps FOR DELETE USING (auth.uid() = user_id);

-- Public access for published apps (anyone can view)
CREATE POLICY "Anyone can view published apps" ON public.generated_apps FOR SELECT USING (is_published = true);

-- Index for slug lookups
CREATE INDEX idx_generated_apps_slug ON public.generated_apps (slug);
CREATE INDEX idx_generated_apps_user ON public.generated_apps (user_id);
