module.exports = async function (context, req) {
    context.log('Basic test function called');

    // Simple response to test if Function App is working
    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: {
            success: true,
            message: 'Basic test function is working!',
            timestamp: new Date().toISOString(),
            region: 'Australia East'
        }
    };
};