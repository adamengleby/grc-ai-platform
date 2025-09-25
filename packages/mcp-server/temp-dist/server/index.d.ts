#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
/**
 * Production MCP Server for Archer GRC Platform
 */
declare class GRCMCPServer {
    private server;
    constructor();
    private setupHandlers;
    /**
     * Get list of available Archer applications
     */
    private getArcherApplications;
    /**
     * Search records in Archer application
     */
    private searchArcherRecords;
    /**
     * Get application statistics
     */
    private getArcherStats;
    /**
     * Analyze GRC data with AI
     */
    private analyzeGrcData;
    /**
     * Generate executive insights
     */
    private generateInsights;
    /**
     * Test Archer connection
     */
    private testArcherConnection;
    /**
     * Debug Archer API
     */
    private debugArcherApi;
    /**
     * Get application fields
     */
    private getApplicationFields;
    /**
     * Get top records
     */
    private getTopRecords;
    /**
     * Find record by ID
     */
    private findRecordById;
    /**
     * Get datafeeds
     */
    private getDatafeeds;
    /**
     * Get datafeed history
     */
    private getDatafeedHistory;
    /**
     * Get datafeed history messages
     */
    private getDatafeedHistoryMessages;
    /**
     * Check datafeed health
     */
    private checkDatafeedHealth;
    /**
     * Get security events
     */
    private getSecurityEvents;
    get serverInstance(): Server;
}
export { GRCMCPServer };
//# sourceMappingURL=index.d.ts.map