# UI Component Specifications for GRC AI Dashboards

## Overview
This document provides detailed technical specifications for implementing the UI components designed for the Smart Data Quality Checker and Risk & Control Insights Generator dashboards.

## Design System Tokens

### Color Palette
```css
/* Primary Colors */
--color-primary-50: #eff6ff;
--color-primary-100: #dbeafe;
--color-primary-500: #3b82f6;
--color-primary-600: #2563eb;
--color-primary-900: #1e3a8a;

/* Risk & Status Colors */
--color-risk-critical: #dc2626;    /* Red - Critical/High Risk */
--color-risk-high: #ea580c;        /* Orange - High Risk */
--color-risk-medium: #d97706;      /* Amber - Medium Risk */
--color-risk-low: #16a34a;         /* Green - Low Risk */
--color-risk-minimal: #15803d;     /* Dark Green - Minimal Risk */

/* Confidence Colors */
--color-confidence-high: #059669;   /* >95% confidence */
--color-confidence-medium: #d97706; /* 85-95% confidence */
--color-confidence-low: #dc2626;    /* <85% confidence */

/* Neutral Colors */
--color-gray-50: #f9fafb;
--color-gray-100: #f3f4f6;
--color-gray-200: #e5e7eb;
--color-gray-500: #6b7280;
--color-gray-700: #374151;
--color-gray-900: #111827;
```

### Typography Scale
```css
/* Font Families */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Monaco', 'Consolas', monospace;

/* Font Sizes */
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

### Spacing & Layout
```css
/* Spacing Scale */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */

/* Border Radius */
--radius-sm: 0.125rem;    /* 2px */
--radius-md: 0.375rem;    /* 6px */
--radius-lg: 0.5rem;      /* 8px */
--radius-xl: 0.75rem;     /* 12px */

/* Shadows */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
```

## Core Components

### 1. Executive KPI Card

#### Component Structure
```tsx
interface KPICardProps {
  title: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    timeframe: string;
  };
  subtitle?: string;
  icon?: React.ComponentType<{className?: string}>;
  status?: 'success' | 'warning' | 'error' | 'neutral';
  onClick?: () => void;
  className?: string;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  trend,
  subtitle,
  icon: Icon,
  status = 'neutral',
  onClick,
  className
}) => {
  return (
    <div 
      className={`kpi-card kpi-card--${status} ${className || ''}`}
      onClick={onClick}
    >
      <div className="kpi-card__header">
        <span className="kpi-card__title">{title}</span>
        {Icon && <Icon className="kpi-card__icon" />}
      </div>
      
      <div className="kpi-card__content">
        <div className="kpi-card__value">{value}</div>
        {trend && (
          <div className={`kpi-card__trend kpi-card__trend--${trend.direction}`}>
            <TrendIcon direction={trend.direction} />
            <span>{Math.abs(trend.percentage)}% {trend.timeframe}</span>
          </div>
        )}
        {subtitle && (
          <div className="kpi-card__subtitle">{subtitle}</div>
        )}
      </div>
    </div>
  );
};
```

#### CSS Styles
```css
.kpi-card {
  @apply bg-white rounded-lg border border-gray-200 p-6 shadow-sm;
  @apply transition-all duration-200 hover:shadow-md cursor-pointer;
  min-height: 140px;
}

.kpi-card__header {
  @apply flex items-center justify-between mb-4;
}

.kpi-card__title {
  @apply text-sm font-medium text-gray-700;
}

.kpi-card__icon {
  @apply w-4 h-4 text-gray-400;
}

.kpi-card__content {
  @apply space-y-2;
}

.kpi-card__value {
  @apply text-2xl font-bold text-gray-900;
}

.kpi-card__trend {
  @apply flex items-center space-x-1 text-xs;
}

.kpi-card__trend--up {
  @apply text-green-600;
}

.kpi-card__trend--down {
  @apply text-red-600;
}

.kpi-card__trend--stable {
  @apply text-gray-500;
}

