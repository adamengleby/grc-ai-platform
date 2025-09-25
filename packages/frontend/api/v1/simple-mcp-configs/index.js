module.exports = async function (context, req) {
    context.log('MCP configs API called');

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id'
    };

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: corsHeaders
        };
        return;
    }

    if (req.method === 'GET') {
        // Return mock MCP configurations
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            },
            body: {
                success: true,
                data: [
                    {
                        id: '1',
                        name: 'Production MCP Server',
                        url: 'https://func-grc-backend-prod.azurewebsites.net',
                        status: 'connected',
                        tools: ['risk_analysis', 'compliance_check'],
                        created: new Date().toISOString()
                    }
                ]
            }
        };
    } else if (req.method === 'POST') {
        // Create new MCP configuration
        const { name, url, tools } = req.body || {};

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            },
            body: {
                success: true,
                data: {
                    id: Date.now().toString(),
                    name: name || 'New MCP Config',
                    url: url || 'http://localhost:3006',
                    status: 'connected',
                    tools: tools || [],
                    created: new Date().toISOString()
                }
            }
        };
    } else {
        context.res = {
            status: 405,
            headers: corsHeaders,
            body: { error: 'Method not allowed' }
        };
    }
};