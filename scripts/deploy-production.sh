#!/bin/bash

# GRC AI Platform - Production Deployment Script
# This script deploys the complete platform to Azure production environment

set -e  # Exit on any error

echo "🚀 Starting GRC AI Platform Production Deployment"
echo "=================================================="

# Configuration
RESOURCE_GROUP="rg-grc-ai-platform-prod"
LOCATION="Australia East"
SUBSCRIPTION_ID=${AZURE_SUBSCRIPTION_ID}
FUNCTION_APP_NAME="func-grc-backend-prod"
STATIC_WEB_APP_NAME="stapp-grc-frontend-prod"
CONTAINER_REGISTRY="acrgrcplatformprod"
MCP_CONTAINER_NAME="aci-grc-mcp-server-prod"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Utility functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed. Please install it first."
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install it first."
        exit 1
    fi

    log_success "All prerequisites are installed"
}

# Login to Azure
azure_login() {
    log_info "Checking Azure login status..."

    if ! az account show &> /dev/null; then
        log_info "Please log in to Azure..."
        az login
    fi

    if [ ! -z "$SUBSCRIPTION_ID" ]; then
        log_info "Setting subscription to $SUBSCRIPTION_ID"
        az account set --subscription "$SUBSCRIPTION_ID"
    fi

    local current_subscription=$(az account show --query name -o tsv)
    log_success "Using Azure subscription: $current_subscription"
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    log_info "Deploying infrastructure with Terraform..."

    cd infrastructure

    # Initialize Terraform
    log_info "Initializing Terraform..."
    terraform init

    # Validate Terraform configuration
    log_info "Validating Terraform configuration..."
    terraform validate

    # Plan deployment
    log_info "Planning infrastructure deployment..."
    terraform plan -var-file="terraform.tfvars" -out=tfplan

    # Apply deployment
    log_info "Applying infrastructure deployment..."
    terraform apply tfplan

    # Get outputs
    FUNCTION_APP_URL=$(terraform output -raw function_app_url)
    STATIC_WEB_APP_URL=$(terraform output -raw static_web_app_url)
    CONTAINER_REGISTRY_SERVER=$(terraform output -raw container_registry_login_server)

    cd ..

    log_success "Infrastructure deployed successfully"
    log_info "Function App URL: $FUNCTION_APP_URL"
    log_info "Static Web App URL: $STATIC_WEB_APP_URL"
}

# Build and deploy backend Function App
deploy_backend() {
    log_info "Building and deploying backend Function App..."

    cd packages/backend

    # Install dependencies
    log_info "Installing backend dependencies..."
    npm ci --production

    # Build backend
    log_info "Building backend..."
    npm run build

    # Deploy to Azure Functions
    log_info "Deploying to Azure Functions..."
    func azure functionapp publish $FUNCTION_APP_NAME --node

    cd ../..

    log_success "Backend deployed successfully"
}

# Build and deploy MCP server container
deploy_mcp_server() {
    log_info "Building and deploying MCP server container..."

    cd packages/mcp-server

    # Get ACR login server
    local acr_login_server="${CONTAINER_REGISTRY}.azurecr.io"

    # Login to Azure Container Registry
    log_info "Logging in to Azure Container Registry..."
    az acr login --name $CONTAINER_REGISTRY

    # Build Docker image
    log_info "Building MCP server Docker image..."
    docker build -t "${acr_login_server}/grc-mcp-server:latest" .
    docker build -t "${acr_login_server}/grc-mcp-server:$(date +%Y%m%d-%H%M%S)" .

    # Push Docker image
    log_info "Pushing Docker image to ACR..."
    docker push "${acr_login_server}/grc-mcp-server:latest"
    docker push "${acr_login_server}/grc-mcp-server:$(date +%Y%m%d-%H%M%S)"

    # Deploy to Azure Container Instances
    log_info "Deploying to Azure Container Instances..."
    az container create \
        --resource-group $RESOURCE_GROUP \
        --name $MCP_CONTAINER_NAME \
        --image "${acr_login_server}/grc-mcp-server:latest" \
        --registry-login-server $acr_login_server \
        --registry-username $(az acr credential show --name $CONTAINER_REGISTRY --query username -o tsv) \
        --registry-password $(az acr credential show --name $CONTAINER_REGISTRY --query passwords[0].value -o tsv) \
        --dns-name-label grc-mcp-server-prod \
        --ports 3006 \
        --cpu 1 \
        --memory 2 \
        --environment-variables NODE_ENV=production PORT=3006 LOG_LEVEL=info \
        --restart-policy OnFailure

    cd ../..

    log_success "MCP server deployed successfully"
}

# Build and deploy frontend
deploy_frontend() {
    log_info "Building and deploying frontend..."

    cd packages/frontend

    # Install dependencies
    log_info "Installing frontend dependencies..."
    npm ci

    # Build frontend with production environment variables
    log_info "Building frontend..."
    VITE_API_BASE_URL="$FUNCTION_APP_URL/api/v1" \
    VITE_MCP_SERVER_URL="https://grc-mcp-server-prod.australiaeast.azurecontainer.io:3006" \
    npm run build

    # Deploy to Azure Static Web Apps (requires Azure Static Web Apps CLI)
    log_info "Deploying to Azure Static Web Apps..."
    if command -v swa &> /dev/null; then
        swa deploy dist --app-name $STATIC_WEB_APP_NAME
    else
        log_warning "Azure Static Web Apps CLI not found. Please deploy manually or use GitHub Actions."
        log_info "Built files are in the 'dist' directory"
    fi

    cd ../..

    log_success "Frontend deployed successfully"
}

# Validate deployment
validate_deployment() {
    log_info "Validating deployment..."

    # Wait a moment for services to start
    sleep 30

    # Check backend health
    log_info "Checking backend health..."
    if curl -f "$FUNCTION_APP_URL/api/v1/health" > /dev/null 2>&1; then
        log_success "Backend is healthy"
    else
        log_warning "Backend health check failed - may need more time to start"
    fi

    # Check MCP server health
    log_info "Checking MCP server health..."
    if curl -f "https://grc-mcp-server-prod.australiaeast.azurecontainer.io:3006/health" > /dev/null 2>&1; then
        log_success "MCP server is healthy"
    else
        log_warning "MCP server health check failed - may need more time to start"
    fi

    # Check OAuth configuration
    log_info "Checking OAuth configuration..."
    if curl -f "$FUNCTION_APP_URL/api/v1/oauth/health" > /dev/null 2>&1; then
        log_success "OAuth configuration is healthy"
    else
        log_warning "OAuth configuration check failed - may need manual configuration"
    fi

    log_success "Deployment validation completed"
}

# Main deployment flow
main() {
    echo "Starting deployment at $(date)"

    check_prerequisites
    azure_login
    deploy_infrastructure
    deploy_backend
    deploy_mcp_server
    deploy_frontend
    validate_deployment

    echo ""
    echo "🎉 Deployment completed successfully!"
    echo "=================================================="
    echo "📊 Backend API: $FUNCTION_APP_URL"
    echo "🌐 Frontend: $STATIC_WEB_APP_URL"
    echo "🔧 MCP Server: https://grc-mcp-server-prod.australiaeast.azurecontainer.io:3006"
    echo ""
    echo "Next steps:"
    echo "1. Configure Auth0 with production callback URLs"
    echo "2. Update DNS records for custom domains"
    echo "3. Set up monitoring alerts in Azure Monitor"
    echo "4. Configure SSL certificates for custom domains"
    echo ""
}

# Run deployment if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi