# 🚀 ROCKETv1 Docker Setup Guide

This guide will help you set up and run the complete ROCKETv1 platform with Docker, including authentication, database integration, and all AI-powered features.

## 📋 Prerequisites

### Required Software
- **Docker Desktop** (latest version)
- **Git** for cloning the repository
- A **Supabase account** (free tier available)
- An **OpenAI API key**

### Required API Keys
- **Supabase**: Database and authentication
- **OpenAI**: AI agent functionality  
- **Weather API**: At least one weather service
- **Redis** (optional): For caching

---

## 🏗️ Quick Start

### 1. Clone and Navigate
```bash
git clone https://github.com/your-org/ROCKETv1.git
cd ROCKETv1
```

### 2. Set Up Environment Variables
Create a `.env` file in the root directory with your credentials:

```env
# Supabase Database (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# OpenAI API (Required)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Weather API (At least one required)
NEXT_PUBLIC_OPENWEATHER_API_KEY=your-openweather-key-here

# Redis Cache (Optional but recommended)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token-here
```

### 3. Run with Docker
```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

### 4. Access the Application
- **Web App**: http://localhost:3000
- **AI Agent Service**: http://localhost:8002
- **Physics Simulation**: http://localhost:8000

---

## 🔑 Setting Up Required Services

### Supabase Database Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose your organization and region

2. **Get Your Credentials**
   - Go to Project Settings → API
   - Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

3. **Set Up Database Schema**
   The schema will be automatically created when you first run the application.

### OpenAI API Setup

1. **Get API Key**
   - Go to [platform.openai.com](https://platform.openai.com/api-keys)
   - Create a new secret key
   - Copy it to `OPENAI_API_KEY`

2. **Add Credits**
   - Add billing information to your OpenAI account
   - Recommended: Start with $5-10 for testing

### Weather API Setup

**Option 1: OpenWeatherMap (Recommended)**
1. Go to [openweathermap.org](https://openweathermap.org/api)
2. Sign up for a free account
3. Get your API key
4. Set `NEXT_PUBLIC_OPENWEATHER_API_KEY`

**Option 2: WeatherAPI**
1. Go to [weatherapi.com](https://www.weatherapi.com/)
2. Sign up for free tier
3. Set `WEATHERAPI_KEY`

### Redis Cache Setup (Optional)

**Upstash Redis (Recommended)**
1. Go to [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy the REST URL and token
4. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

---

## 🐳 Docker Commands

### Basic Operations
```bash
# Build and start all services
docker-compose up --build

# Start in background
docker-compose up -d

# Stop all services  
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f web
docker-compose logs -f agentpy
docker-compose logs -f rocketpy
```

### Development Commands
```bash
# Rebuild specific service
docker-compose build web
docker-compose build agentpy
docker-compose build rocketpy

# Clean up everything
docker-compose down -v --remove-orphans
docker system prune -f

# Check service status
docker-compose ps
```

---

## 🔧 Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Agent Service │    │  RocketPy API   │
│   (Next.js)     │◄──►│   (Python)      │◄──►│   (Python)      │
│   Port: 3000    │    │   Port: 8002    │    │   Port: 8000    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  External APIs  │
                    │                 │
                    │ • Supabase DB   │
                    │ • OpenAI        │
                    │ • Weather APIs  │
                    │ • Redis Cache   │
                    └─────────────────┘
```

### Service Details

**Frontend (Port 3000)**
- Next.js 14 with App Router
- React Three Fiber for 3D visualization
- Supabase authentication
- Real-time chat with AI agents

**Agent Service (Port 8002)**
- OpenAI Agents SDK
- Multi-agent system (Design, Simulation, Metrics)
- Tool execution and action dispatching
- Context-aware conversations

**RocketPy Service (Port 8000)**
- Professional rocket simulation
- 6-DOF flight dynamics
- Monte Carlo analysis
- Performance optimization

---

## 🚨 Troubleshooting

### Common Issues

**1. Database Connection Errors**
```bash
# Check Supabase credentials
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Test connection
curl -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"
```

**2. OpenAI API Errors**
```bash
# Verify API key format
echo $OPENAI_API_KEY | grep "^sk-"

# Check API status
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
```

**3. Docker Build Issues**
```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache

# Check Docker resources
docker system df
```

**4. Port Conflicts**
```bash
# Check what's using ports
lsof -i :3000
lsof -i :8000  
lsof -i :8002

# Kill processes if needed
sudo kill -9 <PID>
```

### Service Health Checks

```bash
# Check service status
docker-compose ps

# Manual health checks
curl http://localhost:3000        # Frontend
curl http://localhost:8002/health # Agent service
curl http://localhost:8000/health # RocketPy service
```

### Logs and Debugging

```bash
# View all logs
docker-compose logs -f

# View specific service logs with timestamps
docker-compose logs -f --timestamps web
docker-compose logs -f --timestamps agentpy
docker-compose logs -f --timestamps rocketpy

# Follow logs for debugging
docker-compose logs -f | grep ERROR
```

---

## 🎯 Testing the Setup

### 1. Authentication Test
1. Go to http://localhost:3000
2. Should redirect to authentication page
3. Create a new account
4. Verify email confirmation
5. Should redirect to main application

### 2. Database Test
1. Log in successfully
2. Check that user profile appears in left panel
3. Create a rocket design
4. Verify data persists after page refresh

### 3. AI Agent Test
1. Open chat panel
2. Send message: "Add a nose cone"
3. Verify AI responds and rocket updates
4. Check that conversation is saved

### 4. Simulation Test
1. Design a rocket with nose, body, fins
2. Send message: "Run a simulation"
3. Verify simulation results appear
4. Check 3D visualization updates

---

## 🔄 Updates and Maintenance

### Updating the Application
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up --build
```

### Database Migrations
```bash
# Check for schema updates
supabase db pull

# Apply migrations (if using Supabase CLI)
supabase db push
```

### Backup and Recovery
```bash
# Backup volumes
docker run --rm -v rocket-data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/rocket-data-backup.tar.gz -C /data .

# Restore volumes
docker run --rm -v rocket-data:/data -v $(pwd):/backup \
  ubuntu bash -c "cd /data && tar xzf /backup/rocket-data-backup.tar.gz"
```

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## 🆘 Getting Help

1. **Check the logs first**: `docker-compose logs -f`
2. **Verify environment variables**: Check your `.env` file
3. **Test service health**: `docker-compose ps`
4. **Clean and rebuild**: `docker-compose down -v && docker-compose up --build`

If issues persist, please create an issue with:
- Your OS and Docker version
- Complete error logs
- Environment variable names (not values)
- Steps to reproduce the issue

---

**🚀 Happy rocket designing!** 