# FRONTEND REFACTORING PLAN: localStorage to API Migration

## CRITICAL ARCHITECTURE FIX IMPLEMENTATION

This document outlines the complete refactoring plan to replace localStorage usage with secure, tenant-isolated API calls throughout the frontend application.

## 1. CURRENT LOCALSTORAGE USAGE AUDIT

### Files Requiring Modification:

#### High Priority (Core Functionality):
1. `/src/services/apiClient.ts` - Authentication token storage
2. `/src/features/agents/components/AgentConfigModal.tsx` - Agent configurations
3. `/src/features/settings/components/McpServerConnection.tsx` - MCP server configs
4. `/src/features/settings/components/LLMConfigSection.tsx` - LLM configurations  
5. `/src/features/chat/pages/ChatPage.tsx` - Chat session management
6. `/src/features/agents/components/AgentChatModal.tsx` - Agent-specific chats

#### Medium Priority (UI/UX):
7. `/src/app/App.tsx` - Theme preferences
8. `/src/app/components/layout/DashboardHeader.tsx` - Theme settings
9. `/src/features/settings/pages/SettingsPage.tsx` - Various settings

#### Lower Priority (Analytics/Testing):
10. `/src/features/connections/pages/ConnectionsPage.tsx` - Connection data
11. `/src/features/analytics/components/RealTimeDashboard.tsx` - Auth tokens

## 2. NEW API CLIENT ARCHITECTURE

### Enhanced API Client Service

Replace `/src/services/apiClient.ts` with comprehensive API client:

```typescript
// /src/services/apiClient.ts - NEW IMPLEMENTATION
interface ApiClient {
  // Authentication
  login(email: string, password: string): Promise<AuthResponse>
  logout(): Promise<void>
  refreshToken(): Promise<string>
  
  // Agents API - Replace localStorage ai_agents_*
  getAgents(): Promise<Agent[]>
  createAgent(agent: CreateAgentRequest): Promise<Agent>
  updateAgent(id: string, updates: UpdateAgentRequest): Promise<Agent>
  deleteAgent(id: string): Promise<void>
  testAgent(id: string): Promise<TestResult>
  
  // LLM Configs API - Replace localStorage user_llm_configs_*
  getLLMConfigs(): Promise<LLMConfig[]>
  createLLMConfig(config: CreateLLMConfigRequest): Promise<LLMConfig>
  updateLLMConfig(id: string, updates: UpdateLLMConfigRequest): Promise<LLMConfig>
  deleteLLMConfig(id: string): Promise<void>
  testLLMConfig(id: string): Promise<TestResult>
  
  // Chat API - Replace localStorage chat_session_*
  getChatSessions(): Promise<ChatSession[]>
  createChatSession(agentId: string, name?: string): Promise<ChatSession>
  getSessionMessages(sessionId: string): Promise<ChatMessage[]>
  addMessageToSession(sessionId: string, message: CreateMessageRequest): Promise<ChatMessage>
  deleteChatSession(sessionId: string): Promise<void>
  clearSessionMessages(sessionId: string): Promise<void>
  
  // Preferences API - Replace localStorage theme, ui_preferences, etc.
  getUserPreferences(): Promise<UserPreferences>
  updateUserPreferences(updates: Partial<UserPreferences>): Promise<UserPreferences>
  getTenantSettings(): Promise<TenantSettings>
  updateTenantSettings(updates: Partial<TenantSettings>): Promise<TenantSettings>
}
```

### Key Features:
- **Automatic tenant isolation**: All requests include proper tenant headers
- **Token refresh handling**: Automatic token refresh on 401 responses
- **Error standardization**: Consistent error handling across all API calls
- **Request/response logging**: Comprehensive audit trails
- **Retry logic**: Automatic retry for transient failures

## 3. COMPONENT REFACTORING STRATEGY

### Phase 1: Authentication & Session Management

**Target Files:**
- `/src/services/apiClient.ts`
- `/src/app/store/auth.ts` 
- `/src/app/App.tsx`

**Changes:**
```typescript
// BEFORE: localStorage token storage
const token = localStorage.getItem('auth_token');

// AFTER: Secure session-based authentication
const session = await apiClient.getCurrentSession();
```

### Phase 2: Agent Management

**Target Files:**
- `/src/features/agents/components/AgentConfigModal.tsx`
- `/src/features/agents/components/AgentSettingsModal.tsx`
- `/src/features/agents/components/AgentCard.tsx`
- `/src/features/agents/pages/AgentsPage.tsx`

