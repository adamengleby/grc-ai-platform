/**
 * ML Model Management Component
 * Interface for managing AI/ML models used in predictive analytics
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import {
  Brain,
  Zap,
  Activity,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Target,
  Database,
  Cpu,
  HardDrive,
  Eye,
  Edit,
  Trash2,
  Download,
  Plus
} from 'lucide-react';

interface MLModel {
  id: string;
  name: string;
  type: 'risk_prediction' | 'anomaly_detection' | 'compliance_scoring' | 'control_effectiveness';
  status: 'active' | 'inactive' | 'training' | 'error';
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  lastTrained: Date;
  nextTraining: Date;
  version: string;
  dataPoints: number;
  inferenceTime: number; // in milliseconds
  resourceUsage: {
    cpu: number; // percentage
    memory: number; // MB
    storage: number; // MB
  };
  trainingHistory: {
    date: Date;
    accuracy: number;
    loss: number;
    epochs: number;
  }[];
  description: string;
  framework: 'tensorflow' | 'pytorch' | 'scikit-learn' | 'xgboost';
}

interface ModelManagementProps {
  models: MLModel[];
  isLoading: boolean;
  onModelAction: (modelId: string, action: 'start' | 'stop' | 'retrain' | 'delete') => void;
}

export const ModelManagement: React.FC<ModelManagementProps> = ({
  models,
  isLoading,
  onModelAction
}) => {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [showMetrics, setShowMetrics] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-gray-600 bg-gray-100';
      case 'training': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getModelTypeIcon = (type: string) => {
    switch (type) {
      case 'risk_prediction': return AlertTriangle;
      case 'anomaly_detection': return Activity;
      case 'compliance_scoring': return Target;
      case 'control_effectiveness': return CheckCircle;
      default: return Brain;
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredModels = models.filter(model => {
    if (filterType !== 'all' && model.type !== filterType) return false;
    if (filterStatus !== 'all' && model.status !== filterStatus) return false;
    return true;
  });

  const modelStats = {
    total: models.length,
    active: models.filter(m => m.status === 'active').length,
    training: models.filter(m => m.status === 'training').length,
    errors: models.filter(m => m.status === 'error').length
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brain className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">ML Model Management</h2>
        </div>

        <div className="flex items-center space-x-4">
          {/* Filters */}
          <div className="flex items-center space-x-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border rounded px-3 py-1 text-sm"
            >
              <option value="all">All Types</option>
              <option value="risk_prediction">Risk Prediction</option>
              <option value="anomaly_detection">Anomaly Detection</option>
              <option value="compliance_scoring">Compliance Scoring</option>
              <option value="control_effectiveness">Control Effectiveness</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border rounded px-3 py-1 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="training">Training</option>
              <option value="error">Error</option>
            </select>
          </div>

          <Button
            variant={showMetrics ? "default" : "outline"}
            size="sm"
            onClick={() => setShowMetrics(!showMetrics)}
            className="flex items-center space-x-2"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Metrics</span>
          </Button>

          <Button variant="default" size="sm" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Deploy Model</span>
          </Button>
        </div>
      </div>

      {/* Model Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Models</p>
                <p className="text-2xl font-bold text-purple-600">{modelStats.total}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Brain className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{modelStats.active}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Training</p>
                <p className="text-2xl font-bold text-blue-600">{modelStats.training}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Errors</p>
                <p className="text-2xl font-bold text-red-600">{modelStats.errors}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model List */}
      <div className="space-y-4">
        {filteredModels.map((model) => {
          const Icon = getModelTypeIcon(model.type);
          const isSelected = selectedModel === model.id;

          return (
            <Card key={model.id} className={`transition-all duration-200 ${isSelected ? 'ring-2 ring-purple-500' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Icon className="h-6 w-6 text-purple-600" />
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{model.name}</h3>
                        <Badge className={getStatusColor(model.status)}>
                          {model.status.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          v{model.version}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {model.framework}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">{model.description}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Database className="h-4 w-4" />
                          <span>{model.dataPoints.toLocaleString()} data points</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>Last trained: {model.lastTrained.toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Zap className="h-4 w-4" />
                          <span>{model.inferenceTime}ms inference</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedModel(isSelected ? null : model.id)}
                      className="flex items-center space-x-1"
                    >
                      <Eye className="h-4 w-4" />
                      <span>{isSelected ? 'Hide' : 'Details'}</span>
                    </Button>

                    {model.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onModelAction(model.id, 'stop')}
                        className="flex items-center space-x-1"
                      >
                        <Pause className="h-4 w-4" />
                        <span>Stop</span>
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onModelAction(model.id, 'start')}
                        className="flex items-center space-x-1"
                      >
                        <Play className="h-4 w-4" />
                        <span>Start</span>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onModelAction(model.id, 'retrain')}
                      className="flex items-center space-x-1"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Retrain</span>
                    </Button>
                  </div>
                </div>

                {showMetrics && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className={`text-lg font-bold ${getPerformanceColor(model.accuracy)}`}>
                        {(model.accuracy * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Accuracy</div>
                    </div>
                    
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className={`text-lg font-bold ${getPerformanceColor(model.precision)}`}>
                        {(model.precision * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Precision</div>
                    </div>
                    
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className={`text-lg font-bold ${getPerformanceColor(model.recall)}`}>
                        {(model.recall * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Recall</div>
                    </div>
                    
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className={`text-lg font-bold ${getPerformanceColor(model.f1Score)}`}>
                        {(model.f1Score * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">F1-Score</div>
                    </div>
                  </div>
                )}

                {isSelected && (
                  <div className="border-t pt-4 mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Resource Usage */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Resource Usage</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Cpu className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">CPU</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-20 h-2 bg-gray-200 rounded-full">
                                <div 
                                  className="h-2 bg-blue-500 rounded-full"
                                  style={{ width: `${model.resourceUsage.cpu}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium">{model.resourceUsage.cpu}%</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <HardDrive className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">Memory</span>
                            </div>
                            <span className="text-sm font-medium">{model.resourceUsage.memory} MB</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <HardDrive className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">Storage</span>
                            </div>
                            <span className="text-sm font-medium">{model.resourceUsage.storage} MB</span>
                          </div>
                        </div>
                      </div>

                      {/* Training History */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Recent Training</h4>
                        <div className="space-y-2">
                          {model.trainingHistory.slice(0, 3).map((training, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="text-sm">
                                {training.date.toLocaleDateString()}
                              </div>
                              <div className="flex items-center space-x-4 text-xs">
                                <span>Accuracy: {(training.accuracy * 100).toFixed(1)}%</span>
                                <span>Loss: {training.loss.toFixed(3)}</span>
                                <span>Epochs: {training.epochs}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 text-sm text-gray-600">
                          Next training scheduled: {model.nextTraining.toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm" className="flex items-center space-x-1">
                        <Download className="h-4 w-4" />
                        <span>Export</span>
                      </Button>
                      
                      <Button variant="outline" size="sm" className="flex items-center space-x-1">
                        <Edit className="h-4 w-4" />
                        <span>Configure</span>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => onModelAction(model.id, 'delete')}
                        className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filteredModels.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-2">No models match the current filters</p>
              <p className="text-sm text-gray-400">Deploy your first ML model to get started</p>
              <Button variant="default" className="mt-4 flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Deploy Model</span>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};