/**
 * Mock Archer GRC API for Local Development
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3007;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data generators
const generateRisks = (count = 50) => {
  const risks = [];
  const categories = ['Operational', 'Technology', 'Financial', 'Compliance', 'Strategic'];
  
  for (let i = 1; i <= count; i++) {
    risks.push({
      id: `RSK-2024-${String(i).padStart(3, '0')}`,
      title: `Sample Risk ${i}`,
      description: `Description for risk ${i}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      score: Math.round((Math.random() * 8 + 2) * 10) / 10, // 2.0 - 10.0
      status: Math.random() > 0.8 ? 'Critical' : Math.random() > 0.6 ? 'High' : 'Medium',
      lastUpdated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  return risks;
};

const generateControls = (count = 30) => {
  const controls = [];
  const types = ['Preventive', 'Detective', 'Corrective'];
  
  for (let i = 1; i <= count; i++) {
    controls.push({
      id: `CTL-2024-${String(i).padStart(3, '0')}`,
      name: `Control ${i}`,
      description: `Description for control ${i}`,
      type: types[Math.floor(Math.random() * types.length)],
      effectiveness: Math.round(Math.random() * 100),
      status: Math.random() > 0.2 ? 'Effective' : 'Failed',
      lastTested: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  return controls;
};

// Mock endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Mock Archer API' });
});

app.get('/api/risks', (req, res) => {
  const risks = generateRisks();
  res.json({ data: risks, total: risks.length });
});

app.get('/api/controls', (req, res) => {
  const controls = generateControls();
  res.json({ data: controls, total: controls.length });
});

app.get('/api/incidents', (req, res) => {
  const incidents = [];
  for (let i = 1; i <= 25; i++) {
    incidents.push({
      id: `INC-2024-${String(i).padStart(3, '0')}`,
      title: `Incident ${i}`,
      description: `Sample incident description ${i}`,
      severity: Math.random() > 0.7 ? 'High' : Math.random() > 0.4 ? 'Medium' : 'Low',
      status: Math.random() > 0.6 ? 'Resolved' : 'Open',
      reportedDate: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  res.json({ data: incidents, total: incidents.length });
});

app.listen(PORT, () => {
  console.log(`🔧 Mock Archer API running on http://localhost:${PORT}`);
  console.log('📊 Available endpoints:');
  console.log('  GET /health');
  console.log('  GET /api/risks');
  console.log('  GET /api/controls');
  console.log('  GET /api/incidents');
});