console.log('Starting Archer MCP Server test...');
const { spawn } = require('child_process');

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

server.on('error', (error) => {
  console.error('ERROR:', error);
});

// Send a test message
setTimeout(() => {
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {}
  }) + '\n');
}, 1000);