-- Create rocket_versions table for version control
CREATE TABLE IF NOT EXISTS public.rocket_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rocket_id UUID NOT NULL REFERENCES public.rockets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parts JSONB NOT NULL,
    motor_id VARCHAR(100),
    drag_coefficient DECIMAL(4,3) DEFAULT 0.35,
    units VARCHAR(10) DEFAULT 'metric',
    created_by_action VARCHAR(100), -- What AI action created this version
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() 
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rocket_versions_rocket_id ON public.rocket_versions(rocket_id);
CREATE INDEX IF NOT EXISTS idx_rocket_versions_user_id ON public.rocket_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_rocket_versions_version_number ON public.rocket_versions(rocket_id, version_number);
CREATE INDEX IF NOT EXISTS idx_rocket_versions_is_current ON public.rocket_versions(rocket_id, is_current);

-- Enable Row Level Security
ALTER TABLE public.rocket_versions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own rocket versions" ON public.rocket_versions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rocket versions" ON public.rocket_versions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rocket versions" ON public.rocket_versions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rocket versions" ON public.rocket_versions
    FOR DELETE USING (auth.uid() = user_id);

-- Create unique constraint to prevent duplicate version numbers per rocket
CREATE UNIQUE INDEX IF NOT EXISTS idx_rocket_versions_unique_version 
ON public.rocket_versions(rocket_id, version_number);

-- Add constraint to ensure version numbers are positive
ALTER TABLE public.rocket_versions 
ADD CONSTRAINT rocket_versions_version_number_positive 
CHECK (version_number > 0); 
