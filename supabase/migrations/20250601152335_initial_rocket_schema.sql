-- ROCKETv1 Database Schema
-- Initial migration for the rocket design platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector"; -- For AI embeddings

-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    preferences JSONB DEFAULT '{}',
    experience_level VARCHAR(20) DEFAULT 'beginner',
    subscription_tier VARCHAR(20) DEFAULT 'free'
);

-- User Sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    rocket_count INTEGER DEFAULT 0,
    simulation_count INTEGER DEFAULT 0
);

-- Rocket Designs
CREATE TABLE rockets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parts JSONB NOT NULL, -- Array of rocket parts
    motor_id VARCHAR(100),
    drag_coefficient DECIMAL(4,3) DEFAULT 0.35,
    units VARCHAR(10) DEFAULT 'metric',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE,
    tags VARCHAR(255)[]
);

-- Add indexes for rockets table
CREATE INDEX idx_rockets_user_id ON rockets(user_id);
CREATE INDEX idx_rockets_created_at ON rockets(created_at);
CREATE INDEX idx_rockets_public ON rockets(is_public) WHERE is_public = TRUE;

-- Environment Configurations
CREATE TABLE environment_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    elevation DECIMAL(8,2),
    wind_speed DECIMAL(5,2),
    wind_direction DECIMAL(5,2),
    atmospheric_model VARCHAR(50) DEFAULT 'standard',
    weather_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_default BOOLEAN DEFAULT FALSE
);

-- Simulations
CREATE TABLE simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rocket_id UUID REFERENCES rockets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    fidelity VARCHAR(20) NOT NULL, -- 'standard', 'enhanced', 'professional'
    environment_config JSONB,
    launch_parameters JSONB,
    
    -- Core Results
    max_altitude DECIMAL(10,3),
    max_velocity DECIMAL(10,3),
    max_acceleration DECIMAL(10,3),
    apogee_time DECIMAL(8,3),
    stability_margin DECIMAL(6,3),
    
    -- Detailed Results
    results JSONB, -- Full simulation results
    trajectory_data JSONB, -- Flight path data
    flight_events JSONB, -- Array of flight events
    thrust_curve JSONB, -- Motor thrust data
    
    -- Metadata
    simulation_time DECIMAL(8,3), -- How long sim took to run
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'completed',
    error_message TEXT
);

-- Add indexes for simulations table
CREATE INDEX idx_simulations_rocket_id ON simulations(rocket_id);
CREATE INDEX idx_simulations_user_id ON simulations(user_id);
CREATE INDEX idx_simulations_created_at ON simulations(created_at);
CREATE INDEX idx_simulations_fidelity ON simulations(fidelity);

-- Advanced Analysis Results
CREATE TABLE analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rocket_id UUID REFERENCES rockets(id) ON DELETE CASCADE,
    simulation_id UUID REFERENCES simulations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL, -- 'stability', 'monte_carlo', 'motor', 'recovery'
    
    -- Analysis Data
    results JSONB NOT NULL,
    parameters JSONB, -- Analysis parameters used
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    computation_time DECIMAL(8,3)
);

-- Add indexes for analysis_results table
CREATE INDEX idx_analysis_rocket_id ON analysis_results(rocket_id);
CREATE INDEX idx_analysis_type ON analysis_results(analysis_type);
CREATE INDEX idx_analysis_created_at ON analysis_results(created_at);

-- Chat/AI Interaction History
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
    rocket_id UUID REFERENCES rockets(id) ON DELETE SET NULL,
    
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    
    -- AI Context
    context_data JSONB, -- Full context sent to AI
    agent_actions JSONB, -- Actions returned by agent
    tokens_used INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for chat_messages table
CREATE INDEX idx_chat_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_created_at ON chat_messages(created_at);

