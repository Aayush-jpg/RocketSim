-- Migration: Add vector columns for AI embeddings
-- This enables similarity search for chat messages and rocket designs

-- Add message_vector column to chat_messages table
ALTER TABLE chat_messages 
ADD COLUMN message_vector vector(1536);

-- Add design_vector column to rockets table (if not already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rockets' AND column_name = 'design_vector'
    ) THEN
        ALTER TABLE rockets ADD COLUMN design_vector vector(1536);
    END IF;
END $$;

-- Create indexes for vector similarity search
-- Using ivfflat for better performance on large datasets
CREATE INDEX IF NOT EXISTS idx_chat_messages_vector 
ON chat_messages USING ivfflat (message_vector vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_rockets_design_vector 
ON rockets USING ivfflat (design_vector vector_cosine_ops)
WITH (lists = 100);

-- Create similarity search functions for chat messages
CREATE OR REPLACE FUNCTION search_chat_messages(
  query_vector vector(1536),
  user_id_param uuid,
  similarity_threshold float = 0.7,
  match_count int = 10
)
RETURNS TABLE (
  id uuid,
  content text,
  role varchar(20),
  session_id uuid,
  rocket_id uuid,
  created_at timestamp with time zone,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.content,
    cm.role,
    cm.session_id,
    cm.rocket_id,
    cm.created_at,
    1 - (cm.message_vector <=> query_vector) as similarity
  FROM chat_messages cm
  WHERE 
    cm.user_id = user_id_param 
    AND cm.message_vector IS NOT NULL
    AND 1 - (cm.message_vector <=> query_vector) > similarity_threshold
  ORDER BY cm.message_vector <=> query_vector
  LIMIT match_count;
END;
$$;

-- Create similarity search functions for rockets
CREATE OR REPLACE FUNCTION search_similar_rockets(
  query_vector vector(1536),
  user_id_param uuid DEFAULT NULL,
  similarity_threshold float = 0.7,
  match_count int = 10
)
RETURNS TABLE (
  id uuid,
  name varchar(255),
  user_id uuid,
  is_public boolean,
  tags varchar(255)[],
  created_at timestamp with time zone,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.user_id,
    r.is_public,
    r.tags,
    r.created_at,
    1 - (r.design_vector <=> query_vector) as similarity
  FROM rockets r
  WHERE 
    r.design_vector IS NOT NULL
    AND 1 - (r.design_vector <=> query_vector) > similarity_threshold
    AND (
      user_id_param IS NULL 
      OR r.user_id = user_id_param 
      OR r.is_public = true
    )
  ORDER BY r.design_vector <=> query_vector
  LIMIT match_count;
END;
$$;

-- Create function to find similar conversations
CREATE OR REPLACE FUNCTION search_similar_conversations(
  query_vector vector(1536),
  user_id_param uuid,
  similarity_threshold float = 0.5,
  match_count int = 5
)
RETURNS TABLE (
  session_id uuid,
  representative_content text,
  message_count bigint,
  last_message timestamp with time zone,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH session_representatives AS (
    SELECT DISTINCT ON (cm.session_id)
      cm.session_id,
      cm.content as representative_content,
      cm.message_vector,
      cm.created_at
    FROM chat_messages cm
    WHERE 
      cm.user_id = user_id_param 
      AND cm.role = 'user'
      AND cm.message_vector IS NOT NULL
    ORDER BY cm.session_id, cm.created_at DESC
  ),
  session_stats AS (
    SELECT 
      cm.session_id,
      COUNT(*) as message_count,
      MAX(cm.created_at) as last_message
    FROM chat_messages cm
    WHERE cm.user_id = user_id_param
    GROUP BY cm.session_id
  )
  SELECT
    sr.session_id,
    sr.representative_content,
    ss.message_count,
    ss.last_message,
    1 - (sr.message_vector <=> query_vector) as similarity
  FROM session_representatives sr
  JOIN session_stats ss ON sr.session_id = ss.session_id
  WHERE 1 - (sr.message_vector <=> query_vector) > similarity_threshold
  ORDER BY sr.message_vector <=> query_vector
  LIMIT match_count;
END;
$$;

-- Add comments for documentation
COMMENT ON COLUMN chat_messages.message_vector IS 'Vector embedding of message content for similarity search (1536 dimensions)';
COMMENT ON COLUMN rockets.design_vector IS 'Vector embedding of rocket design description for similarity search (1536 dimensions)';

COMMENT ON FUNCTION search_chat_messages IS 'Search chat messages by semantic similarity using vector embeddings';
COMMENT ON FUNCTION search_similar_rockets IS 'Find similar rocket designs using vector embeddings';
COMMENT ON FUNCTION search_similar_conversations IS 'Find similar conversation sessions using representative message embeddings'; 