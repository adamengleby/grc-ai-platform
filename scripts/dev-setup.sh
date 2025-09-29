#!/bin/bash

# Local Development Setup Script for GRC Analytics Platform
set -e

echo "🚀 Setting up GRC Analytics Platform for local development..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "\n${BLUE}📋 $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Found: $(node -v)"
        exit 1
    fi
    print_status "Node.js $(node -v) ✓"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker and try again."
        exit 1
    fi
    print_status "Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1) ✓"
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose and try again."
        exit 1
    fi
    print_status "Docker Compose $(docker compose version --short) ✓"
}

# Setup environment files
setup_environment() {
    print_step "Setting up environment configuration..."
    
    # Copy environment file if it doesn't exist
    if [ ! -f .env.local ]; then
        if [ -f .env.local ]; then
            cp .env.local .env.local
            print_status "Created .env.local from template"
        else
            print_warning ".env.local template not found, creating basic configuration..."
            cat > .env.local << EOF
VITE_ANALYTICS_API_URL=http://localhost:3005/api/v1
VITE_USE_LOCAL_BACKEND=true
VITE_FALLBACK_TO_MOCK=true
NODE_ENV=development
USE_REAL_ARCHER_DATA=false
EOF
        fi
    else
        print_status ".env.local already exists"
    fi
    
    # Create data directories
    mkdir -p data/mongodb-init
    mkdir -p data/archer-cache  
    mkdir -p data/ml-models
    mkdir -p data/pipeline-logs
    mkdir -p tools/mock-archer/data
    
    print_status "Data directories created"
}

# Install dependencies
install_dependencies() {
    print_step "Installing dependencies..."
    
    # Install root dependencies
    if [ -f package.json ]; then
        npm install
        print_status "Root dependencies installed"
    fi
    
    # Install backend dependencies
    if [ -d packages/backend ] && [ -f packages/backend/package.json ]; then
        cd packages/backend
        npm install
        cd ../..
        print_status "Backend dependencies installed"
    fi
    
    # Install frontend dependencies
    if [ -d packages/frontend ] && [ -f packages/frontend/package.json ]; then
        cd packages/frontend
        npm install
        cd ../..
        print_status "Frontend dependencies installed"
    fi
    
    # Install MCP server dependencies
    if [ -d packages/mcp-server ] && [ -f packages/mcp-server/package.json ]; then
        cd packages/mcp-server
        npm install
        cd ../..
        print_status "MCP server dependencies installed"
    fi
}

# Build Docker images
build_docker_images() {
    print_step "Building Docker images..."
    
    # Build all services
    docker compose -f docker-compose.local.yml build --no-cache
    print_status "Docker images built successfully"
}

# Start services
start_services() {
    print_step "Starting local development services..."
    
    # Start infrastructure services first
    print_status "Starting infrastructure services (MongoDB, Redis)..."
    docker compose -f docker-compose.local.yml up -d mongodb redis
    
    # Wait for databases to be ready
    print_status "Waiting for databases to be ready..."
    sleep 10
    
    # Start application services
    print_status "Starting application services..."
    docker compose -f docker-compose.local.yml up -d
    
    # Wait for services to start
    sleep 15
}

# Health check
health_check() {
    print_step "Running health checks..."
    
    # Check if services are running
    services=("mongodb" "redis" "analytics-api" "mcp-server")
    
    for service in "${services[@]}"; do
        if docker compose -f docker-compose.local.yml ps | grep -q "$service.*Up"; then
            print_status "$service is running ✓"
        else
            print_error "$service is not running ✗"
        fi
    done
    
    # Check API endpoints
    print_status "Checking API endpoints..."
    
    # Wait a bit more for APIs to be ready
    sleep 5
    
    # Check analytics API
    if curl -s -f http://localhost:3005/health > /dev/null 2>&1; then
        print_status "Analytics API is healthy ✓"
    else
        print_warning "Analytics API health check failed (this might be normal during startup)"
    fi
    
    # Check MCP server
    if curl -s -f http://localhost:3006/health > /dev/null 2>&1; then
        print_status "MCP Server is healthy ✓"
    else
        print_warning "MCP Server health check failed (this might be normal during startup)"
    fi
}

# Display status and next steps
show_status() {
    print_step "Setup complete! 🎉"
    
    echo ""
    echo "📊 Your GRC Analytics Platform is now running locally:"
    echo ""
    echo "  🖥️  Frontend:          http://localhost:3000"
    echo "  🔧  Analytics API:     http://localhost:3005"
    echo "  🔌  MCP Server:        http://localhost:3006"
    echo "  📊  MongoDB:           mongodb://localhost:27017"
    echo "  🚀  Redis:             redis://localhost:6379"
    echo ""
    echo "🛠️  Useful commands:"
    echo "  📋  View logs:         docker compose -f docker-compose.local.yml logs -f"
    echo "  🔄  Restart services: docker compose -f docker-compose.local.yml restart"
    echo "  🛑  Stop services:     docker compose -f docker-compose.local.yml down"
    echo "  🧹  Full cleanup:      docker compose -f docker-compose.local.yml down -v"
    echo ""
    echo "🔧  Development features:"
    echo "  • Automatic code reload enabled"
    echo "  • Mock data with realistic patterns"
    echo "  • Frontend fallback protection"
    echo "  • Debug logging enabled"
    echo ""
    echo "💡  Next steps:"
    echo "  1. Start your frontend development server: npm run dev"
    echo "  2. Open http://localhost:3000 in your browser" 
    echo "  3. Check the analytics dashboard to see it working!"
    echo "  4. Edit backend code - changes will auto-reload"
    echo ""
    print_warning "Note: Currently using mock data. Configure Archer credentials in .env.local to use real data."
}

# Main execution
main() {
    echo "🏗️  GRC Analytics Platform - Local Development Setup"
    echo "=================================================="
    
    check_prerequisites
    setup_environment
    install_dependencies
    build_docker_images
    start_services
    health_check
    show_status
}

# Handle script interruption
trap 'print_error "Setup interrupted. You may need to clean up with: docker compose -f docker-compose.local.yml down"; exit 1' INT

# Run main function
main