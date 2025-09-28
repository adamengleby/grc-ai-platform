/**
 * MCP Tool Progress Indicator
 * Shows real-time progress for MCP tool execution with SSE streaming
 */

import { clsx } from 'clsx';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock,
  Activity,
  Zap
} from 'lucide-react';
import { MCPToolCall } from '@/hooks/useMCPSSE';

interface MCPToolProgressProps {
  toolCall: MCPToolCall;
  compact?: boolean;
  showDetails?: boolean;
}

export function MCPToolProgress({ 
  toolCall, 
  compact = false, 
  showDetails = true 
}: MCPToolProgressProps) {
  const { tool, status, progress, startTime, endTime, progressUpdates, error } = toolCall;
  
  const duration = endTime 
    ? Math.round((endTime.getTime() - startTime.getTime()) / 1000)
    : Math.round((Date.now() - startTime.getTime()) / 1000);

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-700';
      case 'running':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  if (compact) {
    return (
      <div className={clsx(
        'flex items-center gap-2 px-2 py-1 rounded-full text-xs border',
        getStatusColor()
      )}>
        {getStatusIcon()}
        <span className="font-medium">{tool}</span>
        {progress && progress > 0 && (
          <span className="text-xs opacity-75">{Math.round(progress)}%</span>
        )}
        <span className="text-xs opacity-60">{duration}s</span>
      </div>
    );
  }

  return (
    <div className={clsx(
      'p-3 rounded-lg border transition-all duration-300',
      getStatusColor()
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        {getStatusIcon()}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{tool}</h4>
            <div className="flex items-center gap-2 text-xs opacity-75">
              <Zap className="w-3 h-3" />
              <span>{duration}s</span>
            </div>
          </div>
          
          {/* Progress Bar */}
          {status === 'running' && progress !== undefined && (
            <div className="mt-1">
              <div className="w-full bg-white/50 rounded-full h-1.5">
                <div 
                  className="bg-current rounded-full h-1.5 transition-all duration-300"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>
              <div className="text-xs mt-1 opacity-75">
                {Math.round(progress)}% complete
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {status === 'error' && error && (
        <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Progress Updates */}
      {showDetails && progressUpdates.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-xs font-medium opacity-75">Progress Updates:</div>
          <div className="max-h-20 overflow-y-auto space-y-1">
            {progressUpdates.slice(-3).map((update, idx) => (
              <div key={idx} className="text-xs opacity-75 flex items-center gap-2">
                <div className="w-1 h-1 bg-current rounded-full" />
                <span>{update.status}</span>
                {update.progress > 0 && (
                  <span className="ml-auto">{Math.round(update.progress)}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Message */}
      {status === 'completed' && (
        <div className="mt-2 text-xs opacity-75">
          ✨ Completed successfully in {duration} seconds
        </div>
      )}
    </div>
  );
}

interface MCPToolProgressListProps {
  toolCalls: MCPToolCall[];
  title?: string;
  compact?: boolean;
  maxVisible?: number;
}

export function MCPToolProgressList({ 
  toolCalls, 
  title = "Active Tools",
  compact = false,
  maxVisible = 5
}: MCPToolProgressListProps) {
  if (toolCalls.length === 0) {
    return null;
  }

  const visibleCalls = toolCalls
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    .slice(0, maxVisible);

  return (
    <div className="space-y-2">
      {title && (
        <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {title}
          <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
            {toolCalls.length}
          </span>
        </div>
      )}
      
      <div className="space-y-2">
        {visibleCalls.map((toolCall) => (
          <MCPToolProgress
            key={toolCall.id}
            toolCall={toolCall}
            compact={compact}
            showDetails={!compact}
          />
        ))}
      </div>

      {toolCalls.length > maxVisible && (
        <div className="text-xs text-gray-500 text-center py-1">
          +{toolCalls.length - maxVisible} more tools running...
        </div>
      )}
    </div>
  );
}