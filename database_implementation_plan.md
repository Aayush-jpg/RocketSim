# ROCKETv1 Database Implementation Plan
## Startup-Optimized Database Architecture

### 🎯 **Recommended Tech Stack**

#### 1. **Primary Database: PostgreSQL with Supabase**
**Why This Choice:**
- ✅ **Startup-friendly**: Free tier with generous limits
- ✅ **Vector support**: Built-in pgvector for AI embeddings
- ✅ **Real-time**: Built-in real-time subscriptions
- ✅ **JSON support**: Excellent JSONB performance
- ✅ **Auth included**: Built-in authentication system
- ✅ **Auto-scaling**: Managed infrastructure
- ✅ **Cost-effective**: Pay-as-you-scale pricing

#### 2. **Caching: Upstash Redis**
**Why This Choice:**
- ✅ **Serverless**: Perfect for startup usage patterns
- ✅ **Free tier**: 10K requests/day free
- ✅ **Global**: Low-latency worldwide
- ✅ **Simple**: No infrastructure management

#### 3. **File Storage: Supabase Storage**
**Why This Choice:**
- ✅ **Integrated**: Same platform as database
- ✅ **S3-compatible**: Standard APIs
- ✅ **CDN included**: Global content delivery
- ✅ **Generous free tier**: 1GB free storage

---

## 🚀 **Quick Setup Guide**

### Phase 1: Core Database Setup (Week 1)

#### Step 1: Supabase Setup
```bash
# 1. Create Supabase project at supabase.com
# 2. Get your project URL and anon key
# 3. Install Supabase CLI
npm install -g supabase

# 4. Initialize project
supabase init
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

#### Step 2: Database Schema Deployment
```bash
# Apply the schema
supabase db reset
# Or apply specific migrations
supabase migration new initial_schema
# Copy database_schema.sql content to the migration file
supabase db push
```

#### Step 3: Environment Variables
```bash
# Add to .env
DATABASE_URL="postgresql://postgres:[password]@[host]:[port]/[database]"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Phase 2: Redis Cache Setup (Week 1)

#### Step 1: Upstash Redis Setup
```bash
# 1. Create account at upstash.com
# 2. Create Redis database
# 3. Get connection details

# Environment variables
REDIS_URL="rediss://default:password@host:port"
UPSTASH_REDIS_REST_URL="https://your-db.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
```

#### Step 2: Cache Implementation
```typescript
// lib/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

export class CacheService {
  // Weather cache (30 minutes)
  async cacheWeather(locationKey: string, data: any) {
    await redis.setex(`weather:${locationKey}`, 1800, JSON.stringify(data));
  }
  
  async getWeather(locationKey: string) {
    const cached = await redis.get(`weather:${locationKey}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  // Simulation cache (1 hour)
  async cacheSimulation(rocketHash: string, result: any) {
    await redis.setex(`sim:${rocketHash}`, 3600, JSON.stringify(result));
  }
  
  // Session management
  async setSession(sessionId: string, data: any, ttl = 86400) {
    await redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
  }
}
```

---

## 🛠 **Essential Tools & Libraries**

### 1. **Database Layer**
```bash
npm install @supabase/supabase-js
npm install drizzle-orm drizzle-kit @supabase/drizzle
npm install postgres
```

### 2. **Cache Layer**
```bash
npm install ioredis
npm install @upstash/redis
```

### 3. **Vector Database (AI Features)**
```bash
npm install @supabase/vecs
npm install openai  # For embeddings
```

### 4. **Database Tools**
```bash
npm install prisma @prisma/client  # Alternative ORM option
npm install kysely  # Type-safe SQL builder option
```

---

## 📊 **Implementation Strategy**

### **Option A: Drizzle ORM (Recommended)**
**Pros:** Type-safe, lightweight, great for startups
```typescript
// db/schema.ts
import { pgTable, uuid, varchar, jsonb, timestamp, decimal, boolean } from 'drizzle-orm/pg-core';

