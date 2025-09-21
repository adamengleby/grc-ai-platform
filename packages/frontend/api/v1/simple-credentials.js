module.exports = async function (context, req) {
    context.log('Simple credentials API called');

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
        // Return mock credentials
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
                        name: 'Production API Key',
                        type: 'api_key',
                        status: 'active',
                        created: new Date().toISOString(),
                        lastUsed: new Date().toISOString()
                    }
                ]
            }
        };
    } else if (req.method === 'POST') {
        // Create new credential
        const { name, type, credentials } = req.body || {};

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
                    name: name || 'New Credential',
                    type: type || 'api_key',
                    status: 'active',
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