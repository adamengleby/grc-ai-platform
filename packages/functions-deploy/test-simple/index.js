module.exports = async function (context, req) {
    context.log('Test function called');

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
        },
        body: 'Hello from Australia East!'
    };
};