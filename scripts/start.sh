#!/bin/bash

# Rocket-Cursor AI Startup Script
echo "🚀 Starting Rocket-Cursor AI System..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating template..."
    cat > .env << EOF
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Service URLs (automatically configured for Docker)
AGENT_URL=http://agentpy:8002
ROCKETPY_URL=http://rocketpy:8000

# Optional: Database URL for production
# DATABASE_URL=postgresql://user:password@localhost:5432/rocket_db
EOF
    echo "📝 Please edit .env file with your OpenAI API key"
    echo "💡 Get your API key from: https://platform.openai.com/api-keys"
    exit 1
fi

# Build and start services
echo "🔨 Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
for i in {1..30}; do
    if docker-compose ps | grep -q "healthy"; then
        break
    fi
    echo "   Waiting... ($i/30)"
    sleep 2
done

# Check service status
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "✅ Rocket-Cursor AI is starting up!"
echo "🌐 Web Application: http://localhost:3000"
echo "🤖 Agent Service: http://localhost:8002"
echo "🔬 RocketPy Service: http://localhost:8000"
echo ""
echo "📝 View logs with: docker-compose logs -f"
echo "🛑 Stop services with: docker-compose down" 