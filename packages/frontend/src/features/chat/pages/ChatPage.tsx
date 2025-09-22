import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { EnhancedMarkdown } from '../../../components/ui/EnhancedMarkdown';
import { User, Bot, AlertTriangle, RefreshCw, ChevronDown, Shield, ArrowLeft, Trash2, Copy, ThumbsUp, ThumbsDown, MoreVertical } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';
import { Alert } from '@/app/components/ui/Alert';
import { AIAgent } from '@/types/agent';
import { createAgentService } from '@/lib/backendAgentService';
import { createLLMService, LLMResponse, LLMMessage } from '@/lib/llmService';
import { useAuthStore } from '@/app/store/auth';
import { credentialsManager, type ArcherCredentials } from '@/lib/backendCredentialsApi';
// import { createTestMcpServerConfig, verifyTenantMcpConfig } from '@/lib/testMcpConfig';
// import { fixMcpEndpointConfiguration } from '../../../lib/fixMcpEndpoint';
import { clsx } from 'clsx';
import { ArcherAuthModal, ArcherSessionData } from '../components/ArcherAuthModal';
import { useOAuthTokenStore } from '@/app/store/oauthToken';
import { apiClient } from '@/services/apiClient';

interface ChatMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  response?: LLMResponse;
  isLoading?: boolean;
  error?: string;
  progress?: number;
  progressStep?: number;
  progressTotal?: number;
}

interface ConnectionStatus {
  isConnected: boolean;
  lastChecked: Date;
  llmConfig?: any;
  agentContext?: any;
  archerConnections?: ArcherCredentials[];
  selectedConnection?: ArcherCredentials | null;
  archerSession?: ArcherSessionData | null;
  sessionExpired?: boolean;
}

