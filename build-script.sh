#!/bin/bash
set -e

echo "🚀 Building GRC React Frontend from GitHub Repository (FINAL VERSION)..."

# Install dependencies
apt-get update && apt-get install -y git curl

echo "📥 Cloning repository..."
git clone https://github.com/adamengleby/grc-ai-platform.git /tmp/repo

echo "📁 Repository structure analysis:"
ls -la /tmp/repo/

echo "🔍 Checking for frontend structure..."
if [ -d '/tmp/repo/packages/frontend' ]; then
    echo "Found packages/frontend structure"
    cd /tmp/repo/packages/frontend
elif [ -f '/tmp/repo/vite.config.ts' ]; then
    echo "Found root frontend structure"
    cd /tmp/repo
else
    echo "ERROR: No frontend structure found"
    exit 1
fi

echo "📁 Working directory:"
pwd && ls -la

echo "📦 Installing dependencies..."
npm ci

echo "🏗️ Building React application..."
VITE_API_BASE_URL='https://grc-backend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io/api/v1' npm run build

echo "✅ Build completed. Verifying output..."
ls -la dist/

echo "📋 Build contents:"
find dist -type f -name '*.html' -o -name '*.js' -o -name '*.css' | head -10

echo "🚚 Setting up production server..."
mkdir -p /app
cp -r dist/* /app/
cd /app

echo "📄 Checking copied files..."
ls -la

echo "📦 Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "grc-frontend-production",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.19.2",
    "node-fetch": "^3.3.2"
  }
}
EOF

npm install

echo "⚙️ Creating Express server..."
cat > server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();

// Security headers
app.use((req, res, next) => {
  res.header('X-Frame-Options', 'DENY');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve static files with proper caching
app.use(express.static('.', {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true
}));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'GRC React Frontend - GitHub Production Build (FINAL)',
    version: '2025-09-25-github-final-build',
    timestamp: new Date().toISOString(),
    build: 'production-react-github-final',
    features: {
      'actual-react-app': true,
      'mcp-validation-removed': true,
      'github-adaptive-structure': true,
      'production-build': true
    }
  });
});

// API health proxy
app.get('/api/health', async (req, res) => {
  try {
    const fetch = await import('node-fetch').then(m => m.default || m);
    const response = await fetch('https://grc-backend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io/health');
    const data = await response.json();
    res.json({ frontend: 'healthy', backend: data });
  } catch (error) {
    res.status(500).json({ frontend: 'healthy', backend: 'error', error: error.message });
  }
});

// SPA fallback - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('🚀 GRC React Frontend (GitHub FINAL Production Build) on port', port);
  console.log('🔗 API Base URL:', process.env.VITE_API_BASE_URL);
  console.log('✅ Proper React application with MCP validation removed');
  console.log('📁 Built from GitHub repository with adaptive structure detection');
  console.log('🎯 Features: Full React UI, Agent creation without MCP');
});
EOF

echo "🧹 Cleaning up build artifacts..."
rm -rf /tmp/repo

echo "🎉 Starting GitHub FINAL React production frontend..."
node server.js