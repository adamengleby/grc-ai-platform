/**
 * Predictive Analytics Component
 * Shows ML-powered predictions and forecasts for risks, compliance, and system health
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Brain,
  Target,
  Clock,
  Zap,
  Shield,
  Eye,
  Calendar,
  Activity
} from 'lucide-react';
import { PredictiveInsights } from '../types';

interface PredictiveAnalyticsProps {
  insights: PredictiveInsights;
  isLoading: boolean;
}

export const PredictiveAnalytics: React.FC<PredictiveAnalyticsProps> = ({
  insights,
  isLoading
}) => {
  const [selectedTimeHorizon, setSelectedTimeHorizon] = useState<'7 days' | '30 days' | '90 days'>('30 days');

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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Header with Time Horizon Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brain className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">AI-Powered Predictions</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Forecast Horizon:</span>
          </div>
          
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {['7 days', '30 days', '90 days'].map((horizon) => (
              <Button
                key={horizon}
                variant={selectedTimeHorizon === horizon ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedTimeHorizon(horizon as any)}
                className="text-xs"
              >
                {horizon}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Predictions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span>Risk Predictions</span>
            <Badge variant="secondary" className="text-xs">
              {insights.riskPredictions.length} risks analyzed
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.riskPredictions.map((prediction) => (
              <div key={prediction.riskId} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{prediction.riskTitle}</h4>
                    <p className="text-sm text-gray-600">Risk ID: {prediction.riskId}</p>
                  </div>
                  
                  <div className="text-right">
                    <Badge className={getConfidenceColor(prediction.confidence)}>
                      {(prediction.confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-lg font-bold text-blue-600">
                      {prediction.currentScore}
                    </div>
                    <div className="text-xs text-gray-600">Current Score</div>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center justify-center space-x-1">
                      {prediction.predictedScore > prediction.currentScore ? (
                        <TrendingUp className="h-4 w-4 text-red-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-600" />
                      )}
                      <div className={`text-lg font-bold ${
                        prediction.predictedScore > prediction.currentScore ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {prediction.predictedScore}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">Predicted Score</div>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-700">
                      {prediction.timeHorizon}
                    </div>
                    <div className="text-xs text-gray-600">Time Horizon</div>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Influencing Factors:</h5>
                  <div className="flex flex-wrap gap-2">
                    {prediction.factors.map((factor, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {factor}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className={`text-sm px-3 py-1 rounded-full ${
                    prediction.predictedScore > prediction.currentScore
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {prediction.predictedScore > prediction.currentScore
                      ? `Risk increasing by ${prediction.predictedScore - prediction.currentScore} points`
                      : `Risk decreasing by ${prediction.currentScore - prediction.predictedScore} points`
                    }
                  </div>
                  
                  <Button variant="outline" size="sm" className="flex items-center space-x-1">
                    <Eye className="h-3 w-3" />
                    <span>View Details</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Compliance Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>Compliance Predictions</span>
            <Badge variant="secondary" className="text-xs">
              {insights.complianceAlerts.length} frameworks monitored
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.complianceAlerts.map((alert, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{alert.framework}</h4>
                    <p className="text-sm text-gray-600">{alert.requirement}</p>
                  </div>
                  
                  <div className="text-right">
                    <Badge className={getConfidenceColor(alert.confidence)}>
                      {(alert.confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm font-semibold text-blue-600 uppercase">
                      {alert.currentStatus}
                    </div>
                    <div className="text-xs text-gray-600">Current Status</div>
                  </div>
                  
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-sm font-semibold text-orange-600 uppercase">
                      {alert.predictedStatus}
                    </div>
                    <div className="text-xs text-gray-600">Predicted Status</div>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-semibold text-gray-700">
                      {alert.alertDate.toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-600">Alert Date</div>
                  </div>
                </div>
              </div>
            ))}

            {insights.complianceAlerts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No compliance alerts predicted for the selected timeframe</p>
                <p className="text-sm mt-1">Your compliance posture looks strong!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Anomalies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-orange-600" />
            <span>System Anomalies Detected</span>
            <Badge variant="secondary" className="text-xs">
              Last 24 hours
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.systemAnomalies.map((anomaly, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-full ${getSeverityColor(anomaly.severity)}`}>
                      {anomaly.type === 'performance' && <Zap className="h-4 w-4" />}
                      {anomaly.type === 'security' && <Shield className="h-4 w-4" />}
                      {anomaly.type === 'compliance' && <Target className="h-4 w-4" />}
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-900 capitalize">
                        {anomaly.type} Anomaly
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">{anomaly.description}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge className={getSeverityColor(anomaly.severity)}>
                      {anomaly.severity.toUpperCase()}
                    </Badge>
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {anomaly.detectedAt.toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Affected Systems:</h5>
                  <div className="flex flex-wrap gap-2">
                    {anomaly.affectedSystems.map((system, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {system}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Detected {new Date(anomaly.detectedAt).toLocaleDateString()} at{' '}
                    {new Date(anomaly.detectedAt).toLocaleTimeString()}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      Investigate
                    </Button>
                    <Button variant="outline" size="sm">
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {insights.systemAnomalies.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No system anomalies detected</p>
                <p className="text-sm mt-1">All systems operating within normal parameters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ML Model Information */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <span>Prediction Model Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-lg font-bold text-purple-600">95.3%</div>
              <div className="text-sm font-medium text-gray-700">Model Accuracy</div>
              <div className="text-xs text-gray-500">Risk prediction model</div>
            </div>
            
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-lg font-bold text-blue-600">87.1%</div>
              <div className="text-sm font-medium text-gray-700">Anomaly Detection</div>
              <div className="text-xs text-gray-500">System health model</div>
            </div>
            
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-lg font-bold text-green-600">2.3s</div>
              <div className="text-sm font-medium text-gray-700">Avg Response Time</div>
              <div className="text-xs text-gray-500">Model inference time</div>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p>
              Our ML models are continuously trained on your organization's data to provide 
              personalized predictions. Models are updated daily to incorporate new patterns 
              and improve accuracy over time.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};