import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
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
  
  // State management
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<AIAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastChecked: new Date(),
    llmConfig: null,
    agentContext: null,
    archerConnections: [],
    selectedConnection: null
  });
  const [conversationHistory, setConversationHistory] = useState<LLMMessage[]>([]);
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
        
        setConnectionStatus({
          isConnected: true,
          lastChecked: new Date(),
          llmConfig: agentContext.llmConfig,
          agentContext: agentContext,
          archerConnections,
          selectedConnection
        });
        
        // Add welcome message
        const welcomeMessage: ChatMessage = {
          id: 'welcome-' + Date.now(),
          type: 'agent',
          content: `Hello! I'm ${selectedAgent.name}. ${selectedAgent.description} What would you like to analyze today?`,
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
        
        // Clear conversation history when switching agents
        setConversationHistory([]);
        
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

    if (selectedAgent && tenant?.id) {
      initializeConnection();
    }
  }, [selectedAgent, tenant?.id]);

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

      // Add user message to conversation history
      const newHistory = [...conversationHistory, {
        role: 'user' as const,
        content: currentMessage
      }];

      // Call LLM service with integrated MCP support
      const response = await llmService.processMessage(
        selectedAgent,
        connectionStatus.llmConfig,
        currentMessage,
        conversationHistory.slice(-10), // Keep last 10 messages for context
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
      setConversationHistory(updatedHistory);

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
                if (agent) setSelectedAgent(agent);
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
                    <ReactMarkdown
                      components={{
                        h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                        h2: ({children}) => <h2 className="text-base font-semibold mb-2 mt-4">{children}</h2>,
                        h3: ({children}) => <h3 className="text-sm font-medium mb-1 mt-3">{children}</h3>,
                        p: ({children}) => <p className="mb-2 leading-relaxed">{children}</p>,
                        ul: ({children}) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                        li: ({children}) => <li className="text-sm">{children}</li>,
                        strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                        em: ({children}) => <em className="italic">{children}</em>,
                        code: ({children}) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-2">{children}</blockquote>
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
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
