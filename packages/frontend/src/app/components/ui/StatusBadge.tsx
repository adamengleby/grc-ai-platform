import * as React from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, AlertTriangle, XCircle, Clock, LucideIcon } from 'lucide-react';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: 'good' | 'medium' | 'critical' | 'pending';
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline';
}

const getStatusIcon = (status: StatusBadgeProps['status']): LucideIcon => {
  switch (status) {
    case 'good':
      return CheckCircle2;
    case 'medium':
      return AlertTriangle;
    case 'critical':
      return XCircle;
    case 'pending':
      return Clock;
    default:
      return Clock;
  }
};

const getStatusLabel = (status: StatusBadgeProps['status']): string => {
  switch (status) {
    case 'good':
      return 'Good';
    case 'medium':
      return 'Medium';
    case 'critical':
      return 'Critical';
    case 'pending':
      return 'Pending';
    default:
      return 'Unknown';
  }
};

const getStatusClass = (status: StatusBadgeProps['status'], variant: StatusBadgeProps['variant']) => {
  if (variant === 'outline') {
    switch (status) {
      case 'good':
        return 'border-status-good text-status-good bg-status-good/10';
      case 'medium':
        return 'border-status-medium text-status-medium bg-status-medium/10';
      case 'critical':
        return 'border-status-critical text-status-critical bg-status-critical/10';
      case 'pending':
        return 'border-status-pending text-status-pending bg-status-pending/10';
      default:
        return 'border-muted-foreground text-muted-foreground bg-muted/10';
    }
  }

  switch (status) {
    case 'good':
      return 'status-good';
    case 'medium':
      return 'status-medium';
    case 'critical':
      return 'status-critical';
    case 'pending':
      return 'status-pending';
    default:
      return 'bg-muted-foreground text-white';
  }
};

const getSize = (size: StatusBadgeProps['size']) => {
  switch (size) {
    case 'sm':
      return 'px-2 py-0.5 text-xs';
    case 'lg':
      return 'px-4 py-2 text-base';
    default:
      return 'px-3 py-1 text-sm';
  }
};

const getIconSize = (size: StatusBadgeProps['size']) => {
  switch (size) {
    case 'sm':
      return 'h-3 w-3';
    case 'lg':
      return 'h-5 w-5';
    default:
      return 'h-4 w-4';
  }
};

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ 
    className, 
    status, 
    label, 
    showIcon = true, 
    size = 'md',
    variant = 'default',
    ...props 
  }, ref) => {
    const Icon = getStatusIcon(status);
    const displayLabel = label || getStatusLabel(status);
    
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center space-x-1 rounded-full font-medium',
          getSize(size),
          getStatusClass(status, variant),
          variant === 'outline' && 'border',
          className
        )}
        {...props}
      >
        {showIcon && <Icon className={getIconSize(size)} />}
        <span>{displayLabel}</span>
      </span>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';