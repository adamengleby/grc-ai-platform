const { app } = require('@azure/functions');

// Simple health check function
app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'health',
    handler: async (request, context) => {
        context.log('Health check requested');

        return {
            status: 200,
            jsonBody: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                service: 'grc-ai-platform-backend',
                environment: 'production'
            }
        };
    }
});

// Simple API endpoint to show the platform is working
app.http('api', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'api/{*restOfPath}',
    handler: async (request, context) => {
        context.log('API request:', request.method, request.url);

        const path = request.params.restOfPath || '';

        if (path === 'v1/status') {
            return {
                status: 200,
                jsonBody: {
                    message: 'GRC AI Platform Backend is running in production!',
                    timestamp: new Date().toISOString(),
                    path: path,
                    method: request.method,
                    infrastructure: 'Azure Functions',
                    region: 'Australia East'
                }
            };
        }

        if (path === 'v1/auth/status') {
            return {
                status: 200,
                jsonBody: {
                    authEnabled: true,
                    providers: ['OAuth 2.0', 'OIDC'],
                    tenants: ['acme', 'fintech'],
                    message: 'Authentication system ready for configuration'
                }
            };
        }

        return {
            status: 200,
            jsonBody: {
                message: 'GRC AI Platform API',
                availableEndpoints: [
                    '/api/v1/status',
                    '/api/v1/auth/status',
                    '/health'
                ],
                requestedPath: path,
                timestamp: new Date().toISOString()
            }
        };
    }
});