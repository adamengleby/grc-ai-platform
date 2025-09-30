#!/bin/bash
set -e

echo "🚀 GRC Frontend v1.3.0 - Building React App..."

# Install required tools
apt-get update -qq
apt-get install -y git curl

# Clone latest code
echo "📥 Cloning latest frontend code..."
rm -rf /tmp/repo 2>/dev/null || true
git clone --depth 1 https://github.com/adamengleby/grc-ai-platform.git /tmp/repo
cd /tmp/repo

echo "📋 Latest commit:"
git log -1 --oneline

# Build React app
echo "🏗️ Building frontend..."
cd packages/frontend
npm install
npm run build

# Install Express for serving
npm install express

# Set up production server
echo "📦 Setting up production server..."
mkdir -p /app
cd /app

# Copy built React app
cp -r /tmp/repo/packages/frontend/dist/* .

# Copy server file
cp /tmp/repo/packages/frontend/server.js .

# Create package.json
cat > package.json << 'EOF'
{
  "name": "grc-frontend",
  "version": "1.3.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.19.2"
  }
}
EOF

npm install

echo "🧹 Cleaning up..."
rm -rf /tmp/repo

echo "🎉 Starting GRC Frontend v1.3.0 - Clean URLs..."
node server.js