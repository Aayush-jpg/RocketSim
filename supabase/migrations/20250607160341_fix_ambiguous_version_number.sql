-- Fix ambiguous column reference in create_rocket_version function
-- The issue is that "version_number" could refer to either the function's return table column
-- or the rocket_versions table column, causing PostgreSQL to throw an ambiguous reference error.

CREATE OR REPLACE FUNCTION create_rocket_version(
    p_rocket_id UUID,
    p_user_id UUID,
    p_rocket_name TEXT,
    p_description TEXT,
    p_parts JSONB,
    p_motor_id TEXT,
    p_drag_coefficient REAL,
    p_units TEXT,
    p_created_by_action TEXT
)
RETURNS TABLE(
    id UUID,
    version_number INTEGER,
    name TEXT,
    description TEXT,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_version INTEGER;
    v_new_version_id UUID;
    v_version_name TEXT;
BEGIN
    -- CRITICAL: Lock the rocket row to prevent concurrent access
    PERFORM 1 FROM public.rockets 
    WHERE rockets.id = p_rocket_id AND rockets.user_id = p_user_id
    FOR UPDATE;
    
    -- Get next version number atomically (within the locked transaction)
    -- FIX: Fully qualify the column name to avoid ambiguity
    SELECT COALESCE(MAX(rv.version_number), 0) + 1 
    INTO v_next_version
    FROM public.rocket_versions rv
    WHERE rv.rocket_id = p_rocket_id;
    
    -- Generate new version ID
    v_new_version_id := gen_random_uuid();
    
    -- Create version name
    v_version_name := p_rocket_name || ' v' || v_next_version::text;
    
    -- Insert new version (guaranteed unique version number)
    INSERT INTO public.rocket_versions (
        id,
        rocket_id,
        user_id,
        version_number,
        name,
        description,
        parts,
        motor_id,
        drag_coefficient,
        units,
        created_by_action,
        is_current,
        created_at
    ) VALUES (
        v_new_version_id,
        p_rocket_id,
        p_user_id,
        v_next_version,
        v_version_name,
        p_description,
        p_parts,
        p_motor_id,
        p_drag_coefficient,
        p_units,
        p_created_by_action,
        false,
        NOW()
    );
    
    -- Return the created version
    RETURN QUERY
    SELECT 
        v_new_version_id,
        v_next_version,
        v_version_name,
        p_description,
        NOW()::TIMESTAMPTZ;
END;
$$;
