import { Router } from 'express';
import { useCaseController } from '@/controllers/useCaseController';

/**
 * Insights Routes
 * Risk & Control Insights Generator - AI agent for strategic GRC analysis
 */
export const insightsRouter = Router();

// Generate strategic insights
insightsRouter.post('/generate', useCaseController.generateInsights.bind(useCaseController));

// Get risk insights dashboard
insightsRouter.get('/dashboard', useCaseController.getInsightsDashboard.bind(useCaseController));

// Demo endpoint for testing insights generation
insightsRouter.get('/demo', useCaseController.getDemoData.bind(useCaseController));

// Health check for insights service
insightsRouter.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Risk & Control Insights Generator',
    status: 'healthy',
    features: ['Natural Language Queries', 'AI Agent Orchestration', 'Predictive Analytics', 'Executive Summaries'],
    capabilities: ['Strategic Analysis', 'Risk Forecasting', 'Control Gap Analysis', 'Trend Identification'],
    aiIntegration: {
      openaiAvailable: !!process.env.OPENAI_API_KEY,
      fallbackMode: !process.env.OPENAI_API_KEY ? 'rule-based' : 'ai-powered',
      status: 'operational'
    },
    timestamp: new Date()
  });
});

export default insightsRouter;