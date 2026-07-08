-- Create site_progress table in Supabase
CREATE TABLE IF NOT EXISTS public.site_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    progress_percent INTEGER DEFAULT 0,
    image_url TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (or keep disabled if consistent with project)
ALTER TABLE public.site_progress DISABLE ROW LEVEL SECURITY;
