#!/bin/bash

# Deployment script for SiliconFlow Load Balancer
# Usage: ./deploy.sh [environment]

ENVIRONMENT=${1:-"production"}
IMAGE_TAG=${2:-"main"}

echo "🚀 Deploying SiliconFlow Load Balancer"
echo "Environment: $ENVIRONMENT"
echo "Image Tag: $IMAGE_TAG"
echo "=================================="

# Check if required files exist
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create it from .env.example"
    exit 1
fi

if [ ! -f "keys.txt" ]; then
    echo "❌ keys.txt file not found. Please create it from keys.txt.example"
    exit 1
fi

# Pull latest image
echo "📦 Pulling latest image..."
docker pull ghcr.io/yourusername/siliconflow-lb:$IMAGE_TAG

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Start new containers
echo "🚀 Starting new containers..."
docker-compose up -d

# Wait for containers to be healthy
echo "⏳ Waiting for containers to be healthy..."
sleep 10

# Run health check
echo "🏥 Running health check..."
if [ -f "./health-check.sh" ]; then
    chmod +x health-check.sh
    ./health-check.sh
else
    echo "⚠️  health-check.sh not found, manual verification needed"
fi

echo "=================================="
echo "🎉 Deployment completed!"
echo "📊 Check logs: docker-compose logs -f"
echo "📈 Monitor: docker-compose ps"
