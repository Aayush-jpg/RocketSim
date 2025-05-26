# 🚀 Rocket-Cursor AI

## **Agent-SDK Edition**

*A professional-grade rocket design and simulation platform powered by Next.js 14, React Three Fiber, Python RocketPy, and OpenAI Agents SDK.*

![Rocket-Cursor AI](https://img.shields.io/badge/Rocket--Cursor-AI-blue?style=for-the-badge&logo=rocket)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![RocketPy](https://img.shields.io/badge/RocketPy-6DOF-red?style=for-the-badge&logo=python)
![OpenAI](https://img.shields.io/badge/OpenAI-Agents--SDK-green?style=for-the-badge&logo=openai)

---

## ✨ **Features**

### **🎯 Core Capabilities**
- **Intelligent Rocket Design**: Natural language rocket configuration using OpenAI Agents SDK
- **6-DOF Simulation**: High-fidelity physics simulation powered by RocketPy
- **3D Visualization**: Real-time 3D rocket rendering and trajectory visualization with React Three Fiber
- **Monte Carlo Analysis**: Statistical flight analysis with landing dispersion predictions
- **Multi-Motor Support**: Solid, liquid, and hybrid propulsion systems

### **📊 Advanced Analysis**
- **Trajectory Analysis**: 6-DOF flight path visualization and analysis
- **Stability Analysis**: Static and dynamic stability margin calculations
- **Motor Performance**: Thrust curve analysis and efficiency metrics
- **Recovery Prediction**: Parachute deployment and landing location forecasting
- **Environmental Modeling**: Atmospheric conditions and wind effects

### **🛠 Professional Tools**
- **Design Optimization**: AI-powered design suggestions for performance targets
- **Data Export**: CSV, JSON, and KML export for external analysis
- **Real-time Metrics**: Live performance indicators and stability monitoring
- **Fallback Simulations**: Graceful degradation when services are unavailable

---

## 🏗 **Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js Web   │    │  Python Agent   │    │  RocketPy API   │
│      App        │◄──►│    Service      │◄──►│    Service      │
│                 │    │                 │    │                 │
│  • 3D Rendering │    │ • OpenAI Agents │    │ • 6-DOF Physics │
│  • Chat UI      │    │ • Tool Routing  │    │ • Monte Carlo   │
│  • Real-time    │    │ • Action Dispatch│   │ • Atmospheric   │
│    Metrics      │    │                 │    │   Modeling      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
      Port 3000             Port 8002             Port 8000
```

### **Service Components**
1. **Web Application** (`Next.js 14`)
   - React Three Fiber 3D engine
   - Zustand state management
   - Tailwind CSS styling
   - Chat-based AI interaction

2. **Agent Service** (`Python + OpenAI Agents SDK`)
   - Natural language processing
   - Rocket design tool routing
   - Simulation orchestration
   - Action dispatching

3. **RocketPy Service** (`FastAPI + RocketPy`)
   - 6-DOF flight simulation
   - Monte Carlo analysis
   - Atmospheric modeling
   - Motor performance analysis

---

## 🚀 **Quick Start**

### **Prerequisites**
- [Docker](https://docker.com) and Docker Compose
- [OpenAI API Key](https://platform.openai.com/api-keys)
- 8GB+ RAM recommended
- Modern web browser

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/rocket-cursor-ai.git
   cd rocket-cursor-ai
   ```

2. **Run the startup script**
   ```bash
   ./scripts/start.sh
   ```
   
   This will:
   - Create a `.env` template if needed
   - Build all Docker images
   - Start all services
   - Wait for health checks
   - Display service URLs

3. **Add your OpenAI API key**
   ```bash
   # Edit .env file
   OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   ```

4. **Restart services**
   ```bash
   docker-compose restart
   ```

5. **Open the application**
   - **Web App**: http://localhost:3000
   - **Agent API**: http://localhost:8002
   - **RocketPy API**: http://localhost:8000

---

## 💡 **Usage**

### **Basic Rocket Design**
```
🗣 "Create a simple model rocket with an ogive nose cone"
🗣 "Add fins with 8cm root chord and 6cm span"
🗣 "Change the motor to high-power"
🗣 "Run a simulation"
```

### **Advanced Analysis**
```
🗣 "Run a Monte Carlo analysis with 100 iterations"
🗣 "Analyze the stability margin for this design"
🗣 "Predict the recovery with a 1.2m² parachute"
🗣 "Export the trajectory data as CSV"
```

### **Environment Configuration**
```
🗣 "Set wind speed to 5 m/s from the east"
🗣 "Use forecast atmospheric model"
🗣 "Set launch site to 1000m elevation"
```

---

## 🔧 **Development**

### **Local Development Setup**

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development services**
   ```bash
   # Terminal 1: Web app
   npm run dev
   
   # Terminal 2: Agent service
   cd services/agentpy
   python app.py
   
   # Terminal 3: RocketPy service
   cd services/rocketpy
   python app.py
   ```

3. **Environment variables for development**
   ```bash
   # .env.local
   AGENT_URL=http://localhost:8002
   ROCKETPY_URL=http://localhost:8000
   OPENAI_API_KEY=sk-your-key-here
   ```

### **Project Structure**
```
rocket-cursor-ai/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── agent/               # Agent proxy
│   │   ├── motors/              # Motor database
│   │   └── simulate/            # Simulation endpoints
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home page
├── components/                   # React components
│   ├── panels/                  # UI panels
│   ├── 3d/                      # 3D components
│   └── ChatPanel.tsx            # Chat interface
├── lib/                         # Utilities
│   ├── ai/                      # AI action handlers
│   └── store.ts                 # Zustand store
├── services/                    # Backend services
│   ├── agentpy/                 # Python agent service
│   │   ├── tools/               # Agent tools
│   │   ├── app.py               # FastAPI server
│   │   └── requirements.txt     # Python deps
│   └── rocketpy/                # RocketPy service
│       ├── app.py               # FastAPI server
│       └── requirements.txt     # Python deps
├── types/                       # TypeScript types
├── scripts/                     # Deployment scripts
├── docker-compose.yml           # Service orchestration
└── README.md                    # Documentation
```

---

## 📊 **Motor Database**

The system includes 8 predefined motor types:

| Motor ID | Type | Class | Thrust | Burn Time | Total Impulse |
|----------|------|-------|--------|-----------|---------------|
| `mini-motor` | Solid | A | 1.5N | 1.8s | 2.7 N⋅s |
| `default-motor` | Solid | F | 32N | 2.5s | 80 N⋅s |
| `high-power` | Solid | H | 100N | 3.2s | 320 N⋅s |
| `super-power` | Solid | I | 200N | 4.0s | 800 N⋅s |
| `small-liquid` | Liquid | M | 500N | 30s | 15,000 N⋅s |
| `medium-liquid` | Liquid | O | 2000N | 45s | 90,000 N⋅s |
| `large-liquid` | Liquid | P | 8000N | 15s | 120,000 N⋅s |
| `hybrid-engine` | Hybrid | N | 1200N | 20s | 24,000 N⋅s |

---

## 🌍 **Deployment**

### **Production Deployment**

1. **Cloud Deployment** (Recommended)
   ```bash
   # Build and push images
   docker-compose build
   docker tag rocket-cursor-ai_web your-registry/rocket-web:latest
   docker tag rocket-cursor-ai_agentpy your-registry/rocket-agent:latest
   docker tag rocket-cursor-ai_rocketpy your-registry/rocket-sim:latest
   
   # Deploy to your cloud provider
   docker push your-registry/rocket-web:latest
   docker push your-registry/rocket-agent:latest
   docker push your-registry/rocket-sim:latest
   ```

2. **Environment Variables**
   ```bash
   # Production .env
   NODE_ENV=production
   OPENAI_API_KEY=sk-prod-key-here
   AGENT_URL=https://your-agent-service.com
   ROCKETPY_URL=https://your-rocketpy-service.com
   ```

3. **Scaling Configuration**
   ```yaml
   # docker-compose.prod.yml
   version: '3.8'
   services:
     web:
       replicas: 3
       resources:
         limits:
           memory: 512M
     agentpy:
       replicas: 2
       resources:
         limits:
           memory: 1G
     rocketpy:
       replicas: 2
       resources:
         limits:
           memory: 2G
   ```

---

## 🛡 **Security & Best Practices**

### **API Security**
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS configuration for production
- API key encryption and rotation

### **Performance Optimization**
- Docker multi-stage builds
- Next.js standalone output
- Component lazy loading
- Simulation result caching

### **Monitoring**
- Health checks for all services
- Structured logging
- Performance metrics
- Error tracking

---

## 🤝 **Contributing**

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Run tests**
   ```bash
   npm run test
   npm run lint
   ```
5. **Submit a pull request**

### **Development Guidelines**
- Follow TypeScript strict mode
- Use conventional commit messages
- Add tests for new features
- Update documentation
- Ensure Docker builds pass

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **RocketPy Team** for the incredible 6-DOF simulation engine
- **OpenAI** for the Agents SDK and API
- **React Three Fiber** team for the 3D rendering framework
- **Next.js** team for the excellent web framework
- **Vercel** for hosting and deployment tools

---

## 📞 **Support**

- **Documentation**: [Full API Docs](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/rocket-cursor-ai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/rocket-cursor-ai/discussions)
- **Email**: support@rocket-cursor-ai.com

---

**Built with ❤️ for the rocketry community**

*Ignition sequence complete—lift off! 🚀* 