import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

// Health check endpoint
app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'health',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        context.log('Health check requested');

        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'grc-ai-platform-backend',
                environment: 'production',
                version: '1.0.0'
            }
        };
    }
});

// API status endpoint
app.http('api-status', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/status',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        context.log('API status requested');

        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                api: 'GRC AI Platform',
                status: 'operational',
                timestamp: new Date().toISOString(),
                endpoints: {
                    health: '/api/health',
                    status: '/api/v1/status',
                    'data-quality': '/api/v1/data-quality/*',
                    insights: '/api/v1/insights/*'
                },
                features: [
                    'Smart Data Quality Checker',
                    'Risk & Control Insights Generator',
                    'Multi-tenant Authentication',
                    'MCP Server Integration'
                ]
            }
        };
    }
});

// Data Quality endpoints
app.http('data-quality-health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/data-quality/health',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                service: 'Data Quality Checker',
                status: 'healthy',
                version: '1.0.0',
                capabilities: ['AI Classification', 'Confidence Scoring', 'Human Review Workflow']
            }
        };
    }
});

app.http('data-quality-dashboard', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/data-quality/dashboard',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                metrics: {
                    totalRecordsProcessed: 1247,
                    autoClassified: 1089,
                    humanReviewRequired: 158,
                    averageConfidence: 0.87,
                    processingTimeReduction: '67%'
                },
                recentActivity: [
                    { type: 'Privacy Incident', confidence: 0.94, status: 'auto-classified' },
                    { type: 'System Outage', confidence: 0.91, status: 'auto-classified' },
                    { type: 'Control Gap', confidence: 0.73, status: 'human-review' }
                ]
            }
        };
    }
});

// Insights Generator endpoints
app.http('insights-health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/insights/health',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                service: 'Risk & Control Insights Generator',
                status: 'healthy',
                version: '1.0.0',
                capabilities: ['AI Agent Orchestration', 'Strategic Analysis', 'Executive Reporting']
            }
        };
    }
});

app.http('insights-dashboard', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/insights/dashboard',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                insights: {
                    topRisks: [
                        { category: 'Cybersecurity', risk_score: 8.7, trend: 'increasing' },
                        { category: 'Data Privacy', risk_score: 7.2, trend: 'stable' },
                        { category: 'Operational', risk_score: 6.5, trend: 'decreasing' }
                    ],
                    controlEffectiveness: 0.82,
                    complianceScore: 0.89,
                    recommendedActions: 3
                },
                analytics: {
                    queriesProcessed: 342,
                    agentOrchestrations: 127,
                    executiveReports: 45
                }
            }
        };
    }
});

// Auth status endpoint
app.http('auth-status', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/auth/status',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                authentication: 'not-configured',
                message: 'OAuth 2.0 + OIDC providers need configuration for tenant login',
                supportedProviders: ['Microsoft Entra ID', 'Okta', 'Auth0', 'Google Workspace'],
                configurationRequired: [
                    'Tenant OAuth client registration',
                    'Environment variables setup',
                    'Azure Key Vault secrets'
                ]
            }
        };
    }
});

// Catch-all endpoint for unhandled routes
app.http('catch-all', {
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    authLevel: 'anonymous',
    route: '{*segments}',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        const segments = request.params.segments || '';
        context.log(`Unhandled route: ${request.method} /${segments}`);

        return {
            status: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                error: 'Endpoint not found',
                message: `Route /${segments} is not implemented`,
                availableEndpoints: [
                    '/api/health',
                    '/api/v1/status',
                    '/api/v1/data-quality/health',
                    '/api/v1/data-quality/dashboard',
                    '/api/v1/insights/health',
                    '/api/v1/insights/dashboard',
                    '/api/v1/auth/status'
                ]
            }
        };
    }
});

export default app;