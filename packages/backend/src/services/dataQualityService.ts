/**
 * Smart Data Quality Checker Service
 * Use Case 1: AI/ML classification of incidents, risks, controls with confidence scoring
 */

import { OpenAI } from 'openai';

export interface DataQualityRequest {
  tenantId: string;
  recordType: 'incident' | 'risk' | 'control';
  data: {
    id: string;
    title: string;
    description: string;
    currentCategory?: string;
    currentSeverity?: string;
    currentStatus?: string;
  };
}

export interface DataQualityResult {
  recordId: string;
  recordType: string;
  
  // AI Classification Results
  suggestedClassification: {
    category: string;
    confidence: number; // 0-1
    reasoning: string;
  };
  
  // Quality Score
  qualityScore: number; // 0-1
  qualityIssues: string[];
  
  // Improvement Suggestions
  suggestions: {
    title?: string;
    description?: string;
    tags?: string[];
    riskRating?: string;
  };
  
  // Human Review Workflow
  requiresHumanReview: boolean;
  reviewThreshold: number;
  
  timestamp: Date;
}

export interface QualityDashboardData {
  tenantId: string;
  summary: {
    totalRecordsProcessed: number;
    averageQualityScore: number;
    recordsNeedingReview: number;
    autoClassifiedRecords: number;
    processingTime: number;
  };
  
  categoryDistribution: Array<{
    category: string;
    count: number;
    averageConfidence: number;
    autoClassifiedPercent: number;
  }>;
  
  qualityTrends: Array<{
    date: Date;
    qualityScore: number;
    recordsProcessed: number;
    averageConfidence: number;
  }>;
  
  recentlyProcessed: DataQualityResult[];
  pendingReview: DataQualityResult[];
}

export class DataQualityService {
  private openai: OpenAI | null = null;
  private taxonomyData: Record<string, any> = {};
  
  constructor() {
    // Initialize OpenAI if API key is available (for local testing)
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
    
    // Load organization taxonomy (mock for local development)
    this.loadTaxonomy();
  }

  /**
   * Process a single record for data quality improvement
   */
  async processRecord(request: DataQualityRequest): Promise<DataQualityResult> {
    const startTime = Date.now();
    
    // Step 1: Basic quality checks
    const qualityScore = this.calculateQualityScore(request.data);
    const qualityIssues = this.identifyQualityIssues(request.data);
    
    // Step 2: AI Classification
    let suggestedClassification;
    if (this.openai) {
      suggestedClassification = await this.aiClassify(request);
    } else {
      // Use rule-based classification for local development
      suggestedClassification = await this.ruleBasedClassify(request);
    }
    
    // Step 3: Generate improvement suggestions
    const suggestions = this.generateSuggestions(request.data, suggestedClassification);
    
    // Step 4: Determine if human review is needed
    const requiresHumanReview = suggestedClassification.confidence < 0.85 || qualityScore < 0.7;
    
    const processingTime = Date.now() - startTime;
    
    return {
      recordId: request.data.id,
      recordType: request.recordType,
      suggestedClassification,
      qualityScore,
      qualityIssues,
      suggestions,
      requiresHumanReview,
      reviewThreshold: 0.85,
      timestamp: new Date()
    };
  }

  /**
   * Get dashboard data for quality checker
   */
  async getDashboardData(tenantId: string): Promise<QualityDashboardData> {
    // In local development, generate realistic dashboard data
    return {
      tenantId,
      summary: {
        totalRecordsProcessed: 1247,
        averageQualityScore: 0.847,
        recordsNeedingReview: 89,
        autoClassifiedRecords: 1158,
        processingTime: 23.4
      },
      
      categoryDistribution: [
        {
          category: 'Privacy Breach',
          count: 234,
          averageConfidence: 0.91,
          autoClassifiedPercent: 94.2
        },
        {
          category: 'Operational Risk',
          count: 456,
          averageConfidence: 0.87,
          autoClassifiedPercent: 89.3
        },
        {
          category: 'Technology Risk',
          count: 334,
          averageConfidence: 0.82,
          autoClassifiedPercent: 85.7
        },
        {
          category: 'Compliance Gap',
          count: 167,
          averageConfidence: 0.79,
          autoClassifiedPercent: 78.4
        },
        {
          category: 'Financial Risk',
          count: 56,
          averageConfidence: 0.93,
          autoClassifiedPercent: 96.4
        }
      ],
      
      qualityTrends: this.generateQualityTrends(),
      recentlyProcessed: await this.getRecentlyProcessed(tenantId),
      pendingReview: await this.getPendingReview(tenantId)
    };
  }

