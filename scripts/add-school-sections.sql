-- Add fields to link JSS schools to Primary schools
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS school_type VARCHAR(20) DEFAULT 'combined'; -- 'primary', 'jss', 'combined'
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS parent_school_id UUID REFERENCES public.schools(id);
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS section_name VARCHAR(100); -- e.g., "Primary", "JSS"

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schools_parent_school_id ON public.schools(parent_school_id);
CREATE INDEX IF NOT EXISTS idx_schools_school_type ON public.schools(school_type);
