const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'grc-frontend',
    version: '1.3.0',
    timestamp: new Date().toISOString()
  });
});

// SPA routing - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

console.log('🎉 GRC Frontend v1.3.0 starting on port', PORT);
app.listen(PORT, () => {
  console.log('✅ Frontend server running on port', PORT);
  console.log('🌐 Serving React app with clean URLs');
  console.log('📁 Static files from:', path.join(__dirname, 'dist'));
});