  /**
   * AI-powered classification using OpenAI
   */
  private async aiClassify(request: DataQualityRequest): Promise<DataQualityResult['suggestedClassification']> {
    if (!this.openai) {
      return this.ruleBasedClassify(request);
    }

    const prompt = this.buildClassificationPrompt(request);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a GRC expert specializing in incident, risk, and control classification. Analyze the provided data and suggest the most appropriate category with confidence scoring."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      // Parse AI response (simplified for local development)
      const aiResponse = response.choices[0]?.message?.content || '';
      return this.parseAIResponse(aiResponse, request);
      
    } catch (error) {
      console.warn('OpenAI classification failed, using rule-based fallback:', error);
      return this.ruleBasedClassify(request);
    }
  }

  /**
   * Rule-based classification for local development
   */
  private async ruleBasedClassify(request: DataQualityRequest): Promise<DataQualityResult['suggestedClassification']> {
    const { data, recordType } = request;
    const text = `${data.title} ${data.description}`.toLowerCase();
    
    let category = 'Unknown';
    let confidence = 0.6;
    let reasoning = '';

    // Incident classification
    if (recordType === 'incident') {
      if (text.includes('privacy') || text.includes('data breach') || text.includes('gdpr')) {
        category = 'Privacy Breach';
        confidence = 0.92;
        reasoning = 'Contains privacy-related keywords and patterns consistent with data breach incidents';
      } else if (text.includes('system') || text.includes('outage') || text.includes('downtime')) {
        category = 'Technology Risk';
        confidence = 0.87;
        reasoning = 'System-related incident with technology infrastructure impact';
      } else if (text.includes('process') || text.includes('operational') || text.includes('workflow')) {
        category = 'Operational Risk';
        confidence = 0.83;
        reasoning = 'Process-related incident affecting business operations';
      }
    }

    // Risk classification
    else if (recordType === 'risk') {
      if (text.includes('cyber') || text.includes('security') || text.includes('hack')) {
        category = 'Technology Risk';
        confidence = 0.89;
        reasoning = 'Cybersecurity risk with potential system vulnerabilities';
      } else if (text.includes('compliance') || text.includes('regulatory') || text.includes('audit')) {
        category = 'Compliance Gap';
        confidence = 0.85;
        reasoning = 'Regulatory compliance risk requiring attention';
      } else if (text.includes('financial') || text.includes('fraud') || text.includes('money')) {
        category = 'Financial Risk';
        confidence = 0.91;
        reasoning = 'Financial risk with monetary impact potential';
      }
    }

    // Control classification  
    else if (recordType === 'control') {
      if (text.includes('access') || text.includes('authentication') || text.includes('authorization')) {
        category = 'Access Control';
        confidence = 0.88;
        reasoning = 'Access management control for security enforcement';
      } else if (text.includes('monitoring') || text.includes('detection') || text.includes('alert')) {
        category = 'Detective Control';
        confidence = 0.84;
        reasoning = 'Monitoring control for issue detection and alerting';
      }
    }

    return { category, confidence, reasoning };
  }

  /**
   * Calculate overall quality score for a record
   */
  private calculateQualityScore(data: any): number {
    let score = 1.0;
    
    // Title quality
    if (!data.title || data.title.length < 10) score -= 0.2;
    if (data.title && data.title.length > 100) score -= 0.1;
    
    // Description quality
    if (!data.description || data.description.length < 50) score -= 0.3;
    if (data.description && data.description.length < 20) score -= 0.2;
    
    // Completeness
    if (!data.currentCategory) score -= 0.2;
    if (!data.currentSeverity) score -= 0.1;
    
    return Math.max(0, score);
  }

  /**
   * Identify specific quality issues
   */
  private identifyQualityIssues(data: any): string[] {
    const issues: string[] = [];
    
    if (!data.title || data.title.length < 10) {
      issues.push('Title too short or missing');
    }
    
    if (!data.description || data.description.length < 50) {
      issues.push('Description lacks detail');
    }
    
    if (!data.currentCategory) {
      issues.push('Missing category classification');
    }
    
    if (data.description && data.description.toLowerCase() === data.title.toLowerCase()) {
      issues.push('Description is identical to title');
    }
    
    return issues;
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(data: any, classification: any): any {
    const suggestions: any = {};
    
    if (!data.title || data.title.length < 10) {
      suggestions.title = `Consider expanding: "${classification.category} - ${data.title || 'Untitled'}"`;
    }
    
    if (!data.description || data.description.length < 50) {
      suggestions.description = 'Add more context: What happened? When? What was the impact? What actions were taken?';
    }
    
    suggestions.tags = [`${classification.category}`, 'AI-Suggested', 'Needs-Review'];
    
    if (classification.category === 'Privacy Breach') {
      suggestions.riskRating = 'High';
      suggestions.tags.push('GDPR', 'Data-Protection');
    } else if (classification.category === 'Financial Risk') {
      suggestions.riskRating = 'Critical';
      suggestions.tags.push('Financial-Impact', 'Audit-Required');
    }
    
    return suggestions;
  }

  /**
   * Helper methods for dashboard data
   */
  private generateQualityTrends(): Array<{ date: Date; qualityScore: number; recordsProcessed: number; averageConfidence: number }> {
    const trends = [];
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      trends.push({
        date,
        qualityScore: 0.75 + Math.random() * 0.2, // 0.75-0.95
        recordsProcessed: Math.floor(20 + Math.random() * 40), // 20-60 per day
        averageConfidence: 0.8 + Math.random() * 0.15 // 0.8-0.95
      });
    }
    return trends;
  }

  private async getRecentlyProcessed(tenantId: string): Promise<DataQualityResult[]> {
    // Mock recent processing results for local development
    return [
      {
        recordId: 'INC-2024-001',
        recordType: 'incident',
        suggestedClassification: {
          category: 'Privacy Breach',
          confidence: 0.94,
          reasoning: 'Contains GDPR-related data breach indicators'
        },
        qualityScore: 0.89,
        qualityIssues: [],
        suggestions: { tags: ['Privacy', 'GDPR', 'High-Priority'] },
        requiresHumanReview: false,
        reviewThreshold: 0.85,
        timestamp: new Date(Date.now() - 5 * 60 * 1000)
      },
      {
        recordId: 'RSK-2024-045',
        recordType: 'risk',
        suggestedClassification: {
          category: 'Technology Risk',
          confidence: 0.76,
          reasoning: 'Cybersecurity risk with system vulnerabilities'
        },
        qualityScore: 0.67,
        qualityIssues: ['Description lacks detail', 'Missing impact assessment'],
        suggestions: { 
          description: 'Add technical details and impact assessment',
          tags: ['Technology', 'Cybersecurity', 'Needs-Detail']
        },
        requiresHumanReview: true,
        reviewThreshold: 0.85,
        timestamp: new Date(Date.now() - 12 * 60 * 1000)
      }
    ];
  }

  private async getPendingReview(tenantId: string): Promise<DataQualityResult[]> {
    // Mock pending review items
    return [
      {
        recordId: 'CTL-2024-078',
        recordType: 'control',
        suggestedClassification: {
          category: 'Access Control',
          confidence: 0.73,
          reasoning: 'Access management control but category unclear'
        },
        qualityScore: 0.58,
        qualityIssues: ['Title too short', 'Missing implementation details'],
        suggestions: {
          title: 'Expand control title with specific access requirements',
          description: 'Add implementation steps and testing procedures'
        },
        requiresHumanReview: true,
        reviewThreshold: 0.85,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
      }
    ];
  }

  private buildClassificationPrompt(request: DataQualityRequest): string {
    return `
Analyze this ${request.recordType} record for classification:

Title: ${request.data.title}
Description: ${request.data.description}
Current Category: ${request.data.currentCategory || 'Not set'}

Available Categories: Privacy Breach, Technology Risk, Operational Risk, Financial Risk, Compliance Gap, Access Control, Detective Control, Preventive Control

Provide:
1. Most appropriate category
2. Confidence score (0-1)
3. Brief reasoning

Format as JSON: {"category": "...", "confidence": 0.xx, "reasoning": "..."}
    `;
  }

  private parseAIResponse(response: string, request: DataQualityRequest): DataQualityResult['suggestedClassification'] {
    try {
      // Try to extract JSON from response
      const match = response.match(/\{.*\}/s);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          category: parsed.category || 'Unknown',
          confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
          reasoning: parsed.reasoning || 'AI classification based on content analysis'
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI response, using fallback');
    }
    
    // Fallback to rule-based
    return this.ruleBasedClassify(request);
  }

  private loadTaxonomy(): void {
    // Mock taxonomy data for local development
    this.taxonomyData = {
      incident_categories: ['Privacy Breach', 'Technology Risk', 'Operational Risk', 'Financial Risk'],
      risk_categories: ['Technology Risk', 'Operational Risk', 'Financial Risk', 'Compliance Gap'],
      control_types: ['Preventive Control', 'Detective Control', 'Corrective Control', 'Access Control'],
      severity_levels: ['Low', 'Medium', 'High', 'Critical'],
      frameworks: ['ISO27001', 'NIST', 'COSO', 'GDPR', 'SOX']
    };
  }
}

export const dataQualityService = new DataQualityService();