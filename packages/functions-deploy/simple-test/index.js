module.exports = async function (context, req) {
    context.log('Simple test function called');

    // Simple JSON response
    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id'
        },
        body: JSON.stringify({
            success: true,
            message: 'Simple test working!',
            timestamp: new Date().toISOString(),
            region: 'Australia East'
        })
    };
};