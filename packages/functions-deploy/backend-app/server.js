const express = require('express');
const cors = require('cors');
const app = express();

// Enable CORS for all origins
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-tenant-id', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'GRC Backend API running in Australia East!',
        timestamp: new Date().toISOString(),
        region: 'Australia East'
    });
});

// Simple LLM Configs endpoint
app.get('/api/v1/simple-llm-configs', (req, res) => {
    console.log('🇦🇺 Australia East LLM Configs API called!');

    res.json({
        success: true,
        message: '🇦🇺 Australia East backend is working!',
        data: [
            {
                config_id: '1',
                id: '1',
                name: 'Australia East LLM Config',
                provider: 'openai',
                model: 'gpt-4',
                temperature: 0.7,
                maxTokens: 2000,
                created: new Date().toISOString()
            },
            {
                config_id: '2',
                id: '2',
                name: 'Azure OpenAI Config (AU)',
                provider: 'azure',
                model: 'gpt-4',
                temperature: 0.5,
                maxTokens: 4000,
                created: new Date().toISOString()
            }
        ]
    });
});

// Simple test endpoint
app.get('/api/simple-test', (req, res) => {
    console.log('Simple test endpoint called');

    res.json({
        success: true,
        message: 'Simple test working from Australia East!',
        timestamp: new Date().toISOString(),
        region: 'Australia East'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        region: 'Australia East'
    });
});

// Start server
const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`🚀 GRC Backend running on port ${port} in Australia East!`);
});