export const rockets = pgTable('rockets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  parts: jsonb('parts').notNull(),
  motorId: varchar('motor_id', { length: 100 }),
  dragCoefficient: decimal('drag_coefficient', { precision: 4, scale: 3 }).default('0.35'),
  units: varchar('units', { length: 10 }).default('metric'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isPublic: boolean('is_public').default(false),
});
```

### **Option B: Supabase Client (Simpler)**
**Pros:** Zero-config, auto-generated types
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Auto-generated types from schema
export type Rocket = Database['public']['Tables']['rockets']['Row'];
export type NewRocket = Database['public']['Tables']['rockets']['Insert'];
```

---

## 🔄 **Data Access Patterns**

### 1. **Rocket Management**
```typescript
// services/rocket.service.ts
export class RocketService {
  async saveRocket(rocket: NewRocket): Promise<Rocket> {
    const { data, error } = await supabase
      .from('rockets')
      .insert(rocket)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  async getUserRockets(userId: string): Promise<Rocket[]> {
    const { data, error } = await supabase
      .from('rockets')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
  
  async findSimilarRockets(rocketVector: number[]): Promise<Rocket[]> {
    // Vector similarity search using pgvector
    const { data, error } = await supabase.rpc('find_similar_rockets', {
      query_vector: rocketVector,
      similarity_threshold: 0.8,
      match_count: 10
    });
    
    return data || [];
  }
}
```

### 2. **Simulation History**
```typescript
// services/simulation.service.ts
export class SimulationService {
  async saveSimulation(simulation: NewSimulation): Promise<Simulation> {
    // Check cache first
    const rocketHash = this.hashRocket(simulation.rocket_config);
    const cached = await cache.getSimulation(rocketHash);
    if (cached) return cached;
    
    // Save to database
    const { data, error } = await supabase
      .from('simulations')
      .insert(simulation)
      .select()
      .single();
    
    if (error) throw error;
    
    // Cache result
    await cache.cacheSimulation(rocketHash, data);
    return data;
  }
  
  async getSimulationHistory(rocketId: string): Promise<Simulation[]> {
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('rocket_id', rocketId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10);
    
    return data || [];
  }
}
```

### 3. **AI Context Management**
```typescript
// services/context.service.ts
export class ContextService {
  async saveChatMessage(message: NewChatMessage): Promise<void> {
    // Generate embedding for semantic search
    const embedding = await this.generateEmbedding(message.content);
    
    await supabase.from('chat_messages').insert({
      ...message,
      message_vector: embedding
    });
  }
  
  async searchSimilarConversations(query: string, userId: string): Promise<ChatMessage[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    
    const { data } = await supabase.rpc('search_chat_messages', {
      query_vector: queryEmbedding,
      user_id: userId,
      similarity_threshold: 0.7,
      match_count: 5
    });
    
    return data || [];
  }
}
```

---

## 📈 **Scaling Considerations**

### **Phase 1: MVP (0-1K users)**
- **Database**: Supabase Free Tier
- **Cache**: Upstash Free Tier
- **Storage**: Supabase Free Tier
- **Cost**: $0/month

### **Phase 2: Growth (1K-10K users)**
- **Database**: Supabase Pro ($25/month)
- **Cache**: Upstash Pay-as-you-go (~$20/month)
- **Storage**: Supabase Pro included
- **Cost**: ~$45/month

### **Phase 3: Scale (10K+ users)**
- **Database**: Supabase Team ($599/month) or custom
- **Cache**: Upstash Pro (~$100/month)
- **Storage**: CDN optimization
- **Cost**: ~$700/month

---

## 🔍 **Vector Database Strategy**

### **Do You Need It?** YES, for these features:

1. **Semantic Search**: Chat history, rocket designs
2. **Similar Rocket Matching**: Find similar designs
3. **AI Context**: Relevant context retrieval
4. **Design Recommendations**: ML-powered suggestions

