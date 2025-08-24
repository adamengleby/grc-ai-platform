import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EnhancedMarkdown } from '../../../components/ui/EnhancedMarkdown';
import { Send, Download, User, Bot, AlertTriangle, CheckCircle, Clock, RefreshCw, ChevronDown, Database } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Badge } from '@/app/components/ui/Badge';
import { Alert } from '@/app/components/ui/Alert';
import { AIAgent } from '@/types/agent';
import { createAgentService } from '@/lib/agentService';
import { createLLMService, LLMResponse, LLMMessage } from '@/lib/llmService';
import { useAuthStore } from '@/app/store/auth';
import { credentialsManager, type ArcherCredentials } from '@/lib/credentialsApi';
import { createTestMcpServerConfig, verifyTenantMcpConfig } from '@/lib/testMcpConfig';
import { mcpConnectionManager } from '@/lib/mcpConnectionManager';
import { runMCPIntegrationTests } from '@/lib/testMcpIntegration';
import { clsx } from 'clsx';

interface ChatMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  response?: LLMResponse;
  isLoading?: boolean;
  error?: string;
}

interface ConnectionStatus {
  isConnected: boolean;
  lastChecked: Date;
  llmConfig?: any;
  agentContext?: any;
  archerConnections?: ArcherCredentials[];
  selectedConnection?: ArcherCredentials | null;
}

