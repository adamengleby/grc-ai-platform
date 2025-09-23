/**
 * Backend API Client - WORKING VERSION
 * Connects to our localhost:3005 backend with database integration
 * Replaces all localStorage functionality with real database calls
 */

import { AIAgent } from '@/types/agent';

// API Configuration - use direct backend URL in development, Azure Functions in production
const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:3005/api/v1'
  : (import.meta.env.VITE_API_BASE_URL || 'https://func-grc-backend-full.azurewebsites.net/api/v1');

// Response types matching our backend
interface BackendResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

interface BackendErrorResponse {
  success: false;
  error: string;
  code?: string;
  timestamp: string;
}

// Error handling
export class BackendApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}

/**
 * Backend API Client - Direct replacement for localStorage
 */
export class BackendApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make API request with proper error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    try {
      console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as BackendErrorResponse;
        throw new BackendApiError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData.code
        );
      }

      console.log(`✅ API Success: ${options.method || 'GET'} ${url}`, data);
      return (data as BackendResponse<T>).data;
    } catch (error) {
      console.error(`❌ API Error: ${options.method || 'GET'} ${url}`, error);
      throw error;
    }
  }

  /**
   * Test database connectivity
   * Replaces: localStorage health checks
   */
  async testConnection(): Promise<{
    database_status: string;
    health_check: Record<string, boolean>;
    multi_tenant_ready: boolean;
    sample_data: any;
  }> {
    return this.request('/simple-agents/test-database');
  }

  // ============================================
  // AGENT MANAGEMENT - Replaces localStorage
  // ============================================

  /**
   * Get all agents for tenant
   * Replaces: JSON.parse(localStorage.getItem(`ai_agents_${tenantId}`) || '[]')
   */
  async getAgents(): Promise<{
    agents: AIAgent[];
    total: number;
    tenant_id: string;
    database_type: string;
    replacement_status: string;
  }> {
    return this.request('/simple-agents');
  }

  /**
   * Create new agent
   * Replaces: localStorage.setItem(`ai_agents_${tenantId}`, JSON.stringify([...agents, newAgent]))
   */
  async createAgent(agentData: {
    name: string;
    description?: string;
    system_prompt?: string;
  }): Promise<AIAgent> {
    return this.request('/simple-agents/create', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  }

  /**
   * Update agent
   * Replaces: localStorage.setItem with updated agent data
   */
  async updateAgent(agentId: string, updates: Partial<AIAgent>): Promise<AIAgent> {
    return this.request(`/simple-agents/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete agent
   * Replaces: localStorage.setItem with filtered agents array
   */
  async deleteAgent(agentId: string): Promise<{ message: string }> {
    return this.request(`/simple-agents/${agentId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // FUTURE: Additional API methods
  // ============================================

  /**
   * Get LLM configurations - use backendLLMService instead
   * This method is deprecated - use backendLLMService.getAllLlmConfigs()
   */
  async getLLMConfigs(): Promise<any[]> {
    console.warn('BackendApiClient.getLLMConfigs() is deprecated. Use backendLLMService.getAllLlmConfigs() instead.');
    return [];
  }

  /**
   * Get MCP servers (when backend route is ready)
   * Replaces: localStorage.getItem(`tenant_mcp_servers_${tenantId}`)
   */
  async getMCPServers(): Promise<any[]> {
    // TODO: Implement when backend route is ready
    console.log('🚧 MCP Servers: Using localStorage fallback until backend route ready');
    const stored = localStorage.getItem(`tenant_mcp_servers_demo-tenant`);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Get user preferences (when backend route is ready)
   * Replaces: localStorage.getItem for theme, ui_preferences, etc.
   */
  async getUserPreferences(): Promise<any> {
    // TODO: Implement when backend route is ready
    console.log('🚧 User Preferences: Using localStorage fallback until backend route ready');
    return {
      theme: localStorage.getItem('theme') || 'light',
      ui_preferences: JSON.parse(localStorage.getItem('ui_preferences') || '{}')
    };
  }

  /**
   * Get chat sessions (when backend route is ready)
   * Replaces: localStorage.getItem for chat session data
   */
  async getChatSessions(): Promise<any[]> {
    // TODO: Implement when backend route is ready
    console.log('🚧 Chat Sessions: Using localStorage fallback until backend route ready');
    return [];
  }
}

// Export singleton instance
export const backendApiClient = new BackendApiClient();