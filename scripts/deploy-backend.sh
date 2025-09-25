#!/bin/bash

echo "🚀 Deploying GRC Backend to Azure Functions..."

# Configuration
FUNCTION_APP_NAME="func-grc-backend-prod"
RESOURCE_GROUP="rg-grc-ai-platform-prod"
SOURCE_DIR="/Users/engleby/Desktop/Developer/grc-ai-platform/azure-function-app"

# Check if we have Azure CLI and are logged in
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found. Please install Azure CLI first."
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo "❌ Not logged into Azure. Please run 'az login' first."
    exit 1
fi

echo "✅ Azure CLI found and authenticated"

# Check if function app exists
echo "🔍 Checking if Function App exists..."
if ! az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo "❌ Function App $FUNCTION_APP_NAME not found in resource group $RESOURCE_GROUP"
    echo "💡 Please ensure Terraform infrastructure has been deployed first"
    exit 1
fi

echo "✅ Function App found: $FUNCTION_APP_NAME"

# Navigate to source directory
cd "$SOURCE_DIR" || exit 1

# Build the application
echo "🔨 Building TypeScript application..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"

# Create deployment package
echo "📦 Creating deployment package..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="grc-backend-${TIMESTAMP}.zip"

# Create a temporary deployment directory
DEPLOY_DIR=$(mktemp -d)
echo "📁 Using temporary directory: $DEPLOY_DIR"

# Copy necessary files
cp -r dist/ "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"
cp host.json "$DEPLOY_DIR/" 2>/dev/null || echo "⚠️  host.json not found, using default Azure Functions configuration"

# Create host.json if it doesn't exist
if [ ! -f "$DEPLOY_DIR/host.json" ]; then
    echo "📝 Creating host.json for Azure Functions..."
    cat > "$DEPLOY_DIR/host.json" << 'EOF'
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  },
  "functionTimeout": "00:05:00"
}
EOF
fi

# Install production dependencies in deployment directory
cd "$DEPLOY_DIR"
npm install --production --silent
if [ $? -ne 0 ]; then
    echo "❌ Failed to install production dependencies"
    exit 1
fi

echo "✅ Production dependencies installed"

# Create zip package
cd "$DEPLOY_DIR"
zip -r "$PACKAGE_NAME" . > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Failed to create deployment package"
    exit 1
fi

echo "✅ Created deployment package: $PACKAGE_NAME"

# Deploy to Azure Functions
echo "🚀 Deploying to Azure Functions..."
az functionapp deployment source config-zip \
    --resource-group $RESOURCE_GROUP \
    --name $FUNCTION_APP_NAME \
    --src "$PACKAGE_NAME" \
    --timeout 300

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🌐 Function App URL: https://${FUNCTION_APP_NAME}.azurewebsites.net"
    echo "🔍 Health check: https://${FUNCTION_APP_NAME}.azurewebsites.net/api/health"
    echo "📊 API status: https://${FUNCTION_APP_NAME}.azurewebsites.net/api/v1/status"
    echo ""
    echo "📋 Available endpoints:"
    echo "  - GET /api/health"
    echo "  - GET /api/v1/status"
    echo "  - GET /api/v1/data-quality/health"
    echo "  - GET /api/v1/data-quality/dashboard"
    echo "  - GET /api/v1/insights/health"
    echo "  - GET /api/v1/insights/dashboard"
    echo "  - GET /api/v1/auth/status"
    echo ""
    echo "🧪 Test the deployment:"
    echo "curl https://${FUNCTION_APP_NAME}.azurewebsites.net/api/health"
else
    echo "❌ Deployment failed"
    exit 1
fi

# Clean up
rm -rf "$DEPLOY_DIR"
echo "🧹 Cleaned up temporary files"

echo "🎉 Backend deployment completed successfully!"