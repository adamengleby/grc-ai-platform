/**
 * Backend Test Component
 * Tests the database integration and localStorage replacement
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Alert } from '@/app/components/ui/Alert';
import { createAgentService } from '@/lib/backendAgentService';
import { AIAgent } from '@/types/agent';

export const BackendTestComponent: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [testResults, setTestResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const agentService = createAgentService('demo-tenant');

  const testDatabaseConnection = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🧪 Testing database connection...');
      
      // Test connection
      const isConnected = await agentService.testConnection();
      setConnectionStatus(isConnected ? 'connected' : 'failed');
      
      if (isConnected) {
        console.log('✅ Database connection successful');
      } else {
        console.warn('⚠️ Database connection failed');
      }
      
      return isConnected;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      setConnectionStatus('failed');
      setError(error instanceof Error ? error.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loadAgentsFromDatabase = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('📚 Loading agents from database...');
      
      const loadedAgents = await agentService.getAgents();
      setAgents(loadedAgents);
      
      console.log('✅ Agents loaded from database:', loadedAgents);
      
      setTestResults({
        total_agents: loadedAgents.length,
        database_type: 'SQLite (development)',
        replacement_status: 'localStorage successfully replaced',
        last_tested: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to load agents from database:', error);
      setError(error instanceof Error ? error.message : 'Failed to load agents');
    } finally {
      setIsLoading(false);
    }
  };

  const createTestAgent = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('➕ Creating test agent in database...');
      
      const newAgent = await agentService.createAgent({
        name: `Test Agent ${Date.now()}`,
        description: 'Created via frontend database integration test',
        system_prompt: 'You are a test agent created to verify database integration.'
      });
      
      console.log('✅ Test agent created:', newAgent);
      
      // Reload agents to show the new one
      await loadAgentsFromDatabase();
      
    } catch (error) {
      console.error('❌ Failed to create test agent:', error);
      setError(error instanceof Error ? error.message : 'Failed to create agent');
    } finally {
      setIsLoading(false);
    }
  };

  const runFullTest = async () => {
    setIsLoading(true);
    
    try {
      // Test 1: Database connection
      const connected = await testDatabaseConnection();
      if (!connected) return;
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test 2: Load agents
      await loadAgentsFromDatabase();
      
    } catch (error) {
      console.error('Full test failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auto-run test on component mount
    runFullTest();
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-lg font-medium mb-4">🗄️ Database Integration Test</h3>
      
      <div className="mb-6">
        <div className={`flex items-center gap-2 mb-2 ${getStatusColor()}`}>
          <span>{getStatusIcon()}</span>
          <span className="font-medium">
            Database Status: {connectionStatus === 'unknown' ? 'Testing...' : 
                            connectionStatus === 'connected' ? 'Connected' : 'Failed'}
          </span>
        </div>
        
        {testResults && (
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
            <div><strong>Database Type:</strong> {testResults.database_type}</div>
            <div><strong>Status:</strong> {testResults.replacement_status}</div>
            <div><strong>Total Agents:</strong> {testResults.total_agents}</div>
            <div><strong>Last Tested:</strong> {new Date(testResults.last_tested).toLocaleTimeString()}</div>
          </div>
        )}
      </div>

      {error && (
        <Alert type="error" className="mb-4">
          <strong>Error:</strong> {error}
        </Alert>
      )}

      <div className="flex gap-2 mb-4">
        <Button 
          onClick={testDatabaseConnection}
          disabled={isLoading}
          variant="outline"
        >
          Test Connection
        </Button>
        <Button 
          onClick={loadAgentsFromDatabase}
          disabled={isLoading}
          variant="outline"
        >
          Load Agents
        </Button>
        <Button 
          onClick={createTestAgent}
          disabled={isLoading}
          variant="primary"
        >
          Create Test Agent
        </Button>
        <Button 
          onClick={runFullTest}
          disabled={isLoading}
          variant="secondary"
        >
          Run Full Test
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span>Testing database integration...</span>
          </div>
        </div>
      )}

      {agents.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Agents from Database ({agents.length}):</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {agents.map((agent, index) => (
              <div key={agent.agent_id || index} className="p-3 bg-gray-50 rounded border text-sm">
                <div className="font-medium">{agent.name}</div>
                <div className="text-gray-600">{agent.description}</div>
                <div className="text-xs text-gray-500 mt-1">
                  ID: {agent.agent_id} | Created: {agent.created_at ? new Date(agent.created_at).toLocaleString() : 'Unknown'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        🔄 This replaces localStorage completely with database storage
      </div>
    </div>
  );
};