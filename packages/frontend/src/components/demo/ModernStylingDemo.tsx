import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../app/components/ui/Card';
import { Button } from '../../app/components/ui/Button';
import { MetricsCard } from '../../app/components/ui/MetricsCard';
import { ProgressBar } from '../../app/components/ui/ProgressBar';
import { StatusBadge } from '../../app/components/ui/StatusBadge';
import {
  TrendingUp,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle2,
  Target,
  Brain
} from 'lucide-react';

export const ModernStylingDemo: React.FC = () => {
  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      {/* Header Section with Gradient */}
      <div className="bg-gradient-blue rounded-xl p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">Modern GRC Platform</h1>
        <p className="text-xl opacity-90">Clean, professional design for enterprise users</p>
      </div>

      {/* Card Variants Showcase */}
      <section className="space-y-6">
        <h2 className="heading-secondary">Card Variants</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="clean">
            <CardHeader>
              <CardTitle>Clean Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Modern clean design with subtle shadows</p>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Elevated Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Enhanced shadows for emphasis</p>
            </CardContent>
          </Card>

          <Card variant="gradient">
            <CardHeader>
              <CardTitle>Gradient Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="opacity-90">Eye-catching gradient background</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Status System Showcase */}
      <section className="space-y-6">
        <h2 className="heading-secondary">GRC Status System</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="good" label="Compliant" />
            <StatusBadge status="medium" label="At Risk" />
            <StatusBadge status="critical" label="Non-Compliant" />
            <StatusBadge status="pending" label="Under Review" />
          </div>
          
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="good" variant="outline" />
            <StatusBadge status="medium" variant="outline" />
            <StatusBadge status="critical" variant="outline" />
            <StatusBadge status="pending" variant="outline" />
          </div>
        </div>
      </section>

      {/* Metrics Cards Showcase */}
      <section className="space-y-6">
        <h2 className="heading-secondary">Modern Metrics Cards</h2>
        <div className="dashboard-grid">
          <MetricsCard
            title="Risk Score"
            value="87%"
            trend="up"
            trendValue={5.2}
            status="good"
            icon={Shield}
            description="Improving risk posture"
          />

          <MetricsCard
            title="Compliance Rate"
            value="94.2%"
            trend="up"
            trendValue={2.1}
            status="good"
            icon={CheckCircle2}
            description="Above target threshold"
          />

          <MetricsCard
            title="Critical Issues"
            value={7}
            trend="down"
            trendValue={-3}
            status="medium"
            icon={AlertTriangle}
            description="Decreased from last month"
          />

          <MetricsCard
            title="Active Users"
            value="1,247"
            trend="up"
            trendValue={8.3}
            status="good"
            icon={Users}
            description="Growing engagement"
          />
        </div>
      </section>

      {/* Progress Bars Showcase */}
      <section className="space-y-6">
        <h2 className="heading-secondary">Progress Indicators</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Compliance Progress</h3>
            <ProgressBar value={87} status="good" showLabel={true} />
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Risk Mitigation</h3>
            <ProgressBar value={64} status="medium" showLabel={true} />
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Critical Issues</h3>
            <ProgressBar value={23} status="critical" showLabel={true} />
          </div>
        </div>
      </section>

      {/* Button Variants Showcase */}
      <section className="space-y-6">
        <h2 className="heading-secondary">Modern Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <Button variant="default">Primary Action</Button>
          <Button variant="gradient">Gradient Style</Button>
          <Button variant="success">Success Action</Button>
          <Button variant="warning">Warning Action</Button>
          <Button variant="outline">Outline Style</Button>
          <Button variant="secondary">Secondary</Button>
        </div>
      </section>

      {/* Executive Dashboard Preview */}
      <section className="space-y-6">
        <h2 className="heading-secondary">Executive Dashboard Example</h2>
        <Card variant="clean">
          <CardHeader className="bg-gradient-subtle">
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-6 w-6 text-primary" />
              <span>AI-Powered Risk Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-sm mb-3 flex items-center space-x-2">
                  <Target className="h-4 w-4" />
                  <span>Key Findings</span>
                </h4>
                <ul className="space-y-2">
                  <li className="text-sm text-muted-foreground flex items-start space-x-2">
                    <CheckCircle2 className="h-3 w-3 text-status-good mt-0.5 flex-shrink-0" />
                    <span>Regulatory compliance at 94.2% - exceeding target</span>
                  </li>
                  <li className="text-sm text-muted-foreground flex items-start space-x-2">
                    <CheckCircle2 className="h-3 w-3 text-status-good mt-0.5 flex-shrink-0" />
                    <span>Control effectiveness improved 5.2% this quarter</span>
                  </li>
                  <li className="text-sm text-muted-foreground flex items-start space-x-2">
                    <AlertTriangle className="h-3 w-3 text-status-medium mt-0.5 flex-shrink-0" />
                    <span>7 critical issues identified requiring attention</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-3 flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Risk Trends</span>
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Operational Risk</span>
                      <span className="text-status-good">Low</span>
                    </div>
                    <ProgressBar value={23} status="good" size="sm" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Compliance Risk</span>
                      <span className="text-status-medium">Medium</span>
                    </div>
                    <ProgressBar value={45} status="medium" size="sm" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Cybersecurity Risk</span>
                      <span className="text-status-good">Low</span>
                    </div>
                    <ProgressBar value={18} status="good" size="sm" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" size="sm">View Details</Button>
              <Button variant="gradient" size="sm">Generate Report</Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};