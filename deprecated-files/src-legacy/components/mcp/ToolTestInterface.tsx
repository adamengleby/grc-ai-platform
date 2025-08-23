import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { 
  McpToolDefinition, 
  TenantMcpToolConfiguration, 
  McpToolExecutionResult 
} from '@/types/mcp';
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Zap
} from 'lucide-react';

interface ToolTestInterfaceProps {
  tool: McpToolDefinition;
  config: TenantMcpToolConfiguration;
  onExecute: (inputs: Record<string, any>) => Promise<McpToolExecutionResult>;
}

export const ToolTestInterface: React.FC<ToolTestInterfaceProps> = ({
  tool,
  onExecute
}) => {
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<McpToolExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (paramName: string, value: any) => {
    setInputs(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const executionResult = await onExecute(inputs);
      setResult(executionResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tool execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const renderInputField = (param: any) => {
    const { name, type, required, description } = param;
    
    switch (type) {
      case 'string':
        if (param.enum) {
          return (
            <div key={name} className="space-y-2">
              <label className="text-sm font-medium">
                {name} {required && <span className="text-red-500">*</span>}
              </label>
              <select
                value={inputs[name] || ''}
                onChange={(e) => handleInputChange(name, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={required}
              >
                <option value="">Select {name}</option>
                {param.enum.map((option: string) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          );
        } else {
          return (
            <div key={name} className="space-y-2">
              <label className="text-sm font-medium">
                {name} {required && <span className="text-red-500">*</span>}
              </label>
              <Input
                type="text"
                value={inputs[name] || ''}
                onChange={(e) => handleInputChange(name, e.target.value)}
                placeholder={`Enter ${name}`}
                required={required}
              />
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          );
        }
      
      case 'boolean':
        return (
          <div key={name} className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={inputs[name] || false}
                onChange={(e) => handleInputChange(name, e.target.checked)}
                className="rounded border-gray-300"
              />
              {name} {required && <span className="text-red-500">*</span>}
            </label>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        );
      
      default:
        return (
          <div key={name} className="space-y-2">
            <label className="text-sm font-medium">
              {name} {required && <span className="text-red-500">*</span>}
            </label>
            <Input
              type="text"
              value={inputs[name] || ''}
              onChange={(e) => handleInputChange(name, e.target.value)}
              placeholder={`Enter ${name}`}
              required={required}
            />
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        );
    }
  };

  // Check if all required parameters are filled
  const requiredParams = tool.documentation.parameters.filter(p => p.required);
  const allRequiredFilled = requiredParams.every(param => inputs[param.name]);

  return (
    <div className="space-y-4">
      {/* Tool Parameters Form */}
      <div className="space-y-4">
        {tool.documentation.parameters.map(renderInputField)}
      </div>

      {/* Execute Button */}
      <div className="flex gap-2">
        <Button
          onClick={handleExecute}
          disabled={isExecuting || !allRequiredFilled}
          className="flex items-center gap-2"
        >
          {isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isExecuting ? 'Executing...' : 'Execute Tool'}
        </Button>
        
        {!allRequiredFilled && (
          <p className="text-sm text-muted-foreground flex items-center">
            Please fill all required parameters
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <div>
            <h4>Execution Error</h4>
            <p>{error}</p>
          </div>
        </Alert>
      )}

      {/* Result Display */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <h4 className="font-medium">
              Execution {result.success ? 'Successful' : 'Failed'}
            </h4>
          </div>

          {/* Execution Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Duration</span>
              </div>
              <p className="text-lg font-bold">{result.usage.executionTimeMs}ms</p>
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">Input Tokens</span>
              </div>
              <p className="text-lg font-bold">{result.usage.inputTokens}</p>
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">Output Tokens</span>
              </div>
              <p className="text-lg font-bold">{result.usage.outputTokens}</p>
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Timestamp</span>
              <p className="text-sm text-muted-foreground">
                {new Date(result.metadata.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Result Content */}
          {result.success && result.result && (
            <div className="space-y-2">
              <h5 className="font-medium">Result:</h5>
              <div className="p-4 bg-muted rounded-lg">
                <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-96">
                  {typeof result.result === 'string' 
                    ? result.result 
                    : JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Error Content */}
          {!result.success && result.error && (
            <div className="space-y-2">
              <h5 className="font-medium text-red-600">Error Details:</h5>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{result.error}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};