**Changes:**
```typescript
// BEFORE: localStorage agent storage
const agents = JSON.parse(localStorage.getItem(`ai_agents_${tenantId}`) || '[]');
localStorage.setItem(`ai_agents_${tenantId}`, JSON.stringify(updatedAgents));

// AFTER: API-based agent management
const agents = await apiClient.getAgents();
const newAgent = await apiClient.createAgent(agentData);
const updatedAgent = await apiClient.updateAgent(agentId, updates);
```

### Phase 3: LLM Configuration Management

**Target Files:**
- `/src/features/settings/components/LLMConfigSection.tsx`
- `/src/features/settings/components/AddLlmConfigModal.tsx`

**Changes:**
```typescript
// BEFORE: localStorage LLM config storage  
const configs = JSON.parse(localStorage.getItem(`user_llm_configs_${tenantId}`) || '[]');
localStorage.setItem(`user_llm_configs_${tenantId}`, JSON.stringify(updatedConfigs));

// AFTER: API-based LLM config management
const configs = await apiClient.getLLMConfigs();
const newConfig = await apiClient.createLLMConfig(configData);
const updatedConfig = await apiClient.updateLLMConfig(configId, updates);
```

### Phase 4: Chat Session Management

**Target Files:**
- `/src/features/chat/pages/ChatPage.tsx`
- `/src/features/agents/components/AgentChatModal.tsx`

**Changes:**
```typescript
// BEFORE: localStorage chat storage
const stored = localStorage.getItem(getChatStorageKey(agentId));
localStorage.setItem(getChatStorageKey(agentId), JSON.stringify(messages));

// AFTER: API-based chat management
const sessions = await apiClient.getChatSessions();
const session = await apiClient.createChatSession(agentId, sessionName);
const messages = await apiClient.getSessionMessages(sessionId);
await apiClient.addMessageToSession(sessionId, messageData);
```

### Phase 5: User Preferences & Settings

**Target Files:**
- `/src/app/components/layout/DashboardHeader.tsx`
- `/src/features/settings/pages/SettingsPage.tsx`

**Changes:**
```typescript
// BEFORE: localStorage preferences
localStorage.setItem('theme', newTheme);
const stored = localStorage.getItem(storageKey);

// AFTER: API-based preferences
const preferences = await apiClient.getUserPreferences();
await apiClient.updateUserPreferences({ theme: newTheme });
```

### Phase 6: MCP Server Configuration

**Target Files:**
- `/src/features/settings/components/McpServerConnection.tsx`
- `/src/features/mcp/components/McpServersPage.tsx`

**Changes:**
```typescript
// BEFORE: localStorage MCP server storage
const stored = localStorage.getItem(`tenant_mcp_servers_${tenantId}`);
localStorage.setItem(storageKey, JSON.stringify(updatedServers));

// AFTER: API-based MCP management (use existing MCP API)
const servers = await apiClient.get('/mcp/tenant-servers');
await apiClient.post('/mcp/tenant-servers', serverConfig);
```

## 4. REACT HOOKS FOR API INTEGRATION

### Custom Hooks for Data Management

```typescript
// /src/hooks/useAgents.ts
export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAgents();
      setAgents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createAgent = useCallback(async (agentData: CreateAgentRequest) => {
    const newAgent = await apiClient.createAgent(agentData);
    setAgents(prev => [...prev, newAgent]);
    return newAgent;
  }, []);

  // ... other CRUD operations

  return {
    agents,
    loading,
    error,
    loadAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    testAgent
  };
};

// Similar hooks for:
// - useLLMConfigs()
// - useChatSessions()  
// - useUserPreferences()
// - useTenantSettings()
```

### State Management Updates

```typescript
// /src/app/store/index.ts - Enhanced with API integration
interface AppState {
  auth: AuthState;
  agents: AgentsState;
  llmConfigs: LLMConfigsState;
  chatSessions: ChatSessionsState;
  preferences: PreferencesState;
}

// Replace localStorage-based state with API-based state
```

## 5. ERROR HANDLING & LOADING STATES

### Comprehensive Error Handling

```typescript
// /src/utils/errorHandler.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

export const handleApiError = (error: ApiError) => {
  switch (error.code) {
    case 'AUTH_REQUIRED':
      // Redirect to login
      break;
    case 'INSUFFICIENT_PERMISSIONS':
      // Show permission denied message
      break;
    case 'TENANT_NOT_FOUND':
      // Handle tenant access issues
      break;
    default:
      // Generic error handling
  }
};
```

### Loading States & UI Feedback

```typescript
// /src/components/ui/LoadingStates.tsx
export const AgentLoadingSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
      </div>
    ))}
  </div>
);

// Apply consistent loading states across all components
```

