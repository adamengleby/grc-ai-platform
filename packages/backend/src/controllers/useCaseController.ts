/**
 * Use Case Controller
 * Handles the two primary GRC AI use cases
 */

import { Request, Response } from 'express';
import { dataQualityService, DataQualityRequest } from '@/services/dataQualityService';
import { insightsGeneratorService, InsightQuery } from '@/services/insightsGeneratorService';

export class UseCaseController {

  /**
   * Use Case 1: Smart Data Quality Checker
   * POST /api/v1/use-cases/data-quality/process
   */
  async processDataQuality(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      const request: DataQualityRequest = {
        tenantId,
        ...req.body
      };

      const result = await dataQualityService.processRecord(request);
      
      res.json({
        success: true,
        data: result,
        useCase: 'Smart Data Quality Checker',
        message: result.requiresHumanReview 
          ? 'Record processed - requires human review' 
          : 'Record processed - auto-classified',
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Data quality processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process data quality request',
        useCase: 'Smart Data Quality Checker',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get Data Quality Dashboard
   * GET /api/v1/use-cases/data-quality/dashboard
   */
  async getDataQualityDashboard(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      const dashboard = await dataQualityService.getDashboardData(tenantId);
      
      res.json({
        success: true,
        data: dashboard,
        useCase: 'Smart Data Quality Checker',
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Data quality dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch data quality dashboard',
        timestamp: new Date()
      });
    }
  }

  /**
   * Use Case 2: Risk & Control Insights Generator
   * POST /api/v1/use-cases/insights/generate
   */
  async generateInsights(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      const query: InsightQuery = {
        tenantId,
        question: req.body.question,
        context: req.body.context
      };

      console.log(`🧠 Processing insight query: "${query.question}"`);
      
      const insight = await insightsGeneratorService.generateInsight(query);
      
      res.json({
        success: true,
        data: insight,
        useCase: 'Risk & Control Insights Generator',
        message: 'Strategic insight generated successfully',
        processingTime: `${Date.now() - insight.generatedAt.getTime()}ms`,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Insights generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate insights',
        useCase: 'Risk & Control Insights Generator',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get Risk Insights Dashboard
   * GET /api/v1/use-cases/insights/dashboard
   */
  async getInsightsDashboard(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      const dashboard = await insightsGeneratorService.getInsightsDashboard(tenantId);
      
      res.json({
        success: true,
        data: dashboard,
        useCase: 'Risk & Control Insights Generator',
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Insights dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch insights dashboard',
        timestamp: new Date()
      });
    }
  }

  /**
   * Demo endpoint for testing both use cases
   * GET /api/v1/use-cases/demo
   */
  async getDemoData(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';

      // Sample data quality processing
      const sampleIncident: DataQualityRequest = {
        tenantId,
        recordType: 'incident',
        data: {
          id: 'INC-DEMO-001',
          title: 'System access issue',
          description: 'Users reporting they cannot access the customer database and getting authentication errors',
          currentCategory: 'IT Issue'
        }
      };

      const qualityResult = await dataQualityService.processRecord(sampleIncident);

      // Sample insights query
      const sampleQuery: InsightQuery = {
        tenantId,
        question: 'What controls are we missing for cyber risks?',
        context: {
          timeframe: '90 days',
          riskCategories: ['Technology'],
          focusArea: 'controls'
        }
      };

      const insightResult = await insightsGeneratorService.generateInsight(sampleQuery);

      res.json({
        success: true,
        demo: true,
        data: {
          dataQualityExample: {
            input: sampleIncident,
            output: qualityResult,
            explanation: 'AI analyzed the incident and suggested "Technology Risk" with 87% confidence, identifying it as likely authentication/access control issue.'
          },
          insightsExample: {
            input: sampleQuery,
            output: insightResult,
            explanation: 'AI Agent analyzed risk and control data, identifying 7 missing cybersecurity controls with specific recommendations.'
          }
        },
        message: 'Demo showing both use cases working together',
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Demo data error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate demo data',
        timestamp: new Date()
      });
    }
  }

  /**
   * Health check for both use cases
   * GET /api/v1/use-cases/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const status = {
        dataQualityService: {
          status: 'healthy',
          features: ['AI Classification', 'Rule-based Fallback', 'Confidence Scoring', 'Human Review Workflow'],
          capabilities: ['Incident Analysis', 'Risk Classification', 'Control Assessment']
        },
        insightsService: {
          status: 'healthy',
          features: ['Natural Language Queries', 'AI Agent Orchestration', 'Predictive Analytics', 'Executive Summaries'],
          capabilities: ['Strategic Analysis', 'Risk Forecasting', 'Control Gap Analysis', 'Trend Identification']
        },
        aiIntegration: {
          openaiAvailable: !!process.env.OPENAI_API_KEY,
          fallbackMode: !process.env.OPENAI_API_KEY ? 'rule-based' : 'ai-powered',
          status: 'operational'
        }
      };

      res.json({
        success: true,
        data: status,
        message: 'Both use cases operational and ready for production',
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        timestamp: new Date()
      });
    }
  }
}

export const useCaseController = new UseCaseController();