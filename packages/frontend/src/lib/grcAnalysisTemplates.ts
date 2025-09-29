/**
 * GRC Analysis Templates and Helper Functions
 * Provides structured templates for professional GRC reporting
 */

export interface RiskAnalysisTemplate {
  executiveSummary: {
    totalRisks: number;
    criticalRisks: number;
    highRisks: number;
    mediumRisks: number;
    lowRisks: number;
    trendIndicator: 'improving' | 'stable' | 'deteriorating';
    keyFindings: string[];
    immediateActions: string[];
  };
  riskCategories: Array<{
    category: string;
    icon: string;
    count: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  detailedRisks: Array<{
    id: string;
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    score: number;
    owner: string;
    businessUnit: string;
    controlEffectiveness: number;
    mitigationStatus: string;
    timeline: string;
    residualRisk: number;
  }>;
  recommendations: Array<{
    priority: 'P1' | 'P2' | 'P3';
    action: string;
    timeline: string;
    resources: string;
    expectedOutcome: string;
  }>;
}

export interface ComplianceAnalysisTemplate {
  complianceDashboard: {
    overallScore: number;
    frameworks: Array<{
      name: string;
      coverage: number;
      status: 'compliant' | 'partial' | 'non-compliant';
      nextAudit: string;
    }>;
    auditReadiness: number;
    openFindings: number;
  };
  controlAssessment: {
    totalControls: number;
    effective: number;
    partiallyEffective: number;
    ineffective: number;
    untested: number;
  };
  gaps: Array<{
    requirement: string;
    currentState: string;
    targetState: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    remediationEffort: string;
  }>;
  remediationRoadmap: {
    phase1: { timeline: string; actions: string[]; cost: string };
    phase2: { timeline: string; actions: string[]; cost: string };
    phase3: { timeline: string; actions: string[]; cost: string };
  };
}

export interface ExecutiveReportTemplate {
  dashboard: {
    riskScore: number;
    complianceHealth: number;
    controlEffectiveness: number;
    incidentsMTD: number;
    auditFindings: number;
    riskAppetiteUsage: number;
  };
  strategicRisks: Array<{
    title: string;
    impact: string;
    financialExposure: string;
    mitigation: string;
    investment: string;
  }>;
  boardInsights: {
    governanceMaturity: string;
    peerBenchmark: string;
    regulatoryOutlook: string;
    strategicRecommendations: string[];
  };
  investments: {
    immediate: Array<{ initiative: string; cost: string; roi: string }>;
    planned: Array<{ initiative: string; cost: string; timeline: string }>;
  };
}

/**
 * Format risk severity with appropriate visual indicator
 */
export function formatRiskSeverity(severity: string): string {
  const indicators: Record<string, string> = {
    critical: '🔴 Critical',
    high: '🟠 High',
    medium: '🟡 Medium',
    low: '🟢 Low',
  };
  return indicators[severity.toLowerCase()] || severity;
}

/**
 * Format trend indicator
 */
export function formatTrend(trend: 'up' | 'down' | 'stable' | 'improving' | 'deteriorating'): string {
  const indicators = {
    up: '↑',
    down: '↓',
    stable: '→',
    improving: '↓ Improving',
    deteriorating: '↑ Deteriorating',
  };
  return indicators[trend] || '→';
}

/**
 * Format compliance status
 */
export function formatComplianceStatus(status: string): string {
  const indicators: Record<string, string> = {
    compliant: '✅ Compliant',
    partial: '⚠️ Partially Compliant',
    'non-compliant': '❌ Non-Compliant',
    good: '✅',
    warning: '⚠️',
    critical: '❌',
  };
  return indicators[status.toLowerCase()] || status;
}

/**
 * Generate risk distribution table
 */
export function generateRiskDistributionTable(
  risks: Array<{ businessUnit: string; count: number; percentage: number }>
): string {
  let table = `┌────────────────────────────────────────┐
│ Business Unit Risk Distribution        │
├────────────────────────────────────────┤
│ Unit          │ Count │ Percentage     │
├────────────────────────────────────────┤\n`;

  risks.forEach(risk => {
    const unit = risk.businessUnit.padEnd(13);
    const count = risk.count.toString().padEnd(5);
    const percentage = `${risk.percentage}%`.padEnd(14);
    table += `│ ${unit} │ ${count} │ ${percentage} │\n`;
  });

  table += '└────────────────────────────────────────┘';
  return table;
}

/**
 * Generate executive dashboard
 */
export function generateExecutiveDashboard(metrics: ExecutiveReportTemplate['dashboard']): string {
  return `┌─────────────────────────────────────────────┐
│          EXECUTIVE GRC DASHBOARD           │
├─────────────────────────────────────────────┤
│ Overall Risk Score:        ${metrics.riskScore}/10 ${metrics.riskScore > 7 ? '↑' : metrics.riskScore > 4 ? '→' : '↓'}        │
│ Compliance Health:         ${metrics.complianceHealth}% ${metrics.complianceHealth >= 90 ? '✅' : metrics.complianceHealth >= 70 ? '⚠️' : '❌'}          │
│ Control Effectiveness:     ${metrics.controlEffectiveness}% ${metrics.controlEffectiveness >= 80 ? '✅' : metrics.controlEffectiveness >= 60 ? '⚠️' : '❌'}          │
│ Incidents (MTD):          ${metrics.incidentsMTD} Critical       │
│ Audit Findings:           ${metrics.auditFindings} Open          │
│ Risk Appetite Usage:      ${metrics.riskAppetiteUsage}% ${metrics.riskAppetiteUsage > 80 ? '🔴' : metrics.riskAppetiteUsage > 60 ? '🟡' : '🟢'}           │
└─────────────────────────────────────────────┘`;
}

/**
 * Generate compliance matrix
 */
export function generateComplianceMatrix(frameworks: ComplianceAnalysisTemplate['complianceDashboard']['frameworks']): string {
  let matrix = `┌────────────────────────────────────────────────┐
│ Compliance Framework Status                    │
├────────────────────────────────────────────────┤
│ Framework   │ Coverage │ Status     │ Next Audit│
├────────────────────────────────────────────────┤\n`;

  frameworks.forEach(fw => {
    const name = fw.name.padEnd(11);
    const coverage = `${fw.coverage}%`.padEnd(8);
    const status = formatComplianceStatus(fw.status).padEnd(10);
    const audit = fw.nextAudit.padEnd(10);
    matrix += `│ ${name} │ ${coverage} │ ${status} │ ${audit}│\n`;
  });

  matrix += '└────────────────────────────────────────────────┘';
  return matrix;
}

/**
 * Generate risk heat map
 */
export function generateRiskHeatMap(
  risks: Array<{ likelihood: number; impact: number; count: number }>
): string {
  const heatMap = Array(3).fill(null).map(() => Array(4).fill(0));
  
  risks.forEach(risk => {
    const likelihoodIndex = Math.min(2, Math.floor((risk.likelihood - 1) / 2));
    const impactIndex = Math.min(3, Math.floor((risk.impact - 1) / 1.25));
    heatMap[likelihoodIndex][impactIndex] += risk.count;
  });

  return `        Impact →
    Low    Medium    High    Critical
High  [${heatMap[2][0]}]    [${heatMap[2][1]}]     [${heatMap[2][2]}]      [${heatMap[2][3]}]
Med   [${heatMap[1][0]}]    [${heatMap[1][1]}]     [${heatMap[1][2]}]      [${heatMap[1][3]}]
Low   [${heatMap[0][0]}]    [${heatMap[0][1]}]     [${heatMap[0][2]}]      [${heatMap[0][3]}]
    ↑ Likelihood`;
}

/**
 * Generate KRI dashboard
 */
export function generateKRIDashboard(
  kris: Array<{ name: string; current: number; threshold: number; trend: 'up' | 'down' | 'stable' }>
): string {
  let dashboard = `┌──────────────────────────────────────────┐
│ KRI Dashboard                            │
├──────────────────────────────────────────┤
│ KRI Name │ Current │ Threshold │ Trend  │
├──────────────────────────────────────────┤\n`;

  kris.forEach(kri => {
    const name = kri.name.substring(0, 8).padEnd(8);
    const current = kri.current.toString().padEnd(7);
    const threshold = kri.threshold.toString().padEnd(9);
    const trend = formatTrend(kri.trend).padEnd(6);
    dashboard += `│ ${name} │ ${current} │ ${threshold} │ ${trend} │\n`;
  });

  dashboard += '└──────────────────────────────────────────┘';
  return dashboard;
}

/**
 * Generate maturity assessment
 */
export function generateMaturityAssessment(
  domains: Array<{ domain: string; level: number; target: number }>
): string {
  let assessment = '## Risk Maturity Assessment\n\n';
  
  domains.forEach(d => {
    const filled = '█'.repeat(d.level);
    const empty = '░'.repeat(5 - d.level);
    const gap = d.target - d.level;
    assessment += `**${d.domain}**\n`;
    assessment += `Current: [${filled}${empty}] Level ${d.level}/5\n`;
    assessment += `Target:  Level ${d.target}/5 (Gap: ${gap})\n\n`;
  });
  
  return assessment;
}

/**
 * Generate action plan timeline
 */
export function generateActionTimeline(
  actions: Array<{ action: string; timeline: string; priority: string }>
): string {
  let timeline = '## Action Plan Timeline\n\n';
  
  const grouped = {
    immediate: actions.filter(a => a.timeline.includes('0-30') || a.timeline.includes('immediate')),
    shortTerm: actions.filter(a => a.timeline.includes('1-3 month') || a.timeline.includes('30-90')),
    longTerm: actions.filter(a => a.timeline.includes('3-12') || a.timeline.includes('90+')),
  };
  
  if (grouped.immediate.length > 0) {
    timeline += '### 🔴 Immediate Actions (0-30 days)\n';
    grouped.immediate.forEach(a => {
      timeline += `- [${a.priority}] ${a.action}\n`;
    });
    timeline += '\n';
  }
  
  if (grouped.shortTerm.length > 0) {
    timeline += '### 🟠 Short-term Actions (1-3 months)\n';
    grouped.shortTerm.forEach(a => {
      timeline += `- [${a.priority}] ${a.action}\n`;
    });
    timeline += '\n';
  }
  
  if (grouped.longTerm.length > 0) {
    timeline += '### 🟡 Long-term Actions (3-12 months)\n';
    grouped.longTerm.forEach(a => {
      timeline += `- [${a.priority}] ${a.action}\n`;
    });
  }
  
  return timeline;
}

/**
 * Calculate risk statistics from raw data
 */
export function calculateRiskStatistics(
  risks: Array<{ severity: string; score?: number }>
): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  averageScore: number;
  criticalPercentage: number;
  highPercentage: number;
} {
  const stats = {
    total: risks.length,
    critical: risks.filter(r => r.severity?.toLowerCase() === 'critical').length,
    high: risks.filter(r => r.severity?.toLowerCase() === 'high').length,
    medium: risks.filter(r => r.severity?.toLowerCase() === 'medium').length,
    low: risks.filter(r => r.severity?.toLowerCase() === 'low').length,
    averageScore: 0,
    criticalPercentage: 0,
    highPercentage: 0,
  };
  
  if (stats.total > 0) {
    stats.criticalPercentage = Math.round((stats.critical / stats.total) * 100);
    stats.highPercentage = Math.round((stats.high / stats.total) * 100);
    
    const scores = risks.filter(r => r.score).map(r => r.score!);
    if (scores.length > 0) {
      stats.averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
    }
  }
  
  return stats;
}