.kpi-card__subtitle {
  @apply text-xs text-gray-500;
}

/* Status variants */
.kpi-card--success {
  @apply border-green-200 bg-green-50;
}

.kpi-card--success .kpi-card__value {
  @apply text-green-700;
}

.kpi-card--warning {
  @apply border-yellow-200 bg-yellow-50;
}

.kpi-card--warning .kpi-card__value {
  @apply text-yellow-700;
}

.kpi-card--error {
  @apply border-red-200 bg-red-50;
}

.kpi-card--error .kpi-card__value {
  @apply text-red-700;
}
```

### 2. AI Confidence Meter

#### Component Structure
```tsx
interface ConfidenceMeterProps {
  confidence: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  threshold?: {
    high: number;    // Default: 95
    medium: number;  // Default: 85
    low: number;     // Default: 70
  };
  explanation?: string[];
}

const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  confidence,
  size = 'md',
  showLabel = true,
  threshold = { high: 95, medium: 85, low: 70 },
  explanation = []
}) => {
  const getConfidenceLevel = () => {
    if (confidence >= threshold.high) return 'high';
    if (confidence >= threshold.medium) return 'medium';
    return 'low';
  };

  const level = getConfidenceLevel();
  const radius = size === 'sm' ? 30 : size === 'md' ? 40 : 50;
  const strokeWidth = size === 'sm' ? 4 : size === 'md' ? 6 : 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (confidence / 100) * circumference;

  return (
    <div className={`confidence-meter confidence-meter--${size}`}>
      <div className="confidence-meter__chart">
        <svg 
          width={radius * 2 + strokeWidth} 
          height={radius * 2 + strokeWidth}
          className="confidence-meter__svg"
        >
          {/* Background circle */}
          <circle
            cx={radius + strokeWidth / 2}
            cy={radius + strokeWidth / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="confidence-meter__background"
          />
          {/* Progress circle */}
          <circle
            cx={radius + strokeWidth / 2}
            cy={radius + strokeWidth / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`confidence-meter__progress confidence-meter__progress--${level}`}
            transform={`rotate(-90 ${radius + strokeWidth / 2} ${radius + strokeWidth / 2})`}
          />
        </svg>
        <div className="confidence-meter__label">
          <span className={`confidence-meter__value confidence-meter__value--${level}`}>
            {confidence}%
          </span>
        </div>
      </div>
      
      {showLabel && (
        <div className={`confidence-meter__status confidence-meter__status--${level}`}>
          {level.charAt(0).toUpperCase() + level.slice(1)} Confidence
        </div>
      )}
      
      {explanation.length > 0 && (
        <div className="confidence-meter__explanation">
          <details>
            <summary>Why this confidence level?</summary>
            <ul>
              {explanation.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
};
```

#### CSS Styles
```css
.confidence-meter {
  @apply flex flex-col items-center space-y-2;
}

.confidence-meter__chart {
  @apply relative;
}

.confidence-meter__svg {
  @apply transform -rotate-90;
}

.confidence-meter__background {
  @apply text-gray-200;
}

.confidence-meter__progress--high {
  @apply text-green-500;
}

.confidence-meter__progress--medium {
  @apply text-yellow-500;
}

.confidence-meter__progress--low {
  @apply text-red-500;
}

.confidence-meter__label {
  @apply absolute inset-0 flex items-center justify-center;
}

.confidence-meter__value {
  @apply font-bold text-center;
}

.confidence-meter__value--high {
  @apply text-green-600;
}

.confidence-meter__value--medium {
  @apply text-yellow-600;
}

.confidence-meter__value--low {
  @apply text-red-600;
}

.confidence-meter--sm .confidence-meter__value {
  @apply text-xs;
}

.confidence-meter--md .confidence-meter__value {
  @apply text-sm;
}

.confidence-meter--lg .confidence-meter__value {
  @apply text-lg;
}

.confidence-meter__status {
  @apply text-xs font-medium text-center;
}

.confidence-meter__status--high {
  @apply text-green-600;
}

.confidence-meter__status--medium {
  @apply text-yellow-600;
}

.confidence-meter__status--low {
  @apply text-red-600;
}

.confidence-meter__explanation {
  @apply text-xs text-gray-600 max-w-xs;
}

.confidence-meter__explanation details {
  @apply mt-2;
}

.confidence-meter__explanation summary {
  @apply cursor-pointer font-medium hover:text-blue-600;
}

.confidence-meter__explanation ul {
  @apply list-disc list-inside mt-1 space-y-1;
}
```

### 3. Risk Score Visualization

#### Component Structure
```tsx
interface RiskScoreProps {
  inherentRisk: number;  // 1-25 scale
  residualRisk: number;  // 1-25 scale
  riskAppetite: {
    target: number;
    tolerance: number;
  };
  trend?: {
    direction: 'increasing' | 'decreasing' | 'stable';
    confidence: number;
  };
  category?: string;
  showDetails?: boolean;
}

const RiskScore: React.FC<RiskScoreProps> = ({
  inherentRisk,
  residualRisk,
  riskAppetite,
  trend,
  category,
  showDetails = false
}) => {
  const getRiskLevel = (score: number) => {
    if (score >= 20) return 'critical';
    if (score >= 15) return 'high';
    if (score >= 10) return 'medium';
    if (score >= 5) return 'low';
    return 'minimal';
  };

  const inherentLevel = getRiskLevel(inherentRisk);
  const residualLevel = getRiskLevel(residualRisk);

  return (
    <div className="risk-score">
      <div className="risk-score__header">
        {category && <span className="risk-score__category">{category}</span>}
        {trend && (
          <div className={`risk-score__trend risk-score__trend--${trend.direction}`}>
            <TrendIcon direction={trend.direction} />
            <span className="text-xs">{trend.confidence}% confidence</span>
          </div>
        )}
      </div>

      <div className="risk-score__visualization">
        <div className="risk-score__scale">
          {/* Risk scale background */}
          <div className="risk-score__scale-track">
            <div className="risk-score__zone risk-score__zone--minimal" style={{width: '20%'}}></div>
            <div className="risk-score__zone risk-score__zone--low" style={{width: '20%'}}></div>
            <div className="risk-score__zone risk-score__zone--medium" style={{width: '20%'}}></div>
            <div className="risk-score__zone risk-score__zone--high" style={{width: '20%'}}></div>
            <div className="risk-score__zone risk-score__zone--critical" style={{width: '20%'}}></div>
          </div>

          {/* Risk appetite markers */}
          <div 
            className="risk-score__marker risk-score__marker--target" 
            style={{left: `${(riskAppetite.target / 25) * 100}%`}}
          >
            <div className="risk-score__marker-label">Target</div>
          </div>
          <div 
            className="risk-score__marker risk-score__marker--tolerance" 
            style={{left: `${(riskAppetite.tolerance / 25) * 100}%`}}
          >
            <div className="risk-score__marker-label">Tolerance</div>
          </div>

          {/* Risk score indicators */}
          <div 
            className={`risk-score__indicator risk-score__indicator--inherent risk-score__indicator--${inherentLevel}`}
            style={{left: `${(inherentRisk / 25) * 100}%`}}
          >
            <div className="risk-score__indicator-value">{inherentRisk.toFixed(1)}</div>
          </div>
          <div 
            className={`risk-score__indicator risk-score__indicator--residual risk-score__indicator--${residualLevel}`}
            style={{left: `${(residualRisk / 25) * 100}%`}}
          >
            <div className="risk-score__indicator-value">{residualRisk.toFixed(1)}</div>
          </div>
        </div>

        <div className="risk-score__legend">
          <div className="risk-score__legend-item">
            <div className="risk-score__legend-color risk-score__legend-color--inherent"></div>
            <span>Inherent Risk: {inherentRisk.toFixed(1)}</span>
          </div>
          <div className="risk-score__legend-item">
            <div className="risk-score__legend-color risk-score__legend-color--residual"></div>
            <span>Residual Risk: {residualRisk.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="risk-score__details">
          <div className="risk-score__metrics">
            <div className="risk-score__metric">
              <span className="risk-score__metric-label">Risk Reduction</span>
              <span className="risk-score__metric-value">
                {((inherentRisk - residualRisk) / inherentRisk * 100).toFixed(1)}%
              </span>
            </div>
            <div className="risk-score__metric">
              <span className="risk-score__metric-label">Vs Target</span>
              <span className={`risk-score__metric-value ${
                residualRisk <= riskAppetite.target ? 'text-green-600' : 'text-red-600'
              }`}>
                {residualRisk <= riskAppetite.target ? '✓ Achieved' : '⚠ Above'}
              </span>
            </div>
            <div className="risk-score__metric">
              <span className="risk-score__metric-label">Vs Tolerance</span>
              <span className={`risk-score__metric-value ${
                residualRisk <= riskAppetite.tolerance ? 'text-green-600' : 'text-red-600'
              }`}>
                {residualRisk <= riskAppetite.tolerance ? '✓ Within' : '⚠ Exceeds'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

#### CSS Styles
```css
.risk-score {
  @apply bg-white rounded-lg border border-gray-200 p-4;
}

.risk-score__header {
  @apply flex items-center justify-between mb-4;
}

.risk-score__category {
  @apply text-sm font-medium text-gray-700;
}

.risk-score__trend {
  @apply flex items-center space-x-1 text-xs;
}

.risk-score__trend--increasing {
  @apply text-red-600;
}

.risk-score__trend--decreasing {
  @apply text-green-600;
}

.risk-score__trend--stable {
  @apply text-gray-500;
}

.risk-score__visualization {
  @apply space-y-3;
}

.risk-score__scale {
  @apply relative h-12;
}

.risk-score__scale-track {
  @apply flex h-6 rounded-full overflow-hidden border border-gray-300;
}

.risk-score__zone--minimal {
  @apply bg-green-200;
}

.risk-score__zone--low {
  @apply bg-green-300;
}

.risk-score__zone--medium {
  @apply bg-yellow-300;
}

.risk-score__zone--high {
  @apply bg-orange-300;
}

.risk-score__zone--critical {
  @apply bg-red-300;
}

.risk-score__marker {
  @apply absolute top-0 h-6 w-0.5 bg-gray-600;
  transform: translateX(-50%);
}

.risk-score__marker--target {
  @apply bg-blue-600;
}

.risk-score__marker--tolerance {
  @apply bg-purple-600;
}

.risk-score__marker-label {
  @apply absolute -top-6 left-1/2 transform -translate-x-1/2;
  @apply text-xs font-medium whitespace-nowrap;
}

.risk-score__indicator {
  @apply absolute top-8 w-12 h-8 rounded-full border-2 border-white;
  @apply flex items-center justify-center text-white text-xs font-bold;
  transform: translateX(-50%);
}

.risk-score__indicator--inherent {
  @apply opacity-70;
}

.risk-score__indicator--minimal {
  @apply bg-green-500;
}

.risk-score__indicator--low {
  @apply bg-green-600;
}

.risk-score__indicator--medium {
  @apply bg-yellow-600;
}

.risk-score__indicator--high {
  @apply bg-orange-600;
}

.risk-score__indicator--critical {
  @apply bg-red-600;
}

.risk-score__indicator-value {
  @apply text-xs font-bold;
}

.risk-score__legend {
  @apply flex items-center space-x-4 text-sm;
}

.risk-score__legend-item {
  @apply flex items-center space-x-2;
}

.risk-score__legend-color {
  @apply w-3 h-3 rounded-full;
}

.risk-score__legend-color--inherent {
  @apply bg-gray-400 opacity-70;
}

.risk-score__legend-color--residual {
  @apply bg-blue-500;
}

.risk-score__details {
  @apply mt-4 pt-4 border-t border-gray-200;
}

.risk-score__metrics {
  @apply grid grid-cols-3 gap-4;
}

.risk-score__metric {
  @apply text-center;
}

.risk-score__metric-label {
  @apply block text-xs text-gray-500;
}

.risk-score__metric-value {
  @apply block text-sm font-medium mt-1;
}
```

### 4. Review Queue Item

#### Component Structure
```tsx
interface ReviewQueueItemProps {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  aiClassification: string;
  suggestedActions?: string[];
  assignee?: {
    name: string;
    avatar?: string;
  };
  dueDate?: Date;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onReview: (id: string) => void;
  onBulkSelect?: (id: string, selected: boolean) => void;
  isSelected?: boolean;
}

const ReviewQueueItem: React.FC<ReviewQueueItemProps> = ({
  id,
  title,
  description,
  priority,
  confidence,
  aiClassification,
  suggestedActions = [],
  assignee,
  dueDate,
  onAccept,
  onReject,
  onReview,
  onBulkSelect,
  isSelected = false
}) => {
  const priorityColors = {
    critical: 'border-red-500 bg-red-50',
    high: 'border-orange-500 bg-orange-50',
    medium: 'border-yellow-500 bg-yellow-50',
    low: 'border-green-500 bg-green-50'
  };

  const priorityIcons = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  };

  return (
    <div className={`review-queue-item ${priorityColors[priority]}`}>
      <div className="review-queue-item__header">
        <div className="review-queue-item__select">
          {onBulkSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onBulkSelect(id, e.target.checked)}
              className="review-queue-item__checkbox"
            />
          )}
        </div>

        <div className="review-queue-item__priority">
          <span className="review-queue-item__priority-icon">
            {priorityIcons[priority]}
          </span>
          <span className="review-queue-item__priority-text">
            {priority.toUpperCase()}
          </span>
        </div>

        <div className="review-queue-item__confidence">
          <ConfidenceMeter 
            confidence={confidence} 
            size="sm" 
            showLabel={false}
          />
          <span className="text-xs text-gray-600">{confidence}%</span>
        </div>
      </div>

      <div className="review-queue-item__content">
        <h3 className="review-queue-item__title">{title}</h3>
        <p className="review-queue-item__description">{description}</p>
        
        <div className="review-queue-item__classification">
          <div className="review-queue-item__classification-item">
            <span className="review-queue-item__label">AI Classification:</span>
            <span className="review-queue-item__value">{aiClassification}</span>
          </div>
        </div>

        {suggestedActions.length > 0 && (
          <div className="review-queue-item__suggestions">
            <span className="review-queue-item__label">Suggested Actions:</span>
            <ul className="review-queue-item__suggestion-list">
              {suggestedActions.map((action, index) => (
                <li key={index} className="review-queue-item__suggestion">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="review-queue-item__footer">
        <div className="review-queue-item__meta">
          {assignee && (
            <div className="review-queue-item__assignee">
              {assignee.avatar && (
                <img 
                  src={assignee.avatar} 
                  alt={assignee.name}
                  className="review-queue-item__avatar"
                />
              )}
              <span className="review-queue-item__assignee-name">
                {assignee.name}
              </span>
            </div>
          )}
          
          {dueDate && (
            <div className="review-queue-item__due-date">
              <Clock className="w-3 h-3" />
              <span className="text-xs">
                Due {format(dueDate, 'MMM d, yyyy')}
              </span>
            </div>
          )}
        </div>

        <div className="review-queue-item__actions">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReview(id)}
          >
            Review
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(id)}
            className="text-red-600 hover:text-red-700"
          >
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => onAccept(id)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
};
```

#### CSS Styles
```css
.review-queue-item {
  @apply border-l-4 rounded-lg p-4 mb-4 transition-all duration-200;
  @apply hover:shadow-md;
}

.review-queue-item__header {
  @apply flex items-center justify-between mb-3;
}

.review-queue-item__select {
  @apply flex items-center;
}

.review-queue-item__checkbox {
  @apply w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500;
}

.review-queue-item__priority {
  @apply flex items-center space-x-2;
}

.review-queue-item__priority-text {
  @apply text-xs font-bold;
}

.review-queue-item__confidence {
  @apply flex items-center space-x-2;
}

.review-queue-item__content {
  @apply space-y-3;
}

.review-queue-item__title {
  @apply text-lg font-medium text-gray-900;
}

.review-queue-item__description {
  @apply text-sm text-gray-600 line-clamp-2;
}

.review-queue-item__classification {
  @apply bg-gray-50 rounded-md p-2;
}

.review-queue-item__classification-item {
  @apply flex items-center space-x-2 text-sm;
}

.review-queue-item__label {
  @apply font-medium text-gray-700;
}

.review-queue-item__value {
  @apply text-gray-900;
}

.review-queue-item__suggestions {
  @apply space-y-1;
}

.review-queue-item__suggestion-list {
  @apply list-disc list-inside text-sm text-gray-600 space-y-1 ml-4;
}

.review-queue-item__footer {
  @apply flex items-center justify-between mt-4 pt-4 border-t border-gray-200;
}

.review-queue-item__meta {
  @apply flex items-center space-x-4;
}

.review-queue-item__assignee {
  @apply flex items-center space-x-2;
}

.review-queue-item__avatar {
  @apply w-6 h-6 rounded-full object-cover;
}

.review-queue-item__assignee-name {
  @apply text-sm text-gray-700;
}

.review-queue-item__due-date {
  @apply flex items-center space-x-1 text-gray-500;
}

.review-queue-item__actions {
  @apply flex items-center space-x-2;
}
```

### 5. AI Insight Panel

#### Component Structure
```tsx
interface AIInsightProps {
  type: 'critical' | 'opportunity' | 'pattern' | 'warning';
  title: string;
  description: string;
  evidence: string[];
  recommendations: {
    action: string;
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    timeline?: string;
    cost?: string;
  }[];
  confidence: number;
  limitations?: string[];
  onAction?: (action: string) => void;
  onDismiss?: () => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

const AIInsightPanel: React.FC<AIInsightProps> = ({
  type,
  title,
  description,
  evidence,
  recommendations,
  confidence,
  limitations = [],
  onAction,
  onDismiss,
  isExpanded = false,
  onToggleExpanded
}) => {
  const typeConfig = {
    critical: {
      icon: '🚨',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      titleColor: 'text-red-800'
    },
    opportunity: {
      icon: '💡',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      titleColor: 'text-blue-800'
    },
    pattern: {
      icon: '📊',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      titleColor: 'text-purple-800'
    },
    warning: {
      icon: '⚠️',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      titleColor: 'text-yellow-800'
    }
  };

  const config = typeConfig[type];

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'low': return 'text-gray-600 bg-gray-100';
      case 'medium': return 'text-blue-600 bg-blue-100';
      case 'high': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={`ai-insight-panel ${config.bgColor} ${config.borderColor}`}>
      <div className="ai-insight-panel__header">
        <div className="ai-insight-panel__title-section">
          <span className="ai-insight-panel__icon">{config.icon}</span>
          <h3 className={`ai-insight-panel__title ${config.titleColor}`}>
            {title}
          </h3>
          <div className="ai-insight-panel__confidence">
            <ConfidenceMeter 
              confidence={confidence} 
              size="sm" 
              showLabel={false}
            />
          </div>
        </div>
        
        <div className="ai-insight-panel__actions">
          {onToggleExpanded && (
            <button
              onClick={onToggleExpanded}
              className="ai-insight-panel__expand-btn"
            >
              {isExpanded ? '−' : '+'}
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="ai-insight-panel__dismiss-btn"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="ai-insight-panel__content">
        <p className="ai-insight-panel__description">{description}</p>

        {isExpanded && (
          <div className="ai-insight-panel__details">
            {evidence.length > 0 && (
              <div className="ai-insight-panel__section">
                <h4 className="ai-insight-panel__section-title">Evidence</h4>
                <ul className="ai-insight-panel__evidence-list">
                  {evidence.map((item, index) => (
                    <li key={index} className="ai-insight-panel__evidence-item">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ai-insight-panel__section">
              <h4 className="ai-insight-panel__section-title">Recommendations</h4>
              <div className="ai-insight-panel__recommendations">
                {recommendations.map((rec, index) => (
                  <div key={index} className="ai-insight-panel__recommendation">
                    <div className="ai-insight-panel__recommendation-header">
                      <span className="ai-insight-panel__recommendation-action">
                        {rec.action}
                      </span>
                      <div className="ai-insight-panel__recommendation-badges">
                        <span className={`ai-insight-panel__badge ${getEffortColor(rec.effort)}`}>
                          {rec.effort} effort
                        </span>
                        <span className={`ai-insight-panel__badge ${getImpactColor(rec.impact)}`}>
                          {rec.impact} impact
                        </span>
                      </div>
                    </div>
                    
                    {(rec.timeline || rec.cost) && (
                      <div className="ai-insight-panel__recommendation-meta">
                        {rec.timeline && (
                          <span className="ai-insight-panel__meta-item">
                            Timeline: {rec.timeline}
                          </span>
                        )}
                        {rec.cost && (
                          <span className="ai-insight-panel__meta-item">
                            Est. Cost: {rec.cost}
                          </span>
                        )}
                      </div>
                    )}

                    {onAction && (
                      <button
                        onClick={() => onAction(rec.action)}
                        className="ai-insight-panel__action-btn"
                      >
                        Take Action
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {limitations.length > 0 && (
              <div className="ai-insight-panel__section">
                <h4 className="ai-insight-panel__section-title">Limitations</h4>
                <ul className="ai-insight-panel__limitations-list">
                  {limitations.map((limitation, index) => (
                    <li key={index} className="ai-insight-panel__limitation">
                      {limitation}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
```

#### CSS Styles
```css
.ai-insight-panel {
  @apply border rounded-lg p-4 mb-4;
}

.ai-insight-panel__header {
  @apply flex items-center justify-between mb-3;
}

.ai-insight-panel__title-section {
  @apply flex items-center space-x-3 flex-1;
}

.ai-insight-panel__icon {
  @apply text-lg;
}

.ai-insight-panel__title {
  @apply text-lg font-semibold;
}

.ai-insight-panel__actions {
  @apply flex items-center space-x-2;
}

.ai-insight-panel__expand-btn,
.ai-insight-panel__dismiss-btn {
  @apply w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300;
  @apply flex items-center justify-center text-sm font-bold;
  @apply transition-colors duration-200;
}

.ai-insight-panel__content {
  @apply space-y-3;
}

.ai-insight-panel__description {
  @apply text-gray-700;
}

.ai-insight-panel__details {
  @apply space-y-4;
}

.ai-insight-panel__section {
  @apply space-y-2;
}

.ai-insight-panel__section-title {
  @apply text-sm font-semibold text-gray-800 uppercase tracking-wide;
}

.ai-insight-panel__evidence-list,
.ai-insight-panel__limitations-list {
  @apply list-disc list-inside text-sm text-gray-600 space-y-1 ml-2;
}

.ai-insight-panel__recommendations {
  @apply space-y-3;
}

.ai-insight-panel__recommendation {
  @apply bg-white rounded-md p-3 border border-gray-200;
}

.ai-insight-panel__recommendation-header {
  @apply flex items-start justify-between mb-2;
}

.ai-insight-panel__recommendation-action {
  @apply font-medium text-gray-900 flex-1;
}

.ai-insight-panel__recommendation-badges {
  @apply flex space-x-2;
}

.ai-insight-panel__badge {
  @apply px-2 py-1 rounded-full text-xs font-medium;
}

.ai-insight-panel__recommendation-meta {
  @apply flex space-x-4 text-xs text-gray-500 mb-2;
}

.ai-insight-panel__action-btn {
  @apply bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium;
  @apply px-3 py-1 rounded-md transition-colors duration-200;
}
```

## Responsive Design Breakpoints

### Mobile First Approach
```css
/* Base styles (mobile first) */
@media (min-width: 640px) {
  /* sm: tablets */
}

@media (min-width: 768px) {
  /* md: small laptops */
}

@media (min-width: 1024px) {
  /* lg: desktops */
}

@media (min-width: 1280px) {
  /* xl: large screens */
}
```

### Component Responsive Adaptations

#### KPI Cards
```css
/* Mobile: Stack vertically */
.kpi-grid {
  @apply grid grid-cols-1 gap-4;
}

/* Tablet: 2x2 grid */
@media (min-width: 768px) {
  .kpi-grid {
    @apply grid-cols-2;
  }
}

/* Desktop: 4 columns */
@media (min-width: 1024px) {
  .kpi-grid {
    @apply grid-cols-4;
  }
}
```

#### Dashboard Layout
```css
/* Mobile: Single column */
.dashboard-layout {
  @apply flex flex-col space-y-6;
}

/* Desktop: Two column */
@media (min-width: 1024px) {
  .dashboard-layout {
    @apply grid grid-cols-3 gap-6;
  }
  
  .dashboard-layout__main {
    @apply col-span-2;
  }
  
  .dashboard-layout__sidebar {
    @apply col-span-1;
  }
}
```

## Accessibility Features

### Keyboard Navigation
```css
/* Focus indicators */
*:focus {
  @apply outline-none ring-2 ring-blue-500 ring-offset-2;
}

/* Skip links */
.skip-link {
  @apply sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4;
  @apply bg-blue-600 text-white px-4 py-2 rounded-md z-50;
}
```

### Screen Reader Support
```tsx
// ARIA labels and roles
<div role="region" aria-label="Risk Assessment Dashboard">
  <h1 id="dashboard-title">Risk Assessment Dashboard</h1>
  <div aria-labelledby="dashboard-title">
    {/* Dashboard content */}
  </div>
</div>

// Live regions for dynamic updates
<div aria-live="polite" aria-label="Status updates">
  {statusMessage}
</div>
```

### High Contrast Mode
```css
@media (prefers-contrast: high) {
  .risk-score__indicator {
    @apply border-2 border-black;
  }
  
  .confidence-meter__progress--high {
    @apply text-green-800;
  }
  
  .kpi-card {
    @apply border-2 border-gray-800;
  }
}
```

## Performance Optimizations

### Lazy Loading
```tsx
// Lazy load heavy components
const RiskHeatmap = lazy(() => import('./RiskHeatmap'));
const DetailedAnalysis = lazy(() => import('./DetailedAnalysis'));

// Virtual scrolling for large lists
import { FixedSizeList as List } from 'react-window';

const VirtualizedReviewQueue = ({ items }) => (
  <List
    height={600}
    itemCount={items.length}
    itemSize={120}
  >
    {({ index, style }) => (
      <div style={style}>
        <ReviewQueueItem {...items[index]} />
      </div>
    )}
  </List>
);
```

### Caching Strategy
```tsx
// React Query for server state
const useRiskScores = () => {
  return useQuery({
    queryKey: ['risk-scores'],
    queryFn: fetchRiskScores,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Memoization for expensive calculations
const MemoizedRiskVisualization = memo(({ data }) => {
  const processedData = useMemo(() => {
    return processRiskData(data);
  }, [data]);

  return <RiskVisualization data={processedData} />;
});
```

This comprehensive component specification provides the development team with detailed implementation guidance for creating the AI-powered GRC dashboard interfaces, ensuring consistency, accessibility, and performance across the platform.