import * as React from 'react';
import { clsx } from 'clsx';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Info,
  X 
} from 'lucide-react';

const alertVariants = {
  variant: {
    default: 'bg-background text-foreground border-border',
    destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive bg-destructive/5',
    warning: 'border-yellow-200 text-yellow-800 dark:border-yellow-900/50 dark:text-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400',
    success: 'border-green-200 text-green-800 dark:border-green-900/50 dark:text-green-200 bg-green-50 dark:bg-green-900/10 [&>svg]:text-green-600 dark:[&>svg]:text-green-400',
    info: 'border-blue-200 text-blue-800 dark:border-blue-900/50 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/10 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400',
  }
};

const alertIcons = {
  default: Info,
  destructive: XCircle,
  warning: AlertCircle,
  success: CheckCircle,
  info: Info,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof alertVariants.variant;
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', title, children, dismissible, onDismiss, ...props }, ref) => {
    const Icon = alertIcons[variant];
    
    return (
      <div
        ref={ref}
        role="alert"
        className={clsx(
          'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg]:h-4 [&>svg]:w-4',
          alertVariants.variant[variant],
          className
        )}
        {...props}
      >
        <Icon className="h-4 w-4" />
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        )}
        <div className={dismissible ? 'pr-8' : ''}>
          {title && (
            <h5 className="mb-1 font-medium leading-none tracking-tight">
              {title}
            </h5>
          )}
          <div className="text-sm [&_p]:leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    );
  }
);
Alert.displayName = 'Alert';

export { Alert };