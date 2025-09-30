/**
 * API Client for GRC AI Platform
 * Replaces all localStorage functionality with secure backend API calls
 * Implements proper tenant isolation and authentication
 */

import { AIAgent } from '@/types/agent';
import { User, Tenant, UserRole } from '@/types/tenant';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV
  ? 'http://localhost:8080/api/v1'
  : 'https://grc-backend.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io/api/v1');

// Request types
interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  tenantId?: string;
}

interface PaginationOptions {
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Response types
interface ApiResponse<T> {
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

// Error classes
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_REQUIRED', message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super('INSUFFICIENT_PERMISSIONS', message, 403);
    this.name = 'AuthorizationError';
  }
}

export class TenantError extends ApiError {
  constructor(message: string = 'Tenant access denied') {
    super('TENANT_ACCESS_DENIED', message, 403);
    this.name = 'TenantError';
  }
}

/**
 * Main API Client class
 * Handles authentication, tenant context, and HTTP requests
 */
export class ApiClient {
  private baseURL: string;
  private authToken: string | null = null;
  private currentTenantId: string | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
    this.loadAuthFromStorage();
  }

  /**
   * Load authentication state from localStorage (temporary during migration)
   */
  private loadAuthFromStorage(): void {
    try {
      const token = localStorage.getItem('auth_token');
      const tenantId = localStorage.getItem('current_tenant_id');
      
      if (token) {
        this.authToken = token;
      }
      
      if (tenantId) {
        this.currentTenantId = tenantId;
      }
    } catch (error) {
      console.warn('Failed to load auth from storage:', error);
    }
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    localStorage.setItem('auth_token', token);
  }

  /**
   * Set current tenant context
   */
  setTenantId(tenantId: string): void {
    this.currentTenantId = tenantId;
    localStorage.setItem('current_tenant_id', tenantId);
  }

  /**
   * Clear authentication and tenant context
   */
  clearAuth(): void {
    this.authToken = null;
    this.currentTenantId = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_tenant_id');
  }

  /**
   * Make authenticated HTTP request
   */
  private async makeRequest<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';
    const tenantId = options.tenantId || this.currentTenantId;

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add authentication header
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    // Add tenant context header
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    // Add request ID for tracing
    headers['X-Request-ID'] = crypto.randomUUID();

    // Build request options
    const requestOptions: RequestInit = {
      method,
      headers
    };

    // Add body for non-GET requests
    if (options.body && method !== 'GET') {
      if (options.body instanceof FormData) {
        // For FormData, don't stringify and remove Content-Type (browser will set it)
        requestOptions.body = options.body;
        delete headers['Content-Type'];
      } else {
        requestOptions.body = JSON.stringify(options.body);
      }
    }

    try {
      const response = await fetch(url, requestOptions);
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new ApiError(
          'RATE_LIMIT_EXCEEDED',
          'Rate limit exceeded',
          429,
          { retryAfter }
        );
      }

      // Parse response
      let responseData: any;
      const contentType = response.headers.get('Content-Type') || '';
      
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Handle HTTP errors
      if (!response.ok) {
        if (response.status === 401) {
          this.clearAuth();
          throw new AuthenticationError(
            responseData?.error?.message || 'Authentication failed'
          );
        }

        if (response.status === 403) {
          const errorCode = responseData?.error?.code;
          if (errorCode?.includes('TENANT')) {
            throw new TenantError(responseData.error.message);
          }
          throw new AuthorizationError(responseData?.error?.message);
        }

        throw new ApiError(
          responseData?.error?.code || 'API_ERROR',
          responseData?.error?.message || 'Request failed',
          response.status,
          responseData?.error?.details
        );
      }

      return responseData;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(
          'NETWORK_ERROR',
          'Network request failed. Please check your connection.',
          0
        );
      }

      throw new ApiError(
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  // =====================================================
  // AUTHENTICATION ENDPOINTS
  // =====================================================

  /**
   * Initiate login flow
   */
  async initiateLogin(email: string, redirectUri: string): Promise<{ redirect_url: string; state: string }> {
    return await this.makeRequest('/auth/login', {
      method: 'POST',
      body: { email, redirect_uri: redirectUri }
    });
  }

  /**
   * Handle authentication callback
   */
  async handleAuthCallback(code: string, state: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: any;
    tenant: any;
  }> {
    const response = await this.makeRequest('/auth/callback', {
      method: 'POST',
      body: { code, state }
    });

    // Store tokens
    this.setAuthToken(response.access_token);
    this.setTenantId(response.tenant.tenant_id);

    return response;
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<{
    user: User & { roles: UserRole[]; permissions: any[] };
    tenant: Tenant;
  }> {
    return await this.makeRequest('/auth/me');
  }

  /**
   * Get available tenants for current user
   */
  async getAvailableTenants(): Promise<{
    tenants: Array<{
      tenant_id: string;
      name: string;
      slug: string;
      subscription_tier: string;
      user_roles: UserRole[];
      status: string;
    }>;
  }> {
    return await this.makeRequest('/auth/tenants');
  }

  /**
   * Switch to different tenant
   */
  async switchTenant(tenantId: string): Promise<{
    access_token: string;
    tenant: Tenant;
  }> {
    const response = await this.makeRequest('/auth/switch-tenant', {
      method: 'POST',
      body: { tenant_id: tenantId }
    });

    // Update stored token and tenant
    this.setAuthToken(response.access_token);
    this.setTenantId(tenantId);

    return response;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await this.makeRequest('/auth/logout', { method: 'POST' });
    } finally {
      this.clearAuth();
    }
  }

  // =====================================================
  // AI AGENT MANAGEMENT
  // =====================================================

  /**
   * Get all AI agents for current tenant
   */
  async getAgents(options: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
    sort?: 'name' | 'created_at' | 'usage_count';
    order?: 'asc' | 'desc';
  } = {}): Promise<{ agents: AIAgent[]; pagination: any }> {
    const params = new URLSearchParams();
    
    if (options.enabled !== undefined) {
      params.set('enabled', String(options.enabled));
    }
    if (options.limit) {
      params.set('limit', String(options.limit));
    }
    if (options.offset) {
      params.set('offset', String(options.offset));
    }
    if (options.sort) {
      params.set('sort', options.sort);
    }
    if (options.order) {
      params.set('order', options.order);
    }

    const endpoint = `/agents${params.toString() ? '?' + params.toString() : ''}`;
    return await this.makeRequest(endpoint);
  }

  /**
   * Get specific AI agent with context
   */
  async getAgent(agentId: string): Promise<{
    agent: AIAgent;
    llm_config?: any;
    mcp_servers: any[];
    validation: { is_valid: boolean; issues: string[] };
  }> {
    return await this.makeRequest(`/agents/${agentId}`);
  }

  /**
   * Create new AI agent
   */
  async createAgent(agentData: {
    name: string;
    description?: string;
    persona?: string;
    system_prompt?: string;
    llm_config_id?: string;
    enabled_mcp_servers?: string[];
    avatar?: string;
    color?: string;
  }): Promise<{ agent: AIAgent }> {
    return await this.makeRequest('/agents', {
      method: 'POST',
      body: agentData
    });
  }

  /**
   * Create agent from preset
   */
  async createAgentFromPreset(data: {
    preset_id: string;
    llm_config_id: string;
    mcp_server_ids: string[];
    customizations?: {
      name?: string;
      description?: string;
    };
  }): Promise<{ agent: AIAgent }> {
    return await this.makeRequest('/agents/from-preset', {
      method: 'POST',
      body: data
    });
  }

  /**
   * Update existing agent
   */
  async updateAgent(agentId: string, updates: {
    name?: string;
    description?: string;
    persona?: string;
    system_prompt?: string;
    llm_config_id?: string;
    enabled_mcp_servers?: string[];
    avatar?: string;
    color?: string;
    is_enabled?: boolean;
  }): Promise<{ agent: AIAgent }> {
    return await this.makeRequest(`/agents/${agentId}`, {
      method: 'PUT',
      body: updates
    });
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    await this.makeRequest(`/agents/${agentId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Record agent usage
   */
  async recordAgentUsage(agentId: string, usage: {
    session_id?: string;
    tokens_used?: number;
    response_time_ms?: number;
    tools_used?: string[];
    success?: boolean;
  }): Promise<{ recorded: boolean; new_usage_count: number }> {
    return await this.makeRequest(`/agents/${agentId}/usage`, {
      method: 'POST',
      body: usage
    });
  }

  /**
   * Get agent usage metrics
   */
  async getAgentMetrics(agentId: string, options: {
    period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    start_date?: string;
    end_date?: string;
  } = {}): Promise<{
    agent_id: string;
    period: any;
    metrics: any;
  }> {
    const params = new URLSearchParams();
    if (options.period) params.set('period', options.period);
    if (options.start_date) params.set('start_date', options.start_date);
    if (options.end_date) params.set('end_date', options.end_date);

    const endpoint = `/agents/${agentId}/metrics${params.toString() ? '?' + params.toString() : ''}`;
    return await this.makeRequest(endpoint);
  }

  /**
   * Get agent presets
   */
  async getAgentPresets(): Promise<{
    presets: Array<{
      preset_id: string;
      name: string;
      description: string;
      persona: string;
      system_prompt: string;
      recommended_tools: string[];
      avatar?: string;
      color?: string;
      category: string;
    }>;
  }> {
    return await this.makeRequest('/agents/presets');
  }

  // =====================================================
  // LLM CONFIGURATION MANAGEMENT
  // =====================================================

  /**
   * Get all LLM configurations
   */
  async getLlmConfigs(): Promise<{
    configs: Array<{
      config_id: string;
      name: string;
      provider: string;
      model: string;
      temperature: number;
      max_tokens: number;
      is_enabled: boolean;
      is_default: boolean;
      last_tested_at?: string;
      last_test_status?: string;
      usage_count: number;
      created_at: string;
    }>;
  }> {
    return await this.makeRequest('/simple-llm-configs');
  }

  /**
   * Get specific LLM configuration
   */
  async getLlmConfig(configId: string): Promise<{
    config: any;
  }> {
    return await this.makeRequest(`/llm-configs/${configId}`);
  }

  /**
   * Create new LLM configuration
   */
  async createLlmConfig(configData: {
    name: string;
    provider: 'azure_openai' | 'openai' | 'anthropic';
    model: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: 'text' | 'json_object';
    api_key: string;
    endpoint?: string;
  }): Promise<{ config: any }> {
    return await this.makeRequest('/simple-llm-configs', {
      method: 'POST',
      body: configData
    });
  }

  /**
   * Update LLM configuration
   */
  async updateLlmConfig(configId: string, updates: any): Promise<{ config: any }> {
    return await this.makeRequest(`/llm-configs/${configId}`, {
      method: 'PUT',
      body: updates
    });
  }

  /**
   * Delete LLM configuration
   */
  async deleteLlmConfig(configId: string): Promise<void> {
    await this.makeRequest(`/llm-configs/${configId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Test LLM configuration
   */
  async testLlmConfig(configId: string, testPrompt?: string): Promise<{
    test_result: {
      success: boolean;
      response_text?: string;
      response_time_ms: number;
      tokens_used?: any;
      model_version?: string;
      test_timestamp: string;
    };
  }> {
    return await this.makeRequest(`/llm-configs/${configId}/test`, {
      method: 'POST',
      body: { test_prompt: testPrompt }
    });
  }

  /**
   * Get available LLM providers
   */
  async getLlmProviders(): Promise<{
    providers: Array<{
      provider: string;
      display_name: string;
      supported_models: any[];
      required_fields: any[];
    }>;
  }> {
    return await this.makeRequest('/llm-configs/providers');
  }

  // =====================================================
  // MCP SERVER MANAGEMENT
  // =====================================================

  /**
   * Get tenant's enabled MCP servers
   */
  async getMcpServers(): Promise<{
    servers: Array<{
      tenant_server_id: string;
      server_id: string;
      name: string;
      display_name: string;
      custom_name?: string;
      description: string;
      category: string;
      is_enabled: boolean;
      configuration_values: any;
      allowed_tools: string[];
      usage_count: number;
      last_used_at?: string;
      health_status: string;
      last_health_check?: string;
      enabled_at: string;
    }>;
  }> {
    return await this.makeRequest('/mcp-servers');
  }

  /**
   * Get global MCP server registry (admin only)
   */
  async getMcpServerRegistry(): Promise<{
    servers: Array<{
      server_id: string;
      name: string;
      display_name: string;
      description: string;
      category: string;
      version: string;
      vendor?: string;
      is_approved: boolean;
      security_review_status: string;
      available_tools: any[];
      required_permissions: string[];
      compliance_frameworks: string[];
      documentation_url?: string;
      icon_url?: string;
    }>;
  }> {
    return await this.makeRequest('/mcp-servers/registry');
  }

  /**
   * Enable MCP server for tenant
   */
  async enableMcpServer(data: {
    server_id: string;
    custom_name?: string;
    configuration_values: any;
    allowed_tools?: string[];
    restricted_permissions?: string[];
  }): Promise<{ tenant_server: any }> {
    return await this.makeRequest('/mcp-servers/enable', {
      method: 'POST',
      body: data
    });
  }

  /**
   * Update MCP server configuration
   */
  async updateMcpServer(tenantServerId: string, updates: {
    custom_name?: string;
    is_enabled?: boolean;
    configuration_values?: any;
    allowed_tools?: string[];
  }): Promise<{ tenant_server: any }> {
    return await this.makeRequest(`/mcp-servers/${tenantServerId}`, {
      method: 'PUT',
      body: updates
    });
  }

  /**
   * Test MCP server
   */
  async testMcpServer(tenantServerId: string, data: {
    test_tool: string;
    test_parameters: any;
  }): Promise<{
    test_result: {
      success: boolean;
      response_time_ms: number;
      tool_response: any;
      server_version?: string;
      test_timestamp: string;
    };
  }> {
    return await this.makeRequest(`/mcp-servers/${tenantServerId}/test`, {
      method: 'POST',
      body: data
    });
  }

  /**
   * Get MCP server health
   */
  async getMcpServerHealth(tenantServerId: string): Promise<{
    health: {
      status: string;
      last_check: string;
      response_time_ms: number;
      uptime_percentage: number;
      error_count_24h: number;
      last_error?: any;
    };
  }> {
    return await this.makeRequest(`/mcp-servers/${tenantServerId}/health`);
  }

  /**
   * Get available MCP tools
   * Now supports both backend HTTP and direct MCP SSE modes
   */
  async getMcpTools(): Promise<{
    tools: Array<{
      tool_name: string;
      server_id: string;
      server_name: string;
      description: string;
      input_schema: any;
      is_available: boolean;
    }>;
  }> {
    // Use existing backend endpoint for now (maintains compatibility)
    // TODO: Add option to use direct MCP SSE for real-time capabilities
    return await this.makeRequest('/mcp/tools');
  }

  /**
   * Call MCP tool with optional streaming support
   * Enhanced to support real-time progress updates via SSE
   */
  async callMcpTool(
    toolName: string,
    args: any,
    options: {
      useSSE?: boolean;
      onProgress?: (progress: { tool: string; progress: number; status: string; data?: any }) => void;
      timeout?: number;
    } = {}
  ): Promise<any> {
    if (options.useSSE) {
      // Import dynamically to avoid loading SSE client unless needed
      const { mcpSSEClient } = await import('./mcpSSEClient');
      return await mcpSSEClient.callTool(toolName, args, {
        onProgress: options.onProgress,
        timeout: options.timeout
      });
    } else {
      // Use existing backend MCP endpoint
      return await this.makeRequest('/mcp/call', 'POST', {
        tool: toolName,
        args: args
      });
    }
  }

  // =====================================================
  // ENHANCED CHAT SYSTEM (v2.0)
  // =====================================================

  /**
   * Enhanced GRC Chat with multi-LLM orchestration and file uploads
   */
  async enhancedChat(data: {
    message: string;
    files?: File[];
    grcContext?: {
      frameworks?: string[];
      tenant?: string;
      role?: string;
    };
  }): Promise<{
    response: string;
    metadata: {
      toolsUsed: string[];
      reasoning: string;
      confidence: number;
      llmProvider: string;
      grcAnalysis: {
        category: string;
        riskLevel: string;
        complianceFrameworks: string[];
        recommendations: string[];
      };
      filesProcessed: number;
      conversationLength: number;
      serverStatus: Array<{
        name: string;
        status: string;
        toolCount: number;
      }>;
      userContext: {
        tenantId: string;
        roles: string[];
        permissions: any;
      };
    };
    timestamp: string;
  }> {
    const formData = new FormData();
    formData.append('message', data.message);

    if (data.grcContext) {
      formData.append('grcContext', JSON.stringify(data.grcContext));
    }

    if (data.files) {
      data.files.forEach((file, index) => {
        formData.append('attachments', file);
      });
    }

    const response = await this.makeRequest<{
      success: boolean;
      data: any;
      timestamp: string;
    }>('/enhanced/chat', {
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData
    });

    return response.data;
  }

  /**
   * Get enhanced conversation history with GRC insights
   */
  async getEnhancedConversationHistory(userId: string, limit: number = 50): Promise<{
    conversations: Array<{
      id: string;
      input: any;
      output: any;
      timestamp: string;
      reasoning: string;
      toolsUsed: string[];
      grcAnalysis: any;
    }>;
    insights: {
      totalInteractions: number;
      timeRange: any;
      grcAnalysis: any;
      toolUsage: any;
      topTopics: string[];
      complianceFrameworks: string[];
    };
    summary: {
      totalInteractions: number;
      timeRange: any;
    };
  }> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));

    const endpoint = `/enhanced/conversations/${userId}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.makeRequest<{ success: boolean; data: any }>(endpoint);
    return response.data;
  }

  /**
   * Search enhanced conversation memory
   */
  async searchEnhancedMemory(query: string, limit: number = 10): Promise<{
    query: string;
    results: Array<{
      interaction: any;
      relevanceScore: number;
      matchedTerms: string[];
    }>;
    summary: {
      totalResults: number;
      searchTerms: string[];
    };
  }> {
    const params = new URLSearchParams();
    params.set('query', query);
    if (limit) params.set('limit', String(limit));

    const endpoint = `/enhanced/memory/search?${params.toString()}`;
    const response = await this.makeRequest<{ success: boolean; data: any }>(endpoint);
    return response.data;
  }

  /**
   * Get enhanced MCP tools and servers
   */
  async getEnhancedMcpTools(): Promise<{
    tools: Array<{
      server: string;
      name: string;
      description: string;
      inputSchema: any;
    }>;
    servers: Array<{
      id: string;
      name: string;
      status: string;
      toolCount: number;
      auth?: string;
      url?: string;
    }>;
    summary: {
      totalTools: number;
      totalServers: number;
      toolsByServer: Record<string, number>;
    };
  }> {
    const response = await this.makeRequest<{ success: boolean; data: any }>('/enhanced/tools');
    return response.data;
  }

  /**
   * Get enhanced chat system health
   */
  async getEnhancedChatHealth(): Promise<{
    service: string;
    status: string;
    mcpServers: {
      total: number;
      active: number;
      inactive: number;
    };
    capabilities: string[];
    version: string;
  }> {
    const response = await this.makeRequest<{ success: boolean; data: any }>('/enhanced/health');
    return response.data;
  }

  /**
   * Send enhanced chat message with LLM orchestration
   */
  async enhancedChat(request: {
    message: string;
    files?: File[];
    grcContext?: {
      frameworks?: string[];
      tenant?: string;
      role?: string;
    };
    userId?: string;
    tenantId?: string;
  }): Promise<{
    response: string;
    metadata: {
      toolsUsed: string[];
      reasoning: string;
      confidence: number;
      llmProvider: string;
      grcAnalysis?: {
        category?: string;
        riskLevel?: string;
        complianceFrameworks?: string[];
        recommendations?: string[];
      };
    };
  }> {
    const response = await this.makeRequest<{ success: boolean; data: any }>('/enhanced-chat/process', 'POST', {
      message: request.message,
      files: request.files || [],
      userId: request.userId || 'demo-user',
      tenantId: request.tenantId || 'demo-tenant'
    });
    return response.data;
  }

  /**
   * Get enhanced conversation history
   */
  async getEnhancedConversationHistory(userId: string, limit: number = 20): Promise<any[]> {
    // Mock implementation for now - replace with actual backend endpoint when available
    return [];
  }

  /**
   * Search enhanced conversation memory
   */
  async searchEnhancedMemory(query: string, limit: number = 5): Promise<{
    results: Array<{
      id: string;
      content: string;
      timestamp: string;
      relevance: number;
    }>;
  }> {
    // Mock implementation for now - replace with actual backend endpoint when available
    return { results: [] };
  }

  // =====================================================
  // LEGACY CHAT & SESSION MANAGEMENT
  // =====================================================

  /**
   * Get chat sessions
   */
  async getChatSessions(options: {
    agent_id?: string;
    active_only?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    sessions: Array<{
      session_id: string;
      session_name?: string;
      agent: { agent_id: string; name: string; avatar?: string };
      is_active: boolean;
      last_message_at: string;
      message_count: number;
      created_at: string;
    }>;
  }> {
    const params = new URLSearchParams();
    if (options.agent_id) params.set('agent_id', options.agent_id);
    if (options.active_only) params.set('active_only', 'true');
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));

    const endpoint = `/chat/sessions${params.toString() ? '?' + params.toString() : ''}`;
    return await this.makeRequest(endpoint);
  }

  /**
   * Create new chat session
   */
  async createChatSession(data: {
    agent_id: string;
    session_name?: string;
    session_context?: any;
  }): Promise<{
    session: {
      session_id: string;
      session_name?: string;
      agent_id: string;
      is_active: boolean;
      message_count: number;
      created_at: string;
    };
  }> {
    return await this.makeRequest('/chat/sessions', {
      method: 'POST',
      body: data
    });
  }

  /**
   * Get messages in chat session
   */
  async getChatMessages(sessionId: string, options: {
    limit?: number;
    before_sequence?: number;
    include_system?: boolean;
  } = {}): Promise<{
    messages: Array<{
      message_id: string;
      sequence_number: number;
      role: string;
      content: string;
      content_type: string;
      tool_calls?: any[];
      tokens_used?: number;
      processing_time_ms?: number;
      created_at: string;
    }>;
    has_more: boolean;
  }> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.before_sequence) params.set('before_sequence', String(options.before_sequence));
    if (options.include_system) params.set('include_system', 'true');

    const endpoint = `/chat/sessions/${sessionId}/messages${params.toString() ? '?' + params.toString() : ''}`;
    return await this.makeRequest(endpoint);
  }

  /**
   * Send message in chat session
   */
  async sendChatMessage(sessionId: string, data: {
    content: string;
    content_type?: 'text';
  }): Promise<{
    user_message: any;
    agent_response: any;
  }> {
    return await this.makeRequest(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: data
    });
  }

  // =====================================================
  // USER MANAGEMENT
  // =====================================================

  /**
   * Get users in current tenant (admin only)
   */
  async getUsers(): Promise<{
    users: Array<{
      user_id: string;
      email: string;
      name: string;
      roles: UserRole[];
      status: string;
      mfa_enabled: boolean;
      last_login_at?: string;
      created_at: string;
    }>;
  }> {
    return await this.makeRequest('/users');
  }

  /**
   * Invite new user to tenant
   */
  async inviteUser(data: {
    email: string;
    name: string;
    roles: UserRole[];
    send_invitation?: boolean;
  }): Promise<{ user: any }> {
    return await this.makeRequest('/users/invite', {
      method: 'POST',
      body: data
    });
  }

  /**
   * Update user roles
   */
  async updateUserRoles(userId: string, roles: UserRole[]): Promise<{ user: any }> {
    return await this.makeRequest(`/users/${userId}/roles`, {
      method: 'PUT',
      body: { roles }
    });
  }

  // =====================================================
  // AUDIT & COMPLIANCE
  // =====================================================

  /**
   * Get audit events
   */
  async getAuditEvents(options: {
    event_type?: string;
    event_category?: string;
    severity?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    events: Array<{
      event_id: string;
      event_type: string;
      event_category: string;
      severity: string;
      user_email?: string;
      resource_type?: string;
      resource_id?: string;
      event_summary: string;
      client_ip?: string;
      compliance_frameworks?: string[];
      event_timestamp: string;
    }>;
    pagination: any;
  }> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    });

    const endpoint = `/audit/events${params.toString() ? '?' + params.toString() : ''}`;
    return await this.makeRequest(endpoint);
  }

  /**
   * Get detailed audit event
   */
  async getAuditEvent(eventId: string): Promise<{ event: any }> {
    return await this.makeRequest(`/audit/events/${eventId}`);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(options: {
    framework: 'ISO27001' | 'SOC2' | 'CPS230' | 'GDPR';
    start_date: string;
    end_date: string;
    format?: 'json' | 'pdf' | 'csv';
  }): Promise<{ report: any }> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      params.set(key, String(value));
    });

    return await this.makeRequest(`/audit/compliance-report?${params.toString()}`);
  }

  // =====================================================
  // ANALYTICS & METRICS
  // =====================================================

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(options: {
    period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    start_date?: string;
    end_date?: string;
    granularity?: 'hour' | 'day' | 'week' | 'month';
  } = {}): Promise<{
    usage: {
      period: any;
      summary: any;
      trends: any;
      daily_breakdown: any[];
      top_agents: any[];
      top_tools: any[];
    };
  }> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    });

    const endpoint = `/analytics/usage${params.toString() ? '?' + params.toString() : ''}`;
    return await this.makeRequest(endpoint);
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    performance: {
      current_status: any;
      agent_performance: any[];
      mcp_server_performance: any[];
    };
  }> {
    return await this.makeRequest('/analytics/performance');
  }

  // =====================================================
  // TENANT SETTINGS
  // =====================================================

  /**
   * Get tenant settings
   */
  async getTenantSettings(): Promise<{
    tenant: {
      tenant_id: string;
      name: string;
      subscription_tier: string;
      status: string;
      settings: any;
      quota: any;
    };
  }> {
    return await this.makeRequest('/tenant/settings');
  }

  /**
   * Update tenant settings
   */
  async updateTenantSettings(settings: {
    enabledFeatures?: string[];
    byoLlmEnabled?: boolean;
    auditRetentionDays?: number;
    complianceFrameworks?: string[];
  }): Promise<{ tenant: any }> {
    return await this.makeRequest('/tenant/settings', {
      method: 'PUT',
      body: { settings }
    });
  }

  /**
   * Get Archer session data from database
   */
  async getArcherSession(sessionId: string): Promise<{
    success: boolean;
    sessionData?: {
      sessionId: string;
      expiresAt: string;
      userInfo: {
        username: string;
        instanceId: string;
        baseUrl: string;
      };
    };
    error?: string;
  }> {
    return await this.makeRequest(`/auth/archer/session/${sessionId}`);
  }

  /**
   * Authenticate with Archer GRC platform
   */
  async authenticateArcher(credentials: {
    baseUrl: string;
    username: string;
    password: string;
    instanceId: string;
    userDomainId?: string;
  }): Promise<{
    success: boolean;
    sessionData?: {
      sessionId: string;
      expiresAt: string;
      authMethod: string;
      oauthToken?: any;
      userInfo: {
        username: string;
        instanceId: string;
        baseUrl: string;
      };
    };
    error?: string;
  }> {
    return await this.makeRequest('/auth/archer/authenticate', {
      method: 'POST',
      body: credentials
    });
  }

  /**
   * Logout from Archer session
   */
  async logoutArcher(sessionId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return await this.makeRequest(`/auth/archer/session/${sessionId}`, {
      method: 'DELETE'
    });
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Export utility functions for error handling
export const isApiError = (error: unknown): error is ApiError => {
  return error instanceof ApiError;
};

export const isAuthError = (error: unknown): error is AuthenticationError | AuthorizationError => {
  return error instanceof AuthenticationError || error instanceof AuthorizationError;
};

export const isTenantError = (error: unknown): error is TenantError => {
  return error instanceof TenantError;
};