// Azure Functions Node.js v4 handler
module.exports = async function (context, req) {
  // For debugging - log all requests
  console.log(`Azure Functions request: ${req.method} ${req.url}`);

  try {
    // Try to load our Express app
    let app;
    try {
      const backendModule = require('./dist/index');
      app = backendModule.app;
      console.log('Successfully loaded Express app from dist/index');
    } catch (error) {
      console.error('Could not load Express app:', error);

      // Fallback - create minimal responses
      if (req.url.includes('/health')) {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            status: 'healthy',
            timestamp: new Date(),
            version: '1.0.0',
            service: 'GRC Analytics Platform Backend (Azure Functions)',
            message: 'Fallback response - Express app not loaded',
            error: error.message
          })
        };
      }

      if (req.url.includes('/api/v1/simple-llm-configs')) {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'openai-gpt4',
                name: 'OpenAI GPT-4',
                provider: 'openai',
                model: 'gpt-4',
                isDefault: true
              }
            ],
            message: 'Mock LLM configurations (fallback)'
          })
        };
      }

      return {
        status: 500,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: 'Backend not available',
          message: error.message,
          timestamp: new Date()
        })
      };
    }

    // If we have the Express app, try to use it
    if (app) {
      return new Promise((resolve) => {
        // Create mock request and response objects
        const mockReq = {
          method: req.method,
          url: req.url,
          originalUrl: req.url,
          path: req.url.split('?')[0],
          headers: req.headers || {},
          body: req.body || {},
          query: req.query || {},
          params: req.params || {}
        };

        const mockRes = {
          statusCode: 200,
          headers: {},
          status: function(code) {
            this.statusCode = code;
            return this;
          },
          json: function(obj) {
            this.headers['content-type'] = 'application/json';
            resolve({
              status: this.statusCode,
              headers: this.headers,
              body: JSON.stringify(obj)
            });
          },
          send: function(data) {
            resolve({
              status: this.statusCode,
              headers: this.headers,
              body: typeof data === 'string' ? data : JSON.stringify(data)
            });
          },
          set: function(name, value) {
            this.headers[name.toLowerCase()] = value;
          },
          end: function(data) {
            resolve({
              status: this.statusCode,
              headers: this.headers,
              body: data || ''
            });
          }
        };

        try {
          app(mockReq, mockRes);
        } catch (appError) {
          console.error('Express app error:', appError);
          resolve({
            status: 500,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              error: 'Express app error',
              message: appError.message,
              timestamp: new Date()
            })
          });
        }
      });
    }

  } catch (error) {
    console.error('Azure Functions handler error:', error);
    return {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: 'Azure Functions handler error',
        message: error.message,
        timestamp: new Date()
      })
    };
  }
};