# MIGRATION STRATEGY: localStorage to Database

## CRITICAL DATA MIGRATION PLAN

This document outlines the comprehensive strategy for migrating existing localStorage data to the secure, multi-tenant database architecture without data loss.

## 1. MIGRATION OVERVIEW

### Current Data at Risk
- **Agent Configurations**: `ai_agents_${tenantId}` 
- **MCP Server Configs**: `tenant_mcp_servers_${tenantId}`
- **LLM Configurations**: `user_llm_configs_${tenantId}`
- **Chat Sessions**: `chat_session_${sessionId}`, `chat_session_${tenantId}_global`
- **User Preferences**: `theme`, `ui_preferences_${tenantId}`, various settings
- **Authentication Tokens**: `auth_token`, `current_tenant_id`

### Migration Approach: Zero-Downtime, Progressive Migration
1. **Pre-migration Phase**: Data discovery and backup
2. **Migration Phase**: Selective data transfer with validation
3. **Verification Phase**: Data integrity checks
4. **Switchover Phase**: API activation with localStorage fallback
5. **Cleanup Phase**: localStorage removal after confirmation

## 2. MIGRATION INFRASTRUCTURE

### Migration Service Backend

```typescript
// /packages/backend/src/services/migrationService.ts
export class LocalStorageMigrationService {
  /**
   * Extract and migrate localStorage data for a specific tenant/user
   */
  async migrateUserData(tenantId: string, userId: string, localStorageData: Record<string, string>): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedRecords: 0,
      errors: [],
      summary: {}
    };

    try {
      // 1. Migrate Agent Configurations
      await this.migrateAgentConfigs(tenantId, userId, localStorageData, result);
      
      // 2. Migrate LLM Configurations
      await this.migrateLLMConfigs(tenantId, userId, localStorageData, result);
      
      // 3. Migrate Chat Sessions
      await this.migrateChatSessions(tenantId, userId, localStorageData, result);
      
      // 4. Migrate User Preferences
      await this.migrateUserPreferences(tenantId, userId, localStorageData, result);
      
      // 5. Log migration completion
      await this.logMigrationResult(tenantId, userId, result);
      
      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error.message}`);
      return result;
    }
  }

  private async migrateAgentConfigs(tenantId: string, userId: string, localStorage: Record<string, string>, result: MigrationResult) {
    const agentKey = `ai_agents_${tenantId}`;
    const agentData = localStorage[agentKey];
    
    if (agentData) {
      try {
        const agents = JSON.parse(agentData);
        
        for (const agent of agents) {
          // Convert localStorage agent to database schema
          const dbAgent = this.convertAgentToDbSchema(agent, tenantId, userId);
          
          // Insert into database
          await this.insertAgent(dbAgent);
          result.migratedRecords++;
        }
        
        result.summary.agents = agents.length;
        console.log(`[Migration] Migrated ${agents.length} agents for tenant ${tenantId}`);
      } catch (error) {
        result.errors.push(`Agent migration error: ${error.message}`);
      }
    }
  }

  private async migrateLLMConfigs(tenantId: string, userId: string, localStorage: Record<string, string>, result: MigrationResult) {
    const llmKey = `user_llm_configs_${tenantId}`;
    const llmData = localStorage[llmKey];
    
    if (llmData) {
      try {
        const configs = JSON.parse(llmData);
        
        for (const config of configs) {
          // Convert localStorage config to database schema with Key Vault integration
          const dbConfig = this.convertLLMConfigToDbSchema(config, tenantId, userId);
          
          // Store secrets in Key Vault and get references
          if (config.apiKey) {
            dbConfig.api_key_vault_secret = await this.storeSecretInKeyVault(tenantId, config.apiKey);
          }
          if (config.endpoint) {
            dbConfig.endpoint_vault_secret = await this.storeSecretInKeyVault(tenantId, config.endpoint);
          }
          
          // Insert into database
          await this.insertLLMConfig(dbConfig);
          result.migratedRecords++;
        }
        
        result.summary.llm_configs = configs.length;
        console.log(`[Migration] Migrated ${configs.length} LLM configs for tenant ${tenantId}`);
      } catch (error) {
        result.errors.push(`LLM config migration error: ${error.message}`);
      }
    }
  }

  private async migrateChatSessions(tenantId: string, userId: string, localStorage: Record<string, string>, result: MigrationResult) {
    let sessionCount = 0;
    let messageCount = 0;
    
    // Find all chat session keys
    const chatKeys = Object.keys(localStorage).filter(key => key.startsWith('chat_session_'));
    
    for (const key of chatKeys) {
      try {
        const chatData = JSON.parse(localStorage[key]);
        
        // Extract agent ID and session info from key
        const sessionInfo = this.parseChatSessionKey(key, tenantId);
        
        // Create chat session in database
        const sessionId = await this.createChatSession(tenantId, userId, sessionInfo.agentId, sessionInfo.sessionName);
        
        // Migrate messages if present
        if (Array.isArray(chatData)) {
          for (let i = 0; i < chatData.length; i++) {
            const message = chatData[i];
            await this.insertChatMessage({
              session_id: sessionId,
              tenant_id: tenantId,
              role: message.role || 'user',
              content: message.content || message.message,
              sequence_number: i + 1,
              created_at: message.timestamp ? new Date(message.timestamp) : new Date()
            });
            messageCount++;
          }
        }
        
        sessionCount++;
        result.migratedRecords++;
      } catch (error) {
        result.errors.push(`Chat session migration error for ${key}: ${error.message}`);
      }
    }
    
    result.summary.chat_sessions = sessionCount;
    result.summary.chat_messages = messageCount;
    console.log(`[Migration] Migrated ${sessionCount} chat sessions with ${messageCount} messages`);
  }

  private async migrateUserPreferences(tenantId: string, userId: string, localStorage: Record<string, string>, result: MigrationResult) {
    const preferences = {
      theme: localStorage.theme || 'light',
      ui_preferences: {},
      notification_preferences: {},
      privacy_settings: {},
      advanced_settings: {}
    };

    // Extract various preference keys
    Object.keys(localStorage).forEach(key => {
      if (key.includes('_preferences_') || key.includes('_settings_')) {
        try {
          const data = JSON.parse(localStorage[key]);
          if (key.includes('ui_preferences')) {
            preferences.ui_preferences = { ...preferences.ui_preferences, ...data };
          } else if (key.includes('notification')) {
            preferences.notification_preferences = { ...preferences.notification_preferences, ...data };
          } else if (key.includes('privacy')) {
            preferences.privacy_settings = { ...preferences.privacy_settings, ...data };
          } else {
            preferences.advanced_settings = { ...preferences.advanced_settings, ...data };
          }
        } catch (error) {
          console.warn(`[Migration] Could not parse preference key ${key}:`, error);
        }
      }
    });

    // Insert preferences into database
    await this.insertUserPreferences(tenantId, userId, preferences);
    result.migratedRecords++;
    result.summary.preferences = 1;
    console.log(`[Migration] Migrated user preferences for user ${userId}`);
  }
}
```

### Migration API Endpoint

```typescript
// /packages/backend/src/routes/migration.ts
router.post('/migrate-localstorage',
  authMiddleware,
  tenantIsolationMiddleware,
  [
    body('localStorage_data').isObject().withMessage('localStorage data required'),
    body('backup_requested').optional().isBoolean().withMessage('backup_requested must be boolean')
  ],
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const { localStorage_data, backup_requested } = req.body;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check if user has already migrated
      const existingMigration = await MigrationService.checkMigrationStatus(tenantId, userId);
      if (existingMigration?.status === 'completed') {
        return res.status(409).json({
          error: 'Migration already completed',
          code: 'ALREADY_MIGRATED',
          migration_date: existingMigration.completed_at
        });
      }

      // Create backup if requested
      if (backup_requested) {
        await MigrationService.createDataBackup(tenantId, userId, localStorage_data);
      }

      // Perform migration
      const result = await LocalStorageMigrationService.migrateUserData(tenantId, userId, localStorage_data);

      res.json({
        success: result.success,
        data: result,
        message: result.success ? 'Migration completed successfully' : 'Migration completed with errors'
      });
    } catch (error) {
      console.error('[Migration API] Error:', error);
      res.status(500).json({ 
        error: 'Migration failed',
        code: 'MIGRATION_ERROR'
      });
    }
  }
);
```

## 3. FRONTEND MIGRATION ORCHESTRATION

### Migration Detection and Trigger

```typescript
// /packages/frontend/src/services/migrationOrchestrator.ts
export class MigrationOrchestrator {
  /**
   * Check if user needs migration on app startup
   */
  static async checkMigrationNeeded(): Promise<boolean> {
    // Check if localStorage has data but user hasn't migrated yet
    const hasLocalStorageData = this.hasRelevantLocalStorageData();
    
    if (!hasLocalStorageData) {
      return false;
    }

    // Check backend migration status
    try {
      const response = await apiClient.get('/migration/status');
      return response.data.migration_status !== 'completed';
    } catch (error) {
      console.warn('[Migration] Could not check migration status:', error);
      return true; // Assume migration needed if we can't check
    }
  }

