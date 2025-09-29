import * as React from 'react';
import { clsx } from 'clsx';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0-100
  status?: 'good' | 'medium' | 'critical';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const getProgressColor = (status: ProgressBarProps['status']) => {
  switch (status) {
    case 'good':
      return 'progress-good';
    case 'medium':
      return 'progress-medium';
    case 'critical':
      return 'progress-critical';
    default:
      return 'bg-primary';
  }
};

const getSize = (size: ProgressBarProps['size']) => {
  switch (size) {
    case 'sm':
      return 'h-1';
    case 'lg':
      return 'h-4';
    default:
      return 'h-2';
  }
};

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, status, showLabel = false, size = 'md', animated = true, ...props }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value));
    
    return (
      <div ref={ref} className={clsx('space-y-2', className)} {...props}>
        {showLabel && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{clampedValue}%</span>
          </div>
        )}
        
        <div className={clsx('progress-bar', getSize(size))}>
          <div
            className={clsx(
              'progress-bar-fill',
              getProgressColor(status),
              animated && 'transition-all duration-500 ease-out'
            )}
            style={{ width: `${clampedValue}%` }}
          />
        </div>
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';