# Development Workflow

This document explains the different ways to run ROCKET v1 in development mode, optimized for fast iteration and hot reloading.

## 🚀 Quick Start

### Option 1: Hybrid Development (Recommended)
Run Next.js locally, Python services in Docker:
```bash
npm run dev:local
# or
./scripts/dev-local.sh
```

### Option 2: Full Docker Development
All services in Docker with hot reloading:
```bash
npm run dev:docker
# or
./scripts/dev.sh
```

### Option 3: Local Development Only
Everything running locally (requires Python setup):
```bash
npm run dev
```

## 📋 Development Modes Comparison

| Mode | Next.js | Python Services | Build Time | Hot Reload | Resource Usage |
|------|---------|-----------------|------------|-------------|----------------|
| **Hybrid** | Local | Docker | Fast ⚡ | Yes | Medium |
| **Full Docker** | Docker | Docker | Medium | Yes | High |
| **Local Only** | Local | Local | Fastest ⚡⚡ | Yes | Low |

## 🐳 Docker Development Commands

### Initial Setup (First Time Only)
```bash
# Build development images
npm run docker:build
```

### Daily Development
```bash
# Start all services with hot reloading
npm run dev:docker

# Start only Python services (for hybrid mode)
npm run services:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

### Rebuild When Needed
```bash
# Rebuild and start (only when dependencies change)
npm run dev:docker:build
```

## 📁 File Structure & Hot Reloading

The development setup uses volume mounts for instant file changes:

```
📦 Hot Reload Paths
├── 🌐 Frontend (Next.js)
│   ├── app/          → /app/app (API routes, pages)
│   ├── components/   → /app/components
│   ├── lib/          → /app/lib
│   └── types/        → /app/types
├── 🐍 AgentPy Service
│   └── services/agentpy/ → /app (Python files)
└── 🚀 RocketPy Service
    └── services/rocketpy/ → /app (Python files)
```

## 🔧 Environment Configuration

### Development Environment Variables
Create `.env.local` for local overrides:
```env
# Local development overrides
NODE_ENV=development
AGENT_URL=http://localhost:8002
ROCKETPY_URL=http://localhost:8000

# Enable development features
NEXT_TELEMETRY_DISABLED=1
```

### Python Service Configuration
Both Python services support auto-reload via `uvicorn --reload`:
- Changes to `.py` files trigger automatic restart
- No manual restart needed during development

## 🛠️ Troubleshooting

### Common Issues

**1. Docker build fails**
```bash
# Clean Docker cache and rebuild
docker system prune -f
npm run docker:build
```

**2. Port conflicts**
```bash
# Check what's using ports 3000, 8000, 8002
lsof -i :3000 -i :8000 -i :8002

# Stop conflicting services
npm run docker:down
```

**3. Hot reload not working**
```bash
# Restart with fresh volumes
docker-compose -f docker-compose.dev.yml down -v
npm run dev:docker
```

**4. Python dependency changes**
```bash
# Rebuild Python services only
docker-compose -f docker-compose.dev.yml build agentpy rocketpy
```

### Performance Optimization

**For M1/M2 Macs:**
- Use `:cached` volume mounts (already configured)
- Consider using `colima` instead of Docker Desktop for better performance

**For Windows WSL2:**
- Keep files in WSL2 filesystem for better volume performance
- Use Docker Desktop with WSL2 backend

## 🔄 Development Workflow

### Typical Development Session
```bash
# 1. Start services
npm run dev:local

# 2. Make changes to files
# - Frontend changes: Instant hot reload
# - Python changes: Auto-restart services

# 3. View logs if needed
npm run docker:logs

# 4. Stop when done
# Ctrl+C stops local Next.js
# Services stop automatically
```

### When to Rebuild
- ✅ **Never rebuild** for code changes
- ⚠️ **Rebuild** when adding new npm packages
- ⚠️ **Rebuild** when adding new Python packages
- ⚠️ **Rebuild** when changing Dockerfile

### Testing Changes
```bash
# Test Monte Carlo simulation fix
curl -X POST http://localhost:3000/api/simulate/monte-carlo \
  -H "Content-Type: application/json" \
  -d '{"rocket":{"name":"test"},"environment":{"windDirection":-79}}'
```

## 📊 Performance Tips

1. **Use Hybrid Mode**: Fastest for frontend development
2. **Exclude node_modules**: Already configured in volume mounts
3. **Use .dockerignore**: Prevent unnecessary file copies
4. **Cache Dependencies**: Development Dockerfiles cache pip/npm installs
5. **Monitor Resources**: Use `docker stats` to check resource usage

## 🎯 Next Steps

Once your development environment is running:
1. Visit http://localhost:3000 for the web app
2. Check http://localhost:8000/health for RocketPy service
3. Check http://localhost:8002/health for AgentPy service
4. Start developing with instant feedback!

## 🆘 Need Help?

- Check the main README.md for general setup
- View logs: `npm run docker:logs`
- Reset everything: `npm run docker:down && npm run dev:docker:build` 