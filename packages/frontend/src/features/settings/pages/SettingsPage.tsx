import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/app/store/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/Tabs';
import { Badge } from '@/app/components/ui/Badge';
import { Alert } from '@/app/components/ui/Alert';
import {
  Settings,
  Brain,
  Shield,
  Server,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database
} from 'lucide-react';

// Components for each tab
import LLMConfigSection from '@/features/settings/components/LLMConfigSection';
import MCPServerConfig from '@/features/settings/components/McpServerConnection';
import FunctionalPrivacyConfig from '@/features/settings/components/FunctionalPrivacyConfig';
import AdvancedConfig from '@/features/settings/components/AdvancedConfig';

// MCP Bridge for production-ready configuration sync
import { mcpBridge } from '@/lib/mcpBridge';

export interface MCPPrivacyConfig {
  // Privacy Protection
  enablePrivacyMasking: boolean;
  maskingLevel: 'light' | 'moderate' | 'strict';
  enableTokenization: boolean;
  customSensitiveFields: string[];
  privacyKey?: string;
  
  // MCP Server Settings
  enabledMcpServers: string[];
  mcpServerEndpoints: Record<string, string>;
  mcpToolAllowlist: Record<string, string[]>;
  
  // Performance
  pageSize: number;
  requestTimeout: number;
  maxRetries: number;
  enableCaching: boolean;
  enableBackgroundSync: boolean;
  
  // Tenant-specific
  tenantId: string;
  lastUpdated: string;
  isActive: boolean;
}

const getDefaultMCPPrivacyConfig = (tenantId: string): MCPPrivacyConfig => ({
  enablePrivacyMasking: true,
  maskingLevel: 'moderate',
  enableTokenization: false,
  customSensitiveFields: [],
  enabledMcpServers: [],
  mcpServerEndpoints: {
    'archer-grc': 'http://localhost:3005',
  },
  mcpToolAllowlist: {},
  pageSize: 50,
  requestTimeout: 30,
  maxRetries: 3,
  enableCaching: true,
  enableBackgroundSync: true,
  tenantId,
  lastUpdated: new Date().toISOString(),
  isActive: true,
});

export default function SettingsPage() {
  const { user, tenant } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'llm';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [mcpPrivacyConfig, setMcpPrivacyConfig] = useState<MCPPrivacyConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Check if user has permission to modify settings
  const canModifySettings = user?.roles?.includes('TenantOwner') || false;

  // Load MCP Privacy configuration for current tenant
  useEffect(() => {
    if (!tenant) return;

    const storageKey = `mcp_privacy_config_${tenant.id}`;
    const stored = localStorage.getItem(storageKey);
    
    try {
      const config = stored ? JSON.parse(stored) : getDefaultMCPPrivacyConfig(tenant.id);
      setMcpPrivacyConfig(config);
    } catch (error) {
      console.error('Error loading MCP Privacy config:', error);
      setMcpPrivacyConfig(getDefaultMCPPrivacyConfig(tenant.id));
    }
    
    setIsLoading(false);
  }, [tenant]);

  // Save MCP Privacy configuration with bridge sync
  const saveMCPPrivacyConfig = async (config: MCPPrivacyConfig) => {
    if (!tenant || !canModifySettings) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const updatedConfig = {
        ...config,
        tenantId: tenant.id,
        lastUpdated: new Date().toISOString(),
      };

      // Save to localStorage (will be database in production)
      const storageKey = `mcp_privacy_config_${tenant.id}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedConfig));
      
      // Update local state
      setMcpPrivacyConfig(updatedConfig);
      
      // 🔄 NEW: Sync configuration to MCP server via bridge
      const syncSuccess = await mcpBridge.syncSettingsToMcpServer(tenant.id);
      
      if (syncSuccess) {
        setSaveMessage({ 
          type: 'success', 
          message: 'Settings saved and synced to MCP server successfully' 
        });
      } else {
        setSaveMessage({ 
          type: 'error', 
          message: 'Settings saved locally but failed to sync to MCP server' 
        });
      }
      
      // Clear message after 5 seconds (longer since we're showing sync status)
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (error) {
      console.error('Error saving MCP Privacy config:', error);
      setSaveMessage({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <Alert className="max-w-2xl mx-auto mt-8">
        <AlertTriangle className="h-4 w-4" />
        Please select a tenant to manage settings.
      </Alert>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <Settings className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>
        <p className="text-gray-600">
          Configure MCP servers, privacy protection, and AI model settings for{' '}
          <span className="font-semibold">{tenant.name}</span>
        </p>
        
        {!canModifySettings && (
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            You have read-only access to these settings. Contact your tenant owner to make changes.
          </Alert>
        )}
      </div>

      {/* Save Status Message */}
      {saveMessage && (
        <Alert className={`mb-6 ${saveMessage.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          {saveMessage.type === 'success' ? 
            <CheckCircle className="h-4 w-4 text-green-600" /> : 
            <AlertTriangle className="h-4 w-4 text-red-600" />
          }
          <span className={saveMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {saveMessage.message}
          </span>
          {isSaving && (
            <div className="flex items-center space-x-2 mt-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <span className="text-xs text-gray-600">Syncing to MCP server...</span>
            </div>
          )}
        </Alert>
      )}

      {/* Main Settings Tabs */}
      <Tabs value={activeTab} onValueChange={(tab) => {
        setActiveTab(tab);
        setSearchParams(tab === 'llm' ? {} : { tab });
      }} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="llm" className="flex items-center space-x-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">LLM Models</span>
            <span className="sm:hidden">LLM</span>
          </TabsTrigger>
          <TabsTrigger value="mcp" className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">MCP Servers</span>
            <span className="sm:hidden">MCP</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Privacy</span>
            <span className="sm:hidden">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Advanced</span>
            <span className="sm:hidden">Advanced</span>
          </TabsTrigger>
        </TabsList>

        {/* LLM Configuration Tab */}
        <TabsContent value="llm" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-blue-600" />
                <CardTitle>Language Model Configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <LLMConfigSection />
            </CardContent>
          </Card>
        </TabsContent>

        {/* MCP Servers Tab */}
        <TabsContent value="mcp" className="space-y-6">
          {mcpPrivacyConfig && (
            <MCPServerConfig
              config={mcpPrivacyConfig}
              onConfigChange={saveMCPPrivacyConfig}
              canModify={canModifySettings}
              isSaving={isSaving}
            />
          )}
        </TabsContent>

        {/* Privacy Protection Tab */}
        <TabsContent value="privacy" className="space-y-6">
          {tenant && (
            <FunctionalPrivacyConfig
              tenantId={tenant.id}
              userId={user?.id}
              scope="tenant"
              canModify={canModifySettings}
            />
          )}
        </TabsContent>

        {/* Advanced Settings Tab */}
        <TabsContent value="advanced" className="space-y-6">
          {mcpPrivacyConfig && (
            <AdvancedConfig
              config={mcpPrivacyConfig}
              onConfigChange={saveMCPPrivacyConfig}
              canModify={canModifySettings}
              isSaving={isSaving}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Configuration Summary Footer */}
      {mcpPrivacyConfig && (
        <Card className="mt-8 border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>Last updated: {new Date(mcpPrivacyConfig.lastUpdated).toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span>Tenant:</span>
                  <Badge variant="outline">{tenant.name}</Badge>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge 
                  variant={mcpPrivacyConfig.isActive ? "default" : "secondary"}
                  className={mcpPrivacyConfig.isActive ? "bg-green-100 text-green-800 border-green-200" : ""}
                >
                  {mcpPrivacyConfig.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Database className="h-3 w-3 mr-1" />
                  MCP Synced
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
