import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog } from '@/app/components/ui/Dialog';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Badge } from '@/app/components/ui/Badge';
import { Alert } from '@/app/components/ui/Alert';
import { EnhancedMarkdown } from '@/components/ui/EnhancedMarkdown';
import {
  Send,
  X,
  Download,
  User,
  Bot,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Minimize2,
  Maximize2,
  Settings,
  MessageSquare
} from 'lucide-react';
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

interface AgentChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AIAgent;
}

export const AgentChatModal: React.FC<AgentChatModalProps> = ({
  isOpen,
  onClose,
  agent
}) => {
  const { tenant } = useAuthStore();
  
  // Chat state management
  const getChatStorageKey = () => `agent_chat_${tenant?.id}_${agent.id}`;
  
  const loadPersistedMessages = (): ChatMessage[] => {
    try {
      const stored = localStorage.getItem(getChatStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load persisted chat messages:', error);
    }
    return [];
  };

  const saveMessagesToStorage = (messages: ChatMessage[]) => {
    try {
      localStorage.setItem(getChatStorageKey(), JSON.stringify(messages));
    } catch (error) {
      console.warn('Failed to save chat messages to storage:', error);
    }
  };

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize agent connection when modal opens
  useEffect(() => {
    const initializeAgentConnection = async () => {
      if (!isOpen || !agent || !tenant?.id || isInitialized) return;

      try {
        console.log(`[AgentChatModal] Initializing chat for agent: ${agent.name} (${agent.id})`);
        
        // Set tenant context for credentials manager
        credentialsManager.setTenantContext(tenant.id);
        await credentialsManager.initialize();

        // Get agent with full context (LLM config, MCP servers)
        const agentService = createAgentService(tenant.id);
        const agentContext = await agentService.getAgentWithContext(agent.id);
        
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
          selectedConnection = archerConnections.find(conn => conn.isDefault) || archerConnections[0] || null;
        } catch (err) {
          console.error('Failed to load Archer credentials:', err);
        }

        // Log agent's MCP server configuration
        console.log(`[AgentChatModal] Agent ${agent.id} MCP servers:`, agentContext.mcpServers?.length || 0);
        if (agentContext.mcpServers && agentContext.mcpServers.length > 0) {
          console.log('[AgentChatModal] Configured MCP servers:', 
            agentContext.mcpServers.map(s => ({ id: s.id, name: s.name })));
        } else {
          console.warn(`[AgentChatModal] No MCP servers configured for agent ${agent.id}`);
        }
        
        setConnectionStatus({
          isConnected: true,
          lastChecked: new Date(),
          llmConfig: agentContext.llmConfig,
          agentContext: agentContext,
          archerConnections,
          selectedConnection
        });
        
        // Load existing messages or create welcome message
        const existingMessages = loadPersistedMessages();
        
        if (existingMessages.length === 0) {
          const welcomeMessage: ChatMessage = {
            id: 'welcome-' + Date.now(),
            type: 'agent',
            content: `Hello! I'm ${agent.name}. ${agent.description}\n\nI have access to the following tools:\n${agentContext.mcpServers?.map(s => `• ${s.name}`).join('\n') || '• No MCP servers configured'}\n\nWhat would you like to analyze today?`,
            timestamp: new Date()
          };
          setMessages([welcomeMessage]);
          saveMessagesToStorage([welcomeMessage]);
          setConversationHistory([]);
        } else {
          setMessages(existingMessages);
          // Rebuild conversation history from messages
          const history: LLMMessage[] = [];
          existingMessages.forEach(msg => {
            if (msg.type === 'user') {
              history.push({ role: 'user', content: msg.content });
            } else if (msg.type === 'agent' && !msg.content.includes('analyzing your request') && !msg.content.includes('Hello!')) {
              history.push({ role: 'assistant', content: msg.content });
            }
          });
          setConversationHistory(history);
        }
        
        setIsInitialized(true);
        setError(null);
        
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

    if (isOpen && agent && tenant?.id) {
      initializeAgentConnection();
    }
  }, [isOpen, agent, tenant?.id]);

  // Save messages to storage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessagesToStorage(messages);
    }
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  // Focus input when modal opens and is not minimized
  useEffect(() => {
    if (isOpen && !isMinimized && connectionStatus.isConnected) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMinimized, connectionStatus.isConnected]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Handle sending messages
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || !connectionStatus.isConnected) return;

    const userMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    const loadingMessage: ChatMessage = {
      id: 'agent-' + Date.now(),
      type: 'agent',
      content: `${agent.name} is analyzing your request...`,
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    const currentMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      if (!connectionStatus.llmConfig || !tenant?.id) {
        throw new Error('No LLM configuration available for this agent');
      }

      // Create LLM service with integrated MCP support
      const llmService = createLLMService(tenant.id);

      // Add user message to conversation history
      const newHistory = [...conversationHistory, {
        role: 'user' as const,
        content: currentMessage
      }];

      console.log(`[AgentChatModal] Sending message to agent ${agent.id} with ${newHistory.length} history messages`);

      // Call LLM service with integrated MCP support - agent context ensures proper MCP server usage
      const response = await llmService.processMessage(
        agent,
        connectionStatus.llmConfig,
        currentMessage,
        newHistory.slice(-10), // Keep last 10 messages for context
        connectionStatus.selectedConnection
      );

      console.log(`[AgentChatModal] Received response with ${response.toolsUsed?.length || 0} tools used`);

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
      await agentService.recordUsage(agent.id);

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
  }, [inputMessage, isLoading, agent, connectionStatus, conversationHistory, tenant?.id]);

  // Handle clearing chat
  const handleClearChat = useCallback(() => {
    try {
      localStorage.removeItem(getChatStorageKey());
    } catch (error) {
      console.warn('Failed to clear chat from storage:', error);
    }
    
    const welcomeMessage: ChatMessage = {
      id: 'welcome-' + Date.now(),
      type: 'agent',
      content: `Hello! I'm ${agent.name}. ${agent.description}\n\nI have access to the following tools:\n${connectionStatus.agentContext?.mcpServers?.map(s => `• ${s.name}`).join('\n') || '• No MCP servers configured'}\n\nWhat would you like to analyze today?`,
      timestamp: new Date()
    };
    
    setMessages([welcomeMessage]);
    setConversationHistory([]);
    setError(null);
  }, [agent, connectionStatus.agentContext]);

  // Handle export conversation
  const handleExportConversation = useCallback(() => {
    const conversationData = {
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        enabledMcpServers: agent.enabledMcpServers
      },
      messages: messages.filter(msg => !msg.isLoading),
      exportedAt: new Date().toISOString(),
      connectionStatus: {
        llmConfig: connectionStatus.llmConfig,
        mcpServers: connectionStatus.agentContext?.mcpServers
      }
    };

    const blob = new Blob([JSON.stringify(conversationData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agent-chat-${agent.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [messages, agent, connectionStatus]);

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={onClose}
      modal={true}
    >
      <div className={clsx(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        isMinimized ? 'items-end justify-end p-6' : ''
      )}>
        {/* Background overlay */}
        {!isMinimized && (
          <div 
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={onClose}
          />
        )}
        
        {/* Modal content */}
        <div className={clsx(
          'relative bg-white rounded-lg shadow-xl flex flex-col',
          'transition-all duration-300 ease-in-out',
          isMinimized 
            ? 'w-80 h-16' 
            : 'w-[90vw] h-[85vh] max-w-4xl max-h-[800px]'
        )}>
          {/* Header */}
          <div className={clsx(
            'flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg',
            isMinimized ? 'p-3' : ''
          )}>
            <div className="flex items-center space-x-3">
              <div className={clsx(
                'rounded-full bg-primary/10 flex items-center justify-center',
                isMinimized ? 'w-8 h-8' : 'w-10 h-10'
              )}>
                <Bot className={clsx(
                  'text-primary',
                  isMinimized ? 'h-4 w-4' : 'h-5 w-5'
                )} />
              </div>
              <div>
                <h2 className={clsx(
                  'font-semibold text-gray-900',
                  isMinimized ? 'text-sm' : 'text-lg'
                )}>
                  Chat with {agent.name}
                </h2>
                {!isMinimized && (
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>{agent.useCase}</span>
                    <div className={clsx(
                      'flex items-center space-x-1 px-2 py-0.5 rounded-full',
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
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {!isMinimized && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearChat}
                    disabled={isLoading}
                    title="Clear Chat"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExportConversation}
                    disabled={messages.length === 0}
                    title="Export Conversation"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Agent Context Info */}
              {connectionStatus.agentContext?.mcpServers && (
                <div className="px-4 py-2 bg-blue-50 border-b text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">
                      <Settings className="h-3 w-3 inline mr-1" />
                      MCP Servers: {connectionStatus.agentContext.mcpServers.length} configured
                    </span>
                    <div className="flex space-x-1">
                      {connectionStatus.agentContext.mcpServers.slice(0, 3).map((server: any) => (
                        <Badge key={server.id} variant="outline" className="text-xs bg-blue-100 text-blue-700">
                          {server.name}
                        </Badge>
                      ))}
                      {connectionStatus.agentContext.mcpServers.length > 3 && (
                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
                          +{connectionStatus.agentContext.mcpServers.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="px-4 py-2">
                  <Alert variant="destructive" className="text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <div>
                      <strong>Error:</strong> {error}
                    </div>
                  </Alert>
                </div>
              )}

              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-0">
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
                            {message.response.toolsUsed && message.response.toolsUsed.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-muted-foreground mr-2">Tools used:</span>
                                {message.response.toolsUsed.map((tool: string) => (
                                  <Badge key={tool} variant="outline" className="text-xs bg-green-50 text-green-700">
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
                                {message.response.toolResults && message.response.toolResults.length > 0 && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
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
                    placeholder={`Ask ${agent.name} about GRC analysis...`}
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
                  <div className="text-xs text-muted-foreground">
                    {agent.name} • {agent.useCase}
                    {connectionStatus.llmConfig && (
                      <span className="ml-2">
                        • {connectionStatus.llmConfig.provider} ({connectionStatus.llmConfig.model})
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 text-xs">
                    {connectionStatus.agentContext?.validationResults?.mcpServersValid && (
                      <span className="text-green-600">
                        ✓ {connectionStatus.agentContext.mcpServers?.length || 0} MCP
                      </span>
                    )}
                    {connectionStatus.agentContext?.validationResults?.llmValid && (
                      <span className="text-green-600">
                        ✓ LLM
                      </span>
                    )}
                    {connectionStatus.selectedConnection && (
                      <span className="text-blue-600">
                        ✓ Archer
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
};