export const ChatPage: React.FC = () => {
  const { tenant } = useAuthStore();
  const { setToken: setOAuthToken } = useOAuthTokenStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get agent ID from URL parameters
  const agentIdFromUrl = searchParams.get('agent');
  
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
    selectedConnection: null,
    archerSession: null,
    sessionExpired: false
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Record<string, LLMMessage[]>>({});
  const [error, setError] = useState<string | null>(null);
  
  // Authentication modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authenticationRequired, setAuthenticationRequired] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Session management helpers
  const isValidSession = (session: ArcherSessionData | null | undefined): boolean => {
    if (!session) return false;
    return new Date() < session.expiresAt;
  };

  const saveSessionToStorage = (session: ArcherSessionData) => {
    try {
      const sessionKey = `archer_session_id_${tenant?.id}`;
      // Only store the sessionId, full data is retrieved from database
      localStorage.setItem(sessionKey, session.sessionId);
    } catch (error) {
      console.warn('Failed to save session ID to storage:', error);
    }
  };

  const loadSessionFromStorage = async (): Promise<ArcherSessionData | null> => {
    try {
      const sessionKey = `archer_session_id_${tenant?.id}`;
      const sessionId = localStorage.getItem(sessionKey);
      if (sessionId) {
        // Retrieve full session data from database using sessionId
        const response = await apiClient.getArcherSession(sessionId);
        if (response.success && response.sessionData) {
          // Convert date strings back to Date objects
          const sessionData: ArcherSessionData = {
            sessionId: response.sessionData.sessionId,
            expiresAt: new Date(response.sessionData.expiresAt),
            userInfo: response.sessionData.userInfo,
            // Note: oauthToken not included in database response for security
            oauthToken: undefined
          };
          return isValidSession(sessionData) ? sessionData : null;
        } else {
          console.warn('Failed to retrieve session from database:', response.error);
          // Remove invalid session ID from localStorage
          localStorage.removeItem(sessionKey);
        }
      }
    } catch (error) {
      console.warn('Failed to load session from database:', error);
      // Remove invalid session ID from localStorage on error
      const sessionKey = `archer_session_id_${tenant?.id}`;
      localStorage.removeItem(sessionKey);
    }
    return null;
  };

  const clearSession = () => {
    try {
      // Clear the new sessionId key
      const sessionKey = `archer_session_id_${tenant?.id}`;
      localStorage.removeItem(sessionKey);
      
      // Also clear the old session key for cleanup
      const oldSessionKey = `archer_session_${tenant?.id}`;
      localStorage.removeItem(oldSessionKey);
    } catch (error) {
      console.warn('Failed to clear session:', error);
    }
  };

  const handleNewConnection = () => {
    console.log('[Chat] New Connection requested - clearing session and showing auth modal');
    
    // Clear the existing session
    clearSession();
    
    // Update connection status to reflect session cleared
    setConnectionStatus(prev => ({
      ...prev,
      archerSession: null,
      sessionExpired: false,
      isConnected: false
    }));
    
    // Set authentication required and show modal
    setAuthenticationRequired(true);
    setShowAuthModal(true);
  };

  const handleAuthenticated = (sessionData: ArcherSessionData) => {
    console.log('[Chat] User authenticated successfully:', sessionData.userInfo);
    
    // Store OAuth token for MCP tool access control
    if (sessionData.oauthToken) {
      console.log('[Chat] Storing OAuth token for MCP tool access');
      setOAuthToken(sessionData.oauthToken);
    }
    
    // Save session to storage
    saveSessionToStorage(sessionData);
    
    // Update connection status
    setConnectionStatus(prev => ({
      ...prev,
      archerSession: sessionData,
      sessionExpired: false,
      isConnected: true,
      lastChecked: new Date()
    }));
    
    // Clear authentication flags
    setAuthenticationRequired(false);
    setShowAuthModal(false);
  };

  const checkSessionExpiry = () => {
    const currentSession = connectionStatus.archerSession;
    if (currentSession && !isValidSession(currentSession)) {
      console.log('[Chat] Session expired, requiring re-authentication');
      setConnectionStatus(prev => ({
        ...prev,
        sessionExpired: true,
        isConnected: false
      }));
      clearSession();
      setAuthenticationRequired(true);
    }
  };

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

  // Handle agent selection from URL parameters
  useEffect(() => {
    if (agentIdFromUrl && availableAgents.length > 0 && (!selectedAgent || selectedAgent.id !== agentIdFromUrl)) {
      const agentFromUrl = availableAgents.find(agent => agent.id === agentIdFromUrl);
      if (agentFromUrl) {
        console.log(`[Chat] Auto-selecting agent from URL: ${agentFromUrl.name}`);
        setSelectedAgent(agentFromUrl);
        saveGlobalChatState(agentFromUrl);
      } else {
        console.warn(`[Chat] Agent ID from URL not found: ${agentIdFromUrl}`);
      }
    }
  }, [agentIdFromUrl, availableAgents, selectedAgent]);

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
        
        // Note: We no longer load credentials from database
        // User-direct authentication means users authenticate in the chat interface
        let archerConnections: ArcherCredentials[] = [];
        let selectedConnection: ArcherCredentials | null = null;

        // MCP configuration is now handled by the database backend
        
        // Check for existing Archer session
        const existingSession = await loadSessionFromStorage();
        const hasValidSession = isValidSession(existingSession);
        
        // Session validation handled silently

        setConnectionStatus({
          isConnected: hasValidSession,
          lastChecked: new Date(),
          llmConfig: agentContext.llmConfig,
          agentContext: agentContext,
          archerConnections,
          selectedConnection,
          archerSession: existingSession,
          sessionExpired: Boolean(existingSession && !hasValidSession)
        });

        // Set authentication requirement if no valid session
        if (!hasValidSession) {
          console.log('[Chat] No valid Archer session found, authentication required');
          setAuthenticationRequired(true);
          setShowAuthModal(true); // Show modal immediately when authentication is required
        }
        
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
          // Loading agent conversation history with isolation
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
    if (!inputMessage.trim() || isLoading || !selectedAgent) return;

    // Check for valid Archer session - but only show auth modal, don't block sending
    checkSessionExpiry();

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

      // Call LLM service with integrated MCP support (using session token)
      const response = await llmService.processMessage(
        selectedAgent,
        connectionStatus.llmConfig,
        currentMessage,
        newHistory.slice(-10), // Keep last 10 messages for context
        connectionStatus.archerSession?.sessionId, // Pass only sessionId for backend lookup
        tenant?.id,
        // Real-time progress callback
        (update) => {
          const progressMessage = update.toolName 
            ? `🔧 ${update.toolName}${update.toolProgress ? ` (${Math.round(update.toolProgress)}%)` : ''}`
            : update.message;
          
          setMessages(prev => prev.map(msg => 
            msg.id === loadingMessage.id
              ? {
                  ...msg,
                  content: progressMessage,
                  progress: update.toolProgress,
                  progressStep: update.step,
                  progressTotal: update.totalSteps
                }
              : msg
          ));
        }
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
    <div className="flex flex-col h-screen">
      {/* Header with Input-Style Design */}
      <div className="sticky top-0 z-50 flex-shrink-0 border-b border-gray-200 bg-white shadow-sm">
        <div className="px-4 py-4 sm:px-6">
          <div className="w-full">
            <div className="relative flex items-center gap-3">
              {/* Left Section in Rounded Container */}
              <div className="flex-1 flex items-center gap-3 rounded-2xl border border-gray-300 px-4 py-3 bg-white shadow-sm">
                {/* Back Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/agents')}
                  className="p-1 hover:bg-gray-50 rounded-lg flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4 text-gray-600" />
                </Button>
                
                {/* Title with Icon */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <h1 className="text-sm font-semibold text-gray-900 hidden sm:block">GRC AI Chat</h1>
                </div>
                
                {/* Agent Selector */}
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <select
                      value={selectedAgent.id}
                      onChange={(e) => {
                        const agent = availableAgents.find(a => a.id === e.target.value);
                        if (agent) handleAgentSelect(agent);
                      }}
                      className="w-full appearance-none bg-gray-50 border-0 rounded-lg px-3 py-1.5 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      aria-label="Select AI Agent"
                    >
                      {availableAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              
              {/* Right Section - Status & Actions */}
              <div className="flex items-center gap-2">
                {/* Connection Status */}
                <div className="flex items-center space-x-1.5 bg-gray-50 rounded-full px-3 py-1.5 text-xs shadow-sm">
                  <div className={clsx(
                    'h-2 w-2 rounded-full',
                    (connectionStatus.archerSession && !connectionStatus.sessionExpired) ? 'bg-green-500' : 'bg-amber-500'
                  )} />
                  <span className="font-medium text-gray-700 hidden sm:inline">
                    {(connectionStatus.archerSession && !connectionStatus.sessionExpired) ? 'Connected' : 'Offline'}
                  </span>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                  {/* Primary Connect Button */}
                  <button
                    onClick={handleNewConnection}
                    disabled={isLoading}
                    className="h-9 w-9 rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-sm"
                    title="Connect to Archer"
                    aria-label="Connect to Archer"
                  >
                    <Shield className="h-4 w-4 text-white" />
                  </button>
                  
                  {/* Secondary Actions - Hidden on small screens */}
                  <div className="hidden md:flex items-center gap-1">
                    <button
                      onClick={handleRefreshConnection}
                      disabled={isLoading}
                      className="h-9 w-9 rounded-full bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-sm"
                      title="Refresh Connection"
                      aria-label="Refresh connection"
                    >
                      <RefreshCw className={clsx('h-4 w-4 text-gray-600', isLoading && 'animate-spin')} />
                    </button>
                    
                    <button
                      onClick={handleClearChat}
                      disabled={isLoading}
                      className="h-9 w-9 rounded-full bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-sm"
                      title="Clear Chat"
                      aria-label="Clear chat history"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                  
                  {/* Mobile Menu */}
                  <button
                    className="h-9 w-9 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-colors shadow-sm md:hidden"
                    title="More Options"
                    aria-label="More options"
                  >
                    <MoreVertical className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Error Alert */}
      {error && (
        <div className="flex-shrink-0 px-4 py-2 sm:px-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <div>
              <strong>Connection Error:</strong> {error}
            </div>
          </Alert>
        </div>
      )}

      {/* Full Height Chat Interface */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
        {/* Messages Area - Accessible */}
        <div 
          className="flex-1 px-4 pt-24 pb-24 overflow-y-auto space-y-6 sm:px-6 w-full"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
          aria-atomic="false"
        >
          {messages.map((message) => (
            <article
              key={message.id}
              className={clsx(
                'flex gap-4 group',
                message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
              role="article"
              aria-label={`${message.type === 'user' ? 'User message' : 'AI agent response'} at ${formatTimestamp(message.timestamp)}`}
            >
              {/* Avatar */}
              <div className="flex-shrink-0">
                {message.type === 'agent' ? (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
              
              {/* Message Content */}
              <div className={clsx(
                'flex-1 max-w-[75%]',
                message.type === 'user' ? 'mr-auto' : 'ml-0'
              )}>
                <div className={clsx(
                  'rounded-2xl px-4 py-3 shadow-sm',
                  message.type === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : message.error
                    ? 'bg-red-50 border border-red-200 text-red-900 rounded-bl-md'
                    : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                )}>
                  {/* Message Text */}
                  <div className={clsx(
                    "text-[15px] leading-relaxed markdown-content",
                    message.type === 'user' && "text-white [&_*]:text-white [&_*]:border-none [&_h1]:border-none [&_h1]:border-b-0"
                  )} style={message.type === 'user' ? { color: 'white' } : {}}>
                    <EnhancedMarkdown>
                      {message.content}
                    </EnhancedMarkdown>
                  </div>
                  
                  {/* Modern Loading State */}
                  {message.isLoading && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                        </div>
                        <span className="text-sm text-gray-600">
                          {message.progressStep && message.progressTotal 
                            ? `Step ${message.progressStep}/${message.progressTotal}` 
                            : 'Processing...'}
                        </span>
                      </div>
                      {message.progress && (
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-1 rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${message.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {message.response && !message.isLoading && (
                    <div className="space-y-2 text-xs">
                      {/* MCP Tools Used */}
                      {message.response.toolsUsed && message.response.toolsUsed.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-muted-foreground mr-2">Archer tools used:</span>
                          {message.response.toolsUsed.map((tool: string, index: number) => (
                            <Badge key={`${message.id}-${tool}-${index}`} variant="outline" className="text-xs bg-blue-50 text-blue-700">
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
                  
                  {/* Message Actions & Timestamp */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center space-x-1">
                      {message.type === 'agent' && !message.isLoading && (
                        <div className="flex items-center space-x-1 bg-gray-50 rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-white rounded-full transition-colors"
                            onClick={() => navigator.clipboard.writeText(message.content)}
                            title="Copy message"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <div className="w-px h-3 bg-gray-300" />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                            title="Good response"
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                            title="Poor response"
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{formatTimestamp(message.timestamp)}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Modern Input Area */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-4 sm:px-6">
          <div className="w-full">
            <div className="relative flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef as any}
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    // Auto-resize textarea
                    const textarea = e.target as HTMLTextAreaElement;
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
                  }}
                  placeholder={`Message ${selectedAgent.name}...`}
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="w-full min-h-[44px] max-h-[120px] resize-none rounded-2xl border border-gray-300 px-4 py-3 pr-12 text-[15px] leading-relaxed focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder:text-gray-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed touch-manipulation"
                  rows={1}
                  aria-label="Type your message"
                  aria-describedby="input-hint"
                  aria-expanded={false}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  className="absolute right-3 bottom-3 h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md flex items-center justify-center border-none outline-none"
                  aria-label="Send message"
                  title="Send message (Enter)"
                >
                  {/* Right arrow as send icon */}
                  <div className="text-white text-xl font-bold">
                    ▶
                  </div>
                </button>
              </div>
            </div>
          
            {/* Input Footer */}
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span>{selectedAgent.name}</span>
                <span>•</span>
                <span>{selectedAgent.useCase}</span>
                {connectionStatus.llmConfig && (
                  <>
                    <span>•</span>
                    <span>{connectionStatus.llmConfig.provider} ({connectionStatus.llmConfig.model})</span>
                  </>
                )}
                {(connectionStatus.archerSession && !connectionStatus.sessionExpired) ? (
                  <>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      <div className="h-1.5 w-1.5 bg-green-500 rounded-full" />
                      <span className="text-green-600">Archer Connected</span>
                    </div>
                  </>
                ) : (
                  <>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      <div className="h-1.5 w-1.5 bg-orange-500 rounded-full" />
                      <span className="text-orange-600">No Archer Connection</span>
                    </div>
                  </>
                )}
              </div>
              <div id="input-hint" className="text-xs text-gray-400">
                Press Shift+Enter for new line
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Authentication Required Prompt */}
      {authenticationRequired && !showAuthModal && (
        <div className="mx-4 mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-sm">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">
                Archer Authentication Required
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                Connect to unlock enhanced GRC capabilities
              </p>
            </div>
            <Button
              onClick={() => setShowAuthModal(true)}
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Connect
            </Button>
          </div>
        </div>
      )}


      {/* Authentication Modal */}
      <ArcherAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={handleAuthenticated}
        tenantId={tenant?.id || ''}
      />
    </div>
  );
};