  /**
   * Execute migration with user consent
   */
  static async executeMigration(includeBackup: boolean = true): Promise<MigrationResult> {
    try {
      // Collect all localStorage data
      const localStorageData = this.collectLocalStorageData();
      
      // Send to backend for migration
      const response = await apiClient.post('/migration/migrate-localstorage', {
        localStorage_data: localStorageData,
        backup_requested: includeBackup
      });

      if (response.data.success) {
        // Mark migration as completed locally
        localStorage.setItem('migration_completed', 'true');
        localStorage.setItem('migration_date', new Date().toISOString());
        
        console.log('[Migration] Successfully migrated localStorage data to database');
      }

      return response.data.data;
    } catch (error) {
      console.error('[Migration] Migration failed:', error);
      throw error;
    }
  }

  /**
   * Collect all relevant localStorage data
   */
  private static collectLocalStorageData(): Record<string, string> {
    const relevantKeys = [
      // Agent configurations
      ...Object.keys(localStorage).filter(key => key.startsWith('ai_agents_')),
      
      // MCP server configurations  
      ...Object.keys(localStorage).filter(key => key.startsWith('tenant_mcp_servers_')),
      
      // LLM configurations
      ...Object.keys(localStorage).filter(key => key.startsWith('user_llm_configs_')),
      
      // Chat sessions
      ...Object.keys(localStorage).filter(key => key.startsWith('chat_session_')),
      
      // User preferences
      'theme',
      ...Object.keys(localStorage).filter(key => 
        key.includes('_preferences_') || 
        key.includes('_settings_') ||
        key === 'current_tenant_id'
      )
    ];

    const data: Record<string, string> = {};
    relevantKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    });

    return data;
  }

  /**
   * Check if localStorage contains data that needs migration
   */
  private static hasRelevantLocalStorageData(): boolean {
    const checkKeys = [
      'ai_agents_',
      'user_llm_configs_', 
      'tenant_mcp_servers_',
      'chat_session_',
      'theme'
    ];

    return checkKeys.some(prefix => 
      Object.keys(localStorage).some(key => key.startsWith(prefix))
    );
  }
}
```

### Migration UI Component

```typescript
// /packages/frontend/src/components/migration/MigrationModal.tsx
export const MigrationModal: React.FC = () => {
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [migrationInProgress, setMigrationInProgress] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkMigrationStatus();
  }, []);

  const checkMigrationStatus = async () => {
    try {
      const needed = await MigrationOrchestrator.checkMigrationNeeded();
      setMigrationNeeded(needed);
    } catch (error) {
      console.error('[Migration UI] Error checking status:', error);
    }
  };

  const handleMigrate = async (includeBackup: boolean = true) => {
    try {
      setMigrationInProgress(true);
      const result = await MigrationOrchestrator.executeMigration(includeBackup);
      setMigrationResult(result);
      
      if (result.success) {
        setMigrationNeeded(false);
        // Refresh app to use API data
        window.location.reload();
      }
    } catch (error) {
      console.error('[Migration UI] Migration failed:', error);
      setMigrationResult({
        success: false,
        migratedRecords: 0,
        errors: [error.message],
        summary: {}
      });
    } finally {
      setMigrationInProgress(false);
    }
  };

  const handleSkip = () => {
    // Allow user to continue without migration (with warning)
    localStorage.setItem('migration_skipped', 'true');
    setMigrationNeeded(false);
  };

  if (!migrationNeeded) {
    return null;
  }

  return (
    <Dialog open={migrationNeeded} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px]" closeButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Data Migration Required
          </DialogTitle>
          <DialogDescription>
            We've upgraded our platform with improved security and multi-tenant features. 
            Your existing configurations need to be migrated to the new system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900">What will be migrated?</h4>
            <ul className="mt-2 text-sm text-blue-800 space-y-1">
              <li>• AI Agent configurations and settings</li>
              <li>• LLM provider configurations (with secure key storage)</li>
              <li>• Chat history and conversation sessions</li>
              <li>• User preferences and theme settings</li>
              <li>• MCP server configurations</li>
            </ul>
          </div>

          {migrationResult && (
            <div className={`rounded-lg p-4 ${migrationResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between">
                <h4 className={`font-semibold ${migrationResult.success ? 'text-green-900' : 'text-red-900'}`}>
                  {migrationResult.success ? '✅ Migration Completed' : '❌ Migration Failed'}
                </h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? 'Hide' : 'Show'} Details
                </Button>
              </div>
              
              {showDetails && (
                <div className="mt-3 text-sm">
                  <p>Records migrated: {migrationResult.migratedRecords}</p>
                  {migrationResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold">Errors:</p>
                      <ul className="list-disc list-inside">
                        {migrationResult.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {JSON.stringify(migrationResult.summary, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={() => handleMigrate(true)} 
            disabled={migrationInProgress}
            className="flex-1"
          >
            {migrationInProgress ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrating...
              </>
            ) : (
              'Migrate Now (Recommended)'
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleSkip}
            disabled={migrationInProgress}
          >
            Skip for Now
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          Your data will be backed up during migration. This is a one-time process and ensures 
          your configurations are securely stored and accessible across all devices.
        </p>
      </DialogContent>
    </Dialog>
  );
};
```

## 4. MIGRATION PHASES & ROLLOUT

### Phase 1: Infrastructure Preparation (Week 1)
- ✅ Database schema deployment
- ✅ Backend migration services
- 🔄 Migration API endpoints
- 🔄 Frontend migration orchestrator

### Phase 2: Selective Beta Testing (Week 2)
- 🔄 Deploy to staging environment
- 🔄 Test with synthetic localStorage data
- 🔄 Validate tenant isolation
- 🔄 Performance testing

### Phase 3: Limited Production Rollout (Week 3)
- 🔄 Deploy migration infrastructure to production
- 🔄 Enable migration for specific tenants
- 🔄 Monitor migration success rates
- 🔄 Collect feedback and iterate

### Phase 4: Full Migration Activation (Week 4)
- 🔄 Enable migration modal for all users
- 🔄 Support automatic migration on login
- 🔄 Monitor system performance
- 🔄 Handle edge cases and errors

### Phase 5: Cleanup (Week 5)
- 🔄 Remove localStorage fallback code
- 🔄 Clean up migration-related UI
- 🔄 Archive migration logs
- 🔄 Update documentation

## 5. MONITORING & VALIDATION

### Migration Metrics Dashboard

```typescript
// /packages/backend/src/services/migrationMetrics.ts
export class MigrationMetrics {
  static async getMigrationStats(): Promise<MigrationDashboard> {
    // SQL queries to aggregate migration data
    const stats = {
      total_users: await this.countTotalUsers(),
      users_migrated: await this.countMigratedUsers(),
      migration_success_rate: await this.calculateSuccessRate(),
      
      records_by_type: {
        agents: await this.countMigratedRecords('agents'),
        llm_configs: await this.countMigratedRecords('llm_configs'),
        chat_sessions: await this.countMigratedRecords('chat_sessions'),
        preferences: await this.countMigratedRecords('preferences')
      },
      
      error_breakdown: await this.getMigrationErrors(),
      
      performance_metrics: {
        average_migration_time: await this.getAverageMigrationTime(),
        peak_migration_load: await this.getPeakMigrationLoad()
      }
    };

    return stats;
  }
}
```

### Data Validation Checks

```typescript
// /packages/backend/src/services/migrationValidation.ts
export class MigrationValidation {
  /**
   * Validate migrated data integrity
   */
  static async validateMigrationIntegrity(tenantId: string, userId: string): Promise<ValidationReport> {
    const report: ValidationReport = {
      success: true,
      checks_performed: [],
      issues_found: []
    };

    // 1. Validate agent configurations
    await this.validateAgentMigration(tenantId, userId, report);
    
    // 2. Validate LLM configurations
    await this.validateLLMConfigMigration(tenantId, userId, report);
    
    // 3. Validate chat session data
    await this.validateChatSessionMigration(tenantId, userId, report);
    
    // 4. Validate tenant isolation
    await this.validateTenantIsolation(tenantId, report);

    return report;
  }

  private static async validateTenantIsolation(tenantId: string, report: ValidationReport) {
    // Ensure no cross-tenant data contamination occurred
    const crossTenantData = await this.findCrossTenantData(tenantId);
    
    if (crossTenantData.length > 0) {
      report.success = false;
      report.issues_found.push({
        type: 'TENANT_ISOLATION_VIOLATION',
        description: 'Found data belonging to other tenants',
        data: crossTenantData
      });
    }
  }
}
```

## 6. ROLLBACK PROCEDURES

### Emergency Rollback Plan

```typescript
// /packages/backend/src/services/rollbackService.ts
export class RollbackService {
  /**
   * Emergency rollback to localStorage for specific tenant
   */
  static async emergencyRollback(tenantId: string): Promise<RollbackResult> {
    try {
      console.warn(`[ROLLBACK] Emergency rollback initiated for tenant ${tenantId}`);
      
      // 1. Disable API endpoints for this tenant
      await this.disableApiForTenant(tenantId);
      
      // 2. Export current database data back to localStorage format
      const localStorageData = await this.exportToLocalStorageFormat(tenantId);
      
      // 3. Create rollback package for frontend
      const rollbackPackage = {
        tenant_id: tenantId,
        rollback_data: localStorageData,
        rollback_reason: 'EMERGENCY_ROLLBACK',
        created_at: new Date()
      };
      
      // 4. Notify affected users
      await this.notifyUsersOfRollback(tenantId);
      
      return {
        success: true,
        rollback_package: rollbackPackage,
        affected_users: await this.getTenantUsers(tenantId)
      };
    } catch (error) {
      console.error('[ROLLBACK] Emergency rollback failed:', error);
      throw error;
    }
  }
}
```

### Frontend Rollback Handler

```typescript
// /packages/frontend/src/services/rollbackHandler.ts
export class RollbackHandler {
  /**
   * Handle rollback notification from backend
   */
  static async handleRollback(rollbackPackage: RollbackPackage): Promise<void> {
    try {
      console.warn('[ROLLBACK] Processing rollback package');
      
      // 1. Clear current API-based state
      await this.clearApiCache();
      
      // 2. Restore localStorage data
      Object.entries(rollbackPackage.rollback_data).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      // 3. Switch back to localStorage mode
      localStorage.setItem('use_localstorage_fallback', 'true');
      localStorage.setItem('rollback_active', 'true');
      
      // 4. Reload application
      window.location.reload();
    } catch (error) {
      console.error('[ROLLBACK] Rollback processing failed:', error);
      throw error;
    }
  }
}
```

## 7. SUCCESS CRITERIA & METRICS

### Migration Success Metrics
- **Completion Rate**: >95% of users successfully migrate within 30 days
- **Data Integrity**: 100% data preservation with zero data loss
- **Performance**: Migration completes in <30 seconds for typical users
- **Error Rate**: <2% migration attempts result in errors
- **User Satisfaction**: >90% user approval in post-migration survey

### System Health Metrics
- **API Response Time**: <500ms for typical data retrieval
- **Database Performance**: <100ms query execution time
- **Tenant Isolation**: 100% validation of tenant data boundaries
- **Security Audit**: Zero security vulnerabilities introduced
- **Backup Success**: 100% backup creation success rate

## 8. COMMUNICATION PLAN

### User Communication Timeline

**3 weeks before migration:**
- Email announcement about upcoming improvements
- In-app notification about planned migration
- Documentation and FAQ updates

**1 week before migration:**
- Detailed migration guide emails
- In-app migration preparation checklist
- Support team training completion

**Migration day:**
- Migration modal appears for users
- Live support chat available
- Real-time migration status updates

**Post-migration:**
- Success confirmation emails
- Performance improvement metrics sharing
- Feedback collection and analysis

This comprehensive migration strategy ensures zero data loss while transitioning users to the secure, multi-tenant database architecture, maintaining business continuity throughout the process.