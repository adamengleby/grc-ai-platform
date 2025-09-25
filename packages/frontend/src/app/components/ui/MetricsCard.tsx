import * as React from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

export interface MetricsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string | number;
  icon?: LucideIcon;
  status?: 'good' | 'medium' | 'critical' | 'pending';
  description?: string;
}

const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
  switch (trend) {
    case 'up':
      return TrendingUp;
    case 'down':
      return TrendingDown;
    default:
      return Minus;
  }
};

const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
  switch (trend) {
    case 'up':
      return 'metrics-trend-up';
    case 'down':
      return 'metrics-trend-down';
    default:
      return 'metrics-trend-neutral';
  }
};

const getStatusColor = (status: MetricsCardProps['status']) => {
  switch (status) {
    case 'good':
      return 'text-status-good';
    case 'medium':
      return 'text-status-medium';
    case 'critical':
      return 'text-status-critical';
    case 'pending':
      return 'text-status-pending';
    default:
      return 'text-foreground';
  }
};

export const MetricsCard = React.forwardRef<HTMLDivElement, MetricsCardProps>(
  ({ className, title, value, trend, trendValue, icon: Icon, status, description, ...props }, ref) => {
    const TrendIcon = trend ? getTrendIcon(trend) : null;
    
    return (
      <div
        ref={ref}
        className={clsx('metrics-card', className)}
        {...props}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="metrics-label">{title}</div>
          {Icon && (
            <Icon className={clsx('h-5 w-5', getStatusColor(status))} />
          )}
        </div>
        
        <div className="space-y-2">
          <div className={clsx('metrics-value', getStatusColor(status))}>
            {value}
          </div>
          
          {trend && trendValue && TrendIcon && (
            <div className={getTrendColor(trend)}>
              <TrendIcon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {typeof trendValue === 'number' && trendValue > 0 && trend === 'up' ? '+' : ''}
                {trendValue}{typeof trendValue === 'number' ? '%' : ''}
              </span>
            </div>
          )}
          
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    );
  }
);

MetricsCard.displayName = 'MetricsCard';