-- Motor Database
CREATE TABLE motors (
    id VARCHAR(100) PRIMARY KEY,
    manufacturer VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    impulse_class VARCHAR(10) NOT NULL,
    total_impulse DECIMAL(8,2),
    burn_time DECIMAL(6,2),
    average_thrust DECIMAL(8,2),
    max_thrust DECIMAL(8,2),
    propellant_mass DECIMAL(8,3),
    total_mass DECIMAL(8,3),
    diameter DECIMAL(6,2),
    length DECIMAL(8,2),
    thrust_curve JSONB, -- Time/thrust data points
    specifications JSONB, -- Additional technical specs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for motors table
CREATE INDEX idx_motors_class ON motors(impulse_class);
CREATE INDEX idx_motors_manufacturer ON motors(manufacturer);

-- Weather Cache
CREATE TABLE weather_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_key VARCHAR(255) NOT NULL, -- lat,lon as key
    weather_data JSONB NOT NULL,
    source VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(location_key, source)
);

-- Add indexes for weather_cache table
CREATE INDEX idx_weather_expires ON weather_cache(expires_at);
CREATE INDEX idx_weather_location ON weather_cache(location_key);

-- Performance Analytics (Time-series data)
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rocket_id UUID REFERENCES rockets(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    value DECIMAL(12,6) NOT NULL,
    metadata JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance_metrics table
CREATE INDEX idx_metrics_user_rocket ON performance_metrics(user_id, rocket_id);
CREATE INDEX idx_metrics_type_time ON performance_metrics(metric_type, recorded_at);
CREATE INDEX idx_metrics_recorded_at ON performance_metrics(recorded_at);

-- Design Templates (Popular/Featured rockets)
CREATE TABLE design_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty_level VARCHAR(20) DEFAULT 'beginner',
    rocket_config JSONB NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    tags VARCHAR(255)[],
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for design_templates table
CREATE INDEX idx_templates_difficulty ON design_templates(difficulty_level);
CREATE INDEX idx_templates_featured ON design_templates(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_templates_rating ON design_templates(rating DESC);

-- Update triggers for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rockets_updated_at BEFORE UPDATE ON rockets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup function for expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM weather_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Views for common queries
CREATE VIEW rocket_performance_summary AS
SELECT 
    r.id as rocket_id,
    r.name,
    r.user_id,
    COUNT(s.id) as simulation_count,
    AVG(s.max_altitude) as avg_altitude,
    MAX(s.max_altitude) as max_altitude,
    AVG(s.stability_margin) as avg_stability,
    MIN(s.created_at) as first_simulation,
    MAX(s.created_at) as last_simulation
FROM rockets r
LEFT JOIN simulations s ON r.id = s.rocket_id
WHERE s.status = 'completed'
GROUP BY r.id, r.name, r.user_id;

CREATE VIEW user_activity_summary AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT r.id) as rockets_created,
    COUNT(DISTINCT s.id) as simulations_run,
    COUNT(DISTINCT cm.id) as messages_sent,
    MAX(us.last_activity) as last_activity
FROM users u
LEFT JOIN rockets r ON u.id = r.user_id
LEFT JOIN simulations s ON u.id = s.user_id
LEFT JOIN chat_messages cm ON u.id = cm.user_id
LEFT JOIN user_sessions us ON u.id = us.user_id
GROUP BY u.id, u.email;

-- Row Level Security (RLS) policies
ALTER TABLE rockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for rockets table
CREATE POLICY "Users can view own rockets or public rockets" ON rockets
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own rockets" ON rockets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rockets" ON rockets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rockets" ON rockets
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for simulations table
CREATE POLICY "Users can view own simulations" ON simulations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own simulations" ON simulations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own simulations" ON simulations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own simulations" ON simulations
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for chat_messages table
CREATE POLICY "Users can view own chat messages" ON chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for analysis_results table
CREATE POLICY "Users can view own analysis results" ON analysis_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis results" ON analysis_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for user_sessions table
CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON user_sessions
  FOR UPDATE USING (auth.uid() = user_id);
