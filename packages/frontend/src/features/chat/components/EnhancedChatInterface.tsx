import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Textarea } from '@/app/components/ui/Textarea';
import { Badge } from '@/app/components/ui/Badge';
import { Alert } from '@/app/components/ui/Alert';
import { Card } from '@/app/components/ui/Card';
import { EnhancedMarkdown } from '@/components/ui/EnhancedMarkdown';
import {
  Send,
  Upload,
  FileText,
  Image,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Trash2,
  Search,
  History,
  Download,
  Eye,
  Settings,
  Zap,
  Brain,
  Wrench as ToolIcon,
  FileIcon,
  X
} from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { clsx } from 'clsx';

interface EnhancedChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: Array<{
    name: string;
    size: number;
    type: string;
  }>;
  metadata?: {
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
  };
  isLoading?: boolean;
}

interface FileUploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

const EnhancedChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<EnhancedChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatHealth, setChatHealth] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat health on mount
  useEffect(() => {
    loadChatHealth();
    loadConversationHistory();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHealth = async () => {
    try {
      const health = await apiClient.getEnhancedChatHealth();
      setChatHealth(health);
    } catch (err) {
      console.error('Failed to load chat health:', err);
    }
  };

  const loadConversationHistory = async () => {
    try {
      const history = await apiClient.getEnhancedConversationHistory('mock-user-123', 20);
      setConversationHistory(history);
    } catch (err) {
      console.error('Failed to load conversation history:', err);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const searchMemory = async () => {
    if (!searchQuery.trim()) return;

    try {
      const results = await apiClient.searchEnhancedMemory(searchQuery, 5);
      setSearchResults(results.results);
    } catch (err) {
      console.error('Failed to search memory:', err);
      setError('Failed to search conversation history');
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && selectedFiles.length === 0) return;
    if (isLoading) return;

    const userMessage: EnhancedChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      files: selectedFiles.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      }))
    };

    const loadingMessage: EnhancedChatMessage = {
      id: `assistant-${Date.now()}`,
      type: 'assistant',
      content: '🔄 Processing your request with enhanced GRC analysis...',
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);
    setError(null);

    const currentMessage = inputMessage.trim();
    const currentFiles = [...selectedFiles];
    setInputMessage('');
    setSelectedFiles([]);

    try {
      // Initialize upload progress for files
      if (currentFiles.length > 0) {
        setUploadProgress(currentFiles.map(file => ({
          file,
          progress: 0,
          status: 'uploading'
        })));
      }

      // Send to enhanced chat endpoint
      const response = await apiClient.enhancedChat({
        message: currentMessage,
        files: currentFiles,
        grcContext: {
          frameworks: ['ISO 27001', 'GDPR'],
          tenant: 'demo-tenant',
          role: 'grc_analyst'
        }
      });

      // Update loading message with response
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMessage.id
          ? {
              ...msg,
              content: response.response,
              metadata: response.metadata,
              isLoading: false
            }
          : msg
      ));

      // Clear upload progress
      setUploadProgress([]);

      // Refresh conversation history
      await loadConversationHistory();

    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');

      // Update loading message with error
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMessage.id
          ? {
              ...msg,
              content: '❌ Sorry, I encountered an error processing your request. Please try again.',
              isLoading: false
            }
          : msg
      ));

      setUploadProgress([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const exportConversation = () => {
    const data = {
      messages: messages.filter(m => !m.isLoading),
      metadata: {
        exportedAt: new Date().toISOString(),
        chatHealth,
        conversationHistory
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enhanced-grc-chat-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getRiskLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with system status */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Enhanced GRC Chat</h1>
            <p className="text-sm text-gray-600">Multi-LLM orchestration with file processing & conversation memory</p>
          </div>

          <div className="flex items-center space-x-4">
            {/* System Health */}
            {chatHealth && (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                  <CheckCircle className="h-3 w-3" />
                  <span>{chatHealth.mcpServers.active} servers</span>
                </div>
                <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                  <Zap className="h-3 w-3" />
                  <span>v{chatHealth.version}</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                title="Show conversation history"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportConversation}
                disabled={messages.length === 0}
                title="Export conversation"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearChat}
                disabled={messages.length === 0}
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Capabilities Bar */}
        {chatHealth && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chatHealth.capabilities.map((capability: string, index: number) => (
              <Badge key={index} variant="outline" className="text-xs">
                {capability}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Error Alert */}
          {error && (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <div>Error: {error}</div>
              </Alert>
            </div>
          )}

          {/* File Upload Progress */}
          {uploadProgress.length > 0 && (
            <div className="p-4 bg-blue-50 border-b">
              <div className="space-y-2">
                {uploadProgress.map((progress, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    <FileIcon className="h-4 w-4" />
                    <span>{progress.file.name}</span>
                    <Badge variant="outline" className={
                      progress.status === 'complete' ? 'bg-green-100 text-green-700' :
                      progress.status === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }>
                      {progress.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Enhanced GRC Chat</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Start a conversation with our enhanced AI system. Upload documents, ask questions,
                  and get intelligent GRC analysis with multi-LLM orchestration.
                </p>
                <div className="mt-6 flex justify-center space-x-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInputMessage("What are the key ISO 27001 compliance requirements?")}
                  >
                    ISO 27001 Compliance
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInputMessage("Analyze cybersecurity risks for our organization")}
                  >
                    Risk Analysis
                  </Button>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  'flex',
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div className={clsx(
                  'max-w-4xl rounded-lg p-4 shadow-sm',
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-900 border'
                )}>
                  {/* Message Content */}
                  <div className="mb-2">
                    <EnhancedMarkdown>
                      {message.content}
                    </EnhancedMarkdown>
                  </div>

                  {/* Loading Indicator */}
                  {message.isLoading && (
                    <div className="flex items-center space-x-2 text-sm opacity-70">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing with enhanced AI...</span>
                    </div>
                  )}

                  {/* Files */}
                  {message.files && message.files.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.files.map((file, index) => (
                        <div key={index} className={clsx(
                          'flex items-center space-x-2 text-xs px-2 py-1 rounded',
                          message.type === 'user'
                            ? 'bg-blue-500 text-blue-100'
                            : 'bg-gray-100 text-gray-600'
                        )}>
                          <FileIcon className="h-3 w-3" />
                          <span>{file.name}</span>
                          <span>({formatFileSize(file.size)})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Enhanced Metadata */}
                  {message.metadata && !message.isLoading && (
                    <div className="mt-3 space-y-2 border-t pt-2">
                      {/* GRC Analysis */}
                      <div className="flex flex-wrap gap-1">
                        <Badge className={getRiskLevelColor(message.metadata.grcAnalysis.riskLevel)}>
                          {message.metadata.grcAnalysis.category} - {message.metadata.grcAnalysis.riskLevel} risk
                        </Badge>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {message.metadata.llmProvider}
                        </Badge>
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          {Math.round(message.metadata.confidence * 100)}% confident
                        </Badge>
                      </div>

                      {/* Tools Used */}
                      {message.metadata.toolsUsed.length > 0 && (
                        <div className="flex items-center space-x-2 text-xs">
                          <ToolIcon className="h-3 w-3" />
                          <span>Tools:</span>
                          <div className="flex flex-wrap gap-1">
                            {message.metadata.toolsUsed.map((tool, index) => (
                              <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Compliance Frameworks */}
                      {message.metadata.grcAnalysis.complianceFrameworks.length > 0 && (
                        <div className="flex items-center space-x-2 text-xs">
                          <Settings className="h-3 w-3" />
                          <span>Frameworks:</span>
                          <div className="flex flex-wrap gap-1">
                            {message.metadata.grcAnalysis.complianceFrameworks.map((framework, index) => (
                              <Badge key={index} variant="outline" className="bg-orange-50 text-orange-700 text-xs">
                                {framework}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Files Processed */}
                      {message.metadata.filesProcessed > 0 && (
                        <div className="flex items-center space-x-2 text-xs">
                          <FileText className="h-3 w-3" />
                          <span>{message.metadata.filesProcessed} files processed</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="flex justify-between items-center mt-2 text-xs opacity-70">
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t bg-white p-4">
            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2 text-sm">
                    <FileIcon className="h-4 w-4" />
                    <span>{file.name}</span>
                    <span className="text-gray-500">({formatFileSize(file.size)})</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-4 w-4 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex space-x-2">
              <div className="flex-1 space-y-2">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask about GRC compliance, upload documents for analysis, or request risk assessments..."
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="min-h-[60px] resize-none"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.csv,.json,.xml"
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Files
                    </Button>
                    <span className="text-xs text-gray-500">
                      Supports PDF, images, documents, and more
                    </span>
                  </div>

                  <Button
                    onClick={handleSendMessage}
                    disabled={isLoading || (!inputMessage.trim() && selectedFiles.length === 0)}
                    size="sm"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar with History and Search */}
        {showHistory && (
          <div className="w-80 border-l bg-white flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-medium text-gray-900 mb-3">Conversation Memory</h3>

              {/* Search */}
              <div className="flex space-x-2 mb-3">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={searchMemory}
                  disabled={!searchQuery.trim()}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Search Results</h4>
                  {searchResults.map((result, index) => (
                    <Card key={index} className="p-2">
                      <div className="text-xs">
                        <div className="font-medium truncate">
                          {result.interaction.input.message.substring(0, 50)}...
                        </div>
                        <div className="text-gray-500 mt-1">
                          Score: {result.relevanceScore} | {result.matchedTerms.join(', ')}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Conversation Insights */}
            {conversationHistory && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Insights</h4>
                  <div className="space-y-2">
                    <div className="text-xs">
                      <span className="text-gray-500">Total interactions:</span>
                      <span className="ml-1 font-medium">{conversationHistory.insights.totalInteractions}</span>
                    </div>
                    {conversationHistory.insights.topTopics.length > 0 && (
                      <div className="text-xs">
                        <span className="text-gray-500">Top topics:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {conversationHistory.insights.topTopics.map((topic: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Conversations */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Conversations</h4>
                  <div className="space-y-2">
                    {conversationHistory.conversations.slice(0, 5).map((conv: any, index: number) => (
                      <Card key={index} className="p-2">
                        <div className="text-xs">
                          <div className="truncate font-medium">
                            {conv.input.message.substring(0, 40)}...
                          </div>
                          <div className="text-gray-500 mt-1">
                            {new Date(conv.timestamp).toLocaleDateString()}
                          </div>
                          {conv.grcAnalysis && (
                            <Badge className={getRiskLevelColor(conv.grcAnalysis.riskLevel) + ' mt-1'}>
                              {conv.grcAnalysis.category}
                            </Badge>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedChatInterface;