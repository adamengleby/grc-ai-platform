module.exports = function (context, req) {
    context.res = {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Hello Australia East!'
    };
    context.done();
};