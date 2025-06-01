# 🚀 ROCKETv1 - AI-Powered Rocket Engineering Platform

An advanced rocket design and simulation platform featuring AI-powered design assistance, real-time 3D visualization, professional-grade physics simulation, and comprehensive database integration.

## ⚡ Quick Start with Docker

### Prerequisites
- Docker Desktop
- Supabase account (free)
- OpenAI API key
- Weather API key (OpenWeatherMap recommended)

### 1. Clone Repository
```bash
git clone https://github.com/your-org/ROCKETv1.git
cd ROCKETv1
```

### 2. Set Up Environment
Create a `.env` file:
```env
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI
OPENAI_API_KEY=sk-your-openai-key

# Weather
NEXT_PUBLIC_OPENWEATHER_API_KEY=your-weather-key

# Cache (optional)
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### 3. Run Application
```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

### 4. Access Application
- **Web App**: http://localhost:3000
- **AI Agent Service**: http://localhost:8002
- **Physics Service**: http://localhost:8000

## 🛠️ Development Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Clean rebuild
docker-compose down -v && docker-compose up --build
```

## 🏗️ Architecture

- **Frontend**: Next.js 14 + React Three Fiber + Supabase Auth
- **AI Agents**: OpenAI Agents SDK with multi-agent system
- **Physics**: RocketPy for professional 6-DOF simulation
- **Database**: Supabase PostgreSQL with real-time features
- **Cache**: Upstash Redis for performance optimization

## 📚 Features

- 🤖 **AI-Powered Design**: Natural language rocket design and optimization
- 🎨 **3D Visualization**: Real-time React Three Fiber rocket rendering
- 🔬 **Professional Simulation**: RocketPy 6-DOF flight dynamics
- 🌍 **Real Weather Integration**: Live atmospheric data for accurate simulation
- 👤 **User Authentication**: Secure Supabase authentication with session management
- 💾 **Data Persistence**: Complete rocket designs and simulation history
- 📊 **Advanced Analytics**: Monte Carlo analysis, stability assessment, performance metrics

## 📖 Documentation

For detailed setup instructions, troubleshooting, and API documentation, see [DOCKER_SETUP.md](./DOCKER_SETUP.md).

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

**Built with ❤️ for the rocket engineering community** 