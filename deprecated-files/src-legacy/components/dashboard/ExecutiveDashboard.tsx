import React from 'react';
import { useDashboardStore } from '@/store/dashboard';
import { useAuthStore } from '@/store/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  Activity,
  // Users,
  DollarSign,
  CheckCircle,
  Clock,
  BarChart3,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  // PieChart,
  // Pie,
  // Cell,
  BarChart,
  Bar,
} from 'recharts';

/**
 * Executive Dashboard - High-level overview for Tenant Owners
 * Shows strategic metrics, compliance posture, and key risks
 */
export const ExecutiveDashboard: React.FC = () => {
  const { metrics } = useDashboardStore();
  const { tenant } = useAuthStore();

  // Mock data for charts
  const riskTrendData = [
    { month: 'Jan', high: 12, medium: 25, low: 8 },
    { month: 'Feb', high: 10, medium: 28, low: 6 },
    { month: 'Mar', high: 8, medium: 22, low: 4 },
    { month: 'Apr', high: 6, medium: 20, low: 3 },
    { month: 'May', high: 9, medium: 24, low: 5 },
    { month: 'Jun', high: 7, medium: 18, low: 2 },
  ];

  const complianceData = [
    { framework: 'ISO 27001', score: 94.8, color: '#22c55e' },
    { framework: 'CPS 230', score: 89.2, color: '#3b82f6' },
    { framework: 'SOC 2', score: 96.5, color: '#8b5cf6' },
    { framework: 'GDPR', score: 91.7, color: '#f59e0b' },
  ];

  const costData = [
    { category: 'AI Agents', amount: 1240, budget: 2000 },
    { category: 'MCP Tools', amount: 890, budget: 1500 },
    { category: 'Storage', amount: 450, budget: 800 },
    { category: 'Audit', amount: 320, budget: 500 },
  ];

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Strategic overview of your GRC platform performance and risk posture
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {metrics.riskScore.toFixed(1)}/10
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="inline h-3 w-3 mr-1" />
              Decreased by 0.8 this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics.complianceScore.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              Improved by 2.3% this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.activeAgents}/{metrics.totalAgents}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.healthyAgents} healthy, monitoring 24/7
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(costData.reduce((sum, item) => sum + item.amount, 0)).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              ${(costData.reduce((sum, item) => sum + item.budget, 0) - costData.reduce((sum, item) => sum + item.amount, 0)).toLocaleString()} under budget
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Risk Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Trend Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riskTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Area 
                    type="monotone" 
                    dataKey="high" 
                    stackId="1" 
                    stroke="#ef4444" 
                    fill="#ef4444" 
                    fillOpacity={0.8}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="medium" 
                    stackId="1" 
                    stroke="#f59e0b" 
                    fill="#f59e0b" 
                    fillOpacity={0.8}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="low" 
                    stackId="1" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center space-x-6 mt-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>High Risk</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Medium Risk</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Low Risk</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Bar dataKey="amount" fill="#3b82f6" name="Actual" />
                  <Bar dataKey="budget" fill="#e5e7eb" name="Budget" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Critical Findings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Critical Findings</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 mb-4">
              {metrics.criticalFindings}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Encryption gaps</span>
                <span className="text-sm font-medium text-red-600">2</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Access control</span>
                <span className="text-sm font-medium text-red-600">1</span>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" size="sm">
              View All Findings
            </Button>
          </CardContent>
        </Card>

        {/* Open Risks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <span>Open Risks</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600 mb-4">
              {metrics.openRisks}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">High priority</span>
                <span className="text-sm font-medium text-red-600">3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Medium priority</span>
                <span className="text-sm font-medium text-yellow-600">5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Low priority</span>
                <span className="text-sm font-medium text-green-600">4</span>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" size="sm">
              Review Risks
            </Button>
          </CardContent>
        </Card>

        {/* Compliance Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Compliance Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {complianceData.map((framework) => (
                <div key={framework.framework} className="flex items-center justify-between">
                  <span className="text-sm">{framework.framework}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium" style={{ color: framework.color }}>
                      {framework.score}%
                    </span>
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full"
                        style={{ 
                          width: `${framework.score}%`, 
                          backgroundColor: framework.color 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4" size="sm">
              Detailed Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};