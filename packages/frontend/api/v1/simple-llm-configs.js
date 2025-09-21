module.exports = async function (context, req) {
    context.log('LLM configs API called');

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
        // Return mock LLM configurations
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
                        name: 'Production LLM Config',
                        provider: 'openai',
                        model: 'gpt-4',
                        temperature: 0.7,
                        maxTokens: 2000,
                        created: new Date().toISOString()
                    }
                ]
            }
        };
    } else if (req.method === 'POST') {
        // Create new LLM configuration
        const { name, provider, model, temperature, maxTokens } = req.body || {};

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
                    name: name || 'New LLM Config',
                    provider: provider || 'openai',
                    model: model || 'gpt-4',
                    temperature: temperature || 0.7,
                    maxTokens: maxTokens || 2000,
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