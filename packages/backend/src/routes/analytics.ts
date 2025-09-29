import { Router } from 'express';
import { analyticsController } from '@/controllers/analyticsController';

/**
 * Analytics Routes
 * Defines all routes for analytics endpoints
 */
export const analyticsRouter = Router();

// Real-time metrics endpoint
analyticsRouter.get('/metrics', analyticsController.getMetrics.bind(analyticsController));

// Risk analytics endpoint
analyticsRouter.get('/risk', analyticsController.getRiskAnalytics.bind(analyticsController));

// Compliance analytics endpoint
analyticsRouter.get('/compliance', analyticsController.getComplianceAnalytics.bind(analyticsController));

// Control analytics endpoint
analyticsRouter.get('/controls', analyticsController.getControlAnalytics.bind(analyticsController));

// Predictive insights endpoint
analyticsRouter.get('/predictions', analyticsController.getPredictiveInsights.bind(analyticsController));

// Event stream endpoint
analyticsRouter.get('/events', analyticsController.getEventStream.bind(analyticsController));

// ML models endpoint
analyticsRouter.get('/models', analyticsController.getMLModels.bind(analyticsController));

// Debug endpoint
analyticsRouter.get('/debug', analyticsController.getDebugInfo.bind(analyticsController));

// Comprehensive record test endpoint
analyticsRouter.get('/test-records', analyticsController.getComprehensiveRecordTest.bind(analyticsController));

// Health check endpoint
analyticsRouter.get('/health', analyticsController.healthCheck.bind(analyticsController));

// Cache management endpoint
analyticsRouter.delete('/cache', analyticsController.clearCache.bind(analyticsController));

export default analyticsRouter;