### **Implementation with pgvector:**
```sql
-- Add to schema
ALTER TABLE rockets ADD COLUMN design_vector vector(1536);
ALTER TABLE chat_messages ADD COLUMN message_vector vector(1536);

-- Create indexes
CREATE INDEX ON rockets USING ivfflat (design_vector vector_cosine_ops);
CREATE INDEX ON chat_messages USING ivfflat (message_vector vector_cosine_ops);

-- Similarity search function
CREATE OR REPLACE FUNCTION find_similar_rockets(
  query_vector vector(1536),
  similarity_threshold float = 0.8,
  match_count int = 10
)
RETURNS TABLE (
  rocket_id uuid,
  name varchar(255),
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rockets.id,
    rockets.name,
    1 - (rockets.design_vector <=> query_vector) as similarity
  FROM rockets
  WHERE 1 - (rockets.design_vector <=> query_vector) > similarity_threshold
  ORDER BY rockets.design_vector <=> query_vector
  LIMIT match_count;
END;
$$;
```

---

## 🛡️ **Security Implementation**

### 1. **Row Level Security (RLS)**
```sql
-- Enable RLS
ALTER TABLE rockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own rockets" ON rockets
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own rockets" ON rockets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rockets" ON rockets
  FOR UPDATE USING (auth.uid() = user_id);
```

### 2. **API Security**
```typescript
// middleware/auth.ts
export async function authenticateUser(req: Request) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');
  
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) throw new Error('Invalid token');
  
  return user;
}
```

---

## 📋 **Migration Strategy**

### From Current Store to Database:
```typescript
// migration/migrate-store.ts
export async function migrateStoreToDatabase() {
  // 1. Export current store data
  const storeData = useRocket.getState();
  
  // 2. Save rocket design
  const rocket = await rocketService.saveRocket({
    user_id: currentUser.id,
    name: storeData.rocket.name,
    parts: storeData.rocket.parts,
    motor_id: storeData.rocket.motorId,
    drag_coefficient: storeData.rocket.Cd,
    units: storeData.rocket.units
  });
  
  // 3. Save simulation results
  if (storeData.sim) {
    await simulationService.saveSimulation({
      rocket_id: rocket.id,
      user_id: currentUser.id,
      fidelity: storeData.lastSimulationType,
      max_altitude: storeData.sim.maxAltitude,
      max_velocity: storeData.sim.maxVelocity,
      // ... other fields
    });
  }
  
  // 4. Save analysis results
  if (storeData.stabilityAnalysis) {
    await analysisService.saveAnalysis({
      rocket_id: rocket.id,
      analysis_type: 'stability',
      results: storeData.stabilityAnalysis
    });
  }
}
```

---

## 🔧 **Development Workflow**

### 1. **Local Development**
```bash
# Start Supabase locally
supabase start

# Apply migrations
supabase db reset

# Generate types
supabase gen types typescript --local > types/database.ts
```

### 2. **Testing**
```typescript
// Setup test database
import { createClient } from '@supabase/supabase-js';

const testClient = createClient(
  'http://localhost:54321',
  'test-anon-key'
);
```

### 3. **Deployment**
```bash
# Deploy migrations
supabase db push

# Deploy functions
supabase functions deploy
```

---

## 💰 **Cost Optimization Tips**

1. **Use Connection Pooling**: Reduce database connections
2. **Implement Caching**: Cache expensive queries (simulations)
3. **Optimize Queries**: Use indexes, avoid N+1 problems
4. **Archive Old Data**: Move old simulations to cold storage
5. **Monitor Usage**: Track actual vs expected usage

---

## 🎯 **Success Metrics to Track**

1. **Performance**: Query response times, cache hit rates
2. **Usage**: Active users, simulations per user, storage growth
3. **Costs**: Database usage, cache usage, storage costs
4. **Reliability**: Uptime, error rates, data consistency

This setup gives you a production-ready, scalable database architecture that starts free and grows with your startup! 🚀 