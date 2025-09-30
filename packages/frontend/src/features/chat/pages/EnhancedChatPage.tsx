import React from 'react';
import EnhancedChatInterface from '../components/EnhancedChatInterface';

/**
 * Enhanced Chat Page with AI-powered GRC capabilities
 * Features:
 * - Multi-LLM orchestration
 * - File upload and processing
 * - Real-time tool execution
 * - Conversation memory and search
 * - GRC-specific analysis
 */
export const EnhancedChatPage: React.FC = () => {
  return (
    <div className="h-full">
      <EnhancedChatInterface />
    </div>
  );
};