module.exports = async function (context, req) {
    context.log('Tenant secrets API called');

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
        // Return mock tenant secrets
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
                        name: 'OPENAI_API_KEY',
                        description: 'OpenAI API Key for LLM services',
                        type: 'api_key',
                        isSet: true,
                        lastUpdated: new Date().toISOString()
                    },
                    {
                        name: 'ARCHER_AUTH_TOKEN',
                        description: 'Archer GRC Platform Authentication Token',
                        type: 'bearer_token',
                        isSet: false,
                        lastUpdated: null
                    }
                ]
            }
        };
    } else if (req.method === 'POST') {
        // Create/update tenant secret
        const { name, value, description, type } = req.body || {};

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            },
            body: {
                success: true,
                message: 'Secret saved successfully',
                data: {
                    name: name || 'NEW_SECRET',
                    description: description || 'New secret',
                    type: type || 'api_key',
                    isSet: true,
                    lastUpdated: new Date().toISOString()
                }
            }
        };
    } else if (req.method === 'PUT') {
        // Update existing secret
        const { name, value, description } = req.body || {};

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            },
            body: {
                success: true,
                message: 'Secret updated successfully',
                data: {
                    name: name || 'UPDATED_SECRET',
                    description: description || 'Updated secret',
                    isSet: true,
                    lastUpdated: new Date().toISOString()
                }
            }
        };
    } else if (req.method === 'DELETE') {
        // Delete secret
        const secretName = req.params?.secretName || 'unknown';

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            },
            body: {
                success: true,
                message: `Secret '${secretName}' deleted successfully`
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