module.exports = async function (context, req) {
    context.log('Basic test function triggered');

    context.res = {
        status: 200,
        body: "Hello from Australia East!"
    };
};