## 6. MIGRATION TIMELINE

### Week 1: Foundation
- ✅ Database schema deployment
- ✅ Backend API implementation  
- ✅ Enhanced API client service
- 🔄 Authentication system migration

### Week 2: Core Features
- 🔄 Agent management migration
- 🔄 LLM configuration migration  
- 🔄 Basic chat session migration

### Week 3: Advanced Features
- 🔄 Complete chat management
- 🔄 User preferences migration
- 🔄 MCP server integration

### Week 4: Polish & Testing
- 🔄 Error handling refinement
- 🔄 Performance optimization
- 🔄 Comprehensive testing
- 🔄 Documentation updates

## 7. TESTING STRATEGY

### Unit Tests
```typescript
// /src/services/__tests__/apiClient.test.ts
describe('ApiClient', () => {
  it('should handle agent CRUD operations', async () => {
    const agent = await apiClient.createAgent(mockAgentData);
    expect(agent.tenant_id).toBe(currentTenantId);
    
    const agents = await apiClient.getAgents();
    expect(agents).toContain(agent);
  });
});
```

### Integration Tests
```typescript
// /src/features/agents/__tests__/AgentsPage.integration.test.tsx
describe('AgentsPage Integration', () => {
  it('should load agents from API on mount', async () => {
    render(<AgentsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Risk Analysis Agent')).toBeInTheDocument();
    });
  });
});
```

### End-to-End Tests
```typescript
// /e2e/localStorage-migration.spec.ts
test('should persist agent configurations across sessions', async ({ page }) => {
  await page.goto('/agents');
  await page.click('[data-testid="create-agent"]');
  // ... create agent
  
  // Refresh page - data should persist via API, not localStorage
  await page.reload();
  await expect(page.locator('[data-testid="agent-card"]')).toBeVisible();
});
```

## 8. PERFORMANCE CONSIDERATIONS

### Caching Strategy
```typescript
// /src/services/cache.ts
class ApiCache {
  private cache = new Map();
  private ttl = 5 * 60 * 1000; // 5 minutes

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }
}
```

### Optimistic Updates
```typescript
// /src/hooks/useOptimisticUpdates.ts
export const useOptimisticAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);

  const createAgent = async (agentData: CreateAgentRequest) => {
    // Optimistically add to UI immediately
    const optimisticAgent = { ...agentData, id: 'temp-' + Date.now() };
    setAgents(prev => [...prev, optimisticAgent]);

    try {
      // Make API call
      const realAgent = await apiClient.createAgent(agentData);
      
      // Replace optimistic update with real data
      setAgents(prev => prev.map(a => 
        a.id === optimisticAgent.id ? realAgent : a
      ));
    } catch (error) {
      // Rollback optimistic update
      setAgents(prev => prev.filter(a => a.id !== optimisticAgent.id));
      throw error;
    }
  };
};
```

## 9. SECURITY ENHANCEMENTS

### Request Signing & Validation
```typescript
// /src/services/security.ts
export const signRequest = (request: RequestData, tenantId: string): string => {
  // Implement request signing for audit trails
  // Includes tenant ID validation, timestamp, and signature
};

export const validateResponse = (response: any): boolean => {
  // Validate response integrity and tenant isolation
};
```

### Tenant Isolation Validation
```typescript
// /src/utils/tenantValidation.ts
export const validateTenantAccess = (data: any, expectedTenantId: string): boolean => {
  // Ensure all returned data belongs to the correct tenant
  return data.every(item => item.tenant_id === expectedTenantId);
};
```

## 10. ROLLBACK STRATEGY

### Gradual Migration with Feature Flags
```typescript
// /src/config/features.ts
export const FEATURE_FLAGS = {
  USE_API_AGENTS: process.env.REACT_APP_USE_API_AGENTS === 'true',
  USE_API_CHAT: process.env.REACT_APP_USE_API_CHAT === 'true',
  USE_API_PREFERENCES: process.env.REACT_APP_USE_API_PREFERENCES === 'true',
};

// Allow gradual rollout and quick rollback if issues occur
```

### Data Backup & Recovery
```typescript
// /src/utils/migration.ts
export const backupLocalStorageData = (): LocalStorageBackup => {
  // Create backup of all localStorage data before migration
  // Stored in backend for recovery purposes
};

export const restoreFromBackup = (backup: LocalStorageBackup): void => {
  // Restore localStorage data if rollback is needed
};
```

This comprehensive refactoring plan ensures a smooth migration from localStorage to a secure, multi-tenant API architecture while maintaining all existing functionality and improving the overall robustness of the platform.