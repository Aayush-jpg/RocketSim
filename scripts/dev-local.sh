#!/bin/bash

# Hybrid development mode - Run Next.js locally, Python services in Docker
echo "🚀 Starting ROCKET v1 Hybrid Development Environment..."
echo "   📦 Python services in Docker"
echo "   💻 Next.js app running locally"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js and try again."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    if [ -f "pnpm-lock.yaml" ]; then
        pnpm install
    else
        npm install
    fi
fi

# Start only the Python services in Docker
echo "🐍 Starting Python services in Docker..."
docker-compose -f docker-compose.dev.yml up -d agentpy rocketpy

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Set environment variables for local development
export NODE_ENV=development
export AGENT_URL=http://localhost:8002
export ROCKETPY_URL=http://localhost:8000

# Start Next.js development server locally
echo "🌐 Starting Next.js development server locally..."
if [ -f "pnpm-lock.yaml" ]; then
    pnpm dev
else
    npm run dev
fi

# Cleanup function
cleanup() {
    echo "🛑 Stopping services..."
    docker-compose -f docker-compose.dev.yml down
}

# Trap SIGINT and SIGTERM to gracefully shutdown
trap cleanup INT TERM 