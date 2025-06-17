#!/bin/bash

# Development startup script for ROCKET v1
echo "🚀 Starting ROCKET v1 Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Build development images only if they don't exist or --build flag is passed
if [ "$1" = "--build" ] || [ "$1" = "-b" ]; then
    echo "🔨 Building development images..."
    docker-compose -f docker-compose.dev.yml build
fi

# Start services in development mode
echo "🚀 Starting development services..."
docker-compose -f docker-compose.dev.yml up

# Cleanup function
cleanup() {
    echo "🛑 Stopping development services..."
    docker-compose -f docker-compose.dev.yml down
}

# Trap SIGINT and SIGTERM to gracefully shutdown
trap cleanup INT TERM

# Wait for signals
wait 