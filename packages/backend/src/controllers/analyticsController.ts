import { Request, Response } from 'express';
import { analyticsService } from '@/services/analyticsService';
import { ApiResponse } from '@/types/analytics';
import { config } from '@/config';

/**
 * Analytics Controller
 * Handles HTTP requests for analytics endpoints
 */
export class AnalyticsController {
  
  /**
   * Get real-time metrics
   * GET /api/v1/analytics/metrics
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      
      // Simulate mock latency in development
      if (config.development.useMockData && config.development.mockLatencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.development.mockLatencyMs));
      }

      const metrics = await analyticsService.getRealTimeMetrics(tenantId);
      
      const response: ApiResponse<typeof metrics> = {
        success: true,
        data: metrics,
        timestamp: new Date(),
        tenantId,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to fetch metrics',
        timestamp: new Date(),
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get risk analytics
   * GET /api/v1/analytics/risk
   */
  async getRiskAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      
      if (config.development.useMockData && config.development.mockLatencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.development.mockLatencyMs));
      }

      const riskAnalytics = await analyticsService.getRiskAnalytics(tenantId);
      
      const response: ApiResponse<typeof riskAnalytics> = {
        success: true,
        data: riskAnalytics,
        timestamp: new Date(),
        tenantId,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching risk analytics:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to fetch risk analytics',
        timestamp: new Date(),
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get compliance analytics
   * GET /api/v1/analytics/compliance
   */
  async getComplianceAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      
      if (config.development.useMockData && config.development.mockLatencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.development.mockLatencyMs));
      }

      const complianceAnalytics = await analyticsService.getComplianceAnalytics(tenantId);
      
      const response: ApiResponse<typeof complianceAnalytics> = {
        success: true,
        data: complianceAnalytics,
        timestamp: new Date(),
        tenantId,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching compliance analytics:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to fetch compliance analytics',
        timestamp: new Date(),
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get control analytics
   * GET /api/v1/analytics/controls
   */
  async getControlAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      
      if (config.development.useMockData && config.development.mockLatencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.development.mockLatencyMs));
      }

      const controlAnalytics = await analyticsService.getControlAnalytics(tenantId);
      
      const response: ApiResponse<typeof controlAnalytics> = {
        success: true,
        data: controlAnalytics,
        timestamp: new Date(),
        tenantId,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching control analytics:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to fetch control analytics',
        timestamp: new Date(),
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get predictive insights
   * GET /api/v1/analytics/predictions
   */
  async getPredictiveInsights(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      
      if (config.development.useMockData && config.development.mockLatencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.development.mockLatencyMs));
      }

      const predictions = await analyticsService.getPredictiveInsights(tenantId);
      
      const response: ApiResponse<typeof predictions> = {
        success: true,
        data: predictions,
        timestamp: new Date(),
        tenantId,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching predictive insights:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to fetch predictive insights',
        timestamp: new Date(),
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get event stream
   * GET /api/v1/analytics/events
   */
  async getEventStream(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      
      if (config.development.useMockData && config.development.mockLatencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.development.mockLatencyMs));
      }

      const events = await analyticsService.getEventStream(tenantId);
      
      const response: ApiResponse<typeof events> = {
        success: true,
        data: events,
        timestamp: new Date(),
        tenantId,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching event stream:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to fetch event stream',
        timestamp: new Date(),
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get ML models
   * GET /api/v1/analytics/models
   */
  async getMLModels(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      
      if (config.development.useMockData && config.development.mockLatencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.development.mockLatencyMs));
      }

      const models = await analyticsService.getMLModels(tenantId);
      
      const response: ApiResponse<typeof models> = {
        success: true,
        data: models,
        timestamp: new Date(),
        tenantId,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching ML models:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to fetch ML models',
        timestamp: new Date(),
      };
      res.status(500).json(response);
    }
  }

  /**
   * Debug endpoint - show raw MCP data retrieval status
   * GET /api/v1/analytics/debug
   */
  async getDebugInfo(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default-tenant';
      
      // Test MCP connection and data retrieval
      const debugInfo = await analyticsService.getDebugInfo(tenantId);
      
      const response: ApiResponse<typeof debugInfo> = {
        success: true,
        data: debugInfo,
        timestamp: new Date(),
        tenantId,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching debug info:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to fetch debug info',
        timestamp: new Date(),
      };
      res.status(500).json(response);
    }
  }

  /**
   * Clear cache endpoint
   * DELETE /api/v1/analytics/cache
   */
  async clearCache(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      const cacheType = req.query.type as string;

      analyticsService.clearCache(tenantId, cacheType);
      
      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { 
          message: cacheType 
            ? `Cleared ${cacheType} cache for ${tenantId}` 
            : tenantId 
            ? `Cleared all cache for ${tenantId}`
            : 'Cleared all cache'
        },
        timestamp: new Date(),
        tenantId,
      };

      res.json(response);
    } catch (error) {
      console.error('Error clearing cache:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to clear cache',
        timestamp: new Date(),
      };
      res.status(500).json(response);
    }
  }

  /**
   * Health check endpoint
   * GET /api/v1/analytics/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        version: '1.0.0',
        services: {
          database: 'connected', // TODO: Check real database connection
          redis: 'connected', // TODO: Check real Redis connection
          analytics: 'operational',
        }
      };

      const response: ApiResponse<typeof health> = {
        success: true,
        data: health,
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      console.error('Health check error:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Health check failed',
        timestamp: new Date(),
      };
      res.status(500).json(response);
    }
  }

  /**
   * Run comprehensive record test for specified applications
   * GET /api/v1/analytics/test-records
   */
  async getComprehensiveRecordTest(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'acme-corp';
      
      console.log(`[Analytics Controller] Starting comprehensive record test for tenant: ${tenantId}`);
      
      // Run comprehensive test for all specified applications
      const testResults = await analyticsService.getComprehensiveRecordTest(tenantId);
      
      const response: ApiResponse<typeof testResults> = {
        success: true,
        data: testResults,
        timestamp: new Date(),
        tenantId,
      };

      res.json(response);
    } catch (error) {
      console.error('Error running comprehensive record test:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to run comprehensive record test',
        timestamp: new Date(),
      };
      res.status(500).json(response);
    }
  }
}

export const analyticsController = new AnalyticsController();

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        roles: string[];
      };
    }
  }
}