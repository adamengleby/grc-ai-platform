/**
 * MCP SSE Demo Component
 * Demonstrates how to integrate the new MCP SSE streaming capabilities
 * Can be added to existing chat interfaces for real-time tool execution
 */

import { useState, useCallback } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Alert } from '@/app/components/ui/Alert';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  Activity,
  Zap,
  Settings
} from 'lucide-react';
import { useMCPSSE } from '@/hooks/useMCPSSE';
import { MCPToolProgressList } from '@/components/ui/MCPToolProgress';
import { clsx } from 'clsx';

interface MCPSSEDemoProps {
  className?: string;
  onResult?: (tool: string, result: any) => void;
}

export function MCPSSEDemo({ className, onResult }: MCPSSEDemoProps) {
  const [selectedTool, setSelectedTool] = useState('test_archer_connection');
  const [customArgs, setCustomArgs] = useState('{}');
  const [lastResult, setLastResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const {
    isConnected,
    connectionError,
    sessionInfo,
    callTool,
    activeCalls,
    connect,
    disconnect,
    health,
    serverStatus,
    refreshStatus
  } = useMCPSSE();

  const demoTools = [
    {
      name: 'test_archer_connection',
      description: 'Test Archer GRC connection',
      args: { tenant_id: 'demo-tenant' }
    },
    {
      name: 'get_archer_applications',
      description: 'List Archer applications',
      args: {}
    },
    {
      name: 'get_archer_stats',
      description: 'Get Archer statistics',
      args: { tenant_id: 'demo-tenant' }
    },
    {
      name: 'get_user_roles',
      description: 'List user roles',
      args: {}
    },
    {
      name: 'get_archer_users',
      description: 'List Archer users',
      args: { pageSize: 10 }
    }
  ];

  const handleToolExecution = useCallback(async () => {
    if (!selectedTool || isExecuting) return;

    setIsExecuting(true);
    setLastResult(null);

    try {
      let args: any;
      try {
        args = JSON.parse(customArgs);
      } catch {
        args = demoTools.find(t => t.name === selectedTool)?.args || {};
      }

      console.log(`[MCP SSE Demo] Executing ${selectedTool} with args:`, args);

      const result = await callTool(selectedTool, args, {
        timeout: 30000
      });

      setLastResult(result);
      onResult?.(selectedTool, result);
      
      console.log(`[MCP SSE Demo] Tool completed:`, result);

    } catch (error: any) {
      console.error('[MCP SSE Demo] Tool execution failed:', error);
      setLastResult({ error: error.message });
    } finally {
      setIsExecuting(false);
    }
  }, [selectedTool, customArgs, callTool, isExecuting, onResult]);

  const handleToolSelect = (tool: typeof demoTools[0]) => {
    setSelectedTool(tool.name);
    setCustomArgs(JSON.stringify(tool.args, null, 2));
  };

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Connection Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <h3 className="font-semibold">MCP SSE Connection</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshStatus}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            
            {isConnected ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={disconnect}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={connect}
              >
                Connect
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Status</div>
            <Badge variant={isConnected ? 'default' : 'destructive'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          
          {sessionInfo && (
            <div>
              <div className="text-gray-600">Session</div>
              <div className="font-mono text-xs truncate">
                {sessionInfo.sessionId.slice(-8)}
              </div>
            </div>
          )}
          
          {serverStatus && (
            <div>
              <div className="text-gray-600">Active Connections</div>
              <div className="font-semibold">
                {serverStatus.activeConnections?.length || 0}
              </div>
            </div>
          )}
          
          {health && (
            <div>
              <div className="text-gray-600">Health</div>
              <Badge variant={health.status === 'healthy' ? 'default' : 'destructive'}>
                {health.status}
              </Badge>
            </div>
          )}
        </div>

        {connectionError && (
          <Alert variant="destructive" className="mt-3">
            <strong>Connection Error:</strong> {connectionError}
          </Alert>
        )}
      </Card>

      {/* Tool Execution */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold">Tool Execution</h3>
        </div>

        <div className="space-y-3">
          {/* Tool Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Tool:</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {demoTools.map((tool) => (
                <button
                  key={tool.name}
                  onClick={() => handleToolSelect(tool)}
                  className={clsx(
                    'p-2 text-left border rounded-lg transition-colors',
                    selectedTool === tool.name
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="font-medium text-sm">{tool.name}</div>
                  <div className="text-xs text-gray-600 mt-1">{tool.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Arguments */}
          <div>
            <label className="block text-sm font-medium mb-2">Arguments (JSON):</label>
            <textarea
              value={customArgs}
              onChange={(e) => setCustomArgs(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm font-mono"
              rows={3}
              placeholder='{"key": "value"}'
            />
          </div>

          {/* Execute Button */}
          <Button
            onClick={handleToolExecution}
            disabled={!isConnected || isExecuting || !selectedTool}
            className="w-full"
          >
            {isExecuting ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Executing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Execute Tool
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Active Tool Calls */}
      {activeCalls.length > 0 && (
        <Card className="p-4">
          <MCPToolProgressList
            toolCalls={activeCalls}
            title="Live Tool Execution"
            maxVisible={3}
          />
        </Card>
      )}

      {/* Last Result */}
      {lastResult && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold">Last Result</h3>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3">
            <pre className="text-sm overflow-auto max-h-64">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2">
          <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">
              How to Integrate SSE Streaming
            </h4>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                <strong>1. Import the hook:</strong>{' '}
                <code className="bg-white px-2 py-1 rounded">
                  import &#123; useMCPSSE &#125; from '@/hooks/useMCPSSE'
                </code>
              </p>
              <p>
                <strong>2. Use in your component:</strong>{' '}
                <code className="bg-white px-2 py-1 rounded">
                  const &#123; callTool, activeCalls &#125; = useMCPSSE()
                </code>
              </p>
              <p>
                <strong>3. Add progress indicators:</strong>{' '}
                Show <code className="bg-white px-1 rounded">activeCalls</code> with{' '}
                <code className="bg-white px-1 rounded">MCPToolProgressList</code>
              </p>
              <p>
                <strong>4. Call tools with streaming:</strong>{' '}
                Use <code className="bg-white px-1 rounded">callTool(name, args)</code>{' '}
                for real-time progress updates
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default MCPSSEDemo;