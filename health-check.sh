#!/bin/bash

# Health check script for SiliconFlow Load Balancer
# Usage: ./health-check.sh [URL] [API_KEY]

URL=${1:-"http://localhost:3000"}
API_KEY=${2:-""}

echo "🏥 Health Check for SiliconFlow Load Balancer"
echo "URL: $URL"
echo "=================================="

# Check public info endpoint
echo "📊 Checking public info endpoint..."
if curl -s -f "$URL/info" > /dev/null; then
    echo "✅ Public info endpoint is healthy"
else
    echo "❌ Public info endpoint is down"
    exit 1
fi

# Check authenticated endpoints if API key provided
if [ -n "$API_KEY" ]; then
    echo "🔐 Checking authenticated endpoints..."
    
    # Check health endpoint
    if curl -s -f -H "Authorization: Bearer $API_KEY" "$URL/health" > /dev/null; then
        echo "✅ Health endpoint is healthy"
    else
        echo "❌ Health endpoint is down or unauthorized"
        exit 1
    fi
    
    # Check stats endpoint
    if curl -s -f -H "Authorization: Bearer $API_KEY" "$URL/stats" > /dev/null; then
        echo "✅ Stats endpoint is healthy"
    else
        echo "❌ Stats endpoint is down or unauthorized"
        exit 1
    fi
    
    echo "✅ All endpoints are healthy!"
else
    echo "ℹ️  Skipping authenticated endpoints (no API key provided)"
    echo "✅ Public endpoints are healthy!"
fi

echo "=================================="
echo "🎉 Health check completed successfully!"
