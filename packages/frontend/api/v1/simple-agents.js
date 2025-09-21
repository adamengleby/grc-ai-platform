module.exports = async function (context, req) {
    context.log('Simple agents API called');

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
        // Return mock agents
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
                        name: 'Data Quality Agent',
                        type: 'data_quality',
                        status: 'active',
                        description: 'AI agent for data quality assessment',
                        created: new Date().toISOString()
                    }
                ]
            }
        };
    } else if (req.method === 'POST') {
        // Create new agent
        const { name, type, description } = req.body || {};

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
                    name: name || 'New Agent',
                    type: type || 'general',
                    status: 'active',
                    description: description || 'AI agent',
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