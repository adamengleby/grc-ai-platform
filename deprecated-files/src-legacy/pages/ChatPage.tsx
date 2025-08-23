import React from 'react';
import { McpTestInterface } from '@/components/mcp/McpTestInterface';

/**
 * Chat page that renders the MCP testing interface
 * Provides natural language interaction with tenant-scoped GRC tools
 */
export const ChatPage: React.FC = () => {
  return (
    <div className="h-full">
      <McpTestInterface />
    </div>
  );
};