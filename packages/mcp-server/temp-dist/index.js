#!/usr/bin/env node
/**
 * MCP Server Entry Point
 * Starts the MCP server for RSA Archer GRC Integration
 * Supports both stdio and HTTP modes
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import cors from 'cors';
// Import our GRC MCP Server
import { GRCMCPServer } from './server/index.js';
const args = process.argv.slice(2);
const portFlag = args.find(arg => arg.startsWith('--port='));
const port = portFlag ? parseInt(portFlag.split('=')[1]) : process.env.PORT ? parseInt(process.env.PORT) : null;
if (port) {
    // HTTP Server mode for platform integration
    console.error(`Starting GRC MCP Server in HTTP mode on port ${port}`);
    const app = express();
    app.use(cors());
    app.use(express.json());
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    // Create GRC MCP Server instance and connect it
    const grcServer = new GRCMCPServer();
    const server = grcServer.serverInstance;
    // Connect server with a mock transport for HTTP mode
    // In HTTP mode, we handle requests directly without needing stdio transport
    await new Promise((resolve) => {
        // Simulate connection for HTTP mode
        setTimeout(() => {
            console.error('GRC MCP Server connected for HTTP mode');
            resolve();
        }, 100);
    });
    // MCP tools endpoint (what the platform is trying to reach)
    app.get('/tools', async (req, res) => {
        try {
            console.error('Received GET /tools request');
            const response = await server.request({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/list'
            }, ListToolsRequestSchema);
            res.json(response);
        }
        catch (error) {
            console.error('Error handling /tools request:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    // MCP call endpoint
    app.post('/call', async (req, res) => {
        try {
            console.error('Received POST /call request:', req.body);
            const response = await server.request({
                jsonrpc: '2.0',
                id: req.body.id || 1,
                method: 'tools/call',
                params: req.body
            }, CallToolRequestSchema);
            res.json(response);
        }
        catch (error) {
            console.error('Error handling /call request:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    // Generic MCP JSON-RPC endpoint
    app.post('/', async (req, res) => {
        try {
            console.error('Received generic MCP request:', req.body);
            const response = await server.request(req.body, CallToolRequestSchema);
            res.json(response);
        }
        catch (error) {
            console.error('Error handling generic MCP request:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    app.listen(port, () => {
        console.error(`GRC MCP Server running on http://localhost:${port}`);
    });
}
else {
    // Stdio mode (default)
    console.error('GRC Production MCP Server running on stdio');
    const grcServer = new GRCMCPServer();
    const server = grcServer.serverInstance;
    const transport = new StdioServerTransport();
    server.connect(transport);
}
//# sourceMappingURL=index.js.map