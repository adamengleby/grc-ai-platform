import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Bot,
  Activity,
  TrendingUp,
  CheckCircle
} from 'lucide-react';
import { createAgentMetricsService } from '@/lib/agentMetricsService';

interface AgentStatsCardsProps {
  tenantId: string;
}

const AgentStatsCards: React.FC<AgentStatsCardsProps> = ({ tenantId }) => {
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalExecutions: 0,
    averageSuccessRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const metricsService = createAgentMetricsService(tenantId);
        const platformStats = metricsService.getPlatformStats();
        setStats(platformStats);
      } catch (error) {
        console.error('Error loading platform stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return Math.floor(num / 1000) + 'k+';
    }
    return num.toString();
  };

  const cards = [
    {
      title: 'Total Agents',
      value: isLoading ? '-' : stats.totalAgents,
      icon: Bot,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Active Agents', 
      value: isLoading ? '-' : stats.activeAgents,
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Total Executions',
      value: isLoading ? '-' : formatNumber(stats.totalExecutions),
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Success Rate',
      value: isLoading ? '-' : `${stats.averageSuccessRate}%`,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <IconComponent className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {card.value}
                  </p>
                  <p className="text-sm text-gray-500">
                    {card.title}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AgentStatsCards;