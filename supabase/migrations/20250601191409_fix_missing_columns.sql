-- ROCKETv1 Database Migration Fix
-- Adds missing columns that are causing schema cache errors

-- Check if columns exist before adding them
DO $$ 
BEGIN 
    -- Add flight_time column to simulations table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'simulations' 
        AND column_name = 'flight_time'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE simulations ADD COLUMN flight_time DECIMAL(8,3);
        COMMENT ON COLUMN simulations.flight_time IS 'Total flight time from launch to landing (seconds)';
    END IF;

    -- Add landing_velocity column to simulations table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'simulations' 
        AND column_name = 'landing_velocity'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE simulations ADD COLUMN landing_velocity DECIMAL(8,3);
        COMMENT ON COLUMN simulations.landing_velocity IS 'Velocity at landing (m/s)';
    END IF;

    -- Add drift_distance column to simulations table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'simulations' 
        AND column_name = 'drift_distance'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE simulations ADD COLUMN drift_distance DECIMAL(8,3);
        COMMENT ON COLUMN simulations.drift_distance IS 'Horizontal drift distance from launch site (meters)';
    END IF;

    -- Add computation_time column to simulations table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'simulations' 
        AND column_name = 'computation_time'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE simulations ADD COLUMN computation_time DECIMAL(8,3);
        COMMENT ON COLUMN simulations.computation_time IS 'Time taken to compute simulation (seconds)';
    END IF;

    -- Add message_vector column to chat_messages table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'message_vector'
        AND table_schema = 'public'
    ) THEN
        -- First check if vector extension is available
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
            ALTER TABLE chat_messages ADD COLUMN message_vector vector(1536);
            COMMENT ON COLUMN chat_messages.message_vector IS 'Vector embedding for semantic search (1536 dimensions)';
            
            -- Create index for similarity search
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_vector 
            ON chat_messages USING ivfflat (message_vector vector_cosine_ops);
        ELSE
            -- If vector extension is not available, use array of floats as fallback
            ALTER TABLE chat_messages ADD COLUMN message_vector FLOAT[];
            COMMENT ON COLUMN chat_messages.message_vector IS 'Vector embedding for semantic search (fallback to float array)';
        END IF;
    END IF;

    -- Add tokens_used column to chat_messages table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'tokens_used'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN tokens_used INTEGER;
        COMMENT ON COLUMN chat_messages.tokens_used IS 'Number of tokens used for this message';
    END IF;

    -- Add context_data column to chat_messages table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'context_data'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN context_data JSONB;
        COMMENT ON COLUMN chat_messages.context_data IS 'Context data sent to AI agent';
    END IF;

END $$;

-- Update table comments
COMMENT ON TABLE simulations IS 'Rocket flight simulation results and metadata';
COMMENT ON TABLE chat_messages IS 'Chat history and AI interaction logs with embeddings';

-- Print completion message
DO $$ 
BEGIN 
    RAISE NOTICE 'Database migration completed successfully!';
    RAISE NOTICE 'Missing columns have been added to resolve schema cache errors.';
END $$;
