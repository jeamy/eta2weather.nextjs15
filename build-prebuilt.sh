#!/bin/bash
# Build script for eta2weather with pre-built approach
# This script builds Next.js locally and then creates a Docker image

set -e  # Exit on error

echo "🔨 Building Next.js application locally..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --legacy-peer-deps
fi

# Build Next.js
echo "⚙️  Running Next.js build..."
# Increase memory limit to avoid OOM (Killed) errors
export NODE_OPTIONS="--max-old-space-size=4096"
npx next build --webpack

# Check if build was successful
if [ ! -d ".next" ]; then
    echo "❌ Build failed - .next directory not found"
    exit 1
fi

echo "✅ Next.js build completed successfully"

# Copy the correct dockerignore for prebuilt
echo "📋 Preparing Docker context..."
cp .dockerignore .dockerignore.backup 2>/dev/null || true
cp .dockerignore.prebuilt .dockerignore

# Build Docker image
echo "🐳 Building Docker image..."
docker build -f Dockerfile.prebuilt -t eta2weather .

# Restore original dockerignore
echo "🔄 Restoring original .dockerignore..."
mv .dockerignore.backup .dockerignore 2>/dev/null || true

echo "✅ Docker image 'eta2weather' built successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deployment Options:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Option 1: Docker Run (Simple)"
echo "  docker run -p 3000:3000 \\"
echo "    -v \$(pwd)/db:/db \\"
echo "    -v \$(pwd)/public/log:/app/public/log \\"
echo "    -v \$(pwd)/src/config:/app/src/config \\"
echo "    eta2weather"
echo ""
echo "Option 2: Docker Compose (Recommended)"
echo "  docker-compose -f docker-compose.prebuilt.yml up -d"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

