module.exports = async function (context, req) {
    context.log('🇦🇺 Australia East Function called!');

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

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        },
        body: {
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
                }
            ]
        }
    };
};