import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Target,
  FileCheck,
  Users,
  Building2,
  BarChart3,
  Lightbulb,
  AlertCircle,
  Star,
  Clock
} from 'lucide-react';
import { clsx } from 'clsx';

interface ParsedAIReport {
  title: string;
  metadata: {
    industry: string;
    focus: string;
    type: string;
    generated: string;
    confidence: number;
  };
  sections: Array<{
    title: string;
    type: 'overview' | 'analysis' | 'compliance' | 'predictions' | 'recommendations' | 'executive' | 'summary';
    content: Array<{
      type: 'text' | 'list' | 'metric' | 'subsection';
      title?: string;
      content: string;
      items?: string[];
      value?: string | number;
      trend?: 'up' | 'down' | 'stable';
      severity?: 'low' | 'medium' | 'high' | 'critical';
    }>;
  }>;
  keyFindings: string[];
  recommendations: Array<{
    category: string;
    content: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  }>;
  footer: string;
}

interface StructuredAIReportProps {
  rawContent: string;
}

export const StructuredAIReport: React.FC<StructuredAIReportProps> = ({ rawContent }) => {
  const parseAIReport = (content: string): ParsedAIReport => {
    const lines = content.split('\n');
    const report: ParsedAIReport = {
      title: '',
      metadata: {
        industry: '',
        focus: '',
        type: '',
        generated: '',
        confidence: 0
      },
      sections: [],
      keyFindings: [],
      recommendations: [],
      footer: ''
    };

    let currentSection: any = null;
    let currentSubsection: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Parse title
      if (line.startsWith('# ') && line.includes('AI-Generated Insights')) {
        report.title = line.replace('# ', '').replace('🧠 ', '');
      }
      
      // Parse metadata
      if (line.includes('**Industry**:')) {
        const matches = line.match(/\*\*Industry\*\*:\s*([^|]+)\s*\|\s*\*\*Focus\*\*:\s*([^|]+)\s*\|\s*\*\*Type\*\*:\s*(.+)/);
        if (matches) {
          report.metadata.industry = matches[1].trim();
          report.metadata.focus = matches[2].trim();
          report.metadata.type = matches[3].trim();
        }
      }
      
      if (line.includes('**Analysis Generated**:')) {
        report.metadata.generated = line.replace('**Analysis Generated**: ', '');
      }
      
      if (line.includes('**AI Confidence**:')) {
        const match = line.match(/(\d+)%/);
        if (match) report.metadata.confidence = parseInt(match[1]);
      }
      
      // Parse sections
      if (line.startsWith('## ')) {
        if (currentSection) {
          report.sections.push(currentSection);
        }
        
        const sectionTitle = line.replace('## ', '').replace(/^[🎯📊🛡️📋🔮💡]+\s*/, '');
        currentSection = {
          title: sectionTitle,
          type: getSectionType(sectionTitle),
          content: []
        };
        currentSubsection = null;
      }
      
      // Parse subsections
      if (line.startsWith('### ')) {
        if (currentSubsection && currentSection) {
          currentSection.content.push(currentSubsection);
        }
        
        const subsectionTitle = line.replace('### ', '');
        currentSubsection = {
          type: 'subsection',
          title: subsectionTitle,
          content: '',
          items: []
        };
      }
      
      // Parse list items
      if (line.startsWith('- ') && currentSection) {
        const item = line.replace('- ', '');
        
        // Check if it's a structured item with bold labels
        const match = item.match(/\*\*([^*]+)\*\*:\s*(.+)/);
        if (match) {
          const label = match[1];
          const value = match[2];
          
          if (currentSubsection) {
            currentSubsection.items = currentSubsection.items || [];
            currentSubsection.items.push(`${label}: ${value}`);
          } else {
            currentSection.content.push({
              type: 'metric',
              title: label,
              content: value,
              trend: getTrendFromValue(value),
              severity: getSeverityFromValue(value)
            });
          }
        } else {
          if (currentSubsection) {
            currentSubsection.items = currentSubsection.items || [];
            currentSubsection.items.push(item);
          } else {
            currentSection.content.push({
              type: 'list',
              content: item
            });
          }
        }
      }
      
      // Parse key findings
      if (line.includes('🎯 Key Findings') || line.includes('**🎯 Key Findings**')) {
        for (let j = i + 1; j < lines.length && lines[j].trim().startsWith('- '); j++) {
          report.keyFindings.push(lines[j].trim().replace('- ', ''));
        }
      }
      
      // Parse recommendations
      if (line.includes('📝 Recommendations') || line.includes('**📝 Recommendations**')) {
        for (let j = i + 1; j < lines.length && lines[j].trim().startsWith('- '); j++) {
          const rec = lines[j].trim().replace('- ', '');
          const match = rec.match(/^([^:]+):\s*(.+)/);
          if (match) {
            report.recommendations.push({
              category: match[1],
              content: match[2],
              priority: getPriorityFromCategory(match[1])
            });
          }
        }
      }
      
      // Parse footer
      if (line.includes('Generated by AI Insights Engine')) {
        report.footer = line.replace(/^\*/, '').replace(/\*$/, '');
      }
    }
    
    // Add the last section
    if (currentSubsection && currentSection) {
      currentSection.content.push(currentSubsection);
    }
    if (currentSection) {
      report.sections.push(currentSection);
    }
    
    return report;
  };

  const getSectionType = (title: string): 'overview' | 'analysis' | 'compliance' | 'predictions' | 'recommendations' | 'executive' | 'summary' => {
    const lower = title.toLowerCase();
    if (lower.includes('compliance')) return 'compliance';
    if (lower.includes('prediction') || lower.includes('forecast')) return 'predictions';
    if (lower.includes('recommendation')) return 'recommendations';
    if (lower.includes('executive')) return 'executive';
    if (lower.includes('risk') || lower.includes('control')) return 'analysis';
    if (lower.includes('profile') || lower.includes('overview')) return 'overview';
    return 'summary';
  };

  const getTrendFromValue = (value: string): 'up' | 'down' | 'stable' => {
    if (value.includes('📈') || value.includes('increasing') || value.includes('improving')) return 'up';
    if (value.includes('📉') || value.includes('decreasing') || value.includes('declining')) return 'down';
    return 'stable';
  };

  const getSeverityFromValue = (value: string): 'low' | 'medium' | 'high' | 'critical' => {
    const lower = value.toLowerCase();
    if (lower.includes('critical') || lower.includes('urgent')) return 'critical';
    if (lower.includes('high') || lower.includes('significant')) return 'high';
    if (lower.includes('low') || lower.includes('minimal')) return 'low';
    return 'medium';
  };

  const getPriorityFromCategory = (category: string): 'low' | 'medium' | 'high' | 'urgent' => {
    const lower = category.toLowerCase();
    if (lower.includes('priority') || lower.includes('urgent')) return 'urgent';
    if (lower.includes('enhancement') || lower.includes('improvement')) return 'high';
    if (lower.includes('monitoring') || lower.includes('maintenance')) return 'medium';
    return 'low';
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'overview': return <BarChart3 className="h-5 w-5" />;
      case 'analysis': return <Target className="h-5 w-5" />;
      case 'compliance': return <FileCheck className="h-5 w-5" />;
      case 'predictions': return <TrendingUp className="h-5 w-5" />;
      case 'recommendations': return <Lightbulb className="h-5 w-5" />;
      case 'executive': return <Users className="h-5 w-5" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <ArrowRight className="h-4 w-4 text-gray-500" />;
  };

  const getSeverityColor = (severity?: 'low' | 'medium' | 'high' | 'critical') => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getPriorityIcon = (priority: 'low' | 'medium' | 'high' | 'urgent') => {
    switch (priority) {
      case 'urgent': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <Info className="h-4 w-4 text-yellow-500" />;
      default: return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  const report = parseAIReport(rawContent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Brain className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-xl">{report.title}</CardTitle>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-2">
                  <div className="flex items-center space-x-1">
                    <Building2 className="h-4 w-4" />
                    <span>{report.metadata.industry}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Target className="h-4 w-4" />
                    <span>{report.metadata.focus}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <BarChart3 className="h-4 w-4" />
                    <span>{report.metadata.type}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 text-lg font-semibold text-primary">
                <Star className="h-5 w-5" />
                <span>{report.metadata.confidence}%</span>
              </div>
              <div className="text-sm text-muted-foreground">AI Confidence</div>
              {report.metadata.generated && (
                <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(report.metadata.generated).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sections */}
      {report.sections.map((section, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getSectionIcon(section.type)}
              <span>{section.title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.content.map((item, itemIndex) => (
              <div key={itemIndex}>
                {item.type === 'subsection' && (
                  <div className="border-l-4 border-primary/20 pl-4 py-2">
                    <h4 className="font-semibold text-lg mb-2">{item.title}</h4>
                    {item.items && item.items.length > 0 && (
                      <div className="space-y-2">
                        {item.items.map((listItem, listIndex) => (
                          <div key={listIndex} className="flex items-start space-x-2 text-sm">
                            <div className="h-1.5 w-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                            <span>{listItem}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {item.type === 'metric' && (
                  <div className={clsx(
                    "p-3 rounded-lg border flex items-center justify-between",
                    getSeverityColor(item.severity)
                  )}>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{item.title}</span>
                      {item.trend && getTrendIcon(item.trend)}
                    </div>
                    <span className="font-mono text-sm">{item.content}</span>
                  </div>
                )}
                
                {item.type === 'list' && (
                  <div className="flex items-start space-x-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{item.content}</span>
                  </div>
                )}
                
                {item.type === 'text' && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.content}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Key Findings & Recommendations */}
      {(report.keyFindings.length > 0 || report.recommendations.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Key Findings */}
          {report.keyFindings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-primary" />
                  <span>Key Findings</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.keyFindings.map((finding, index) => (
                    <div key={index} className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-blue-800">{finding}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <span>Recommendations</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-muted/30 rounded-lg">
                      {getPriorityIcon(rec.priority)}
                      <div className="flex-1">
                        <div className="font-medium text-sm">{rec.category}</div>
                        <div className="text-sm text-muted-foreground mt-1">{rec.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Footer */}
      {report.footer && (
        <Card className="border-muted">
          <CardContent className="py-3">
            <div className="flex items-center justify-center text-sm text-muted-foreground">
              <Brain className="h-4 w-4 mr-2" />
              <span>{report.footer}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};