export const ChatPage: React.FC = () => {
  const { tenant } = useAuthStore();
  
  // Persistent chat state with localStorage
  const getChatStorageKey = (agentId: string) => `chat_session_${tenant?.id}_${agentId}`;
  const getGlobalChatKey = () => `chat_session_${tenant?.id}_global`;

  const loadPersistedMessages = (agentId: string): ChatMessage[] => {
    try {
      const stored = localStorage.getItem(getChatStorageKey(agentId));
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load persisted messages:', error);
    }
    return [];
  };

  const saveMessagesToStorage = (agentId: string, messages: ChatMessage[]) => {
    try {
      localStorage.setItem(getChatStorageKey(agentId), JSON.stringify(messages));
    } catch (error) {
      console.warn('Failed to save messages to storage:', error);
    }
  };

  const loadPersistedAgent = (): AIAgent | null => {
    try {
      const stored = localStorage.getItem(getGlobalChatKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.selectedAgent;
      }
    } catch (error) {
      console.warn('Failed to load persisted agent:', error);
    }
    return null;
  };

  const saveGlobalChatState = (agent: AIAgent | null) => {
    try {
      localStorage.setItem(getGlobalChatKey(), JSON.stringify({
        selectedAgent: agent,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('Failed to save global chat state:', error);
    }
  };

  // State management with persistence
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<AIAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(loadPersistedAgent);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastChecked: new Date(),
    llmConfig: null,
    agentContext: null,
    archerConnections: [],
    selectedConnection: null
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Record<string, LLMMessage[]>>({});
  const [error, setError] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load available agents
  useEffect(() => {
    const loadAgents = async () => {
      if (!tenant?.id) return;
      
      try {
        const agentService = createAgentService(tenant.id);
        const agents = await agentService.getEnabledAgents();
        setAvailableAgents(agents);
        
        // Set first agent as default
        if (agents.length > 0 && !selectedAgent) {
          setSelectedAgent(agents[0]);
        }
      } catch (err) {
        console.error('Failed to load agents:', err);
        setError('Failed to load AI agents. Please check your configuration.');
      }
    };

    loadAgents();
  }, [tenant?.id]);

  // Initialize LLM connection and load agent context
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        if (!selectedAgent || !tenant?.id) return;

        // Set tenant context for credentials manager
        credentialsManager.setTenantContext(tenant.id);
        await credentialsManager.initialize();

        // Get agent with full context (LLM config, MCP servers)
        const agentService = createAgentService(tenant.id);
        const agentContext = await agentService.getAgentWithContext(selectedAgent.id);
        
        if (!agentContext) {
          throw new Error('Failed to load agent configuration');
        }

        if (!agentContext.llmConfig) {
          throw new Error('No LLM configuration found for this agent. Please configure an LLM in Settings.');
        }

        if (!agentContext.llmConfig.isEnabled) {
          throw new Error('LLM configuration is disabled. Please enable it in Settings.');
        }
        
        // Load Archer connections
        let archerConnections: ArcherCredentials[] = [];
        let selectedConnection: ArcherCredentials | null = null;
        
        try {
          archerConnections = await credentialsManager.loadCredentials();
          // Select the default connection or first available
          selectedConnection = archerConnections.find(conn => conn.isDefault) || archerConnections[0] || null;
        } catch (err) {
          console.error('Failed to load Archer credentials:', err);
        }

        // Test: Run comprehensive MCP integration tests
        if (tenant?.id) {
          console.log('[Chat Test] Running comprehensive MCP integration tests...');
          try {
            const testsPassed = await runMCPIntegrationTests(tenant.id);
            if (testsPassed) {
              console.log('[Chat Test] ✅ All MCP integration tests passed!');
            } else {
              console.error('[Chat Test] ❌ Some MCP integration tests failed');
            }
          } catch (error) {
            console.error('[Chat Test] Test execution failed:', error);
          }
        }
        
        setConnectionStatus({
          isConnected: true,
          lastChecked: new Date(),
          llmConfig: agentContext.llmConfig,
          agentContext: agentContext,
          archerConnections,
          selectedConnection
        });
        
        // Load existing messages or add welcome message if first time
        const existingMessages = loadPersistedMessages(selectedAgent.id);
        
        if (existingMessages.length === 0) {
          // Only add welcome message if no existing conversation
          const welcomeMessage: ChatMessage = {
            id: 'welcome-' + Date.now(),
            type: 'agent',
            content: `Hello! I'm ${selectedAgent.name}. ${selectedAgent.description} What would you like to analyze today?`,
            timestamp: new Date()
          };
          setMessages([welcomeMessage]);
          saveMessagesToStorage(selectedAgent.id, [welcomeMessage]);
          // CRITICAL FIX: Initialize with ONLY this agent's empty history
          console.log(`[ChatPage] Initializing new agent ${selectedAgent.id} with empty conversation history`);
          setConversationHistory({ [selectedAgent.id]: [] }); // Only set this agent's history
        } else {
          // Load existing conversation
          setMessages(existingMessages);
          // Rebuild conversation history from messages ONLY for this specific agent
          const history: LLMMessage[] = [];
          existingMessages.forEach(msg => {
            if (msg.type === 'user') {
              history.push({ role: 'user', content: msg.content });
            } else if (msg.type === 'agent' && !msg.content.includes('analyzing your request') && !msg.content.includes('Hello!')) {
              history.push({ role: 'assistant', content: msg.content });
            }
          });
          
          // CRITICAL FIX: Set ONLY this agent's history, clear any other agent data
          console.log(`[ChatPage] Loading agent ${selectedAgent.id} with ${history.length} conversation messages`);
          console.log(`[ChatPage] Ensuring complete isolation from other agents`);
          setConversationHistory({ [selectedAgent.id]: history }); // Only set this agent's history
        }
        
      } catch (err) {
        console.error('Failed to initialize agent connection:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(`Failed to initialize agent: ${errorMessage}`);
        setConnectionStatus({
          isConnected: false,
          lastChecked: new Date(),
          llmConfig: null,
          agentContext: null,
          archerConnections: [],
          selectedConnection: null
        });
      }
    };

    if (selectedAgent && tenant?.id && !isInitialized) {
      initializeConnection();
      setIsInitialized(true);
    }
  }, [selectedAgent, tenant?.id, isInitialized]);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (selectedAgent && messages.length > 0) {
      saveMessagesToStorage(selectedAgent.id, messages);
    }
  }, [messages, selectedAgent]);

  // Save selected agent whenever it changes
  useEffect(() => {
    saveGlobalChatState(selectedAgent);
  }, [selectedAgent]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending messages
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || !selectedAgent || !connectionStatus.isConnected) return;

    const userMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    const loadingMessage: ChatMessage = {
      id: 'agent-' + Date.now(),
      type: 'agent',
      content: `${selectedAgent.name} is analyzing your request...`,
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    const currentMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      if (!connectionStatus.llmConfig) {
        throw new Error('No LLM configuration available for this agent');
      }

      if (!tenant?.id) {
        throw new Error('Tenant context not available');
      }

      // Create LLM service with integrated MCP support
      const llmService = createLLMService(tenant.id);

      // Add user message to agent-specific conversation history
      const currentHistory = conversationHistory[selectedAgent.id] || [];
      const newHistory = [...currentHistory, {
        role: 'user' as const,
        content: currentMessage
      }];

      // Call LLM service with integrated MCP support
      const response = await llmService.processMessage(
        selectedAgent,
        connectionStatus.llmConfig,
        currentMessage,
        newHistory.slice(-10), // Keep last 10 messages for context
        connectionStatus.selectedConnection
      );

      // Update conversation history
      const updatedHistory = [
        ...newHistory,
        {
          role: 'assistant' as const,
          content: response.content
        }
      ];
      setConversationHistory(prev => ({ ...prev, [selectedAgent.id]: updatedHistory }));

      // Update the loading message with actual response
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id
          ? {
              ...msg,
              content: response.content,
              isLoading: false,
              response
            }
          : msg
      ));

      // Record agent usage
      const agentService = createAgentService(tenant.id);
      await agentService.recordUsage(selectedAgent.id);

    } catch (err) {
      console.error('Failed to send message:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      
      // Update loading message with error
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id
          ? {
              ...msg,
              content: 'I apologize, but I encountered an error while processing your request. Please try again.',
              isLoading: false,
              error: errorMessage
            }
          : msg
      ));
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputMessage, isLoading, selectedAgent, connectionStatus, conversationHistory, tenant?.id]);

  // Handle clearing chat for current agent
  const handleClearChat = useCallback(() => {
    if (!selectedAgent) return;
    
    // Clear from localStorage
    try {
      localStorage.removeItem(getChatStorageKey(selectedAgent.id));
    } catch (error) {
      console.warn('Failed to clear chat from storage:', error);
    }
    
    // Reset state
    const welcomeMessage: ChatMessage = {
      id: 'welcome-' + Date.now(),
      type: 'agent',
      content: `Hello! I'm ${selectedAgent.name}. ${selectedAgent.description} What would you like to analyze today?`,
      timestamp: new Date()
    };
    
    setMessages([welcomeMessage]);
    // CRITICAL FIX: Clear conversation history with complete isolation
    console.log(`[ChatPage] Clearing chat for agent ${selectedAgent.id}`);
    setConversationHistory({ [selectedAgent.id]: [] }); // Only set this agent's empty history
    setError(null);
  }, [selectedAgent]);

  // Handle agent selection with persistence
  const handleAgentSelect = useCallback((agent: AIAgent) => {
    // Save current messages before switching
    if (selectedAgent && messages.length > 0) {
      saveMessagesToStorage(selectedAgent.id, messages);
    }
    
    // Switch to new agent
    setSelectedAgent(agent);
    setIsInitialized(false);
    setError(null);
    
    // CRITICAL FIX: Clear conversation context when switching agents
    // This ensures complete isolation between agent conversations
    console.log(`[ChatPage] Switching from agent ${selectedAgent?.id} to ${agent.id}`);
    console.log(`[ChatPage] Clearing conversation history for isolation`);
    setConversationHistory({}); // Clear all conversation history to prevent cross-contamination
  }, [selectedAgent, messages]);

  // Clear all chat sessions (for logout)
  const clearAllChatSessions = useCallback(() => {
    if (!tenant?.id) return;
    
    try {
      // Get all keys that match our chat pattern
      const chatKeys = Object.keys(localStorage).filter(key => 
        key.startsWith(`chat_session_${tenant.id}_`)
      );
      
      // Remove all chat sessions
      chatKeys.forEach(key => localStorage.removeItem(key));
      
      console.log(`Cleared ${chatKeys.length} chat sessions for tenant ${tenant.id}`);
    } catch (error) {
      console.warn('Failed to clear all chat sessions:', error);
    }
  }, [tenant?.id]);

  // Export clearAllChatSessions for use by logout functionality
  React.useEffect(() => {
    if (tenant?.id) {
      // Store the clear function globally so it can be called on logout
      (window as any).clearAllChatSessions = clearAllChatSessions;
    }
    
    // Cleanup on unmount
    return () => {
      delete (window as any).clearAllChatSessions;
    };
  }, [clearAllChatSessions, tenant?.id]);

  // Handle export conversation
  const handleExportConversation = useCallback(() => {
    const conversationData = {
      agent: selectedAgent,
      messages: messages.filter(msg => !msg.isLoading),
      exportedAt: new Date().toISOString(),
      connectionStatus
    };

    const blob = new Blob([JSON.stringify(conversationData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grc-chat-${selectedAgent.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [messages, selectedAgent, connectionStatus]);

  // Handle refresh connection
  const handleRefreshConnection = useCallback(async () => {
    if (!selectedAgent || !tenant?.id) return;

    try {
      // Reinitialize the agent connection
      const agentService = createAgentService(tenant.id);
      const agentContext = await agentService.getAgentWithContext(selectedAgent.id);
      
      if (!agentContext || !agentContext.llmConfig) {
        throw new Error('Agent configuration not found');
      }

      setConnectionStatus(prev => ({
        ...prev,
        isConnected: agentContext.llmConfig.isEnabled,
        lastChecked: new Date(),
        llmConfig: agentContext.llmConfig,
        agentContext: agentContext
      }));
      
      setError(null);
    } catch (err) {
      console.error('Failed to refresh connection:', err);
      setError('Failed to refresh connection to AI agent services.');
    }
  }, [selectedAgent, tenant?.id]);

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!selectedAgent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] space-y-6">
      {/* Header with Agent Dropdown */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">GRC AI Chat</h1>
            <p className="text-muted-foreground mt-2">
              Interactive AI analysis for governance, risk, and compliance
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Connection Status */}
            <div className={clsx(
              'flex items-center space-x-1 px-2 py-1 rounded-full text-xs',
              connectionStatus.isConnected 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            )}>
              {connectionStatus.isConnected ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              <span>{connectionStatus.isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshConnection}
              disabled={isLoading}
            >
              <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              disabled={isLoading}
              className="text-red-600 hover:text-red-700"
            >
              Clear Chat
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportConversation}
              disabled={messages.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Agent Selector */}
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium">AI Agent:</label>
          <div className="relative">
            <select
              value={selectedAgent.id}
              onChange={(e) => {
                const agent = availableAgents.find(a => a.id === e.target.value);
                if (agent) handleAgentSelect(agent);
              }}
              className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {availableAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} - {agent.description}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="flex-shrink-0">
          <AlertTriangle className="h-4 w-4" />
          <div>
            <strong>Connection Error:</strong> {error}
          </div>
        </Alert>
      )}

      {/* Full Width Chat Interface */}
      <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-lg min-h-0">
        {/* Messages Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={clsx(
                'flex items-start space-x-3',
                message.type === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.type === 'agent' && (
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              
              <div className={clsx(
                'max-w-[70%] rounded-lg px-4 py-3',
                message.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : message.error
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-gray-50'
              )}>
                <div className="space-y-2">
                  <div className="text-sm markdown-content">
                    <EnhancedMarkdown>
                      {message.content}
                    </EnhancedMarkdown>
                  </div>
                  
                  {message.isLoading && (
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  )}
                  
                  {message.response && !message.isLoading && (
                    <div className="space-y-2 text-xs">
                      {/* MCP Tools Used */}
                      {message.response.usedMCP && message.response.mcpToolsUsed && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-muted-foreground mr-2">Archer tools used:</span>
                          {message.response.mcpToolsUsed.map(tool => (
                            <Badge key={tool} variant="outline" className="text-xs bg-blue-50 text-blue-700">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        {message.response.usage && (
                          <span className="text-muted-foreground">
                            Tokens: {message.response.usage.totalTokens || 'N/A'}
                          </span>
                        )}
                        <div className="flex items-center space-x-2">
                          {message.response.usedMCP && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                              Live Data
                            </Badge>
                          )}
                          <span className="text-muted-foreground">
                            {message.response.processingTime}ms
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatTimestamp(message.timestamp)}</span>
                  </div>
                </div>
              </div>
              
              {message.type === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex space-x-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Ask ${selectedAgent.name} about GRC analysis...`}
              disabled={isLoading || !connectionStatus.isConnected}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim() || !connectionStatus.isConnected}
              size="default"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              {selectedAgent.name} • {selectedAgent.useCase}
              {connectionStatus.llmConfig && (
                <span className="ml-2">
                  • {connectionStatus.llmConfig.provider} ({connectionStatus.llmConfig.model})
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