/**
 * Generate professional risk summary
 */
export function generateProfessionalRiskSummary(
  stats: ReturnType<typeof calculateRiskStatistics>,
  additionalContext?: {
    businessUnits?: number;
    controlsCoverage?: number;
    timeframe?: string;
  }
): string {
  const riskLevel = stats.criticalPercentage > 20 ? 'Critical' :
                   stats.criticalPercentage > 10 || stats.highPercentage > 30 ? 'High' :
                   stats.highPercentage > 20 ? 'Moderate' : 'Low';
  
  let summary = `## Executive Risk Summary\n\n`;
  summary += `**Overall Risk Profile**: ${riskLevel}\n`;
  summary += `**Analysis Period**: ${additionalContext?.timeframe || 'Current'}\n\n`;
  
  summary += `### Key Statistics\n`;
  summary += `- **Total Risks Identified**: ${stats.total}\n`;
  summary += `- **Critical Risks**: ${stats.critical} (${stats.criticalPercentage}%)\n`;
  summary += `- **High Risks**: ${stats.high} (${stats.highPercentage}%)\n`;
  summary += `- **Medium Risks**: ${stats.medium} (${Math.round((stats.medium / stats.total) * 100)}%)\n`;
  summary += `- **Low Risks**: ${stats.low} (${Math.round((stats.low / stats.total) * 100)}%)\n`;
  
  if (stats.averageScore > 0) {
    summary += `- **Average Risk Score**: ${stats.averageScore}/10\n`;
  }
  
  if (additionalContext?.businessUnits) {
    summary += `- **Business Units Affected**: ${additionalContext.businessUnits}\n`;
  }
  
  if (additionalContext?.controlsCoverage) {
    summary += `- **Controls Coverage**: ${additionalContext.controlsCoverage}%\n`;
  }
  
  summary += `\n### Risk Assessment\n`;
  
  if (stats.criticalPercentage > 20) {
    summary += `⚠️ **CRITICAL ATTENTION REQUIRED**: More than 20% of identified risks are critical. Immediate executive action and resource allocation required.\n`;
  } else if (stats.criticalPercentage > 10) {
    summary += `🟠 **Elevated Risk Level**: Significant number of critical risks require prompt attention and mitigation planning.\n`;
  } else if (stats.highPercentage > 30) {
    summary += `🟡 **Moderate Risk Exposure**: While critical risks are controlled, the high number of elevated risks requires ongoing monitoring and gradual mitigation.\n`;
  } else {
    summary += `🟢 **Risk Profile Within Tolerance**: Current risk distribution appears manageable with existing controls and resources.\n`;
  }
  
  return summary;
}