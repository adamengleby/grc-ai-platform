import React from 'react';
import { useAuthStore } from '@/app/store/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import {
  FileText,
  Shield,
  AlertTriangle,
  // CheckCircle,
  Clock,
  Download,
  Search,
  Filter,
  Eye,
  // Users,
  Activity,
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
} from 'recharts';

/**
 * Audit Dashboard - Compliance and audit focus for Auditors and Compliance Officers
 * Shows audit trails, compliance status, and regulatory reporting
 */
export const AuditDashboard: React.FC = () => {
  const { tenant, user } = useAuthStore();

  // Mock audit data
  const auditEventTrend = [
    { month: 'Jan', events: 1250, violations: 12 },
    { month: 'Feb', events: 1180, violations: 8 },
    { month: 'Mar', events: 1350, violations: 15 },
    { month: 'Apr', events: 1420, violations: 6 },
    { month: 'May', events: 1390, violations: 9 },
    { month: 'Jun', events: 1480, violations: 4 },
  ];

  const complianceBreakdown = [
    { framework: 'ISO 27001', compliant: 142, total: 150, color: '#22c55e' },
    { framework: 'CPS 230', compliant: 89, total: 95, color: '#3b82f6' },
    { framework: 'SOC 2', compliant: 67, total: 72, color: '#8b5cf6' },
    { framework: 'GDPR', compliant: 45, total: 48, color: '#f59e0b' },
  ];

  const recentAuditEvents = [
    {
      id: 'evt-001',
      timestamp: '2024-08-19T09:30:00Z',
      action: 'agent.enabled',
      user: 'Sarah Chen',
      resource: 'GRC Risk Analyzer',
      outcome: 'success',
      riskLevel: 'low',
    },
    {
      id: 'evt-002',
      timestamp: '2024-08-19T09:15:00Z',
      action: 'llm.query',
      user: 'Mike Johnson',
      resource: 'Compliance Monitor',
      outcome: 'success',
      riskLevel: 'medium',
    },
    {
      id: 'evt-003',
      timestamp: '2024-08-19T08:45:00Z',
      action: 'data.exported',
      user: 'Lisa Wang',
      resource: 'Compliance Report Q3',
      outcome: 'success',
      riskLevel: 'high',
    },
    {
      id: 'evt-004',
      timestamp: '2024-08-19T08:20:00Z',
      action: 'settings.updated',
      user: 'Sarah Chen',
      resource: 'MCP Tools Configuration',
      outcome: 'warning',
      riskLevel: 'medium',
    },
    {
      id: 'evt-005',
      timestamp: '2024-08-19T07:55:00Z',
      action: 'user.login',
      user: 'David Smith',
      resource: 'Dashboard',
      outcome: 'failure',
      riskLevel: 'high',
    },
  ];

  const complianceFindings = [
    {
      id: 'find-001',
      framework: 'ISO 27001',
      control: 'A.9.2.5',
      title: 'Access Control Review',
      severity: 'critical',
      status: 'open',
      dueDate: '2024-08-25',
      assignee: 'Security Team',
    },
    {
      id: 'find-002',
      framework: 'CPS 230',
      control: 'CPS.230.1',
      title: 'Operational Resilience Testing',
      severity: 'high',
      status: 'in-progress',
      dueDate: '2024-09-15',
      assignee: 'IT Operations',
    },
    {
      id: 'find-003',
      framework: 'SOC 2',
      control: 'CC6.1',
      title: 'Logical Access Controls',
      severity: 'medium',
      status: 'resolved',
      dueDate: '2024-08-10',
      assignee: 'Compliance Team',
    },
  ];

  if (!tenant || !user) return null;

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'failure':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'open':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit & Compliance Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Monitor compliance status, audit trails, and regulatory requirements
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">94.8%</div>
            <p className="text-xs text-muted-foreground">
              343 of 365 controls compliant
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Findings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">8</div>
            <p className="text-xs text-muted-foreground">
              3 critical, 5 high priority
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audit Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,247</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Audit</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground">
              Days until ISO 27001 audit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Audit Event Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Event Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={auditEventTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Area 
                    type="monotone" 
                    dataKey="events" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.3}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="violations" 
                    stroke="#ef4444" 
                    fill="#ef4444" 
                    fillOpacity={0.8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center space-x-6 mt-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Total Events</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Violations</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance by Framework</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {complianceBreakdown.map((framework) => {
                const percentage = (framework.compliant / framework.total) * 100;
                return (
                  <div key={framework.framework} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{framework.framework}</span>
                      <span>{framework.compliant} / {framework.total} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: framework.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Audit Events */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Recent Audit Events</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    View All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentAuditEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className={`text-sm font-medium ${getOutcomeColor(event.outcome)}`}>
                          {event.outcome.toUpperCase()}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">{event.user}</span> performed{' '}
                          <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                            {event.action}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Resource: {event.resource}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskLevelColor(event.riskLevel)}`}>
                        {event.riskLevel}
                      </span>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Findings */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Active Findings</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {complianceFindings.map((finding) => (
                  <div key={finding.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {finding.framework}
                          </span>
                          <span className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                            {finding.control}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium">{finding.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Assigned to: {finding.assignee}
                        </p>
                      </div>
                      <AlertTriangle className={`h-4 w-4 ${getSeverityColor(finding.severity)}`} />
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(finding.status)}`}>
                        {finding.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Due: {new Date(finding.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <Button variant="outline" className="w-full mt-4" size="sm">
                View All Findings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};