-- Fix foreign key constraint for chat_messages.session_id
-- The issue is that session_id should reference user_sessions.session_id (VARCHAR), not user_sessions.id (UUID)

DO $$
BEGIN
    -- Drop the existing foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_name = 'chat_messages_session_id_fkey'
        AND tc.table_name = 'chat_messages'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_session_id_fkey;
        RAISE NOTICE 'Dropped existing foreign key constraint chat_messages_session_id_fkey';
    END IF;

    -- Check if session_id column in chat_messages is UUID type (which would be wrong)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'session_id'
        AND data_type = 'uuid'
    ) THEN
        -- Change session_id to VARCHAR to match user_sessions.session_id
        ALTER TABLE chat_messages ALTER COLUMN session_id TYPE VARCHAR(255);
        RAISE NOTICE 'Changed chat_messages.session_id to VARCHAR(255)';
    END IF;

    -- Add the correct foreign key constraint to reference user_sessions.session_id
    ALTER TABLE chat_messages 
    ADD CONSTRAINT chat_messages_session_id_fkey 
    FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Added correct foreign key constraint: chat_messages.session_id -> user_sessions.session_id';

END $$;
