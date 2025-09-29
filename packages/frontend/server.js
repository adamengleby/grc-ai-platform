const express = require('express');
const path = require('path');
const app = express();

// Serve static files from dist directory with proper headers
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filepath) => {
    // Set proper MIME types for assets
    if (filepath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    if (filepath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    // Enable caching for assets
    if (filepath.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'React Frontend',
    timestamp: new Date().toISOString(),
    environment: 'Azure Container Apps'
  });
});

// Handle React Router - send all non-asset routes to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 GRC AI Platform Frontend running on port ${port}`);
  console.log(`📍 Serving React app from: ${path.join(__dirname, 'dist')}`);
  console.log(`🔗 Backend API: https://grc-backend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io/api/v1`);
});